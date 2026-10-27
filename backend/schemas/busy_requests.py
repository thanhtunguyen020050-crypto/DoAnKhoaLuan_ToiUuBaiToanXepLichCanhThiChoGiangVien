"""Pydantic request schemas cho xử lý yêu cầu báo bận."""
from datetime import datetime

from pydantic import BaseModel, Field


class BusyRequestCreateIn(BaseModel):
    ma_ca: str | None = Field(default=None, max_length=50)
    ma_gv_thay_the: str | None = Field(default=None, min_length=1, max_length=20)
    thoi_gian_bat_dau: datetime
    thoi_gian_ket_thuc: datetime
    ly_do: str = Field(min_length=1, max_length=500)
    ghi_chu: str | None = Field(default=None, max_length=500)


class BusyRequestNominateIn(BaseModel):
    ma_gv_thay_the: str = Field(min_length=1, max_length=20)


class BusyRequestCoverResponseIn(BaseModel):
    chap_nhan: bool


class BusyRequestApproveIn(BaseModel):
    ma_gv_thay_the: str = Field(min_length=1, max_length=20)
    ghi_chu_admin: str | None = Field(default=None, max_length=500)


class BusyRequestRejectIn(BaseModel):
    ly_do_tu_choi: str = Field(min_length=1, max_length=500)
    ghi_chu_admin: str | None = Field(default=None, max_length=500)
