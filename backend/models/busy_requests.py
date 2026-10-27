"""Router quản lý yêu cầu báo bận của Giảng viên và điều chỉnh lịch coi thi của Admin.
Triển khai theo Phương án B: Giảng viên chỉ báo bận, Admin tự quyết định phương án điều chỉnh.
Bảo toàn thuật toán CP-SAT và các chức năng cũ.
"""

try:
    from ..schemas.busy_requests import BusyRequestCreateIn, BusyRequestNominateIn, BusyRequestApproveIn, BusyRequestRejectIn
except ImportError:
    from schemas.busy_requests import BusyRequestCreateIn, BusyRequestNominateIn, BusyRequestApproveIn, BusyRequestRejectIn

from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Depends, Query

from pydantic import BaseModel, Field

try:
    from ..ketnoi_sql import get_connection
    from ..auth_utils import require_lecturer, require_admin
except ImportError:
    from ketnoi_sql import get_connection
    from auth_utils import require_lecturer, require_admin

def _dict_rows(cur):
    if not cur.description:
        return []
    cols = [c[0] for c in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]

def _format_dt(dt):
    if dt is None:
        return None
    if isinstance(dt, datetime):
        return dt.isoformat()
    return str(dt)

def _validate_replacement_lecturer(cur, ma_gv_thay_the: str, ma_ca: str, ma_gv_cu: str) -> list[str]:
    """Kiểm tra toàn bộ ràng buộc (RB1-RB6) đối với giảng viên thay thế trước khi gán ca."""
    errors = []
    if ma_gv_thay_the == ma_gv_cu:
        return ["Giảng viên thay thế không thể là chính giảng viên báo bận."]

    # Kiểm tra giảng viên tồn tại và đang công tác
    cur.execute("SELECT HoTen, TrangThai FROM dbo.GiangVien WHERE MaGV = ?", ma_gv_thay_the)
    gv_row = cur.fetchone()
    if not gv_row:
        return [f"Giảng viên {ma_gv_thay_the} không tồn tại trong hệ thống."]
    if gv_row[1] != "Đang công tác":
        return [f"Giảng viên {gv_row[0]} ({ma_gv_thay_the}) không còn công tác."]

    # Lấy thông tin ca thi
    cur.execute("""SELECT c.MaCa, c.MaDot, c.NgayThi, c.TuTiet, c.DenTiet, c.Buoi, c.NhomHinhThucThi, c.HinhThucThi
                   FROM dbo.CaThi c WHERE c.MaCa = ?""", ma_ca)
    ca_row = cur.fetchone()
    if not ca_row:
        return ["Ca thi không tồn tại."]

    ma_dot, ngay_thi, tu_tiet, den_tiet, buoi, nhom_hinh_thuc = ca_row[1], ca_row[2], ca_row[3], ca_row[4], ca_row[5], ca_row[6]

    # Kiểm tra đã được phân công ca này chưa
    cur.execute("SELECT 1 FROM dbo.PhanCongCoiThi WHERE MaGV = ? AND MaCa = ?", ma_gv_thay_the, ma_ca)
    if cur.fetchone():
        errors.append("Giảng viên thay thế đã được phân công ca thi này rồi.")

    # RB3: Trùng ca khác cùng thời gian
    cur.execute("""SELECT c.MaCa, c.TuTiet, c.DenTiet FROM dbo.PhanCongCoiThi p
                   JOIN dbo.CaThi c ON c.MaCa = p.MaCa
                   WHERE p.MaGV = ? AND c.MaCa <> ? AND c.NgayThi = ?
                     AND c.TuTiet <= ? AND ? <= c.DenTiet""",
                ma_gv_thay_the, ma_ca, ngay_thi, den_tiet, tu_tiet)
    conflict_ca = cur.fetchone()
    if conflict_ca:
        errors.append(f"[RB3] Trùng thời gian với ca {conflict_ca[0]} (tiết {conflict_ca[1]}–{conflict_ca[2]}).")

    # RB4: Trùng lịch dạy
    cur.execute("""SELECT TuTiet, DenTiet FROM dbo.LichDayGV
                   WHERE MaGV = ? AND NgayDay = ?
                     AND TuTiet <= ? AND ? <= DenTiet""",
                ma_gv_thay_the, ngay_thi, den_tiet, tu_tiet)
    conflict_day = cur.fetchone()
    if conflict_day:
        errors.append(f"[RB4] Trùng lịch giảng dạy (tiết {conflict_day[0]}–{conflict_day[1]}).")

    # RB6: Trùng lịch bận mức 1 (bắt buộc né)
    cur.execute("""SELECT TuTiet, DenTiet, LyDo FROM dbo.LichBanGV
                   WHERE MaGV = ? AND UuTien = 1 AND NgayBan = ?
                     AND TuTiet <= ? AND ? <= DenTiet""",
                ma_gv_thay_the, ngay_thi, den_tiet, tu_tiet)
    conflict_ban = cur.fetchone()
    if conflict_ban:
        errors.append(f"[RB6] Trùng lịch bận mức 1: {conflict_ban[2]} (tiết {conflict_ban[0]}–{conflict_ban[1]}).")

    # RB5: Không trộn nhóm hình thức thi trong cùng một buổi
    cur.execute("""SELECT c.MaCa, c.HinhThucThi FROM dbo.PhanCongCoiThi p
                   JOIN dbo.CaThi c ON c.MaCa = p.MaCa
                   WHERE p.MaGV = ? AND c.MaDot = ? AND c.NgayThi = ? AND c.Buoi = ?
                     AND c.MaCa <> ? AND c.NhomHinhThucThi <> ?""",
                ma_gv_thay_the, ma_dot, ngay_thi, buoi, ma_ca, nhom_hinh_thuc)
    conflict_nhom = cur.fetchone()
    if conflict_nhom:
        errors.append(f"[RB5] Trộn hình thức thi trong cùng buổi (ca {conflict_nhom[0]} hình thức {conflict_nhom[1]}).")

    # RB1: Định mức trong khoảng cho phép ±1 ca
    cur.execute("""SELECT ISNULL(dm.SoCaQuyDinh, 0),
                          (SELECT COUNT(*) FROM dbo.PhanCongCoiThi p
                           JOIN dbo.CaThi c ON c.MaCa = p.MaCa
                           WHERE p.MaGV = ? AND c.MaDot = ?),
                          ISNULL(cfg.DoLechDinhMucChoPhep, 1)
                   FROM dbo.GiangVien gv
                   LEFT JOIN dbo.DinhMucPhanCong dm ON dm.MaDot = ? AND dm.MaGV = gv.MaGV
                   LEFT JOIN dbo.CauHinhXepLich cfg ON cfg.MaDot = ?
                   WHERE gv.MaGV = ?""",
                ma_gv_thay_the, ma_dot, ma_dot, ma_dot, ma_gv_thay_the)
    quota_row = cur.fetchone()
    if quota_row:
        dinh_muc, da_co, do_lech = quota_row[0], quota_row[1], quota_row[2]
        if dinh_muc == 0 and (da_co + 1) > 0:
            errors.append(f"[RB1] Giảng viên có định mức bằng 0, không được phân công ca thi.")
        elif dinh_muc > 0 and (da_co + 1) > (dinh_muc + do_lech):
            errors.append(f"[RB1] Vượt quá định mức tối đa cho phép ({da_co + 1} ca so với định mức {dinh_muc} ±{do_lech}).")

    return errors

