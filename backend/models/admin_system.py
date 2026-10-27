"""Router quản trị - hệ thống và giảng viên của API FastAPI."""

from fastapi import APIRouter, HTTPException

try:
    from ..ketnoi_sql import get_connection
    from ..schemas.admin import GiangVienIn, GVThamGiaDotIn
    from .admin_helpers import dict_rows, bomon_for_khoa
except ImportError:
    from ketnoi_sql import get_connection
    from schemas.admin import GiangVienIn, GVThamGiaDotIn
    from models.admin_helpers import dict_rows, bomon_for_khoa

def health():
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute('SELECT DB_NAME(),@@SERVERNAME')
            r = cur.fetchone()
            return {'ok': True, 'database': r[0], 'server': r[1]}
    except Exception as e:
        raise HTTPException(503, f'Không kết nối được SQL Server: {e}')

def list_departments(ma_khoa: str='CNTT'):
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute("SELECT MaBoMon,TenBoMon,MaKhoa FROM dbo.BoMon WHERE MaKhoa=? AND TrangThai=N'Đang hoạt động' ORDER BY TenBoMon", ma_khoa)
            return {'items': dict_rows(cur)}
    except Exception as e:
        raise HTTPException(500, f'Lỗi đọc bộ môn: {e}')

def resolve_khoa(ten: str):
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute('SELECT TOP 1 MaKhoa FROM dbo.Khoa WHERE MaKhoa=? OR TenKhoa=?', ten, ten)
            r = cur.fetchone()
            if not r:
                raise HTTPException(404, 'Không tìm thấy khoa.')
            return {'MaKhoa': r[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))

def list_lecturers(ma_dot: str | None=None):
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute("\nSELECT gv.MaGV,gv.HoTen,gv.HocVi,gv.ChucVu,gv.Email,gv.SoDienThoai,gv.TrangThai,\n       bm.MaBoMon,bm.TenBoMon,k.MaKhoa,k.TenKhoa,\n       dm.TyLeDinhMuc,dm.SoCaQuyDinh,dm.MaDot\nFROM dbo.GiangVien gv\nJOIN dbo.BoMon bm ON bm.MaBoMon=gv.MaBoMon\nJOIN dbo.Khoa k ON k.MaKhoa=bm.MaKhoa\nOUTER APPLY (SELECT TOP 1 d.MaDot,d.TyLeDinhMuc,d.SoCaQuyDinh FROM dbo.DinhMucPhanCong d WHERE d.MaGV=gv.MaGV AND (? IS NULL OR d.MaDot=?) ORDER BY d.MaDot DESC) dm\nWHERE gv.TrangThai=N'Đang công tác'\nORDER BY k.TenKhoa,bm.TenBoMon,gv.HoTen", ma_dot, ma_dot)
            return {'items': dict_rows(cur)}
    except Exception as e:
        raise HTTPException(500, f'Lỗi đọc GiangVien: {e}')

def create_lecturer(x: GiangVienIn):
    email = x.email.strip() if x.email and x.email.strip() else None
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            requested_ma = (x.ma_gv or '').strip()
            if requested_ma:
                ma = requested_ma
            else:
                # Reuse the short GV0001-style identifiers used by the roster.
                # Ignore longer legacy timestamp IDs when finding the next number.
                cur.execute("""
                    SELECT ISNULL(MAX(TRY_CONVERT(INT,SUBSTRING(MaGV,3,6))),0)+1
                    FROM dbo.GiangVien WITH (UPDLOCK,HOLDLOCK)
                    WHERE MaGV LIKE 'GV[0-9]%'
                      AND LEN(MaGV) BETWEEN 3 AND 8
                      AND TRY_CONVERT(INT,SUBSTRING(MaGV,3,6)) IS NOT NULL
                """)
                ma = 'GV' + str(int(cur.fetchone()[0])).zfill(4)
            bm = bomon_for_khoa(cur, x.don_vi, x.ma_bo_mon)
            if not bm:
                raise HTTPException(400, 'Không xác định được Bộ môn từ Khoa.')
            cur.execute('EXEC dbo.sp_ThemGiangVien ?,?,?,?,?,?,?', ma, x.ho_ten, None, None, email, x.so_dien_thoai, bm)
            if x.ma_dot:
                cur.execute('EXEC dbo.sp_ThemDinhMuc ?,?,?,NULL', x.ma_dot, ma, x.ty_le)
            # Follow the existing first-login contract used for seeded lecturers:
            # password "1" is accepted once and the lecturer must change it.
            cur.execute("""
                INSERT INTO dbo.TaiKhoanGiangVien(MaGV,PasswordHash,MustChangePassword,IsActive)
                VALUES (?,NULL,1,1)
            """, ma)
            cn.commit()
            return {'ok': True, 'ma_gv': ma, 'initial_password': '1', 'must_change_password': True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, str(e))

