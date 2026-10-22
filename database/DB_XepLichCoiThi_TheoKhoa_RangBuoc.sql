/*
    HỆ THỐNG QUẢN LÝ VÀ XẾP LỊCH COI THI - SQL SERVER
    Bản cài đặt tổng hợp, sắp xếp theo nhóm chức năng.

    Yêu cầu SQL Server 2019 trở lên.

    RÀNG BUỘC CỨNG:
      RB1  Định mức dương được lệch tối đa ±1 ca; định mức 0 không nhận ca.
      RB2  Mỗi ca có đúng số giảng viên cần cấp.
      RB3  Giảng viên không bị xếp hai ca trùng tiết trong cùng ngày.
      RB4  Không xếp giám thị trùng lịch dạy.
      RB5  Không trộn nhóm hình thức thi trong cùng ngày và buổi.
      RB6  Không xếp trùng lịch bận ưu tiên 1.

    TIÊU CHÍ MỀM:
      MT1  Giảm khoảng trống (ca gãy) trong lịch của giảng viên.
      MT2  Hạn chế xếp trùng lịch bận ưu tiên 2-3; mục tiêu và ngưỡng đạt
           được cấu hình theo từng đợt thi.

    CẢNH BÁO: Đây là script cài lại database từ đầu, không phải migration.
    Nếu DB_XepLichCoiThi_Final đã tồn tại, script sẽ xóa toàn bộ database đó
    rồi tạo lại. Hãy sao lưu trước nếu cần giữ dữ liệu.
*/

USE master;
GO
IF DB_ID(N'DB_XepLichCoiThi_Final') IS NOT NULL
BEGIN
    ALTER DATABASE DB_XepLichCoiThi_Final SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE DB_XepLichCoiThi_Final;
END;
GO
CREATE DATABASE DB_XepLichCoiThi_Final COLLATE Latin1_General_100_CI_AS_SC_UTF8;
GO
USE DB_XepLichCoiThi_Final;
GO
CREATE TABLE Khoa (
    MaKhoa VARCHAR(20) NOT NULL,
    TenKhoa NVARCHAR(200) NOT NULL,
    Email VARCHAR(150) NULL,
    TrangThai NVARCHAR(30) NOT NULL CONSTRAINT DF_Khoa_TrangThai DEFAULT N'Đang hoạt động',
    CONSTRAINT PK_Khoa PRIMARY KEY (MaKhoa),
    CONSTRAINT UQ_Khoa_Ten UNIQUE (TenKhoa)
);
GO

CREATE TABLE BoMon (
    MaBoMon VARCHAR(20) NOT NULL,
    MaKhoa VARCHAR(20) NOT NULL,
    TenBoMon NVARCHAR(200) NOT NULL,
    TrangThai NVARCHAR(30) NOT NULL CONSTRAINT DF_BoMon_TrangThai DEFAULT N'Đang hoạt động',
    CONSTRAINT PK_BoMon PRIMARY KEY (MaBoMon),
    CONSTRAINT UQ_BoMon_Khoa_Ten UNIQUE (MaKhoa, TenBoMon),
    CONSTRAINT FK_BoMon_Khoa FOREIGN KEY (MaKhoa) REFERENCES Khoa(MaKhoa)
);
GO

CREATE INDEX IX_BoMon_MaKhoa ON BoMon(MaKhoa);
GO

CREATE TABLE GiangVien (
    MaGV VARCHAR(20) NOT NULL,
    HoTen NVARCHAR(120) NOT NULL,
    HocVi NVARCHAR(100) NULL,
    ChucVu NVARCHAR(200) NULL,
    Email VARCHAR(150) NULL,
    SoDienThoai VARCHAR(30) NULL,
    MaBoMon VARCHAR(20) NOT NULL,
    TrangThai NVARCHAR(30) NOT NULL CONSTRAINT DF_GV_TrangThai DEFAULT N'Đang công tác',
    CONSTRAINT PK_GiangVien PRIMARY KEY (MaGV),
    CONSTRAINT FK_GV_BoMon FOREIGN KEY (MaBoMon) REFERENCES BoMon(MaBoMon),
    CONSTRAINT CK_GV_TrangThai CHECK (TrangThai IN (N'Đang công tác', N'Tạm nghỉ', N'Ngừng công tác'))
);
GO
CREATE INDEX IX_GiangVien_MaBoMon ON GiangVien(MaBoMon);
GO

CREATE TABLE DotThi (
    MaDot VARCHAR(20) NOT NULL,
    TenDot NVARCHAR(200) NOT NULL,
    HocKy VARCHAR(3) NOT NULL CONSTRAINT DF_DotThi_HocKy DEFAULT 'HK1',
    NamHoc VARCHAR(9) NOT NULL CONSTRAINT DF_DotThi_NamHoc DEFAULT '2023-2024',
    LoaiDot VARCHAR(3) NOT NULL CONSTRAINT DF_DotThi_LoaiDot DEFAULT 'HK1',
    NgayBatDau DATE NOT NULL,
    NgayKetThuc DATE NOT NULL,
    GhiChu NVARCHAR(500) NULL,
    CONSTRAINT PK_DotThi PRIMARY KEY (MaDot),
    CONSTRAINT CK_DotThi_Ngay CHECK (NgayKetThuc >= NgayBatDau),
    CONSTRAINT CK_DotThi_HocKy CHECK (HocKy IN ('HK1','HK2','HKH')),
    CONSTRAINT CK_DotThi_LoaiDot CHECK (LoaiDot IN ('HK1','HK2','HKH'))
);
GO

CREATE TABLE CauHinhXepLich (
    MaDot VARCHAR(20) NOT NULL,
    SoTietGapToiThieuCaGay INT NOT NULL CONSTRAINT DF_CFG_CaGay DEFAULT 1,
    DoLechDinhMucChoPhep INT NOT NULL CONSTRAINT DF_CFG_Lech DEFAULT 1,
    TyLeNeLichBanToiThieu DECIMAL(5,2) NOT NULL CONSTRAINT DF_CFG_NeMin DEFAULT 70,
    TyLeNeLichBanMucTieu DECIMAL(5,2) NOT NULL CONSTRAINT DF_CFG_NeTarget DEFAULT 90,
    CONSTRAINT PK_CauHinh PRIMARY KEY (MaDot),
    CONSTRAINT FK_CFG_Dot FOREIGN KEY (MaDot) REFERENCES DotThi(MaDot) ON DELETE CASCADE,
    CONSTRAINT CK_CFG CHECK (
        SoTietGapToiThieuCaGay BETWEEN 1 AND 16 AND
        DoLechDinhMucChoPhep = 1 AND
        TyLeNeLichBanToiThieu BETWEEN 0 AND 100 AND
        TyLeNeLichBanMucTieu BETWEEN 0 AND 100 AND
        TyLeNeLichBanToiThieu <= TyLeNeLichBanMucTieu
    )
);
GO

/* Lịch dạy cố định: IMPORT từ lịch giảng dạy chính thức. Hard constraint 100%, tuyệt đối không xếp gác trùng. */
CREATE TABLE LichDayGV (
    ID INT IDENTITY(1,1) NOT NULL,
    MaGV VARCHAR(20) NOT NULL,
    NgayDay DATE NOT NULL,
    TuTiet INT NOT NULL,
    DenTiet INT NOT NULL,
    NguonFile NVARCHAR(255) NULL,
    GhiChu NVARCHAR(255) NULL,
    CONSTRAINT PK_LichDayGV PRIMARY KEY(ID),
    CONSTRAINT FK_LichDayGV_GV FOREIGN KEY(MaGV) REFERENCES GiangVien(MaGV) ON DELETE CASCADE,
    CONSTRAINT CK_LichDayGV_Tiet CHECK(TuTiet BETWEEN 1 AND 16 AND DenTiet BETWEEN TuTiet AND 16),
    CONSTRAINT UQ_LichDayGV UNIQUE(MaGV,NgayDay,TuTiet,DenTiet)
);
GO
CREATE INDEX IX_LichDayGV_GV_Ngay ON LichDayGV(MaGV,NgayDay,TuTiet,DenTiet);
GO

/* Lịch bận phát sinh: đám tiệc, việc gia đình, người nhà bệnh... Soft constraint, cố gắng né. */
CREATE TABLE LichBanGV (
    ID INT IDENTITY(1,1) NOT NULL,
    MaGV VARCHAR(20) NOT NULL,
    NgayBan DATE NOT NULL,
    TuTiet INT NOT NULL,
    DenTiet INT NOT NULL,
    LyDo NVARCHAR(255) NULL,
    UuTien TINYINT NOT NULL CONSTRAINT DF_LBGV_UuTien DEFAULT 3,
    CONSTRAINT PK_LichBanGV PRIMARY KEY(ID),
    CONSTRAINT FK_LBGV_GV FOREIGN KEY(MaGV) REFERENCES GiangVien(MaGV) ON DELETE CASCADE,
    CONSTRAINT CK_LBGV_Tiet CHECK(TuTiet BETWEEN 1 AND 16 AND DenTiet BETWEEN TuTiet AND 16),
    CONSTRAINT CK_LBGV_UuTien CHECK(UuTien IN(1,2,3)),
    CONSTRAINT UQ_LBGV UNIQUE(MaGV,NgayBan,TuTiet,DenTiet)
);
GO
CREATE INDEX IX_LBGV_GV_Ngay ON LichBanGV(MaGV,NgayBan,TuTiet,DenTiet);
GO

