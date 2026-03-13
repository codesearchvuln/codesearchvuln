"""add_gitleaks_rules_table

Revision ID: e1a2b3c4d5f6
Revises: d8e5f6g7h8i9
Create Date: 2026-03-10 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "e1a2b3c4d5f6"
down_revision = "d8e5f6g7h8i9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "gitleaks_rules",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("rule_id", sa.String(), nullable=False),
        sa.Column("secret_group", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("regex", sa.Text(), nullable=False),
        sa.Column("keywords", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("path", sa.Text(), nullable=True),
        sa.Column("tags", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("entropy", sa.Float(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("source", sa.String(), nullable=False, server_default=sa.text("'custom'")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("name", name="uq_gitleaks_rules_name"),
        sa.UniqueConstraint("rule_id", name="uq_gitleaks_rules_rule_id"),
    )
    op.create_index("ix_gitleaks_rules_is_active", "gitleaks_rules", ["is_active"])
    op.create_index("ix_gitleaks_rules_rule_id", "gitleaks_rules", ["rule_id"])
    op.create_index(
        "ix_gitleaks_rules_source_active",
        "gitleaks_rules",
        ["source", "is_active"],
    )


def downgrade() -> None:
    op.drop_index("ix_gitleaks_rules_source_active", table_name="gitleaks_rules")
    op.drop_index("ix_gitleaks_rules_rule_id", table_name="gitleaks_rules")
    op.drop_index("ix_gitleaks_rules_is_active", table_name="gitleaks_rules")
    op.drop_table("gitleaks_rules")