def get_my_busy_requests(ma_gv: str=None):
    """Lấy danh sách các yêu cầu báo bận của chính giảng viên đang đăng nhập."""
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute('\n                SELECT y.MaYeuCau, y.MaGV, y.MaCa,\n                       CONVERT(varchar(19), y.ThoiGianBatDauBan, 120) AS ThoiGianBatDauBan,\n                       CONVERT(varchar(19), y.ThoiGianKetThucBan, 120) AS ThoiGianKetThucBan,\n                       y.LyDoBaoBan, y.GhiChuGV, y.TrangThai, y.LyDoTuChoi, y.GhiChuAdmin,\n                       y.NguoiXuLy,\n                       CONVERT(varchar(19), y.ThoiGianGui, 120) AS ThoiGianGui,\n                       CONVERT(varchar(19), y.ThoiGianXuLy, 120) AS ThoiGianXuLy,\n                       c.NgayThi, c.Thu, c.TuTiet, c.DenTiet, c.Buoi, c.PhongThi, c.HinhThucThi,\n                       y.MaGVThayTheDeNghi, gvde.HoTen AS TenGVThayTheDeNghi,\n                       y.TrangThaiXacNhanThayThe, y.ThoiGianPhanHoiThayThe,\n                       ls.MaGVThayThe, gvtt.HoTen AS TenGVThayThe, ls.PhanCongSau\n                FROM dbo.YeuCauBaoBan y\n                LEFT JOIN dbo.CaThi c ON c.MaCa = y.MaCa\n                LEFT JOIN dbo.GiangVien gvde ON gvde.MaGV = y.MaGVThayTheDeNghi\n                LEFT JOIN dbo.LichSuDieuChinhLich ls ON ls.MaYeuCau = y.MaYeuCau\n                LEFT JOIN dbo.GiangVien gvtt ON gvtt.MaGV = ls.MaGVThayThe\n                WHERE y.MaGV = ?\n                ORDER BY y.ThoiGianGui DESC\n            ', ma_gv)
            items = _dict_rows(cur)
            cur.execute('''
                SELECT y.MaYeuCau
                FROM dbo.YeuCauBaoBan y
                OUTER APPLY (
                    SELECT MAX(t.TaoLuc) AS LastInviteAt
                    FROM dbo.ThongBao t
                    WHERE t.YeuCauBaoBanID = y.MaYeuCau
                      AND t.MaGVNhan = y.MaGVThayTheDeNghi
                      AND t.Loai = 'BusyCoverRequested'
                ) invite
                OUTER APPLY (
                    SELECT MAX(t.TaoLuc) AS LastReminderAt
                    FROM dbo.ThongBao t
                    WHERE t.YeuCauBaoBanID = y.MaYeuCau
                      AND t.MaGVNhan = y.MaGVThayTheDeNghi
                      AND t.Loai = 'BusyCoverReminder'
                ) reminder
                WHERE y.MaGV = ?
                  AND y.TrangThai = 'PENDING'
                  AND y.MaGVThayTheDeNghi IS NOT NULL
                  AND y.TrangThaiXacNhanThayThe = 'PENDING'
                  AND invite.LastInviteAt <= DATEADD(HOUR, -24, SYSDATETIME())
                  AND (reminder.LastReminderAt IS NULL OR reminder.LastReminderAt <= DATEADD(HOUR, -24, SYSDATETIME()))
            ''', ma_gv)
            reminder_available = {int(row[0]) for row in cur.fetchall()}
            for it in items:
                it['CoTheNhacThay'] = 1 if int(it['MaYeuCau']) in reminder_available else 0
                if it.get('NgayThi'):
                    it['NgayThi'] = str(it['NgayThi'])
            return {'items': items}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f'Không thể lấy danh sách yêu cầu báo bận: {e}')

def withdraw_busy_request(request_id: int, ma_gv: str=None):
    """Người gửi rút đơn khi Admin chưa xử lý; giữ lịch sử và báo người được nhờ."""
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute('''
                SELECT y.MaGV, y.MaCa, y.TrangThai, y.MaGVThayTheDeNghi,
                       gv.HoTen, c.NgayThi, c.TuTiet, c.DenTiet
                FROM dbo.YeuCauBaoBan y WITH (UPDLOCK, HOLDLOCK)
                JOIN dbo.GiangVien gv ON gv.MaGV = y.MaGV
                LEFT JOIN dbo.CaThi c ON c.MaCa = y.MaCa
                WHERE y.MaYeuCau = ?
            ''', request_id)
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, 'Không tìm thấy đơn báo bận.')
            owner, ma_ca, status, nominee, owner_name, exam_date, start_period, end_period = row
            if owner != ma_gv:
                raise HTTPException(403, 'Bạn chỉ được rút đơn báo bận của chính mình.')
            if status != 'PENDING':
                raise HTTPException(409, 'Chỉ có thể rút đơn khi Admin chưa xử lý.')

            cur.execute('''
                UPDATE dbo.YeuCauBaoBan
                SET TrangThai = 'WITHDRAWN',
                    TrangThaiXacNhanThayThe = CASE WHEN MaGVThayTheDeNghi IS NOT NULL THEN 'WITHDRAWN' ELSE TrangThaiXacNhanThayThe END,
                    ThoiGianPhanHoiThayThe = CASE WHEN MaGVThayTheDeNghi IS NOT NULL THEN SYSDATETIME() ELSE ThoiGianPhanHoiThayThe END,
                    NguoiXuLy = CONCAT(N'Người gửi: ', ?),
                    ThoiGianXuLy = SYSDATETIME()
                WHERE MaYeuCau = ? AND MaGV = ? AND TrangThai = 'PENDING'
            ''', ma_gv, request_id, ma_gv)
            if cur.rowcount != 1:
                raise HTTPException(409, 'Đơn vừa được xử lý ở nơi khác. Hãy tải lại danh sách.')

            # Gỡ thông báo Admin cũ để tránh mở hoặc duyệt nhầm đơn đã rút.
            cur.execute("DELETE FROM dbo.ThongBao WHERE DoiTuongNhan = 'Admin' AND Loai = 'BusyRequest' AND YeuCauBaoBanID = ?", request_id)
            if nominee:
                date_text = exam_date.strftime('%d/%m/%Y') if exam_date else ''
                shift_info = f'ca {ma_ca or ""} ngày {date_text}, tiết {start_period}–{end_period}'
                nominee_message = (
                    f'{owner_name} ({owner}) đã rút đơn báo bận #{request_id} và thu hồi lời mời coi thay {shift_info}. '
                    'Bạn không cần phản hồi lời mời này nữa; lịch coi thi vẫn giữ nguyên.'
                )
                cur.execute('''
                    INSERT INTO dbo.ThongBao (MaGVNhan, DoiTuongNhan, TieuDe, NoiDung, Loai, YeuCauBaoBanID)
                    VALUES (?, 'Lecturer', N'Người gửi đã rút lời mời coi thay', ?, 'BusyCoverResolved', ?)
                ''', nominee, nominee_message, request_id)
            cn.commit()
            return {'ok': True, 'status': 'WITHDRAWN', 'ma_yeu_cau': request_id, 'message': 'Đã rút đơn báo bận. Lịch coi thi vẫn giữ nguyên.'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f'Không thể rút đơn báo bận: {e}')

