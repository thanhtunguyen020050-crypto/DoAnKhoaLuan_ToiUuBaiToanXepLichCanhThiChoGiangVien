from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
try:
    from .ketnoi_sql import get_connection
except ImportError:
    from ketnoi_sql import get_connection

app = FastAPI(title='API Hệ thống xếp lịch gác thi', version='2.0')
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_credentials=True, allow_methods=['*'], allow_headers=['*'])

try:
    from .routers.scheduling import router as scheduling_router
except ImportError:
    from routers.scheduling import router as scheduling_router

app.include_router(scheduling_router)

class GiangVienIn(BaseModel):
    ma_gv: str | None = None
    ho_ten: str = Field(min_length=1, max_length=120)
    don_vi: str = Field(default='CNTT', max_length=200)
    ma_bo_mon: str | None = None
    email: str | None = None
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

class DinhMucChungIn(BaseModel):
    ma_dot: str = Field(min_length=1, max_length=20)
    ty_le: float = Field(ge=0, le=100)
    ma_khoa: str | None = None

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

@app.get('/api/kiem-tra-ket-noi')
def health():
    try:
        with get_connection() as cn:
            cur=cn.cursor();cur.execute('SELECT DB_NAME(),@@SERVERNAME');r=cur.fetchone()
            return {'ok':True,'database':r[0],'server':r[1]}
    except Exception as e:raise HTTPException(503,f'Không kết nối được SQL Server: {e}')

@app.get('/api/bo-mon')
def list_departments(ma_khoa:str='CNTT'):
    try:
        with get_connection() as cn:
            cur=cn.cursor();cur.execute("SELECT MaBoMon,TenBoMon,MaKhoa FROM dbo.BoMon WHERE MaKhoa=? AND TrangThai=N'Đang hoạt động' ORDER BY TenBoMon",ma_khoa);return {'items':dict_rows(cur)}
    except Exception as e: raise HTTPException(500,f'Lỗi đọc bộ môn: {e}')

@app.get('/api/khoa/resolve')
def resolve_khoa(ten:str):
    try:
        with get_connection() as cn:
            cur=cn.cursor();cur.execute('SELECT TOP 1 MaKhoa FROM dbo.Khoa WHERE MaKhoa=? OR TenKhoa=?',ten,ten);r=cur.fetchone()
            if not r:raise HTTPException(404,'Không tìm thấy khoa.')
            return {'MaKhoa':r[0]}
    except HTTPException:raise
    except Exception as e:raise HTTPException(500,str(e))

@app.get('/api/giang-vien')
def list_lecturers(ma_dot:str|None=None):
    try:
        with get_connection() as cn:
            cur=cn.cursor();cur.execute('''
SELECT gv.MaGV,gv.HoTen,gv.HocVi,gv.ChucVu,gv.Email,gv.SoDienThoai,gv.TrangThai,
       bm.MaBoMon,bm.TenBoMon,k.MaKhoa,k.TenKhoa,
       dm.TyLeDinhMuc,dm.SoCaQuyDinh,dm.MaDot
FROM dbo.GiangVien gv
JOIN dbo.BoMon bm ON bm.MaBoMon=gv.MaBoMon
JOIN dbo.Khoa k ON k.MaKhoa=bm.MaKhoa
OUTER APPLY (SELECT TOP 1 d.MaDot,d.TyLeDinhMuc,d.SoCaQuyDinh FROM dbo.DinhMucPhanCong d WHERE d.MaGV=gv.MaGV AND (? IS NULL OR d.MaDot=?) ORDER BY d.MaDot DESC) dm
WHERE gv.TrangThai=N'Đang công tác'
ORDER BY k.TenKhoa,bm.TenBoMon,gv.HoTen''',ma_dot,ma_dot)
            return {'items':dict_rows(cur)}
    except Exception as e:raise HTTPException(500,f'Lỗi đọc GiangVien: {e}')

