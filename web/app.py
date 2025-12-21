from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from web.api import router as api_router
import os

def create_app(config, scheduler):
    app = FastAPI(title="Home Athan Automation")

    # Store global state in app.state for access in endpoints
    app.state.config = config
    app.state.scheduler = scheduler
    app.state.audio_manager = scheduler.audio_manager

    # Mount static files
    # Ensure directories exist
    os.makedirs("web/static", exist_ok=True)
    
    app.mount("/static", StaticFiles(directory="web/static"), name="static")
    # Serve audio files directly from the 'audio' directory at root
    os.makedirs("audio", exist_ok=True)
    app.mount("/audio", StaticFiles(directory="audio"), name="audio")


    # Setup Templates
    templates = Jinja2Templates(directory="web/templates")

    # Include API Router
    app.include_router(api_router, prefix="/api")

    @app.get("/")
    async def root(request: Request):
        return templates.TemplateResponse("index.html", {"request": request})

    return app
