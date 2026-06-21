from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import CallSummary


async def create(
    db: AsyncSession, session_id: str, user_phone: str | None, summary_json: str
) -> CallSummary:
    summary = CallSummary(session_id=session_id, user_phone=user_phone, summary_json=summary_json)
    db.add(summary)
    await db.commit()
    await db.refresh(summary)
    return summary


async def get_by_session(db: AsyncSession, session_id: str) -> CallSummary | None:
    result = await db.execute(
        select(CallSummary).where(CallSummary.session_id == session_id)
    )
    return result.scalar_one_or_none()