def remind_nominee(request_id: int, ma_gv: str=None):
    """Nhắc người được mời sau 24 giờ chờ; giới hạn nhắc một lần mỗi 24 giờ."""
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute('''
                SELECT y.MaGV, y.MaCa, y.TrangThai, y.MaGVThayTheDeNghi,
                       y.TrangThaiXacNhanThayThe, y.LyDoBaoBan, gv.HoTen,
                       c.NgayThi, c.TuTiet, c.DenTiet,
                       invite.LastInviteAt, reminder.LastReminderAt, SYSDATETIME() AS DatabaseNow
                FROM dbo.YeuCauBaoBan y WITH (UPDLOCK, HOLDLOCK)
                JOIN dbo.GiangVien gv ON gv.MaGV = y.MaGV
                LEFT JOIN dbo.CaThi c ON c.MaCa = y.MaCa
                OUTER APPLY (
                    SELECT MAX(t.TaoLuc) AS LastInviteAt
                    FROM dbo.ThongBao t
                    WHERE t.YeuCauBaoBanID = y.MaYeuCau
                      AND t.MaGVNhan = y.MaGVThayTheDeNghi
                      AND t.Loai = 'BusyCoverRequested'
                ) invite
                OUTER APPLY (
                    SELECT MAX(t.TaoLuc) AS LastReminderAt
                    FROM dbo.ThongBao t
                    WHERE t.YeuCauBaoBanID = y.MaYeuCau
                      AND t.MaGVNhan = y.MaGVThayTheDeNghi
                      AND t.Loai = 'BusyCoverReminder'
                ) reminder
                WHERE y.MaYeuCau = ?
            ''', request_id)
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, 'Không tìm thấy đơn báo bận.')
            owner, ma_ca, status, nominee, response_status, reason, owner_name, exam_date, start_period, end_period, last_invite, last_reminder, database_now = row
            if owner != ma_gv:
                raise HTTPException(403, 'Bạn chỉ được nhắc người coi thay trong đơn của mình.')
            if status != 'PENDING' or not nominee or response_status != 'PENDING':
                raise HTTPException(409, 'Chỉ có thể nhắc khi lời mời vẫn đang chờ phản hồi.')
            if not last_invite:
                raise HTTPException(409, 'Không tìm thấy thông báo lời mời hiện tại. Hãy tải lại danh sách.')
            cooldown = database_now - timedelta(hours=24)
            if last_invite > cooldown:
                raise HTTPException(409, 'Lời mời cần chờ đủ 24 giờ trước khi gửi lời nhắc.')
            if last_reminder and last_reminder > cooldown:
                raise HTTPException(409, 'Bạn đã gửi lời nhắc gần đây. Hãy chờ đủ 24 giờ giữa các lần nhắc.')

            date_text = exam_date.strftime('%d/%m/%Y') if exam_date else ''
            shift_info = f'ca {ma_ca or ""} ngày {date_text}, tiết {start_period}–{end_period}'
            message = (
                f'{owner_name} ({owner}) nhắc bạn phản hồi lời mời coi thay {shift_info} trong đơn báo bận #{request_id}. '
                f'Lý do báo bận: {reason}. Vui lòng mở thông báo và chọn đồng ý hoặc từ chối; lịch chỉ thay đổi sau khi Admin duyệt.'
            )
            cur.execute('''
                INSERT INTO dbo.ThongBao (MaGVNhan, DoiTuongNhan, TieuDe, NoiDung, Loai, YeuCauBaoBanID)
                VALUES (?, 'Lecturer', N'Nhắc phản hồi lời mời coi thay', ?, 'BusyCoverReminder', ?)
            ''', nominee, message, request_id)
            cn.commit()
            return {'ok': True, 'ma_yeu_cau': request_id, 'message': 'Đã gửi lời nhắc cho giảng viên được nhờ.'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f'Không thể nhắc giảng viên phản hồi: {e}')

def create_busy_request(req_data: BusyRequestCreateIn, ma_gv: str=None):
    """Lưu đơn báo bận và, nếu được chọn, gửi lời mời coi thay trong cùng giao dịch."""
    start_dt = req_data.thoi_gian_bat_dau
    end_dt = req_data.thoi_gian_ket_thuc
    if start_dt >= end_dt:
        raise HTTPException(400, 'Thời gian bắt đầu bận phải trước thời gian kết thúc bận.')
    ma_ca = (req_data.ma_ca or '').strip() or None
    nominee = (req_data.ma_gv_thay_the or '').strip() or None
    if not ma_ca:
        raise HTTPException(400, 'Vui lòng chọn ca thi cụ thể để tiếp tục nhờ giảng viên coi thay.')
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute('SELECT c.MaCa, c.NgayThi, c.TuTiet, c.DenTiet, c.PhongThi\n                           FROM dbo.PhanCongCoiThi p\n                           JOIN dbo.CaThi c ON c.MaCa = p.MaCa\n                           WHERE p.MaGV = ? AND c.MaCa = ?', ma_gv, ma_ca)
            slot = cur.fetchone()
            if not slot:
                raise HTTPException(400, 'Ca thi được chọn hiện không còn được phân công cho bạn.')
            cur.execute("SELECT TOP 1 MaYeuCau FROM dbo.YeuCauBaoBan\n                           WHERE MaGV = ? AND MaCa = ? AND TrangThai = 'PENDING'", ma_gv, ma_ca)
            if cur.fetchone():
                raise HTTPException(409, 'Bạn đã có một yêu cầu báo bận đang chờ xử lý cho ca thi này.')
            nominee_name = None
            owner_name = None
            if nominee:
                violations = _validate_replacement_lecturer(cur, nominee, ma_ca, ma_gv)
                if violations:
                    raise HTTPException(400, detail={'message': 'Giảng viên được chọn hiện không đủ điều kiện nhận ca này.', 'violations': violations})
                cur.execute('SELECT HoTen FROM dbo.GiangVien WHERE MaGV=?', nominee)
                nominee_row = cur.fetchone()
                if not nominee_row:
                    raise HTTPException(400, 'Không tìm thấy giảng viên được chọn.')
                nominee_name = nominee_row[0]
                cur.execute('SELECT HoTen FROM dbo.GiangVien WHERE MaGV=?', ma_gv)
                owner_row = cur.fetchone()
                owner_name = owner_row[0] if owner_row else ma_gv
            cur.execute("\n                INSERT INTO dbo.YeuCauBaoBan (MaGV, MaCa, ThoiGianBatDauBan, ThoiGianKetThucBan, LyDoBaoBan, GhiChuGV, TrangThai)\n                OUTPUT INSERTED.MaYeuCau\n                VALUES (?, ?, ?, ?, ?, ?, 'PENDING')\n            ", ma_gv, ma_ca, start_dt, end_dt, req_data.ly_do.strip(), req_data.ghi_chu.strip() if req_data.ghi_chu else None)
            new_id_row = cur.fetchone()
            if not new_id_row:
                raise RuntimeError('Không lấy được mã yêu cầu vừa tạo từ SQL Server.')
            ma_yeu_cau = int(new_id_row[0])
            if nominee:
                cur.execute('''UPDATE dbo.YeuCauBaoBan
                                  SET MaGVThayTheDeNghi=?,TrangThaiXacNhanThayThe='PENDING',ThoiGianPhanHoiThayThe=NULL
                                WHERE MaYeuCau=? AND MaGV=? AND TrangThai='PENDING' ''', nominee, ma_yeu_cau, ma_gv)
                if cur.rowcount != 1:
                    raise HTTPException(409, 'Đơn báo bận vừa được cập nhật. Hãy tải lại trang.')
                date_text = slot[1].strftime('%d/%m/%Y') if slot[1] else ''
                shift_info = f'ca {ma_ca} ngày {date_text}, tiết {slot[2]}–{slot[3]}'
                note_info = f' Ghi chú của người gửi: {req_data.ghi_chu.strip()}.' if req_data.ghi_chu and req_data.ghi_chu.strip() else ''
                to_nominee = f'Giảng viên {owner_name} ({ma_gv}) đã nhờ bạn coi thay {shift_info} theo đơn báo bận #{ma_yeu_cau}. Lý do: {req_data.ly_do.strip()}.{note_info} Vui lòng chọn đồng ý hoặc từ chối lời mời. Đơn chỉ được chuyển Admin sau khi bạn đồng ý; lịch chưa thay đổi.'
                cur.execute("""INSERT INTO dbo.ThongBao (MaGVNhan,DoiTuongNhan,TieuDe,NoiDung,Loai,YeuCauBaoBanID)
                               VALUES (?,'Lecturer',N'Bạn được nhờ coi thay',?,'BusyCoverRequested',?)""", nominee, to_nominee, ma_yeu_cau)
            cn.commit()
            message = (
                f'Đã lưu đơn và gửi lời mời cho {nominee_name}. Đơn sẽ chuyển Admin sau khi giảng viên này đồng ý.'
                if nominee else 'Đã lưu đơn báo bận. Bạn có thể chọn người coi thay sau trong danh sách yêu cầu.'
            )
            return {'ok': True, 'ma_yeu_cau': ma_yeu_cau, 'status': 'PENDING', 'ma_gv_thay_the_de_nghi': nominee, 'ten_gv_thay_the_de_nghi': nominee_name, 'trang_thai_xac_nhan_thay_the': 'PENDING' if nominee else None, 'message': message}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f'Không thể gửi yêu cầu báo bận: {e}')