CREATE TABLE CaThi (
    MaCa VARCHAR(50) NOT NULL,
    MaDot VARCHAR(20) NOT NULL,
    NgayThi DATE NOT NULL,
    Thu NVARCHAR(20) NOT NULL,
    TuTiet INT NOT NULL,
    DenTiet INT NOT NULL,
    Buoi AS (CASE WHEN TuTiet <= 6 THEN 1 WHEN TuTiet <= 12 THEN 2 ELSE 3 END) PERSISTED,
    HinhThucThi NVARCHAR(50) NOT NULL,
    NhomHinhThucThi AS (CASE WHEN HinhThucThi IN(N'Lý thuyết',N'Trắc nghiệm') THEN N'Lý thuyết' WHEN HinhThucThi=N'Tự luận' THEN N'Tự luận' ELSE HinhThucThi END) PERSISTED,
    SoGVCanCap INT NOT NULL CONSTRAINT DF_CaThi_Can DEFAULT 0,
    PhongThi NVARCHAR(100) NULL,
    MaBoMon VARCHAR(20) NULL,
    CONSTRAINT PK_CaThi PRIMARY KEY(MaCa),
    CONSTRAINT FK_CaThi_Dot FOREIGN KEY(MaDot) REFERENCES DotThi(MaDot) ON DELETE CASCADE,
    CONSTRAINT FK_CaThi_BoMon FOREIGN KEY(MaBoMon) REFERENCES BoMon(MaBoMon),
    CONSTRAINT CK_CaThi_Tiet CHECK(TuTiet BETWEEN 1 AND 16 AND DenTiet BETWEEN TuTiet AND 16),
    CONSTRAINT CK_CaThi_CungBuoi CHECK((TuTiet<=6 AND DenTiet<=6) OR (TuTiet BETWEEN 7 AND 12 AND DenTiet<=12) OR TuTiet>=13),
    CONSTRAINT CK_CaThi_SoGV CHECK(SoGVCanCap>=0),
    CONSTRAINT CK_CaThi_HinhThuc CHECK(HinhThucThi IN(N'Lý thuyết',N'Trắc nghiệm',N'Tự luận',N'Vấn đáp',N'Thực hành máy',N'Ca tối'))
);
GO
CREATE INDEX IX_CaThi_Dot_Ngay ON CaThi(MaDot,NgayThi,TuTiet,DenTiet,Buoi,NhomHinhThucThi);
GO

CREATE TABLE DinhMucPhanCong (
    MaDot VARCHAR(20) NOT NULL,
    MaGV VARCHAR(20) NOT NULL,
    TyLeDinhMuc DECIMAL(5,2) NOT NULL,
    SoCaQuyDinh INT NOT NULL CONSTRAINT DF_DM_SoCa DEFAULT 0,
    GhiChu NVARCHAR(255) NULL,
    CONSTRAINT PK_DinhMuc PRIMARY KEY(MaDot,MaGV),
    CONSTRAINT FK_DM_Dot FOREIGN KEY(MaDot) REFERENCES DotThi(MaDot) ON DELETE CASCADE,
    CONSTRAINT FK_DM_GV FOREIGN KEY(MaGV) REFERENCES GiangVien(MaGV),
    CONSTRAINT CK_DM_TyLe CHECK(TyLeDinhMuc BETWEEN 0 AND 100),
    CONSTRAINT CK_DM_SoCa CHECK(SoCaQuyDinh>=0)
);
GO

CREATE TABLE PhanCongCoiThi (
    MaCa VARCHAR(50) NOT NULL,
    MaGV VARCHAR(20) NOT NULL,
    GhiChu NVARCHAR(255) NULL,
    ThoiGianPhanCong DATETIME2 NOT NULL CONSTRAINT DF_PCT_Time DEFAULT SYSDATETIME(),
    CONSTRAINT PK_PCT PRIMARY KEY(MaCa,MaGV),
    CONSTRAINT FK_PCT_Ca FOREIGN KEY(MaCa) REFERENCES CaThi(MaCa) ON DELETE CASCADE,
    CONSTRAINT FK_PCT_GV FOREIGN KEY(MaGV) REFERENCES GiangVien(MaGV)
);
GO
CREATE INDEX IX_PCT_GV ON PhanCongCoiThi(MaGV,MaCa);
GO


/* 02. Ham va thu tuc nghiep vu: tinh dinh muc, CRUD danh muc, dot thi, ca thi, lich day va lich ban. */
CREATE OR ALTER FUNCTION dbo.fn_GiaoTiet(@Tu1 INT,@Den1 INT,@Tu2 INT,@Den2 INT)
RETURNS BIT
AS
BEGIN
    RETURN CASE WHEN @Tu1<=@Den2 AND @Tu2<=@Den1 THEN 1 ELSE 0 END;
END;
GO

/* ========================= ĐỊNH MỨC ========================= */
CREATE OR ALTER PROCEDURE dbo.sp_TinhDinhMucTheoTyLe @MaDot VARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @TongNhuCau INT, @TongTyLe DECIMAL(18,6), @ConDu INT;

    SELECT @TongNhuCau=ISNULL(SUM(SoGVCanCap),0)
    FROM CaThi WHERE MaDot=@MaDot;

    SELECT @TongTyLe=ISNULL(SUM(TyLeDinhMuc),0)
    FROM DinhMucPhanCong d
    JOIN GiangVien g ON g.MaGV=d.MaGV
    WHERE d.MaDot=@MaDot AND g.TrangThai=N'Đang công tác';

    IF @TongNhuCau=0
    BEGIN
        UPDATE DinhMucPhanCong SET SoCaQuyDinh=0 WHERE MaDot=@MaDot;
        SELECT d.MaDot,d.MaGV,g.HoTen,d.TyLeDinhMuc,d.SoCaQuyDinh
        FROM DinhMucPhanCong d JOIN GiangVien g ON g.MaGV=d.MaGV
        WHERE d.MaDot=@MaDot ORDER BY d.TyLeDinhMuc DESC,d.MaGV;
        RETURN;
    END;

    IF @TongTyLe<=0
        THROW 51001,N'Tổng tỷ lệ định mức của giảng viên đang công tác phải lớn hơn 0.',1;

    -- Tính phần nguyên trước, sau đó phân phối phần dư theo phần thập phân lớn nhất.
    -- Vì vậy tổng SoCaQuyDinh luôn đúng bằng tổng SoGVCanCap.
    CREATE TABLE #Q(
        MaGV VARCHAR(20) COLLATE DATABASE_DEFAULT PRIMARY KEY,
        PhanNguyen INT NOT NULL,
        PhanLe DECIMAL(18,10) NOT NULL,
        ThuTu INT NOT NULL
    );

    INSERT #Q(MaGV,PhanNguyen,PhanLe,ThuTu)
    SELECT MaGV,CAST(FLOOR(Q) AS INT),Q-FLOOR(Q),
           ROW_NUMBER() OVER(ORDER BY Q-FLOOR(Q) DESC,TyLeDinhMuc DESC,MaGV)
    FROM (
        SELECT d.MaGV,d.TyLeDinhMuc,
               CAST(@TongNhuCau AS DECIMAL(18,10))*d.TyLeDinhMuc/@TongTyLe AS Q
        FROM DinhMucPhanCong d
        JOIN GiangVien g ON g.MaGV=d.MaGV
        WHERE d.MaDot=@MaDot AND g.TrangThai=N'Đang công tác'
    ) X;

    SELECT @ConDu=@TongNhuCau-ISNULL(SUM(PhanNguyen),0) FROM #Q;

    UPDATE d
       SET SoCaQuyDinh=q.PhanNguyen+CASE WHEN q.ThuTu<=@ConDu THEN 1 ELSE 0 END
    FROM DinhMucPhanCong d
    JOIN #Q q ON q.MaGV=d.MaGV
    WHERE d.MaDot=@MaDot;

    -- Giảng viên ngừng công tác không được nhận ca.
    UPDATE d SET SoCaQuyDinh=0
    FROM DinhMucPhanCong d
    JOIN GiangVien g ON g.MaGV=d.MaGV
    WHERE d.MaDot=@MaDot AND g.TrangThai<>N'Đang công tác';

    SELECT d.MaDot,d.MaGV,g.HoTen,d.TyLeDinhMuc,d.SoCaQuyDinh
    FROM DinhMucPhanCong d JOIN GiangVien g ON g.MaGV=d.MaGV
    WHERE d.MaDot=@MaDot ORDER BY d.TyLeDinhMuc DESC,d.MaGV;
END;
GO

/* ========================= ĐẶT ĐỊNH MỨC CHUNG ========================= */
CREATE OR ALTER PROCEDURE dbo.sp_DatDinhMucChung
    @MaDot VARCHAR(20),
    @TyLeDinhMuc DECIMAL(5,2),
    @MaKhoa VARCHAR(20)=NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TyLeDinhMuc NOT BETWEEN 0 AND 100
        THROW 51010,N'Tỷ lệ định mức chung phải từ 0 đến 100%.',1;
    IF NOT EXISTS(SELECT 1 FROM DotThi WHERE MaDot=@MaDot)
        THROW 51011,N'Đợt thi không tồn tại.',1;
    IF @MaKhoa IS NOT NULL AND NOT EXISTS(SELECT 1 FROM Khoa WHERE MaKhoa=@MaKhoa)
        THROW 51012,N'Khoa không tồn tại.',1;

    BEGIN TRAN;

    -- Tạo định mức cho GV chưa có dòng trong đợt; GV đã có thì cập nhật.
    INSERT DinhMucPhanCong(MaDot,MaGV,TyLeDinhMuc,GhiChu)
    SELECT @MaDot,g.MaGV,@TyLeDinhMuc,N'Đặt định mức chung'
    FROM GiangVien g
    JOIN BoMon bm ON bm.MaBoMon=g.MaBoMon
    WHERE g.TrangThai=N'Đang công tác'
      AND (@MaKhoa IS NULL OR bm.MaKhoa=@MaKhoa)
      AND NOT EXISTS(SELECT 1 FROM DinhMucPhanCong d WHERE d.MaDot=@MaDot AND d.MaGV=g.MaGV);

    UPDATE d SET TyLeDinhMuc=@TyLeDinhMuc, GhiChu=N'Đặt định mức chung'
    FROM DinhMucPhanCong d
    JOIN GiangVien g ON g.MaGV=d.MaGV
    JOIN BoMon bm ON bm.MaBoMon=g.MaBoMon
    WHERE d.MaDot=@MaDot
      AND g.TrangThai=N'Đang công tác'
      AND (@MaKhoa IS NULL OR bm.MaKhoa=@MaKhoa);

    EXEC dbo.sp_TinhDinhMucTheoTyLe @MaDot;

    COMMIT;

    -- Trả kết quả để API/frontend biết đã lưu và tổng số ca đã đủ.
    SELECT @MaDot AS MaDot,
           (SELECT ISNULL(SUM(SoGVCanCap),0) FROM CaThi WHERE MaDot=@MaDot) AS TongNhuCau,
           (SELECT ISNULL(SUM(SoCaQuyDinh),0) FROM DinhMucPhanCong WHERE MaDot=@MaDot) AS TongDinhMuc,
           (SELECT ISNULL(SUM(SoGVCanCap),0) FROM CaThi WHERE MaDot=@MaDot)
             - (SELECT ISNULL(SUM(SoCaQuyDinh),0) FROM DinhMucPhanCong WHERE MaDot=@MaDot) AS ChenhLech;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_CapNhatTyLeDinhMuc
    @MaDot VARCHAR(20), @MaGV VARCHAR(20), @TyLeDinhMuc DECIMAL(5,2)
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    IF @TyLeDinhMuc NOT BETWEEN 0 AND 100 THROW 51002,N'Tỷ lệ phải từ 0 đến 100%.',1;
    IF NOT EXISTS(SELECT 1 FROM DinhMucPhanCong WHERE MaDot=@MaDot AND MaGV=@MaGV) THROW 51003,N'Không tìm thấy định mức.',1;
    BEGIN TRAN;
    UPDATE DinhMucPhanCong SET TyLeDinhMuc=@TyLeDinhMuc WHERE MaDot=@MaDot AND MaGV=@MaGV;
    EXEC dbo.sp_TinhDinhMucTheoTyLe @MaDot;
    COMMIT;
