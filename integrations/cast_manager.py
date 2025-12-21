import pychromecast
import logging
import socket
import threading
import time
import os

logger = logging.getLogger(__name__)

class CastManager:
    def __init__(self, config):
        self.config = config
        self.devices = {}
        self.browser = None
        self.local_ip = self.get_local_ip()
        self.stop_event = threading.Event()

    def get_local_ip(self):
        """Get the local IP address of this machine."""
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.settimeout(0)
            # doesn't even have to be reachable
            s.connect(('10.254.254.254', 1)) 
            ip = s.getsockname()[0]
            s.close()
            return ip
        except Exception:
            return '127.0.0.1'

    def start_discovery(self):
        """Start discovering Cast devices using CastBrowser."""
        from pychromecast import CastBrowser, SimpleCastListener
        import zeroconf
        
        self.zconf = zeroconf.Zeroconf()
        
        class DeviceListener(SimpleCastListener):
            def __init__(self, manager):
                self.manager = manager
                super().__init__()
                
            def add_cast(self, uuid, service):
                # When add_cast is called, we update our device list
                self.manager._process_device_update(uuid)
                
            def update_cast(self, uuid, service):
                self.manager._process_device_update(uuid)
                
            def remove_cast(self, uuid, service, cast):
                if uuid in self.manager.devices:
                    logger.info(f"Cast device removed: {uuid}")
                    self.manager.devices.pop(uuid, None)

        self.listener = DeviceListener(self)
        self.browser = CastBrowser(self.listener, self.zconf)
        self.browser.start_discovery()
        logger.info("Started CastBrowser discovery...")

    def _process_device_update(self, uuid):
        """Update our internal device list from the browser."""
        # browser.devices is a dict of uuid -> CastInfo (named tuple)
        # We must convert it to a Chromecast object to control it.
        try:
            from pychromecast import get_chromecast_from_cast_info
            
            if uuid in self.browser.devices:
                cast_info = self.browser.devices[uuid]
                # Create the Chromecast object
                cast = get_chromecast_from_cast_info(cast_info, self.zconf)
                
                if uuid not in self.devices:
                    logger.info(f"Found New Cast device: {cast.name} ({uuid})")
                
                self.devices[uuid] = cast
        except Exception as e:
            logger.error(f"Error processing device update for {uuid}: {e}")

    def play_audio(self, audio_path: str, volume: float = None, target_devices: list = None, title: str = None, image_path: str = None):
        """
        Play the audio on enabled devices.
        audio_path: local file path e.g. 'audio/fajr.mp3'
        volume: optional float 0.0 to 1.0 override
        target_devices: optional list of UUID strings. If provided, plays ONLY on these. 
                        If None, uses global enabled_devices.
        title: Optional title for the cast media
        image_path: Optional local path to an image file (relative to web root or absolute?) - lets assume relative to web root or static
                    Actually better if it receives a web/static relative path or just filename in img dir.
        """
        # Clear stop event at start of new playback
        self.stop_event.clear()

        if not self.config.get("devices", "cast_enabled", True):
            logger.info("Casting is disabled in config.")
            return

        if not audio_path or not os.path.exists(audio_path):
            logger.warning(f"Audio file not found: {audio_path}")
            return

        # Convert local path to URL
        # We assume the web server is running on the configured port
        port = self.config.get("system", "web_port", 8000)

        # Calculate relative path from 'audio' directory to handle subfolders
        # audio_path might be 'audio/athan/file.mp3' -> relative = 'athan/file.mp3'
        try:
             # Assuming audio_path is relative to CWD or absolute.
             # If absolute: /path/to/Home-Athan/audio/athan/file.mp3
             # We want relative to 'audio' folder which is mounted at /audio
             # Check if 'audio' is in path
             abs_audio_path = os.path.abspath(audio_path)
             abs_base_dir = os.path.abspath("audio")
             
             if abs_audio_path.startswith(abs_base_dir):
                 relative_path = os.path.relpath(abs_audio_path, abs_base_dir)
             else:
                 # Fallback: just basename (fails for subdirs but safe)
                 relative_path = os.path.basename(audio_path)
        except Exception:
             relative_path = os.path.basename(audio_path)

        # filename = os.path.basename(audio_path) # OLD logic flattened path
        
        # Ensure we bind to 0.0.0.0 effectively, so use local_ip
        # URL structure: http://IP:8000/audio/relativePath
        url = f"http://{self.local_ip}:{port}/audio/{relative_path}"
        
        image_url = None
        if image_path:
             # If passed as 'web/static/img/BG.png', we serve it via /static/img/BG.png
             # Assuming app.py mounts /static -> web/static
             # If input is 'athan_background.png', assuming it is in web/static/img/
             if "web/static/" in image_path:
                 relative_path = image_path.split("web/static/")[1] # e.g. img/athan_background.png
                 image_url = f"http://{self.local_ip}:{port}/static/{relative_path}"
             else:
                 # Fallback/Safe assumption
                  image_url = f"http://{self.local_ip}:{port}/static/img/{os.path.basename(image_path)}"

        logger.info(f"Casting URL: {url} | Title: {title} | Image: {image_url}")
        
        # Determine which devices to use
        if target_devices is not None:
            # target_devices might be empty list [] -> means play on NO devices
            effective_devices = target_devices
        else:
            # Fallback to global config
            effective_devices = self.config.get("devices", "enabled_devices", [])
        
        for uuid, cast in self.devices.items():
            # Check if this specific device is enabled
            should_play = True
            if effective_devices and len(effective_devices) > 0:
                 if str(uuid) not in effective_devices:
                     should_play = False
            
            if not should_play:
                logger.debug(f"Skipping {cast.name} (Not in target list)")
                continue
            try:
                # Check stop event before starting each device
                if self.stop_event.is_set():
                    logger.info("Playback aborted by stop signal.")
                    break

                logger.info(f"Casting to {cast.name}...")
                cast.wait() # ensure connected
                mc = cast.media_controller
                
                # Determine target volume. If not specified, use current volume or default to 0.5
                target_vol = volume if volume is not None else cast.status.volume_level if cast.status and cast.status.volume_level is not None else 0.5

                # Metadata setup
                # pychromecast play_media(url, content_type, title=None, thumb=None, ...)
                # thumb is expected to be a URL string or None
                
                # Smart Fade In
                # If fade_in is enabled in config (default True)
                if self.config.get("audio", "fade_in", True):
                    # Start at 0
                    cast.set_volume(0.0)
                    start_volume = 0.0
                    steps = 10
                    step_delay = 0.5 # 5 seconds total fade
                    volume_step = target_vol / steps
                    
                    mc.play_media(url, content_type='audio/mp3', title=title, thumb=image_url)
                    mc.block_until_active(timeout=10) # Increased timeout
                    
                    # Verify state before fading in
                    if mc.status.player_state in ('IDLE', 'UNKNOWN') and mc.status.content_id != url:
                        logger.warning(f"Media failed to load on {cast.name}, skipping fade-in.")
                        # Restore volume just in case? Or leave it?
                        # If we leave it at 0, it's silent. If we set it to target, it might blare.
                        # Safe to abort.
                    else:
                        current_vol = 0.0
                        for i in range(steps):
                            # Check stop event INSIDE loop
                            if self.stop_event.is_set():
                                logger.info(f"Fade-in interrupted on {cast.name}")
                                break
                            
                            time.sleep(step_delay)
                            current_vol += volume_step
                            if current_vol > target_vol:
                                current_vol = target_vol
                            cast.set_volume(current_vol)
                else:
                    # Instant volume set
                    cast.set_volume(target_vol)
                    mc.play_media(url, content_type='audio/mp3', title=title, thumb=image_url)
                    mc.block_until_active()
            except Exception as e:
                logger.error(f"Failed to cast to {cast.name}: {e}")

    def stop_all(self, target_devices: list = None):
        """Stop playback and quit app on devices.
        
        Args:
            target_devices: Optional list of UUID strings. If provided, only stop on these.
                           If None, stops on ALL devices.
        """
        self.stop_event.set() # Signal all loops to stop
        
        # Determine which devices to stop
        if target_devices is not None and len(target_devices) > 0:
            logger.info(f"Stopping audio on {len(target_devices)} targeted devices...")
        else:
            logger.info(f"Stopping all audio on {len(self.devices)} devices...")
        
        for uuid, cast in self.devices.items():
            # If target_devices specified, only stop on those
            if target_devices is not None and len(target_devices) > 0:
                if str(uuid) not in target_devices:
                    logger.debug(f"Skipping {cast.name} (not in target list)")
                    continue
            
            try:
                # CRITICAL: Must wait for connection before sending commands
                cast.wait(timeout=5)
                logger.debug(f"Connection established to {cast.name}")
            except Exception as e:
                logger.warning(f"Could not connect to {cast.name} for stop: {e}")
                continue  # Skip this device if we can't connect
            
            # Stop Media
            try:
                cast.media_controller.stop()
                logger.debug(f"Stop command sent to {cast.name}")
            except Exception as e:
                # It's common for stop to fail if nothing is playing (no active session)
                logger.debug(f"Stop command on {cast.name} ignored: {e}")

            # Quit the App (Force kill) - ensure we try this even if stop failed
            try:
                cast.quit_app()
                logger.info(f"Stopped {cast.name}")
            except Exception as e:
                logger.warning(f"Could not quit app on {cast.name}: {e}")
