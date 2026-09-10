import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from core.quest_rules import daily_window, expiration, distance_km, eligible
from core.quest_catalogue import demo_templates

class QuestRulesTests(unittest.TestCase):
    def test_daily_boundary_winter(self):
        before = datetime(2026, 1, 10, 4, 59, tzinfo=timezone.utc)
        after = datetime(2026, 1, 10, 5, tzinfo=timezone.utc)
        self.assertEqual(str(daily_window(before)[0]), '2026-01-09')
        self.assertEqual(str(daily_window(after)[0]), '2026-01-10')

    def test_daily_boundary_summer(self):
        self.assertEqual(str(daily_window(datetime(2026, 7, 10, 3, 59, tzinfo=timezone.utc))[0]), '2026-07-09')
        self.assertEqual(str(daily_window(datetime(2026, 7, 10, 4, tzinfo=timezone.utc))[0]), '2026-07-10')

    def test_dst_short_and_long_days(self):
        for start, hours in [(datetime(2026,3,28,5,tzinfo=timezone.utc),23), (datetime(2026,10,24,4,tzinfo=timezone.utc),25)]:
            self.assertEqual((daily_window(start)[1] - start).total_seconds()/3600, hours)

    def test_calendar_month_end_and_leap_year(self):
        self.assertEqual(expiration('world', datetime(2027,8,31,tzinfo=timezone.utc)).date().isoformat(), '2028-02-29')
        self.assertEqual(expiration('world', datetime(2026,8,31,tzinfo=timezone.utc)).date().isoformat(), '2027-02-28')

    def test_local_radius_and_country(self):
        location = SimpleNamespace(lat=52.23, lon=21.01)
        nearby = SimpleNamespace(lat=52.24, lon=21.02, country_code='PL')
        far = SimpleNamespace(lat=50.06, lon=19.94, country_code='PL')
        foreign = SimpleNamespace(lat=None, lon=None, country_code='DE')
        self.assertTrue(eligible(nearby, 'local', location, 'PL'))
        self.assertFalse(eligible(far, 'local', location, 'PL'))
        self.assertFalse(eligible(foreign, 'country', location, 'PL'))
        self.assertTrue(eligible(foreign, 'world', None, None))
        self.assertLess(distance_km(52.23,21.01,52.24,21.02), 2)

    def test_catalogue(self):
        rows = demo_templates()
        self.assertEqual(len([r for r in rows if r['category']=='world']), 1000)
        self.assertEqual(len({(r['title'], r['category']) for r in rows}), len(rows))
        self.assertTrue(all(len(r['title'])<=100 and len(r['description'])<=500 for r in rows))
        regular_max = max(r['xp_reward'] for r in rows if r['category'] != 'achievement')
        medals = [r for r in rows if r['category']=='achievement']
        self.assertEqual([r['medal'] for r in medals], ['bronze','silver','gold','platinum'])
        self.assertTrue(all(r['xp_reward']>regular_max for r in medals))

if __name__ == '__main__': unittest.main()
