"""add_opengrep_tables

Revision ID: 8b2f3e2f4c12
Revises: 311959fcb446
Create Date: 2026-01-31 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '8b2f3e2f4c12'
down_revision = '311959fcb446'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'opengrep_rules',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('pattern_yaml', sa.Text(), nullable=False),
        sa.Column('language', sa.String(), nullable=False),
        sa.Column('severity', sa.String(), nullable=False),
        sa.Column('source', sa.String(), nullable=False),
        sa.Column('patch', sa.String(), nullable=True),
        sa.Column('correct', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('create_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )

    op.create_table(
        'opengrep_scan_tasks',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('project_id', sa.String(), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default=sa.text("'pending'")),
        sa.Column('target_path', sa.String(), nullable=False),
        sa.Column('rulesets', sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column('total_findings', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('error_count', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('warning_count', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('scan_duration_ms', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('files_scanned', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('lines_scanned', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        'opengrep_findings',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('scan_task_id', sa.String(), sa.ForeignKey('opengrep_scan_tasks.id'), nullable=False),
        sa.Column('rule', sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('file_path', sa.String(), nullable=False),
        sa.Column('start_line', sa.Integer(), nullable=True),
        sa.Column('code_snippet', sa.Text(), nullable=True),
        sa.Column('severity', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default=sa.text("'open'")),
    )


def downgrade() -> None:
    op.drop_table('opengrep_findings')
    op.drop_table('opengrep_scan_tasks')
    op.drop_table('opengrep_rules')
