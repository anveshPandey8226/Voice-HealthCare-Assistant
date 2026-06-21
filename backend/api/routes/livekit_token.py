import uuid

from fastapi import APIRouter
from livekit.api import AccessToken, VideoGrants
from pydantic import BaseModel

from config import settings

router = APIRouter()


class TokenRequest(BaseModel):
    room_name: str | None = None
    identity: str | None = None


class TokenResponse(BaseModel):
    token: str
    room_name: str
    identity: str
    livekit_url: str


@router.post("/token", response_model=TokenResponse)
async def create_token(body: TokenRequest) -> TokenResponse:
    room_name = body.room_name or f"careai-{uuid.uuid4().hex[:8]}"
    identity = body.identity or f"patient-{uuid.uuid4().hex[:6]}"

    token = (
        AccessToken(settings.livekit_api_key, settings.livekit_api_secret)
        .with_identity(identity)
        .with_name(identity)
        .with_grants(VideoGrants(room_join=True, room=room_name))
        .to_jwt()
    )

    return TokenResponse(
        token=token,
        room_name=room_name,
        identity=identity,
        livekit_url=settings.livekit_url,
    )
