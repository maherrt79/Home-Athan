import yaml
import os
import logging
from typing import Any

logger = logging.getLogger(__name__)

class ConfigManager:
    def __init__(self, config_path="config/config.yaml", default_path="config/default_config.yaml"):
        self.config_path = config_path
        self.default_path = default_path
        self.config: dict[str, Any] = {}
        self.load_config()

    def load_config(self):
        """Loads config from file, falling back to defaults if necessary."""
        # Try to load user config
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, 'r') as f:
                    self.config = yaml.safe_load(f) or {}
                logger.info(f"Loaded configuration from {self.config_path}")
            except Exception as e:
                logger.error(f"Error loading config from {self.config_path}: {e}")
                self.config = {}
        
        # Load defaults to fill in gaps
        if os.path.exists(self.default_path):
            try:
                with open(self.default_path, 'r') as f:
                    defaults = yaml.safe_load(f) or {}
                
                self._deep_merge(self.config, defaults)
                
                logger.info(f"Merged with defaults from {self.default_path}")
            except Exception as e:
                logger.error(f"Error loading defaults: {e}")

    def _deep_merge(self, target: dict, source: dict):
        """Recursively merge source dict into target dict."""
        for key, value in source.items():
            if isinstance(value, dict):
                node = target.setdefault(key, {})
                if isinstance(node, dict):
                    self._deep_merge(node, value)
                else:
                    # Target has a non-dict value here, keep it (user override) 
                    # or overwrite if we wanted strict schema (but we adhere to user config)
                    pass
            else:
                if key not in target:
                    target[key] = value

    def get(self, section: str, key: str = None, default: Any = None):
        """Retrieve a config value safely."""
        if section not in self.config:
            return default
        
        if key is None:
            return self.config[section]
            
        return self.config[section].get(key, default)

    def set(self, section: str, key: str, value: Any):
        """Set a config value and save."""
        if section not in self.config:
            self.config[section] = {}
        self.config[section][key] = value
        self.save()

    def update(self, config_data: dict):
        """Update config with a dictionary (deep merge) and save."""
        # We can reuse the deep merge logic, but inverted: existing config is target, new data is source.
        # However, for updates, we want the NEW data to overwrite the OLD data.
        # Example: self._deep_update(self.config, config_data)
        self._deep_update(self.config, config_data)
        self.save()

    def _deep_update(self, target: dict, source: dict):
        """Recursively update target with source."""
        for key, value in source.items():
            if isinstance(value, dict) and key in target and isinstance(target[key], dict):
                self._deep_update(target[key], value)
            else:
                target[key] = value

    def save(self):
        """Save current config to file atomically.
        
        Uses a temp file + rename pattern to ensure the config file
        is never left in a corrupted state if the process crashes mid-write.
        """
        temp_path = self.config_path + '.tmp'
        try:
            with open(temp_path, 'w') as f:
                yaml.dump(self.config, f, default_flow_style=False)
            # os.replace is atomic on POSIX systems
            os.replace(temp_path, self.config_path)
            logger.info("Configuration saved.")
        except Exception as e:
            logger.error(f"Error saving config: {e}")
            # Clean up temp file if it exists
            if os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except OSError:
                    pass