@app.post('/api/giang-vien')
def create_lecturer(x:GiangVienIn):
    ma=x.ma_gv or ('GV'+__import__('time').strftime('%y%m%d%H%M%S%f')[:16])
    try:
        with get_connection() as cn:
            cur=cn.cursor();bm=bomon_for_khoa(cur,x.don_vi,x.ma_bo_mon)
            if not bm:raise HTTPException(400,'Không xác định được Bộ môn từ Khoa.')
            cur.execute('EXEC dbo.sp_ThemGiangVien ?,?,?,?,?,?,?',ma,x.ho_ten,None,None,x.email,x.so_dien_thoai,bm)
            if x.ma_dot:cur.execute('EXEC dbo.sp_ThemDinhMuc ?,?,?,NULL',x.ma_dot,ma,x.ty_le)
            cn.commit();return {'ok':True,'ma_gv':ma}
    except HTTPException:raise
    except Exception as e:raise HTTPException(400,str(e))

@app.put('/api/giang-vien/{ma_gv}')
def update_lecturer(ma_gv:str,x:GiangVienIn):
    try:
        with get_connection() as cn:
            cur=cn.cursor();bm=bomon_for_khoa(cur,x.don_vi,x.ma_bo_mon)
            if not bm:raise HTTPException(400,'Không xác định được Bộ môn từ Khoa.')
            cur.execute("EXEC dbo.sp_SuaGiangVien ?,?,?,?,?,?,?,N'Đang công tác'",ma_gv,x.ho_ten,None,None,x.email,x.so_dien_thoai,bm)
            if x.ma_dot:
                cur.execute('SELECT 1 FROM dbo.DinhMucPhanCong WHERE MaDot=? AND MaGV=?',x.ma_dot,ma_gv)
                if cur.fetchone():cur.execute('EXEC dbo.sp_CapNhatTyLeDinhMuc ?,?,?',x.ma_dot,ma_gv,x.ty_le)
                else:cur.execute('EXEC dbo.sp_ThemDinhMuc ?,?,?,NULL',x.ma_dot,ma_gv,x.ty_le)
            cn.commit();return {'ok':True}
    except HTTPException:raise
    except Exception as e:raise HTTPException(400,str(e))

@app.delete('/api/giang-vien/{ma_gv}')
def delete_lecturer(ma_gv:str):
    try:
        with get_connection() as cn:cur=cn.cursor();cur.execute('EXEC dbo.sp_XoaGiangVien ?',ma_gv);cn.commit();return {'ok':True}
    except Exception as e:raise HTTPException(400,str(e))

@app.get('/api/dot-thi')
def list_exam_periods():
    try:
        with get_connection() as cn:
            cur=cn.cursor(); cur.execute('EXEC dbo.sp_DanhSachDotThi')
            return {'items':dict_rows(cur)}
    except Exception as e: raise HTTPException(500,f'Lỗi đọc đợt thi: {e}')

@app.get('/api/dot-thi/moi-nhat')
def latest_exam_period():
    try:
        with get_connection() as cn:
            cur=cn.cursor();cur.execute('SELECT TOP 1 MaDot,TenDot,HocKy,NamHoc,LoaiDot,NgayBatDau,NgayKetThuc,GhiChu FROM dbo.DotThi ORDER BY NgayBatDau DESC,MaDot DESC');r=cur.fetchone()
            return dict(zip([c[0] for c in cur.description],r)) if r else {}
    except Exception as e: raise HTTPException(500,str(e))

@app.post('/api/dot-thi')
def create_exam_period(x:DotThiIn):
    ma_dot=f'{x.hoc_ky}_{x.nam_hoc.replace("-","")}'
    ten=f'Đợt thi {x.hoc_ky} năm học {x.nam_hoc}'
    try:
        with get_connection() as cn:
            cur=cn.cursor();cur.execute('EXEC dbo.sp_ThemDotThi ?,?,?,?,?,?,?',ma_dot,ten,x.hoc_ky,x.nam_hoc,x.ngay_bat_dau,x.ngay_ket_thuc,x.ghi_chu)
            cn.commit();return {'ok':True,'ma_dot':ma_dot}
    except Exception as e: raise HTTPException(400,str(e))

