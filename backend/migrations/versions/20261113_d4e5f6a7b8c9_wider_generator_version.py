"""wider generator_version: hosted model ids are longer than local ones

"openai/gpt-oss-20b:exercise_generation_v2" is 41 characters; the column held 40, so
issuing an AI-personalised exercise failed.

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-11-13 01:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d4e5f6a7b8c9"
down_revision: str | Sequence[str] | None = "c3d4e5f6a7b8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("exercises", "generator_version", type_=sa.String(120), existing_nullable=False)


def downgrade() -> None:
    op.alter_column("exercises", "generator_version", type_=sa.String(40), existing_nullable=False)
