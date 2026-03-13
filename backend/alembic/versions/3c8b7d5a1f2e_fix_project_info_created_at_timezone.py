"""fix_project_info_created_at_timezone

Revision ID: 3c8b7d5a1f2e
Revises: 9c3f2d1a7b21
Create Date: 2026-02-01 12:45:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "3c8b7d5a1f2e"
down_revision = "9c3f2d1a7b21"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "project_info",
        "created_at",
        existing_type=sa.DateTime(),
        type_=sa.DateTime(timezone=True),
        server_default=sa.text("now()"),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "project_info",
        "created_at",
        existing_type=sa.DateTime(timezone=True),
        type_=sa.DateTime(),
        server_default=None,
        existing_nullable=True,
    )