@app.put('/api/dot-thi/{ma_dot}')
def update_exam_period(ma_dot:str,x:DotThiIn):
    try:
        with get_connection() as cn:
            cur=cn.cursor();cur.execute('EXEC dbo.sp_SuaDotThi ?,?,?,?,?,?,?',ma_dot,f'Đợt thi {x.hoc_ky} năm học {x.nam_hoc}',x.hoc_ky,x.nam_hoc,x.ngay_bat_dau,x.ngay_ket_thuc,x.ghi_chu);cn.commit();return {'ok':True,'ma_dot':ma_dot}
    except Exception as e: raise HTTPException(400,str(e))

@app.delete('/api/dot-thi/{ma_dot}')
def delete_exam_period(ma_dot:str):
    try:
        with get_connection() as cn:
            cur=cn.cursor();cur.execute('EXEC dbo.sp_XoaDotThi ?',ma_dot);cn.commit();return {'ok':True}
    except Exception as e: raise HTTPException(400,str(e))

@app.get('/api/ca-thi')
def list_exam_shifts(ma_dot:str|None=None):
    try:
        with get_connection() as cn:
            cur=cn.cursor();cur.execute('EXEC dbo.sp_DanhSachCaThi ?',ma_dot)
            return {'items':dict_rows(cur)}
    except Exception as e: raise HTTPException(500,f'Lỗi đọc ca thi: {e}')

def _thu_vn(date_str):
    import datetime
    d=datetime.date.fromisoformat(date_str); names=['Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7','Chủ nhật']; return names[d.weekday()]

def _drain(cur):
    while True:
        if not cur.nextset(): break

@app.post('/api/ca-thi')
def create_exam_shift(x:CaThiIn):
    import datetime
    try:
        d=datetime.date.fromisoformat(x.ngay_thi)
    except Exception: raise HTTPException(400,'Ngày thi không hợp lệ.')
    ma_dot=x.ma_dot or f'{x.hoc_ky}_{x.nam_hoc.replace("-","")}'
    try:
        with get_connection() as cn:
            cur=cn.cursor()
            cur.execute('SELECT MaDot,NgayBatDau,NgayKetThuc FROM dbo.DotThi WHERE MaDot=?',(ma_dot,)); dot=cur.fetchone()
            if not dot:
                cur.execute('EXEC dbo.sp_ThemDotThi ?,?,?,?,?,?,?',ma_dot,f'Đợt thi {x.hoc_ky} năm học {x.nam_hoc}',x.hoc_ky,x.nam_hoc,x.ngay_thi,x.ngay_thi,'Tạo tự động từ form tiếp nhận lịch thi'); _drain(cur)
            else:
                bd,kt=dot[1],dot[2]; nb=min(bd,d); nk=max(kt,d)
                if nb!=bd or nk!=kt:
                    cur.execute('SELECT HocKy,NamHoc FROM dbo.DotThi WHERE MaDot=?',ma_dot); rr=cur.fetchone()
                    cur.execute('EXEC dbo.sp_SuaDotThi ?,?,?,?,?,?,?',ma_dot,f'Đợt thi {x.hoc_ky} năm học {x.nam_hoc}',x.hoc_ky,x.nam_hoc,nb.isoformat(),nk.isoformat(),'Cập nhật tự động từ form tiếp nhận lịch thi'); _drain(cur)
            # deterministic unique key, independent of UI/localStorage
            code=f"{ma_dot}_{d.strftime('%Y%m%d')}_{x.tu_tiet:02d}_{x.den_tiet:02d}"
            cur.execute('EXEC dbo.sp_ThemCaThi ?,?,?,?,?,?,?,?,?,?',code,ma_dot,x.ngay_thi,_thu_vn(x.ngay_thi),x.tu_tiet,x.den_tiet,x.hinh_thuc_thi,x.so_gv_can_cap,None,None); _drain(cur)
            cn.commit(); return {'ok':True,'ma_ca':code,'ma_dot':ma_dot}
    except Exception as e: raise HTTPException(400,str(e))