def get_busy_request_detail(request_id: int, ma_gv: str=None):
    """Xem chi tiết một yêu cầu báo bận của chính giảng viên đó.
    Từ chối truy cập nếu yêu cầu thuộc về giảng viên khác.
    """
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute('\n                SELECT y.MaYeuCau, y.MaGV, y.MaCa,\n                       CONVERT(varchar(19), y.ThoiGianBatDauBan, 120) AS ThoiGianBatDauBan,\n                       CONVERT(varchar(19), y.ThoiGianKetThucBan, 120) AS ThoiGianKetThucBan,\n                       y.LyDoBaoBan, y.GhiChuGV, y.TrangThai, y.LyDoTuChoi, y.GhiChuAdmin,\n                       y.NguoiXuLy,\n                       CONVERT(varchar(19), y.ThoiGianGui, 120) AS ThoiGianGui,\n                       CONVERT(varchar(19), y.ThoiGianXuLy, 120) AS ThoiGianXuLy,\n                       gv.HoTen, c.NgayThi, c.Thu, c.TuTiet, c.DenTiet, c.PhongThi, c.HinhThucThi,\n                       y.MaGVThayTheDeNghi, gvde.HoTen AS TenGVThayTheDeNghi,\n                       y.TrangThaiXacNhanThayThe, y.ThoiGianPhanHoiThayThe\n                FROM dbo.YeuCauBaoBan y\n                JOIN dbo.GiangVien gv ON gv.MaGV = y.MaGV\n                LEFT JOIN dbo.CaThi c ON c.MaCa = y.MaCa\n                LEFT JOIN dbo.GiangVien gvde ON gvde.MaGV = y.MaGVThayTheDeNghi\n                WHERE y.MaYeuCau = ?\n            ', request_id)
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, 'Không tìm thấy yêu cầu báo bận.')
            cols = [col[0] for col in cur.description]
            data = dict(zip(cols, row))
            if data['MaGV'] != ma_gv:
                raise HTTPException(403, 'Quyền truy cập bị từ chối. Bạn không thể xem yêu cầu của giảng viên khác.')
            if data.get('NgayThi'):
                data['NgayThi'] = str(data['NgayThi'])
            cur.execute('\n                SELECT ls.MaLichSu, ls.MaGVThayThe, gvtt.HoTen AS TenGVThayThe,\n                       ls.PhanCongTruoc, ls.PhanCongSau, ls.NguoiThucHien,\n                       CONVERT(varchar(19), ls.ThoiDiem, 120) AS ThoiDiem,\n                       ls.HanhDong, ls.LyDo\n                FROM dbo.LichSuDieuChinhLich ls\n                LEFT JOIN dbo.GiangVien gvtt ON gvtt.MaGV = ls.MaGVThayThe\n                WHERE ls.MaYeuCau = ?\n            ', request_id)
            data['history'] = _dict_rows(cur)
            return data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f'Không thể lấy thông tin chi tiết: {e}')

def user_get_replacement_candidates(request_id: int, ma_gv: str=None):
    """Chỉ trả về giảng viên đang đủ điều kiện nhận đúng ca trong đơn của người dùng."""
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute('\n                SELECT MaGV, MaCa, TrangThai, MaGVThayTheDeNghi, TrangThaiXacNhanThayThe\n                FROM dbo.YeuCauBaoBan\n                WHERE MaYeuCau = ?\n            ', request_id)
            req_row = cur.fetchone()
            if not req_row:
                raise HTTPException(404, 'Không tìm thấy đơn báo bận.')
            owner, ma_ca, status, nominee, nominee_response = req_row
            if owner != ma_gv:
                raise HTTPException(403, 'Bạn chỉ được chọn người coi thay cho đơn của mình.')
            if status != 'PENDING':
                raise HTTPException(409, 'Đơn báo bận này đã được Admin xử lý.')
            if not ma_ca:
                raise HTTPException(400, 'Đơn báo bận chưa gắn với ca thi cụ thể.')
            if nominee and nominee_response not in ('PENDING', 'DECLINED', 'ACCEPTED'):
                raise HTTPException(409, 'Trạng thái lời mời hiện tại không cho phép chọn người khác.')
            cur.execute("\n                SELECT gv.MaGV, gv.HoTen, bm.TenBoMon,\n                       ISNULL(dm.SoCaQuyDinh, 0) AS DinhMuc,\n                       (SELECT COUNT(*) FROM dbo.PhanCongCoiThi p\n                        JOIN dbo.CaThi c ON c.MaCa = p.MaCa\n                        WHERE p.MaGV = gv.MaGV AND c.MaDot = target.MaDot) AS DaCo\n                FROM dbo.GiangVien gv\n                JOIN dbo.BoMon bm ON bm.MaBoMon = gv.MaBoMon\n                JOIN dbo.CaThi target ON target.MaCa = ?\n                LEFT JOIN dbo.DinhMucPhanCong dm ON dm.MaDot = target.MaDot AND dm.MaGV = gv.MaGV\n                WHERE gv.TrangThai = N'Đang công tác' AND gv.MaGV <> ?\n                ORDER BY gv.HoTen\n            ", ma_ca, owner)
            candidates = []
            for item in _dict_rows(cur):
                if nominee_response in ('PENDING', 'ACCEPTED') and str(item['MaGV']).casefold() == str(nominee).casefold():
                    continue
                violations = _validate_replacement_lecturer(cur, item['MaGV'], ma_ca, owner)
                if not violations:
                    candidates.append({'MaGV': item['MaGV'], 'HoTen': item['HoTen'], 'TenBoMon': item['TenBoMon'], 'DinhMuc': item['DinhMuc'], 'DaCo': item['DaCo']})
            candidates.sort(key=lambda x: (x['DaCo'], x['HoTen']))
            return {'candidates': candidates, 'ma_ca': ma_ca}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f'Lỗi tìm giảng viên đủ điều kiện: {e}')

def user_get_replacement_candidates_for_shift(ma_ca: str, ma_gv: str=None):
    """Lấy danh sách đủ điều kiện ngay trong form báo bận, trước khi tạo đơn."""
    ma_ca = (ma_ca or '').strip()
    if not ma_ca:
        raise HTTPException(400, 'Vui lòng chọn ca thi trước.')
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute('''SELECT 1 FROM dbo.PhanCongCoiThi
                           WHERE MaGV=? AND MaCa=?''', ma_gv, ma_ca)
            if not cur.fetchone():
                raise HTTPException(400, 'Ca thi được chọn hiện không còn được phân công cho bạn.')
            cur.execute("""SELECT gv.MaGV,gv.HoTen,bm.TenBoMon,
                                  ISNULL(dm.SoCaQuyDinh,0) AS DinhMuc,
                                  (SELECT COUNT(*) FROM dbo.PhanCongCoiThi p
                                   JOIN dbo.CaThi c ON c.MaCa=p.MaCa
                                   WHERE p.MaGV=gv.MaGV AND c.MaDot=target.MaDot) AS DaCo
                           FROM dbo.GiangVien gv
                           JOIN dbo.BoMon bm ON bm.MaBoMon=gv.MaBoMon
                           JOIN dbo.CaThi target ON target.MaCa=?
                           LEFT JOIN dbo.DinhMucPhanCong dm ON dm.MaDot=target.MaDot AND dm.MaGV=gv.MaGV
                           WHERE gv.TrangThai=N'Đang công tác' AND gv.MaGV<>?
                           ORDER BY gv.HoTen,gv.MaGV""", ma_ca, ma_gv)
            candidates = []
            for item in _dict_rows(cur):
                if not _validate_replacement_lecturer(cur, item['MaGV'], ma_ca, ma_gv):
                    candidates.append({'MaGV': item['MaGV'], 'HoTen': item['HoTen'], 'TenBoMon': item['TenBoMon'], 'DinhMuc': item['DinhMuc'], 'DaCo': item['DaCo']})
            candidates.sort(key=lambda x: (x['DaCo'], x['HoTen']))
            return {'candidates': candidates, 'ma_ca': ma_ca}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f'Lỗi tìm giảng viên đủ điều kiện: {e}')