END;
GO

/* ========================= CRUD KHOA / BỘ MÔN / GV ========================= */
CREATE OR ALTER PROCEDURE dbo.sp_ThemKhoa @MaKhoa VARCHAR(20),@TenKhoa NVARCHAR(200),@Email VARCHAR(150)=NULL
AS BEGIN SET NOCOUNT ON; IF EXISTS(SELECT 1 FROM Khoa WHERE MaKhoa=@MaKhoa) THROW 52001,N'Mã khoa đã tồn tại.',1; INSERT Khoa(MaKhoa,TenKhoa,Email) VALUES(@MaKhoa,@TenKhoa,@Email); END;
GO
CREATE OR ALTER PROCEDURE dbo.sp_SuaKhoa @MaKhoa VARCHAR(20),@TenKhoa NVARCHAR(200),@Email VARCHAR(150)=NULL,@TrangThai NVARCHAR(30)=N'Đang hoạt động'
AS BEGIN SET NOCOUNT ON; IF NOT EXISTS(SELECT 1 FROM Khoa WHERE MaKhoa=@MaKhoa) THROW 52002,N'Không tìm thấy khoa.',1; UPDATE Khoa SET TenKhoa=@TenKhoa,Email=@Email,TrangThai=@TrangThai WHERE MaKhoa=@MaKhoa; END;
GO
CREATE OR ALTER PROCEDURE dbo.sp_XoaKhoa @MaKhoa VARCHAR(20)
AS BEGIN SET NOCOUNT ON; IF EXISTS(SELECT 1 FROM BoMon WHERE MaKhoa=@MaKhoa) THROW 52003,N'Không thể xóa khoa vì còn bộ môn. Hãy chuyển/xóa bộ môn trước.',1; DELETE Khoa WHERE MaKhoa=@MaKhoa; END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ThemBoMon @MaBoMon VARCHAR(20),@MaKhoa VARCHAR(20),@TenBoMon NVARCHAR(200)
AS BEGIN SET NOCOUNT ON; IF NOT EXISTS(SELECT 1 FROM Khoa WHERE MaKhoa=@MaKhoa) THROW 52101,N'Khoa không tồn tại.',1; INSERT BoMon(MaBoMon,MaKhoa,TenBoMon) VALUES(@MaBoMon,@MaKhoa,@TenBoMon); END;
GO
CREATE OR ALTER PROCEDURE dbo.sp_SuaBoMon @MaBoMon VARCHAR(20),@MaKhoa VARCHAR(20),@TenBoMon NVARCHAR(200),@TrangThai NVARCHAR(30)=N'Đang hoạt động'
AS BEGIN SET NOCOUNT ON; UPDATE BoMon SET MaKhoa=@MaKhoa,TenBoMon=@TenBoMon,TrangThai=@TrangThai WHERE MaBoMon=@MaBoMon; IF @@ROWCOUNT=0 THROW 52102,N'Không tìm thấy bộ môn.',1; END;
GO
CREATE OR ALTER PROCEDURE dbo.sp_XoaBoMon @MaBoMon VARCHAR(20)
AS BEGIN SET NOCOUNT ON; IF EXISTS(SELECT 1 FROM GiangVien WHERE MaBoMon=@MaBoMon) THROW 52103,N'Không thể xóa bộ môn vì còn giảng viên.',1; DELETE BoMon WHERE MaBoMon=@MaBoMon; END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ThemGiangVien
 @MaGV VARCHAR(20),@HoTen NVARCHAR(120),@HocVi NVARCHAR(100)=NULL,@ChucVu NVARCHAR(200)=NULL,@Email VARCHAR(150)=NULL,@SoDienThoai VARCHAR(30)=NULL,@MaBoMon VARCHAR(20)
AS BEGIN SET NOCOUNT ON; IF EXISTS(SELECT 1 FROM GiangVien WHERE MaGV=@MaGV) THROW 52201,N'Mã giảng viên đã tồn tại.',1; IF NOT EXISTS(SELECT 1 FROM BoMon WHERE MaBoMon=@MaBoMon) THROW 52202,N'Bộ môn không tồn tại.',1; INSERT GiangVien(MaGV,HoTen,HocVi,ChucVu,Email,SoDienThoai,MaBoMon) VALUES(@MaGV,@HoTen,@HocVi,@ChucVu,@Email,@SoDienThoai,@MaBoMon); END;
GO
CREATE OR ALTER PROCEDURE dbo.sp_SuaGiangVien
 @MaGV VARCHAR(20),@HoTen NVARCHAR(120),@HocVi NVARCHAR(100)=NULL,@ChucVu NVARCHAR(200)=NULL,@Email VARCHAR(150)=NULL,@SoDienThoai VARCHAR(30)=NULL,@MaBoMon VARCHAR(20),@TrangThai NVARCHAR(30)=N'Đang công tác'
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF NOT EXISTS(SELECT 1 FROM dbo.GiangVien WHERE MaGV=@MaGV) THROW 52203,N'Không tìm thấy giảng viên.',1;
 IF NOT EXISTS(SELECT 1 FROM dbo.BoMon WHERE MaBoMon=@MaBoMon AND TrangThai=N'Đang hoạt động') THROW 52205,N'Bộ môn không tồn tại hoặc đã ngừng hoạt động.',1;
 IF @TrangThai NOT IN(N'Đang công tác',N'Tạm nghỉ',N'Ngừng công tác') THROW 52206,N'Trạng thái giảng viên không hợp lệ.',1;
 UPDATE dbo.GiangVien SET HoTen=@HoTen,HocVi=@HocVi,ChucVu=@ChucVu,Email=@Email,SoDienThoai=@SoDienThoai,MaBoMon=@MaBoMon,TrangThai=@TrangThai WHERE MaGV=@MaGV;
 SELECT MaGV,HoTen,HocVi,ChucVu,Email,SoDienThoai,MaBoMon,TrangThai FROM dbo.GiangVien WHERE MaGV=@MaGV;
END;
GO
CREATE OR ALTER PROCEDURE dbo.sp_XoaGiangVien @MaGV VARCHAR(20)
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF NOT EXISTS(SELECT 1 FROM dbo.GiangVien WHERE MaGV=@MaGV) THROW 52204,N'Không tìm thấy giảng viên.',1;
 UPDATE dbo.GiangVien SET TrangThai=N'Ngừng công tác' WHERE MaGV=@MaGV;
 SELECT MaGV,HoTen,MaBoMon,TrangThai FROM dbo.GiangVien WHERE MaGV=@MaGV;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_DanhSachGiangVien @MaKhoa VARCHAR(20)=NULL,@MaBoMon VARCHAR(20)=NULL,@TrangThai NVARCHAR(30)=NULL
AS BEGIN SET NOCOUNT ON; SELECT g.MaGV,g.HoTen,g.HocVi,g.ChucVu,g.Email,g.SoDienThoai,bm.MaBoMon,bm.TenBoMon,k.MaKhoa,k.TenKhoa,g.TrangThai FROM GiangVien g JOIN BoMon bm ON bm.MaBoMon=g.MaBoMon JOIN Khoa k ON k.MaKhoa=bm.MaKhoa WHERE (@MaKhoa IS NULL OR k.MaKhoa=@MaKhoa) AND (@MaBoMon IS NULL OR bm.MaBoMon=@MaBoMon) AND (@TrangThai IS NULL OR g.TrangThai=@TrangThai) ORDER BY k.TenKhoa,bm.TenBoMon,g.HoTen; END;
GO


/* ========================= CRUD ĐỢT THI / CA THI / LỊCH BẬN ========================= */
CREATE OR ALTER PROCEDURE dbo.sp_ThemDotThi
 @MaDot VARCHAR(20),@TenDot NVARCHAR(200),@HocKy VARCHAR(3),@NamHoc VARCHAR(9),@NgayBatDau DATE,@NgayKetThuc DATE,@GhiChu NVARCHAR(500)=NULL
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF @HocKy NOT IN ('HK1','HK2','HKH') THROW 52304,N'Học kỳ chỉ được HK1, HK2 hoặc HKH.',1;
 IF @NgayKetThuc<@NgayBatDau THROW 52305,N'Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.',1;
 IF EXISTS(SELECT 1 FROM DotThi WHERE MaDot=@MaDot) THROW 52301,N'Mã đợt thi đã tồn tại.',1;
 IF EXISTS(SELECT 1 FROM DotThi WHERE HocKy=@HocKy AND NamHoc=@NamHoc) THROW 52306,N'Đợt thi của học kỳ và năm học này đã tồn tại.',1;
 INSERT DotThi(MaDot,TenDot,HocKy,NamHoc,LoaiDot,NgayBatDau,NgayKetThuc,GhiChu) VALUES(@MaDot,@TenDot,@HocKy,@NamHoc,@HocKy,@NgayBatDau,@NgayKetThuc,@GhiChu);
 INSERT CauHinhXepLich(MaDot) VALUES(@MaDot);
 SELECT MaDot,TenDot,HocKy,NamHoc,LoaiDot,NgayBatDau,NgayKetThuc,GhiChu FROM DotThi WHERE MaDot=@MaDot;
