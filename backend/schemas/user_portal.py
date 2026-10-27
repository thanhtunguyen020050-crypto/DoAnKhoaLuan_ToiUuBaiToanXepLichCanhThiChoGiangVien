"""Pydantic request schemas cho cổng giảng viên."""
from pydantic import BaseModel, Field


class LoginIn(BaseModel):
    ma_gv: str = Field(min_length=1, max_length=20)
    password: str = Field(min_length=1, max_length=128)


class ChangePasswordIn(BaseModel):
    ma_gv: str = Field(min_length=1, max_length=20)
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=1, max_length=128)


class SwapCreateIn(BaseModel):
    ma_gv: str
    ma_ca_gui: str
    ma_gv_nhan: str
    ma_ca_nhan: str | None = None
    loi_nhan: str | None = Field(default=None, max_length=500)


class SwapRespondIn(BaseModel):
    ma_gv: str
    action: str = Field(pattern=r"^(accept|reject)$")
    phan_hoi: str | None = Field(default=None, max_length=500)


class AdminPasswordResetIn(BaseModel):
    username: str = Field(min_length=1, max_length=120)
    current_password: str = Field(min_length=1, max_length=128)


class ScheduleSharingIn(BaseModel):
    enabled: bool
