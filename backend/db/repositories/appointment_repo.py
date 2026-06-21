from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Appointment


class SlotTakenError(Exception):
    pass


async def check_slot_taken(db: AsyncSession, date: str, time: str) -> bool:
    result = await db.execute(
        select(Appointment).where(
            Appointment.date == date,
            Appointment.time == time,
            Appointment.status == "confirmed",
        )
    )
    return result.scalar_one_or_none() is not None


async def create(
    db: AsyncSession,
    user_phone: str,
    date: str,
    time: str,
    doctor: str = "Dr. Kumar",
    notes: str | None = None,
    session_id: str | None = None,
) -> Appointment:
    if await check_slot_taken(db, date, time):
        raise SlotTakenError(f"Slot {date} at {time} is already booked.")

    appointment = Appointment(
        user_phone=user_phone,
        date=date,
        time=time,
        doctor=doctor,
        notes=notes,
        session_id=session_id,
    )
    db.add(appointment)
    try:
        await db.commit()
        await db.refresh(appointment)
    except IntegrityError:
        await db.rollback()
        raise SlotTakenError(f"Slot {date} at {time} is already booked.")
    return appointment


async def get_by_phone(db: AsyncSession, phone_number: str) -> list[Appointment]:
    result = await db.execute(
        select(Appointment)
        .where(Appointment.user_phone == phone_number)
        .order_by(Appointment.created_at.desc())
    )
    return list(result.scalars().all())


async def get_by_id(db: AsyncSession, appointment_id: int) -> Appointment | None:
    result = await db.execute(select(Appointment).where(Appointment.id == appointment_id))
    return result.scalar_one_or_none()


async def update_status(
    db: AsyncSession, appointment_id: int, user_phone: str, status: str
) -> Appointment | None:
    appointment = await get_by_id(db, appointment_id)
    if not appointment or appointment.user_phone != user_phone:
        return None
    appointment.status = status
    await db.commit()
    await db.refresh(appointment)
    return appointment


async def update_slot(
    db: AsyncSession, appointment_id: int, user_phone: str, new_date: str, new_time: str
) -> Appointment:
    if await check_slot_taken(db, new_date, new_time):
        raise SlotTakenError(f"Slot {new_date} at {new_time} is already booked.")

    appointment = await get_by_id(db, appointment_id)
    if not appointment or appointment.user_phone != user_phone:
        raise ValueError("Appointment not found or access denied.")

    appointment.date = new_date
    appointment.time = new_time
    try:
        await db.commit()
        await db.refresh(appointment)
    except IntegrityError:
        await db.rollback()
        raise SlotTakenError(f"Slot {new_date} at {new_time} is already booked.")
    return appointment