@app.put('/api/ca-thi/{ma_ca}')
def update_exam_shift(ma_ca:str,x:CaThiIn):
    try:
        with get_connection() as cn:
            cur=cn.cursor();cur.execute('EXEC dbo.sp_SuaCaThi ?,?,?,?,?,?,?,?,?',ma_ca,x.ngay_thi,_thu_vn(x.ngay_thi),x.tu_tiet,x.den_tiet,x.hinh_thuc_thi,x.so_gv_can_cap,None,None);_drain(cur);cn.commit();return {'ok':True}
    except Exception as e: raise HTTPException(400,str(e))

@app.delete('/api/ca-thi/{ma_ca}')
def delete_exam_shift(ma_ca:str):
    try:
        with get_connection() as cn:
            cur=cn.cursor();cur.execute('EXEC dbo.sp_XoaCaThi ?',ma_ca);_drain(cur);cn.commit();return {'ok':True}
    except Exception as e: raise HTTPException(400,str(e))

@app.post('/api/dinh-muc/dat-chung')
def set_common_quota(x:DinhMucChungIn):
    try:
        with get_connection() as cn:
            cur=cn.cursor();cur.execute('EXEC dbo.sp_DatDinhMucChung ?,?,?',x.ma_dot,x.ty_le,x.ma_khoa)
            # bỏ qua các result set trung gian do sp_TinhDinhMucTheoTyLe trả về
            result={}
            while True:
                if cur.description:
                    cols=[c[0] for c in cur.description];rows=cur.fetchall()
                    if rows and 'TongNhuCau' in cols:result=dict(zip(cols,rows[-1]))
                if not cur.nextset():break
            cn.commit();return result or {'MaDot':x.ma_dot}
    except Exception as e:raise HTTPException(400,str(e))

@app.get('/api/lich-day/{ma_gv}')
def teaching_schedule(ma_gv:str):
    try:
        with get_connection() as cn:
            cur=cn.cursor()
            cur.execute('SELECT ID,CONVERT(varchar(10),NgayDay,23) NgayDay,TuTiet,DenTiet,NguonFile,GhiChu FROM dbo.LichDayGV WHERE MaGV=? ORDER BY NgayDay,TuTiet,DenTiet',ma_gv)
            return {'items':dict_rows(cur)}
    except Exception as e: raise HTTPException(500,f'Lỗi đọc lịch dạy: {e}')

@app.put('/api/lich-day/{ma_gv}')
def replace_teaching(ma_gv:str,items:list[dict]):
    try:
        with get_connection() as cn:
            cur=cn.cursor()
            cur.execute("SELECT 1 FROM dbo.GiangVien WHERE MaGV=? AND TrangThai=N'Đang công tác'",ma_gv)
            if not cur.fetchone(): raise HTTPException(404,'Giảng viên không tồn tại hoặc không còn công tác.')
            cur.execute('DELETE FROM dbo.LichDayGV WHERE MaGV=?',ma_gv)
            for x in items:
                cur.execute('EXEC dbo.sp_ThemLichDayGV ?,?,?,?,?,?',ma_gv,x['ngay_day'],x['tu_tiet'],x['den_tiet'],x.get('nguon_file'),x.get('ghi_chu'))
            cn.commit(); return {'ok':True,'count':len(items)}
    except HTTPException: raise
    except Exception as e: raise HTTPException(400,f'Lỗi lưu lịch dạy: {e}')