END;
GO
CREATE OR ALTER PROCEDURE dbo.sp_SuaDotThi
 @MaDot VARCHAR(20),@TenDot NVARCHAR(200),@HocKy VARCHAR(3),@NamHoc VARCHAR(9),@NgayBatDau DATE,@NgayKetThuc DATE,@GhiChu NVARCHAR(500)=NULL
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF @HocKy NOT IN ('HK1','HK2','HKH') THROW 52304,N'Học kỳ chỉ được HK1, HK2 hoặc HKH.',1;
 IF @NgayKetThuc<@NgayBatDau THROW 52305,N'Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.',1;
 UPDATE DotThi SET TenDot=@TenDot,HocKy=@HocKy,NamHoc=@NamHoc,LoaiDot=@HocKy,NgayBatDau=@NgayBatDau,NgayKetThuc=@NgayKetThuc,GhiChu=@GhiChu WHERE MaDot=@MaDot;
 IF @@ROWCOUNT=0 THROW 52302,N'Không tìm thấy đợt thi.',1;
END;
GO
CREATE OR ALTER PROCEDURE dbo.sp_XoaDotThi @MaDot VARCHAR(20)
AS
BEGIN
 SET NOCOUNT ON;
 DELETE FROM DotThi WHERE MaDot=@MaDot;
 IF @@ROWCOUNT=0 THROW 52303,N'Không tìm thấy đợt thi.',1;
END;
GO
CREATE OR ALTER PROCEDURE dbo.sp_DanhSachDotThi
AS
BEGIN
 SET NOCOUNT ON;
 SELECT MaDot,TenDot,HocKy,NamHoc,LoaiDot,NgayBatDau,NgayKetThuc,GhiChu FROM DotThi ORDER BY NamHoc DESC,CASE HocKy WHEN 'HK1' THEN 1 WHEN 'HK2' THEN 2 ELSE 3 END,NgayBatDau DESC;
END;
GO
CREATE OR ALTER PROCEDURE dbo.sp_DanhSachCaThi @MaDot VARCHAR(20)=NULL
AS
BEGIN
 SET NOCOUNT ON;
 SELECT c.MaCa,c.MaDot,d.TenDot,d.HocKy,d.NamHoc,c.NgayThi,c.Thu,c.TuTiet,c.DenTiet,c.Buoi,c.HinhThucThi,c.SoGVCanCap,c.PhongThi,c.MaBoMon,COUNT(p.MaGV) AS SoGVDaCap
 FROM CaThi c JOIN DotThi d ON d.MaDot=c.MaDot LEFT JOIN PhanCongCoiThi p ON p.MaCa=c.MaCa
 WHERE @MaDot IS NULL OR c.MaDot=@MaDot
 GROUP BY c.MaCa,c.MaDot,d.TenDot,d.HocKy,d.NamHoc,c.NgayThi,c.Thu,c.TuTiet,c.DenTiet,c.Buoi,c.HinhThucThi,c.SoGVCanCap,c.PhongThi,c.MaBoMon
 ORDER BY c.NgayThi,c.TuTiet,c.DenTiet,c.MaCa;
END;
GO
CREATE OR ALTER PROCEDURE dbo.sp_ThemCaThi
 @MaCa VARCHAR(50),@MaDot VARCHAR(20),@NgayThi DATE,@Thu NVARCHAR(20),@TuTiet INT,@DenTiet INT,@HinhThucThi NVARCHAR(50),@SoGVCanCap INT,@PhongThi NVARCHAR(100)=NULL,@MaBoMon VARCHAR(20)=NULL
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 DECLARE @NgayBD DATE,@NgayKT DATE; SELECT @NgayBD=NgayBatDau,@NgayKT=NgayKetThuc FROM DotThi WHERE MaDot=@MaDot;
 IF @NgayBD IS NULL THROW 52400,N'Đợt thi không tồn tại.',1;
 IF @NgayThi NOT BETWEEN @NgayBD AND @NgayKT THROW 52404,N'Ngày thi phải nằm trong khoảng ngày của đợt thi.',1;
 IF EXISTS(SELECT 1 FROM CaThi WHERE MaCa=@MaCa) THROW 52401,N'Mã ca đã tồn tại.',1;
 IF EXISTS(SELECT 1 FROM CaThi WHERE MaDot=@MaDot AND NgayThi=@NgayThi AND TuTiet=@TuTiet AND DenTiet=@DenTiet) THROW 52405,N'Đã có ca thi trùng ngày và tiết trong đợt này.',1;
 INSERT CaThi(MaCa,MaDot,NgayThi,Thu,TuTiet,DenTiet,HinhThucThi,SoGVCanCap,PhongThi,MaBoMon) VALUES(@MaCa,@MaDot,@NgayThi,@Thu,@TuTiet,@DenTiet,@HinhThucThi,@SoGVCanCap,@PhongThi,@MaBoMon);
 IF EXISTS(SELECT 1 FROM DinhMucPhanCong WHERE MaDot=@MaDot) EXEC dbo.sp_TinhDinhMucTheoTyLe @MaDot;
 SELECT MaCa,MaDot,NgayThi,Thu,TuTiet,DenTiet,Buoi,HinhThucThi,SoGVCanCap,PhongThi,MaBoMon FROM CaThi WHERE MaCa=@MaCa;
END;
GO
CREATE OR ALTER PROCEDURE dbo.sp_SuaCaThi
 @MaCa VARCHAR(50),@NgayThi DATE,@Thu NVARCHAR(20),@TuTiet INT,@DenTiet INT,@HinhThucThi NVARCHAR(50),@SoGVCanCap INT,@PhongThi NVARCHAR(100)=NULL,@MaBoMon VARCHAR(20)=NULL
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 DECLARE @MaDot VARCHAR(20),@NgayBD DATE,@NgayKT DATE; SELECT @MaDot=c.MaDot,@NgayBD=d.NgayBatDau,@NgayKT=d.NgayKetThuc FROM CaThi c JOIN DotThi d ON d.MaDot=c.MaDot WHERE c.MaCa=@MaCa;
 IF @MaDot IS NULL THROW 52402,N'Không tìm thấy ca thi.',1;
 IF @NgayThi NOT BETWEEN @NgayBD AND @NgayKT THROW 52406,N'Ngày thi phải nằm trong khoảng ngày của đợt thi.',1;
 IF EXISTS(SELECT 1 FROM CaThi WHERE MaDot=@MaDot AND NgayThi=@NgayThi AND TuTiet=@TuTiet AND DenTiet=@DenTiet AND MaCa<>@MaCa) THROW 52405,N'Đã có ca thi trùng ngày và tiết trong đợt này.',1;
 UPDATE CaThi SET NgayThi=@NgayThi,Thu=@Thu,TuTiet=@TuTiet,DenTiet=@DenTiet,HinhThucThi=@HinhThucThi,SoGVCanCap=@SoGVCanCap,PhongThi=@PhongThi,MaBoMon=@MaBoMon WHERE MaCa=@MaCa;
 IF EXISTS(SELECT 1 FROM DinhMucPhanCong WHERE MaDot=@MaDot) EXEC dbo.sp_TinhDinhMucTheoTyLe @MaDot;
END;
GO
CREATE OR ALTER PROCEDURE dbo.sp_XoaCaThi @MaCa VARCHAR(50)
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 DECLARE @MaDot VARCHAR(20); SELECT @MaDot=MaDot FROM CaThi WHERE MaCa=@MaCa;
 IF @MaDot IS NULL THROW 52403,N'Không tìm thấy ca thi.',1;
 DELETE FROM CaThi WHERE MaCa=@MaCa;
 IF EXISTS(SELECT 1 FROM DinhMucPhanCong WHERE MaDot=@MaDot) EXEC dbo.sp_TinhDinhMucTheoTyLe @MaDot;
END;
GO
CREATE TYPE dbo.LichDayGVInput AS TABLE(
    NgayDay DATE NOT NULL,
    TuTiet INT NOT NULL,
    DenTiet INT NOT NULL
);
GO

CREATE OR ALTER PROCEDURE dbo.sp_ThayTheLichDayGV
 @MaGV VARCHAR(20),@NguonFile NVARCHAR(255)=NULL,@Rows dbo.LichDayGVInput READONLY
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF NOT EXISTS(SELECT 1 FROM dbo.GiangVien WHERE MaGV=@MaGV AND TrangThai=N'Đang công tác') THROW 52500,N'Giảng viên không tồn tại hoặc không còn công tác.',1;
 DELETE FROM dbo.LichDayGV WHERE MaGV=@MaGV;
 INSERT dbo.LichDayGV(MaGV,NgayDay,TuTiet,DenTiet,NguonFile) SELECT @MaGV,NgayDay,TuTiet,DenTiet,@NguonFile FROM @Rows;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ThemLichDayGV
 @MaGV VARCHAR(20),@NgayDay DATE,@TuTiet INT,@DenTiet INT,@NguonFile NVARCHAR(255)=NULL,@GhiChu NVARCHAR(255)=NULL
AS
BEGIN SET NOCOUNT ON; INSERT dbo.LichDayGV(MaGV,NgayDay,TuTiet,DenTiet,NguonFile,GhiChu) VALUES(@MaGV,@NgayDay,@TuTiet,@DenTiet,@NguonFile,@GhiChu); END;
GO
CREATE OR ALTER PROCEDURE dbo.sp_XoaLichDayGV @ID INT
AS BEGIN SET NOCOUNT ON; DELETE FROM dbo.LichDayGV WHERE ID=@ID; IF @@ROWCOUNT=0 THROW 52503,N'Không tìm thấy lịch dạy.',1; END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ThemLichBanGV
 @MaGV VARCHAR(20),@NgayBan DATE,@TuTiet INT,@DenTiet INT,@LyDo NVARCHAR(255)=NULL,@UuTien TINYINT=3
