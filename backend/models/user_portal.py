"""API bổ sung cho User UI, đăng nhập giảng viên và đổi ca.
Được include từ main.py; không thay thế các API quản trị hiện có.
"""

try:
    from ..schemas.user_portal import LoginIn, ChangePasswordIn, SwapCreateIn, SwapRespondIn, AdminPasswordResetIn
except ImportError:
    from schemas.user_portal import LoginIn, ChangePasswordIn, SwapCreateIn, SwapRespondIn, AdminPasswordResetIn

import re

import hashlib

import hmac

import secrets

from datetime import datetime

from fastapi import APIRouter, HTTPException, Header

from pydantic import BaseModel, Field

try:
    from ..ketnoi_sql import get_connection
    from ..auth_utils import create_token
except ImportError:
    from ketnoi_sql import get_connection
    from auth_utils import create_token

ITERATIONS = 310_000

def _hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, ITERATIONS)
    return f"pbkdf2_sha256${ITERATIONS}${salt.hex()}${dk.hex()}"

def _verify(password: str, stored: str | None) -> bool:
    if not stored:
        return False
    try:
        algo, rounds, salt_hex, hash_hex = stored.split("$", 3)
        if algo != "pbkdf2_sha256":
            return False
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), int(rounds)).hex()
        return hmac.compare_digest(actual, hash_hex)
    except Exception:
        return False

def _password_error(p: str):
    if not 8 <= len(p) <= 16:
        return "Mật khẩu phải dài từ 8 đến 16 ký tự."
    if not re.search(r"[A-Z]", p):
        return "Mật khẩu phải có ít nhất một chữ cái viết hoa A–Z."
    if not re.search(r"[^A-Za-z0-9]", p):
        return "Mật khẩu phải có ít nhất một ký tự đặc biệt."
    return None

def _rows(cur):
    cols = [c[0] for c in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]

def _require_identity(cur, ma_gv: str):
    cur.execute("""SELECT gv.MaGV,gv.HoTen,gv.Email,tk.PasswordHash,tk.MustChangePassword,tk.IsActive
                   FROM dbo.GiangVien gv JOIN dbo.TaiKhoanGiangVien tk ON tk.MaGV=gv.MaGV
                   WHERE gv.MaGV=? AND gv.TrangThai=N'Đang công tác'""", ma_gv)
    r = cur.fetchone()
    if not r or not r[5]:
        raise HTTPException(401, "Tài khoản không tồn tại hoặc đã bị khóa.")
    return r

