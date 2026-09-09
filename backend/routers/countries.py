from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.schemas import CountryResponse
from models.country import Country

router = APIRouter(prefix="/countries", tags=["Countries"])


@router.get("", response_model=list[CountryResponse])
async def list_countries(db: AsyncSession = Depends(get_db)):
    """Jedno źródło kodów ISO dla przyszłych formularzy i integracji."""
    result = await db.scalars(select(Country).order_by(Country.code))
    return list(result.all())
