from islamic_times.islamic_times import ITLocation
from datetime import date, datetime, timedelta
import logging
from config.config_manager import ConfigManager
import math

logger = logging.getLogger(__name__)

class PrayerCalculator:
    # Astronomy cache TTL in seconds (5 minutes)
    ASTRONOMY_CACHE_TTL = 300
    
    def __init__(self, config: ConfigManager):
        self.config = config
        # Cache: { date_str: { times dict } }
        self._times_cache = {}
        self._cache_date = None
        # Astronomy cache
        self._astronomy_cache = None
        self._astronomy_cache_time = None

    def _calculate_moon_index(self, dt):
        """Calculate generic moon age index (0-29) for image selection."""
        # Simple Julian Date calculation
        if isinstance(dt, datetime):
            dt = dt.date()
            
        a = (14 - dt.month) // 12
        y = dt.year + 4800 - a
        m = dt.month + 12 * a - 3
        jd = dt.day + ((153 * m + 2) // 5) + 365 * y + (y // 4) - (y // 100) + (y // 400) - 32045
        
        # New Moon reference (Jan 6 2000 approx)
        # Synodic month length
        LUNAR_CYCLE = 29.53058867
        days_since_new = jd - 2451549.5 # Approx new moon reference
        
        # Calculate age
        new_moons = days_since_new / LUNAR_CYCLE
        current_cycle_pos = (new_moons - int(new_moons)) * LUNAR_CYCLE
        
        # Map to 0-29
        index = int(round(current_cycle_pos)) % 30
        return index

    def clear_cache(self):
        """Clear all caches. Call this when config changes."""
        self._times_cache = {}
        self._cache_date = None
        self._astronomy_cache = None
        self._astronomy_cache_time = None
        logger.debug("Prayer times and astronomy caches cleared")

    def calculate_times(self, calculation_date=None) -> dict:
        """Calculate prayer times for a specific date (defaults to today)."""
        if calculation_date is None:
            calculation_date = date.today()

        # Check cache first
        cache_key = str(calculation_date)
        if cache_key in self._times_cache:
            logger.debug(f"Returning cached prayer times for {cache_key}")
            return self._times_cache[cache_key]

        lat = self.config.get("location", "latitude")
        lon = self.config.get("location", "longitude")
        method_str = self.config.get("location", "calculation_method", "ISNA")
        asr_str = self.config.get("location", "asr_method", "STANDARD")
        
        # Map Asr: 0 (Shafi/Std) or 1 (Hanafi)
        asr_type = 1 if asr_str.upper() == "HANAFI" else 0

        # Create ITLocation instance
        # Note: elevation/temp/pressure used defaults
        try:
            # We must convert date to datetime w/ default time for ITLocation
            dt = datetime.combine(calculation_date, datetime.min.time())
            
            it = ITLocation(
                latitude=float(lat),
                longitude=float(lon),
                date=dt,
                method=method_str,
                asr_type=asr_type,
                auto_calculate=True
            )
            
            # Apply custom angles if present in config
            # Expected config: custom_angles: { fajr: 18.0, isha: 15.0, maghrib: 4.0 }
            custom_angles = self.config.get("location", "custom_angles", {})
            if custom_angles:
                fajr_angle = custom_angles.get("fajr")
                maghrib_angle = custom_angles.get("maghrib")
                isha_angle = custom_angles.get("isha")
                
                # Check if we have valid floats
                if any(x is not None for x in [fajr_angle, maghrib_angle, isha_angle]):
                    it.set_custom_prayer_angles(
                        fajr_angle=float(fajr_angle) if fajr_angle is not None else None,
                        maghrib_angle=float(maghrib_angle) if maghrib_angle is not None else None,
                        isha_angle=float(isha_angle) if isha_angle is not None else None
                    )

            pt = it.prayer_times()

            times = {
                "Fajr": pt.fajr.time,
                "Sunrise": pt.sunrise.time,
                "Dhuhr": pt.zuhr.time,
                "Asr": pt.asr.time,
                "Maghrib": pt.maghrib.time,
                "Isha": pt.isha.time
            }
            
            # Remove timezone info to match local wall-time expectation of rest of app
            result = {k: v.replace(tzinfo=None) for k, v in times.items()}
            
            # Store in cache
            self._times_cache[cache_key] = result
            logger.debug(f"Cached prayer times for {cache_key}")
            
            return result

        except Exception as e:
            logger.error(f"Error calculating prayer times with islamic-times: {e}")
            return {}

    def get_astronomy_data(self):
        """Get Moon Phase, Illumination, and Sun position (cached for 5 minutes)."""
        now = datetime.now()
        
        # Return cached data if still fresh
        if (self._astronomy_cache is not None and 
            self._astronomy_cache_time is not None and
            (now - self._astronomy_cache_time).total_seconds() < self.ASTRONOMY_CACHE_TTL):
            logger.debug("Returning cached astronomy data")
            return self._astronomy_cache
        
        lat = self.config.get("location", "latitude")
        lon = self.config.get("location", "longitude")
        dt = now
        
        try:
            it = ITLocation(
                latitude=float(lat),
                longitude=float(lon),
                date=dt
            )
            
            moon = it.moon()
            sun = it.sun()
            
            # Get phase name
            # it.moonphases() returns nearest phases (list of tuples)
            phases = it.moonphases()
            
            # Simple heuristic for current phase name: find the nearest PREVIOUS phase
            current_phase_name = "Unknown"
            # Sort by date
            sorted_phases = sorted(phases, key=lambda x: x[1])
            
            # Logic: If now is after New Moon but before First Quarter -> Waxing Crescent
            # This is complex to do perfectly with just 4 points. 
            # For now, let's just return illumination and the nearest *upcoming* phase
            
            nearest_phase = min(phases, key=lambda x: abs((x[1].replace(tzinfo=None) - dt).total_seconds()))
            
            # Calculate moon index for image (0-29)
            moon_index = self._calculate_moon_index(dt)

            result = {
                "moon_illumination": round(moon.illumination * 100, 1),
                "moon_image_index": moon_index,
                "nearest_phase": {
                    "name": nearest_phase[0],
                    "date": nearest_phase[1].strftime("%Y-%m-%d %H:%M")
                },
                "sun_altitude": round(sun.apparent_altitude.decimal, 1),
                "sun_azimuth": round(sun.true_azimuth.decimal, 1)
            }
            
            # Cache the result
            self._astronomy_cache = result
            self._astronomy_cache_time = now
            logger.debug("Cached astronomy data")
            
            return result
        except Exception as e:
            logger.error(f"Error calculating astronomy data: {e}")
            return None

    def get_next_prayer(self):
        """Determine the next prayer based on current time."""
        now = datetime.now()
        today_times = self.calculate_times(date.today())
        
        if not today_times:
            return None, None

        # Check today's remaining prayers
        for prayer, time_obj in today_times.items():
            # Ensure time_obj is naive to match 'now'
            if time_obj.tzinfo is not None:
                time_obj = time_obj.replace(tzinfo=None)
            
            if time_obj > now:
                return prayer, time_obj
        
        # If none, it's Fajr tomorrow
        tomorrow = date.today() + timedelta(days=1)
        tomorrow_times = self.calculate_times(tomorrow)
        
        if not tomorrow_times:
             return None, None
             
        return "Fajr", tomorrow_times.get("Fajr")
