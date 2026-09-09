from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.deps import require_admin, require_moderator, require_owner
from core.geocoding import resolve_country_from_coordinates
from core.schemas import (
    QuestResponse,
    QuestReviewRequest,
    QuestTemplateCreate,
    QuestTemplateResponse,
    QuestTemplateUpdate,
    UserAdminResponse,
    UserRoleUpdate,
)
from models.quest import Quest, QuestTemplate
from models.user import User

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/quest-templates", response_model=list[QuestTemplateResponse])
async def list_templates(
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.scalars(select(QuestTemplate).order_by(QuestTemplate.created_at.desc()))
    return list(result.all())


@router.post("/quest-templates", response_model=QuestTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
    template_data: QuestTemplateCreate,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    values = template_data.model_dump()
    if values["category"] != "daily":
        if values.get("lat") is None or values.get("lon") is None:
            raise HTTPException(status_code=422, detail={"code": "POINT_REQUIRED", "message": "Dla misji terenowej wskaż punkt na mapie."})
        values["country_code"] = await resolve_country_from_coordinates(values["lat"], values["lon"])
    else:
        values.update({"lat": None, "lon": None, "country_code": None, "city": None, "radius_km": None})
    template = QuestTemplate(**values)
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return template


@router.patch("/quest-templates/{template_id}", response_model=QuestTemplateResponse)
async def update_template(
    template_id: int,
    template_data: QuestTemplateUpdate,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    template = await db.scalar(select(QuestTemplate).where(QuestTemplate.id == template_id))
    if not template:
        raise HTTPException(status_code=404, detail="Nie znaleziono szablonu misji.")

    values = template_data.model_dump(exclude_unset=True)
    next_category = values.get("category", template.category)
    if next_category != "daily":
        next_lat = values.get("lat", template.lat)
        next_lon = values.get("lon", template.lon)
        if next_lat is None or next_lon is None:
            raise HTTPException(status_code=422, detail={"code": "POINT_REQUIRED", "message": "Dla misji terenowej wskaż punkt na mapie."})
        values["country_code"] = await resolve_country_from_coordinates(next_lat, next_lon)
    else:
        values.update({"lat": None, "lon": None, "country_code": None, "city": None, "radius_km": None})
    for field, value in values.items():
        setattr(template, field, value)
    await db.commit()
    await db.refresh(template)
    return template


@router.get("/quests/pending", response_model=list[QuestResponse])
async def list_pending_quests(
    _: User = Depends(require_moderator),
    db: AsyncSession = Depends(get_db),
):
    result = await db.scalars(
        select(Quest).where(Quest.status == "pending_review").order_by(Quest.submitted_at.asc())
    )
    return list(result.all())


@router.post("/quests/{quest_id}/review", response_model=QuestResponse)
async def review_quest(
    quest_id: int,
    review: QuestReviewRequest,
    reviewer: User = Depends(require_moderator),
    db: AsyncSession = Depends(get_db),
):
    quest = await db.scalar(select(Quest).where(Quest.id == quest_id))
    if not quest:
        raise HTTPException(status_code=404, detail="Nie znaleziono misji.")
    if quest.status != "pending_review":
        raise HTTPException(status_code=409, detail="Ta misja nie czeka na weryfikację.")

    quest.status = review.decision
    quest.is_completed = review.decision == "approved"
    now = datetime.now(timezone.utc)
    quest.completed_at = now if review.decision == "approved" else None
    quest.reviewed_at = now
    quest.reviewed_by_id = reviewer.id
    quest.review_note = review.note
    await db.commit()
    await db.refresh(quest)
    return quest


@router.get("/users", response_model=list[UserAdminResponse])
async def list_users(
    _: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    result = await db.scalars(select(User).order_by(User.username.asc()))
    return list(result.all())


@router.patch("/users/{user_id}/role", response_model=UserAdminResponse)
async def update_user_role(
    user_id: int,
    role_update: UserRoleUpdate,
    current_owner: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    if user_id == current_owner.id:
        raise HTTPException(status_code=400, detail="Nie możesz zmienić własnej roli w panelu.")
    user = await db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="Nie znaleziono użytkownika.")

    user.role = role_update.role
    await db.commit()
    await db.refresh(user)
    return user
