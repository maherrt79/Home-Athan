from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.date import DateTrigger
from core.calculator import PrayerCalculator
from core.audio_manager import AudioManager
from integrations.cast_manager import CastManager
import logging
import os
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class AthanScheduler:
    def __init__(self, config):
        self.config = config
        self.scheduler = BackgroundScheduler()
        self.calculator = PrayerCalculator(config)
        self.audio_manager = AudioManager(config)
        self.cast_manager = CastManager(config)
        # Helper to track jobs
        self.today_jobs = []

    def start(self):
        """Start the scheduler and schedule today's prayers."""
        logger.info("Starting Scheduler...")
        self.scheduler.start()
        
        # Start the Cast discovery in background
        self.cast_manager.start_discovery()
        
        # Schedule the daily refresh job
        self.schedule_daily_refresh()
        
        # Schedule today's prayers immediately
        self.refresh_prayer_times()

    def schedule_daily_refresh(self):
        """Schedule the job that recalculates prayer times every night at 12:01 AM."""
        # Use a cron trigger for daily refresh
        self.scheduler.add_job(
            self.refresh_prayer_times, 
            'cron', 
            hour=0, 
            minute=1, 
            id='daily_refresh', 
            replace_existing=True
        )

    def get_prayer_settings(self, prayer_name: str) -> dict:
        """Helper to extract and normalize settings for a prayer."""
        prayer_config = self.config.get("prayers", prayer_name)
        
        # Default Settings
        settings = {
            "athan_enabled": True,
            "athan_audio_file": None,
            "athan_volume": 0.5,
            "reminder_enabled": False,
            "reminder_offset": 0,
            "reminder_timing": "before",
            "reminder_audio_file": None,
            "reminder_volume": 0.3,
            "enabled_devices": [],
            "athan_offset": 0,
            "athan_timing": "before"
        }

        if isinstance(prayer_config, bool):
            settings["athan_enabled"] = prayer_config
        elif isinstance(prayer_config, dict):
            settings["athan_enabled"] = prayer_config.get("athan_enabled", True)
            settings["athan_audio_file"] = prayer_config.get("athan_audio_file")
            settings["athan_volume"] = prayer_config.get("athan_volume", 0.5)
            settings["reminder_enabled"] = prayer_config.get("reminder_enabled", False)
            settings["reminder_offset"] = prayer_config.get("reminder_offset", 0)
            settings["reminder_timing"] = prayer_config.get("reminder_timing", "before")
            settings["reminder_audio_file"] = prayer_config.get("reminder_audio_file")
            settings["reminder_volume"] = prayer_config.get("reminder_volume", 0.3)
            settings["enabled_devices"] = prayer_config.get("enabled_devices", [])
            settings["athan_offset"] = prayer_config.get("athan_offset", 0)
            settings["athan_timing"] = prayer_config.get("athan_timing", "before")

        return settings

    def refresh_prayer_times(self):
        """Calculate times for today and schedule audio playback."""
        logger.info("Refreshing prayer times for today...")
        
        # Clear existing prayer jobs if any (except daily_refresh)
        for job_id in self.today_jobs:
            try:
                self.scheduler.remove_job(job_id)
            except Exception:
                pass # Job might have already run
        self.today_jobs = []

        # Calculate new times
        times = self.calculator.calculate_times()
        # Calculator returns offset-naive datetimes (local wall-clock time)
        now = datetime.now()

        for prayer_name, prayer_time in times.items():
            settings = self.get_prayer_settings(prayer_name)

            # Decoupled Logic: Continue if EITHER Athan OR Reminder is enabled
            if not settings["athan_enabled"] and not settings["reminder_enabled"]:
                logger.debug(f"Skipping {prayer_name} (All Disabled)")
                continue

            # Only schedule Athan if specifically enabled
            if settings["athan_enabled"]:
                # Calculate adjusted athan time
                ath_offset = settings.get("athan_offset", 0)
                ath_timing = settings.get("athan_timing", "before")
                
                if ath_timing == "after":
                    athan_time = prayer_time + timedelta(minutes=ath_offset)
                else:
                    athan_time = prayer_time - timedelta(minutes=ath_offset)

                if athan_time > now:
                    # Schedule Athan
                    athan_job_id = f"athan_{prayer_name}"
                    
                    self.scheduler.add_job(
                        self.play_athan,
                        'date',
                        run_date=athan_time,
                        args=[prayer_name, settings], 
                        id=athan_job_id,
                        name=f"Athan for {prayer_name}",
                        replace_existing=True
                    )
                    self.today_jobs.append(athan_job_id)
                    logger.info(f"Scheduled {prayer_name} at {athan_time} (offset: {ath_timing} {ath_offset}m)")

            # Schedule Reminder independently?
            if settings["reminder_enabled"] and settings["reminder_offset"] > 0:
                offset = settings["reminder_offset"]
                timing = settings["reminder_timing"]
                
                if timing == "after":
                    rem_time = prayer_time + timedelta(minutes=offset)
                else: # "before"
                    rem_time = prayer_time - timedelta(minutes=offset)

                if rem_time > now: # Only schedule if reminder time is in the future
                    rem_job_id = f"reminder_{prayer_name}"
                    
                    self.scheduler.add_job(
                        self.play_reminder,
                        'date',
                        run_date=rem_time,
                        args=[prayer_name, settings],
                        id=rem_job_id,
                        name=f"Reminder for {prayer_name}",
                        replace_existing=True
                    )
                    self.today_jobs.append(rem_job_id)
                    logger.info(f"Scheduled reminder for {prayer_name} ({timing} {offset}m) at {rem_time}")

    def play_athan(self, prayer_name: str, prayer_settings: dict):
        """Trigger the Athan playback."""
        logger.info(f"TRIGGER: Time for {prayer_name} Prayer!")
        
        # Get Audio File
        # Determine audio source
        audio_file = prayer_settings.get("athan_audio_file")
        # Use new audio_manager method to resolve path
        audio_path = self.audio_manager.get_athan_path(audio_file)
        
        logger.info(f"Playing Athan for {prayer_name} using {audio_path}")

        devices = prayer_settings.get("enabled_devices", [])
        volume = prayer_settings.get("athan_volume", 0.5)

        # Play on specified devices
        self.cast_manager.play_audio(
            target_devices=devices, 
            audio_path=audio_path, 
            volume=volume,
            title=f"{prayer_name} Athan",
            image_path="web/static/img/athan_background.png"
        )
        
    def play_reminder(self, prayer_name: str, settings: dict):
        """
        Trigger a reminder.
        settings expects: reminder_enabled, enabled_devices, reminder_offset, reminder_timing, volume, reminder_audio_file
        """
        if not settings.get("reminder_enabled"):
            return

        devices = settings.get("enabled_devices", [])
        if not devices:
            return

        minutes = settings.get("reminder_offset", 0)
        timing = settings.get("reminder_timing", "before")
        volume = settings.get("reminder_volume", 0.3)

        logger.info(f"TRIGGER: Reminder for {prayer_name} ({timing} {minutes}m)")
        
        # Determine Audio File
        rem_file = settings.get("reminder_audio_file")
        
        # Resolve Path (AudioManager handles fallback to beep.mp3)
        audio_path_to_play = self.audio_manager.get_reminder_path(rem_file)
        
        # Play on specified devices
        self.cast_manager.play_audio(
            target_devices=devices, 
            audio_path=audio_path_to_play, 
            volume=volume,
            title=f"{prayer_name} Reminder",
            image_path="web/static/img/athan_background.png"
        )

    def stop_all(self, target_devices: list = None):
        """Stop playback on devices.
        
        Args:
            target_devices: Optional list of UUID strings. If provided, only stop on these.
        """
        logger.info("Stopping audio playback...")
        self.cast_manager.stop_all(target_devices=target_devices)
