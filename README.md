# CareAI Health — Voice AI Agent

A real-time AI voice agent for healthcare appointment management. Patients call in, speak naturally, and the agent identifies them, checks slot availability, books/cancels/modifies appointments, and generates a structured call summary — all through voice.

**Stack**: LiveKit · Deepgram · Cartesia · Gemini 2.5 Flash · Tavus · Next.js · FastAPI · SQLite

---

## Quick Start (Docker)

### 1. Copy and fill in your API keys

```bash
cp .env.example .env
```

Edit `.env` with your credentials (see [Environment Variables](#environment-variables) below).

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

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        User Browser (Next.js)                        │
│                                                                       │
│  ┌──────────────┐  ┌────────────────────┐  ┌───────────────────┐   │
│  │ Tavus Avatar │  │ Transcript + Tools  │  │   Call Summary    │   │
│  │(video + audio│  │  (real-time stream) │  │  (post-call AI)   │   │
│  └──────┬───────┘  └────────┬───────────┘  └─────────┬─────────┘   │
│         │ WebRTC tracks     │ DataChannel events       │ REST poll   │
└─────────┼───────────────────┼──────────────────────────┼────────────┘
          │                   │ WebRTC mic audio          │
          ▼                   ▼                           ▼
┌─────────────────────────────────────┐     ┌────────────────────────┐
│          LiveKit Cloud (SFU)         │     │    FastAPI Backend      │
│                                     │     │    (port 8000)          │
│  Routes WebRTC rooms between:       │     │                        │
│  • Patient browser                  │     │  POST /api/token       │
│  • Agent Worker                     │     │  GET  /api/summary/:id │
│  • Tavus avatar (optional)          │     │  CRUD /api/appointments │
└──────────────┬──────────────────────┘     └──────────┬─────────────┘
               │ Job dispatch                           │
               ▼                                        │
┌──────────────────────────────────────┐               │
│       LiveKit Agent Worker (Python)   │               │
│                                       │          ┌────▼──────────┐
│  AgentSession pipeline:               │          │  SQLite DB     │
│    Silero VAD                         │◄────────►│  users         │
│    → Deepgram STT (nova-3, en-IN)    │          │  appointments  │
│    → Gemini 2.5 Flash LLM            │          │  call_summaries│
│    → Cartesia TTS                     │          └───────────────┘
│    → TranscriptSynchronizer           │
│    → AudioSinkProxy                   │
│    → RoomIO  OR  DataStreamAudioOutput│
│                                       │
│  7 Function Tools:                    │
│    identify_user, fetch_slots,        │
│    book_appointment, retrieve_appts,  │
│    cancel_appointment, modify_appt,   │
│    end_conversation                   │
└──────────────┬────────────────────────┘
               │ DataStream (TTS audio bytes)
               ▼
┌─────────────────────────────────────┐
│         Tavus Cloud (optional)       │
│                                      │
│  Receives TTS audio via DataStream   │
│  Generates lip-synced avatar video   │
│  Publishes audio + video tracks back │
│  to LiveKit room (echo mode)         │
└─────────────────────────────────────┘
```

---

## How a Call Works — End to End

### Step 1 — Connection Setup

1. Patient clicks **Start Call** in the browser.
2. Browser calls `POST /api/token` → FastAPI generates a LiveKit JWT with a random `room_name` (`careai-{8chars}`) and `patient-{6chars}` identity.
3. Browser connects to the LiveKit room via WebRTC (WebSocket signalling through LiveKit Cloud).
4. Browser enables the microphone — audio stream begins flowing to LiveKit.

### Step 2 — Agent Worker Starts

5. LiveKit detects a new participant → dispatches a job to the **Agent Worker** process.
6. Agent Worker calls `ctx.connect()` to join the same room as a background participant.
7. `AgentSession` is created with the full voice pipeline:
   - **Silero VAD** — detects when patient starts/stops speaking, gates the STT
   - **Deepgram STT** (nova-3, en-IN) — streams mic audio → text in real time
   - **Gemini 2.5 Flash** — decides what to say and which tools to call
   - **Cartesia TTS** — converts LLM text → audio waveform
8. If Tavus is configured, `AvatarSession.start()` runs:
   - Calls Tavus API to create a conversation, giving it the LiveKit room credentials
   - Tavus cloud joins the room as `tavus-avatar-agent` (~6–7 s startup)
   - **Replaces** the audio output tail with `DataStreamAudioOutput` — TTS audio now goes to Tavus via data stream instead of directly to the room

### Step 3 — Greeting

9. `CareAIAgent.on_enter()` fires → `session.say("Hello! Thank you for calling…")`.
10. LLM text → Cartesia TTS audio flows through the pipeline:
    - **No Tavus**: audio goes directly to LiveKit room as a WebRTC audio track; browser auto-plays it.
    - **With Tavus**: audio goes via LiveKit DataStream to Tavus cloud → Tavus renders lip-synced video + republishes audio to the room → browser subscribes to both tracks.
11. `TranscriptSynchronizer` (middleware in the audio chain) simultaneously publishes word-level transcription segments to the room → browser receives `RoomEvent.TranscriptionReceived` → transcript panel shows text streaming word-by-word with a blinking cursor.

### Step 4 — Patient Speaks

12. Patient speech → microphone → LiveKit → Agent Worker receives audio stream.
13. Silero VAD detects speech start/end, controls when Deepgram receives audio.
14. Deepgram returns streaming transcription. When `is_final=True`:
    - `user_input_transcribed` event fires on the agent session.
    - Agent publishes `{"type": "transcript", "speaker": "user", "text": "…"}` via DataChannel.
    - Browser appends the user's line to the transcript panel.
15. Final transcribed text is sent to Gemini as the next user turn.

### Step 5 — LLM Decides and Calls Tools

16. Gemini sees the conversation history + system prompt → decides which tool to call.
17. For each tool call the agent:
    - Publishes `{"type": "tool_event", "tool": "book_appointment", "status": "calling"}` → browser shows a **yellow** badge in the ToolCallFeed.
    - Executes the tool (queries/writes SQLite via SQLAlchemy async).
    - Publishes `{"status": "success"}` or `{"status": "error"}` → badge turns **green** or **red**.

### Step 6 — Agent Responds

18. LLM generates a text response → Cartesia TTS → audio + streaming transcript (same as Step 3).
19. `conversation_item_added` event fires when the full assistant message is stored → backend buffers the text.
20. `agent_state_changed` (speaking → not speaking) fires → backend publishes final `transcript` DataChannel message → browser replaces the live streaming bubble with the committed transcript line.

### Step 7 — Call Ends

21. Patient says goodbye → Gemini calls `end_conversation`.
22. The tool:
    - Calls Gemini again with the full transcript to produce structured JSON (intent, summary, preferences).
    - Computes cost breakdown from tracked STT seconds, LLM tokens, TTS characters.
    - Stores in `call_summaries` table keyed by `session_id` (= room name).
    - Publishes `{"type": "tool_event", "tool": "end_conversation", "status": "success", "data": {"session_id": "…"}}`.
23. Browser receives the event → polls `GET /api/summary/{session_id}` every 500 ms (max 20 tries).
24. Summary panel renders: patient info, AI summary, appointments list, cost breakdown.

---

## Voice Pipeline — Audio Chain Detail

The TTS audio passes through a chain of processors before reaching the room:

```
Cartesia TTS output frames
          │
          ▼
TranscriptSynchronizer     ← publishes timed transcription segments to LiveKit room
          │                  Browser: RoomEvent.TranscriptionReceived → streaming text
          ▼
_AudioSinkProxy            ← stable swap-point; the sink below can be hot-swapped
          │
          ├── (no Tavus) ─────► RoomIO (_ParticipantAudioOutput)
          │                     Publishes as WebRTC audio track; browser auto-plays
          │
          └── (with Tavus) ───► DataStreamAudioOutput
                                Sends audio bytes to "tavus-avatar-agent" over
                                LiveKit ByteStream (topic: lk.audio_stream)
                                Holds audio until Tavus publishes its video track
```

When Tavus is enabled, `AvatarSession.start()` calls `replace_audio_tail(DataStreamAudioOutput(...))` which swaps only the tail below `_AudioSinkProxy`, leaving `TranscriptSynchronizer` and other middlewares intact.

---

## Tavus Avatar — Echo Mode Architecture

```
Agent Process                    Tavus Cloud Service             Browser
─────────────                    ───────────────────             ───────

Cartesia TTS audio
        │
        ▼
DataStreamAudioOutput ──ByteStream──► DataStreamAudioReceiver
 (AUDIO_STREAM_TOPIC)                          │
                                               ▼
                                         VideoGenerator
                                      (AI lip-sync render)
                                               │
                                    ┌──────────┴──────────┐
                                    ▼                      ▼
                             Audio WebRTC track      Video WebRTC track ──► <video muted>
                           (on behalf of agent)       (avatar face)
                                    │
                                    ▼
                           <audio autoPlay> (hidden)
                     (explicitly attached via track.attach()
                      — uses native browser media pipeline,
                        not Web Audio API AudioContext)
```

**Key design decisions:**
- **Echo mode** = Tavus only lip-syncs to YOUR Cartesia audio. No Tavus AI, no competing TTS voice.
- `ATTRIBUTE_PUBLISH_ON_BEHALF: agent_identity` on the Tavus participant token — allows publishing audio/video on behalf of the agent.
- The `<video>` element is always mounted (never `display:none`) so LiveKit's `adaptiveStream` IntersectionObserver delivers frames.
- Audio is explicitly attached to a native `<audio>` element (not relying on LiveKit's AudioManager / Web Audio API) because `AudioContext.resume()` is blocked when called outside user-gesture scope after async I/O.

---

## Real-time DataChannel Event Flow

```
Agent tool executes
        │
        └── room.local_participant.publish_data(json, reliable=True)
                │
                ├── type: "tool_event"  ──► ToolCallFeed badge (yellow/green/red)
                │   { tool, status, message, data, timestamp }
                │
                └── type: "transcript"  ──► Transcript panel (committed final line)
                    { speaker: "user"|"agent", text, timestamp }

TranscriptSynchronizer (audio chain middleware)
        │
        └── room.local_participant.publish_transcription()
                │
                └── RoomEvent.TranscriptionReceived
                    { segments: [{ id, text, final }] }
                    ──► streaming word-by-word bubble (cleared on final transcript event)
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend framework | Next.js 14 + TypeScript | UI, routing, standalone Docker output |
| Styling | Tailwind CSS | Utility-first component styles |
| Real-time transport | LiveKit (WebRTC SFU) | Audio/video rooms + DataChannel events |
| Voice activity detection | Silero VAD | Detects when patient is speaking |
| Speech-to-Text | Deepgram nova-3 | Streaming transcription, en-IN language |
| LLM | Google Gemini 2.5 Flash | Intent, tool calling, call summaries |
| Text-to-Speech | Cartesia | Low-latency TTS audio |
| Avatar | Tavus echo mode | Lip-synced video avatar (optional) |
| Agent framework | livekit-agents 1.6.x | `AgentSession`, `@function_tool`, pipeline |
| Backend API | FastAPI + Uvicorn | Token generation, REST endpoints |
| ORM | SQLAlchemy (async) + aiosqlite | Async SQLite operations |
| Database | SQLite | Users, appointments, call summaries |
| Containerisation | Docker Compose | 3-service orchestration |

---

## Agent Tools

| Tool | When Called | What It Does |
|------|-------------|-------------|
| `identify_user(phone, name?)` | Patient gives phone number | Upsert user in DB; required before booking |
| `fetch_slots(date?)` | "What slots are available?" | Returns 10 open slots (9 AM–6 PM) for a date |
| `book_appointment(date, time, doctor?, notes?)` | Patient confirms booking | Checks slot availability, creates row, prevents double-booking |
| `retrieve_appointments()` | "Show my appointments" | Lists all confirmed/cancelled appointments for current user |
| `cancel_appointment(appointment_id)` | "Cancel my appointment" | Sets status → `cancelled` (verifies ownership) |
| `modify_appointment(id, new_date, new_time)` | "Reschedule to…" | Validates new slot, updates existing row |
| `end_conversation()` | Patient says goodbye | Generates Gemini summary, computes cost, stores in DB |

---

## Database Schema

### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | autoincrement |
| phone_number | VARCHAR(20) | unique, indexed |
| name | VARCHAR(100) | nullable |
| created_at | DATETIME | server default now() |

### `appointments`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | autoincrement |
| user_phone | VARCHAR(20) FK | → users.phone_number, indexed |
| date | VARCHAR(20) | YYYY-MM-DD |
| time | VARCHAR(20) | "10:00 AM" |
| doctor | VARCHAR(100) | default "Dr. Kumar" |
| notes | TEXT | nullable |
| status | VARCHAR(20) | `confirmed` or `cancelled` |
| session_id | VARCHAR(100) | LiveKit room name |
| created_at | DATETIME | server default now() |
| UNIQUE constraint | (date, time) | DB-level double-booking prevention |

### `call_summaries`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | autoincrement |
| session_id | VARCHAR(100) | unique, indexed — same as room name |
| user_phone | VARCHAR(20) | nullable |
| summary_json | TEXT | full JSON payload (summary, intent, costs, etc.) |
| created_at | DATETIME | server default now() |

---

## API Endpoints

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/health` | Returns `{"status": "ok"}` |
| POST | `/api/token` | Body: `{room_name?, identity?}` → `{token, room_name, identity, livekit_url}` |
| POST | `/api/tavus/conversation` | Returns `{conversation_id, conversation_url}` — 503 if not configured |
| GET | `/api/appointments/{phone}` | Lists all appointments for a phone number |
| POST | `/api/appointments` | Body: `{user_phone, date, time, doctor?, notes?}` → 409 if slot taken |
| PATCH | `/api/appointments/{id}/cancel` | Query: `?phone=…` → updates status to cancelled |
| GET | `/api/summary/{session_id}` | Returns summary JSON — 404 if not yet generated |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `LIVEKIT_URL` | ✅ | WebSocket URL: `wss://your-project.livekit.cloud` |
| `LIVEKIT_API_KEY` | ✅ | From LiveKit Cloud dashboard |
| `LIVEKIT_API_SECRET` | ✅ | From LiveKit Cloud dashboard |
| `DEEPGRAM_API_KEY` | ✅ | For Deepgram STT |
| `CARTESIA_API_KEY` | ✅ | For Cartesia TTS |
| `CARTESIA_VOICE_ID` | ✅ | Voice ID (default: `a0e99841-438c-4a64-b679-ae501e7d6091`) |
| `GOOGLE_API_KEY` | ✅ | For Gemini 2.5 Flash |
| `TAVUS_API_KEY` | optional | If absent, falls back to CSS animated avatar |
| `TAVUS_REPLICA_ID` | optional | Tavus avatar face ID |
| `TAVUS_PERSONA_ID` | optional | Must be an echo-mode persona (see below) |
| `NEXT_PUBLIC_API_URL` | ✅ | Frontend → Backend: `http://localhost:8000` |
| `NEXT_PUBLIC_LIVEKIT_URL` | ✅ | Same as `LIVEKIT_URL` |
| `DATABASE_URL` | ✅ | `sqlite+aiosqlite:////app/data/careai.db` |

### Creating a Tavus Echo-Mode Persona (one-time)

```bash
TAVUS_API_KEY=your_key python create_tavus_persona.py
```

Copy the printed `TAVUS_PERSONA_ID` into `.env`. The persona must have `pipeline_mode: "echo"` and `layers.transport.type: "livekit"`.

---

## Cost Tracking

Tracked automatically per call and included in the call summary:

| Service | Metric | Rate |
|---------|--------|------|
| Deepgram STT | Audio seconds | $0.0059 / minute |
| Gemini 2.5 Flash | Input tokens | $0.075 / 1M tokens |
| Gemini 2.5 Flash | Output tokens | $0.30 / 1M tokens |
| Cartesia TTS | Characters | $0.00001 / char (~$0.01 / 1K chars) |

The `end_conversation` tool computes these from counters maintained in `CareAIAgent._cost_data` and includes a `cost_breakdown` object in the stored summary JSON.

---

## Project Structure

```
mykare-voice-ai/
├── .env.example                    # Template — copy to .env
├── docker-compose.yml              # 3 services: backend, agent, frontend
│
├── backend/
│   ├── Dockerfile                  # python:3.11-slim + ffmpeg (required by PyAV)
│   ├── requirements.txt            # livekit-agents 1.6.x + all plugins
│   ├── config.py                   # Pydantic Settings — typed env var validation
│   ├── main.py                     # FastAPI app + CORS + lifespan (DB init)
│   ├── agent_worker.py             # LiveKit CLI entry → calls entrypoint()
│   ├── create_tavus_persona.py     # One-time Tavus persona creation script
│   │
│   ├── agent/
│   │   ├── voice_agent.py          # entrypoint(): AgentSession + 3 event handlers
│   │   ├── tools.py                # CareAIAgent(Agent) with 7 @function_tool methods
│   │   └── system_prompt.py        # Miko persona, conversation rules, date handling
│   │
│   ├── services/
│   │   ├── appointment_service.py  # fetch_available_slots, book, cancel, modify, get_all
│   │   ├── summary_service.py      # Calls Gemini, parses JSON, stores in DB
│   │   └── user_service.py         # identify_or_create (phone upsert)
│   │
│   ├── db/
│   │   ├── database.py             # Async engine, AsyncSessionLocal, init_db()
│   │   ├── models.py               # User, Appointment, CallSummary ORM models
│   │   └── repositories/
│   │       ├── user_repo.py        # find_by_phone, create_user, update_name
│   │       ├── appointment_repo.py # SlotTakenError + full CRUD + conflict check
│   │       └── summary_repo.py     # create, get_by_session
│   │
│   └── api/routes/
│       ├── livekit_token.py        # POST /api/token — JWT with VideoGrants
│       ├── tavus.py                # POST /api/tavus/conversation
│       ├── appointments.py         # GET + POST + PATCH
│       └── summary.py              # GET /api/summary/{session_id}
│
└── frontend/
    ├── Dockerfile                  # node:20-alpine multi-stage (Next.js standalone)
    ├── package.json                # Next.js 14, livekit-client 2.6, Tailwind
    ├── next.config.mjs             # output: standalone (required for Docker CMD)
    │
    └── src/
        ├── app/page.tsx            # Root page — renders <CallInterface>
        ├── types/index.ts          # AgentState, ToolEvent, CallSummaryData, etc.
        ├── lib/api.ts              # fetchToken(), fetchSummary(), createTavusConversation()
        │
        ├── hooks/
        │   ├── useLiveKitRoom.ts   # connect/disconnect, mic enable
        │   ├── useAgentState.ts    # idle → connecting → listening/speaking state machine
        │   ├── useToolEvents.ts    # DataReceived → ToolEvent[] (last 50)
        │   └── useCallSummary.ts   # Polls /api/summary with retry (20 × 500 ms)
        │
        └── components/
            ├── CallInterface/
            │   ├── index.tsx       # Orchestrator: room state, transcript, streaming
            │   └── ControlBar.tsx  # Start / End / Mute buttons
            ├── Avatar/
            │   ├── TavusAvatar.tsx     # Subscribes to LiveKit video + audio tracks
            │   └── FallbackAvatar.tsx  # CSS animated fallback (hospital emoji 🏥)
            ├── Transcript/
            │   └── index.tsx       # Agent (left) + User (right) bubbles + streaming cursor
            ├── ToolCallFeed/
            │   ├── index.tsx
            │   └── ToolCallBadge.tsx   # calling=yellow, success=green, error=red
            └── CallSummary/
                ├── index.tsx           # Summary text, preferences, cost breakdown
                └── AppointmentCard.tsx # Date / time / doctor / status card
```

---

## Docker Services

```yaml
backend:   FastAPI on :8000  — token gen, REST CRUD, DB access
agent:     LiveKit agent worker — joins rooms, handles voice pipeline
frontend:  Next.js on :3000  — patient-facing UI
```

`backend` and `agent` use the same Docker image but different CMD:
- `backend` → `uvicorn main:app --host 0.0.0.0 --port 8000`
- `agent` → `python agent_worker.py dev`

Both share the same `.env`. SQLite data persists in a named Docker volume (`db_data:/app/data`). The `agent` service has a `depends_on: backend: condition: service_healthy` so it starts only after FastAPI is ready.

<video src="https://github.com/anveshPandey8226/Voice-HealthCare-Assistant/blob/master/22.06.2026_01.10.42_REC.mp4" width="100%" controls loop muted autoplay></video>
