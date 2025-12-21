from datetime import date
import math

def gregorian_to_hijri(g_date: date):
    """
    Converts Gregorian Date to Hijri Date using the Kuwaiti Algorithm.
    Returns: (year, month_index, day)
    """
    day = g_date.day
    month = g_date.month
    year = g_date.year

    m = month
    y = year
    if m < 3:
        y -= 1
        m += 12

    a = math.floor(y / 100.)
    b = 2 - a + math.floor(a / 4.)
    if y < 1583:
        b = 0
    if y == 1582:
        if m > 10:
            b = -10
        if m == 10:
            b = 0
            if day > 4:
                b = -10

    jd = math.floor(365.25 * (y + 4716)) + math.floor(30.6001 * (m + 1)) + day + b - 1524

    b = 0
    if jd > 2299160:
        a = math.floor((jd - 1867216.25) / 36524.25)
        b = 1 + a - math.floor(a / 4.)
    
    bb = jd + b + 1524
    cc = math.floor((bb - 122.1) / 365.25)
    dd = math.floor(365.25 * cc)
    ee = math.floor((bb - dd) / 30.6001)
    
    # gregorian parts (unused here but part of calc)
    # day = (bb - dd) - math.floor(30.6001 * ee)
    # month = ee - 1
    # if ee > 13:
    #    cc += 1
    #    month = ee - 13
    # year = cc - 4716

    # Hijri Conversion
    iyear = 10631.0 / 30.0
    epochastro = 1948084
    shift1 = 8.01 / 60.0

    z = jd - epochastro
    cyc = math.floor(z / 10631.0)
    z = z - 10631 * cyc
    j = math.floor((z - shift1) / iyear)
    iy = 30 * cyc + j
    z = z - math.floor(j * iyear + shift1)
    im = math.floor((z + 28.5001) / 29.5)
    
    if im == 13:
        im = 12

    id = z - math.floor(29.5001 * im - 29)

    return int(iy), int(im), int(id)

def format_hijri(iy, im, id):
    """Formats Hijri date as string."""
    months = ["Muharram", "Safar", "Rabi' al-Awwal", "Rabi' al-Thani", "Jumada al-Ula", "Jumada al-Thani", 
              "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhu al-Qi'dah", "Dhu al-Hijjah"]
    # Ensure index is within bounds (1-12)
    m_idx = max(0, min(im - 1, 11))
    return f"{int(id)} {months[m_idx]} {iy}"