AS
BEGIN SET NOCOUNT ON; INSERT LichBanGV(MaGV,NgayBan,TuTiet,DenTiet,LyDo,UuTien) VALUES(@MaGV,@NgayBan,@TuTiet,@DenTiet,@LyDo,@UuTien); END;
GO
CREATE OR ALTER PROCEDURE dbo.sp_SuaLichBanGV
 @ID INT,@NgayBan DATE,@TuTiet INT,@DenTiet INT,@LyDo NVARCHAR(255)=NULL,@UuTien TINYINT=3
AS
BEGIN SET NOCOUNT ON; UPDATE LichBanGV SET NgayBan=@NgayBan,TuTiet=@TuTiet,DenTiet=@DenTiet,LyDo=@LyDo,UuTien=@UuTien WHERE ID=@ID; IF @@ROWCOUNT=0 THROW 52501,N'Không tìm thấy lịch bận.',1; END;
GO
CREATE OR ALTER PROCEDURE dbo.sp_XoaLichBanGV @ID INT
AS BEGIN SET NOCOUNT ON; DELETE FROM LichBanGV WHERE ID=@ID; IF @@ROWCOUNT=0 THROW 52502,N'Không tìm thấy lịch bận.',1; END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ThemDinhMuc
 @MaDot VARCHAR(20),@MaGV VARCHAR(20),@TyLeDinhMuc DECIMAL(5,2),@GhiChu NVARCHAR(255)=NULL
AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS(SELECT 1 FROM DinhMucPhanCong WHERE MaDot=@MaDot AND MaGV=@MaGV) THROW 52601,N'Giảng viên đã có định mức trong đợt thi.',1;
 INSERT DinhMucPhanCong(MaDot,MaGV,TyLeDinhMuc,GhiChu) VALUES(@MaDot,@MaGV,@TyLeDinhMuc,@GhiChu);
 EXEC dbo.sp_TinhDinhMucTheoTyLe @MaDot;
END;
GO
CREATE OR ALTER PROCEDURE dbo.sp_XoaDinhMuc @MaDot VARCHAR(20),@MaGV VARCHAR(20)
AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS(SELECT 1 FROM PhanCongCoiThi p JOIN CaThi c ON c.MaCa=p.MaCa WHERE c.MaDot=@MaDot AND p.MaGV=@MaGV) THROW 52602,N'Không thể xóa định mức khi giảng viên đã có phân công. Hãy xếp lại lịch trước.',1;
 DELETE FROM DinhMucPhanCong WHERE MaDot=@MaDot AND MaGV=@MaGV;
 IF @@ROWCOUNT=0 THROW 52603,N'Không tìm thấy định mức.',1;
 EXEC dbo.sp_TinhDinhMucTheoTyLe @MaDot;
END;
GO


