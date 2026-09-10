"""Service integration against isolated SQLite; PostgreSQL locking needs PostgreSQL."""
import os
os.environ['DATABASE_URL'] = 'sqlite+aiosqlite:///:memory:'
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch
from fastapi import HTTPException
from sqlalchemy import DateTime, select
from sqlalchemy.types import TypeDecorator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from core.database import Base
from core.quest_catalogue import demo_templates
from core.schemas import ExploreQuestRequest, QuestLocation, QuestReviewRequest, QuestSubmissionRequest
from models.quest import Quest, QuestTemplate
from models.user import User
from routers.quests import daily_quests, roll_exploration_quest, submit_quest_for_review, claim_achievement
from routers.admin import review_quest

class UTCDateTime(TypeDecorator):
    impl = DateTime
    cache_ok = True
    def process_result_value(self, value, dialect):
        return value.replace(tzinfo=timezone.utc) if value and value.tzinfo is None else value

for table in Base.metadata.tables.values():
    for column in table.columns:
        if isinstance(column.type, DateTime): column.type = UTCDateTime()

class QuestServiceTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine('sqlite+aiosqlite:///:memory:')
        async with self.engine.begin() as conn: await conn.run_sync(Base.metadata.create_all)
        self.db = async_sessionmaker(self.engine, expire_on_commit=False)()
        self.user = User(username='test',email='test@example.org',hashed_password='unused',country_code='PL',xp=0,level=1,role='user')
        self.other = User(username='other',email='other@example.org',hashed_password='unused',xp=0,level=1,role='moderator')
        self.db.add_all([self.user,self.other])
        self.db.add_all([QuestTemplate(**row) for row in demo_templates()])
        await self.db.commit()

    async def asyncTearDown(self):
        await self.db.close()
        await self.engine.dispose()

    async def test_three_shared_daily_and_idempotency(self):
        first = await daily_quests(self.db, self.user.id)
        again = await daily_quests(self.db, self.user.id)
        other = await daily_quests(self.db, self.other.id)
        self.assertEqual(len(first),3)
        self.assertEqual({q.id for q in first},{q.id for q in again})
        self.assertEqual({q.template_id for q in first},{q.template_id for q in other})
        # Changing the catalogue does not change the already published shared day.
        self.db.add(QuestTemplate(title='Nowy dzienny',description='Nowe zadanie dzienne',category='daily',difficulty='easy'))
        await self.db.commit()
        self.assertEqual({q.id for q in first},{q.id for q in await daily_quests(self.db,self.user.id)})

    async def test_slots_review_reward_and_refill(self):
        request = ExploreQuestRequest(category='world')
        first = [await roll_exploration_quest(request,self.user,self.db) for _ in range(4)]
        self.assertEqual(len({q.template_id for q in first}),4)
        with self.assertRaises(HTTPException) as err: await roll_exploration_quest(request,self.user,self.db)
        self.assertEqual(err.exception.status_code,409)
        await self.db.rollback()
        user = await self.db.scalar(select(User).where(User.username=='test'))
        reviewer = await self.db.scalar(select(User).where(User.username=='other'))
        quest = await self.db.scalar(select(Quest).where(Quest.user_id==user.id))
        await submit_quest_for_review(quest.id,QuestSubmissionRequest(note='Gotowe'),user,self.db)
        with self.assertRaises(HTTPException): await roll_exploration_quest(request,user,self.db)
        approved = await review_quest(quest.id,QuestReviewRequest(decision='approved'),reviewer,self.db)
        self.assertEqual(user.xp,approved.xp_reward)
        with self.assertRaises(HTTPException): await review_quest(quest.id,QuestReviewRequest(decision='approved'),reviewer,self.db)
        next_quest = await roll_exploration_quest(request,user,self.db)
        self.assertNotEqual(next_quest.template_id,approved.template_id)

    async def test_current_country_and_local_anchor(self):
        with patch('routers.quests.resolve_country_from_coordinates',new=AsyncMock(return_value='DE')):
            country = [await roll_exploration_quest(ExploreQuestRequest(category='country',location=QuestLocation(lat=52.52,lon=13.405,country_code='PL')),self.user,self.db) for _ in range(5)]
            self.assertTrue(all(q.country_code=='DE' for q in country))
            local = [await roll_exploration_quest(ExploreQuestRequest(category='local',location=QuestLocation(lat=52.52,lon=13.405)),self.user,self.db) for _ in range(3)]
            self.assertTrue(all(q.radius_km==30 and q.lat==52.52 for q in local))

    async def test_achievement_single_assignment(self):
        template = await self.db.scalar(select(QuestTemplate).where(QuestTemplate.medal=='platinum'))
        first = await claim_achievement(template.id,self.user,self.db)
        again = await claim_achievement(template.id,self.user,self.db)
        self.assertEqual(first.id,again.id)
        self.assertEqual(first.xp_reward,20000)

    async def test_rejected_resubmission_does_not_release_slot(self):
        first = [await roll_exploration_quest(ExploreQuestRequest(category='world'),self.user,self.db) for _ in range(4)]
        quest = first[0]
        await submit_quest_for_review(quest.id,QuestSubmissionRequest(note='Pierwsza próba'),self.user,self.db)
        await review_quest(quest.id,QuestReviewRequest(decision='rejected'),self.other,self.db)
        self.assertEqual(self.user.xp,0)
        with self.assertRaises(HTTPException):
            await roll_exploration_quest(ExploreQuestRequest(category='world'),self.user,self.db)
        updated = await submit_quest_for_review(quest.id,QuestSubmissionRequest(note='Poprawiona relacja'),self.user,self.db)
        self.assertEqual(updated.status,'pending_review')

    async def test_pending_review_survives_expiration(self):
        first = [await roll_exploration_quest(ExploreQuestRequest(category='world'),self.user,self.db) for _ in range(4)]
        quest = first[0]
        await submit_quest_for_review(quest.id,QuestSubmissionRequest(),self.user,self.db)
        quest.expires_at = datetime.now(timezone.utc)-timedelta(seconds=1)
        await self.db.commit()
        with self.assertRaises(HTTPException):
            await roll_exploration_quest(ExploreQuestRequest(category='world'),self.user,self.db)
        approved = await review_quest(quest.id,QuestReviewRequest(decision='approved'),self.other,self.db)
        self.assertEqual(approved.status,'approved')

    async def test_ownership_and_expiration(self):
        first = [await roll_exploration_quest(ExploreQuestRequest(category='world'),self.user,self.db) for _ in range(4)]
        with self.assertRaises(HTTPException) as err: await submit_quest_for_review(first[0].id,QuestSubmissionRequest(),self.other,self.db)
        self.assertEqual(err.exception.status_code,404)
        first[0].expires_at = datetime.now(timezone.utc)-timedelta(seconds=1)
        await self.db.commit()
        replacement = await roll_exploration_quest(ExploreQuestRequest(category='world'),self.user,self.db)
        self.assertNotEqual(replacement.template_id, first[0].template_id)

if __name__=='__main__': unittest.main()
