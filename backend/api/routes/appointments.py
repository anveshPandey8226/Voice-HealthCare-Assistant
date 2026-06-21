from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from db.repositories.appointment_repo import SlotTakenError
from services import appointment_service

router = APIRouter()


class AppointmentOut(BaseModel):
    id: int
    user_phone: str
    date: str
    time: str
    doctor: str
    notes: str | None
    status: str

    model_config = {"from_attributes": True}


class BookRequest(BaseModel):
    user_phone: str
    date: str
    time: str
    doctor: str = "Dr. Kumar"
    notes: str | None = None


@router.get("/appointments/{phone}", response_model=list[AppointmentOut])
async def list_appointments(phone: str, db: AsyncSession = Depends(get_db)):
    return await appointment_service.get_all(db, phone)


@router.post("/appointments", response_model=AppointmentOut)
async def create_appointment(body: BookRequest, db: AsyncSession = Depends(get_db)):
    try:
        return await appointment_service.book(db, body.user_phone, body.date, body.time, body.doctor, body.notes)
    except SlotTakenError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.patch("/appointments/{appointment_id}/cancel", response_model=AppointmentOut)
async def cancel_appointment(appointment_id: int, phone: str, db: AsyncSession = Depends(get_db)):
    result = await appointment_service.cancel(db, appointment_id, phone)
    if not result:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return result
