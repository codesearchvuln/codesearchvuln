"""Expand agent_findings title and file_path to text

Revision ID: b3f4d9c2e1a7
Revises: add_confidence_description_cwe
Create Date: 2026-02-12 10:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b3f4d9c2e1a7"
down_revision = "add_confidence_description_cwe"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "agent_findings",
        "title",
        existing_type=sa.String(length=500),
        type_=sa.Text(),
        existing_nullable=False,
    )
    op.alter_column(
        "agent_findings",
        "file_path",
        existing_type=sa.String(length=500),
        type_=sa.Text(),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "agent_findings",
        "file_path",
        existing_type=sa.Text(),
        type_=sa.String(length=500),
        existing_nullable=True,
    )
    op.alter_column(
        "agent_findings",
        "title",
        existing_type=sa.Text(),
        type_=sa.String(length=500),
        existing_nullable=False,
    )
