"""
LiveKit agent worker process.
Reads LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET from environment.

Usage:
  python agent_worker.py dev      # local dev with hot reload
  python agent_worker.py start    # production
"""
from livekit.agents import WorkerOptions, cli

from agent.voice_agent import entrypoint

if __name__ == "__main__":
    # Credentials are picked up automatically from env vars:
    # LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
