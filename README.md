# CareAI Health — Voice AI Agent

A real-time AI voice agent for healthcare appointment management.

**Stack**: LiveKit · Deepgram · Cartesia · Gemini 2.5 Flash · Tavus · Next.js · FastAPI · SQLite

---

## Quick Start (Docker)

### 1. Copy and fill in your API keys

```bash
cp .env.example .env
```

Edit `.env`:

```env
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
DEEPGRAM_API_KEY=...
CARTESIA_API_KEY=...
CARTESIA_VOICE_ID=a0e99841-438c-4a64-b679-ae501e7d6091
GOOGLE_API_KEY=...
TAVUS_API_KEY=...              # optional — falls back to CSS avatar
TAVUS_REPLICA_ID=...           # optional
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_LIVEKIT_URL=wss://your-project.livekit.cloud
DATABASE_URL=sqlite+aiosqlite:////app/data/careai.db
```

### 2. Start all services

```bash
docker compose up --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |

---

## Architecture

```
User Browser (Next.js)
     │
     ├── LiveKit WebRTC ──────────────────┐
     │   (mic audio stream)               │
     │                                    ▼
     └── REST API (FastAPI) ────► LiveKit Agent (Python)
         /api/token                │  Deepgram STT (nova-3)
         /api/summary/:id          │  Gemini 2.5 Flash LLM
         /api/appointments         │  Cartesia TTS
         /api/tavus/conversation   │  Tool Calling
                                   │
                          SQLite Database
                      (users, appointments,
                        call_summaries)
```

### Real-time Tool Event Flow

```
Agent calls tool
     │
     ├── Executes service logic (DB read/write)
     └── Publishes DataChannel message to room
              │
              ▼
         Frontend receives via room.on('dataReceived')
              │
              ▼
         ToolCallFeed displays badge:
           "Fetching slots…"  (yellow)
           "Booking confirmed ✅" (green)
```

---

## Agent Tools

| Tool | Trigger | Action |
|------|---------|--------|
| `identify_user` | Patient gives phone number | Upsert user in DB |
| `fetch_slots` | Patient asks about availability | Return open slots |
| `book_appointment` | Patient confirms booking | Save to DB, prevent double-book |
| `retrieve_appointments` | Patient asks "my appointments" | Query DB by phone |
| `cancel_appointment` | Patient wants to cancel | Update status → cancelled |
| `modify_appointment` | Patient wants to reschedule | Validate new slot, update |
| `end_conversation` | Patient says goodbye | Generate AI summary, store in DB |

---

## API Endpoints

```
GET  /api/health
POST /api/token                        → LiveKit JWT
POST /api/tavus/conversation           → Tavus session URL
GET  /api/appointments/{phone}         → List appointments
POST /api/appointments                 → Create appointment
PATCH /api/appointments/{id}/cancel    → Cancel appointment
GET  /api/summary/{session_id}         → Call summary JSON
```

---

## Cost Per Call (Bonus)

Tracked automatically and included in the call summary:

| Service | Rate |
|---------|------|
| Deepgram STT | $0.0059 / min |
| Gemini 2.5 Flash | $0.075 / 1M input tokens |
| Cartesia TTS | ~$0.01 / 1K chars |

---

## Project Structure

```
careai-voice-ai/
├── backend/
│   ├── agent/          # LiveKit voice agent + tools
│   ├── services/       # Business logic
│   ├── db/             # SQLAlchemy models + repositories
│   ├── api/            # FastAPI routes
│   ├── main.py         # FastAPI entrypoint
│   └── agent_worker.py # LiveKit worker process
└── frontend/
    └── src/
        ├── components/ # UI components
        ├── hooks/      # React hooks (LiveKit, tools, summary)
        ├── lib/        # API client
        └── types/      # TypeScript types
```