def _validate_new_assignment(cur, ma_gv, ma_ca):
    cur.execute("""SELECT c.NgayThi,c.TuTiet,c.DenTiet,c.MaDot,c.Buoi,c.NhomHinhThucThi
                   FROM dbo.CaThi c WHERE c.MaCa=?""", ma_ca)
    slot = cur.fetchone()
    if not slot:
        return "Ca thi không tồn tại."
    cur.execute("SELECT 1 FROM dbo.PhanCongCoiThi WHERE MaGV=? AND MaCa=?", ma_gv, ma_ca)
    if cur.fetchone():
        return "Bạn đã được phân công ca này rồi."
    # Check another assignment of this teacher overlaps in time.
    cur.execute("""SELECT TOP 1 c.MaCa FROM dbo.PhanCongCoiThi p JOIN dbo.CaThi c ON c.MaCa=p.MaCa
                   WHERE p.MaGV=? AND c.MaCa<>? AND c.NgayThi=?
                     AND c.TuTiet<=? AND ?<=c.DenTiet""",
                ma_gv, ma_ca, slot[0], slot[2], slot[1])
    if cur.fetchone():
        return "Giảng viên bị trùng lịch với một ca khác."
    # Teaching schedule is a hard constraint.
    cur.execute("""SELECT TOP 1 ID FROM dbo.LichDayGV WHERE MaGV=? AND NgayDay=?
                   AND TuTiet<=? AND ?<=DenTiet""", ma_gv, slot[0], slot[2], slot[1])
    if cur.fetchone():
        return "Ca mới bị trùng lịch dạy của giảng viên."
    cur.execute("""SELECT TOP 1 b.ID FROM dbo.LichBanGV b
                   WHERE b.MaGV=? AND b.UuTien=1 AND b.NgayBan=?
                     AND b.TuTiet<=? AND ?<=b.DenTiet""",
                ma_gv, slot[0], slot[2], slot[1])
    if cur.fetchone():
        return "Ca mới trùng lịch bận mức 1 của giảng viên."
    cur.execute("""SELECT TOP 1 c.MaCa FROM dbo.PhanCongCoiThi p
                   JOIN dbo.CaThi c ON c.MaCa=p.MaCa
                   WHERE p.MaGV=? AND c.MaDot=? AND c.NgayThi=? AND c.Buoi=?
                     AND c.MaCa<>? AND c.NhomHinhThucThi<>?""",
                ma_gv, slot[3], slot[0], slot[4], ma_ca, slot[5])
    if cur.fetchone():
        return "Ca mới làm trộn loại ca trong cùng buổi."
    # Keep the same +/-1 lecturer quota rule as the scheduler and SQL trigger.
    cur.execute("""SELECT ISNULL(dm.SoCaQuyDinh,0),
                          (SELECT COUNT(*) FROM dbo.PhanCongCoiThi p
                           JOIN dbo.CaThi c ON c.MaCa=p.MaCa
                           WHERE p.MaGV=? AND c.MaDot=target.MaDot)
                   FROM dbo.CaThi target
                   LEFT JOIN dbo.DinhMucPhanCong dm ON dm.MaDot=target.MaDot AND dm.MaGV=?
                   WHERE target.MaCa=?""", ma_gv, ma_gv, ma_ca)
    quota = cur.fetchone()
    if quota and (quota[0] <= 0 or quota[1] + 1 > quota[0] + 1):
        return "Nhận ca này sẽ vượt định mức cho phép của bạn."
    return None

def _validate_removed_assignment(cur, ma_gv, ma_ca):
    cur.execute("""SELECT c.MaDot,ISNULL(dm.SoCaQuyDinh,0),
                          (SELECT COUNT(*) FROM dbo.PhanCongCoiThi p
                           JOIN dbo.CaThi x ON x.MaCa=p.MaCa
                           WHERE p.MaGV=? AND x.MaDot=c.MaDot)
                   FROM dbo.CaThi c
                   LEFT JOIN dbo.DinhMucPhanCong dm ON dm.MaDot=c.MaDot AND dm.MaGV=?
                   WHERE c.MaCa=?""", ma_gv, ma_gv, ma_ca)
    row = cur.fetchone()
    if not row:
        return "Ca thi không tồn tại."
    quota, assigned = row[1], row[2]
    if quota > 0 and assigned - 1 < max(0, quota - 1):
        return "Chuyển ca này sẽ làm bạn thấp hơn định mức cho phép."
    if quota == 0 and assigned - 1 > 0:
        return "Bạn còn ca khác trong đợt dù định mức được giao là 0."
    return None

def _new_temporary_password() -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*"
    chars = [
        secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ"),
        secrets.choice("abcdefghijkmnopqrstuvwxyz"),
        secrets.choice("23456789"),
        secrets.choice("!@#$%&*"),
    ]
    chars.extend(secrets.choice(alphabet) for _ in range(8))
    secrets.SystemRandom().shuffle(chars)
    return "".join(chars)

def login(x: LoginIn):
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            r = _require_identity(cur, x.ma_gv.strip())
            if r[3] is None:
                if x.password != '1':
                    raise HTTPException(401, 'Mã giảng viên hoặc mật khẩu không đúng.')
            elif not _verify(x.password, r[3]):
                raise HTTPException(401, 'Mã giảng viên hoặc mật khẩu không đúng.')
            cur.execute('UPDATE dbo.TaiKhoanGiangVien SET LastLoginAt=SYSDATETIME() WHERE MaGV=?', x.ma_gv.strip())
            cn.commit()
            token = create_token({'sub': r[0], 'ma_gv': r[0], 'role': 'user', 'ho_ten': r[1]})
            return {'ok': True, 'ma_gv': r[0], 'ho_ten': r[1], 'email': r[2], 'must_change_password': bool(r[4]) or r[3] is None, 'token': token}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(503, 'Không thể đăng nhập. Hãy kiểm tra đã chạy migration SQL chưa. Chi tiết: ' + str(e))

