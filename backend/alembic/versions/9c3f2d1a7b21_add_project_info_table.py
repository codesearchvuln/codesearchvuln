"""add_project_info_table

Revision ID: 9c3f2d1a7b21
Revises: 8b2f3e2f4c12
Create Date: 2026-02-01 12:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "9c3f2d1a7b21"
down_revision = "8b2f3e2f4c12"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "project_info",
        sa.Column("id", sa.String(), primary_key=True, nullable=False),
        sa.Column("project_id", sa.String(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("language_info", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=True, server_default=sa.text("'pending'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("now()")),
    )
    op.create_index(op.f("ix_project_info_project_id"), "project_info", ["project_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_project_info_project_id"), table_name="project_info")
    op.drop_table("project_info")
