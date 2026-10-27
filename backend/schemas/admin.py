"""Request schemas cho API quản trị hệ thống thi."""
from pydantic import BaseModel, Field


class GiangVienIn(BaseModel):
    ma_gv: str | None = None
    ho_ten: str = Field(min_length=1, max_length=120)
    don_vi: str = Field(default='CNTT', max_length=200)
    ma_bo_mon: str | None = None
    email: str | None = Field(default=None, max_length=150)
    so_dien_thoai: str | None = None
    ty_le: float = Field(default=100, ge=0, le=100)
    ma_dot: str | None = None


class LichDayImportRow(BaseModel):
    name: str
    date: str
    start: int
    end: int
    line: int | None = None


class LichBanImportRow(BaseModel):
    name: str
    date: str
    session: str
    reason: str
    line: int | None = None


class DotThiIn(BaseModel):
    hoc_ky: str = Field(pattern=r'^(HK1|HK2|HKH)$')
    nam_hoc: str = Field(min_length=9, max_length=9)
    ngay_bat_dau: str
    ngay_ket_thuc: str
    ghi_chu: str | None = None


class CaThiIn(BaseModel):
    ma_dot: str | None = None
    hoc_ky: str = Field(pattern=r'^(HK1|HK2|HKH)$')
    nam_hoc: str = Field(min_length=9, max_length=9)
    ngay_thi: str
    tu_tiet: int = Field(ge=1, le=16)
    den_tiet: int = Field(ge=1, le=16)
    hinh_thuc_thi: str = Field(pattern=r'^(Lý thuyết|Tự luận)$')
    so_gv_can_cap: int = Field(ge=1, le=30)


class PhanCongItemIn(BaseModel):
    ma_ca: str = Field(min_length=1, max_length=50)
    ma_gv: str = Field(min_length=1, max_length=20)


class DinhMucItemIn(BaseModel):
    ma_gv: str = Field(min_length=1, max_length=20)
    ty_le: float = Field(ge=0, le=100)


class LuuPhanCongIn(BaseModel):
    assignments: list[PhanCongItemIn] = Field(default_factory=list)
    dinh_muc: list[DinhMucItemIn] = Field(default_factory=list)


class GVThamGiaDotIn(BaseModel):
    ma_gv: list[str] = Field(default_factory=list)
    ty_le_mac_dinh: float = Field(default=100, ge=0, le=100)


class DinhMucChungIn(BaseModel):
    ma_dot: str = Field(min_length=1, max_length=20)
    ty_le: float = Field(ge=0, le=100)
    ma_khoa: str | None = None
