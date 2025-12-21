from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from datetime import date, timedelta
from core.utils import gregorian_to_hijri, format_hijri
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

# Data Models
class LocationConfig(BaseModel):
    latitude: float
    longitude: float
    timezone: str
    calculation_method: str
    asr_method: str
    hijri_offset: int = 0
    country: Optional[str] = "United Kingdom"
    city: Optional[str] = None
    high_latitude_rule: Optional[str] = None

class AudioConfig(BaseModel):
    default_file: str
    volume_default: float

class ConfigUpdate(BaseModel):
    location: Optional[LocationConfig]
    audio: Optional[AudioConfig]

class TestPlayRequest(BaseModel):
    prayer_name: str = "Test"
    athan_audio_file: Optional[str] = None
    volume: Optional[float] = None
    minutes: Optional[int] = 0
    timing: Optional[str] = "before"
    target_devices: Optional[List[str]] = None

class TestReminderRequest(BaseModel):
    prayer_name: str = "Test"
    minutes: int = 15
    volume: Optional[float] = None
    reminder_audio_file: Optional[str] = None
    timing: Optional[str] = "before"
    target_devices: Optional[List[str]] = None

class StopAudioRequest(BaseModel):
    target_devices: Optional[List[str]] = None

@router.get("/status")
async def get_status(request: Request):
    """Get current status including prayer times and next prayer."""
    scheduler = request.app.state.scheduler
    config_mgr = request.app.state.config
    calculator = scheduler.calculator
    
    # Recalculate to ensure freshness
    times = calculator.calculate_times()
    next_prayer, next_time = calculator.get_next_prayer()
    
    # Cast devices status
    devices = []
    # Check if cast_manager is initialized and has devices
    if hasattr(scheduler, 'cast_manager'):
        for uuid, device in scheduler.cast_manager.devices.items():
            status = "Found"
            if hasattr(device, 'socket_client') and device.socket_client and device.socket_client.is_connected:
                status = "Connected"
            
            devices.append({
                "name": device.name,
                "uuid": str(uuid),
                "status": status
            })

    # Hijri Date
    today = date.today()
    # Apply offset if configured
    offset = config_mgr.get("location", "hijri_offset") or 0
    if offset != 0:
        today = today + timedelta(days=offset)
        
    h_y, h_m, h_d = gregorian_to_hijri(today)
    hijri_str = format_hijri(h_y, h_m, h_d)

    return {
        "hijri_date": hijri_str,
        "times": times,
        "astronomy": calculator.get_astronomy_data(),
        "next_prayer": {
            "name": next_prayer,
            "time": next_time
        } if next_prayer else None,
        "devices": devices
    }

@router.get("/config")
async def get_config(request: Request):
    """Get current configuration."""
    config_mgr = request.app.state.config
    return config_mgr.config

@router.post("/config")
async def update_config(request: Request, config_data: Dict[str, Any]):
    """Update configuration."""
    config_mgr = request.app.state.config
    
    config_mgr.update(config_data)
    
    # Clear prayer times cache since settings may have changed
    request.app.state.scheduler.calculator.clear_cache()
    
    # Trigger a refresh of the scheduler so new settings take effect
    request.app.state.scheduler.refresh_prayer_times()
    
    return {"status": "ok", "message": "Configuration updated and saved."}

@router.get("/audio-files")
async def get_audio_files(request: Request):
    """List available audio files."""
    audio_manager = request.app.state.audio_manager
    try:
        return {
            "athan": audio_manager.list_athan_files(),
            "reminders": audio_manager.list_reminder_files()
        }
    except Exception as e:
        logger.error(f"Error listing audio files: {e}")
        return {"athan": [], "reminders": []}

@router.get("/countries")
async def get_countries():
    """List supported countries and their cities."""
    from core.cities import COUNTRIES
    return COUNTRIES

@router.get("/cities")
async def get_cities():
    """List supported cities (Legacy: returns UK cities)."""
    from core.cities import UK_CITIES
    return UK_CITIES

@router.post("/stop-audio")
def stop_audio(request: Request, params: StopAudioRequest = None):
    """Stop audio playback on specified or all devices."""
    scheduler = request.app.state.scheduler
    try:
        target_devices = params.target_devices if params else None
        scheduler.stop_all(target_devices=target_devices)
        if target_devices:
            return {"status": "ok", "message": f"Stopped audio on {len(target_devices)} device(s)."}
        return {"status": "ok", "message": "Stopped all audio playback."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/test-play")
def test_play(request: Request, params: TestPlayRequest):
    """Trigger a test playback."""
    scheduler = request.app.state.scheduler
    
    # Validate
    if params.volume is not None and not (0.0 <= params.volume <= 1.0):
         raise HTTPException(status_code=400, detail="Volume must be between 0.0 and 1.0")

    try:
        scheduler.play_athan(
            prayer_name=params.prayer_name,
            prayer_settings={
                "athan_audio_file": params.athan_audio_file,
                "athan_volume": params.volume,
                "enabled_devices": params.target_devices,
                "athan_enabled": True
            }
        )
        return {"status": "ok", "message": f"Test playback triggered for {params.prayer_name}."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/test-reminder")
def test_reminder(request: Request, params: TestReminderRequest):
    """Trigger a test reminder."""
    scheduler = request.app.state.scheduler
    
    if params.volume is not None and not (0.0 <= params.volume <= 1.0):
         raise HTTPException(status_code=400, detail="Volume must be between 0.0 and 1.0")
         
    try:
        scheduler.play_reminder(
            prayer_name=params.prayer_name,
            settings={
                "reminder_enabled": True,
                "reminder_offset": params.minutes,
                "volume": params.volume,
                "reminder_audio_file": params.reminder_audio_file,
                "enabled_devices": params.target_devices,
                "reminder_timing": params.timing
            }
        )
        return {"status": "ok", "message": f"Test reminder triggered for {params.prayer_name}."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
