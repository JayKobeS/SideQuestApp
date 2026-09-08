import httpx
from fastapi import HTTPException, status

from core.countries import normalize_country_code


async def resolve_country_from_coordinates(lat: float, lon: float) -> str:
    """Ustala kraj po współrzędnych na serwerze; nie ufa kodowi kraju przesłanemu przez klienta."""
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get(
                "https://nominatim.openstreetmap.org/reverse",
                params={"format": "jsonv2", "lat": lat, "lon": lon, "zoom": 3, "addressdetails": 1},
                headers={"User-Agent": "SideQuest/1.0 (country-validation)"},
            )
            response.raise_for_status()
            country_code = response.json().get("address", {}).get("country_code")
            return normalize_country_code(country_code)
    except (httpx.HTTPError, ValueError, KeyError):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "LOCATION_VALIDATION_UNAVAILABLE", "message": "Nie udało się potwierdzić kraju na podstawie lokalizacji."},
        )
