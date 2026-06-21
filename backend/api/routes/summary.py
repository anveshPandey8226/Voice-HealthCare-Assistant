import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from db.repositories import summary_repo

router = APIRouter()


@router.get("/summary/{session_id}")
async def get_summary(session_id: str, db: AsyncSession = Depends(get_db)):
    record = await summary_repo.get_by_session(db, session_id)
    if not record:
        raise HTTPException(status_code=404, detail="Summary not found")
    return json.loads(record.summary_json)
