"""add_verification_columns_to_agent_findings

Revision ID: d8e5f6g7h8i9
Revises: c9d2e7f4a5b6
Create Date: 2026-03-05 10:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "d8e5f6g7h8i9"
down_revision = "c9d2e7f4a5b6"
branch_labels = None
depends_on = None


def upgrade():
    # Add missing columns to agent_findings table
    op.add_column('agent_findings', sa.Column('verdict', sa.String(20), nullable=True))
    op.add_column('agent_findings', sa.Column('confidence', sa.Float(), nullable=True))
    op.add_column('agent_findings', sa.Column('reachability', sa.String(30), nullable=True))
    op.add_column('agent_findings', sa.Column('verification_evidence', sa.Text(), nullable=True))
    
    # Add indexes for these new columns
    op.create_index('ix_agent_findings_verdict', 'agent_findings', ['verdict'])
    op.create_index('ix_agent_findings_confidence', 'agent_findings', ['confidence'])
    op.create_index('ix_agent_findings_reachability', 'agent_findings', ['reachability'])


def downgrade():
    # Drop indexes first
    op.drop_index('ix_agent_findings_reachability', table_name='agent_findings')
    op.drop_index('ix_agent_findings_confidence', table_name='agent_findings')
    op.drop_index('ix_agent_findings_verdict', table_name='agent_findings')
    
    # Drop columns
    op.drop_column('agent_findings', 'verification_evidence')
    op.drop_column('agent_findings', 'reachability')
    op.drop_column('agent_findings', 'confidence')
    op.drop_column('agent_findings', 'verdict')