def user_request_cover(request_id: int, payload: BusyRequestNominateIn, ma_gv: str=None):
    """Gửi lời mời; chỉ chuyển Admin sau khi giảng viên được nhờ đồng ý."""
    nominee = payload.ma_gv_thay_the.strip()
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute('\n                SELECT y.MaGV, y.MaCa, y.TrangThai, y.MaGVThayTheDeNghi, y.TrangThaiXacNhanThayThe, y.LyDoBaoBan, y.GhiChuGV,\n                       gv.HoTen, c.NgayThi, c.TuTiet, c.DenTiet\n                FROM dbo.YeuCauBaoBan y WITH (UPDLOCK, HOLDLOCK)\n                JOIN dbo.GiangVien gv ON gv.MaGV = y.MaGV\n                LEFT JOIN dbo.CaThi c ON c.MaCa = y.MaCa\n                WHERE y.MaYeuCau = ?\n            ', request_id)
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, 'Không tìm thấy đơn báo bận.')
            owner, ma_ca, status, existing_nominee, nominee_response, busy_reason, owner_note, owner_name, exam_date, start_period, end_period = row
            if owner != ma_gv:
                raise HTTPException(403, 'Bạn chỉ được gửi yêu cầu coi thay cho đơn của mình.')
            if status != 'PENDING':
                raise HTTPException(409, 'Đơn báo bận này đã được Admin xử lý.')
            if not ma_ca:
                raise HTTPException(400, 'Đơn báo bận chưa gắn với ca thi cụ thể.')
            if existing_nominee and nominee_response not in ('PENDING', 'DECLINED', 'ACCEPTED'):
                raise HTTPException(409, 'Trạng thái lời mời hiện tại không cho phép chọn người khác.')
            if existing_nominee and str(existing_nominee).casefold() == str(nominee).casefold() and nominee_response in ('PENDING', 'ACCEPTED'):
                raise HTTPException(409, 'Giảng viên này đã được nhờ. Hãy chọn một giảng viên khác.')
            violations = _validate_replacement_lecturer(cur, nominee, ma_ca, owner)
            if violations:
                raise HTTPException(400, detail={'message': 'Giảng viên được chọn hiện không đủ điều kiện nhận ca này.', 'violations': violations})
            cur.execute('SELECT HoTen FROM dbo.GiangVien WHERE MaGV = ?', nominee)
            nominee_row = cur.fetchone()
            if not nominee_row:
                raise HTTPException(400, 'Không tìm thấy giảng viên được chọn.')
            nominee_name = nominee_row[0]
            date_text = exam_date.strftime('%d/%m/%Y') if exam_date else ''
            shift_info = f'ca {ma_ca} ngày {date_text}, tiết {start_period}–{end_period}'
            cur.execute("\n                UPDATE dbo.YeuCauBaoBan\n                SET MaGVThayTheDeNghi = ?, TrangThaiXacNhanThayThe = 'PENDING', ThoiGianPhanHoiThayThe = NULL\n                WHERE MaYeuCau = ? AND MaGV = ? AND TrangThai = 'PENDING'\n                  AND (MaGVThayTheDeNghi IS NULL OR TrangThaiXacNhanThayThe IN ('PENDING', 'DECLINED', 'ACCEPTED'))\n            ", nominee, request_id, owner)
            if cur.rowcount != 1:
                raise HTTPException(409, 'Đơn báo bận vừa được cập nhật. Hãy tải lại trang.')
            if existing_nominee:
                # The previous Admin notice refers to a nominee who is no longer current.
                cur.execute("DELETE FROM dbo.ThongBao WHERE DoiTuongNhan = 'Admin' AND Loai = 'BusyRequest' AND YeuCauBaoBanID = ?", request_id)
                if nominee_response in ('PENDING', 'ACCEPTED'):
                    cur.execute("""
                        INSERT INTO dbo.ThongBao (MaGVNhan, DoiTuongNhan, TieuDe, NoiDung, Loai, YeuCauBaoBanID)
                        VALUES (?, 'Lecturer', N'Lời mời coi thay đã được thu hồi', ?, 'BusyCoverResolved', ?)
                    """, existing_nominee,
                        f'Lời mời coi thay ca {ma_ca} trong đơn #{request_id} đã được người gửi chuyển cho giảng viên khác. Bạn không còn được đề nghị nhận ca này; nếu bạn chưa phản hồi thì không cần thực hiện thêm thao tác.',
                        request_id)
            note_info = f' Ghi chú của người gửi: {owner_note}.' if owner_note else ''
            to_nominee = f'Giảng viên {owner_name} ({owner}) đã nhờ bạn coi thay {shift_info} theo đơn báo bận #{request_id}. Lý do: {busy_reason}.{note_info} Vui lòng chọn đồng ý hoặc từ chối lời mời. Đơn chỉ được chuyển Admin sau khi bạn đồng ý; lịch chưa thay đổi.'
            cur.execute("\n                INSERT INTO dbo.ThongBao (MaGVNhan, DoiTuongNhan, TieuDe, NoiDung, Loai, YeuCauBaoBanID)\n                VALUES (?, 'Lecturer', N'Bạn được nhờ coi thay', ?, 'BusyCoverRequested', ?)\n            ", nominee, to_nominee, request_id)
            sent_message = (
                f'Đã thu hồi lời mời trước và gửi lời mời mới cho {nominee_name}. Giảng viên mới cần đồng ý trước khi đơn chuyển Admin.'
                if existing_nominee and nominee_response in ('PENDING', 'ACCEPTED')
                else f'Đã gửi lời mời cho {nominee_name}. Đơn sẽ chuyển Admin sau khi giảng viên này đồng ý.'
            )
            cn.commit()
            return {'ok': True, 'status': 'PENDING', 'ma_yeu_cau': request_id, 'ma_gv_thay_the_de_nghi': nominee, 'ten_gv_thay_the_de_nghi': nominee_name, 'trang_thai_xac_nhan_thay_the': 'PENDING', 'message': sent_message}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f'Không thể gửi yêu cầu coi thay: {e}')

