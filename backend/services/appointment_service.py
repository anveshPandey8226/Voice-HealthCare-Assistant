from datetime import date, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Appointment
from db.repositories.appointment_repo import (
    SlotTakenError,
    check_slot_taken,
    create,
    get_by_phone,
    update_slot,
    update_status,
)

DAILY_SLOTS = [
    "09:00 AM", "10:00 AM", "11:00 AM",
    "12:00 PM", "01:00 PM", "02:00 PM",
    "03:00 PM", "04:00 PM", "05:00 PM", "06:00 PM",
]


def _default_date() -> str:
    return (date.today() + timedelta(days=1)).strftime("%Y-%m-%d")


async def fetch_available_slots(
    db: AsyncSession, target_date: str | None = None
) -> dict:
    target_date = target_date or _default_date()
    available = []
    for slot in DAILY_SLOTS:
        taken = await check_slot_taken(db, target_date, slot)
        if not taken:
            available.append(slot)
    return {"date": target_date, "available_slots": available}


async def book(
    db: AsyncSession,
    user_phone: str,
    date: str,
    time: str,
    doctor: str = "Dr. Kumar",
    notes: str | None = None,
    session_id: str | None = None,
) -> Appointment:
    return await create(db, user_phone, date, time, doctor, notes, session_id)


async def cancel(db: AsyncSession, appointment_id: int, user_phone: str) -> Appointment | None:
    return await update_status(db, appointment_id, user_phone, "cancelled")


async def modify(
    db: AsyncSession,
    appointment_id: int,
    user_phone: str,
    new_date: str,
    new_time: str,
) -> Appointment:
    return await update_slot(db, appointment_id, user_phone, new_date, new_time)


async def get_all(db: AsyncSession, user_phone: str) -> list[Appointment]:
    return await get_by_phone(db, user_phone)


__all__ = ["fetch_available_slots", "book", "cancel", "modify", "get_all", "SlotTakenError"]
