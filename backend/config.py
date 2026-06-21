from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # LiveKit
    livekit_url: str
    livekit_api_key: str
    livekit_api_secret: str

    # STT
    deepgram_api_key: str

    # TTS
    cartesia_api_key: str
    cartesia_voice_id: str = "a0e99841-438c-4a64-b679-ae501e7d6091"

    # LLM
    google_api_key: str

    # Avatar
    tavus_api_key: str = ""
    tavus_replica_id: str = ""
    tavus_persona_id: str = ""

    # DB
    database_url: str = "sqlite+aiosqlite:////app/data/careai.db"


settings = Settings()
