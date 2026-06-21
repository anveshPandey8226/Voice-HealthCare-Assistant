from sqlalchemy.ext.asyncio import AsyncSession

from db.models import User
from db.repositories import user_repo


async def identify_or_create(
    db: AsyncSession, phone_number: str, name: str | None = None
) -> User:
    user = await user_repo.find_by_phone(db, phone_number)
    if user:
        if name and not user.name:
            user = await user_repo.update_name(db, phone_number, name)
        return user
    return await user_repo.create_user(db, phone_number, name)
