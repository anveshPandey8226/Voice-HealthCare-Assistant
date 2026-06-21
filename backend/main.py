from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import appointments, livekit_token, summary, tavus
from db.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="CareAI Voice AI Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(livekit_token.router, prefix="/api")
app.include_router(tavus.router, prefix="/api")
app.include_router(appointments.router, prefix="/api")
app.include_router(summary.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "careai-voice-ai"}