def change_password(x: ChangePasswordIn):
    error = _password_error(x.new_password)
    if error:
        raise HTTPException(400, error)
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            r = _require_identity(cur, x.ma_gv.strip())
            if r[3] is None:
                valid_current = x.current_password == '1'
            else:
                valid_current = _verify(x.current_password, r[3])
            if not valid_current:
                raise HTTPException(400, 'Mật khẩu hiện tại không đúng.')
            cur.execute('UPDATE dbo.TaiKhoanGiangVien\n                           SET PasswordHash=?, MustChangePassword=0, PasswordChangedAt=SYSDATETIME()\n                           WHERE MaGV=?', _hash_password(x.new_password), x.ma_gv.strip())
            cn.commit()
            return {'ok': True, 'message': 'Đổi mật khẩu thành công.'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(503, 'Không thể đổi mật khẩu. Hãy kiểm tra migration SQL. ' + str(e))

def my_schedule(ma_gv: str):
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            _require_identity(cur, ma_gv)
            cur.execute('SELECT c.MaCa,c.MaDot,CONVERT(varchar(10),c.NgayThi,23) NgayThi,c.Thu,\n                                  c.TuTiet,c.DenTiet,c.Buoi,c.HinhThucThi,c.PhongThi\n                           FROM dbo.PhanCongCoiThi p JOIN dbo.CaThi c ON c.MaCa=p.MaCa\n                           WHERE p.MaGV=? ORDER BY c.NgayThi,c.TuTiet,c.MaCa', ma_gv)
            return {'items': _rows(cur)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(503, 'Không đọc được lịch cá nhân: ' + str(e))

def available_lecturers(ma_gv: str):
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            _require_identity(cur, ma_gv)
            cur.execute("SELECT MaGV,HoTen FROM dbo.GiangVien\n                           WHERE TrangThai=N'Đang công tác' AND MaGV<>? ORDER BY HoTen", ma_gv)
            return {'items': _rows(cur)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(503, str(e))

def create_swap(x: SwapCreateIn):
    ma_gv, ma_gv_nhan = (x.ma_gv.strip(), x.ma_gv_nhan.strip())
    ma_ca = x.ma_ca_gui.strip()
    if ma_gv == ma_gv_nhan:
        raise HTTPException(400, 'Không thể gửi yêu cầu nhận coi thay cho chính mình.')
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            _require_identity(cur, ma_gv)
            _require_identity(cur, ma_gv_nhan)
            cur.execute('SELECT c.MaCa,c.MaDot,c.NgayThi,c.TuTiet,c.DenTiet\n                           FROM dbo.PhanCongCoiThi p JOIN dbo.CaThi c ON c.MaCa=p.MaCa\n                           WHERE p.MaGV=? AND c.MaCa=?', ma_gv, ma_ca)
            slot = cur.fetchone()
            if not slot:
                raise HTTPException(400, 'Ca được chọn hiện không còn được phân công cho bạn.')
            cur.execute("SELECT TOP 1 ID FROM dbo.YeuCauDoiCa WITH (UPDLOCK,HOLDLOCK)\n                           WHERE MaCaGui=? AND TrangThai='Pending'", ma_ca)
            if cur.fetchone():
                raise HTTPException(409, 'Ca này đã có yêu cầu đang chờ xử lý.')
            cur.execute('INSERT INTO dbo.YeuCauDoiCa(MaGVGui,MaGVNhan,MaCaGui,LoiNhan)\n                           OUTPUT INSERTED.ID VALUES(?,?,?,?)', ma_gv, ma_gv_nhan, ma_ca, x.loi_nhan)
            inserted = cur.fetchone()
            if not inserted or inserted[0] is None:
                raise RuntimeError('SQL Server không trả về mã yêu cầu vừa tạo.')
            request_id = int(inserted[0])
            date_label = slot[2].strftime('%d/%m/%Y') if hasattr(slot[2], 'strftime') else str(slot[2])
            duty_label = f'{date_label}, tiết {slot[3]}–{slot[4]} ({ma_ca})'
            cur.execute("INSERT INTO dbo.ThongBao(MaGVNhan,DoiTuongNhan,TieuDe,NoiDung,Loai,YeuCauDoiCaID)\n                           VALUES(?, 'Lecturer',N'Yêu cầu nhận coi thay',?,?,?)", ma_gv_nhan, f'Giảng viên {ma_gv} nhờ bạn nhận coi thay ca {duty_label}. Nếu chấp nhận, ca này sẽ được chuyển sang bạn.', 'SwapRequest', request_id)
            cur.execute("INSERT INTO dbo.ThongBao(MaGVNhan,DoiTuongNhan,TieuDe,NoiDung,Loai,YeuCauDoiCaID)\n                           VALUES(NULL,'Admin',N'Có yêu cầu nhận coi thay',?,?,?)", f'Giảng viên {ma_gv} nhờ {ma_gv_nhan} nhận coi thay ca {duty_label}.', 'SwapRequest', request_id)
            cn.commit()
            return {'ok': True, 'id': request_id, 'status': 'Pending'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(503, 'Không tạo được yêu cầu đổi ca. Hãy kiểm tra migration SQL. ' + str(e))

def respond_swap(request_id: int, x: SwapRespondIn):
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            _require_identity(cur, x.ma_gv)
            cur.execute('SELECT MaGVGui,MaGVNhan,MaCaGui,MaCaNhan,TrangThai FROM dbo.YeuCauDoiCa WITH (UPDLOCK,HOLDLOCK) WHERE ID=?', request_id)
            r = cur.fetchone()
            if not r:
                raise HTTPException(404, 'Không tìm thấy yêu cầu đổi ca.')
            if r[1] != x.ma_gv:
                raise HTTPException(403, 'Chỉ giảng viên được nhận yêu cầu mới có quyền phản hồi.')
            if r[4] != 'Pending':
                raise HTTPException(409, 'Yêu cầu này không còn ở trạng thái chờ xử lý.')
            if x.action == 'reject':
                cur.execute("UPDATE dbo.YeuCauDoiCa SET TrangThai='Rejected',PhanHoi=?,PhanHoiLuc=SYSDATETIME() WHERE ID=?", x.phan_hoi, request_id)
                cur.execute("INSERT INTO dbo.ThongBao(MaGVNhan,DoiTuongNhan,TieuDe,NoiDung,Loai,YeuCauDoiCaID)\n                               VALUES(?, 'Lecturer',N'Yêu cầu đổi ca bị từ chối',?,?,?)", r[0], x.phan_hoi or 'Yêu cầu đổi ca đã bị từ chối.', 'SwapRejected', request_id)
                cur.execute("INSERT INTO dbo.ThongBao(MaGVNhan,DoiTuongNhan,TieuDe,NoiDung,Loai,YeuCauDoiCaID)\n                               VALUES(NULL,'Admin',N'Yêu cầu đổi ca bị từ chối',?,?,?)", f'Yêu cầu #{request_id} bị từ chối.', 'SwapRejected', request_id)
                cn.commit()
                return {'ok': True, 'status': 'Rejected'}
            if r[3] is not None:
                raise HTTPException(409, 'Đây là yêu cầu đổi hai ca cũ. Hãy tạo yêu cầu nhận coi thay một ca mới.')
            cur.execute('SELECT 1 FROM dbo.PhanCongCoiThi WITH (UPDLOCK,HOLDLOCK)\n                           WHERE MaCa=? AND MaGV=?', r[2], r[0])
            if not cur.fetchone():
                raise HTTPException(409, 'Ca này không còn được phân công cho người gửi yêu cầu.')
            err = _validate_removed_assignment(cur, r[0], r[2])
            if err:
                raise HTTPException(409, 'Không thể chuyển ca: ' + err)
            err = _validate_new_assignment(cur, r[1], r[2])
            if err:
                raise HTTPException(409, 'Không thể nhận coi thay: ' + err)
            cur.execute("UPDATE dbo.PhanCongCoiThi\n                           SET MaGV=?,GhiChu=N'Nhận coi thay theo yêu cầu đã được chấp nhận'\n                           WHERE MaCa=? AND MaGV=?", r[1], r[2], r[0])
            if cur.rowcount != 1:
                raise HTTPException(409, 'Không thể chuyển ca vì phân công đã thay đổi.')
            cur.execute("UPDATE dbo.YeuCauDoiCa SET TrangThai='Accepted',PhanHoi=?,PhanHoiLuc=SYSDATETIME(),HoanTatLuc=SYSDATETIME() WHERE ID=?", x.phan_hoi, request_id)
            cur.execute("INSERT INTO dbo.LichSuDoiCa(YeuCauDoiCaID,MaGV1,MaGV2,MaCa1,MaCa2,KetQua)\n                           VALUES(?,?,?,?,?,N'Nhận coi thay một ca thành công')", request_id, r[0], r[1], r[2], r[2])
            for gv, title, msg in [(r[0], 'Đã có người nhận coi thay', f'Yêu cầu #{request_id} đã được chấp nhận. Ca thi đã chuyển sang {r[1]} và lịch của bạn đã cập nhật.'), (r[1], 'Đã nhận coi thay ca', f'Bạn đã nhận coi thay ca theo yêu cầu #{request_id}. Lịch của bạn đã cập nhật.')]:
                cur.execute("INSERT INTO dbo.ThongBao(MaGVNhan,DoiTuongNhan,TieuDe,NoiDung,Loai,YeuCauDoiCaID)\n                               VALUES(?, 'Lecturer',?,?, 'SwapAccepted',?)", gv, title, msg, request_id)
            cur.execute("INSERT INTO dbo.ThongBao(MaGVNhan,DoiTuongNhan,TieuDe,NoiDung,Loai,YeuCauDoiCaID)\n                           VALUES(NULL,'Admin',N'Đổi ca đã hoàn tất',?,?,?)", f'Yêu cầu #{request_id} đã được xử lý tự động.', 'SwapAccepted', request_id)
            cn.commit()
            return {'ok': True, 'status': 'Accepted', 'message': 'Đã chuyển ca cho giảng viên nhận.'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(503, 'Không thể xử lý yêu cầu đổi ca: ' + str(e))

def list_swaps(ma_gv: str):
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            _require_identity(cur, ma_gv)
            cur.execute('SELECT y.ID,y.MaGVGui,y.MaGVNhan,y.MaCaGui,y.MaCaNhan,y.TrangThai,y.LoiNhan,y.PhanHoi,y.TaoLuc,\n                                  g1.HoTen AS TenNguoiGui,g2.HoTen AS TenNguoiNhan,\n                                  CONVERT(varchar(10),c1.NgayThi,23) AS NgayCaGui,c1.TuTiet AS TuTietGui,c1.DenTiet AS DenTietGui,\n                                  CONVERT(varchar(10),c2.NgayThi,23) AS NgayCaNhan,c2.TuTiet AS TuTietNhan,c2.DenTiet AS DenTietNhan\n                           FROM dbo.YeuCauDoiCa y JOIN dbo.GiangVien g1 ON g1.MaGV=y.MaGVGui\n                           JOIN dbo.GiangVien g2 ON g2.MaGV=y.MaGVNhan\n                           JOIN dbo.CaThi c1 ON c1.MaCa=y.MaCaGui LEFT JOIN dbo.CaThi c2 ON c2.MaCa=y.MaCaNhan\n                           WHERE y.MaGVGui=? OR y.MaGVNhan=? ORDER BY y.TaoLuc DESC', ma_gv, ma_gv)
            return {'items': _rows(cur)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(503, str(e))

def notifications(ma_gv: str):
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            _require_identity(cur, ma_gv)
            cur.execute('SELECT ID,TieuDe,NoiDung,Loai,DaDoc,TaoLuc,YeuCauDoiCaID\n                           FROM dbo.ThongBao WHERE MaGVNhan=?\n                           ORDER BY TaoLuc DESC', ma_gv)
            return {'items': _rows(cur)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(503, str(e))

def mark_notification_read(ma_gv: str, notification_id: int):
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            _require_identity(cur, ma_gv)
            cur.execute('UPDATE dbo.ThongBao SET DaDoc=1 WHERE ID=? AND MaGVNhan=?', notification_id, ma_gv)
            cn.commit()
            return {'ok': True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(503, str(e))

def admin_notifications():
    """Thông báo đổi ca dành cho khu vực Admin UI."""
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute("SELECT TOP 100 ID,TieuDe,NoiDung,Loai,DaDoc,TaoLuc,YeuCauDoiCaID\n                           FROM dbo.ThongBao WHERE DoiTuongNhan='Admin'\n                           ORDER BY TaoLuc DESC")
            return {'items': _rows(cur)}
    except Exception as e:
        raise HTTPException(503, 'Không đọc được thông báo Admin: ' + str(e))

def admin_accounts():
    """Danh sách tài khoản giảng viên; tuyệt đối không trả PasswordHash về giao diện."""
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute('SELECT gv.MaGV,gv.HoTen,gv.Email,\n                                  tk.IsActive,tk.MustChangePassword,\n                                  gv.TrangThai AS TrangThaiGiangVien,tk.CreatedAt,\n                                  tk.PasswordChangedAt,tk.LastLoginAt,\n                                  CASE WHEN tk.MaGV IS NULL THEN CAST(0 AS bit)\n                                       ELSE CAST(1 AS bit) END AS AccountStatusKnown\n                           FROM dbo.GiangVien gv\n                           LEFT JOIN dbo.TaiKhoanGiangVien tk ON tk.MaGV=gv.MaGV\n                           ORDER BY gv.HoTen,gv.MaGV')
            return {'items': _rows(cur)}
    except Exception as e:
        raise HTTPException(503, 'Không đọc được danh sách tài khoản user: ' + str(e))

def reset_user_password(ma_gv: str, x: AdminPasswordResetIn):
    """Cấp mật khẩu tạm sau khi xác thực lại Admin; không bao giờ trả mật khẩu cũ."""
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute('SELECT MatKhauHash,Salt FROM dbo.TaiKhoanAdmin WHERE TenDangNhap=?', x.username.strip())
            admin = cur.fetchone()
            if not admin:
                raise HTTPException(401, 'Tài khoản Admin không hợp lệ.')
            expected = hashlib.pbkdf2_hmac('sha256', x.current_password.encode('utf-8'), admin[1].encode('utf-8'), 260000).hex()
            if not secrets.compare_digest(expected, admin[0]):
                raise HTTPException(401, 'Mật khẩu Admin không đúng.')
            ma_gv = ma_gv.strip()
            cur.execute('SELECT 1 FROM dbo.GiangVien WHERE MaGV=?', ma_gv)
            if not cur.fetchone():
                raise HTTPException(404, 'Không tìm thấy giảng viên trong database.')
            cur.execute('SELECT 1 FROM dbo.TaiKhoanGiangVien WHERE MaGV=?', ma_gv)
            if not cur.fetchone():
                cur.execute('INSERT INTO dbo.TaiKhoanGiangVien\n                               (MaGV,PasswordHash,MustChangePassword,IsActive)\n                               VALUES (?,NULL,1,1)', ma_gv)
            temporary_password = _new_temporary_password()
            cur.execute('UPDATE dbo.TaiKhoanGiangVien\n                           SET PasswordHash=?, MustChangePassword=1, PasswordChangedAt=NULL\n                           WHERE MaGV=?', _hash_password(temporary_password), ma_gv)
            cn.commit()
            return {'ok': True, 'ma_gv': ma_gv, 'temporary_password': temporary_password}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(503, 'Không thể cấp mật khẩu tạm: ' + str(e))
