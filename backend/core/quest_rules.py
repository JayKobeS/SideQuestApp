from calendar import monthrange
from datetime import datetime, time, timedelta, timezone
from math import asin, cos, radians, sin, sqrt
from zoneinfo import ZoneInfo

WARSAW = ZoneInfo('Europe/Warsaw')
CAPACITIES = {'world': 4, 'country': 5, 'local': 3}
OCCUPIED = ('active', 'pending_review', 'rejected')

def daily_window(now):
    local = now.astimezone(WARSAW)
    day = local.date() if local.hour >= 6 else local.date() - timedelta(days=1)
    end = datetime.combine(day + timedelta(days=1), time(6), WARSAW)
    return day, end.astimezone(timezone.utc)

def expiration(category, now):
    if category == 'world':
        month = now.month + 6
        year = now.year + (month - 1) // 12
        month = (month - 1) % 12 + 1
        return now.replace(year=year, month=month, day=min(now.day, monthrange(year, month)[1]))
    return now + timedelta(days={'local': 7, 'country': 30}[category])

def distance_km(lat1, lon1, lat2, lon2):
    a, b = radians(lat1), radians(lat2)
    h = sin((b-a)/2)**2 + cos(a)*cos(b)*sin(radians(lon2-lon1)/2)**2
    return 6371 * 2 * asin(sqrt(min(1, h)))

def eligible(template, category, location, country_code):
    if category == 'world':
        return True
    if template.country_code and template.country_code != country_code:
        return False
    if category == 'local' and template.lat is not None and template.lon is not None:
        return distance_km(location.lat, location.lon, template.lat, template.lon) <= 30
    return True