def user_respond_cover(request_id: int, payload, ma_gv: str=None):
    """Người được nhờ xác nhận trước; chỉ khi đồng ý mới thông báo Admin."""
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute('''
                SELECT y.MaGV, y.MaCa, y.TrangThai, y.MaGVThayTheDeNghi,
                       y.TrangThaiXacNhanThayThe, y.LyDoBaoBan, y.GhiChuGV,
                       gv.HoTen, c.NgayThi, c.TuTiet, c.DenTiet
                FROM dbo.YeuCauBaoBan y WITH (UPDLOCK, HOLDLOCK)
                JOIN dbo.GiangVien gv ON gv.MaGV = y.MaGV
                LEFT JOIN dbo.CaThi c ON c.MaCa = y.MaCa
                WHERE y.MaYeuCau = ?
            ''', request_id)
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, 'Không tìm thấy đơn báo bận.')
            owner, ma_ca, status, nominee, response_status, reason, owner_note, owner_name, exam_date, start_period, end_period = row
            if nominee != ma_gv:
                raise HTTPException(403, 'Lời mời này không gửi cho tài khoản của bạn.')
            if status != 'PENDING' or response_status != 'PENDING':
                raise HTTPException(409, 'Lời mời này đã được phản hồi hoặc đơn đã được xử lý.')

            accepted = bool(payload.chap_nhan)
            next_status = 'ACCEPTED' if accepted else 'DECLINED'
            cur.execute('''
                UPDATE dbo.YeuCauBaoBan
                SET TrangThaiXacNhanThayThe = ?, ThoiGianPhanHoiThayThe = SYSDATETIME()
                WHERE MaYeuCau = ? AND MaGVThayTheDeNghi = ? AND TrangThai = 'PENDING'
                  AND TrangThaiXacNhanThayThe = 'PENDING'
            ''', next_status, request_id, ma_gv)
            if cur.rowcount != 1:
                raise HTTPException(409, 'Lời mời vừa được xử lý ở nơi khác. Hãy tải lại thông báo.')

            # Responding to an invitation means the lecturer has read it.
            cur.execute('''
                UPDATE dbo.ThongBao
                SET DaDoc = 1
                WHERE MaGVNhan = ? AND DoiTuongNhan = 'Lecturer'
                  AND Loai = 'BusyCoverRequested' AND YeuCauBaoBanID = ?
            ''', ma_gv, request_id)

            cur.execute('SELECT HoTen FROM dbo.GiangVien WHERE MaGV = ?', ma_gv)
            nominee_name = cur.fetchone()[0]
            date_text = exam_date.strftime('%d/%m/%Y') if exam_date else ''
            shift_info = f'ca {ma_ca} ngày {date_text}, tiết {start_period}–{end_period}'
            if accepted:
                note_info = f' Ghi chú của người gửi: {owner_note}.' if owner_note else ''
                to_admin = f'Giảng viên {owner_name} ({owner}) báo bận và nhờ {nominee_name} ({ma_gv}) coi thay {shift_info}. Giảng viên được nhờ đã đồng ý. Lý do: {reason}.{note_info} Đơn #{request_id} đang chờ Admin xem xét và cập nhật lịch.'
                cur.execute("""
                    INSERT INTO dbo.ThongBao (MaGVNhan, DoiTuongNhan, TieuDe, NoiDung, Loai, YeuCauBaoBanID)
                    VALUES (NULL, 'Admin', N'Yêu cầu coi thay cần duyệt', ?, 'BusyRequest', ?)
                """, to_admin, request_id)
                to_owner = f'{nominee_name} ({ma_gv}) đã đồng ý coi thay {shift_info} trong đơn báo bận #{request_id}. Yêu cầu đã chuyển Admin duyệt; lịch chưa thay đổi.'
                title = 'Giảng viên được nhờ đã đồng ý'
                message = f'Đã đồng ý coi thay {shift_info}. Đơn đã được chuyển đến Admin duyệt; lịch chưa thay đổi.'
            else:
                to_owner = f'{nominee_name} ({ma_gv}) đã từ chối lời mời coi thay {shift_info} trong đơn báo bận #{request_id}. Người gửi có thể chọn giảng viên khác; lịch chưa thay đổi.'
                title = 'Giảng viên được nhờ từ chối'
                message = 'Đã từ chối lời mời. Người gửi sẽ được báo và có thể chọn giảng viên khác.'
            cur.execute("""
                INSERT INTO dbo.ThongBao (MaGVNhan, DoiTuongNhan, TieuDe, NoiDung, Loai, YeuCauBaoBanID)
                VALUES (?, 'Lecturer', ?, ?, 'BusyCoverResponse', ?)
            """, owner, title, to_owner, request_id)
            cn.commit()
            return {'ok': True, 'ma_yeu_cau': request_id, 'trang_thai_xac_nhan_thay_the': next_status, 'message': message}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f'Không thể ghi nhận phản hồi coi thay: {e}')

def admin_list_busy_requests(trang_thai: str | None=None, q: str | None=None, admin_user: str=None):
    """Admin xem danh sách tất cả yêu cầu báo bận, có bộ lọc và tìm kiếm."""
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            sql = "\n                SELECT y.MaYeuCau, y.MaGV, gv.HoTen, gv.Email,\n                       y.MaCa,\n                       CONVERT(varchar(19), y.ThoiGianBatDauBan, 120) AS ThoiGianBatDauBan,\n                       CONVERT(varchar(19), y.ThoiGianKetThucBan, 120) AS ThoiGianKetThucBan,\n                       y.LyDoBaoBan, y.GhiChuGV, y.TrangThai, y.LyDoTuChoi, y.GhiChuAdmin,\n                       y.NguoiXuLy,\n                       CONVERT(varchar(19), y.ThoiGianGui, 120) AS ThoiGianGui,\n                       CONVERT(varchar(19), y.ThoiGianXuLy, 120) AS ThoiGianXuLy,\n                       c.NgayThi, c.Thu, c.TuTiet, c.DenTiet, c.PhongThi, c.HinhThucThi,\n                       y.MaGVThayTheDeNghi, gvde.HoTen AS TenGVThayTheDeNghi,\n                       y.TrangThaiXacNhanThayThe, y.ThoiGianPhanHoiThayThe,\n                       ls.MaGVThayThe, gvtt.HoTen AS TenGVThayThe\n                FROM dbo.YeuCauBaoBan y\n                JOIN dbo.GiangVien gv ON gv.MaGV = y.MaGV\n                LEFT JOIN dbo.CaThi c ON c.MaCa = y.MaCa\n                LEFT JOIN dbo.LichSuDieuChinhLich ls ON ls.MaYeuCau = y.MaYeuCau\n                LEFT JOIN dbo.GiangVien gvtt ON gvtt.MaGV = ls.MaGVThayThe\n                LEFT JOIN dbo.GiangVien gvde ON gvde.MaGV = y.MaGVThayTheDeNghi\n                WHERE (y.TrangThai <> 'PENDING' OR (y.MaGVThayTheDeNghi IS NOT NULL AND y.TrangThaiXacNhanThayThe = 'ACCEPTED'))\n            "
            params = []
            if trang_thai and trang_thai.upper() != 'ALL':
                sql += ' AND y.TrangThai = ?'
                params.append(trang_thai.upper())
            if q and q.strip():
                kw = f'%{q.strip()}%'
                sql += ' AND (gv.HoTen LIKE ? OR y.MaGV LIKE ? OR y.MaCa LIKE ? OR gvde.HoTen LIKE ? OR y.MaGVThayTheDeNghi LIKE ?)'
                params.extend([kw, kw, kw, kw, kw])
            sql += "\n                ORDER BY\n                    CASE WHEN y.TrangThai = 'PENDING' THEN 0 ELSE 1 END,\n                    y.ThoiGianGui DESC\n            "
            cur.execute(sql, *params)
            items = _dict_rows(cur)
            for it in items:
                if it.get('NgayThi'):
                    it['NgayThi'] = str(it['NgayThi'])
            return {'items': items}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f'Lỗi đọc danh sách yêu cầu báo bận: {e}')

