from datetime import datetime, timedelta, timezone
from random import Random, SystemRandom
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.deps import get_current_user
from core.geocoding import resolve_country_from_coordinates
from core.quest_rules import CAPACITIES, OCCUPIED, daily_window, expiration, eligible
from core.schemas import ExploreQuestRequest, QuestResponse, QuestSubmissionRequest, QuestTemplateResponse
from models.quest import Quest, QuestTemplate, DailyQuestSet
from models.user import User

router = APIRouter(prefix='/quests', tags=['Quests'])

async def lock_user(db, user_id):
    # Serialize assignment requests from multiple devices without committing early.
    await db.scalar(select(User.id).where(User.id == user_id).with_for_update().execution_options(populate_existing=True))

async def expire_outdated_quests(db, user_id):
    await db.execute(update(Quest).where(Quest.user_id == user_id, Quest.status.in_(('active', 'rejected')), Quest.expires_at <= datetime.now(timezone.utc)).values(status='expired'))

def assignment_from_template(template, user_id, expires_at, daily_key=None, location=None):
    values = {key: getattr(template, key) for key in ('title', 'description', 'category', 'difficulty', 'xp_reward', 'medal', 'country', 'country_code', 'city', 'lat', 'lon', 'radius_km')}
    if location and template.category in ('local', 'country'):
        values['country_code'] = location.country_code
        # Preserve authored destinations. Generic tasks are anchored at assignment.
        if template.category == 'local':
            values['radius_km'] = 30
        if template.lat is None or template.lon is None:
            values.update(lat=location.lat, lon=location.lon, city=location.city)
    return Quest(user_id=user_id, template_id=template.id, expires_at=expires_at, daily_key=daily_key, **values)

async def daily_quests(db, user_id):
    await lock_user(db, user_id)
    now = datetime.now(timezone.utc)
    day, end = daily_window(now)
    shared = await db.get(DailyQuestSet, day)
    if shared is None:
        ids = list((await db.scalars(select(QuestTemplate.id).where(QuestTemplate.category == 'daily', QuestTemplate.is_active.is_(True)).order_by(QuestTemplate.id))).all())
        if len(ids) < 3:
            raise HTTPException(503, 'Potrzebne są co najmniej 3 aktywne szablony dzienne.')
        pool = ids
        ids = Random(day.isoformat()).sample(pool, 3)
        previous = await db.get(DailyQuestSet, day - timedelta(days=1))
        if previous and set(ids) == set(previous.template_ids) and len(pool) > 3:
            ids[-1] = next(template_id for template_id in pool if template_id not in ids)
        await db.execute(insert(DailyQuestSet).values(day=day, template_ids=ids).on_conflict_do_nothing(index_elements=['day']))
        shared = await db.get(DailyQuestSet, day)
    existing = list((await db.scalars(select(Quest).where(Quest.user_id == user_id, Quest.category == 'daily', Quest.daily_key == day))).all())
    assigned = {q.template_id for q in existing}
    for template_id in shared.template_ids:
        if template_id not in assigned:
            template = await db.get(QuestTemplate, template_id)
            if template is None:
                raise HTTPException(503, 'Brakuje szablonu dzisiejszego zadania.')
            quest = assignment_from_template(template, user_id, end, daily_key=day)
            db.add(quest)
            existing.append(quest)
    await expire_outdated_quests(db, user_id)
    await db.commit()
    return existing

