"""compatibility bridge for project_management_metrics revision

Revision ID: 90a71996ac03
Revises: 5f6a7b8c9d0e
Create Date: 2026-03-17 22:58:25.761954

"""

# revision identifiers, used by Alembic.
revision = "90a71996ac03"
down_revision = "5f6a7b8c9d0e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Compatibility no-op.

    The canonical ``project_management_metrics`` table was already introduced in
    revision ``e5f6a7b8c9d0`` before this follow-up revision was generated.
    Keeping this revision as a stub preserves upgrade continuity for databases
    that have already recorded ``90a71996ac03`` while avoiding a duplicate table
    creation on fresh environments.
    """


def downgrade() -> None:
    pass