@app.post('/api/lich-day/import')
def import_teaching(rows:list[LichDayImportRow], filename:str|None=None):
    if not rows: raise HTTPException(400,'File không có dữ liệu lịch dạy hợp lệ.')
    try:
        with get_connection() as cn:
            cur=cn.cursor()
            cur.execute("SELECT MaGV,HoTen FROM dbo.GiangVien WHERE TrangThai=N'Đang công tác'")
            db=cur.fetchall(); by_name={}
            for ma,ten in db: by_name.setdefault(ten.strip().casefold(),[]).append((ma,ten))
            grouped={}; errors=[]
            for r in rows:
                matches=by_name.get(r.name.strip().casefold(),[])
                if not matches:
                    errors.append({'line':r.line,'name':r.name,'msg':'Không tìm thấy giảng viên này trong CSDL. Hãy thêm giảng viên trước khi import lịch dạy.'}); continue
                if len(matches)>1:
                    errors.append({'line':r.line,'name':r.name,'msg':'Tên giảng viên bị trùng trong CSDL, không thể xác định MaGV.'}); continue
                grouped.setdefault(matches[0][0],[]).append(r)
            if errors: raise HTTPException(status_code=400,detail={'message':'Import lịch dạy bị từ chối vì có giảng viên chưa khớp CSDL.','errors':errors})
            total_inserted=0
            for ma,items in grouped.items():
                cur.execute('DELETE FROM dbo.LichDayGV WHERE MaGV=?',ma)
                # Dedup: cùng GV + cùng ngày + cùng tiết chỉ INSERT 1 lần
                # (file Excel có thể liệt kê cùng GV dạy nhiều lớp khác nhau cùng slot)
                seen=set()
                for r in items:
                    key=(r.date,r.start,r.end)
                    if key in seen: continue
                    seen.add(key)
                    cur.execute('EXEC dbo.sp_ThemLichDayGV ?,?,?,?,?,?',ma,r.date,r.start,r.end,filename,None)
                    total_inserted+=1
            cn.commit(); return {'ok':True,'teachers':len(grouped),'rows':total_inserted,'duplicates_skipped':len(rows)-total_inserted}
    except HTTPException: raise
    except Exception as e: raise HTTPException(400,f'Lỗi import lịch dạy: {e}')

@app.get('/api/lich-ban/{ma_gv}')
def busy_schedule(ma_gv:str):
    try:
        with get_connection() as cn:
            cur=cn.cursor()
            cur.execute('''
SELECT ID,CONVERT(varchar(10),NgayBan,23) NgayBan,TuTiet,DenTiet,LyDo
FROM dbo.LichBanGV WHERE MaGV=? ORDER BY NgayBan,TuTiet
''',ma_gv)
            rows=dict_rows(cur)
            for x in rows:
                # Dữ liệu cũ có thể chưa có lý do: coi là mức 3 (mềm nhất), không biến thành hard constraint.
                x['UuTien']=BUSY_REASONS.get(x.get('LyDo'), 3)
            return {'items':rows}
    except Exception as e: raise HTTPException(500,f'Lỗi đọc lịch bận: {e}')

@app.put('/api/lich-ban/{ma_gv}')
def replace_busy(ma_gv:str,items:list[dict]):
    try:
        with get_connection() as cn:
            cur=cn.cursor()
            cur.execute("SELECT 1 FROM dbo.GiangVien WHERE MaGV=? AND TrangThai=N'Đang công tác'",ma_gv)
            if not cur.fetchone(): raise HTTPException(404,'Giảng viên không tồn tại hoặc không còn công tác.')
            cur.execute('DELETE FROM dbo.LichBanGV WHERE MaGV=?',ma_gv)
            for x in items:
                ly_do=x.get('ly_do')
                if ly_do not in BUSY_REASONS and ly_do is not None:
                    raise HTTPException(400,'Lý do lịch bận không hợp lệ.')
                cur.execute('EXEC dbo.sp_ThemLichBanGV ?,?,?,?,?',ma_gv,x['ngay_ban'],x['tu_tiet'],x['den_tiet'],ly_do)
            cn.commit(); return {'ok':True,'count':len(items)}
    except HTTPException: raise
    except Exception as e: raise HTTPException(400,f'Lỗi lưu lịch bận: {e}')