def update_lecturer(ma_gv: str, x: GiangVienIn):
    email = x.email.strip() if x.email and x.email.strip() else None
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            bm = bomon_for_khoa(cur, x.don_vi, x.ma_bo_mon)
            if not bm:
                raise HTTPException(400, 'Không xác định được Bộ môn từ Khoa.')
            cur.execute("EXEC dbo.sp_SuaGiangVien ?,?,?,?,?,?,?,N'Đang công tác'", ma_gv, x.ho_ten, None, None, email, x.so_dien_thoai, bm)
            if x.ma_dot:
                cur.execute('SELECT 1 FROM dbo.DinhMucPhanCong WHERE MaDot=? AND MaGV=?', x.ma_dot, ma_gv)
                if cur.fetchone():
                    cur.execute('EXEC dbo.sp_CapNhatTyLeDinhMuc ?,?,?', x.ma_dot, ma_gv, x.ty_le)
            cn.commit()
            return {'ok': True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, str(e))

def delete_lecturer(ma_gv: str):
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute('EXEC dbo.sp_XoaGiangVien ?', ma_gv)
            # Preserve lecturer/schedule history, but disable the linked login.
            cur.execute('UPDATE dbo.TaiKhoanGiangVien SET IsActive=0 WHERE MaGV=?', ma_gv)
            cn.commit()
            return {'ok': True}
    except Exception as e:
        raise HTTPException(400, str(e))

def reactivate_lecturer(ma_gv: str):
    """Khôi phục trạng thái công tác và mở lại tài khoản đăng nhập."""
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute('SELECT 1 FROM dbo.GiangVien WHERE MaGV=?', ma_gv)
            if not cur.fetchone():
                raise HTTPException(404, 'Không tìm thấy giảng viên.')
            cur.execute("UPDATE dbo.GiangVien SET TrangThai=N'Đang công tác' WHERE MaGV=?", ma_gv)
            cur.execute('SELECT 1 FROM dbo.TaiKhoanGiangVien WHERE MaGV=?', ma_gv)
            if cur.fetchone():
                cur.execute('UPDATE dbo.TaiKhoanGiangVien SET IsActive=1 WHERE MaGV=?', ma_gv)
            else:
                cur.execute('INSERT INTO dbo.TaiKhoanGiangVien(MaGV,PasswordHash,MustChangePassword,IsActive) VALUES (?,NULL,1,1)', ma_gv)
            cn.commit()
            return {'ok': True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, str(e))


def set_dot_lecturers(ma_dot: str, x: GVThamGiaDotIn):
    """Lưu danh sách giảng viên được tick tham gia đợt thi."""
    chon = list(dict.fromkeys(m.strip() for m in x.ma_gv if m and m.strip()))
    if not chon:
        raise HTTPException(400, 'Phải chọn ít nhất 1 giảng viên tham gia đợt thi.')
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute('SELECT 1 FROM dbo.DotThi WHERE MaDot=?', ma_dot)
            if not cur.fetchone():
                raise HTTPException(404, 'Đợt thi không tồn tại.')

            cur.execute("SELECT MaGV FROM dbo.GiangVien WHERE TrangThai=N'Đang công tác'")
            hop_le = {r[0] for r in cur.fetchall()}
            if any(m not in hop_le for m in chon):
                raise HTTPException(400, 'Có giảng viên không tồn tại hoặc không còn công tác.')

            cur.execute('SELECT MaGV FROM dbo.DinhMucPhanCong WHERE MaDot=?', ma_dot)
            dang_co = {r[0] for r in cur.fetchall()}
            chon_set = set(chon)
            them = [m for m in chon if m not in dang_co]
            bo = [m for m in dang_co if m not in chon_set]

            # Không cho bỏ tick giảng viên đã có phân công (giống sp_XoaDinhMuc)
            if bo:
                cur.execute(
                    'SELECT DISTINCT g.HoTen FROM dbo.PhanCongCoiThi p '
                    'JOIN dbo.CaThi c ON c.MaCa=p.MaCa '
                    'JOIN dbo.GiangVien g ON g.MaGV=p.MaGV '
                    'WHERE c.MaDot=? AND p.MaGV IN (' + ','.join('?' * len(bo)) + ')',
                    ma_dot, *bo)
                dang_gac = [r[0] for r in cur.fetchall()]
                if dang_gac:
                    raise HTTPException(400, 'Không thể bỏ chọn giảng viên đã có phân công: '
                                        + ', '.join(dang_gac) + '. Hãy xếp lại lịch trước.')

            for m in them:
                cur.execute("INSERT INTO dbo.DinhMucPhanCong(MaDot,MaGV,TyLeDinhMuc,GhiChu) "
                            "VALUES(?,?,?,N'Chọn tham gia đợt thi')", ma_dot, m, x.ty_le_mac_dinh)
            for m in bo:
                cur.execute('DELETE FROM dbo.DinhMucPhanCong WHERE MaDot=? AND MaGV=?', ma_dot, m)

            cur.execute('EXEC dbo.sp_TinhDinhMucTheoTyLe ?', ma_dot)
            while cur.nextset():
                pass
            cn.commit()
            return {'ok': True, 'tong': len(chon), 'them': len(them), 'bo': len(bo)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, str(e))
