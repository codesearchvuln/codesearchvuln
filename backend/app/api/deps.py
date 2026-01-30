# from typing import Generator, Optional
# from fastapi import Depends, HTTPException, status
# from fastapi.security import OAuth2PasswordBearer
# from jose import jwt, JWTError
# from pydantic import ValidationError
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core import security

# from app.core.config import settings
from app.db.session import get_db
from app.models.user import User

# from app.schemas import token as token_schema

# reusable_oauth2 = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")


async def get_current_user(
    db: AsyncSession = Depends(get_db),
    # token: str = Depends(reusable_oauth2)
) -> User:
    # try:
    #     payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[security.ALGORITHM])
    #     token_data = token_schema.TokenPayload(**payload)
    # except (JWTError, ValidationError):
    #     raise HTTPException(
    #         status_code=status.HTTP_401_UNAUTHORIZED,
    #         detail="无法验证凭据",
    #         headers={"WWW-Authenticate": "Bearer"},
    # )

    # result = await db.execute(select(User).where(User.id == token_data.sub))
    result = await db.execute(select(User).order_by(User.created_at.asc()))
    user = result.scalars().first()

    # if not user:
    #     raise HTTPException(status_code=404, detail="用户不存在")
    # if not user.is_active:
    #     raise HTTPException(status_code=400, detail="用户已被禁用")
    # return user
    if user:
        return user

    default_user = User(
        email="anonymous@local",
        hashed_password=security.get_password_hash("anonymous"),
        full_name="Anonymous",
        is_active=True,
        is_superuser=True,
        role="admin",
    )
    db.add(default_user)
    await db.commit()
    await db.refresh(default_user)
    return default_user


async def get_current_active_superuser(
    current_user: User = Depends(get_current_user),
) -> User:
    # if not current_user.is_superuser:
    #     raise HTTPException(status_code=400, detail="权限不足")
    return current_user
