import json
from datetime import datetime, timezone

import google.generativeai as genai
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from db.repositories import summary_repo

genai.configure(api_key=settings.google_api_key)
_model = genai.GenerativeModel("gemini-2.5-flash")

_SUMMARY_PROMPT = """
You are a medical receptionist AI. Summarize this healthcare appointment call.

Conversation transcript:
{transcript}

Appointments made during this call:
{appointments}

Return a JSON object with EXACTLY this structure (no markdown, raw JSON only):
{{
  "summary": "2-3 sentence plain-English summary of the call",
  "intent": "booking | cancellation | inquiry | modification | other",
  "preferences": ["list of any stated preferences, e.g. morning slots"],
  "key_info": {{
    "name": "patient name or null",
    "phone": "phone number or null"
  }}
}}
"""


async def generate(
    db: AsyncSession,
    session_id: str,
    transcript: str,
    appointments: list[dict],
    user_phone: str | None,
    cost_data: dict | None = None,
) -> dict:
    prompt = _SUMMARY_PROMPT.format(
        transcript=transcript,
        appointments=json.dumps(appointments, indent=2),
    )

    response = _model.generate_content(
        prompt,
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
            max_output_tokens=512,
        ),
    )

    try:
        ai_data = json.loads(response.text)
    except json.JSONDecodeError:
        ai_data = {"summary": response.text, "intent": "other", "preferences": []}

    summary_payload = {
        "session_id": session_id,
        "user": {
            "name": ai_data.get("key_info", {}).get("name"),
            "phone": user_phone,
        },
        "summary": ai_data.get("summary", ""),
        "appointments": appointments,
        "intent": ai_data.get("intent", "other"),
        "preferences": ai_data.get("preferences", []),
        "cost_breakdown": cost_data or {},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    await summary_repo.create(db, session_id, user_phone, json.dumps(summary_payload))
    return summary_payload