/* 03. Tai khoan va cong thong tin giang vien. */
IF OBJECT_ID(N'dbo.TaiKhoanGiangVien', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TaiKhoanGiangVien (
    MaGV VARCHAR(20) NOT NULL,
    PasswordHash NVARCHAR(500) NULL,
    MustChangePassword BIT NOT NULL CONSTRAINT DF_TKGV_MustChange DEFAULT 1,
    IsActive BIT NOT NULL CONSTRAINT DF_TKGV_Active DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_TKGV_Created DEFAULT SYSDATETIME(),
    PasswordChangedAt DATETIME2 NULL,
    LastLoginAt DATETIME2 NULL,
    CONSTRAINT PK_TaiKhoanGiangVien PRIMARY KEY(MaGV),
    CONSTRAINT FK_TKGV_GiangVien FOREIGN KEY(MaGV) REFERENCES dbo.GiangVien(MaGV)
  );
END;
GO
IF OBJECT_ID(N'dbo.YeuCauDoiCa', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.YeuCauDoiCa (
    ID BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_YeuCauDoiCa PRIMARY KEY,
    MaGVGui VARCHAR(20) NOT NULL,
    MaGVNhan VARCHAR(20) NOT NULL,
    MaCaGui VARCHAR(50) NOT NULL,
    MaCaNhan VARCHAR(50) NULL,
    TrangThai VARCHAR(20) NOT NULL CONSTRAINT DF_YCDC_TrangThai DEFAULT 'Pending',
    LoiNhan NVARCHAR(500) NULL,
    PhanHoi NVARCHAR(500) NULL,
    TaoLuc DATETIME2 NOT NULL CONSTRAINT DF_YCDC_Tao DEFAULT SYSDATETIME(),
    PhanHoiLuc DATETIME2 NULL,
    HoanTatLuc DATETIME2 NULL,
    CONSTRAINT FK_YCDC_Gui FOREIGN KEY(MaGVGui) REFERENCES dbo.GiangVien(MaGV),
    CONSTRAINT FK_YCDC_Nhan FOREIGN KEY(MaGVNhan) REFERENCES dbo.GiangVien(MaGV),
    CONSTRAINT FK_YCDC_CaGui FOREIGN KEY(MaCaGui) REFERENCES dbo.CaThi(MaCa),
    CONSTRAINT FK_YCDC_CaNhan FOREIGN KEY(MaCaNhan) REFERENCES dbo.CaThi(MaCa),
    CONSTRAINT CK_YCDC_KhacNguoi CHECK(MaGVGui<>MaGVNhan),
    CONSTRAINT CK_YCDC_KhacCa CHECK(MaCaGui<>MaCaNhan),
    CONSTRAINT CK_YCDC_TrangThai CHECK(TrangThai IN ('Pending','Accepted','Rejected','Cancelled','Failed'))
  );
  CREATE INDEX IX_YCDC_Nhan_TrangThai ON dbo.YeuCauDoiCa(MaGVNhan,TrangThai,TaoLuc DESC);
  CREATE INDEX IX_YCDC_Gui ON dbo.YeuCauDoiCa(MaGVGui,TaoLuc DESC);
END;
GO

/* Yêu cầu nhận coi thay chỉ chuyển một ca nên MaCaNhan để NULL.
   ALTER này cũng nâng cấp các DB cũ đã tạo bảng theo luồng đổi hai ca. */
IF OBJECT_ID(N'dbo.YeuCauDoiCa', N'U') IS NOT NULL
   AND EXISTS(SELECT 1 FROM sys.columns
              WHERE object_id=OBJECT_ID(N'dbo.YeuCauDoiCa')
                AND name=N'MaCaNhan' AND is_nullable=0)
BEGIN
  ALTER TABLE dbo.YeuCauDoiCa ALTER COLUMN MaCaNhan VARCHAR(50) NULL;
END;
GO

IF OBJECT_ID(N'dbo.ThongBao', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ThongBao (
    ID BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ThongBao PRIMARY KEY,
    MaGVNhan VARCHAR(20) NULL,
    DoiTuongNhan VARCHAR(20) NOT NULL CONSTRAINT DF_TB_DoiTuong DEFAULT 'Lecturer',
    TieuDe NVARCHAR(200) NOT NULL,
    NoiDung NVARCHAR(1000) NOT NULL,
    Loai VARCHAR(40) NOT NULL,
    YeuCauDoiCaID BIGINT NULL,
    DaDoc BIT NOT NULL CONSTRAINT DF_TB_DaDoc DEFAULT 0,
    TaoLuc DATETIME2 NOT NULL CONSTRAINT DF_TB_Tao DEFAULT SYSDATETIME(),
    CONSTRAINT FK_TB_GV FOREIGN KEY(MaGVNhan) REFERENCES dbo.GiangVien(MaGV),
    CONSTRAINT FK_TB_YCDC FOREIGN KEY(YeuCauDoiCaID) REFERENCES dbo.YeuCauDoiCa(ID)
  );
  CREATE INDEX IX_ThongBao_GV_DaDoc ON dbo.ThongBao(MaGVNhan,DaDoc,TaoLuc DESC);
END;
GO

IF OBJECT_ID(N'dbo.LichSuDoiCa', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.LichSuDoiCa (
    ID BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LichSuDoiCa PRIMARY KEY,
    YeuCauDoiCaID BIGINT NOT NULL,
    MaGV1 VARCHAR(20) NOT NULL,
    MaGV2 VARCHAR(20) NOT NULL,
    MaCa1 VARCHAR(50) NOT NULL,
    MaCa2 VARCHAR(50) NOT NULL,
    ThoiGian DATETIME2 NOT NULL CONSTRAINT DF_LSDC_Time DEFAULT SYSDATETIME(),
    KetQua NVARCHAR(100) NOT NULL,
    CONSTRAINT FK_LSDC_YC FOREIGN KEY(YeuCauDoiCaID) REFERENCES dbo.YeuCauDoiCa(ID),
    CONSTRAINT FK_LSDC_GV1 FOREIGN KEY(MaGV1) REFERENCES dbo.GiangVien(MaGV),
    CONSTRAINT FK_LSDC_GV2 FOREIGN KEY(MaGV2) REFERENCES dbo.GiangVien(MaGV),
    CONSTRAINT FK_LSDC_Ca1 FOREIGN KEY(MaCa1) REFERENCES dbo.CaThi(MaCa),
    CONSTRAINT FK_LSDC_Ca2 FOREIGN KEY(MaCa2) REFERENCES dbo.CaThi(MaCa)
  );
END;
GO
IF OBJECT_ID(N'dbo.TaiKhoanAdmin', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.TaiKhoanAdmin (
        AdminID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        TenDangNhap NVARCHAR(100) NOT NULL UNIQUE,
        MatKhauHash NVARCHAR(256) NOT NULL,
        Salt NVARCHAR(64) NULL,
        NgayTao DATETIME2 NOT NULL CONSTRAINT DF_TaiKhoanAdmin_NgayTao DEFAULT SYSDATETIME(),
        LanCapNhatMatKhau DATETIME2 NULL,
        TrangThai BIT NOT NULL CONSTRAINT DF_TaiKhoanAdmin_TrangThai DEFAULT 1
    );
END;
GO

IF COL_LENGTH(N'dbo.TaiKhoanAdmin', N'Salt') IS NULL
    ALTER TABLE dbo.TaiKhoanAdmin ADD Salt NVARCHAR(64) NULL;
GO


/* 04. View thong ke ca gay va muc do ne lich ban. */
CREATE OR ALTER VIEW dbo.vw_ThongKeCaGayGV AS
WITH X AS(
 SELECT p.MaGV,c.MaDot,c.NgayThi,c.DenTiet,LEAD(c.TuTiet) OVER(PARTITION BY p.MaGV,c.MaDot,c.NgayThi ORDER BY c.TuTiet,c.DenTiet,c.MaCa) TuSau
 FROM PhanCongCoiThi p JOIN CaThi c ON c.MaCa=p.MaCa)
SELECT x.MaDot,x.MaGV,COUNT(*) SoCaGay FROM X x JOIN CauHinhXepLich cfg ON cfg.MaDot=x.MaDot WHERE x.TuSau IS NOT NULL AND x.TuSau-x.DenTiet-1>=cfg.SoTietGapToiThieuCaGay GROUP BY x.MaDot,x.MaGV;
GO

CREATE OR ALTER VIEW dbo.vw_ThongKeLichBanGV
AS
WITH X AS
(
    SELECT
        c.MaDot,
        p.MaGV,
        c.MaCa,
        CASE WHEN EXISTS
        (
            SELECT 1
            FROM dbo.LichBanGV b
            WHERE b.MaGV=p.MaGV
              AND b.UuTien IN(2,3)
              AND b.NgayBan=c.NgayThi
              AND c.TuTiet<=b.DenTiet
              AND b.TuTiet<=c.DenTiet
        ) THEN 1 ELSE 0 END AS TrungLichBan
    FROM dbo.PhanCongCoiThi p
    INNER JOIN dbo.CaThi c ON c.MaCa=p.MaCa
)
SELECT
    MaDot,
    MaGV,
    COUNT(*) AS TongSoCa,
    SUM(TrungLichBan) AS SoCaTrungLichBan,
    CAST(100.0*(COUNT(*)-SUM(TrungLichBan))/NULLIF(COUNT(*),0) AS DECIMAL(5,2)) AS TyLeNeLichBan
FROM X
GROUP BY MaDot,MaGV;
GO


/* 05. Mot bo view/thu tuc kiem tra va chot lich; dinh muc duong cho phep lech +/- 1. */
CREATE OR ALTER VIEW dbo.vw_ViPhamRangBuocCung
AS
WITH S AS
(
    SELECT c.MaDot,p.MaGV,COUNT(*) AS SoCa
    FROM dbo.PhanCongCoiThi p
    INNER JOIN dbo.CaThi c ON c.MaCa=p.MaCa
    GROUP BY c.MaDot,p.MaGV
),
C AS
(
    SELECT MaCa,COUNT(*) AS SoGV
    FROM dbo.PhanCongCoiThi
    GROUP BY MaCa
),
AssignedType AS
(
    SELECT p.MaGV,c.MaDot,c.NgayThi,c.Buoi,c.NhomHinhThucThi
    FROM dbo.PhanCongCoiThi p
    INNER JOIN dbo.CaThi c ON c.MaCa=p.MaCa
    GROUP BY p.MaGV,c.MaDot,c.NgayThi,c.Buoi,c.NhomHinhThucThi
),
Sessions AS
(
    SELECT MaGV,MaDot,NgayThi,Buoi,COUNT(*) AS SoNhom
    FROM AssignedType
    GROUP BY MaGV,MaDot,NgayThi,Buoi
)
SELECT
    s.MaDot,N'RB1' AS MaRB,N'Vượt định mức cho phép' AS LoaiViPham,
    s.MaGV,CAST(NULL AS VARCHAR(50)) AS MaCa,CAST(NULL AS VARCHAR(50)) AS MaCaLienQuan,
    CONCAT(N'GV ',s.MaGV,N' được ',s.SoCa,N' ca, vượt mức tối đa ',
        ISNULL(d.SoCaQuyDinh,0)+CASE WHEN ISNULL(d.SoCaQuyDinh,0)=0 THEN 0 ELSE ISNULL(cfg.DoLechDinhMucChoPhep,1) END) AS MoTa
FROM S s
LEFT JOIN dbo.DinhMucPhanCong d ON d.MaDot=s.MaDot AND d.MaGV=s.MaGV
LEFT JOIN dbo.CauHinhXepLich cfg ON cfg.MaDot=s.MaDot
WHERE s.SoCa>ISNULL(d.SoCaQuyDinh,0)+CASE WHEN ISNULL(d.SoCaQuyDinh,0)=0 THEN 0 ELSE ISNULL(cfg.DoLechDinhMucChoPhep,1) END

UNION ALL
SELECT c.MaDot,N'RB2',N'Thừa GV',NULL,c.MaCa,NULL,
       CONCAT(N'Ca ',c.MaCa,N' có ',x.SoGV,N' GV, cần đúng ',c.SoGVCanCap)
FROM dbo.CaThi c INNER JOIN C x ON x.MaCa=c.MaCa
WHERE x.SoGV>c.SoGVCanCap

UNION ALL
SELECT c1.MaDot,N'RB3',N'Trùng thời gian',p1.MaGV,c1.MaCa,c2.MaCa,
       CONCAT(N'GV ',p1.MaGV,N' trùng ca ',c1.MaCa,N' và ',c2.MaCa)
FROM dbo.PhanCongCoiThi p1
INNER JOIN dbo.CaThi c1 ON c1.MaCa=p1.MaCa
INNER JOIN dbo.PhanCongCoiThi p2 ON p2.MaGV=p1.MaGV AND p2.MaCa>p1.MaCa
INNER JOIN dbo.CaThi c2 ON c2.MaCa=p2.MaCa AND c2.NgayThi=c1.NgayThi
    AND c1.TuTiet<=c2.DenTiet AND c2.TuTiet<=c1.DenTiet

UNION ALL
SELECT c.MaDot,N'RB4',N'Trùng lịch dạy',p.MaGV,c.MaCa,NULL,
       CONCAT(N'GV ',p.MaGV,N' trùng lịch dạy ngày ',CONVERT(NVARCHAR(10),c.NgayThi,103),N' với ca ',c.MaCa)
FROM dbo.PhanCongCoiThi p
INNER JOIN dbo.CaThi c ON c.MaCa=p.MaCa
INNER JOIN dbo.LichDayGV b ON b.MaGV=p.MaGV AND b.NgayDay=c.NgayThi
    AND c.TuTiet<=b.DenTiet AND b.TuTiet<=c.DenTiet

UNION ALL
SELECT s.MaDot,N'RB5',N'Trộn nhóm ca trong buổi',s.MaGV,NULL,NULL,
       CONCAT(N'GV ',s.MaGV,N' được phân công ',s.SoNhom,N' nhóm ca khác nhau trong ngày ',
              CONVERT(NVARCHAR(10),s.NgayThi,103),N', buổi ',s.Buoi)
FROM Sessions s
WHERE s.SoNhom>1

UNION ALL
SELECT c.MaDot,N'RB6',N'Lịch bận mức 1',p.MaGV,c.MaCa,NULL,
       CONCAT(N'GV ',p.MaGV,N' bị phân công trùng lịch bận mức 1 ngày ',
              CONVERT(NVARCHAR(10),c.NgayThi,103),N', ca ',c.MaCa)
FROM dbo.PhanCongCoiThi p
INNER JOIN dbo.CaThi c ON c.MaCa=p.MaCa
INNER JOIN dbo.LichBanGV b ON b.MaGV=p.MaGV AND b.UuTien=1 AND b.NgayBan=c.NgayThi
    AND c.TuTiet<=b.DenTiet AND b.TuTiet<=c.DenTiet;
GO

CREATE OR ALTER PROCEDURE dbo.sp_KiemTraRangBuoc
    @MaDot VARCHAR(20),
    @ThrowIfFail BIT=0
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS(SELECT 1 FROM dbo.DotThi WHERE MaDot=@MaDot)
        THROW 53000,N'Đợt thi không tồn tại.',1;

    DECLARE @RB TABLE(MaRB NVARCHAR(10) PRIMARY KEY,TenRangBuoc NVARCHAR(200),SoViPham INT);
    INSERT @RB VALUES
        (N'RB1',N'Định mức trong khoảng cho phép ±1 ca',0),
        (N'RB2',N'Mỗi ca đúng số GV cần cấp',0),
        (N'RB3',N'GV không coi 2 ca trùng thời gian',0),
        (N'RB4',N'GV không trùng lịch dạy',0),
        (N'RB5',N'Không trộn nhóm ca trong buổi',0),
        (N'RB6',N'Né lịch bận mức 1',0);

    UPDATE @RB SET SoViPham=(
        SELECT COUNT(*)
        FROM dbo.DinhMucPhanCong d
        LEFT JOIN dbo.CauHinhXepLich cfg ON cfg.MaDot=d.MaDot
        CROSS APPLY (SELECT COUNT(*) AS SoCa
                     FROM dbo.PhanCongCoiThi p JOIN dbo.CaThi c ON c.MaCa=p.MaCa
                     WHERE c.MaDot=d.MaDot AND p.MaGV=d.MaGV) n
        WHERE d.MaDot=@MaDot AND
            ((d.SoCaQuyDinh=0 AND n.SoCa<>0) OR
             (d.SoCaQuyDinh>0 AND ABS(n.SoCa-d.SoCaQuyDinh)>ISNULL(cfg.DoLechDinhMucChoPhep,1)))
    ) WHERE MaRB=N'RB1';

    UPDATE @RB SET SoViPham=(SELECT COUNT(*) FROM dbo.CaThi c
        WHERE c.MaDot=@MaDot AND (SELECT COUNT(*) FROM dbo.PhanCongCoiThi p WHERE p.MaCa=c.MaCa)<>c.SoGVCanCap)
        WHERE MaRB=N'RB2';
    UPDATE r SET SoViPham=x.SoViPham
    FROM @RB r
    CROSS APPLY (SELECT COUNT(*) SoViPham FROM dbo.vw_ViPhamRangBuocCung v
                 WHERE v.MaDot=@MaDot AND v.MaRB=r.MaRB) x
    WHERE r.MaRB IN(N'RB3',N'RB4',N'RB5',N'RB6');

    SELECT MaRB,TenRangBuoc,SoViPham,
           CASE WHEN SoViPham=0 THEN CAST(100.00 AS DECIMAL(5,2)) ELSE CAST(0.00 AS DECIMAL(5,2)) END AS PhanTramDat,
           CASE WHEN SoViPham=0 THEN N'ĐẠT 100%' ELSE N'VI PHẠM' END AS KetQua
    FROM @RB ORDER BY MaRB;

    SELECT MaRB,LoaiViPham,MaGV,MaCa,MaCaLienQuan,MoTa
    FROM dbo.vw_ViPhamRangBuocCung
    WHERE MaDot=@MaDot AND MaRB<>N'RB1'
    UNION ALL
    SELECT N'RB1',N'Ngoài khoảng định mức',d.MaGV,NULL,NULL,
           CONCAT(N'GV ',d.MaGV,N' có ',n.SoCa,N' ca; định mức ',d.SoCaQuyDinh,
                  N', cho phép ',CASE WHEN d.SoCaQuyDinh=0 THEN N'0'
                       ELSE CONCAT(CASE WHEN d.SoCaQuyDinh-ISNULL(cfg.DoLechDinhMucChoPhep,1)<0 THEN 0 ELSE d.SoCaQuyDinh-ISNULL(cfg.DoLechDinhMucChoPhep,1) END,
                                   N'–',d.SoCaQuyDinh+ISNULL(cfg.DoLechDinhMucChoPhep,1)) END)
    FROM dbo.DinhMucPhanCong d
    LEFT JOIN dbo.CauHinhXepLich cfg ON cfg.MaDot=d.MaDot
    CROSS APPLY (SELECT COUNT(*) AS SoCa
                 FROM dbo.PhanCongCoiThi p JOIN dbo.CaThi c ON c.MaCa=p.MaCa
                 WHERE c.MaDot=d.MaDot AND p.MaGV=d.MaGV) n
    WHERE d.MaDot=@MaDot AND
        ((d.SoCaQuyDinh=0 AND n.SoCa<>0) OR
         (d.SoCaQuyDinh>0 AND ABS(n.SoCa-d.SoCaQuyDinh)>ISNULL(cfg.DoLechDinhMucChoPhep,1)))
    UNION ALL
    SELECT N'RB2',N'Thiếu GV',NULL,c.MaCa,NULL,
           CONCAT(N'Ca ',c.MaCa,N' có ',(SELECT COUNT(*) FROM dbo.PhanCongCoiThi p WHERE p.MaCa=c.MaCa),N'/',c.SoGVCanCap,N' GV')
    FROM dbo.CaThi c
    WHERE c.MaDot=@MaDot AND (SELECT COUNT(*) FROM dbo.PhanCongCoiThi p WHERE p.MaCa=c.MaCa)<>c.SoGVCanCap
    ORDER BY MaRB,MaGV,MaCa;

    IF @ThrowIfFail=1 AND EXISTS(SELECT 1 FROM @RB WHERE SoViPham>0)
        THROW 53004,N'RB1-RB6 chưa đạt. Lịch chưa được chốt.',1;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ChotXepLich @MaDot VARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @N INT=(SELECT COUNT(*) FROM dbo.vw_ViPhamRangBuocCung WHERE MaDot=@MaDot);
    DECLARE @ThieuCa INT=(SELECT COUNT(*) FROM dbo.CaThi c WHERE c.MaDot=@MaDot AND
        (SELECT COUNT(*) FROM dbo.PhanCongCoiThi p WHERE p.MaCa=c.MaCa)<>c.SoGVCanCap);
    DECLARE @NgoaiDinhMuc INT=(SELECT COUNT(*)
        FROM dbo.DinhMucPhanCong d
        LEFT JOIN dbo.CauHinhXepLich cfg ON cfg.MaDot=d.MaDot
        CROSS APPLY (SELECT COUNT(*) AS SoCa
                     FROM dbo.PhanCongCoiThi p JOIN dbo.CaThi c ON c.MaCa=p.MaCa
                     WHERE c.MaDot=d.MaDot AND p.MaGV=d.MaGV) n
        WHERE d.MaDot=@MaDot AND
            ((d.SoCaQuyDinh=0 AND n.SoCa<>0) OR
             (d.SoCaQuyDinh>0 AND ABS(n.SoCa-d.SoCaQuyDinh)>ISNULL(cfg.DoLechDinhMucChoPhep,1))));
    DECLARE @TongCa INT=(SELECT COUNT(*) FROM dbo.PhanCongCoiThi p JOIN dbo.CaThi c ON c.MaCa=p.MaCa WHERE c.MaDot=@MaDot);
    DECLARE @CaTrungLichBan INT=(SELECT COUNT(*) FROM dbo.PhanCongCoiThi p JOIN dbo.CaThi c ON c.MaCa=p.MaCa
        WHERE c.MaDot=@MaDot AND EXISTS(SELECT 1 FROM dbo.LichBanGV b WHERE b.MaGV=p.MaGV AND b.UuTien IN(2,3)
            AND b.NgayBan=c.NgayThi AND c.TuTiet<=b.DenTiet AND b.TuTiet<=c.DenTiet));
    DECLARE @TyLeNeLichBan DECIMAL(5,2)=CASE WHEN @TongCa=0 THEN 100.00 ELSE 100.0*(@TongCa-@CaTrungLichBan)/@TongCa END;
    DECLARE @TyLeToiThieu DECIMAL(5,2)=(SELECT TyLeNeLichBanToiThieu FROM dbo.CauHinhXepLich WHERE MaDot=@MaDot);
    IF @N>0 OR @ThieuCa>0 OR @NgoaiDinhMuc>0
        THROW 53001,N'Không thể chốt: RB1-RB6 chưa đạt.',1;
    IF @TyLeNeLichBan<@TyLeToiThieu
        THROW 53005,N'Tỷ lệ né lịch bận mức 2-3 thấp hơn ngưỡng tối thiểu của đợt thi.',1;
    SELECT @MaDot MaDot,N'ĐẠT - có thể chốt lịch' KetQua,@TyLeNeLichBan TyLeNeLichBan,@TyLeToiThieu TyLeNeToiThieu;
END;
GO


/* 06. Trigger bao ve rang buoc khi co thay doi truc tiep tren bang phan cong/lich day. */
/* ========================= TRIGGER CHẶN VI PHẠM TỨC THỜI ========================= */
CREATE OR ALTER TRIGGER dbo.trg_PhanCong_RangBuocCung ON PhanCongCoiThi AFTER INSERT,UPDATE AS
BEGIN
 SET NOCOUNT ON;
 DECLARE @Loi NVARCHAR(1000);
 SELECT TOP 1 @Loi=CONCAT(N'[',v.MaRB,N'] ',v.MoTa) FROM vw_ViPhamRangBuocCung v WHERE v.MaRB IN(N'RB1',N'RB2',N'RB3',N'RB4',N'RB5',N'RB6') AND ((v.MaGV IN(SELECT MaGV FROM inserted)) OR (v.MaCa IN(SELECT MaCa FROM inserted)) OR (v.MaCaLienQuan IN(SELECT MaCa FROM inserted)));
 IF @Loi IS NOT NULL BEGIN ROLLBACK; THROW 53002,@Loi,1; END;
END;
GO

CREATE OR ALTER TRIGGER dbo.trg_LichDayGV_KhongDeCaThi ON LichDayGV AFTER INSERT,UPDATE
AS
BEGIN
 SET NOCOUNT ON;
 DECLARE @Loi NVARCHAR(1000);
 SELECT TOP 1 @Loi=CONCAT(N'[RB4] GV ',b.MaGV,N' có lịch dạy trùng ca thi ',c.MaCa)
 FROM inserted b
 JOIN CaThi c ON c.NgayThi=b.NgayDay AND c.TuTiet<=b.DenTiet AND b.TuTiet<=c.DenTiet
 JOIN PhanCongCoiThi p ON p.MaCa=c.MaCa AND p.MaGV=b.MaGV;
 IF @Loi IS NOT NULL BEGIN ROLLBACK; THROW 53003,@Loi,1; END;
END;
GO

/* 07. Du lieu mau Khoa CNTT, 53 giang vien, dot thi va 2 dinh muc vi du. */
/* ========================= DỮ LIỆU KHOA CNTT + 53 GV ========================= */
INSERT Khoa(MaKhoa,TenKhoa) VALUES('CNTT',N'Khoa Công nghệ Thông tin');
INSERT BoMon(MaBoMon,MaKhoa,TenBoMon) VALUES
('KHDL','CNTT',N'Khoa học dữ liệu'),
('HTTT','CNTT',N'Hệ thống thông tin'),
('KTPM','CNTT',N'Kỹ thuật phần mềm'),
('MMT_ATTT','CNTT',N'Mạng máy tính và An toàn thông tin'),
('CNSO','CNTT',N'Công nghệ số');
GO
INSERT GiangVien(MaGV,HoTen,HocVi,ChucVu,Email,MaBoMon) 
VALUES
('GV0001',N'Phùng Thế Bảo',N'Tiến sĩ, GVC',N'Trưởng Bộ môn',N'baopt@huit.edu.vn','KHDL'),
('GV0002',N'Nguyễn Thanh Long',N'Tiến sĩ',N'Phó Trưởng Khoa',N'longnt@huit.edu.vn','KHDL'),
('GV0003',N'Ngô Dương Hà',N'Thạc sĩ, NCS',N'Giảng viên',N'hand@huit.edu.vn','KHDL'),
('GV0004',N'Trần Việt Hùng',N'Tiến sĩ',N'Giảng viên',N'hungtv@huit.edu.vn','KHDL'),
('GV0005',N'Huỳnh Thị Châu Lan',N'Thạc sĩ',N'Giảng viên',N'lanhtc@huit.edu.vn','KHDL'),
('GV0006',N'Phan Thị Ngọc Mai',N'Thạc sĩ',N'Giảng viên',N'maiphantn@huit.edu.vn','KHDL'),
('GV0007',N'Đinh Nguyễn Trọng Nghĩa',N'Thạc sĩ',N'Giảng viên',N'nghiadnt@huit.edu.vn','KHDL'),
('GV0008',N'Nguyễn Thị Thùy Trang',N'Thạc sĩ',N'Giảng viên',N'trangntt@huit.edu.vn','KHDL'),
('GV0009',N'Trần Văn Thọ',N'Thạc sĩ',N'Giảng viên',N'thotv@huit.edu.vn','KHDL'),
('GV0010',N'Trần Đinh Toàn',N'Thạc sĩ',N'Giảng viên - CN CLB Học thuật',N'toantd@huit.edu.vn','KHDL'),
('GV0011',N'Nguyễn Hải Yến',N'Thạc sĩ',N'Giảng viên',N'yennh@huit.edu.vn','KHDL'),
('GV0012',N'Nguyễn Thị Huyền Trang',N'Thạc sĩ',N'Giảng viên',N'trangnthuyen@huit.eu.vn','KHDL'),
('GV0013',N'Nguyễn Văn Lễ',N'Thạc sĩ, NCS',N'Phó trưởng bộ môn',N'lenv@huit.edu.vn','HTTT'),
('GV0014',N'Trần Thị Vân Anh',N'Thạc sĩ',N'Giảng viên',N'anhttv@huit.edu.vn','HTTT'),
('GV0015',N'Nguyễn Thị Định',N'Tiến sĩ',N'Giảng viên',N'dinhnt@huit.edu.vn','HTTT'),
('GV0016',N'Nguyễn Thế Hữu',N'Thạc sĩ',N'Giảng viên - Bí thư Liên chi đoàn',N'huunthe@huit.edu.vn','HTTT'),
('GV0017',N'Lê Thị Thùy Lan',N'Thạc sĩ',N'Giảng viên',N'lanltt@huit.edu.vn','HTTT'),
('GV0018',N'Đinh Thị Mận',N'Thạc sĩ',N'Giảng viên',N'mandt@huit.edu.vn','HTTT'),
('GV0019',N'Nguyễn Thị Thu Tâm',N'Thạc sĩ',N'Giảng viên',N'tamntt@huit.edu.vn','HTTT'),
('GV0020',N'Nguyễn Thị Thanh Thủy',N'Thạc sĩ',N'Giảng viên',N'thuyntt@huit.edu.vn','HTTT'),
('GV0021',N'Trần Như Ý',N'Thạc sĩ',N'Giảng viên - Tổ trưởng công đoàn',N'ytn@huit.edu.vn','HTTT'),
('GV0022',N'Vũ Văn Vinh',N'Thạc sĩ, NCS',N'Phụ trách Bộ môn',N'vinhvv@huit.edu.vn','KTPM'),
('GV0023',N'Nguyễn Thị Bích Ngân',N'Tiến sĩ',N'Trưởng ngành sau đại học',N'nganntb@huit.edu.vn','KTPM'),
('GV0024',N'Vũ Thanh Nguyên',N'PGS, Tiến sĩ',N'Giảng viên',N'nguyenvt@huit.edu.vn','KTPM'),
('GV0025',N'Đào Minh Châu',N'Thạc sĩ',N'Giảng viên',N'chaudm@huit.edu.vn','KTPM'),
('GV0026',N'Bùi Công Danh',N'Thạc sĩ, NCS',N'Giảng viên',N'danhbc@huit.edu.vn','KTPM'),
('GV0027',N'Đinh Thị Tâm',N'Thạc sĩ',N'Giảng viên',N'tamdt@huit.edu.vn','KTPM'),
('GV0028',N'Mạnh Thiên Lý',N'Thạc sĩ',N'Giảng viên',N'lymt@huit.edu.vn','KTPM'),
('GV0029',N'Lâm Thị Họa Mi',N'Thạc sĩ',N'Giảng viên',N'milth@huit.edu.vn','KTPM'),
('GV0030',N'Dương Thị Mộng Thùy',N'Thạc sĩ',N'Giảng viên',N'thuydtm@huit.edu.vn','KTPM'),
('GV0031',N'Huỳnh Thị Cẩm Dung',N'Thạc sĩ',N'Giảng viên',N'dunghtc@huit.edu.vn','KTPM'),
('GV0032',N'Nguyễn Tuấn Anh',N'Tiến sĩ',N'Giảng viên',N'anhngt@huit.edu.vn','KTPM'),
('GV0033',N'Nguyễn Hồng Vũ',N'Tiến sĩ',N'Trưởng Khoa - Phụ trách bộ môn',N'vunh@huit.edu.vn','MMT_ATTT'),
('GV0034',N'Vũ Đức Thịnh',N'Tiến sĩ',N'Giảng viên',N'thinhvd@huit.edu.vn','MMT_ATTT'),
('GV0035',N'Đinh Huy Hoàng',N'Thạc sĩ',N'Giảng viên',N'hoangdh@huit.edu.vn','MMT_ATTT'),
('GV0036',N'Phạm Tuấn Khiêm',N'Thạc sĩ',N'Giảng viên',N'khiempt@huit.edu.vn','MMT_ATTT'),
('GV0037',N'Nguyễn Thị Hồng Thảo',N'Thạc sĩ',N'Giảng viên',N'thaonth@huit.edu.vn','MMT_ATTT'),
('GV0038',N'Trần Đắc Tốt',N'Thạc sĩ, NCS',N'Giảng viên',N'tottd@huit.edu.vn','MMT_ATTT'),
('GV0039',N'Nguyễn Văn Tùng',N'Thạc sĩ, NCS',N'Giảng viên',N'tungnv@huit.edu.vn','MMT_ATTT'),
('GV0040',N'Nguyễn Quốc Sử',N'Thạc sĩ, NCS',N'Giảng viên',N'sunq@huit.edu.vn','MMT_ATTT'),
('GV0041',N'Trần Thị Bích Vân',N'Thạc sĩ',N'Giảng viên',N'vanttb@huit.edu.vn','MMT_ATTT'),
('GV0042',N'Lê Anh Tuấn',N'Thạc sĩ',N'Giảng viên',N'tuanla@huit.edu.vn','MMT_ATTT'),
('GV0043',N'Lê Tỷ Khánh',N'Tiến sĩ',N'Giảng viên',N'khanhlt@huit.edu.vn','MMT_ATTT'),
('GV0044',N'Nguyễn Phương Hạc',N'Thạc sĩ',N'Giảng viên',N'hacnp@huit.edu.vn','MMT_ATTT'),
('GV0045',N'Phạm Nguyễn Huy Phương',N'Tiến sĩ',N'Giảng viên',N'phuongpnh@huit.edu.vn','MMT_ATTT'),
('GV0046',N'Hồ Hải Quân',N'Thạc sĩ, NCS',N'Giảng viên',N'quanhh@huit.edu.vn','MMT_ATTT'),
('GV0047',N'Trần Khải Thiện',N'Tiến sĩ',N'Phụ trách bộ môn',N'thientk@huit.edu.vn','CNSO'),
('GV0048',N'Huỳnh Thái Học',N'Tiến sĩ',N'Giảng viên',N'hocht@huit.edu.vn','CNSO'),
('GV0049',N'Nguyễn Thành Ngô',N'Tiến sĩ',N'Giảng viên',NULL,'CNSO'),
('GV0050',N'Lê Trần Minh Đạt',N'Tiến sĩ',N'Giảng viên',N'datltm@huit.edu.vn','CNSO'),
('GV0051',N'Vũ Phú Lộc',N'Thạc sĩ',N'Giảng viên',N'locvp@huit.edu.vn','CNSO'),
('GV0052',N'Lữ Thị Cẩm Tú',N'Thạc sĩ',N'Giảng viên',N'tultc@huit.edu.vn','CNSO'),
('GV0053',N'Võ Hoàng Hải',N'Thạc sĩ',N'Giảng viên',N'haivh@huit.edu.vn','CNSO');
GO
/* Ví dụ mở rộng Khoa mới: chỉ cần thêm Khoa -> Bộ môn -> Giảng viên, không sửa cấu trúc bảng. */

/* Tạo một đợt thi mẫu để kiểm thử */
IF NOT EXISTS(SELECT 1 FROM DotThi WHERE MaDot='DOT2026_01')
    INSERT DotThi(MaDot,TenDot,NgayBatDau,NgayKetThuc) VALUES('DOT2026_01',N'Đợt thi mẫu 2026','2026-12-01','2026-12-31');
IF NOT EXISTS(SELECT 1 FROM CauHinhXepLich WHERE MaDot='DOT2026_01')
    INSERT CauHinhXepLich(MaDot) VALUES('DOT2026_01');
GO

/* Ví dụ định mức 100% / 50% cho hai GV. Khi tổng nhu cầu = 15 lượt,
   thủ tục sẽ tính 10 và 5. Không hard-code 10/5. */
INSERT DinhMucPhanCong(MaDot,MaGV,TyLeDinhMuc) VALUES
('DOT2026_01','GV0001',100),('DOT2026_01','GV0002',50);
GO

/* Tao tai khoan portal cho cac giang vien dang cong tac. Backend xu ly mat khau tam khi dang nhap lan dau. */
/* Tạo tài khoản cho giảng viên hiện có; mật khẩu tạm 1 được xử lý ở backend,
   chỉ được dùng để vào luồng đổi mật khẩu lần đầu. */
INSERT INTO dbo.TaiKhoanGiangVien(MaGV, PasswordHash, MustChangePassword, IsActive)
SELECT gv.MaGV, NULL, 1, 1
FROM dbo.GiangVien gv
WHERE gv.TrangThai=N'Đang công tác'
  AND NOT EXISTS (SELECT 1 FROM dbo.TaiKhoanGiangVien tk WHERE tk.MaGV=gv.MaGV);
GO

/* 08. Goi y thao tac sau khi cai dat (bo comment tung lenh can dung). */
-- EXEC dbo.sp_DatDinhMucChung @MaDot='DOT2026_01', @TyLe=100, @MaKhoa='CNTT';
-- EXEC dbo.sp_TinhDinhMucTheoTyLe @MaDot='DOT2026_01';
-- EXEC dbo.sp_KiemTraRangBuoc @MaDot='DOT2026_01';
-- EXEC dbo.sp_ChotXepLich @MaDot='DOT2026_01';
GO
