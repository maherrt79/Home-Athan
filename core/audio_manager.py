import os
import logging

logger = logging.getLogger(__name__)

class AudioManager:
    def __init__(self, config):
        self.config = config
        self.base_path = "audio"
        self.athan_dir = os.path.join(self.base_path, "athan")
        self.reminder_dir = os.path.join(self.base_path, "reminders")
        
        # Ensure directories exist
        os.makedirs(self.athan_dir, exist_ok=True)
        os.makedirs(self.reminder_dir, exist_ok=True)

    def list_athan_files(self) -> list:
        """List mp3 files in the athan directory."""
        if not os.path.exists(self.athan_dir):
            return []
        
        files = [f for f in os.listdir(self.athan_dir) if f.endswith(".mp3")]
        files.sort()
        return files

    def list_reminder_files(self) -> list:
        """List mp3 files in the reminder directory."""
        if not os.path.exists(self.reminder_dir):
            return []
        
        files = [f for f in os.listdir(self.reminder_dir) if f.endswith(".mp3")]
        files.sort()
        return files

    def get_default_athan(self) -> str:
        """Get the default athan file from config."""
        filename = self.config.get("audio", "default_file")
        if not filename or not filename.strip():
            filename = "athan_alqahera.mp3"
        return filename

    def get_athan_path(self, filename: str = None) -> str:
        """Return path for a specific athan file, with fallback to default."""
        if not filename:
            filename = self.get_default_athan()
        
        path = os.path.join(self.athan_dir, filename)
        if os.path.isfile(path):
            return path
        
        # Fallback to default if specified file doesn't exist
        default_path = os.path.join(self.athan_dir, self.get_default_athan())
        if os.path.isfile(default_path):
            logger.warning(f"Athan file '{filename}' not found, using default.")
            return default_path
        
        # Last resort: return first available athan file
        available = self.list_athan_files()
        if available:
            logger.warning(f"Default athan not found, using '{available[0]}'.")
            return os.path.join(self.athan_dir, available[0])
        
        logger.error("No athan files available!")
        return path  # Return original path, let caller handle missing file

    def get_reminder_path(self, filename: str = None) -> str:
        """Return path for a specific reminder file with fallback to beep.mp3."""
        if not filename:
            filename = "beep.mp3"
            
        path = os.path.join(self.reminder_dir, filename)
        if os.path.exists(path):
            return path
            
        # Fallback to beep.mp3 if specific file missing
        beep_path = os.path.join(self.reminder_dir, "beep.mp3")
        if os.path.exists(beep_path):
            logger.warning(f"Reminder file '{filename}' not found, using beep.mp3.")
            return beep_path
        
        logger.error("No reminder files available!")
        return path  # Return original path, let caller handle missing file
