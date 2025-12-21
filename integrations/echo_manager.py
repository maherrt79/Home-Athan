import logging
import requests

logger = logging.getLogger(__name__)

class EchoManager:
    def __init__(self, config):
        self.config = config

    def trigger_routine(self, prayer_name: str):
        """
        Trigger an Alexa routine via a Webhook URL.
        Configuration should look like:
        devices:
          echo_webhook_url: "https://maker.ifttt.com/trigger/..."
        """
        if not self.config.get("devices", "echo_enabled", False):
            return

        url = self.config.get("devices", "echo_webhook_url")
        if not url:
            logger.warning("Echo enabled but no webhook URL configured.")
            return

        try:
            logger.info(f"Triggering Echo webhook for {prayer_name}")
            payload = {"value1": prayer_name}
            requests.post(url, json=payload, timeout=5)
        except Exception as e:
            logger.error(f"Failed to trigger Echo webhook: {e}")
