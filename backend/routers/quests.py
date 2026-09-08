from datetime import date, datetime, time, timedelta, timezone
from random import choice
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.deps import get_current_user
from core.geocoding import resolve_country_from_coordinates
from core.schemas import ExploreQuestRequest, QuestResponse, QuestSubmissionRequest
from models.quest import Quest, QuestTemplate
from models.user import User

router = APIRouter(prefix="/quests", tags=["Quests"])


# Tymczasowa biblioteka startowa. W kolejnym etapie te rekordy będzie dodawał panel administratora.
DEFAULT_TEMPLATES = [
    {
        "title": "Kolor dnia",
        "description": "Znajdź i sfotografuj coś niebieskiego w swojej okolicy.",
        "category": "daily", "difficulty": "easy",
    },
    {
        "title": "Nieznany zakątek",
        "description": "Odwiedź miejsce w swojej okolicy, w którym wcześniej nie byłeś.",
        "category": "daily", "difficulty": "easy",
    },
    {
        "title": "Lokalny horyzont",
        "description": "Znajdź punkt widokowy w obrębie miasta lub jego okolic.",
        "category": "local", "difficulty": "medium", "radius_km": 40,
    },
    {
        "title": "Ślad lokalnej historii",
        "description": "Odwiedź mało znane miejsce związane z historią twojego miasta lub okolicy.",
        "category": "local", "difficulty": "medium", "radius_km": 40,
    },
    {
        "title": "Weekend w innym regionie",
        "description": "Odwiedź miejsce w swoim kraju, którego jeszcze nie znałeś.",
        "category": "country", "difficulty": "medium",
    },
    {
        "title": "Regionalny smak",
        "description": "Spróbuj regionalnego dania poza swoim rodzinnym miastem.",
        "category": "country", "difficulty": "easy",
    },
    {
        "title": "Nowy horyzont",
        "description": "Wykonaj misję podczas podróży do innego kraju.",
        "category": "world", "difficulty": "hard",
    },
    {
        "title": "Opowieść z drogi",
        "description": "Poznaj lokalną historię lub zwyczaj w odwiedzanym kraju.",
        "category": "world", "difficulty": "medium",
    },
]


async def ensure_default_templates(db: AsyncSession) -> None:
    existing = await db.scalar(select(QuestTemplate.id).limit(1))
    if existing:
        return
    db.add_all([QuestTemplate(**template) for template in DEFAULT_TEMPLATES])
    await db.commit()


async def expire_outdated_quests(db: AsyncSession, user_id) -> None:
    now = datetime.now(timezone.utc)
    await db.execute(
        update(Quest)
        .where(Quest.user_id == user_id, Quest.status == "active", Quest.expires_at <= now)
        .values(status="expired")
    )
    await db.commit()


def assignment_from_template(
    template: QuestTemplate,
    user_id,
    expires_at: datetime,
    daily_key: date | None = None,
    location=None,
) -> Quest:
    return Quest(
        user_id=user_id,
        template_id=template.id,
        title=template.title,
        description=template.description,
        category=template.category,
        difficulty=template.difficulty,
        country=location.country if location and location.country else template.country,
        country_code=location.country_code if location and location.country_code else template.country_code,
        city=location.city if location and location.city else template.city,
        lat=location.lat if location and location.lat is not None else template.lat,
        lon=location.lon if location and location.lon is not None else template.lon,
        radius_km=location.radius_km if location and location.radius_km else template.radius_km,
        expires_at=expires_at,
        daily_key=daily_key,
    )


