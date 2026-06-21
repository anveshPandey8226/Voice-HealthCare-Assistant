import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from config import settings

router = APIRouter()

TAVUS_BASE = "https://tavusapi.com/v2"


class ConversationResponse(BaseModel):
    conversation_id: str
    conversation_url: str


@router.post("/tavus/conversation", response_model=ConversationResponse)
async def create_tavus_conversation() -> ConversationResponse:
    if not settings.tavus_api_key or not settings.tavus_replica_id:
        raise HTTPException(status_code=503, detail="Tavus not configured")

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{TAVUS_BASE}/conversations",
            headers={"x-api-key": settings.tavus_api_key, "Content-Type": "application/json"},
            json={
                "replica_id": settings.tavus_replica_id,
                "conversation_name": "CareAI Health Assistant",
                "properties": {
                    "enable_recording": False,
                    "apply_greenscreen": False,
                },
            },
        )

    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=resp.status_code, detail=resp.text)

    data = resp.json()
    return ConversationResponse(
        conversation_id=data["conversation_id"],
        conversation_url=data["conversation_url"],
    )