@router.get('/daily', response_model=list[QuestResponse])
async def get_daily_quests(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await daily_quests(db, current_user.id)

@router.get('/board')
async def get_board(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await daily_quests(db, current_user.id)
    quests = list((await db.scalars(select(Quest).where(Quest.user_id == current_user.id).order_by(Quest.created_at.desc()))).all())
    day, reset = daily_window(datetime.now(timezone.utc))
    return {'quests': [QuestResponse.model_validate(q) for q in quests], 'capacities': CAPACITIES, 'daily_key': day, 'daily_reset_at': reset, 'local_radius_km': 30}

@router.post('/explore', response_model=QuestResponse, status_code=201)
async def roll_exploration_quest(request: ExploreQuestRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    category = request.category
    country_code = None
    if category != 'world':
        if not request.location or request.location.lat is None or request.location.lon is None:
            raise HTTPException(422, detail={'code': 'LOCATION_REQUIRED', 'message': 'Udostępnij aktualną lokalizację dla zadań kraju i miasta.'})
        country_code = await resolve_country_from_coordinates(request.location.lat, request.location.lon)
        request.location.country_code = country_code
    await lock_user(db, current_user.id)
    await expire_outdated_quests(db, current_user.id)
    occupied = list((await db.scalars(select(Quest).where(Quest.user_id == current_user.id, Quest.category == category, Quest.status.in_(OCCUPIED)))).all())
    if len(occupied) >= CAPACITIES[category]:
        raise HTTPException(409, detail={'code': 'SLOTS_FULL', 'message': 'Wszystkie sloty są zajęte. Ukończ zadanie lub poczekaj na koniec jego terminu.'})
    templates = list((await db.scalars(select(QuestTemplate).where(QuestTemplate.category == category, QuestTemplate.is_active.is_(True)))).all())
    occupied_ids = {q.template_id for q in occupied}
    candidates = [t for t in templates if t.id not in occupied_ids and eligible(t, category, request.location, country_code)]
    if not candidates:
        raise HTTPException(503, 'Brak dostępnych zadań dla tej lokalizacji. Uzupełnij katalog.')
    # Prefer never assigned templates until the catalogue has been explored.
    history = set((await db.scalars(select(Quest.template_id).where(Quest.user_id == current_user.id, Quest.category == category))).all())
    fresh = [t for t in candidates if t.id not in history]
    rng = SystemRandom()
    template = rng.choice(fresh or candidates)
    now = datetime.now(timezone.utc)
    result = assignment_from_template(template, current_user.id, expiration(category, now), location=request.location)
    db.add(result)
    await db.commit()
    return result

@router.get('/achievements', response_model=list[QuestTemplateResponse])
async def achievements(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return list((await db.scalars(select(QuestTemplate).where(QuestTemplate.category == 'achievement', QuestTemplate.is_active.is_(True)).order_by(QuestTemplate.xp_reward))).all())

@router.post('/achievements/{template_id}/claim', response_model=QuestResponse, status_code=201)
async def claim_achievement(template_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await lock_user(db, current_user.id)
    template = await db.scalar(select(QuestTemplate).where(QuestTemplate.id == template_id, QuestTemplate.category == 'achievement', QuestTemplate.is_active.is_(True)))
    if not template:
        raise HTTPException(404, 'Nie znaleziono osiągnięcia.')
    existing = await db.scalar(select(Quest).where(Quest.user_id == current_user.id, Quest.template_id == template_id))
    if existing:
        return existing
    quest = assignment_from_template(template, current_user.id, datetime(9999, 12, 31, tzinfo=timezone.utc))
    db.add(quest)
    await db.commit()
    return quest

@router.get('/me', response_model=list[QuestResponse])
async def list_my_quests(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await expire_outdated_quests(db, current_user.id)
    await db.commit()
    return list((await db.scalars(select(Quest).where(Quest.user_id == current_user.id).order_by(Quest.expires_at))).all())

async def submit_quest_for_review(quest_id, submission, current_user, db):
    quest = await db.scalar(select(Quest).where(Quest.id == quest_id, Quest.user_id == current_user.id).with_for_update().execution_options(populate_existing=True))
    if not quest:
        raise HTTPException(404, 'Nie znaleziono zadania.')
    if quest.status not in ('active', 'rejected'):
        raise HTTPException(409, 'To zadanie zostało już zgłoszone lub zakończone.')
    if quest.expires_at <= datetime.now(timezone.utc):
        quest.status = 'expired'
        await db.commit()
        raise HTTPException(409, 'Termin zadania już minął.')
    quest.status = 'pending_review'
    quest.submitted_at = datetime.now(timezone.utc)
    quest.submission_note = submission.note
    await db.commit()
    return quest

@router.post('/{quest_id}/submit', response_model=QuestResponse)
async def submit_quest(quest_id: int, submission: QuestSubmissionRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await submit_quest_for_review(quest_id, submission, current_user, db)

@router.post('/{quest_id}/complete', response_model=QuestResponse, deprecated=True)
async def complete_quest_legacy(quest_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await submit_quest_for_review(quest_id, QuestSubmissionRequest(), current_user, db)