@router.get("/daily", response_model=QuestResponse)
async def get_daily_quest(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await ensure_default_templates(db)
    today = datetime.now(timezone.utc).date()
    existing = await db.scalar(
        select(Quest).where(Quest.user_id == current_user.id, Quest.category == "daily", Quest.daily_key == today)
    )
    if existing:
        return existing

    templates = list((await db.scalars(
        select(QuestTemplate).where(QuestTemplate.category == "daily", QuestTemplate.is_active.is_(True)).order_by(QuestTemplate.id)
    )).all())
    if not templates:
        raise HTTPException(status_code=503, detail="Brak aktywnych misji dziennych.")

    template = templates[today.toordinal() % len(templates)]
    expires_at = datetime.combine(today + timedelta(days=1), time.min, tzinfo=timezone.utc)
    quest = assignment_from_template(template, current_user.id, expires_at, daily_key=today)
    db.add(quest)
    await db.commit()
    await db.refresh(quest)
    return quest


@router.post("/explore", response_model=QuestResponse, status_code=status.HTTP_201_CREATED)
async def roll_exploration_quest(
    request: ExploreQuestRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not request.location or request.location.lat is None or request.location.lon is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "LOCATION_REQUIRED", "message": "Aby wylosować misję terenową, udostępnij aktualną lokalizację."},
        )
    if not current_user.country_code:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "HOME_COUNTRY_REQUIRED", "message": "Ustaw kraj konta przed losowaniem misji terenowej."},
        )

    if request.category in {"local", "country"} and current_user.is_abroad:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "TRAVEL_MODE_ACTIVE", "message": "Masz włączony tryb wyjazdowy. Na wyjeździe losujesz misje światowe."},
        )
    if request.category == "world" and not current_user.is_abroad:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "TRAVEL_MODE_REQUIRED", "message": "Misje światowe są dostępne po potwierdzeniu wyjazdu."},
        )

    # Lokalizacja służy wyłącznie do osadzenia misji terenowej. Nie przełącza trybu
    # i nie decyduje, czy użytkownik jest "w domu" — robi to odpowiedź w aplikacji.
    actual_country_code = await resolve_country_from_coordinates(request.location.lat, request.location.lon)

    await ensure_default_templates(db)
    await expire_outdated_quests(db, current_user.id)
    now = datetime.now(timezone.utc)
    active = await db.scalar(
        select(Quest).where(
            Quest.user_id == current_user.id,
            Quest.category == request.category,
            Quest.status == "active",
            Quest.expires_at > now,
        )
    )
    if active:
        return active

    templates = list((await db.scalars(
        select(QuestTemplate).where(
            QuestTemplate.category == request.category,
            QuestTemplate.is_active.is_(True),
            (QuestTemplate.country_code.is_(None)) | (QuestTemplate.country_code == (
                actual_country_code if current_user.is_abroad else current_user.country_code
            )),
        )
    )).all())
    if not templates:
        raise HTTPException(status_code=503, detail="Brak aktywnych misji w tej kategorii.")

    validity = {"local": timedelta(days=7), "country": timedelta(days=30), "world": timedelta(days=183)}
    request.location.country_code = actual_country_code if current_user.is_abroad else current_user.country_code
    quest = assignment_from_template(choice(templates), current_user.id, now + validity[request.category], location=request.location)
    db.add(quest)
    await db.commit()
    await db.refresh(quest)
    return quest


@router.get("/me", response_model=list[QuestResponse])
async def list_my_quests(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await expire_outdated_quests(db, current_user.id)
    result = await db.scalars(select(Quest).where(Quest.user_id == current_user.id).order_by(Quest.expires_at.asc()))
    return list(result.all())


async def submit_quest_for_review(
    quest_id: UUID,
    submission: QuestSubmissionRequest,
    current_user: User,
    db: AsyncSession,
) -> Quest:
    quest = await db.scalar(select(Quest).where(Quest.id == quest_id, Quest.user_id == current_user.id))
    if not quest:
        raise HTTPException(status_code=404, detail="Nie znaleziono misji.")
    if quest.status == "expired" or quest.expires_at <= datetime.now(timezone.utc):
        quest.status = "expired"
        await db.commit()
        raise HTTPException(status_code=409, detail="Termin tej misji już minął.")
    if quest.status != "active":
        raise HTTPException(status_code=409, detail="Ta misja została już oddana do weryfikacji lub zakończona.")

    quest.status = "pending_review"
    quest.submitted_at = datetime.now(timezone.utc)
    quest.submission_note = submission.note
    await db.commit()
    await db.refresh(quest)
    return quest


@router.post("/{quest_id}/submit", response_model=QuestResponse)
async def submit_quest(
    quest_id: UUID,
    submission: QuestSubmissionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await submit_quest_for_review(quest_id, submission, current_user, db)


@router.post("/{quest_id}/complete", response_model=QuestResponse, deprecated=True)
async def complete_quest_legacy(
    quest_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Zachowuje kompatybilność ze starszym frontendem; misja trafia do weryfikacji."""
    return await submit_quest_for_review(quest_id, QuestSubmissionRequest(), current_user, db)
