import logging
import sys
import uvicorn
from core.scheduler import AthanScheduler
from web.app import create_app
from config.config_manager import ConfigManager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("main")

def main():
    logger.info("Starting Home Athan Automation System...")
    
    # 1. Load Configuration
    config = ConfigManager()
    
    # 2. Start Scheduler
    scheduler = AthanScheduler(config)
    scheduler.start()
    
    # 3. Create Web App
    app = create_app(config, scheduler)
    
    # 4. Run Server
    # Note: In production, this might be run via gunicorn/uvicorn directly, 
    # but for simplicity/development we run it here.
    uvicorn.run(app, host="0.0.0.0", port=config.get("system", "web_port", 8000))

if __name__ == "__main__":
    main()