def admin_get_busy_request(request_id: int, admin_user: str=None):
    """Admin xem chi tiết yêu cầu, lịch coi thi hiện tại và các ràng buộc liên quan."""
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute('\n                SELECT y.MaYeuCau, y.MaGV, gv.HoTen, gv.Email, bm.TenBoMon, k.TenKhoa,\n                       y.MaGVThayTheDeNghi, gvde.HoTen AS TenGVThayTheDeNghi,\n                       y.TrangThaiXacNhanThayThe, y.ThoiGianPhanHoiThayThe,\n                       y.MaCa,\n                       CONVERT(varchar(19), y.ThoiGianBatDauBan, 120) AS ThoiGianBatDauBan,\n                       CONVERT(varchar(19), y.ThoiGianKetThucBan, 120) AS ThoiGianKetThucBan,\n                       y.LyDoBaoBan, y.GhiChuGV, y.TrangThai, y.LyDoTuChoi, y.GhiChuAdmin,\n                       y.NguoiXuLy,\n                       CONVERT(varchar(19), y.ThoiGianGui, 120) AS ThoiGianGui,\n                       CONVERT(varchar(19), y.ThoiGianXuLy, 120) AS ThoiGianXuLy,\n                       c.MaDot, c.NgayThi, c.Thu, c.TuTiet, c.DenTiet, c.Buoi, c.PhongThi, c.HinhThucThi, c.SoGVCanCap\n                FROM dbo.YeuCauBaoBan y\n                JOIN dbo.GiangVien gv ON gv.MaGV = y.MaGV\n                JOIN dbo.BoMon bm ON bm.MaBoMon = gv.MaBoMon\n                JOIN dbo.Khoa k ON k.MaKhoa = bm.MaKhoa\n                LEFT JOIN dbo.CaThi c ON c.MaCa = y.MaCa\n                LEFT JOIN dbo.GiangVien gvde ON gvde.MaGV = y.MaGVThayTheDeNghi\n                WHERE y.MaYeuCau = ?\n            ', request_id)
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, 'Không tìm thấy yêu cầu báo bận.')
            cols = [c[0] for c in cur.description]
            data = dict(zip(cols, row))
            if data.get('TrangThai') == 'PENDING' and (not data.get('MaGVThayTheDeNghi') or data.get('TrangThaiXacNhanThayThe') != 'ACCEPTED'):
                raise HTTPException(404, 'Chưa có yêu cầu nào chờ Admin xử lý.')
            if data.get('NgayThi'):
                data['NgayThi'] = str(data['NgayThi'])
            ma_gv = data['MaGV']
            cur.execute('\n                SELECT c.MaCa, c.MaDot, CONVERT(varchar(10), c.NgayThi, 23) AS NgayThi,\n                       c.Thu, c.TuTiet, c.DenTiet, c.Buoi, c.PhongThi, c.HinhThucThi\n                FROM dbo.PhanCongCoiThi p\n                JOIN dbo.CaThi c ON c.MaCa = p.MaCa\n                WHERE p.MaGV = ?\n                ORDER BY c.NgayThi, c.TuTiet\n            ', ma_gv)
            data['current_schedule'] = _dict_rows(cur)
            cur.execute('\n                SELECT ID, CONVERT(varchar(10), NgayDay, 23) AS NgayDay, TuTiet, DenTiet, GhiChu\n                FROM dbo.LichDayGV WHERE MaGV = ? ORDER BY NgayDay, TuTiet\n            ', ma_gv)
            data['teaching_schedule'] = _dict_rows(cur)
            cur.execute('\n                SELECT ID, CONVERT(varchar(10), NgayBan, 23) AS NgayBan, TuTiet, DenTiet, LyDo, UuTien\n                FROM dbo.LichBanGV WHERE MaGV = ? ORDER BY NgayBan, TuTiet\n            ', ma_gv)
            data['existing_busy'] = _dict_rows(cur)
            cur.execute('\n                SELECT ls.MaLichSu, ls.MaGVThayThe, gvtt.HoTen AS TenGVThayThe,\n                       ls.PhanCongTruoc, ls.PhanCongSau, ls.NguoiThucHien,\n                       CONVERT(varchar(19), ls.ThoiDiem, 120) AS ThoiDiem,\n                       ls.HanhDong, ls.LyDo\n                FROM dbo.LichSuDieuChinhLich ls\n                LEFT JOIN dbo.GiangVien gvtt ON gvtt.MaGV = ls.MaGVThayThe\n                WHERE ls.MaYeuCau = ?\n            ', request_id)
            data['history'] = _dict_rows(cur)
            return data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f'Lỗi đọc chi tiết yêu cầu: {e}')

def admin_get_replacement_candidates(request_id: int, admin_user: str=None):
    """Gợi ý và kiểm tra toàn bộ ràng buộc đối với danh sách giảng viên có thể thay thế cho ca thi."""
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute('SELECT MaGV, MaCa, TrangThai, MaGVThayTheDeNghi, TrangThaiXacNhanThayThe FROM dbo.YeuCauBaoBan WHERE MaYeuCau = ?', request_id)
            r = cur.fetchone()
            if not r:
                raise HTTPException(404, 'Không tìm thấy yêu cầu báo bận.')
            ma_gv_cu, ma_ca, trang_thai, nominee, nominee_response = (r[0], r[1], r[2], r[3], r[4])
            if not ma_ca:
                raise HTTPException(400, 'Yêu cầu báo bận chưa gắn với ca thi cụ thể nào.')
            if trang_thai == 'PENDING' and (not nominee or nominee_response != 'ACCEPTED'):
                raise HTTPException(409, 'Đơn chỉ được Admin xử lý sau khi giảng viên được nhờ đồng ý.')
            cur.execute("\n                SELECT gv.MaGV, gv.HoTen, bm.TenBoMon, k.TenKhoa,\n                       ISNULL(dm.SoCaQuyDinh, 0) AS DinhMuc,\n                       (SELECT COUNT(*) FROM dbo.PhanCongCoiThi p\n                        JOIN dbo.CaThi c ON c.MaCa = p.MaCa\n                        WHERE p.MaGV = gv.MaGV AND c.MaDot = target.MaDot) AS DaCo\n                FROM dbo.GiangVien gv\n                JOIN dbo.BoMon bm ON bm.MaBoMon = gv.MaBoMon\n                JOIN dbo.Khoa k ON k.MaKhoa = bm.MaKhoa\n                JOIN dbo.CaThi target ON target.MaCa = ?\n                LEFT JOIN dbo.DinhMucPhanCong dm ON dm.MaDot = target.MaDot AND dm.MaGV = gv.MaGV\n                WHERE gv.TrangThai = N'Đang công tác' AND gv.MaGV <> ?\n                ORDER BY gv.HoTen\n            ", ma_ca, ma_gv_cu)
            rows = _dict_rows(cur)
            candidates = []
            for item in rows:
                errs = _validate_replacement_lecturer(cur, item['MaGV'], ma_ca, ma_gv_cu)
                candidates.append({'MaGV': item['MaGV'], 'HoTen': item['HoTen'], 'TenBoMon': item['TenBoMon'], 'TenKhoa': item['TenKhoa'], 'DinhMuc': item['DinhMuc'], 'DaCo': item['DaCo'], 'HopLe': len(errs) == 0, 'ViPham': errs})
            candidates.sort(key=lambda x: (not x['HopLe'], x['DaCo']))
            return {'candidates': candidates, 'ma_ca': ma_ca}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f'Lỗi tìm giảng viên thay thế: {e}')

