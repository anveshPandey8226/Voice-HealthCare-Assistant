import asyncio
import logging

from livekit.agents import AgentSession, AutoSubscribe, JobContext
from livekit.plugins import cartesia, deepgram, google, silero, tavus

from agent.tools import CareAIAgent
from config import settings
from db.database import AsyncSessionLocal, init_db

logger = logging.getLogger("careai.agent")


async def entrypoint(ctx: JobContext) -> None:
    await init_db()
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    shutdown_ev = asyncio.Event()

    async with AsyncSessionLocal() as db:
        session = AgentSession(
            vad=silero.VAD.load(),
            stt=deepgram.STT(
                api_key=settings.deepgram_api_key,
                model="nova-3",
                language="en-IN",
            ),
            llm=google.LLM(
                model="gemini-2.5-flash",
                api_key=settings.google_api_key,
            ),
            tts=cartesia.TTS(
                api_key=settings.cartesia_api_key,
                voice=settings.cartesia_voice_id,
            ),
        )

        @session.on("close")
        def on_session_close(_ev):
            shutdown_ev.set()

        if settings.tavus_api_key and settings.tavus_persona_id:
            avatar = tavus.AvatarSession(
                replica_id=settings.tavus_replica_id,
                persona_id=settings.tavus_persona_id,
            )
            await avatar.start(session, room=ctx.room)

        agent = CareAIAgent(room=ctx.room, db=db)

        # livekit-agents 1.6.x event names
        @session.on("user_input_transcribed")
        def on_user_transcribed(ev):
            if getattr(ev, "is_final", True) and ev.transcript:
                agent.add_transcript("Patient", ev.transcript)
                agent.publish_transcript("user", ev.transcript)

        @session.on("conversation_item_added")
        def on_item_added(ev):
            item = ev.item
            if "assistant" in str(getattr(item, "role", "")).lower():
                content = getattr(item, "content", "") or ""
                text = content if isinstance(content, str) else " ".join(
                    getattr(p, "text", str(p)) for p in content if p
                )
                if text:
                    agent.add_transcript("Miko", text)
                    agent._text_buffer.append(text)

        @session.on("agent_state_changed")
        def on_agent_state_changed(ev):
            old = str(ev.old_state).lower()
            new = str(ev.new_state).lower()
            if "speaking" in old and "speaking" not in new and agent._text_buffer:
                agent.publish_transcript("agent", agent._text_buffer.pop(0))

        await session.start(agent, room=ctx.room)
        await shutdown_ev.wait()
