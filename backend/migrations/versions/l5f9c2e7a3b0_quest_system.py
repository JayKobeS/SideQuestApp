"""Quest rewards, shared daily rotation, and replaceable demo catalogue."""
from alembic import op
import sqlalchemy as sa
from core.quest_catalogue import demo_templates
revision = 'l5f9c2e7a3b0'
down_revision = 'k4e8b1d6f2a9'
branch_labels = None
depends_on = None

def upgrade():
    op.drop_constraint('uq_quests_user_daily_key', 'quests', type_='unique')
    # Retain historical assignments while moving away from the old midnight rotation.
    op.execute("UPDATE quests SET daily_key = NULL, status = CASE WHEN status = 'active' THEN 'expired' ELSE status END WHERE category = 'daily'")
    op.create_unique_constraint('uq_quests_user_day_template', 'quests', ['user_serial_id', 'daily_key', 'template_serial_id'])
    for table in ('quests', 'quest_templates'):
        op.add_column(table, sa.Column('xp_reward', sa.Integer(), nullable=False, server_default='100'))
        op.add_column(table, sa.Column('medal', sa.String(20), nullable=True))
    op.create_table('daily_quest_sets', sa.Column('day', sa.Date(), primary_key=True), sa.Column('template_ids', sa.JSON(), nullable=False))
    op.create_index('ix_quests_user_category_status', 'quests', ['user_serial_id', 'category', 'status'])
    bind = op.get_bind()
    templates = sa.Table('quest_templates', sa.MetaData(), autoload_with=bind)
    existing = set(bind.execute(sa.select(templates.c.title, templates.c.category)).all())
    for row in demo_templates():
        if (row['title'], row['category']) not in existing:
            bind.execute(templates.insert().values(**row, is_active=True))

def downgrade():
    op.drop_constraint('uq_quests_user_day_template', 'quests', type_='unique')
    op.execute("UPDATE quests SET daily_key = NULL WHERE category = 'daily'")
    op.create_unique_constraint('uq_quests_user_daily_key', 'quests', ['user_serial_id', 'daily_key'])
    op.drop_index('ix_quests_user_category_status', table_name='quests')
    op.drop_table('daily_quest_sets')
    for table in ('quests', 'quest_templates'):
        op.drop_column(table, 'medal')
        op.drop_column(table, 'xp_reward')