def admin_approve_busy_request(request_id: int, payload: BusyRequestApproveIn, admin_user: str=None):
    """Admin duyệt yêu cầu báo bận và phân công giảng viên thay thế.
    Thực hiện an toàn trong SQL Server Transaction, khóa bản ghi chống cập nhật đồng thời,
    kiểm tra toàn bộ ràng buộc và ghi lịch sử.
    """
    ma_gv_thay_the = payload.ma_gv_thay_the.strip()
    ghi_chu_admin = (payload.ghi_chu_admin or '').strip() or None
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute('\n                SELECT MaYeuCau, MaGV, MaCa, TrangThai, MaGVThayTheDeNghi, TrangThaiXacNhanThayThe\n                FROM dbo.YeuCauBaoBan WITH (UPDLOCK, HOLDLOCK)\n                WHERE MaYeuCau = ?\n            ', request_id)
            req_row = cur.fetchone()
            if not req_row:
                raise HTTPException(404, 'Không tìm thấy yêu cầu báo bận.')
            ma_gv_cu = req_row[1]
            ma_ca = req_row[2]
            trang_thai = req_row[3]
            ma_gv_duoc_nho = req_row[4]
            nominee_response = req_row[5]
            if trang_thai != 'PENDING':
                raise HTTPException(409, f'Yêu cầu này đã được xử lý trước đó với trạng thái: {trang_thai}. Không thể duyệt lại.')
            if not ma_ca:
                raise HTTPException(400, 'Yêu cầu báo bận này chưa gắn với ca thi cụ thể để điều chỉnh phân công.')
            if not ma_gv_duoc_nho or ma_gv_thay_the != ma_gv_duoc_nho or nominee_response != 'ACCEPTED':
                raise HTTPException(409, 'Chỉ có thể duyệt đúng giảng viên được nhờ sau khi người đó đã đồng ý.')
            cur.execute('\n                SELECT 1 FROM dbo.PhanCongCoiThi WITH (UPDLOCK, HOLDLOCK)\n                WHERE MaCa = ? AND MaGV = ?\n            ', ma_ca, ma_gv_cu)
            if not cur.fetchone():
                raise HTTPException(409, 'Ca thi này không còn được phân công cho giảng viên báo bận nữa.')
            violations = _validate_replacement_lecturer(cur, ma_gv_thay_the, ma_ca, ma_gv_cu)
            if violations:
                raise HTTPException(400, detail={'message': 'Phương án điều chỉnh vi phạm ràng buộc bắt buộc. Lịch chưa được cập nhật.', 'violations': violations})
            cur.execute('SELECT HoTen FROM dbo.GiangVien WHERE MaGV = ?', ma_gv_cu)
            ten_gv_cu = cur.fetchone()[0]
            cur.execute('SELECT HoTen FROM dbo.GiangVien WHERE MaGV = ?', ma_gv_thay_the)
            ten_gv_moi = cur.fetchone()[0]
            phan_cong_truoc = f'Giảng viên {ten_gv_cu} ({ma_gv_cu}) coi ca {ma_ca}'
            phan_cong_sau = f'Giảng viên {ten_gv_moi} ({ma_gv_thay_the}) thay thế coi ca {ma_ca}'
            ghi_chu_pct = f'Điều chỉnh theo yêu cầu báo bận #{request_id}'
            cur.execute('\n                UPDATE dbo.PhanCongCoiThi\n                SET MaGV = ?, GhiChu = ?\n                WHERE MaCa = ? AND MaGV = ?\n            ', ma_gv_thay_the, ghi_chu_pct, ma_ca, ma_gv_cu)
            if cur.rowcount != 1:
                raise HTTPException(500, 'Cập nhật phân công thất bại. Không có dòng nào bị ảnh hưởng.')
            cur.execute("\n                INSERT INTO dbo.LichSuDieuChinhLich (\n                    MaYeuCau, MaGV, MaGVThayThe, MaCa,\n                    PhanCongTruoc, PhanCongSau, NguoiThucHien,\n                    HanhDong, LyDo\n                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'DUYET_DOI_LICH', ?)\n            ", request_id, ma_gv_cu, ma_gv_thay_the, ma_ca, phan_cong_truoc, phan_cong_sau, admin_user, ghi_chu_admin)
            cur.execute("\n                UPDATE dbo.YeuCauBaoBan\n                SET TrangThai = 'APPROVED',\n                    NguoiXuLy = ?,\n                    ThoiGianXuLy = SYSDATETIME(),\n                    GhiChuAdmin = ?\n                WHERE MaYeuCau = ?\n            ", admin_user, ghi_chu_admin, request_id)
            tb_msg_cu = f'Yêu cầu báo bận #{request_id} của bạn đã được chấp thuận. Ca {ma_ca} đã được chuyển cho đồng nghiệp {ten_gv_moi}. Lịch coi thi của bạn đã được cập nhật.'
            cur.execute("\n                INSERT INTO dbo.ThongBao (MaGVNhan, DoiTuongNhan, TieuDe, NoiDung, Loai, YeuCauBaoBanID)\n                VALUES (?, 'Lecturer', N'Yêu cầu báo bận đã được chấp thuận', ?, 'BusyApproved', ?)\n            ", ma_gv_cu, tb_msg_cu, request_id)
            tb_msg_moi = f'Quản trị viên đã phân công bạn coi thi ca {ma_ca} thay thế cho giảng viên {ten_gv_cu} theo yêu cầu báo bận #{request_id}. Vui lòng kiểm tra lịch cá nhân.'
            cur.execute("\n                INSERT INTO dbo.ThongBao (MaGVNhan, DoiTuongNhan, TieuDe, NoiDung, Loai, YeuCauBaoBanID)\n                VALUES (?, 'Lecturer', N'Phân công coi thi mới', ?, 'BusyApproved', ?)\n            ", ma_gv_thay_the, tb_msg_moi, request_id)
            if ma_gv_duoc_nho and ma_gv_duoc_nho != ma_gv_thay_the:
                cur.execute("\n                    INSERT INTO dbo.ThongBao (MaGVNhan, DoiTuongNhan, TieuDe, NoiDung, Loai, YeuCauBaoBanID)\n                    VALUES (?, 'Lecturer', N'Yêu cầu coi thay đã được xử lý', ?, 'BusyCoverResolved', ?)\n                ", ma_gv_duoc_nho, f'Yêu cầu #{request_id} của {ten_gv_cu} đã được Admin xử lý và phân công giảng viên khác coi thay ca {ma_ca}.', request_id)
            cn.commit()
            return {'ok': True, 'status': 'APPROVED', 'message': f'Duyệt yêu cầu thành công. Đã phân công ca {ma_ca} cho {ten_gv_moi}.', 'ma_yeu_cau': request_id, 'ma_ca': ma_ca, 'ma_gv_thay_the': ma_gv_thay_the, 'ten_gv_thay_the': ten_gv_moi}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f'Không thể cập nhật lịch coi thi: {e}')

def admin_reject_busy_request(request_id: int, payload: BusyRequestRejectIn, admin_user: str=None):
    """Admin từ chối yêu cầu báo bận kèm lý do bắt buộc.
    Lịch coi thi chính thức được giữ nguyên tuyệt đối.
    """
    ly_do = payload.ly_do_tu_choi.strip()
    if not ly_do:
        raise HTTPException(400, 'Vui lòng nhập lý do từ chối yêu cầu báo bận.')
    ghi_chu_admin = (payload.ghi_chu_admin or '').strip() or None
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute('\n                SELECT MaYeuCau, MaGV, MaCa, TrangThai, MaGVThayTheDeNghi, TrangThaiXacNhanThayThe\n                FROM dbo.YeuCauBaoBan WITH (UPDLOCK, HOLDLOCK)\n                WHERE MaYeuCau = ?\n            ', request_id)
            r = cur.fetchone()
            if not r:
                raise HTTPException(404, 'Không tìm thấy yêu cầu báo bận.')
            ma_gv_cu = r[1]
            ma_ca = r[2]
            trang_thai = r[3]
            ma_gv_duoc_nho = r[4]
            nominee_response = r[5]
            if trang_thai != 'PENDING':
                raise HTTPException(409, f'Yêu cầu này đã được xử lý trước đó với trạng thái: {trang_thai}. Không thể từ chối lại.')
            if not ma_gv_duoc_nho or nominee_response != 'ACCEPTED':
                raise HTTPException(409, 'Đơn chỉ được Admin xử lý sau khi giảng viên được nhờ đồng ý.')
            cur.execute("\n                UPDATE dbo.YeuCauBaoBan\n                SET TrangThai = 'REJECTED',\n                    LyDoTuChoi = ?,\n                    GhiChuAdmin = ?,\n                    NguoiXuLy = ?,\n                    ThoiGianXuLy = SYSDATETIME()\n                WHERE MaYeuCau = ?\n            ", ly_do, ghi_chu_admin, admin_user, request_id)
            noi_dung = f'Yêu cầu báo bận #{request_id} của bạn đã bị từ chối. Lý do: {ly_do}. Lịch coi thi hiện tại của bạn được giữ nguyên.'
            cur.execute("\n                INSERT INTO dbo.ThongBao (MaGVNhan, DoiTuongNhan, TieuDe, NoiDung, Loai, YeuCauBaoBanID)\n                VALUES (?, 'Lecturer', N'Yêu cầu báo bận bị từ chối', ?, 'BusyRejected', ?)\n            ", ma_gv_cu, noi_dung, request_id)
            if ma_gv_duoc_nho:
                cur.execute("\n                    INSERT INTO dbo.ThongBao (MaGVNhan, DoiTuongNhan, TieuDe, NoiDung, Loai, YeuCauBaoBanID)\n                    VALUES (?, 'Lecturer', N'Yêu cầu coi thay đã bị từ chối', ?, 'BusyCoverRejected', ?)\n                ", ma_gv_duoc_nho, f"Yêu cầu coi thay ca {ma_ca or ''} trong đơn #{request_id} đã bị Admin từ chối. Lý do: {ly_do}.", request_id)
            cn.commit()
            return {'ok': True, 'status': 'REJECTED', 'message': 'Đã từ chối yêu cầu báo bận. Lịch coi thi được giữ nguyên.'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f'Lỗi xử lý từ chối yêu cầu: {e}')