@app.post('/api/lich-ban/import')
def import_busy(rows:list[LichBanImportRow], filename:str|None=None):
    import datetime
    if not rows:
        raise HTTPException(400,'File không có dữ liệu lịch bận hợp lệ.')
    allowed_sessions={'Sáng':(1,6),'Chiều':(7,12),'Cả ngày':(1,12)}
    try:
        with get_connection() as cn:
            cur=cn.cursor()
            cur.execute("SELECT MaGV,HoTen FROM dbo.GiangVien WHERE TrangThai=N'Đang công tác'")
            db=cur.fetchall()
            by_name={}
            for ma,ten in db:
                by_name.setdefault(_norm_name(ten),[]).append((ma,ten))

            errors=[]
            parsed=[]
            for r in rows:
                try:
                    d=datetime.date.fromisoformat(r.date)
                except Exception:
                    errors.append({'line':r.line,'name':r.name,'msg':'Ngày không hợp lệ. Hệ thống cần ngày thực tế, ví dụ 22/1/2026 hoặc 22/01/2026.'})
                    continue
                if r.session not in allowed_sessions:
                    errors.append({'line':r.line,'name':r.name,'msg':'Buổi phải là Sáng, Chiều hoặc Cả ngày.'})
                    continue
                if r.reason not in BUSY_REASONS:
                    errors.append({'line':r.line,'name':r.name,'msg':'Lý do không nằm trong 3 lý do được phép.'})
                    continue
                matches=by_name.get(_norm_name(r.name),[])
                if not matches:
                    errors.append({'line':r.line,'name':r.name,'msg':'Không tìm thấy giảng viên này trong CSDL. Kiểm tra lại Họ tên.'})
                    continue
                if len(matches)>1:
                    errors.append({'line':r.line,'name':r.name,'msg':'Tên giảng viên bị trùng trong CSDL, không thể xác định MaGV.'})
                    continue
                parsed.append((matches[0][0],matches[0][1],d,r.session,r.reason,r.line))

            if errors:
                raise HTTPException(status_code=400,detail={
                    'message':'Import lịch bận bị từ chối vì có dòng không hợp lệ. Không thay đổi dữ liệu SQL.',
                    'errors':errors
                })

            # Chuẩn hóa: 1 GV + 1 ngày + 1 buổi chỉ giữ lý do có mức ưu tiên cao nhất.
            # Cả ngày = hai block Sáng/Chiều.
            grouped={}
            for ma,ten,d,session,reason,line in parsed:
                sessions=['Sáng','Chiều'] if session=='Cả ngày' else [session]
                for ses in sessions:
                    key=(ma,d.isoformat(),ses)
                    old=grouped.get(key)
                    if old is None or BUSY_REASONS[reason] < BUSY_REASONS[old[4]]:
                        grouped[key]=(ma,ten,d,ses,reason,line)

            teachers=sorted({x[0] for x in grouped.values()})
            for ma in teachers:
                cur.execute('DELETE FROM dbo.LichBanGV WHERE MaGV=?',ma)

            for ma,ten,d,ses,reason,line in grouped.values():
                start,end=allowed_sessions[ses]
                cur.execute('EXEC dbo.sp_ThemLichBanGV ?,?,?,?,?',ma,d.isoformat(),start,end,reason)

            cn.commit()
            return {
                'ok':True,
                'teachers':len(teachers),
                'rows':len(grouped),
                'input_rows':len(rows),
                'matched_names':len({x[1] for x in grouped.values()}),
                'message':'Import lịch bận thành công. Chỉ thay thế lịch bận của các giảng viên có trong file.'
            }
    except HTTPException: raise
    except Exception as e: raise HTTPException(400,f'Lỗi import lịch bận: {e}')
