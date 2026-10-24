"""Các hàm dùng chung cho API quản trị và xử lý dữ liệu SQL."""
import re
import unicodedata

BUSY_REASONS = {
    'Đi công tác, họp theo quyết định của Trường': 1,
    'Bận việc gia đình (Hiếu, hỷ)': 2,
    'Sự cố sức khỏe / Bận việc khẩn cấp đột xuất (Ưu tiên sau cùng - trao đổi giữa GV)': 3,
}

BUSY_PRIORITY = {v: k for k, v in BUSY_REASONS.items()}

def _norm_name(value):
    import unicodedata, re
    s = unicodedata.normalize('NFD', str(value or '').strip())
    s = ''.join(ch for ch in s if unicodedata.category(ch) != 'Mn')
    s = re.sub(r'\s+', ' ', s)
    return s.casefold()

def dict_rows(cur):
    cols=[c[0] for c in cur.description]
    return [dict(zip(cols,r)) for r in cur.fetchall()]

def resolve_khoa_code(cur,value):
    if not value:return None
    cur.execute('SELECT TOP 1 MaKhoa FROM dbo.Khoa WHERE MaKhoa=? OR TenKhoa=?',value,value)
    r=cur.fetchone()
    return r[0] if r else value

def bomon_for_khoa(cur,value,ma_bo_mon=None):
    if ma_bo_mon:
        cur.execute("SELECT TOP 1 MaBoMon FROM dbo.BoMon WHERE MaBoMon=? AND TrangThai=N'Đang hoạt động'",ma_bo_mon)
        r=cur.fetchone()
        return r[0] if r else None
    mk=resolve_khoa_code(cur,value)
    cur.execute("SELECT TOP 1 MaBoMon FROM dbo.BoMon WHERE MaKhoa=? AND TrangThai=N'Đang hoạt động' ORDER BY MaBoMon",mk)
    r=cur.fetchone(); return r[0] if r else None

def _thu_vn(date_str):
    import datetime
    d=datetime.date.fromisoformat(date_str); names=['Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7','Chủ nhật']; return names[d.weekday()]

def _drain(cur):
    while True:
        if not cur.nextset(): break
