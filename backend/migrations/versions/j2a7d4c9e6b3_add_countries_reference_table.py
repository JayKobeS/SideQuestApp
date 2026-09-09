"""Add ISO countries lookup table and country foreign keys.

Revision ID: j2a7d4c9e6b3
Revises: i9d4b7e2f6c1
Create Date: 2026-09-08
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "j2a7d4c9e6b3"
down_revision: Union[str, Sequence[str], None] = "i9d4b7e2f6c1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ISO_COUNTRY_CODES = """
AF AX AL DZ AS AD AO AI AQ AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BQ BA BW BV BR IO BN BG BF BI CV KH CM CA KY CF TD CL CN CX CC CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF TF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HM VA HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW BL SH KN LC MF PM VC WS SM ST SA SN SC SL SG SX SK SI SB SO ZA GS SS ES LK SD SR SJ SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UM UY UZ VU VE VN VG VI WF EH YE ZM ZW
""".split()


def upgrade() -> None:
    op.create_table(
        "countries",
        sa.Column("code", sa.String(length=2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("code"),
    )
    countries = sa.table("countries", sa.column("code", sa.String()))
    op.bulk_insert(countries, [{"code": code} for code in ISO_COUNTRY_CODES])

    op.create_foreign_key("fk_users_country_code", "users", "countries", ["country_code"], ["code"], ondelete="SET NULL")
    op.create_foreign_key("fk_quest_templates_country_code", "quest_templates", "countries", ["country_code"], ["code"], ondelete="SET NULL")
    op.create_foreign_key("fk_quests_country_code", "quests", "countries", ["country_code"], ["code"], ondelete="SET NULL")
    op.create_check_constraint("ck_quest_templates_lat_range", "quest_templates", "lat IS NULL OR lat BETWEEN -90 AND 90")
    op.create_check_constraint("ck_quest_templates_lon_range", "quest_templates", "lon IS NULL OR lon BETWEEN -180 AND 180")
    op.create_check_constraint("ck_quests_lat_range", "quests", "lat IS NULL OR lat BETWEEN -90 AND 90")
    op.create_check_constraint("ck_quests_lon_range", "quests", "lon IS NULL OR lon BETWEEN -180 AND 180")
    op.create_index("ix_users_country_code", "users", ["country_code"])
    op.create_index("ix_quest_templates_country_code", "quest_templates", ["country_code"])
    op.create_index("ix_quests_country_code", "quests", ["country_code"])


def downgrade() -> None:
    op.drop_index("ix_quests_country_code", table_name="quests")
    op.drop_index("ix_quest_templates_country_code", table_name="quest_templates")
    op.drop_index("ix_users_country_code", table_name="users")
    op.drop_constraint("ck_quests_lon_range", "quests", type_="check")
    op.drop_constraint("ck_quests_lat_range", "quests", type_="check")
    op.drop_constraint("ck_quest_templates_lon_range", "quest_templates", type_="check")
    op.drop_constraint("ck_quest_templates_lat_range", "quest_templates", type_="check")
    op.drop_constraint("fk_quests_country_code", "quests", type_="foreignkey")
    op.drop_constraint("fk_quest_templates_country_code", "quest_templates", type_="foreignkey")
    op.drop_constraint("fk_users_country_code", "users", type_="foreignkey")
    op.drop_table("countries")
