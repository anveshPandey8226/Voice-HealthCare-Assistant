from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import User


async def find_by_phone(db: AsyncSession, phone_number: str) -> User | None:
    result = await db.execute(select(User).where(User.phone_number == phone_number))
    return result.scalar_one_or_none()


async def create_user(db: AsyncSession, phone_number: str, name: str | None = None) -> User:
    user = User(phone_number=phone_number, name=name)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def update_name(db: AsyncSession, phone_number: str, name: str) -> User | None:
    user = await find_by_phone(db, phone_number)
    if not user:
        return None
    user.name = name
    await db.commit()
    await db.refresh(user)
    return user
