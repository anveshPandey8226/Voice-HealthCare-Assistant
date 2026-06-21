import asyncio
import json
import logging
from datetime import datetime, timezone

from livekit.agents import Agent, function_tool
from sqlalchemy.ext.asyncio import AsyncSession

from agent.system_prompt import SYSTEM_PROMPT
from db.repositories.appointment_repo import SlotTakenError
from services import appointment_service, summary_service, user_service

logger = logging.getLogger(__name__)


def _tool_event(tool: str, status: str, message: str, data: dict | None = None) -> bytes:
    payload = {
        "type": "tool_event",
        "tool": tool,
        "status": status,
        "message": message,
        "data": data or {},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    return json.dumps(payload).encode()


class CareAIAgent(Agent):
    def __init__(self, room, db: AsyncSession):
        super().__init__(instructions=SYSTEM_PROMPT)
        self._room = room
        self._db = db
        self._user_phone: str | None = None
        self._session_id: str = room.name
        self._transcript_parts: list[str] = []
        self._booked_appointments: list[dict] = []
        self._text_buffer: list[str] = []
        self._cost_data: dict = {
            "stt_seconds": 0,
            "llm_input_tokens": 0,
            "llm_output_tokens": 0,
            "tts_chars": 0,
        }

    async def on_enter(self) -> None:
        await self.session.say(
            "Hello! Thank you for calling CareAI Health. I'm Miko, your AI health assistant. "
            "Could you please share your phone number so I can pull up your details?",
            allow_interruptions=True,
        )

    async def _publish(self, event: bytes) -> None:
        try:
            await self._room.local_participant.publish_data(event, reliable=True)
        except Exception as exc:
            logger.warning("Failed to publish tool event: %s", exc)

    def add_transcript(self, speaker: str, text: str) -> None:
        self._transcript_parts.append(f"{speaker}: {text}")

    def publish_transcript(self, speaker: str, text: str) -> None:
        payload = json.dumps({
            "type": "transcript",
            "speaker": speaker,
            "text": text,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }).encode()
        asyncio.get_event_loop().create_task(self._publish(payload))

    def add_cost(
        self,
        stt_seconds: float = 0,
        llm_input: int = 0,
        llm_output: int = 0,
        tts_chars: int = 0,
    ) -> None:
        self._cost_data["stt_seconds"] += stt_seconds
        self._cost_data["llm_input_tokens"] += llm_input
        self._cost_data["llm_output_tokens"] += llm_output
        self._cost_data["tts_chars"] += tts_chars

    def _compute_cost_breakdown(self) -> dict:
        stt_cost = self._cost_data["stt_seconds"] * (0.0059 / 60)
        llm_cost = (
            self._cost_data["llm_input_tokens"] * 0.075 / 1_000_000
            + self._cost_data["llm_output_tokens"] * 0.30 / 1_000_000
        )
        tts_cost = self._cost_data["tts_chars"] * 0.00001
        return {
            "stt": round(stt_cost, 4),
            "llm": round(llm_cost, 4),
            "tts": round(tts_cost, 4),
            "total": round(stt_cost + llm_cost + tts_cost, 4),
        }

    @function_tool
    async def identify_user(self, phone_number: str, name: str | None = None) -> str:
        """Identify the patient by their phone number. Call this as soon as you have the patient's phone number.

        Args:
            phone_number: Patient's phone number.
            name: Patient's name if mentioned.
        """
        await self._publish(_tool_event("identify_user", "calling", "Identifying patient..."))
        try:
            user = await user_service.identify_or_create(self._db, phone_number, name)
            self._user_phone = phone_number
            await self._publish(_tool_event(
                "identify_user", "success",
                f"Patient identified: {user.name or phone_number}",
                {"phone": phone_number, "name": user.name},
            ))
            return f"Patient identified: phone={phone_number}, name={user.name or 'not provided'}"
        except Exception as exc:
            await self._publish(_tool_event("identify_user", "error", str(exc)))
            return f"Error identifying user: {exc}"

    @function_tool
    async def fetch_slots(self, date: str | None = None) -> str:
        """Fetch available appointment slots for a given date.

        Args:
            date: Date in YYYY-MM-DD format. Defaults to tomorrow if not provided.
        """
        label = f" for {date}" if date else ""
        await self._publish(_tool_event("fetch_slots", "calling", f"Fetching available slots{label}..."))
        try:
            result = await appointment_service.fetch_available_slots(self._db, date)
            slots = result["available_slots"]
            target_date = result["date"]
            if not slots:
                msg = f"No slots available on {target_date}."
                await self._publish(_tool_event("fetch_slots", "success", msg, result))
                return msg
            msg = f"Available slots on {target_date}: {', '.join(slots)}"
            await self._publish(_tool_event("fetch_slots", "success", f"{len(slots)} slots available", result))
            return msg
        except Exception as exc:
            await self._publish(_tool_event("fetch_slots", "error", str(exc)))
            return f"Error fetching slots: {exc}"

    @function_tool
    async def book_appointment(
        self,
        date: str,
        time: str,
        doctor: str = "Dr. Kumar",
        notes: str | None = None,
    ) -> str:
        """Book an appointment for the patient. Always confirm date and time with the patient before calling this.

        Args:
            date: Date in YYYY-MM-DD format.
            time: Time slot, e.g. '10:00 AM'.
            doctor: Doctor name.
            notes: Any special notes.
        """
        phone = self._user_phone
        if not phone:
            return "Please identify the patient first by asking for their phone number."
        await self._publish(_tool_event("book_appointment", "calling", f"Booking appointment for {date} at {time}..."))
        try:
            appt = await appointment_service.book(
                self._db, phone, date, time, doctor, notes, self._session_id
            )
            self._booked_appointments.append({
                "id": appt.id, "date": appt.date, "time": appt.time,
                "doctor": appt.doctor, "status": appt.status,
            })
            await self._publish(_tool_event(
                "book_appointment", "success", f"Booking confirmed for {date} at {time}",
                {"id": appt.id, "date": date, "time": time, "doctor": doctor},
            ))
            return f"Appointment booked! ID: {appt.id}, Date: {date}, Time: {time}, Doctor: {doctor}"
        except SlotTakenError:
            msg = f"Sorry, {date} at {time} is already booked. Please fetch available slots and choose another."
            await self._publish(_tool_event("book_appointment", "error", "Slot already taken", {"date": date, "time": time}))
            return msg
        except Exception as exc:
            await self._publish(_tool_event("book_appointment", "error", str(exc)))
            return f"Error booking appointment: {exc}"

    @function_tool
    async def retrieve_appointments(self) -> str:
        """Retrieve all appointments for the current patient."""
        phone = self._user_phone
        if not phone:
            return "Please identify the patient first."
        await self._publish(_tool_event("retrieve_appointments", "calling", "Fetching your appointments..."))
        try:
            appointments = await appointment_service.get_all(self._db, phone)
            if not appointments:
                await self._publish(_tool_event("retrieve_appointments", "success", "No appointments found"))
                return "No appointments found for this patient."
            lines = [f"ID {a.id}: {a.date} at {a.time} with {a.doctor} ({a.status})" for a in appointments]
            data = [{"id": a.id, "date": a.date, "time": a.time, "doctor": a.doctor, "status": a.status} for a in appointments]
            await self._publish(_tool_event(
                "retrieve_appointments", "success",
                f"{len(appointments)} appointment(s) found",
                {"appointments": data},
            ))
            return "Appointments:\n" + "\n".join(lines)
        except Exception as exc:
            await self._publish(_tool_event("retrieve_appointments", "error", str(exc)))
            return f"Error retrieving appointments: {exc}"

    @function_tool
    async def cancel_appointment(self, appointment_id: int) -> str:
        """Cancel an existing appointment by its ID.

        Args:
            appointment_id: The appointment ID to cancel.
        """
        phone = self._user_phone
        if not phone:
            return "Please identify the patient first."
        await self._publish(_tool_event("cancel_appointment", "calling", f"Cancelling appointment #{appointment_id}..."))
        try:
            result = await appointment_service.cancel(self._db, appointment_id, phone)
            if not result:
                msg = f"Appointment #{appointment_id} not found or does not belong to this patient."
                await self._publish(_tool_event("cancel_appointment", "error", msg))
                return msg
            await self._publish(_tool_event(
                "cancel_appointment", "success",
                f"Appointment #{appointment_id} cancelled",
                {"id": appointment_id},
            ))
            return f"Appointment #{appointment_id} on {result.date} at {result.time} has been cancelled."
        except Exception as exc:
            await self._publish(_tool_event("cancel_appointment", "error", str(exc)))
            return f"Error cancelling appointment: {exc}"

    @function_tool
    async def modify_appointment(
        self,
        appointment_id: int,
        new_date: str,
        new_time: str,
    ) -> str:
        """Modify an existing appointment to a new date and time.

        Args:
            appointment_id: The appointment ID to modify.
            new_date: New date in YYYY-MM-DD format.
            new_time: New time slot, e.g. '02:00 PM'.
        """
        phone = self._user_phone
        if not phone:
            return "Please identify the patient first."
        await self._publish(_tool_event("modify_appointment", "calling", f"Modifying appointment #{appointment_id}..."))
        try:
            result = await appointment_service.modify(self._db, appointment_id, phone, new_date, new_time)
            msg = f"Appointment #{appointment_id} rescheduled to {new_date} at {new_time}."
            await self._publish(_tool_event(
                "modify_appointment", "success", msg,
                {"id": appointment_id, "new_date": new_date, "new_time": new_time},
            ))
            return msg
        except SlotTakenError:
            msg = f"{new_date} at {new_time} is already booked. Please choose another slot."
            await self._publish(_tool_event("modify_appointment", "error", "New slot taken", {"new_date": new_date, "new_time": new_time}))
            return msg
        except ValueError as exc:
            await self._publish(_tool_event("modify_appointment", "error", str(exc)))
            return str(exc)
        except Exception as exc:
            await self._publish(_tool_event("modify_appointment", "error", str(exc)))
            return f"Error modifying appointment: {exc}"

    @function_tool
    async def end_conversation(self) -> str:
        """End the conversation and generate a call summary. Call this when the patient says goodbye or the conversation is complete."""
        await self._publish(_tool_event("end_conversation", "calling", "Generating call summary..."))
        try:
            transcript = "\n".join(self._transcript_parts) or "No transcript available."
            cost = self._compute_cost_breakdown()
            summary = await summary_service.generate(
                self._db,
                self._session_id,
                transcript,
                self._booked_appointments,
                self._user_phone,
                cost,
            )
            await self._publish(_tool_event(
                "end_conversation", "success", "Call summary ready",
                {"session_id": self._session_id, "summary": summary},
            ))
            return "Call summary generated. Have a great day!"
        except Exception as exc:
            logger.error("Summary generation failed: %s", exc)
            await self._publish(_tool_event("end_conversation", "error", f"Summary failed: {exc}"))
            return "Goodbye! Thank you for calling CareAI Health."
