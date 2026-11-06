/*
    HỆ THỐNG QUẢN LÝ VÀ XẾP LỊCH COI THI - SQL SERVER
    Bản cài đặt tổng hợp, sắp xếp theo nhóm chức năng.

    Yêu cầu SQL Server 2019 trở lên.

    RÀNG BUỘC CỨNG THEO PROJECT:
      RB1  Phân công khớp định mức chính xác, có tính các lần đổi ca đã duyệt.
      RB2  Mỗi ca có đúng số giảng viên cần cấp.
      RB3  Giảng viên không bị xếp hai ca trùng tiết trong cùng ngày.
      RB4  Không xếp giám thị trùng lịch dạy hoặc lịch trực đề.
      RB5  Không trộn nhóm hình thức thi trong cùng ngày và buổi.
      RB6  Không xếp trùng lịch bận ưu tiên 1.
      RB7  Lịch dạy khác cơ sở phải có đủ thời gian di chuyển.
      RB9  Giới hạn ca trong ngày và lịch nối tiếp.

    TIÊU CHÍ MỀM:
        Ưu tiên 1 / RB8  Tránh ca tối khi lịch trong ngày đã dày (10.000.000 điểm/ngày vi phạm)
        Ưu tiên 2 / S1   Giảm ngày tới trường (1.000.000 điểm/ngày); phạt thêm 1.000.000
                         điểm nếu ngày đó chỉ có một ca coi thi, không có lịch dạy/trực đề.
        Ưu tiên 3 / S3   Giảm ca gãy: hạn chế khoảng trống 1-2 tiết (500.000 điểm/tiết trống).
        Ưu tiên 4 / S2   Cân bằng ca sáng/chiều/tối theo định mức (200.000 điểm/đơn vị lệch,
                         ca tối tính gấp đôi).
        Ưu tiên 5 / S4   Gom lịch coi thi của từng giảng viên vào ít tuần nhất
                         (10.000 điểm/giảng viên-tuần có lịch).
        Ưu tiên 6 / S5   Cân bằng hình thức thi theo định mức (1.000 điểm/đơn vị lệch).
        Ưu tiên 7 / S6   Né lịch bận mức 2 (100 điểm/ca trùng).
        Ưu tiên 8 / S7   Né lịch bận mức 3 (10 điểm/ca trùng).

    Tám tiêu chí mềm được tối ưu trong backend CP-SAT, không phải lỗi chặn
    chốt lịch trong SQL. SQL lưu cấu hình riêng theo đợt; giao diện đọc/ghi cấu
    hình này và backend đọc trực tiếp trước khi gọi solver.

    RESET DATABASE: mỗi lần chạy sẽ xóa toàn bộ DB_XepLichCoiThi_Final (nếu có)
    rồi tạo lại từ đầu. Toàn bộ dữ liệu trong database này sẽ bị mất.
    Chỉ chạy khi nhóm đã chủ động sao lưu hoặc chấp nhận xóa sạch database.
*/

USE master;
GO
IF DB_ID(N'DB_XepLichCoiThi_Final') IS NOT NULL
BEGIN
    ALTER DATABASE [DB_XepLichCoiThi_Final] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE [DB_XepLichCoiThi_Final];
END;
GO
DECLARE @XepLichFreshInstall BIT = 1;
EXEC(N'CREATE DATABASE [DB_XepLichCoiThi_Final] COLLATE Latin1_General_100_CI_AS_SC_UTF8;');
EXEC sys.sp_set_session_context @key=N'XepLichFreshInstall', @value=@XepLichFreshInstall;
GO
USE DB_XepLichCoiThi_Final;
GO
IF OBJECT_ID(N'dbo.Khoa',N'U') IS NULL
CREATE TABLE Khoa (
    MaKhoa VARCHAR(20) NOT NULL,
    TenKhoa NVARCHAR(200) NOT NULL,
    Email VARCHAR(150) NULL,
    TrangThai NVARCHAR(30) NOT NULL CONSTRAINT DF_Khoa_TrangThai DEFAULT N'Đang hoạt động',
    CONSTRAINT PK_Khoa PRIMARY KEY (MaKhoa),
    CONSTRAINT UQ_Khoa_Ten UNIQUE (TenKhoa)
);
GO

IF OBJECT_ID(N'dbo.BoMon',N'U') IS NULL
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

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'IX_BoMon_MaKhoa' AND object_id=OBJECT_ID(N'dbo.BoMon'))
    CREATE INDEX IX_BoMon_MaKhoa ON BoMon(MaKhoa);
GO

IF OBJECT_ID(N'dbo.GiangVien',N'U') IS NULL
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
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'IX_GiangVien_MaBoMon' AND object_id=OBJECT_ID(N'dbo.GiangVien'))
    CREATE INDEX IX_GiangVien_MaBoMon ON GiangVien(MaBoMon);
GO

IF OBJECT_ID(N'dbo.DotThi',N'U') IS NULL
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

IF OBJECT_ID(N'dbo.CauHinhXepLich',N'U') IS NULL
CREATE TABLE CauHinhXepLich (
    MaDot VARCHAR(20) NOT NULL,
    SoTietGapToiThieuCaGay INT NOT NULL CONSTRAINT DF_CFG_CaGay DEFAULT 1,
    SoTietDiChuyenToiThieu INT NOT NULL CONSTRAINT DF_CFG_DiChuyen DEFAULT (1),
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
    ),
    CONSTRAINT CK_CFG_DiChuyen CHECK(SoTietDiChuyenToiThieu BETWEEN 1 AND 4)
);
GO

/* Cấu hình ràng buộc mềm được lưu riêng cho từng đợt thi. */
IF OBJECT_ID(N'dbo.CauHinhRangBuocMem',N'U') IS NULL
CREATE TABLE dbo.CauHinhRangBuocMem (
    MaDot VARCHAR(20) NOT NULL,
    MaRB VARCHAR(10) NOT NULL,
    Bat BIT NOT NULL CONSTRAINT DF_CauHinhRBMem_Bat DEFAULT 1,
    MucUuTien TINYINT NOT NULL,
    DiemPhat BIGINT NOT NULL,
    CONSTRAINT PK_CauHinhRangBuocMem PRIMARY KEY(MaDot,MaRB),
    CONSTRAINT UQ_CauHinhRangBuocMem_UuTien UNIQUE(MaDot,MucUuTien),
    CONSTRAINT FK_CauHinhRangBuocMem_Dot FOREIGN KEY(MaDot) REFERENCES dbo.DotThi(MaDot) ON DELETE CASCADE,
    CONSTRAINT CK_CauHinhRangBuocMem_UuTien CHECK(MucUuTien BETWEEN 1 AND 8),
    CONSTRAINT CK_CauHinhRangBuocMem_Diem CHECK(DiemPhat>0),
    CONSTRAINT CK_CauHinhRangBuocMem_MaRB CHECK(MaRB IN('RB8','S1','S2','S3','S4','S5','S6','S7'))
);
GO

CREATE OR ALTER PROCEDURE dbo.sp_KhoiTaoCauHinhRangBuocMem @MaDot VARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @BatHienTai TABLE(MaRB VARCHAR(10) PRIMARY KEY, Bat BIT NOT NULL);
    DECLARE @BatTheoMaMoi TABLE(MaRB VARCHAR(10) PRIMARY KEY, Bat BIT NOT NULL);
    BEGIN TRY
        BEGIN TRANSACTION;
        INSERT @BatHienTai(MaRB,Bat)
        SELECT MaRB,Bat FROM dbo.CauHinhRangBuocMem WITH (UPDLOCK,HOLDLOCK) WHERE MaDot=@MaDot;
        IF EXISTS(SELECT 1 FROM @BatHienTai WHERE MaRB='RB8')
            INSERT @BatTheoMaMoi(MaRB,Bat) SELECT MaRB,Bat FROM @BatHienTai;
        ELSE
            INSERT @BatTheoMaMoi(MaRB,Bat)
            SELECT v.MaRB,old.Bat
            FROM (VALUES
                ('S2','S1'),('S3','S2'),('S4','S3'),('S5','S4'),('S6','S5'),('S7','S6')
            ) v(MaRB,MaRBCu)
            JOIN @BatHienTai old ON old.MaRB=v.MaRBCu;
        DELETE FROM dbo.CauHinhRangBuocMem WHERE MaDot=@MaDot;
        INSERT dbo.CauHinhRangBuocMem(MaDot,MaRB,Bat,MucUuTien,DiemPhat)
        SELECT @MaDot,v.MaRB,COALESCE(old.Bat,1),v.MucUuTien,v.DiemPhat
        FROM (VALUES
            ('RB8',1,CAST( 10000000 AS BIGINT)),
            ('S1', 2,CAST(  1000000 AS BIGINT)),
            ('S3', 3,CAST(   500000 AS BIGINT)),
            ('S2', 4,CAST(   200000 AS BIGINT)),
            ('S4', 5,CAST(    10000 AS BIGINT)),
            ('S5', 6,CAST(     1000 AS BIGINT)),
            ('S6', 7,CAST(      100 AS BIGINT)),
            ('S7', 8,CAST(       10 AS BIGINT))
        ) v(MaRB,MucUuTien,DiemPhat)
        LEFT JOIN @BatTheoMaMoi old ON old.MaRB=v.MaRB;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

/* Lịch dạy cố định: IMPORT từ lịch giảng dạy chính thức. Hard constraint 100%, tuyệt đối không xếp gác trùng. */
IF OBJECT_ID(N'dbo.LichDayGV',N'U') IS NULL
CREATE TABLE LichDayGV (
    ID INT IDENTITY(1,1) NOT NULL,
    MaGV VARCHAR(20) NOT NULL,
    NgayDay DATE NOT NULL,
    TuTiet INT NOT NULL,
    DenTiet INT NOT NULL,
    Phong NVARCHAR(100) NULL,
    NguonFile NVARCHAR(255) NULL,
    GhiChu NVARCHAR(255) NULL,
    CONSTRAINT PK_LichDayGV PRIMARY KEY(ID),
    CONSTRAINT FK_LichDayGV_GV FOREIGN KEY(MaGV) REFERENCES GiangVien(MaGV) ON DELETE CASCADE,
    CONSTRAINT CK_LichDayGV_Tiet CHECK(TuTiet BETWEEN 1 AND 16 AND DenTiet BETWEEN TuTiet AND 16),
    CONSTRAINT UQ_LichDayGV UNIQUE(MaGV,NgayDay,TuTiet,DenTiet)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'IX_LichDayGV_GV_Ngay' AND object_id=OBJECT_ID(N'dbo.LichDayGV'))
    CREATE INDEX IX_LichDayGV_GV_Ngay ON LichDayGV(MaGV,NgayDay,TuTiet,DenTiet);
GO

/* Lịch bận phát sinh: đám tiệc, việc gia đình, người nhà bệnh... Soft constraint, cố gắng né. */
IF OBJECT_ID(N'dbo.LichBanGV',N'U') IS NULL
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
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'IX_LBGV_GV_Ngay' AND object_id=OBJECT_ID(N'dbo.LichBanGV'))
    CREATE INDEX IX_LBGV_GV_Ngay ON LichBanGV(MaGV,NgayBan,TuTiet,DenTiet);
GO

IF OBJECT_ID(N'dbo.CaThi',N'U') IS NULL
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
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'IX_CaThi_Dot_Ngay' AND object_id=OBJECT_ID(N'dbo.CaThi'))
    CREATE INDEX IX_CaThi_Dot_Ngay ON CaThi(MaDot,NgayThi,TuTiet,DenTiet,Buoi,NhomHinhThucThi);
GO

IF OBJECT_ID(N'dbo.DinhMucPhanCong',N'U') IS NULL
CREATE TABLE DinhMucPhanCong (
    MaDot VARCHAR(20) NOT NULL,
    MaGV VARCHAR(20) NOT NULL,
    TyLeDinhMuc DECIMAL(5,2) NOT NULL,
    SoCaQuyDinh INT NOT NULL CONSTRAINT DF_DM_SoCa DEFAULT 0,
    SoCaThuCong BIT NOT NULL CONSTRAINT DF_DM_SoCaThuCong DEFAULT 0,
    GhiChu NVARCHAR(255) NULL,
    CONSTRAINT PK_DinhMuc PRIMARY KEY(MaDot,MaGV),
    CONSTRAINT FK_DM_Dot FOREIGN KEY(MaDot) REFERENCES DotThi(MaDot) ON DELETE CASCADE,
    CONSTRAINT FK_DM_GV FOREIGN KEY(MaGV) REFERENCES GiangVien(MaGV),
    CONSTRAINT CK_DM_TyLe CHECK(TyLeDinhMuc BETWEEN 0 AND 100),
    CONSTRAINT CK_DM_SoCa CHECK(SoCaQuyDinh>=0)
);
GO

IF OBJECT_ID(N'dbo.PhanCongCoiThi',N'U') IS NULL
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
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'IX_PCT_GV' AND object_id=OBJECT_ID(N'dbo.PhanCongCoiThi'))
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
CREATE PROCEDURE dbo.sp_TinhDinhMucTheoTyLe @MaDot VARCHAR(20)
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
CREATE PROCEDURE dbo.sp_DatDinhMucChung
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

CREATE PROCEDURE dbo.sp_CapNhatTyLeDinhMuc
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
CREATE PROCEDURE dbo.sp_ThemKhoa @MaKhoa VARCHAR(20),@TenKhoa NVARCHAR(200),@Email VARCHAR(150)=NULL
AS BEGIN SET NOCOUNT ON; IF EXISTS(SELECT 1 FROM Khoa WHERE MaKhoa=@MaKhoa) THROW 52001,N'Mã khoa đã tồn tại.',1; INSERT Khoa(MaKhoa,TenKhoa,Email) VALUES(@MaKhoa,@TenKhoa,@Email); END;
GO
CREATE PROCEDURE dbo.sp_SuaKhoa @MaKhoa VARCHAR(20),@TenKhoa NVARCHAR(200),@Email VARCHAR(150)=NULL,@TrangThai NVARCHAR(30)=N'Đang hoạt động'
AS BEGIN SET NOCOUNT ON; IF NOT EXISTS(SELECT 1 FROM Khoa WHERE MaKhoa=@MaKhoa) THROW 52002,N'Không tìm thấy khoa.',1; UPDATE Khoa SET TenKhoa=@TenKhoa,Email=@Email,TrangThai=@TrangThai WHERE MaKhoa=@MaKhoa; END;
GO
CREATE PROCEDURE dbo.sp_XoaKhoa @MaKhoa VARCHAR(20)
AS BEGIN SET NOCOUNT ON; IF EXISTS(SELECT 1 FROM BoMon WHERE MaKhoa=@MaKhoa) THROW 52003,N'Không thể xóa khoa vì còn bộ môn. Hãy chuyển/xóa bộ môn trước.',1; DELETE Khoa WHERE MaKhoa=@MaKhoa; END;
GO

CREATE PROCEDURE dbo.sp_ThemBoMon @MaBoMon VARCHAR(20),@MaKhoa VARCHAR(20),@TenBoMon NVARCHAR(200)
AS BEGIN SET NOCOUNT ON; IF NOT EXISTS(SELECT 1 FROM Khoa WHERE MaKhoa=@MaKhoa) THROW 52101,N'Khoa không tồn tại.',1; INSERT BoMon(MaBoMon,MaKhoa,TenBoMon) VALUES(@MaBoMon,@MaKhoa,@TenBoMon); END;
GO
CREATE PROCEDURE dbo.sp_SuaBoMon @MaBoMon VARCHAR(20),@MaKhoa VARCHAR(20),@TenBoMon NVARCHAR(200),@TrangThai NVARCHAR(30)=N'Đang hoạt động'
AS BEGIN SET NOCOUNT ON; UPDATE BoMon SET MaKhoa=@MaKhoa,TenBoMon=@TenBoMon,TrangThai=@TrangThai WHERE MaBoMon=@MaBoMon; IF @@ROWCOUNT=0 THROW 52102,N'Không tìm thấy bộ môn.',1; END;
GO
CREATE PROCEDURE dbo.sp_XoaBoMon @MaBoMon VARCHAR(20)
AS BEGIN SET NOCOUNT ON; IF EXISTS(SELECT 1 FROM GiangVien WHERE MaBoMon=@MaBoMon) THROW 52103,N'Không thể xóa bộ môn vì còn giảng viên.',1; DELETE BoMon WHERE MaBoMon=@MaBoMon; END;
GO

CREATE PROCEDURE dbo.sp_ThemGiangVien
 @MaGV VARCHAR(20),@HoTen NVARCHAR(120),@HocVi NVARCHAR(100)=NULL,@ChucVu NVARCHAR(200)=NULL,@Email VARCHAR(150)=NULL,@SoDienThoai VARCHAR(30)=NULL,@MaBoMon VARCHAR(20)
AS BEGIN SET NOCOUNT ON; IF EXISTS(SELECT 1 FROM GiangVien WHERE MaGV=@MaGV) THROW 52201,N'Mã giảng viên đã tồn tại.',1; IF NOT EXISTS(SELECT 1 FROM BoMon WHERE MaBoMon=@MaBoMon) THROW 52202,N'Bộ môn không tồn tại.',1; INSERT GiangVien(MaGV,HoTen,HocVi,ChucVu,Email,SoDienThoai,MaBoMon) VALUES(@MaGV,@HoTen,@HocVi,@ChucVu,@Email,@SoDienThoai,@MaBoMon); END;
GO
CREATE PROCEDURE dbo.sp_SuaGiangVien
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
CREATE PROCEDURE dbo.sp_XoaGiangVien @MaGV VARCHAR(20)
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF NOT EXISTS(SELECT 1 FROM dbo.GiangVien WHERE MaGV=@MaGV) THROW 52204,N'Không tìm thấy giảng viên.',1;
 UPDATE dbo.GiangVien SET TrangThai=N'Ngừng công tác' WHERE MaGV=@MaGV;
 SELECT MaGV,HoTen,MaBoMon,TrangThai FROM dbo.GiangVien WHERE MaGV=@MaGV;
END;
GO

CREATE PROCEDURE dbo.sp_DanhSachGiangVien @MaKhoa VARCHAR(20)=NULL,@MaBoMon VARCHAR(20)=NULL,@TrangThai NVARCHAR(30)=NULL
AS BEGIN SET NOCOUNT ON; SELECT g.MaGV,g.HoTen,g.HocVi,g.ChucVu,g.Email,g.SoDienThoai,bm.MaBoMon,bm.TenBoMon,k.MaKhoa,k.TenKhoa,g.TrangThai FROM GiangVien g JOIN BoMon bm ON bm.MaBoMon=g.MaBoMon JOIN Khoa k ON k.MaKhoa=bm.MaKhoa WHERE (@MaKhoa IS NULL OR k.MaKhoa=@MaKhoa) AND (@MaBoMon IS NULL OR bm.MaBoMon=@MaBoMon) AND (@TrangThai IS NULL OR g.TrangThai=@TrangThai) ORDER BY k.TenKhoa,bm.TenBoMon,g.HoTen; END;
GO


/* ========================= CRUD ĐỢT THI / CA THI / LỊCH BẬN ========================= */
CREATE PROCEDURE dbo.sp_ThemDotThi
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
 EXEC dbo.sp_KhoiTaoCauHinhRangBuocMem @MaDot;
 SELECT MaDot,TenDot,HocKy,NamHoc,LoaiDot,NgayBatDau,NgayKetThuc,GhiChu FROM DotThi WHERE MaDot=@MaDot;
END;
GO
CREATE PROCEDURE dbo.sp_SuaDotThi
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
CREATE PROCEDURE dbo.sp_XoaDotThi @MaDot VARCHAR(20)
AS
BEGIN
 SET NOCOUNT ON;
 DELETE FROM DotThi WHERE MaDot=@MaDot;
 IF @@ROWCOUNT=0 THROW 52303,N'Không tìm thấy đợt thi.',1;
END;
GO
CREATE PROCEDURE dbo.sp_DanhSachDotThi
AS
BEGIN
 SET NOCOUNT ON;
 SELECT MaDot,TenDot,HocKy,NamHoc,LoaiDot,NgayBatDau,NgayKetThuc,GhiChu FROM DotThi ORDER BY NamHoc DESC,CASE HocKy WHEN 'HK1' THEN 1 WHEN 'HK2' THEN 2 ELSE 3 END,NgayBatDau DESC;
END;
GO
CREATE PROCEDURE dbo.sp_DanhSachCaThi @MaDot VARCHAR(20)=NULL
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
CREATE PROCEDURE dbo.sp_ThemCaThi
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
CREATE PROCEDURE dbo.sp_SuaCaThi
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
CREATE PROCEDURE dbo.sp_XoaCaThi @MaCa VARCHAR(50)
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 DECLARE @MaDot VARCHAR(20); SELECT @MaDot=MaDot FROM CaThi WHERE MaCa=@MaCa;
 IF @MaDot IS NULL THROW 52403,N'Không tìm thấy ca thi.',1;
 DELETE FROM CaThi WHERE MaCa=@MaCa;
 IF EXISTS(SELECT 1 FROM DinhMucPhanCong WHERE MaDot=@MaDot) EXEC dbo.sp_TinhDinhMucTheoTyLe @MaDot;
END;
GO
IF TYPE_ID(N'dbo.LichDayGVInput') IS NULL
    EXEC(N'CREATE TYPE dbo.LichDayGVInput AS TABLE(
        NgayDay DATE NOT NULL,
        TuTiet INT NOT NULL,
        DenTiet INT NOT NULL
    );');
GO

CREATE PROCEDURE dbo.sp_ThayTheLichDayGV
 @MaGV VARCHAR(20),@NguonFile NVARCHAR(255)=NULL,@Rows dbo.LichDayGVInput READONLY
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF NOT EXISTS(SELECT 1 FROM dbo.GiangVien WHERE MaGV=@MaGV AND TrangThai=N'Đang công tác') THROW 52500,N'Giảng viên không tồn tại hoặc không còn công tác.',1;
 DELETE FROM dbo.LichDayGV WHERE MaGV=@MaGV;
 INSERT dbo.LichDayGV(MaGV,NgayDay,TuTiet,DenTiet,NguonFile) SELECT @MaGV,NgayDay,TuTiet,DenTiet,@NguonFile FROM @Rows;
END;
GO

CREATE PROCEDURE dbo.sp_ThemLichDayGV
 @MaGV VARCHAR(20),@NgayDay DATE,@TuTiet INT,@DenTiet INT,@NguonFile NVARCHAR(255)=NULL,@GhiChu NVARCHAR(255)=NULL
AS
BEGIN SET NOCOUNT ON; INSERT dbo.LichDayGV(MaGV,NgayDay,TuTiet,DenTiet,NguonFile,GhiChu) VALUES(@MaGV,@NgayDay,@TuTiet,@DenTiet,@NguonFile,@GhiChu); END;
GO
CREATE PROCEDURE dbo.sp_XoaLichDayGV @ID INT
AS BEGIN SET NOCOUNT ON; DELETE FROM dbo.LichDayGV WHERE ID=@ID; IF @@ROWCOUNT=0 THROW 52503,N'Không tìm thấy lịch dạy.',1; END;
GO

CREATE PROCEDURE dbo.sp_ThemLichBanGV
 @MaGV VARCHAR(20),@NgayBan DATE,@TuTiet INT,@DenTiet INT,@LyDo NVARCHAR(255)=NULL,@UuTien TINYINT=3
AS
BEGIN SET NOCOUNT ON; INSERT LichBanGV(MaGV,NgayBan,TuTiet,DenTiet,LyDo,UuTien) VALUES(@MaGV,@NgayBan,@TuTiet,@DenTiet,@LyDo,@UuTien); END;
GO
CREATE PROCEDURE dbo.sp_SuaLichBanGV
 @ID INT,@NgayBan DATE,@TuTiet INT,@DenTiet INT,@LyDo NVARCHAR(255)=NULL,@UuTien TINYINT=3
AS
BEGIN SET NOCOUNT ON; UPDATE LichBanGV SET NgayBan=@NgayBan,TuTiet=@TuTiet,DenTiet=@DenTiet,LyDo=@LyDo,UuTien=@UuTien WHERE ID=@ID; IF @@ROWCOUNT=0 THROW 52501,N'Không tìm thấy lịch bận.',1; END;
GO
CREATE PROCEDURE dbo.sp_XoaLichBanGV @ID INT
AS BEGIN SET NOCOUNT ON; DELETE FROM LichBanGV WHERE ID=@ID; IF @@ROWCOUNT=0 THROW 52502,N'Không tìm thấy lịch bận.',1; END;
GO

CREATE PROCEDURE dbo.sp_ThemDinhMuc
 @MaDot VARCHAR(20),@MaGV VARCHAR(20),@TyLeDinhMuc DECIMAL(5,2),@GhiChu NVARCHAR(255)=NULL
AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS(SELECT 1 FROM DinhMucPhanCong WHERE MaDot=@MaDot AND MaGV=@MaGV) THROW 52601,N'Giảng viên đã có định mức trong đợt thi.',1;
 INSERT DinhMucPhanCong(MaDot,MaGV,TyLeDinhMuc,GhiChu) VALUES(@MaDot,@MaGV,@TyLeDinhMuc,@GhiChu);
 EXEC dbo.sp_TinhDinhMucTheoTyLe @MaDot;
END;
GO
CREATE PROCEDURE dbo.sp_XoaDinhMuc @MaDot VARCHAR(20),@MaGV VARCHAR(20)
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

CREATE PROCEDURE dbo.sp_KiemTraRangBuoc
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

CREATE PROCEDURE dbo.sp_ChotXepLich @MaDot VARCHAR(20)
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
    -- Busy levels 2-3 are soft optimization criteria. Report their rate,
    -- but do not block publishing a schedule that satisfies the hard rules.
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
IF TRY_CONVERT(BIT,SESSION_CONTEXT(N'XepLichFreshInstall'))=1
   AND NOT EXISTS (SELECT 1 FROM dbo.Khoa WHERE MaKhoa='CNTT')
    INSERT Khoa(MaKhoa,TenKhoa) VALUES('CNTT',N'Khoa Công nghệ Thông tin');
IF TRY_CONVERT(BIT,SESSION_CONTEXT(N'XepLichFreshInstall'))=1
INSERT BoMon(MaBoMon,MaKhoa,TenBoMon)
SELECT v.MaBoMon,v.MaKhoa,v.TenBoMon
FROM (VALUES
('KHDL','CNTT',N'Khoa học dữ liệu'),
('HTTT','CNTT',N'Hệ thống thông tin'),
('KTPM','CNTT',N'Kỹ thuật phần mềm'),
('MMT_ATTT','CNTT',N'Mạng máy tính và An toàn thông tin'),
('CNSO','CNTT',N'Công nghệ số')
) AS v(MaBoMon,MaKhoa,TenBoMon)
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.BoMon b
    WHERE b.MaBoMon=v.MaBoMon OR (b.MaKhoa=v.MaKhoa AND b.TenBoMon=v.TenBoMon)
);
GO
IF TRY_CONVERT(BIT,SESSION_CONTEXT(N'XepLichFreshInstall'))=1
INSERT GiangVien(MaGV,HoTen,HocVi,ChucVu,Email,MaBoMon)
SELECT v.MaGV,v.HoTen,v.HocVi,v.ChucVu,v.Email,v.MaBoMon
FROM (VALUES
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
('GV0053',N'Võ Hoàng Hải',N'Thạc sĩ',N'Giảng viên',N'haivh@huit.edu.vn','CNSO')
) AS v(MaGV,HoTen,HocVi,ChucVu,Email,MaBoMon)
WHERE NOT EXISTS (SELECT 1 FROM dbo.GiangVien g WHERE g.MaGV=v.MaGV);
GO
/* Ví dụ mở rộng Khoa mới: chỉ cần thêm Khoa -> Bộ môn -> Giảng viên, không sửa cấu trúc bảng. */

/* Tạo một đợt thi mẫu để kiểm thử */
IF TRY_CONVERT(BIT,SESSION_CONTEXT(N'XepLichFreshInstall'))=1
   AND NOT EXISTS(SELECT 1 FROM DotThi WHERE MaDot='DOT2026_01')
    INSERT DotThi(MaDot,TenDot,NgayBatDau,NgayKetThuc) VALUES('DOT2026_01',N'Đợt thi mẫu 2026','2026-12-01','2026-12-31');
IF TRY_CONVERT(BIT,SESSION_CONTEXT(N'XepLichFreshInstall'))=1
   AND NOT EXISTS(SELECT 1 FROM CauHinhXepLich WHERE MaDot='DOT2026_01')
    INSERT CauHinhXepLich(MaDot) VALUES('DOT2026_01');
IF TRY_CONVERT(BIT,SESSION_CONTEXT(N'XepLichFreshInstall'))=1
    EXEC dbo.sp_KhoiTaoCauHinhRangBuocMem @MaDot='DOT2026_01';
GO

/* Ví dụ định mức 100% / 50% cho hai GV. Khi tổng nhu cầu = 15 lượt,
   thủ tục sẽ tính 10 và 5. Không hard-code 10/5. */
IF TRY_CONVERT(BIT,SESSION_CONTEXT(N'XepLichFreshInstall'))=1
INSERT DinhMucPhanCong(MaDot,MaGV,TyLeDinhMuc)
SELECT v.MaDot,v.MaGV,v.TyLeDinhMuc
FROM (VALUES ('DOT2026_01','GV0001',100),('DOT2026_01','GV0002',50)) AS v(MaDot,MaGV,TyLeDinhMuc)
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.DinhMucPhanCong d
    WHERE d.MaDot=v.MaDot AND d.MaGV=v.MaGV
);
GO

/* Tao tai khoan portal cho cac giang vien dang cong tac. Backend xu ly mat khau tam khi dang nhap lan dau. */
/* Tạo tài khoản cho giảng viên hiện có; mật khẩu tạm 1 được xử lý ở backend,
   chỉ được dùng để vào luồng đổi mật khẩu lần đầu. */
IF TRY_CONVERT(BIT,SESSION_CONTEXT(N'XepLichFreshInstall'))=1
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
IF OBJECT_ID(N'dbo.YeuCauBaoBan', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.YeuCauBaoBan (
        MaYeuCau BIGINT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_YeuCauBaoBan PRIMARY KEY,
        MaGV VARCHAR(20) NOT NULL,
        MaCa VARCHAR(50) NULL,
        MaGVThayTheDeNghi VARCHAR(20) NULL,
        ThoiGianBatDauBan DATETIME2 NOT NULL,
        ThoiGianKetThucBan DATETIME2 NOT NULL,
        LyDoBaoBan NVARCHAR(500) NOT NULL,
        GhiChuGV NVARCHAR(500) NULL,
        TrangThai VARCHAR(20) NOT NULL
            CONSTRAINT DF_YCBB_TrangThai DEFAULT ('PENDING'),
        LyDoTuChoi NVARCHAR(500) NULL,
        GhiChuAdmin NVARCHAR(500) NULL,
        NguoiXuLy NVARCHAR(100) NULL,
        ThoiGianGui DATETIME2 NOT NULL
            CONSTRAINT DF_YCBB_ThoiGianGui DEFAULT (SYSDATETIME()),
        ThoiGianXuLy DATETIME2 NULL,
        CONSTRAINT FK_YCBB_GiangVien FOREIGN KEY (MaGV)
            REFERENCES dbo.GiangVien(MaGV),
        CONSTRAINT FK_YCBB_CaThi FOREIGN KEY (MaCa)
            REFERENCES dbo.CaThi(MaCa),
        CONSTRAINT FK_YCBB_GVThayThe FOREIGN KEY (MaGVThayTheDeNghi)
            REFERENCES dbo.GiangVien(MaGV),
        CONSTRAINT CK_YCBB_ThoiGian CHECK (ThoiGianBatDauBan < ThoiGianKetThucBan),
        CONSTRAINT CK_YCBB_TrangThai CHECK (TrangThai IN ('PENDING','APPROVED','REJECTED','WITHDRAWN'))
    );
END;
GO

/* Bổ sung cột cho database đã có bảng YeuCauBaoBan từ phiên bản cũ. */
IF COL_LENGTH(N'dbo.YeuCauBaoBan', N'MaGVThayTheDeNghi') IS NULL
    ALTER TABLE dbo.YeuCauBaoBan ADD MaGVThayTheDeNghi VARCHAR(20) NULL;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE parent_object_id = OBJECT_ID(N'dbo.YeuCauBaoBan')
      AND name = N'FK_YCBB_GVThayThe'
)
BEGIN
    ALTER TABLE dbo.YeuCauBaoBan
        ADD CONSTRAINT FK_YCBB_GVThayThe
        FOREIGN KEY (MaGVThayTheDeNghi) REFERENCES dbo.GiangVien(MaGV);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.YeuCauBaoBan') AND name=N'IX_YCBB_GV_TrangThai')
    CREATE INDEX IX_YCBB_GV_TrangThai ON dbo.YeuCauBaoBan(MaGV,TrangThai,ThoiGianGui DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.YeuCauBaoBan') AND name=N'IX_YCBB_TrangThai')
    CREATE INDEX IX_YCBB_TrangThai ON dbo.YeuCauBaoBan(TrangThai,ThoiGianGui DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.YeuCauBaoBan') AND name=N'IX_YCBB_Ca')
    CREATE INDEX IX_YCBB_Ca ON dbo.YeuCauBaoBan(MaCa);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.YeuCauBaoBan') AND name=N'IX_YCBB_GVThayThe')
    CREATE INDEX IX_YCBB_GVThayThe ON dbo.YeuCauBaoBan(MaGVThayTheDeNghi,TrangThai);
GO

IF OBJECT_ID(N'dbo.LichSuDieuChinhLich', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.LichSuDieuChinhLich (
        MaLichSu BIGINT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_LichSuDieuChinhLich PRIMARY KEY,
        MaYeuCau BIGINT NOT NULL,
        MaGV VARCHAR(20) NOT NULL,
        MaGVThayThe VARCHAR(20) NULL,
        MaCa VARCHAR(50) NOT NULL,
        PhanCongTruoc NVARCHAR(500) NOT NULL,
        PhanCongSau NVARCHAR(500) NOT NULL,
        NguoiThucHien NVARCHAR(100) NOT NULL,
        ThoiDiem DATETIME2 NOT NULL
            CONSTRAINT DF_LSDCL_ThoiDiem DEFAULT (SYSDATETIME()),
        HanhDong NVARCHAR(100) NOT NULL,
        LyDo NVARCHAR(500) NULL,
        CONSTRAINT FK_LSDCL_YeuCau FOREIGN KEY (MaYeuCau)
            REFERENCES dbo.YeuCauBaoBan(MaYeuCau),
        CONSTRAINT FK_LSDCL_GiangVien FOREIGN KEY (MaGV)
            REFERENCES dbo.GiangVien(MaGV),
        CONSTRAINT FK_LSDCL_GiangVienThayThe FOREIGN KEY (MaGVThayThe)
            REFERENCES dbo.GiangVien(MaGV),
        CONSTRAINT FK_LSDCL_CaThi FOREIGN KEY (MaCa)
            REFERENCES dbo.CaThi(MaCa)
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.LichSuDieuChinhLich') AND name=N'IX_LSDCL_YeuCau')
    CREATE INDEX IX_LSDCL_YeuCau ON dbo.LichSuDieuChinhLich(MaYeuCau,ThoiDiem DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.LichSuDieuChinhLich') AND name=N'IX_LSDCL_GV')
    CREATE INDEX IX_LSDCL_GV ON dbo.LichSuDieuChinhLich(MaGV,ThoiDiem DESC);
GO

IF OBJECT_ID(N'dbo.ThongBao', N'U') IS NULL
    THROW 54001, N'Không tìm thấy dbo.ThongBao. Hãy tạo các bảng nền trước khi chạy phần báo bận.', 1;
GO

IF COL_LENGTH(N'dbo.ThongBao', N'YeuCauBaoBanID') IS NULL
    ALTER TABLE dbo.ThongBao ADD YeuCauBaoBanID BIGINT NULL;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE parent_object_id = OBJECT_ID(N'dbo.ThongBao')
      AND name = N'FK_TB_YCBB'
)
BEGIN
    ALTER TABLE dbo.ThongBao
        ADD CONSTRAINT FK_TB_YCBB
        FOREIGN KEY (YeuCauBaoBanID) REFERENCES dbo.YeuCauBaoBan(MaYeuCau);
END;
GO

PRINT N'Đã bổ sung cấu trúc báo bận/nhờ coi thay; không xóa dữ liệu.';
GO

/* Kiểm tra nhanh hai cột mà backend sử dụng. */
SELECT N'Yêu cầu báo bận: giảng viên được nhờ coi thay' AS [Hạng mục],
       CASE WHEN COL_LENGTH(N'dbo.YeuCauBaoBan',N'MaGVThayTheDeNghi') IS NOT NULL THEN N'ĐÃ CÓ' ELSE N'CÒN THIẾU' END AS [Tình trạng]
UNION ALL
SELECT N'Thông báo: liên kết đến yêu cầu báo bận',
       CASE WHEN COL_LENGTH(N'dbo.ThongBao',N'YeuCauBaoBanID') IS NOT NULL THEN N'ĐÃ CÓ' ELSE N'CÒN THIẾU' END;
GO
IF OBJECT_ID(N'dbo.CaThi', N'U') IS NULL
    THROW 54101, N'Không tìm thấy dbo.CaThi trong DB_XepLichCoiThi_Final.', 1;
IF OBJECT_ID(N'dbo.YeuCauBaoBan', N'U') IS NULL
    THROW 54102, N'Không tìm thấy dbo.YeuCauBaoBan. Hãy chạy phần cấu trúc báo bận trước.', 1;
GO

IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id=OBJECT_ID(N'dbo.YeuCauBaoBan')
      AND name=N'MaCa' AND is_nullable=0
)
    ALTER TABLE dbo.YeuCauBaoBan ALTER COLUMN MaCa VARCHAR(50) NULL;
GO

CREATE PROCEDURE dbo.sp_XoaTatCaCaThi
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @MaCa TABLE (MaCa VARCHAR(50) NOT NULL PRIMARY KEY);
        DECLARE @YeuCauDoiCa TABLE (ID BIGINT NOT NULL PRIMARY KEY);
        DECLARE @SoCaDaXoa INT;

        INSERT INTO @MaCa(MaCa)
        SELECT MaCa FROM dbo.CaThi;

        SELECT @SoCaDaXoa=COUNT(*) FROM @MaCa;

        INSERT INTO @YeuCauDoiCa(ID)
        SELECT yc.ID
        FROM dbo.YeuCauDoiCa AS yc
        WHERE EXISTS (SELECT 1 FROM @MaCa AS ca WHERE ca.MaCa=yc.MaCaGui)
           OR EXISTS (SELECT 1 FROM @MaCa AS ca WHERE ca.MaCa=yc.MaCaNhan);

        DELETE tb
        FROM dbo.ThongBao AS tb
        INNER JOIN @YeuCauDoiCa AS yc ON yc.ID=tb.YeuCauDoiCaID;

        DELETE ls
        FROM dbo.LichSuDoiCa AS ls
        INNER JOIN @YeuCauDoiCa AS yc ON yc.ID=ls.YeuCauDoiCaID;

        DELETE yc
        FROM dbo.YeuCauDoiCa AS yc
        INNER JOIN @YeuCauDoiCa AS x ON x.ID=yc.ID;

        DELETE ls
        FROM dbo.LichSuDieuChinhLich AS ls
        INNER JOIN @MaCa AS ca ON ca.MaCa=ls.MaCa;

        UPDATE yc
           SET MaCa=NULL
        FROM dbo.YeuCauBaoBan AS yc
        INNER JOIN @MaCa AS ca ON ca.MaCa=yc.MaCa;

        DELETE pc
        FROM dbo.PhanCongCoiThi AS pc
        INNER JOIN @MaCa AS ca ON ca.MaCa=pc.MaCa;

        DELETE ca
        FROM dbo.CaThi AS ca
        INNER JOIN @MaCa AS x ON x.MaCa=ca.MaCa;

        UPDATE dbo.DinhMucPhanCong SET SoCaQuyDinh=0;

        COMMIT TRANSACTION;
        SELECT @SoCaDaXoa AS SoCaDaXoa;
    END TRY
    BEGIN CATCH
        IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

PRINT N'Đã tạo dbo.sp_XoaTatCaCaThi. Chưa xóa dữ liệu; thủ tục chạy khi bấm Xóa toàn bộ ca thi.';
GO
IF OBJECT_ID(N'dbo.YeuCauBaoBan', N'U') IS NULL
    THROW 50001, N'Không tìm thấy bảng dbo.YeuCauBaoBan. Hãy cài database chính trước.', 1;
GO

IF COL_LENGTH(N'dbo.YeuCauBaoBan', N'TrangThaiXacNhanThayThe') IS NULL
    ALTER TABLE dbo.YeuCauBaoBan ADD TrangThaiXacNhanThayThe VARCHAR(20) NULL;
IF COL_LENGTH(N'dbo.YeuCauBaoBan', N'ThoiGianPhanHoiThayThe') IS NULL
    ALTER TABLE dbo.YeuCauBaoBan ADD ThoiGianPhanHoiThayThe DATETIME2 NULL;
GO

/* Lời mời đang mở được đưa về trạng thái chờ phản hồi. */
UPDATE dbo.YeuCauBaoBan
SET TrangThaiXacNhanThayThe = 'PENDING'
WHERE MaGVThayTheDeNghi IS NOT NULL
  AND TrangThai = 'PENDING'
  AND TrangThaiXacNhanThayThe IS NULL;
GO

SELECT N'Cấu trúc dữ liệu cho yêu cầu nhờ coi thay đã sẵn sàng.' AS [Thông báo];
GO

GO

IF OBJECT_ID(N'dbo.CauHinhCongBoLich', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CauHinhCongBoLich (
        ID TINYINT NOT NULL,
        ChoPhepXemTatCa BIT NOT NULL CONSTRAINT DF_CauHinhCongBoLich_Enabled DEFAULT 0,
        CapNhatLuc DATETIME2 NOT NULL CONSTRAINT DF_CauHinhCongBoLich_Updated DEFAULT SYSDATETIME(),
        NguoiCapNhat NVARCHAR(120) NULL,
        CONSTRAINT PK_CauHinhCongBoLich PRIMARY KEY (ID),
        CONSTRAINT CK_CauHinhCongBoLich_Singleton CHECK (ID=1)
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.CauHinhCongBoLich WHERE ID=1)
    INSERT INTO dbo.CauHinhCongBoLich(ID,ChoPhepXemTatCa) VALUES(1,0);
GO
/* 1. Bảng trực đề */
IF OBJECT_ID(N'dbo.PhanCongTrucDe', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PhanCongTrucDe (
        ID BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PhanCongTrucDe PRIMARY KEY,
        MaDot VARCHAR(20) NOT NULL,
        MaHP NVARCHAR(30) NOT NULL,
        MonThi NVARCHAR(300) NOT NULL,
        NgayThi DATE NOT NULL,
        Thu NVARCHAR(20) NOT NULL,
        TuTiet INT NOT NULL,
        DenTiet INT NOT NULL,
        MaGV VARCHAR(20) NOT NULL,
        SoDienThoai NVARCHAR(30) NULL,
        GhiChu NVARCHAR(255) NULL,
        NguonFile NVARCHAR(255) NULL,
        ThoiGianImport DATETIME2 NOT NULL CONSTRAINT DF_PhanCongTrucDe_Time DEFAULT SYSDATETIME(),
        CONSTRAINT FK_PhanCongTrucDe_Dot FOREIGN KEY(MaDot) REFERENCES dbo.DotThi(MaDot) ON DELETE CASCADE,
        CONSTRAINT FK_PhanCongTrucDe_GV FOREIGN KEY(MaGV) REFERENCES dbo.GiangVien(MaGV),
        CONSTRAINT CK_PhanCongTrucDe_Tiet CHECK(TuTiet BETWEEN 1 AND 16 AND DenTiet BETWEEN TuTiet AND 16)
    );
END;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'UX_PhanCongTrucDe_ImportKey' AND object_id=OBJECT_ID(N'dbo.PhanCongTrucDe'))
    CREATE UNIQUE INDEX UX_PhanCongTrucDe_ImportKey ON dbo.PhanCongTrucDe(MaDot,MaHP,NgayThi,TuTiet,DenTiet,MaGV);
GO

/* 2. sp_DatDinhMucChung bản mới */
ALTER PROCEDURE dbo.sp_DatDinhMucChung
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

    IF NOT EXISTS(
        SELECT 1 FROM DinhMucPhanCong d
        JOIN GiangVien g ON g.MaGV=d.MaGV
        JOIN BoMon bm ON bm.MaBoMon=g.MaBoMon
        WHERE d.MaDot=@MaDot AND g.TrangThai=N'Đang công tác'
          AND (@MaKhoa IS NULL OR bm.MaKhoa=@MaKhoa)
    )
        THROW 51013,N'Đợt thi chưa có giảng viên tham gia trong phạm vi đã chọn.',1;

    BEGIN TRAN;

    UPDATE d SET TyLeDinhMuc=@TyLeDinhMuc, GhiChu=N'Đặt định mức chung'
    FROM DinhMucPhanCong d
    JOIN GiangVien g ON g.MaGV=d.MaGV
    JOIN BoMon bm ON bm.MaBoMon=g.MaBoMon
    WHERE d.MaDot=@MaDot
      AND g.TrangThai=N'Đang công tác'
      AND (@MaKhoa IS NULL OR bm.MaKhoa=@MaKhoa);

    EXEC dbo.sp_TinhDinhMucTheoTyLe @MaDot;

    COMMIT;

    SELECT @MaDot AS MaDot,
           (SELECT ISNULL(SUM(SoGVCanCap),0) FROM CaThi WHERE MaDot=@MaDot) AS TongNhuCau,
           (SELECT ISNULL(SUM(SoCaQuyDinh),0) FROM DinhMucPhanCong WHERE MaDot=@MaDot) AS TongDinhMuc,
           (SELECT ISNULL(SUM(SoGVCanCap),0) FROM CaThi WHERE MaDot=@MaDot)
             - (SELECT ISNULL(SUM(SoCaQuyDinh),0) FROM DinhMucPhanCong WHERE MaDot=@MaDot) AS ChenhLech;
END;
GO

/* 3. sp_XoaGiangVien bản mới */
ALTER PROCEDURE dbo.sp_XoaGiangVien @MaGV VARCHAR(20)
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF NOT EXISTS(SELECT 1 FROM dbo.GiangVien WHERE MaGV=@MaGV) THROW 52204,N'Không tìm thấy giảng viên.',1;
 UPDATE dbo.GiangVien SET TrangThai=N'Ngừng công tác' WHERE MaGV=@MaGV;
 UPDATE dbo.TaiKhoanGiangVien SET IsActive=0 WHERE MaGV=@MaGV;
 SELECT MaGV,HoTen,MaBoMon,TrangThai FROM dbo.GiangVien WHERE MaGV=@MaGV;
END;
GO

/*
   Exact quotas and approved cover-transfer support.
   Apply after the base install script creates DB_XepLichCoiThi_Final.
   Assignment counts must exactly equal the stored quota plus the net of
   effective, admin-approved cover transfers for the current schedule.
*/
USE [DB_XepLichCoiThi_Final];
GO

IF OBJECT_ID(N'dbo.PhanCongCoiThi', N'U') IS NULL
    THROW 53010, N'Không tìm thấy dbo.PhanCongCoiThi trong DB_XepLichCoiThi_Final. Hãy kiểm tra đã chạy script cài đặt đúng database chưa.', 1;
GO

ALTER PROCEDURE dbo.sp_KiemTraRangBuoc
    @MaDot VARCHAR(20),
    @ThrowIfFail BIT=0
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS(SELECT 1 FROM dbo.DotThi WHERE MaDot=@MaDot)
        THROW 53000,N'Đợt thi không tồn tại.',1;

    CREATE TABLE #QuotaState (
        MaGV VARCHAR(20) COLLATE DATABASE_DEFAULT NOT NULL PRIMARY KEY,
        SoCaCanXep INT NOT NULL,
        SoCaThucTe INT NOT NULL
    );

    ;WITH ApprovedHistory AS (
        SELECT ls.MaLichSu,ls.MaCa,ls.MaGV,ls.MaGVThayThe,
               ROW_NUMBER() OVER(PARTITION BY ls.MaCa ORDER BY ls.MaLichSu DESC) AS RN
        FROM dbo.LichSuDieuChinhLich ls
        JOIN dbo.YeuCauBaoBan y ON y.MaYeuCau=ls.MaYeuCau AND y.TrangThai='APPROVED'
        JOIN dbo.CaThi c ON c.MaCa=ls.MaCa AND c.MaDot=@MaDot
        WHERE ls.HanhDong=N'DUYET_DOI_LICH'
          AND ls.MaGV IS NOT NULL AND ls.MaGVThayThe IS NOT NULL
    ), EffectiveCovers AS (
        SELECT h.MaCa,h.MaLichSu
        FROM ApprovedHistory h
        WHERE h.RN=1 AND EXISTS (
            SELECT 1 FROM dbo.PhanCongCoiThi p
            WHERE p.MaCa=h.MaCa AND p.MaGV=h.MaGVThayThe
        )
    ), TransferRows AS (
        SELECT c.MaDot,h.MaGV AS MaGVTruoc,h.MaGVThayThe AS MaGVSau
        FROM dbo.LichSuDieuChinhLich h
        JOIN dbo.YeuCauBaoBan y ON y.MaYeuCau=h.MaYeuCau AND y.TrangThai='APPROVED'
        JOIN dbo.CaThi c ON c.MaCa=h.MaCa AND c.MaDot=@MaDot
        JOIN EffectiveCovers e ON e.MaCa=h.MaCa AND h.MaLichSu<=e.MaLichSu
        WHERE h.HanhDong=N'DUYET_DOI_LICH'
          AND h.MaGV IS NOT NULL AND h.MaGVThayThe IS NOT NULL
    ), TransferDelta AS (
        SELECT MaDot,MaGV,SUM(Delta) AS Delta
        FROM (
            SELECT MaDot,MaGVTruoc AS MaGV,-1 AS Delta FROM TransferRows
            UNION ALL
            SELECT MaDot,MaGVSau AS MaGV,1 AS Delta FROM TransferRows
        ) d
        GROUP BY MaDot,MaGV
    ), LecturerScope AS (
        SELECT MaGV FROM dbo.DinhMucPhanCong WHERE MaDot=@MaDot
        UNION SELECT p.MaGV FROM dbo.PhanCongCoiThi p JOIN dbo.CaThi c ON c.MaCa=p.MaCa WHERE c.MaDot=@MaDot
        UNION SELECT MaGVTruoc FROM TransferRows
        UNION SELECT MaGVSau FROM TransferRows
    ), AssignmentCounts AS (
        SELECT p.MaGV,COUNT(*) AS SoCa
        FROM dbo.PhanCongCoiThi p JOIN dbo.CaThi c ON c.MaCa=p.MaCa
        WHERE c.MaDot=@MaDot
        GROUP BY p.MaGV
    )
    INSERT INTO #QuotaState(MaGV,SoCaCanXep,SoCaThucTe)
    SELECT s.MaGV,ISNULL(d.SoCaQuyDinh,0)+ISNULL(td.Delta,0),ISNULL(a.SoCa,0)
    FROM LecturerScope s
    LEFT JOIN dbo.DinhMucPhanCong d ON d.MaDot=@MaDot AND d.MaGV=s.MaGV
    LEFT JOIN TransferDelta td ON td.MaGV=s.MaGV AND td.MaDot=@MaDot
    LEFT JOIN AssignmentCounts a ON a.MaGV=s.MaGV;

    DECLARE @RB TABLE(MaRB NVARCHAR(10) PRIMARY KEY,TenRangBuoc NVARCHAR(200),SoViPham INT);
    INSERT @RB VALUES
        (N'RB1',N'Khớp tuyệt đối định mức và đổi ca đã duyệt',0),
        (N'RB2',N'Mỗi ca đúng số GV cần cấp',0),
        (N'RB3',N'GV không coi 2 ca trùng thời gian',0),
        (N'RB4',N'GV không trùng lịch dạy',0),
        (N'RB5',N'Không trộn nhóm ca trong buổi',0),
        (N'RB6',N'Né lịch bận mức 1',0);

    UPDATE @RB SET SoViPham=(SELECT COUNT(*) FROM #QuotaState WHERE SoCaThucTe<>SoCaCanXep)
        WHERE MaRB=N'RB1';
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
    SELECT N'RB1',N'Không khớp định mức chính xác',q.MaGV,NULL,NULL,
           CONCAT(N'GV ',q.MaGV,N' có ',q.SoCaThucTe,N' ca; định mức hiệu lực cần đúng ',q.SoCaCanXep,N' ca.')
    FROM #QuotaState q
    WHERE q.SoCaThucTe<>q.SoCaCanXep
    UNION ALL
    SELECT N'RB2',N'Thiếu GV',NULL,c.MaCa,NULL,
           CONCAT(N'Ca ',c.MaCa,N' có ',(SELECT COUNT(*) FROM dbo.PhanCongCoiThi p WHERE p.MaCa=c.MaCa),N'/',c.SoGVCanCap,N' GV')
    FROM dbo.CaThi c
    WHERE c.MaDot=@MaDot AND (SELECT COUNT(*) FROM dbo.PhanCongCoiThi p WHERE p.MaCa=c.MaCa)<>c.SoGVCanCap
    ORDER BY MaRB,MaGV,MaCa;

    IF @ThrowIfFail=1 AND EXISTS(SELECT 1 FROM @RB WHERE SoViPham>0)
        THROW 53004,N'Các ràng buộc cứng chưa đạt. Lịch chưa được chốt.',1;
END;
GO

ALTER PROCEDURE dbo.sp_ChotXepLich @MaDot VARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS(SELECT 1 FROM dbo.DotThi WHERE MaDot=@MaDot)
        THROW 53000,N'Đợt thi không tồn tại.',1;

    CREATE TABLE #QuotaState (
        MaGV VARCHAR(20) COLLATE DATABASE_DEFAULT NOT NULL PRIMARY KEY,
        SoCaCanXep INT NOT NULL,
        SoCaThucTe INT NOT NULL
    );
    ;WITH ApprovedHistory AS (
        SELECT ls.MaLichSu,ls.MaCa,ls.MaGV,ls.MaGVThayThe,
               ROW_NUMBER() OVER(PARTITION BY ls.MaCa ORDER BY ls.MaLichSu DESC) AS RN
        FROM dbo.LichSuDieuChinhLich ls
        JOIN dbo.YeuCauBaoBan y ON y.MaYeuCau=ls.MaYeuCau AND y.TrangThai='APPROVED'
        JOIN dbo.CaThi c ON c.MaCa=ls.MaCa AND c.MaDot=@MaDot
        WHERE ls.HanhDong=N'DUYET_DOI_LICH'
          AND ls.MaGV IS NOT NULL AND ls.MaGVThayThe IS NOT NULL
    ), EffectiveCovers AS (
        SELECT h.MaCa,h.MaLichSu
        FROM ApprovedHistory h
        WHERE h.RN=1 AND EXISTS (
            SELECT 1 FROM dbo.PhanCongCoiThi p
            WHERE p.MaCa=h.MaCa AND p.MaGV=h.MaGVThayThe
        )
    ), TransferRows AS (
        SELECT c.MaDot,h.MaGV AS MaGVTruoc,h.MaGVThayThe AS MaGVSau
        FROM dbo.LichSuDieuChinhLich h
        JOIN dbo.YeuCauBaoBan y ON y.MaYeuCau=h.MaYeuCau AND y.TrangThai='APPROVED'
        JOIN dbo.CaThi c ON c.MaCa=h.MaCa AND c.MaDot=@MaDot
        JOIN EffectiveCovers e ON e.MaCa=h.MaCa AND h.MaLichSu<=e.MaLichSu
        WHERE h.HanhDong=N'DUYET_DOI_LICH'
          AND h.MaGV IS NOT NULL AND h.MaGVThayThe IS NOT NULL
    ), TransferDelta AS (
        SELECT MaDot,MaGV,SUM(Delta) AS Delta
        FROM (
            SELECT MaDot,MaGVTruoc AS MaGV,-1 AS Delta FROM TransferRows
            UNION ALL
            SELECT MaDot,MaGVSau AS MaGV,1 AS Delta FROM TransferRows
        ) d
        GROUP BY MaDot,MaGV
    ), LecturerScope AS (
        SELECT MaGV FROM dbo.DinhMucPhanCong WHERE MaDot=@MaDot
        UNION SELECT p.MaGV FROM dbo.PhanCongCoiThi p JOIN dbo.CaThi c ON c.MaCa=p.MaCa WHERE c.MaDot=@MaDot
        UNION SELECT MaGVTruoc FROM TransferRows
        UNION SELECT MaGVSau FROM TransferRows
    ), AssignmentCounts AS (
        SELECT p.MaGV,COUNT(*) AS SoCa
        FROM dbo.PhanCongCoiThi p JOIN dbo.CaThi c ON c.MaCa=p.MaCa
        WHERE c.MaDot=@MaDot
        GROUP BY p.MaGV
    )
    INSERT INTO #QuotaState(MaGV,SoCaCanXep,SoCaThucTe)
    SELECT s.MaGV,ISNULL(d.SoCaQuyDinh,0)+ISNULL(td.Delta,0),ISNULL(a.SoCa,0)
    FROM LecturerScope s
    LEFT JOIN dbo.DinhMucPhanCong d ON d.MaDot=@MaDot AND d.MaGV=s.MaGV
    LEFT JOIN TransferDelta td ON td.MaGV=s.MaGV AND td.MaDot=@MaDot
    LEFT JOIN AssignmentCounts a ON a.MaGV=s.MaGV;

    DECLARE @N INT=(SELECT COUNT(*) FROM dbo.vw_ViPhamRangBuocCung
                     WHERE MaDot=@MaDot AND MaRB<>N'RB1');
    DECLARE @ThieuCa INT=(SELECT COUNT(*) FROM dbo.CaThi c WHERE c.MaDot=@MaDot AND
        (SELECT COUNT(*) FROM dbo.PhanCongCoiThi p WHERE p.MaCa=c.MaCa)<>c.SoGVCanCap);
    DECLARE @NgoaiDinhMuc INT=(SELECT COUNT(*) FROM #QuotaState WHERE SoCaThucTe<>SoCaCanXep);
    DECLARE @TongCa INT=(SELECT COUNT(*) FROM dbo.PhanCongCoiThi p JOIN dbo.CaThi c ON c.MaCa=p.MaCa WHERE c.MaDot=@MaDot);
    DECLARE @CaTrungLichBan INT=(SELECT COUNT(*) FROM dbo.PhanCongCoiThi p JOIN dbo.CaThi c ON c.MaCa=p.MaCa
        WHERE c.MaDot=@MaDot AND EXISTS(SELECT 1 FROM dbo.LichBanGV b WHERE b.MaGV=p.MaGV AND b.UuTien IN(2,3)
            AND b.NgayBan=c.NgayThi AND c.TuTiet<=b.DenTiet AND b.TuTiet<=c.DenTiet));
    DECLARE @TyLeNeLichBan DECIMAL(5,2)=CASE WHEN @TongCa=0 THEN 100.00 ELSE 100.0*(@TongCa-@CaTrungLichBan)/@TongCa END;
    DECLARE @TyLeToiThieu DECIMAL(5,2)=(SELECT TyLeNeLichBanToiThieu FROM dbo.CauHinhXepLich WHERE MaDot=@MaDot);
    IF @N>0 OR @ThieuCa>0 OR @NgoaiDinhMuc>0
        THROW 53001,N'Không thể chốt: ràng buộc cứng chưa đạt.',1;
    -- Busy levels 2-3 are soft optimization criteria. Report their rate,
    -- but do not block publishing a schedule that satisfies the hard rules.
    SELECT @MaDot MaDot,N'ĐẠT - có thể chốt lịch' KetQua,@TyLeNeLichBan TyLeNeLichBan,@TyLeToiThieu TyLeNeToiThieu;
END;
GO

/*
   During an approved swap the history and request status are written before
   the assignment update in the same transaction. This trigger keeps the
   other existing hard checks and rejects only quota over-assignment here;
   exact (including under-assignment) is checked after the complete batch by
   sp_KiemTraRangBuoc/sp_ChotXepLich.
*/
CREATE OR ALTER TRIGGER dbo.trg_PhanCong_RangBuocCung ON dbo.PhanCongCoiThi AFTER INSERT,UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Loi NVARCHAR(1000);
    SELECT TOP 1 @Loi=CONCAT(N'[',v.MaRB,N'] ',v.MoTa)
    FROM dbo.vw_ViPhamRangBuocCung v
    WHERE v.MaRB IN(N'RB2',N'RB3',N'RB4',N'RB5',N'RB6')
      AND ((v.MaGV IN(SELECT MaGV FROM inserted))
        OR (v.MaGV IN(SELECT MaGV FROM deleted))
        OR (v.MaCa IN(SELECT MaCa FROM inserted))
        OR (v.MaCaLienQuan IN(SELECT MaCa FROM inserted)));
    IF @Loi IS NOT NULL BEGIN ROLLBACK; THROW 53002,@Loi,1; END;

    ;WITH ApprovedHistory AS (
        SELECT ls.MaLichSu,ls.MaCa,ls.MaGV,ls.MaGVThayThe,
               ROW_NUMBER() OVER(PARTITION BY ls.MaCa ORDER BY ls.MaLichSu DESC) AS RN
        FROM dbo.LichSuDieuChinhLich ls
        JOIN dbo.YeuCauBaoBan y ON y.MaYeuCau=ls.MaYeuCau AND y.TrangThai='APPROVED'
        WHERE ls.HanhDong=N'DUYET_DOI_LICH'
          AND ls.MaGV IS NOT NULL AND ls.MaGVThayThe IS NOT NULL
    ), EffectiveCovers AS (
        SELECT h.MaCa,h.MaLichSu
        FROM ApprovedHistory h
        WHERE h.RN=1 AND EXISTS (
            SELECT 1 FROM dbo.PhanCongCoiThi p
            WHERE p.MaCa=h.MaCa AND p.MaGV=h.MaGVThayThe
        )
    ), TransferRows AS (
        SELECT c.MaDot,h.MaGV AS MaGVTruoc,h.MaGVThayThe AS MaGVSau
        FROM dbo.LichSuDieuChinhLich h
        JOIN dbo.YeuCauBaoBan y ON y.MaYeuCau=h.MaYeuCau AND y.TrangThai='APPROVED'
        JOIN dbo.CaThi c ON c.MaCa=h.MaCa
        JOIN EffectiveCovers e ON e.MaCa=h.MaCa AND h.MaLichSu<=e.MaLichSu
        WHERE h.HanhDong=N'DUYET_DOI_LICH'
          AND h.MaGV IS NOT NULL AND h.MaGVThayThe IS NOT NULL
    ), TransferDelta AS (
        SELECT MaDot,MaGV,SUM(Delta) AS Delta
        FROM (
            SELECT MaDot,MaGVTruoc AS MaGV,-1 AS Delta FROM TransferRows
            UNION ALL
            SELECT MaDot,MaGVSau AS MaGV,1 AS Delta FROM TransferRows
        ) d
        GROUP BY MaDot,MaGV
    ), ChangedAssignments AS (
        SELECT i.MaGV,c.MaDot FROM inserted i JOIN dbo.CaThi c ON c.MaCa=i.MaCa
        UNION
        SELECT d.MaGV,c.MaDot FROM deleted d JOIN dbo.CaThi c ON c.MaCa=d.MaCa
    ), AffectedPeriods AS (
        SELECT DISTINCT MaDot FROM ChangedAssignments
    ), AssignmentCounts AS (
        SELECT p.MaGV,c.MaDot,COUNT(*) AS SoCa
        FROM dbo.PhanCongCoiThi p JOIN dbo.CaThi c ON c.MaCa=p.MaCa
        WHERE EXISTS (SELECT 1 FROM AffectedPeriods x WHERE x.MaDot=c.MaDot)
        GROUP BY p.MaGV,c.MaDot
    ), LecturerScope AS (
        SELECT d.MaGV,d.MaDot
        FROM dbo.DinhMucPhanCong d
        JOIN AffectedPeriods a ON a.MaDot=d.MaDot
        UNION SELECT MaGV,MaDot FROM ChangedAssignments
        UNION SELECT MaGV,MaDot FROM TransferDelta
    ), Expected AS (
        SELECT s.MaGV,s.MaDot,ISNULL(d.SoCaQuyDinh,0)+ISNULL(td.Delta,0) AS SoCaCanXep
        FROM LecturerScope s
        LEFT JOIN dbo.DinhMucPhanCong d ON d.MaGV=s.MaGV AND d.MaDot=s.MaDot
        LEFT JOIN TransferDelta td ON td.MaGV=s.MaGV AND td.MaDot=s.MaDot
    )
    SELECT TOP 1 @Loi=CONCAT(N'[RB1] GV ',g.MaGV,N' vượt định mức hiệu lực ',e.SoCaCanXep,N' ca.')
    FROM ChangedAssignments g
    JOIN Expected e ON e.MaGV=g.MaGV AND e.MaDot=g.MaDot
    LEFT JOIN AssignmentCounts a ON a.MaGV=g.MaGV AND a.MaDot=g.MaDot
    WHERE ISNULL(a.SoCa,0)>e.SoCaCanXep;
    IF @Loi IS NOT NULL BEGIN ROLLBACK; THROW 53002,@Loi,1; END;
END;
GO
IF COL_LENGTH('dbo.DinhMucPhanCong', 'SoCaThuCong') IS NULL
BEGIN
    ALTER TABLE dbo.DinhMucPhanCong
        ADD SoCaThuCong BIT NOT NULL
            CONSTRAINT DF_DM_SoCaThuCong DEFAULT (0) WITH VALUES;
END;
GO

ALTER PROCEDURE dbo.sp_TinhDinhMucTheoTyLe @MaDot VARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @TongNhuCau INT = 0,
            @TongCaThuCong INT = 0,
            @TongTyLe DECIMAL(18,6) = 0,
            @ConLai INT = 0,
            @ConDu INT = 0;

    SELECT @TongNhuCau = ISNULL(SUM(SoGVCanCap), 0)
    FROM dbo.CaThi
    WHERE MaDot = @MaDot;

    SELECT @TongCaThuCong = ISNULL(SUM(d.SoCaQuyDinh), 0)
    FROM dbo.DinhMucPhanCong d
    JOIN dbo.GiangVien g ON g.MaGV = d.MaGV
    WHERE d.MaDot = @MaDot
      AND d.SoCaThuCong = 1
      AND g.TrangThai = N'Đang công tác';

    IF @TongCaThuCong > @TongNhuCau
        THROW 51004, N'Tổng số ca định mức nhập tay vượt quá tổng nhu cầu của đợt thi.', 1;

    SET @ConLai = @TongNhuCau - @TongCaThuCong;

    IF @TongNhuCau = 0
    BEGIN
        IF @TongCaThuCong > 0
            THROW 51004, N'Không thể giữ định mức nhập tay khi đợt thi chưa có nhu cầu ca.', 1;

        UPDATE dbo.DinhMucPhanCong
        SET SoCaQuyDinh = 0
        WHERE MaDot = @MaDot AND SoCaThuCong = 0;

        SELECT d.MaDot, d.MaGV, g.HoTen, d.TyLeDinhMuc,
               d.SoCaQuyDinh, d.SoCaThuCong
        FROM dbo.DinhMucPhanCong d
        JOIN dbo.GiangVien g ON g.MaGV = d.MaGV
        WHERE d.MaDot = @MaDot
        ORDER BY d.TyLeDinhMuc DESC, d.MaGV;
        RETURN;
    END;

    SELECT @TongTyLe = ISNULL(SUM(d.TyLeDinhMuc), 0)
    FROM dbo.DinhMucPhanCong d
    JOIN dbo.GiangVien g ON g.MaGV = d.MaGV
    WHERE d.MaDot = @MaDot
      AND d.SoCaThuCong = 0
      AND g.TrangThai = N'Đang công tác';

    IF @ConLai > 0 AND @TongTyLe <= 0
        THROW 51001, N'Tổng tỷ lệ định mức của giảng viên chưa khóa phải lớn hơn 0.', 1;

    IF @ConLai = 0
    BEGIN
        UPDATE dbo.DinhMucPhanCong
        SET SoCaQuyDinh = 0
        WHERE MaDot = @MaDot AND SoCaThuCong = 0;
    END
    ELSE
    BEGIN
        CREATE TABLE #Q(
            MaGV VARCHAR(20) COLLATE DATABASE_DEFAULT PRIMARY KEY,
            PhanNguyen INT NOT NULL,
            PhanLe DECIMAL(18,10) NOT NULL,
            ThuTu INT NOT NULL
        );

        INSERT #Q(MaGV, PhanNguyen, PhanLe, ThuTu)
        SELECT MaGV, CAST(FLOOR(Q) AS INT), Q - FLOOR(Q),
               ROW_NUMBER() OVER(ORDER BY Q - FLOOR(Q) DESC, TyLeDinhMuc DESC, MaGV)
        FROM (
            SELECT d.MaGV, d.TyLeDinhMuc,
                   CAST(@ConLai AS DECIMAL(18,10)) * d.TyLeDinhMuc / @TongTyLe AS Q
            FROM dbo.DinhMucPhanCong d
            JOIN dbo.GiangVien g ON g.MaGV = d.MaGV
            WHERE d.MaDot = @MaDot
              AND d.SoCaThuCong = 0
              AND g.TrangThai = N'Đang công tác'
        ) X;

        SELECT @ConDu = @ConLai - ISNULL(SUM(PhanNguyen), 0) FROM #Q;

        UPDATE d
        SET SoCaQuyDinh = q.PhanNguyen + CASE WHEN q.ThuTu <= @ConDu THEN 1 ELSE 0 END
        FROM dbo.DinhMucPhanCong d
        JOIN #Q q ON q.MaGV = d.MaGV
        WHERE d.MaDot = @MaDot;
    END;

    -- Inactive lecturers cannot retain a usable quota.
    UPDATE d SET SoCaQuyDinh = 0
    FROM dbo.DinhMucPhanCong d
    JOIN dbo.GiangVien g ON g.MaGV = d.MaGV
    WHERE d.MaDot = @MaDot AND g.TrangThai <> N'Đang công tác';

    SELECT d.MaDot, d.MaGV, g.HoTen, d.TyLeDinhMuc,
           d.SoCaQuyDinh, d.SoCaThuCong
    FROM dbo.DinhMucPhanCong d
    JOIN dbo.GiangVien g ON g.MaGV = d.MaGV
    WHERE d.MaDot = @MaDot
    ORDER BY d.TyLeDinhMuc DESC, d.MaGV;
END;
GO

ALTER PROCEDURE dbo.sp_DatDinhMucChung
    @MaDot VARCHAR(20),
    @TyLeDinhMuc DECIMAL(5,2),
    @MaKhoa VARCHAR(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TyLeDinhMuc NOT BETWEEN 0 AND 100
        THROW 51010, N'Tỷ lệ định mức chung phải từ 0 đến 100%.', 1;
    IF NOT EXISTS(SELECT 1 FROM dbo.DotThi WHERE MaDot = @MaDot)
        THROW 51011, N'Đợt thi không tồn tại.', 1;
    IF @MaKhoa IS NOT NULL AND NOT EXISTS(SELECT 1 FROM dbo.Khoa WHERE MaKhoa = @MaKhoa)
        THROW 51012, N'Khoa không tồn tại.', 1;

    BEGIN TRAN;

    INSERT dbo.DinhMucPhanCong(MaDot, MaGV, TyLeDinhMuc, GhiChu)
    SELECT @MaDot, g.MaGV, @TyLeDinhMuc, N'Đặt định mức chung'
    FROM dbo.GiangVien g
    JOIN dbo.BoMon bm ON bm.MaBoMon = g.MaBoMon
    WHERE g.TrangThai = N'Đang công tác'
      AND (@MaKhoa IS NULL OR bm.MaKhoa = @MaKhoa)
      AND NOT EXISTS(SELECT 1 FROM dbo.DinhMucPhanCong d WHERE d.MaDot = @MaDot AND d.MaGV = g.MaGV);

    UPDATE d
    SET TyLeDinhMuc = @TyLeDinhMuc,
        SoCaThuCong = 0,
        GhiChu = N'Đặt định mức chung'
    FROM dbo.DinhMucPhanCong d
    JOIN dbo.GiangVien g ON g.MaGV = d.MaGV
    JOIN dbo.BoMon bm ON bm.MaBoMon = g.MaBoMon
    WHERE d.MaDot = @MaDot
      AND g.TrangThai = N'Đang công tác'
      AND (@MaKhoa IS NULL OR bm.MaKhoa = @MaKhoa);

    EXEC dbo.sp_TinhDinhMucTheoTyLe @MaDot;
    COMMIT;

    SELECT @MaDot AS MaDot,
           (SELECT ISNULL(SUM(SoGVCanCap), 0) FROM dbo.CaThi WHERE MaDot = @MaDot) AS TongNhuCau,
           (SELECT ISNULL(SUM(SoCaQuyDinh), 0) FROM dbo.DinhMucPhanCong WHERE MaDot = @MaDot) AS TongDinhMuc,
           (SELECT ISNULL(SUM(SoGVCanCap), 0) FROM dbo.CaThi WHERE MaDot = @MaDot)
             - (SELECT ISNULL(SUM(SoCaQuyDinh), 0) FROM dbo.DinhMucPhanCong WHERE MaDot = @MaDot) AS ChenhLech;
END;
GO

ALTER PROCEDURE dbo.sp_CapNhatTyLeDinhMuc
    @MaDot VARCHAR(20), @MaGV VARCHAR(20), @TyLeDinhMuc DECIMAL(5,2)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF @TyLeDinhMuc NOT BETWEEN 0 AND 100
        THROW 51002, N'Tỷ lệ phải từ 0 đến 100%.', 1;
    IF NOT EXISTS(SELECT 1 FROM dbo.DinhMucPhanCong WHERE MaDot = @MaDot AND MaGV = @MaGV)
        THROW 51003, N'Không tìm thấy định mức.', 1;

    BEGIN TRAN;
    UPDATE dbo.DinhMucPhanCong
    SET TyLeDinhMuc = @TyLeDinhMuc,
        SoCaThuCong = CASE WHEN TyLeDinhMuc = @TyLeDinhMuc THEN SoCaThuCong ELSE 0 END
    WHERE MaDot = @MaDot AND MaGV = @MaGV;
    EXEC dbo.sp_TinhDinhMucTheoTyLe @MaDot;
    COMMIT;
END;
GO
ALTER PROCEDURE dbo.sp_ChotXepLich @MaDot VARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS(SELECT 1 FROM dbo.DotThi WHERE MaDot=@MaDot)
        THROW 53000,N'Đợt thi không tồn tại.',1;

    CREATE TABLE #QuotaState (
        MaGV VARCHAR(20) COLLATE DATABASE_DEFAULT NOT NULL PRIMARY KEY,
        SoCaCanXep INT NOT NULL,
        SoCaThucTe INT NOT NULL
    );
    ;WITH ApprovedHistory AS (
        SELECT ls.MaLichSu,ls.MaCa,ls.MaGV,ls.MaGVThayThe,
               ROW_NUMBER() OVER(PARTITION BY ls.MaCa ORDER BY ls.MaLichSu DESC) AS RN
        FROM dbo.LichSuDieuChinhLich ls
        JOIN dbo.YeuCauBaoBan y ON y.MaYeuCau=ls.MaYeuCau AND y.TrangThai='APPROVED'
        JOIN dbo.CaThi c ON c.MaCa=ls.MaCa AND c.MaDot=@MaDot
        WHERE ls.HanhDong=N'DUYET_DOI_LICH'
          AND ls.MaGV IS NOT NULL AND ls.MaGVThayThe IS NOT NULL
    ), EffectiveCovers AS (
        SELECT h.MaCa,h.MaLichSu
        FROM ApprovedHistory h
        WHERE h.RN=1 AND EXISTS (
            SELECT 1 FROM dbo.PhanCongCoiThi p
            WHERE p.MaCa=h.MaCa AND p.MaGV=h.MaGVThayThe
        )
    ), TransferRows AS (
        SELECT c.MaDot,h.MaGV AS MaGVTruoc,h.MaGVThayThe AS MaGVSau
        FROM dbo.LichSuDieuChinhLich h
        JOIN dbo.YeuCauBaoBan y ON y.MaYeuCau=h.MaYeuCau AND y.TrangThai='APPROVED'
        JOIN dbo.CaThi c ON c.MaCa=h.MaCa AND c.MaDot=@MaDot
        JOIN EffectiveCovers e ON e.MaCa=h.MaCa AND h.MaLichSu<=e.MaLichSu
        WHERE h.HanhDong=N'DUYET_DOI_LICH'
          AND h.MaGV IS NOT NULL AND h.MaGVThayThe IS NOT NULL
    ), TransferDelta AS (
        SELECT MaDot,MaGV,SUM(Delta) AS Delta
        FROM (
            SELECT MaDot,MaGVTruoc AS MaGV,-1 AS Delta FROM TransferRows
            UNION ALL
            SELECT MaDot,MaGVSau AS MaGV,1 AS Delta FROM TransferRows
        ) d
        GROUP BY MaDot,MaGV
    ), LecturerScope AS (
        SELECT MaGV FROM dbo.DinhMucPhanCong WHERE MaDot=@MaDot
        UNION SELECT p.MaGV FROM dbo.PhanCongCoiThi p JOIN dbo.CaThi c ON c.MaCa=p.MaCa WHERE c.MaDot=@MaDot
        UNION SELECT MaGVTruoc FROM TransferRows
        UNION SELECT MaGVSau FROM TransferRows
    ), AssignmentCounts AS (
        SELECT p.MaGV,COUNT(*) AS SoCa
        FROM dbo.PhanCongCoiThi p JOIN dbo.CaThi c ON c.MaCa=p.MaCa
        WHERE c.MaDot=@MaDot
        GROUP BY p.MaGV
    )
    INSERT INTO #QuotaState(MaGV,SoCaCanXep,SoCaThucTe)
    SELECT s.MaGV,ISNULL(d.SoCaQuyDinh,0)+ISNULL(td.Delta,0),ISNULL(a.SoCa,0)
    FROM LecturerScope s
    LEFT JOIN dbo.DinhMucPhanCong d ON d.MaDot=@MaDot AND d.MaGV=s.MaGV
    LEFT JOIN TransferDelta td ON td.MaGV=s.MaGV AND td.MaDot=@MaDot
    LEFT JOIN AssignmentCounts a ON a.MaGV=s.MaGV;

    DECLARE @N INT=(SELECT COUNT(*) FROM dbo.vw_ViPhamRangBuocCung
                     WHERE MaDot=@MaDot AND MaRB<>N'RB1');
    DECLARE @ThieuCa INT=(SELECT COUNT(*) FROM dbo.CaThi c WHERE c.MaDot=@MaDot AND
        (SELECT COUNT(*) FROM dbo.PhanCongCoiThi p WHERE p.MaCa=c.MaCa)<>c.SoGVCanCap);
    DECLARE @NgoaiDinhMuc INT=(SELECT COUNT(*) FROM #QuotaState WHERE SoCaThucTe<>SoCaCanXep);
    DECLARE @TongCa INT=(SELECT COUNT(*) FROM dbo.PhanCongCoiThi p JOIN dbo.CaThi c ON c.MaCa=p.MaCa WHERE c.MaDot=@MaDot);
    DECLARE @CaTrungLichBan INT=(SELECT COUNT(*) FROM dbo.PhanCongCoiThi p JOIN dbo.CaThi c ON c.MaCa=p.MaCa
        WHERE c.MaDot=@MaDot AND EXISTS(SELECT 1 FROM dbo.LichBanGV b WHERE b.MaGV=p.MaGV AND b.UuTien IN(2,3)
            AND b.NgayBan=c.NgayThi AND c.TuTiet<=b.DenTiet AND b.TuTiet<=c.DenTiet));
    DECLARE @TyLeNeLichBan DECIMAL(5,2)=CASE WHEN @TongCa=0 THEN 100.00 ELSE 100.0*(@TongCa-@CaTrungLichBan)/@TongCa END;
    DECLARE @TyLeToiThieu DECIMAL(5,2)=(SELECT TyLeNeLichBanToiThieu FROM dbo.CauHinhXepLich WHERE MaDot=@MaDot);

    IF @N>0 OR @ThieuCa>0 OR @NgoaiDinhMuc>0
        THROW 53001,N'Không thể chốt: ràng buộc cứng chưa đạt.',1;

    -- Keep both rates for diagnostics. Soft busy levels 2-3 do not veto publish.
    SELECT @MaDot MaDot,N'ĐẠT - có thể chốt lịch' KetQua,
           @TyLeNeLichBan TyLeNeLichBan,@TyLeToiThieu TyLeNeToiThieu;
END;
GO
IF OBJECT_ID(N'dbo.ThongBao', N'U') IS NULL
    THROW 54110, N'Không tìm thấy dbo.ThongBao; hãy chạy schema chính trước.', 1;

IF OBJECT_ID(N'dbo.YeuCauBaoBan', N'U') IS NULL
    THROW 54111, N'Không tìm thấy dbo.YeuCauBaoBan; hãy chạy schema chính trước.', 1;

-- Một số database cũ chưa có khóa liên kết thông báo với đơn báo bận.
-- Thủ tục cần cột này để dọn thông báo phụ thuộc trước khi xóa các đơn.
IF COL_LENGTH(N'dbo.ThongBao', N'YeuCauBaoBanID') IS NULL
    ALTER TABLE dbo.ThongBao ADD YeuCauBaoBanID BIGINT NULL;
GO

ALTER PROCEDURE dbo.sp_XoaTatCaCaThi
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @MaCa TABLE (MaCa VARCHAR(50) NOT NULL PRIMARY KEY);
        DECLARE @YeuCauDoiCa TABLE (ID BIGINT NOT NULL PRIMARY KEY);
        DECLARE @YeuCauBaoBan TABLE (ID BIGINT NOT NULL PRIMARY KEY);
        DECLARE @SoCaDaXoa INT;

        INSERT INTO @MaCa(MaCa)
        SELECT MaCa FROM dbo.CaThi;

        SELECT @SoCaDaXoa=COUNT(*) FROM @MaCa;

        INSERT INTO @YeuCauDoiCa(ID)
        SELECT yc.ID
        FROM dbo.YeuCauDoiCa AS yc;

        INSERT INTO @YeuCauBaoBan(ID)
        SELECT MaYeuCau FROM dbo.YeuCauBaoBan;

        DELETE tb
        FROM dbo.ThongBao AS tb
        INNER JOIN @YeuCauDoiCa AS yc ON yc.ID=tb.YeuCauDoiCaID;

        DELETE tb
        FROM dbo.ThongBao AS tb
        INNER JOIN @YeuCauBaoBan AS yc ON yc.ID=tb.YeuCauBaoBanID;

        DELETE ls
        FROM dbo.LichSuDoiCa AS ls
        INNER JOIN @YeuCauDoiCa AS yc ON yc.ID=ls.YeuCauDoiCaID;

        DELETE yc
        FROM dbo.YeuCauDoiCa AS yc
        INNER JOIN @YeuCauDoiCa AS x ON x.ID=yc.ID;

        DELETE ls
        FROM dbo.LichSuDieuChinhLich AS ls
        WHERE EXISTS (SELECT 1 FROM @YeuCauBaoBan AS yc WHERE yc.ID=ls.MaYeuCau)
           OR EXISTS (SELECT 1 FROM @MaCa AS ca WHERE ca.MaCa=ls.MaCa);

        DELETE yc
        FROM dbo.YeuCauBaoBan AS yc
        INNER JOIN @YeuCauBaoBan AS x ON x.ID=yc.MaYeuCau;

        DELETE pc
        FROM dbo.PhanCongCoiThi AS pc
        INNER JOIN @MaCa AS ca ON ca.MaCa=pc.MaCa;

        DELETE ca
        FROM dbo.CaThi AS ca
        INNER JOIN @MaCa AS x ON x.MaCa=ca.MaCa;

        UPDATE dbo.DinhMucPhanCong SET SoCaQuyDinh=0;

        COMMIT TRANSACTION;
            SELECT @SoCaDaXoa AS SoCaDaXoa;
    END TRY
    BEGIN CATCH
        IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO
IF TRY_CONVERT(BIT,SESSION_CONTEXT(N'XepLichFreshInstall'))=1
BEGIN
    UPDATE dbo.CaThi
    SET HinhThucThi = N'Trắc nghiệm'
    WHERE HinhThucThi = N'Lý thuyết'
       OR (DenTiet - TuTiet + 1) = 2;
END;
Go
SET XACT_ABORT ON;
GO

/* 1. VIEW CHI TIẾT VI PHẠM (bao gồm dữ liệu chẩn đoán của RB8). */
CREATE OR ALTER VIEW dbo.vw_ViPhamRangBuocCung_Detail
AS
WITH ApprovedHistory AS (
    SELECT ls.MaLichSu, ls.MaCa, ls.MaGV, ls.MaGVThayThe,
           ROW_NUMBER() OVER(PARTITION BY ls.MaCa ORDER BY ls.MaLichSu DESC) AS RN
    FROM dbo.LichSuDieuChinhLich ls
    JOIN dbo.YeuCauBaoBan y ON y.MaYeuCau = ls.MaYeuCau AND y.TrangThai = 'APPROVED'
    WHERE ls.HanhDong = N'DUYET_DOI_LICH'
      AND ls.MaGV IS NOT NULL AND ls.MaGVThayThe IS NOT NULL
),
EffectiveCovers AS (
    SELECT h.MaCa, h.MaLichSu
    FROM ApprovedHistory h
    WHERE h.RN = 1 AND EXISTS (
        SELECT 1 FROM dbo.PhanCongCoiThi p
        WHERE p.MaCa = h.MaCa AND p.MaGV = h.MaGVThayThe
    )
),
TransferRows AS (
    SELECT c.MaDot, h.MaGV AS MaGVTruoc, h.MaGVThayThe AS MaGVSau
    FROM dbo.LichSuDieuChinhLich h
    JOIN dbo.YeuCauBaoBan y ON y.MaYeuCau = h.MaYeuCau AND y.TrangThai = 'APPROVED'
    JOIN dbo.CaThi c ON c.MaCa = h.MaCa
    JOIN EffectiveCovers e ON e.MaCa = h.MaCa AND h.MaLichSu <= e.MaLichSu
    WHERE h.HanhDong = N'DUYET_DOI_LICH'
      AND h.MaGV IS NOT NULL AND h.MaGVThayThe IS NOT NULL
),
TransferDelta AS (
    SELECT MaDot, MaGV, SUM(Delta) AS Delta
    FROM (
        SELECT MaDot, MaGVTruoc AS MaGV, -1 AS Delta FROM TransferRows
        UNION ALL
        SELECT MaDot, MaGVSau AS MaGV, 1 AS Delta FROM TransferRows
    ) d
    GROUP BY MaDot, MaGV
),
AssignmentCounts AS (
    SELECT c.MaDot, p.MaGV, COUNT(*) AS SoCa
    FROM dbo.PhanCongCoiThi p
    JOIN dbo.CaThi c ON c.MaCa = p.MaCa
    GROUP BY c.MaDot, p.MaGV
),
QuotaScope AS (
    SELECT d.MaDot, d.MaGV FROM dbo.DinhMucPhanCong d
    UNION
    SELECT a.MaDot, a.MaGV FROM AssignmentCounts a
    UNION
    SELECT t.MaDot, t.MaGV FROM TransferDelta t
),
QuotaState AS (
    SELECT q.MaDot, q.MaGV,
           ISNULL(d.SoCaQuyDinh, 0) + ISNULL(t.Delta, 0) AS SoCaCanXep,
           ISNULL(a.SoCa, 0) AS SoCaThucTe
    FROM QuotaScope q
    LEFT JOIN dbo.DinhMucPhanCong d ON d.MaDot = q.MaDot AND d.MaGV = q.MaGV
    LEFT JOIN TransferDelta t ON t.MaDot = q.MaDot AND t.MaGV = q.MaGV
    LEFT JOIN AssignmentCounts a ON a.MaDot = q.MaDot AND a.MaGV = q.MaGV
),
C AS (
    SELECT MaCa, COUNT(*) AS SoGV
    FROM dbo.PhanCongCoiThi
    GROUP BY MaCa
),
AssignedType AS (
    SELECT p.MaGV, c.MaDot, c.NgayThi, c.Buoi, c.NhomHinhThucThi
    FROM dbo.PhanCongCoiThi p
    INNER JOIN dbo.CaThi c ON c.MaCa = p.MaCa
    GROUP BY p.MaGV, c.MaDot, c.NgayThi, c.Buoi, c.NhomHinhThucThi
),
Sessions AS (
    SELECT MaGV, MaDot, NgayThi, Buoi, COUNT(*) AS SoNhom
    FROM AssignedType
    GROUP BY MaGV, MaDot, NgayThi, Buoi
),
DutySchedule AS (
    SELECT td.MaDot, td.MaGV, td.NgayThi AS Ngay, td.TuTiet, td.DenTiet
    FROM dbo.PhanCongTrucDe td
),
BaseSchedule AS (
    SELECT ld.MaGV, ld.NgayDay AS Ngay, ld.TuTiet, ld.DenTiet
    FROM dbo.LichDayGV ld
    UNION ALL
    SELECT td.MaGV, td.Ngay, td.TuTiet, td.DenTiet
    FROM DutySchedule td
),
DailyBase AS (
    SELECT MaGV, Ngay,
           SUM(CASE WHEN DenTiet >= TuTiet THEN DenTiet - TuTiet + 1 ELSE 0 END) AS SoTietNen,
           COUNT(*) AS SoBlockNen
    FROM BaseSchedule
    GROUP BY MaGV, Ngay
),
Assigned AS (
    SELECT p.MaGV, c.MaDot, c.MaCa, c.NgayThi AS Ngay, c.TuTiet, c.DenTiet,
           CASE WHEN (c.DenTiet - c.TuTiet + 1) = 2 OR c.HinhThucThi IN (N'Trắc nghiệm', N'Lý thuyết') THEN N'TN' ELSE N'TL' END AS LoaiChuan
    FROM dbo.PhanCongCoiThi p
    JOIN dbo.CaThi c ON c.MaCa = p.MaCa
),
DailyAssigned AS (
    SELECT a.MaGV, a.MaDot, a.Ngay,
           SUM(CASE WHEN a.LoaiChuan = N'TN' THEN 1 ELSE 0 END) AS SoCaTN,
           SUM(CASE WHEN a.LoaiChuan = N'TL' THEN 1 ELSE 0 END) AS SoCaTL,
           SUM(CASE WHEN a.DenTiet >= a.TuTiet THEN a.DenTiet - a.TuTiet + 1 ELSE 0 END) AS SoTietThi,
           MAX(CASE WHEN a.TuTiet >= 13 THEN 1 ELSE 0 END) AS CoCaToi
    FROM Assigned a
    GROUP BY a.MaGV, a.MaDot, a.Ngay
),
DayEvents AS (
    SELECT MaGV, Ngay, TuTiet, DenTiet FROM BaseSchedule
    UNION ALL
    SELECT MaGV, Ngay, TuTiet, DenTiet FROM Assigned
),
EventPrevious AS (
    SELECT e.MaGV, e.Ngay, e.TuTiet, e.DenTiet,
           MAX(e.DenTiet) OVER (
               PARTITION BY e.MaGV, e.Ngay
               ORDER BY e.TuTiet, e.DenTiet
               ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
           ) AS PreviousEnd
    FROM DayEvents e
),
EventGroups AS (
    SELECT e.MaGV, e.Ngay, e.TuTiet, e.DenTiet,
           SUM(CASE WHEN e.PreviousEnd IS NULL OR e.TuTiet > e.PreviousEnd + 1 THEN 1 ELSE 0 END) OVER (
               PARTITION BY e.MaGV, e.Ngay
               ORDER BY e.TuTiet, e.DenTiet
               ROWS UNBOUNDED PRECEDING
           ) AS RunId
    FROM EventPrevious e
),
RunStats AS (
    SELECT MaGV, Ngay, MAX(SoEvents) AS MaxContinuousEvents
    FROM (
        SELECT MaGV, Ngay, RunId, COUNT(*) AS SoEvents
        FROM EventGroups
        GROUP BY MaGV, Ngay, RunId
    ) r
    GROUP BY MaGV, Ngay
),
DailyRules AS (
    SELECT a.MaDot, a.MaGV, a.Ngay,
           ISNULL(b.SoTietNen, 0) AS SoTietNen,
           ISNULL(b.SoBlockNen, 0) AS SoBlockNen,
           ISNULL(a.SoCaTN, 0) AS SoCaTN,
           ISNULL(a.SoCaTL, 0) AS SoCaTL,
           ISNULL(a.SoTietThi, 0) AS SoTietThi,
           ISNULL(a.CoCaToi, 0) AS CoCaToi,
           ISNULL(r.MaxContinuousEvents, 0) AS MaxContinuousEvents,
           CASE
               WHEN ISNULL(b.SoTietNen, 0) BETWEEN 5 AND 6 THEN 3
               WHEN ISNULL(b.SoBlockNen, 0) = 1 THEN 4
               WHEN ISNULL(b.SoBlockNen, 0) = 2 THEN 2
               WHEN ISNULL(b.SoBlockNen, 0) >= 3 THEN 1
               ELSE 2147483647
           END AS MaxTN,
           CASE
               WHEN ISNULL(b.SoTietNen, 0) BETWEEN 5 AND 6 THEN 2
               WHEN ISNULL(b.SoBlockNen, 0) = 1 THEN 3
               WHEN ISNULL(b.SoBlockNen, 0) = 2 THEN 2
               WHEN ISNULL(b.SoBlockNen, 0) >= 3 THEN 1
               ELSE 2147483647
           END AS MaxTL
    FROM DailyAssigned a
    LEFT JOIN DailyBase b ON b.MaGV = a.MaGV AND b.Ngay = a.Ngay
    LEFT JOIN RunStats r ON r.MaGV = a.MaGV AND r.Ngay = a.Ngay
)
-- RB1: Cân bằng định mức
SELECT q.MaDot, N'RB1' AS MaRB, N'Không khớp định mức' AS LoaiViPham,
       q.MaGV, CAST(NULL AS VARCHAR(50)) AS MaCa, CAST(NULL AS VARCHAR(50)) AS MaCaLienQuan,
       CONCAT(N'GV ', q.MaGV, N' có ', q.SoCaThucTe, N' ca; định mức hiệu lực cần đúng ', q.SoCaCanXep, N' ca.') AS MoTa
FROM QuotaState q
WHERE q.SoCaThucTe <> q.SoCaCanXep

UNION ALL
-- RB2: Đủ giám thị mỗi ca (báo khi thừa GV trong View; thiếu GV được gộp trong Procedure)
SELECT c.MaDot, N'RB2', N'Thừa GV', NULL, c.MaCa, NULL,
       CONCAT(N'Ca ', c.MaCa, N' có ', x.SoGV, N' GV, cần đúng ', c.SoGVCanCap)
FROM dbo.CaThi c
INNER JOIN C x ON x.MaCa = c.MaCa
WHERE x.SoGV > c.SoGVCanCap

UNION ALL
-- RB3: Không trùng thời gian
SELECT c1.MaDot, N'RB3', N'Trùng thời gian', p1.MaGV, c1.MaCa, c2.MaCa,
       CONCAT(N'GV ', p1.MaGV, N' trùng ca ', c1.MaCa, N' và ', c2.MaCa)
FROM dbo.PhanCongCoiThi p1
INNER JOIN dbo.CaThi c1 ON c1.MaCa = p1.MaCa
INNER JOIN dbo.PhanCongCoiThi p2 ON p2.MaGV = p1.MaGV AND p2.MaCa > p1.MaCa
INNER JOIN dbo.CaThi c2 ON c2.MaCa = p2.MaCa AND c2.NgayThi = c1.NgayThi
    AND c1.TuTiet <= c2.DenTiet AND c2.TuTiet <= c1.DenTiet

UNION ALL
-- RB4 (Phần 1): Không trùng lịch dạy
SELECT c.MaDot, N'RB4', N'Trùng lịch dạy', p.MaGV, c.MaCa, NULL,
       CONCAT(N'GV ', p.MaGV, N' trùng lịch dạy ngày ', CONVERT(NVARCHAR(10), c.NgayThi, 103), N' với ca ', c.MaCa)
FROM dbo.PhanCongCoiThi p
INNER JOIN dbo.CaThi c ON c.MaCa = p.MaCa
INNER JOIN dbo.LichDayGV b ON b.MaGV = p.MaGV AND b.NgayDay = c.NgayThi
    AND c.TuTiet <= b.DenTiet AND b.TuTiet <= c.DenTiet

UNION ALL
-- RB4 (Phần 2): Không trùng lịch trực đề
SELECT c.MaDot, N'RB4', N'Trùng lịch trực đề', p.MaGV, c.MaCa, NULL,
       CONCAT(N'GV ', p.MaGV, N' trùng lịch trực đề ngày ', CONVERT(NVARCHAR(10), c.NgayThi, 103), N' với ca ', c.MaCa)
FROM dbo.PhanCongCoiThi p
INNER JOIN dbo.CaThi c ON c.MaCa = p.MaCa
INNER JOIN dbo.PhanCongTrucDe td ON td.MaGV = p.MaGV AND td.NgayThi = c.NgayThi
    AND c.TuTiet <= td.DenTiet AND td.TuTiet <= c.DenTiet

UNION ALL
-- RB5: Một buổi một loại ca
SELECT s.MaDot, N'RB5', N'Trộn nhóm ca trong buổi', s.MaGV, NULL, NULL,
       CONCAT(N'GV ', s.MaGV, N' được phân công ', s.SoNhom, N' nhóm ca khác nhau trong ngày ',
              CONVERT(NVARCHAR(10), s.NgayThi, 103), N', buổi ', s.Buoi)
FROM Sessions s
WHERE s.SoNhom > 1

UNION ALL
-- RB6: Phải né lịch bận mức 1
SELECT c.MaDot, N'RB6', N'Lịch bận mức 1', p.MaGV, c.MaCa, NULL,
       CONCAT(N'GV ', p.MaGV, N' bị phân công trùng lịch bận mức 1 ngày ',
              CONVERT(NVARCHAR(10), c.NgayThi, 103), N', ca ', c.MaCa)
FROM dbo.PhanCongCoiThi p
INNER JOIN dbo.CaThi c ON c.MaCa = p.MaCa
INNER JOIN dbo.LichBanGV b ON b.MaGV = p.MaGV AND b.UuTien = 1 AND b.NgayBan = c.NgayThi
    AND c.TuTiet <= b.DenTiet AND b.TuTiet <= c.DenTiet

UNION ALL
-- RB9: Giới hạn ca trong ngày và lịch nối tiếp
SELECT d.MaDot, N'RB9', N'Vượt giới hạn ca trong ngày/chuỗi liên tục', d.MaGV, x.MaCa, NULL,
       CONCAT(N'GV ', d.MaGV, N' ngày ', CONVERT(NVARCHAR(10), d.Ngay, 103),
              N': tải nền ', d.SoTietNen, N' tiết/', d.SoBlockNen, N' lịch; TN ', d.SoCaTN, N'/', d.MaxTN,
              N'; TL ', d.SoCaTL, N'/', d.MaxTL, N'; chuỗi liên tục ', d.MaxContinuousEvents, N' lịch.')
FROM DailyRules d
OUTER APPLY (
    SELECT TOP (1) a.MaCa
    FROM Assigned a
    WHERE a.MaDot = d.MaDot AND a.MaGV = d.MaGV AND a.Ngay = d.Ngay
    ORDER BY a.TuTiet, a.MaCa
) x
WHERE d.SoCaTN > d.MaxTN
   OR d.SoCaTL > d.MaxTL
   OR (d.CoCaToi = 1 AND d.MaxContinuousEvents >= 3)

UNION ALL
-- RB8: chẩn đoán mềm ca tối trong ngày đã có nhiều lịch.
SELECT d.MaDot, N'RB8', N'Ca tối làm tổng lịch trong ngày vượt 12 tiết', d.MaGV, a.MaCa, NULL,
       CONCAT(N'GV ', d.MaGV, N' nhận ca tối ', a.MaCa, N' (từ tiết ', a.TuTiet, N') ngày ',
              CONVERT(NVARCHAR(10), d.Ngay, 103), N' với tổng tải ', d.SoTietNen + d.SoTietThi,
              N' tiết (vượt giới hạn 12 tiết/ngày).')
FROM DailyRules d
INNER JOIN Assigned a ON a.MaDot = d.MaDot AND a.MaGV = d.MaGV AND a.Ngay = d.Ngay
WHERE a.TuTiet >= 13
  AND (d.SoTietNen + d.SoTietThi) > 12;
GO

/* RB8 là mềm ngay từ định nghĩa đầu tiên; các thủ tục/trigger cứng chỉ đọc view đã lọc. */
CREATE OR ALTER VIEW dbo.vw_ViPhamRangBuocMem_RB8
AS
SELECT MaDot,MaRB,LoaiViPham,MaGV,MaCa,MaCaLienQuan,MoTa
FROM dbo.vw_ViPhamRangBuocCung_Detail
WHERE MaRB=N'RB8';
GO

CREATE OR ALTER VIEW dbo.vw_ViPhamRangBuocCung
AS
SELECT MaDot,MaRB,LoaiViPham,MaGV,MaCa,MaCaLienQuan,MoTa
FROM dbo.vw_ViPhamRangBuocCung_Detail
WHERE MaRB<>N'RB8';
GO


/*2. VIEW VÀ PROCEDURE RIÊNG CHO RB8 (Tương thích với script RB8 lẻ)*/
CREATE OR ALTER VIEW dbo.vw_ViPhamRangBuocCung_RB8
AS
SELECT v.MaDot, v.MaCa, v.MaGV, c.NgayThi,
       CAST(N'RB8' AS NVARCHAR(10)) AS MaRangBuoc,
       v.MoTa AS NoiDung
FROM dbo.vw_ViPhamRangBuocMem_RB8 v
LEFT JOIN dbo.CaThi c ON c.MaCa = v.MaCa
WHERE v.MaRB = N'RB8';
GO

CREATE PROCEDURE dbo.sp_KiemTraRangBuoc_RB8
    @MaDot VARCHAR(20),
    @ThrowIfFail BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.vw_ViPhamRangBuocCung_RB8 WHERE MaDot = @MaDot)
    BEGIN
        SELECT CAST(1 AS BIT) AS HopLe,
               CAST(N'RB8: Không có ngày ca tối làm tổng lịch vượt 12 tiết.' AS NVARCHAR(200)) AS ThongBao;
        RETURN;
    END;

    SELECT CAST(0 AS BIT) AS HopLe, MaDot, MaCa, MaGV, NgayThi, MaRangBuoc, NoiDung
    FROM dbo.vw_ViPhamRangBuocCung_RB8
    WHERE MaDot = @MaDot
    ORDER BY NgayThi, MaCa, MaGV;
END;
GO


/* 3. STORED PROCEDURE KIỂM TRA CỨNG VÀ BÁO CÁO RB1 -> RB9 (RB8 là mềm). */
ALTER PROCEDURE dbo.sp_KiemTraRangBuoc
    @MaDot VARCHAR(20),
    @ThrowIfFail BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS(SELECT 1 FROM dbo.DotThi WHERE MaDot = @MaDot)
        THROW 53000, N'Đợt thi không tồn tại.', 1;

    CREATE TABLE #QuotaState (
        MaGV VARCHAR(20) COLLATE DATABASE_DEFAULT NOT NULL PRIMARY KEY,
        SoCaCanXep INT NOT NULL,
        SoCaThucTe INT NOT NULL
    );

    ;WITH ApprovedHistory AS (
        SELECT ls.MaLichSu, ls.MaCa, ls.MaGV, ls.MaGVThayThe,
               ROW_NUMBER() OVER(PARTITION BY ls.MaCa ORDER BY ls.MaLichSu DESC) AS RN
        FROM dbo.LichSuDieuChinhLich ls
        JOIN dbo.YeuCauBaoBan y ON y.MaYeuCau = ls.MaYeuCau AND y.TrangThai = 'APPROVED'
        JOIN dbo.CaThi c ON c.MaCa = ls.MaCa AND c.MaDot = @MaDot
        WHERE ls.HanhDong = N'DUYET_DOI_LICH'
          AND ls.MaGV IS NOT NULL AND ls.MaGVThayThe IS NOT NULL
    ), EffectiveCovers AS (
        SELECT h.MaCa, h.MaLichSu
        FROM ApprovedHistory h
        WHERE h.RN = 1 AND EXISTS (
            SELECT 1 FROM dbo.PhanCongCoiThi p
            WHERE p.MaCa = h.MaCa AND p.MaGV = h.MaGVThayThe
        )
    ), TransferRows AS (
        SELECT c.MaDot, h.MaGV AS MaGVTruoc, h.MaGVThayThe AS MaGVSau
        FROM dbo.LichSuDieuChinhLich h
        JOIN dbo.YeuCauBaoBan y ON y.MaYeuCau = h.MaYeuCau AND y.TrangThai = 'APPROVED'
        JOIN dbo.CaThi c ON c.MaCa = h.MaCa AND c.MaDot = @MaDot
        JOIN EffectiveCovers e ON e.MaCa = h.MaCa AND h.MaLichSu <= e.MaLichSu
        WHERE h.HanhDong = N'DUYET_DOI_LICH'
          AND h.MaGV IS NOT NULL AND h.MaGVThayThe IS NOT NULL
    ), TransferDelta AS (
        SELECT MaDot, MaGV, SUM(Delta) AS Delta
        FROM (
            SELECT MaDot, MaGVTruoc AS MaGV, -1 AS Delta FROM TransferRows
            UNION ALL
            SELECT MaDot, MaGVSau AS MaGV, 1 AS Delta FROM TransferRows
        ) d
        GROUP BY MaDot, MaGV
    ), LecturerScope AS (
        SELECT MaGV FROM dbo.DinhMucPhanCong WHERE MaDot = @MaDot
        UNION SELECT p.MaGV FROM dbo.PhanCongCoiThi p JOIN dbo.CaThi c ON c.MaCa = p.MaCa WHERE c.MaDot = @MaDot
        UNION SELECT MaGVTruoc FROM TransferRows
        UNION SELECT MaGVSau FROM TransferRows
    ), AssignmentCounts AS (
        SELECT p.MaGV, COUNT(*) AS SoCa
        FROM dbo.PhanCongCoiThi p JOIN dbo.CaThi c ON c.MaCa = p.MaCa
        WHERE c.MaDot = @MaDot
        GROUP BY p.MaGV
    )
    INSERT INTO #QuotaState(MaGV, SoCaCanXep, SoCaThucTe)
    SELECT s.MaGV, ISNULL(d.SoCaQuyDinh, 0) + ISNULL(td.Delta, 0), ISNULL(a.SoCa, 0)
    FROM LecturerScope s
    LEFT JOIN dbo.DinhMucPhanCong d ON d.MaDot = @MaDot AND d.MaGV = s.MaGV
    LEFT JOIN TransferDelta td ON td.MaGV = s.MaGV AND td.MaDot = @MaDot
    LEFT JOIN AssignmentCounts a ON a.MaGV = s.MaGV;

    DECLARE @RB TABLE(MaRB NVARCHAR(10) PRIMARY KEY, TenRangBuoc NVARCHAR(200), SoViPham INT);
    INSERT @RB VALUES
        (N'RB1', N'Cân bằng định mức', 0),
        (N'RB2', N'Đủ giám thị mỗi ca', 0),
        (N'RB3', N'Không trùng thời gian', 0),
        (N'RB4', N'Không xếp vào lịch dạy & trực đề', 0),
        (N'RB5', N'Một buổi một loại ca', 0),
        (N'RB6', N'Phải né lịch bận mức 1', 0),
        (N'RB7', N'Thời gian di chuyển khác cơ sở', 0),
        (N'RB9', N'Giới hạn ca trong ngày và lịch nối tiếp', 0);

    UPDATE @RB SET SoViPham = (SELECT COUNT(*) FROM #QuotaState WHERE SoCaThucTe <> SoCaCanXep)
        WHERE MaRB = N'RB1';

    UPDATE @RB SET SoViPham = (SELECT COUNT(*) FROM dbo.CaThi c
        WHERE c.MaDot = @MaDot AND (SELECT COUNT(*) FROM dbo.PhanCongCoiThi p WHERE p.MaCa = c.MaCa) <> c.SoGVCanCap)
        WHERE MaRB = N'RB2';

    UPDATE r SET SoViPham = x.SoViPham
    FROM @RB r
    CROSS APPLY (
        SELECT COUNT(*) AS SoViPham
        FROM dbo.vw_ViPhamRangBuocCung v
        WHERE v.MaDot = @MaDot AND v.MaRB = r.MaRB
    ) x
    WHERE r.MaRB IN (N'RB3', N'RB4', N'RB5', N'RB6', N'RB7', N'RB9');

    SELECT MaRB, TenRangBuoc, SoViPham,
           CASE WHEN SoViPham = 0 THEN CAST(100.00 AS DECIMAL(5,2)) ELSE CAST(0.00 AS DECIMAL(5,2)) END AS PhanTramDat,
           CASE WHEN SoViPham = 0 THEN N'ĐẠT 100%' ELSE N'VI PHẠM' END AS KetQua
    FROM @RB ORDER BY MaRB;

    SELECT MaRB, LoaiViPham, MaGV, MaCa, MaCaLienQuan, MoTa
    FROM dbo.vw_ViPhamRangBuocCung
    WHERE MaDot = @MaDot AND MaRB NOT IN (N'RB1', N'RB2')
    UNION ALL
    SELECT N'RB1', N'Không khớp định mức chính xác', q.MaGV, NULL, NULL,
           CONCAT(N'GV ', q.MaGV, N' có ', q.SoCaThucTe, N' ca; định mức hiệu lực cần đúng ', q.SoCaCanXep, N' ca.')
    FROM #QuotaState q
    WHERE q.SoCaThucTe <> q.SoCaCanXep
    UNION ALL
    SELECT N'RB2', N'Lệch số lượng GV', NULL, c.MaCa, NULL,
           CONCAT(N'Ca ', c.MaCa, N' có ', (SELECT COUNT(*) FROM dbo.PhanCongCoiThi p WHERE p.MaCa = c.MaCa), N'/', c.SoGVCanCap, N' GV')
    FROM dbo.CaThi c
    WHERE c.MaDot = @MaDot AND (SELECT COUNT(*) FROM dbo.PhanCongCoiThi p WHERE p.MaCa = c.MaCa) <> c.SoGVCanCap
    ORDER BY MaRB, MaGV, MaCa;

    IF @ThrowIfFail = 1 AND EXISTS(SELECT 1 FROM @RB WHERE SoViPham > 0)
        THROW 53004, N'Các ràng buộc cứng chưa đạt. Lịch chưa được chốt.', 1;
END;
GO


/*4. STORED PROCEDURE CHỐT XẾP LỊCH (chỉ chặn các ràng buộc cứng; RB8 là mềm)*/
ALTER PROCEDURE dbo.sp_ChotXepLich @MaDot VARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS(SELECT 1 FROM dbo.DotThi WHERE MaDot = @MaDot)
        THROW 53000, N'Đợt thi không tồn tại.', 1;

    CREATE TABLE #QuotaState (
        MaGV VARCHAR(20) COLLATE DATABASE_DEFAULT NOT NULL PRIMARY KEY,
        SoCaCanXep INT NOT NULL,
        SoCaThucTe INT NOT NULL
    );

    ;WITH ApprovedHistory AS (
        SELECT ls.MaLichSu, ls.MaCa, ls.MaGV, ls.MaGVThayThe,
               ROW_NUMBER() OVER(PARTITION BY ls.MaCa ORDER BY ls.MaLichSu DESC) AS RN
        FROM dbo.LichSuDieuChinhLich ls
        JOIN dbo.YeuCauBaoBan y ON y.MaYeuCau = ls.MaYeuCau AND y.TrangThai = 'APPROVED'
        JOIN dbo.CaThi c ON c.MaCa = ls.MaCa AND c.MaDot = @MaDot
        WHERE ls.HanhDong = N'DUYET_DOI_LICH'
          AND ls.MaGV IS NOT NULL AND ls.MaGVThayThe IS NOT NULL
    ), EffectiveCovers AS (
        SELECT h.MaCa, h.MaLichSu
        FROM ApprovedHistory h
        WHERE h.RN = 1 AND EXISTS (
            SELECT 1 FROM dbo.PhanCongCoiThi p
            WHERE p.MaCa = h.MaCa AND p.MaGV = h.MaGVThayThe
        )
    ), TransferRows AS (
        SELECT c.MaDot, h.MaGV AS MaGVTruoc, h.MaGVThayThe AS MaGVSau
        FROM dbo.LichSuDieuChinhLich h
        JOIN dbo.YeuCauBaoBan y ON y.MaYeuCau = h.MaYeuCau AND y.TrangThai = 'APPROVED'
        JOIN dbo.CaThi c ON c.MaCa = h.MaCa AND c.MaDot = @MaDot
        JOIN EffectiveCovers e ON e.MaCa = h.MaCa AND h.MaLichSu <= e.MaLichSu
        WHERE h.HanhDong = N'DUYET_DOI_LICH'
          AND h.MaGV IS NOT NULL AND h.MaGVThayThe IS NOT NULL
    ), TransferDelta AS (
        SELECT MaDot, MaGV, SUM(Delta) AS Delta
        FROM (
            SELECT MaDot, MaGVTruoc AS MaGV, -1 AS Delta FROM TransferRows
            UNION ALL
            SELECT MaDot, MaGVSau AS MaGV, 1 AS Delta FROM TransferRows
        ) d
        GROUP BY MaDot, MaGV
    ), LecturerScope AS (
        SELECT MaGV FROM dbo.DinhMucPhanCong WHERE MaDot = @MaDot
        UNION SELECT p.MaGV FROM dbo.PhanCongCoiThi p JOIN dbo.CaThi c ON c.MaCa = p.MaCa WHERE c.MaDot = @MaDot
        UNION SELECT MaGVTruoc FROM TransferRows
        UNION SELECT MaGVSau FROM TransferRows
    ), AssignmentCounts AS (
        SELECT p.MaGV, COUNT(*) AS SoCa
        FROM dbo.PhanCongCoiThi p JOIN dbo.CaThi c ON c.MaCa = p.MaCa
        WHERE c.MaDot = @MaDot
        GROUP BY p.MaGV
    )
    INSERT INTO #QuotaState(MaGV, SoCaCanXep, SoCaThucTe)
    SELECT s.MaGV, ISNULL(d.SoCaQuyDinh, 0) + ISNULL(td.Delta, 0), ISNULL(a.SoCa, 0)
    FROM LecturerScope s
    LEFT JOIN dbo.DinhMucPhanCong d ON d.MaDot = @MaDot AND d.MaGV = s.MaGV
    LEFT JOIN TransferDelta td ON td.MaGV = s.MaGV AND td.MaDot = @MaDot
    LEFT JOIN AssignmentCounts a ON a.MaGV = s.MaGV;

    DECLARE @N INT = (SELECT COUNT(*) FROM dbo.vw_ViPhamRangBuocCung
                      WHERE MaDot = @MaDot AND MaRB <> N'RB1');
    DECLARE @ThieuCa INT = (SELECT COUNT(*) FROM dbo.CaThi c WHERE c.MaDot = @MaDot AND
        (SELECT COUNT(*) FROM dbo.PhanCongCoiThi p WHERE p.MaCa = c.MaCa) <> c.SoGVCanCap);
    DECLARE @NgoaiDinhMuc INT = (SELECT COUNT(*) FROM #QuotaState WHERE SoCaThucTe <> SoCaCanXep);
    DECLARE @TongCa INT = (SELECT COUNT(*) FROM dbo.PhanCongCoiThi p JOIN dbo.CaThi c ON c.MaCa = p.MaCa WHERE c.MaDot = @MaDot);
    DECLARE @CaTrungLichBan INT = (SELECT COUNT(*) FROM dbo.PhanCongCoiThi p JOIN dbo.CaThi c ON c.MaCa = p.MaCa
        WHERE c.MaDot = @MaDot AND EXISTS(SELECT 1 FROM dbo.LichBanGV b WHERE b.MaGV = p.MaGV AND b.UuTien IN (2,3)
            AND b.NgayBan = c.NgayThi AND c.TuTiet <= b.DenTiet AND b.TuTiet <= c.DenTiet));
    DECLARE @TyLeNeLichBan DECIMAL(5,2) = CASE WHEN @TongCa = 0 THEN 100.00 ELSE 100.0 * (@TongCa - @CaTrungLichBan) / @TongCa END;
    DECLARE @TyLeToiThieu DECIMAL(5,2) = (SELECT TyLeNeLichBanToiThieu FROM dbo.CauHinhXepLich WHERE MaDot = @MaDot);

    IF @N > 0 OR @ThieuCa > 0 OR @NgoaiDinhMuc > 0
        THROW 53001, N'Không thể chốt: các ràng buộc cứng chưa đạt.', 1;

    SELECT @MaDot AS MaDot, N'ĐẠT - có thể chốt lịch' AS KetQua,
           @TyLeNeLichBan AS TyLeNeLichBan, @TyLeToiThieu AS TyLeNeToiThieu;
END;
GO


/* 5. TRIGGER BẢO VỆ TỨC THỜI KHI THÊM/SỬA PHÂN CÔNG */
GO

CREATE OR ALTER TRIGGER dbo.trg_PhanCong_RangBuocCung ON dbo.PhanCongCoiThi AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Loi NVARCHAR(1000);

    -- Kiểm tra tức thời các ràng buộc cứng RB2 -> RB9 (RB8 mềm, được bỏ qua)
    SELECT TOP 1 @Loi = CONCAT(N'[', v.MaRB, N'] ', v.MoTa)
    FROM dbo.vw_ViPhamRangBuocCung v
    WHERE v.MaRB IN (N'RB2', N'RB3', N'RB4', N'RB5', N'RB6', N'RB7', N'RB9')
      AND ((v.MaGV IN (SELECT MaGV FROM inserted))
        OR (v.MaGV IN (SELECT MaGV FROM deleted))
        OR (v.MaCa IN (SELECT MaCa FROM inserted))
        OR (v.MaCaLienQuan IN (SELECT MaCa FROM inserted)));

    IF @Loi IS NOT NULL
    BEGIN
        ROLLBACK;
        THROW 53002, @Loi, 1;
    END;

    -- Kiểm tra vượt định mức hiệu lực (RB1)
    ;WITH ApprovedHistory AS (
        SELECT ls.MaLichSu, ls.MaCa, ls.MaGV, ls.MaGVThayThe,
               ROW_NUMBER() OVER(PARTITION BY ls.MaCa ORDER BY ls.MaLichSu DESC) AS RN
        FROM dbo.LichSuDieuChinhLich ls
        JOIN dbo.YeuCauBaoBan y ON y.MaYeuCau = ls.MaYeuCau AND y.TrangThai = 'APPROVED'
        WHERE ls.HanhDong = N'DUYET_DOI_LICH'
          AND ls.MaGV IS NOT NULL AND ls.MaGVThayThe IS NOT NULL
    ), EffectiveCovers AS (
        SELECT h.MaCa, h.MaLichSu
        FROM ApprovedHistory h
        WHERE h.RN = 1 AND EXISTS (
            SELECT 1 FROM dbo.PhanCongCoiThi p
            WHERE p.MaCa = h.MaCa AND p.MaGV = h.MaGVThayThe
        )
    ), TransferRows AS (
        SELECT c.MaDot, h.MaGV AS MaGVTruoc, h.MaGVThayThe AS MaGVSau
        FROM dbo.LichSuDieuChinhLich h
        JOIN dbo.YeuCauBaoBan y ON y.MaYeuCau = h.MaYeuCau AND y.TrangThai = 'APPROVED'
        JOIN dbo.CaThi c ON c.MaCa = h.MaCa
        JOIN EffectiveCovers e ON e.MaCa = h.MaCa AND h.MaLichSu <= e.MaLichSu
        WHERE h.HanhDong = N'DUYET_DOI_LICH'
          AND h.MaGV IS NOT NULL AND h.MaGVThayThe IS NOT NULL
    ), TransferDelta AS (
        SELECT MaDot, MaGV, SUM(Delta) AS Delta
        FROM (
            SELECT MaDot, MaGVTruoc AS MaGV, -1 AS Delta FROM TransferRows
            UNION ALL
            SELECT MaDot, MaGVSau AS MaGV, 1 AS Delta FROM TransferRows
        ) d
        GROUP BY MaDot, MaGV
    ), ChangedAssignments AS (
        SELECT i.MaGV, c.MaDot FROM inserted i JOIN dbo.CaThi c ON c.MaCa = i.MaCa
        UNION
        SELECT d.MaGV, c.MaDot FROM deleted d JOIN dbo.CaThi c ON c.MaCa = d.MaCa
    ), AffectedPeriods AS (
        SELECT DISTINCT MaDot FROM ChangedAssignments
    ), AssignmentCounts AS (
        SELECT p.MaGV, c.MaDot, COUNT(*) AS SoCa
        FROM dbo.PhanCongCoiThi p JOIN dbo.CaThi c ON c.MaCa = p.MaCa
        WHERE EXISTS (SELECT 1 FROM AffectedPeriods x WHERE x.MaDot = c.MaDot)
        GROUP BY p.MaGV, c.MaDot
    ), LecturerScope AS (
        SELECT d.MaGV, d.MaDot
        FROM dbo.DinhMucPhanCong d
        JOIN AffectedPeriods a ON a.MaDot = d.MaDot
        UNION SELECT MaGV, MaDot FROM ChangedAssignments
        UNION SELECT MaGV, MaDot FROM TransferDelta
    ), Expected AS (
        SELECT s.MaGV, s.MaDot, ISNULL(d.SoCaQuyDinh, 0) + ISNULL(td.Delta, 0) AS SoCaCanXep
        FROM LecturerScope s
        LEFT JOIN dbo.DinhMucPhanCong d ON d.MaGV = s.MaGV AND d.MaDot = s.MaDot
        LEFT JOIN TransferDelta td ON td.MaGV = s.MaGV AND td.MaDot = s.MaDot
    )
    SELECT TOP 1 @Loi = CONCAT(N'[RB1] GV ', g.MaGV, N' vượt định mức hiệu lực ', e.SoCaCanXep, N' ca.')
    FROM ChangedAssignments g
    JOIN Expected e ON e.MaGV = g.MaGV AND e.MaDot = g.MaDot
    LEFT JOIN AssignmentCounts a ON a.MaGV = g.MaGV AND a.MaDot = g.MaDot
    WHERE ISNULL(a.SoCa, 0) > e.SoCaCanXep;

    IF @Loi IS NOT NULL
    BEGIN
        ROLLBACK;
        THROW 53002, @Loi, 1;
    END;
END;
GO


/* ========================= PHẦN HỢP NHẤT RB7 DI CHUYỂN + RB9 CŨ ========================= */
/*
    Migration RB7: thời gian di chuyển giữa lịch dạy khác cơ sở và ca thi.
    An toàn chạy lặp lại; không DROP/TRUNCATE và không xóa dữ liệu.
    Chỉ áp dụng sau khi backend/solver 2B đã được triển khai đồng bộ.

    Đây là bộ định nghĩa cuối cùng có hiệu lực cho view kiểm tra, thủ tục chốt
    và trigger. Các bản định nghĩa cũ ở trên được giữ để bảo toàn các thủ tục
    nghiệp vụ khác trong installer; các object cùng tên bên dưới ghi đè chúng.
*/
SET NOCOUNT ON;
GO

IF COL_LENGTH(N'dbo.LichDayGV',N'Phong') IS NULL
    ALTER TABLE dbo.LichDayGV ADD Phong NVARCHAR(100) NULL;
GO

IF COL_LENGTH(N'dbo.CauHinhXepLich',N'SoTietDiChuyenToiThieu') IS NULL
    ALTER TABLE dbo.CauHinhXepLich
        ADD SoTietDiChuyenToiThieu INT NOT NULL
            CONSTRAINT DF_CFG_DiChuyen DEFAULT (1) WITH VALUES;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id
    WHERE dc.parent_object_id=OBJECT_ID(N'dbo.CauHinhXepLich')
      AND c.name=N'SoTietDiChuyenToiThieu'
)
    ALTER TABLE dbo.CauHinhXepLich
        ADD CONSTRAINT DF_CFG_DiChuyen DEFAULT (1) FOR SoTietDiChuyenToiThieu;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name=N'CK_CFG_DiChuyen' AND parent_object_id=OBJECT_ID(N'dbo.CauHinhXepLich')
)
    ALTER TABLE dbo.CauHinhXepLich WITH CHECK
        ADD CONSTRAINT CK_CFG_DiChuyen CHECK(SoTietDiChuyenToiThieu BETWEEN 1 AND 4);
GO

CREATE OR ALTER FUNCTION dbo.fn_LaCoSoChinh(@Phong NVARCHAR(100))
RETURNS BIT
AS
BEGIN
    IF @Phong IS NULL OR LTRIM(RTRIM(@Phong))=N''
        RETURN NULL;

    DECLARE @Sep INT=CHARINDEX(N' - ',@Phong);
    IF @Sep=0
        RETURN NULL;

    DECLARE @CoSo NVARCHAR(100)=SUBSTRING(@Phong,@Sep+3,100);
    SET @CoSo=REPLACE(@CoSo,NCHAR(9),N' ');
    SET @CoSo=REPLACE(@CoSo,NCHAR(10),N' ');
    SET @CoSo=REPLACE(@CoSo,NCHAR(11),N' ');
    SET @CoSo=REPLACE(@CoSo,NCHAR(12),N' ');
    SET @CoSo=REPLACE(@CoSo,NCHAR(13),N' ');
    SET @CoSo=REPLACE(@CoSo,NCHAR(160),N' ');
    SET @CoSo=REPLACE(@CoSo,NCHAR(5760),N' ');
    SET @CoSo=REPLACE(@CoSo,NCHAR(8192),N' ');
    SET @CoSo=REPLACE(@CoSo,NCHAR(8193),N' ');
    SET @CoSo=REPLACE(@CoSo,NCHAR(8194),N' ');
    SET @CoSo=REPLACE(@CoSo,NCHAR(8195),N' ');
    SET @CoSo=REPLACE(@CoSo,NCHAR(8196),N' ');
    SET @CoSo=REPLACE(@CoSo,NCHAR(8197),N' ');
    SET @CoSo=REPLACE(@CoSo,NCHAR(8198),N' ');
    SET @CoSo=REPLACE(@CoSo,NCHAR(8199),N' ');
    SET @CoSo=REPLACE(@CoSo,NCHAR(8200),N' ');
    SET @CoSo=REPLACE(@CoSo,NCHAR(8201),N' ');
    SET @CoSo=REPLACE(@CoSo,NCHAR(8202),N' ');
    SET @CoSo=REPLACE(@CoSo,NCHAR(8232),N' ');
    SET @CoSo=REPLACE(@CoSo,NCHAR(8233),N' ');
    SET @CoSo=REPLACE(@CoSo,NCHAR(8239),N' ');
    SET @CoSo=REPLACE(@CoSo,NCHAR(8287),N' ');
    SET @CoSo=REPLACE(@CoSo,NCHAR(12288),N' ');
    SET @CoSo=REPLACE(@CoSo,NCHAR(65279),N' ');
    SET @CoSo=LTRIM(RTRIM(@CoSo));

    WHILE CHARINDEX(N'  ',@CoSo)>0
        SET @CoSo=REPLACE(@CoSo,N'  ',N' ');

    IF @CoSo=N''
        RETURN NULL;

    RETURN CASE
        WHEN @CoSo COLLATE Latin1_General_100_CI_AI =
             N'140 Lê Trọng Tấn' COLLATE Latin1_General_100_CI_AI
        THEN 1 ELSE 0 END;
END;
GO

/*
    SQL Server table types are immutable. Keep legacy dbo.LichDayGVInput and
    dbo.sp_ThayTheLichDayGV intact for old callers; RB7 callers use this
    additive versioned TVP/procedure pair.
*/
IF TYPE_ID(N'dbo.LichDayGVInput_RB7') IS NULL
    EXEC(N'CREATE TYPE dbo.LichDayGVInput_RB7 AS TABLE(
        NgayDay DATE NOT NULL,
        TuTiet INT NOT NULL,
        DenTiet INT NOT NULL,
        Phong NVARCHAR(100) NULL
    );');
GO

CREATE PROCEDURE dbo.sp_ThayTheLichDayGV_RB7
    @MaGV VARCHAR(20),
    @NguonFile NVARCHAR(255)=NULL,
    @Rows dbo.LichDayGVInput_RB7 READONLY
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF NOT EXISTS(SELECT 1 FROM dbo.GiangVien WHERE MaGV=@MaGV AND TrangThai=N'Đang công tác')
        THROW 52500,N'Giảng viên không tồn tại hoặc không còn công tác.',1;

    BEGIN TRY
        BEGIN TRANSACTION;
        DELETE FROM dbo.LichDayGV WHERE MaGV=@MaGV;
        INSERT dbo.LichDayGV(MaGV,NgayDay,TuTiet,DenTiet,Phong,NguonFile)
        SELECT @MaGV,NgayDay,TuTiet,DenTiet,Phong,@NguonFile FROM @Rows;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

ALTER PROCEDURE dbo.sp_ThemLichDayGV
    @MaGV VARCHAR(20),
    @NgayDay DATE,
    @TuTiet INT,
    @DenTiet INT,
    @NguonFile NVARCHAR(255)=NULL,
    @GhiChu NVARCHAR(255)=NULL,
    @Phong NVARCHAR(100)=NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT dbo.LichDayGV(MaGV,NgayDay,TuTiet,DenTiet,NguonFile,GhiChu,Phong)
    VALUES(@MaGV,@NgayDay,@TuTiet,@DenTiet,@NguonFile,@GhiChu,@Phong);
END;
GO
CREATE OR ALTER VIEW dbo.vw_ViPhamRangBuocCung_Detail
AS
WITH ApprovedHistory AS (
    SELECT ls.MaLichSu,ls.MaCa,ls.MaGV,ls.MaGVThayThe,
           ROW_NUMBER() OVER(PARTITION BY ls.MaCa ORDER BY ls.MaLichSu DESC) AS RN
    FROM dbo.LichSuDieuChinhLich ls
    JOIN dbo.YeuCauBaoBan y ON y.MaYeuCau=ls.MaYeuCau AND y.TrangThai='APPROVED'
    WHERE ls.HanhDong=N'DUYET_DOI_LICH'
      AND ls.MaGV IS NOT NULL AND ls.MaGVThayThe IS NOT NULL
), EffectiveCovers AS (
    SELECT h.MaCa,h.MaLichSu
    FROM ApprovedHistory h
    WHERE h.RN=1 AND EXISTS (
        SELECT 1 FROM dbo.PhanCongCoiThi p
        WHERE p.MaCa=h.MaCa AND p.MaGV=h.MaGVThayThe
    )
), TransferRows AS (
    SELECT c.MaDot,h.MaGV AS MaGVTruoc,h.MaGVThayThe AS MaGVSau
    FROM dbo.LichSuDieuChinhLich h
    JOIN dbo.YeuCauBaoBan y ON y.MaYeuCau=h.MaYeuCau AND y.TrangThai='APPROVED'
    JOIN dbo.CaThi c ON c.MaCa=h.MaCa
    JOIN EffectiveCovers e ON e.MaCa=h.MaCa AND h.MaLichSu<=e.MaLichSu
    WHERE h.HanhDong=N'DUYET_DOI_LICH'
      AND h.MaGV IS NOT NULL AND h.MaGVThayThe IS NOT NULL
), TransferDelta AS (
    SELECT MaDot,MaGV,SUM(Delta) AS Delta
    FROM (
        SELECT MaDot,MaGVTruoc AS MaGV,-1 AS Delta FROM TransferRows
        UNION ALL
        SELECT MaDot,MaGVSau AS MaGV,1 AS Delta FROM TransferRows
    ) d
    GROUP BY MaDot,MaGV
), AssignmentCounts AS (
    SELECT c.MaDot,p.MaGV,COUNT(*) AS SoCa
    FROM dbo.PhanCongCoiThi p
    JOIN dbo.CaThi c ON c.MaCa=p.MaCa
    GROUP BY c.MaDot,p.MaGV
), QuotaScope AS (
    SELECT MaDot,MaGV FROM dbo.DinhMucPhanCong
    UNION SELECT MaDot,MaGV FROM AssignmentCounts
    UNION SELECT MaDot,MaGV FROM TransferDelta
), QuotaState AS (
    SELECT q.MaDot,q.MaGV,
           ISNULL(d.SoCaQuyDinh,0)+ISNULL(t.Delta,0) AS SoCaCanXep,
           ISNULL(a.SoCa,0) AS SoCaThucTe
    FROM QuotaScope q
    LEFT JOIN dbo.DinhMucPhanCong d ON d.MaDot=q.MaDot AND d.MaGV=q.MaGV
    LEFT JOIN TransferDelta t ON t.MaDot=q.MaDot AND t.MaGV=q.MaGV
    LEFT JOIN AssignmentCounts a ON a.MaDot=q.MaDot AND a.MaGV=q.MaGV
), C AS (
    SELECT MaCa,COUNT(*) AS SoGV
    FROM dbo.PhanCongCoiThi
    GROUP BY MaCa
), AssignedType AS (
    SELECT p.MaGV,c.MaDot,c.NgayThi,c.Buoi,c.NhomHinhThucThi
    FROM dbo.PhanCongCoiThi p
    JOIN dbo.CaThi c ON c.MaCa=p.MaCa
    GROUP BY p.MaGV,c.MaDot,c.NgayThi,c.Buoi,c.NhomHinhThucThi
), Sessions AS (
    SELECT MaGV,MaDot,NgayThi,Buoi,COUNT(*) AS SoNhom
    FROM AssignedType
    GROUP BY MaGV,MaDot,NgayThi,Buoi
), DutySchedule AS (
    SELECT td.MaDot,td.MaGV,td.NgayThi AS Ngay,td.TuTiet,td.DenTiet
    FROM dbo.PhanCongTrucDe td
), BaseSchedule AS (
    SELECT ld.MaGV,ld.NgayDay AS Ngay,ld.TuTiet,ld.DenTiet
    FROM dbo.LichDayGV ld
    UNION ALL
    SELECT td.MaGV,td.Ngay,td.TuTiet,td.DenTiet
    FROM DutySchedule td
), DailyBase AS (
    SELECT MaGV,Ngay,
           SUM(CASE WHEN DenTiet>=TuTiet THEN DenTiet-TuTiet+1 ELSE 0 END) AS SoTietNen,
           COUNT(*) AS SoBlockNen
    FROM BaseSchedule
    GROUP BY MaGV,Ngay
), Assigned AS (
    SELECT p.MaGV,c.MaDot,c.MaCa,c.NgayThi AS Ngay,c.TuTiet,c.DenTiet,
           CASE WHEN (c.DenTiet-c.TuTiet+1)=2
                  OR c.HinhThucThi IN(N'Trắc nghiệm',N'Lý thuyết')
                THEN N'TN' ELSE N'TL' END AS LoaiChuan
    FROM dbo.PhanCongCoiThi p
    JOIN dbo.CaThi c ON c.MaCa=p.MaCa
), DailyAssigned AS (
    SELECT a.MaGV,a.MaDot,a.Ngay,
           SUM(CASE WHEN a.LoaiChuan=N'TN' THEN 1 ELSE 0 END) AS SoCaTN,
           SUM(CASE WHEN a.LoaiChuan=N'TL' THEN 1 ELSE 0 END) AS SoCaTL,
           SUM(CASE WHEN a.DenTiet>=a.TuTiet THEN a.DenTiet-a.TuTiet+1 ELSE 0 END) AS SoTietThi,
           MAX(CASE WHEN a.TuTiet>=13 THEN 1 ELSE 0 END) AS CoCaToi
    FROM Assigned a
    GROUP BY a.MaGV,a.MaDot,a.Ngay
), DayEvents AS (
    SELECT MaGV,Ngay,TuTiet,DenTiet FROM BaseSchedule
    UNION ALL
    SELECT MaGV,Ngay,TuTiet,DenTiet FROM Assigned
), EventPrevious AS (
    SELECT e.MaGV,e.Ngay,e.TuTiet,e.DenTiet,
           MAX(e.DenTiet) OVER(
               PARTITION BY e.MaGV,e.Ngay
               ORDER BY e.TuTiet,e.DenTiet
               ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
           ) AS PreviousEnd
    FROM DayEvents e
), EventGroups AS (
    SELECT e.MaGV,e.Ngay,e.TuTiet,e.DenTiet,
           SUM(CASE WHEN e.PreviousEnd IS NULL OR e.TuTiet>e.PreviousEnd+1 THEN 1 ELSE 0 END) OVER(
               PARTITION BY e.MaGV,e.Ngay
               ORDER BY e.TuTiet,e.DenTiet
               ROWS UNBOUNDED PRECEDING
           ) AS RunId
    FROM EventPrevious e
), RunStats AS (
    SELECT MaGV,Ngay,MAX(SoEvents) AS MaxContinuousEvents
    FROM (
        SELECT MaGV,Ngay,RunId,COUNT(*) AS SoEvents
        FROM EventGroups
        GROUP BY MaGV,Ngay,RunId
    ) r
    GROUP BY MaGV,Ngay
), DailyRules AS (
    SELECT a.MaDot,a.MaGV,a.Ngay,
           ISNULL(b.SoTietNen,0) AS SoTietNen,
           ISNULL(b.SoBlockNen,0) AS SoBlockNen,
           ISNULL(a.SoCaTN,0) AS SoCaTN,
           ISNULL(a.SoCaTL,0) AS SoCaTL,
           ISNULL(a.SoTietThi,0) AS SoTietThi,
           ISNULL(a.CoCaToi,0) AS CoCaToi,
           ISNULL(r.MaxContinuousEvents,0) AS MaxContinuousEvents,
           CASE
               WHEN ISNULL(b.SoTietNen,0) BETWEEN 5 AND 6 THEN 3
               WHEN ISNULL(b.SoBlockNen,0)=1 THEN 4
               WHEN ISNULL(b.SoBlockNen,0)=2 THEN 2
               WHEN ISNULL(b.SoBlockNen,0)>=3 THEN 1
               ELSE 2147483647
           END AS MaxTN,
           CASE
               WHEN ISNULL(b.SoTietNen,0) BETWEEN 5 AND 6 THEN 2
               WHEN ISNULL(b.SoBlockNen,0)=1 THEN 3
               WHEN ISNULL(b.SoBlockNen,0)=2 THEN 2
               WHEN ISNULL(b.SoBlockNen,0)>=3 THEN 1
               ELSE 2147483647
           END AS MaxTL
    FROM DailyAssigned a
    LEFT JOIN DailyBase b ON b.MaGV=a.MaGV AND b.Ngay=a.Ngay
    LEFT JOIN RunStats r ON r.MaGV=a.MaGV AND r.Ngay=a.Ngay
)
SELECT q.MaDot,N'RB1' AS MaRB,N'Không khớp định mức chính xác' AS LoaiViPham,
       q.MaGV,CAST(NULL AS VARCHAR(50)) AS MaCa,CAST(NULL AS VARCHAR(50)) AS MaCaLienQuan,
       CONCAT(N'GV ',q.MaGV,N' được phân công ',q.SoCaThucTe,
              N' ca; định mức hiệu lực là ',q.SoCaCanXep,N' ca.') AS MoTa
FROM QuotaState q
WHERE q.SoCaThucTe<>q.SoCaCanXep

UNION ALL
SELECT c.MaDot,N'RB2',N'Thừa GV',NULL,c.MaCa,NULL,
       CONCAT(N'Ca ',c.MaCa,N' có ',x.SoGV,N' GV, cần đúng ',c.SoGVCanCap)
FROM dbo.CaThi c JOIN C x ON x.MaCa=c.MaCa
WHERE x.SoGV>c.SoGVCanCap

UNION ALL
SELECT c1.MaDot,N'RB3',N'Trùng thời gian',p1.MaGV,c1.MaCa,c2.MaCa,
       CONCAT(N'GV ',p1.MaGV,N' trùng ca ',c1.MaCa,N' và ',c2.MaCa)
FROM dbo.PhanCongCoiThi p1
JOIN dbo.CaThi c1 ON c1.MaCa=p1.MaCa
JOIN dbo.PhanCongCoiThi p2 ON p2.MaGV=p1.MaGV AND p2.MaCa>p1.MaCa
JOIN dbo.CaThi c2 ON c2.MaCa=p2.MaCa AND c2.NgayThi=c1.NgayThi
    AND c1.TuTiet<=c2.DenTiet AND c2.TuTiet<=c1.DenTiet

UNION ALL
SELECT c.MaDot,N'RB4',N'Trùng lịch dạy',p.MaGV,c.MaCa,NULL,
       CONCAT(N'GV ',p.MaGV,N' trùng lịch dạy ngày ',CONVERT(NVARCHAR(10),c.NgayThi,103),N' với ca ',c.MaCa)
FROM dbo.PhanCongCoiThi p
JOIN dbo.CaThi c ON c.MaCa=p.MaCa
JOIN dbo.LichDayGV b ON b.MaGV=p.MaGV AND b.NgayDay=c.NgayThi
    AND c.TuTiet<=b.DenTiet AND b.TuTiet<=c.DenTiet

UNION ALL
SELECT c.MaDot,N'RB4',N'Trùng lịch trực đề',p.MaGV,c.MaCa,NULL,
       CONCAT(N'GV ',p.MaGV,N' trùng lịch trực đề ngày ',CONVERT(NVARCHAR(10),c.NgayThi,103),N' với ca ',c.MaCa)
FROM dbo.PhanCongCoiThi p
JOIN dbo.CaThi c ON c.MaCa=p.MaCa
JOIN dbo.PhanCongTrucDe td ON td.MaGV=p.MaGV AND td.NgayThi=c.NgayThi
    AND c.TuTiet<=td.DenTiet AND td.TuTiet<=c.DenTiet

UNION ALL
SELECT s.MaDot,N'RB5',N'Trộn nhóm ca trong buổi',s.MaGV,NULL,NULL,
       CONCAT(N'GV ',s.MaGV,N' được phân công nhiều nhóm hình thức trong ngày ',
              CONVERT(NVARCHAR(10),s.NgayThi,103),N', buổi ',s.Buoi)
FROM Sessions s
WHERE s.SoNhom>1

UNION ALL
SELECT c.MaDot,N'RB6',N'Lịch bận mức 1',p.MaGV,c.MaCa,NULL,
       CONCAT(N'GV ',p.MaGV,N' trùng lịch bận mức 1 ngày ',CONVERT(NVARCHAR(10),c.NgayThi,103),N', ca ',c.MaCa)
FROM dbo.PhanCongCoiThi p
JOIN dbo.CaThi c ON c.MaCa=p.MaCa
JOIN dbo.LichBanGV b ON b.MaGV=p.MaGV AND b.UuTien=1 AND b.NgayBan=c.NgayThi
    AND c.TuTiet<=b.DenTiet AND b.TuTiet<=c.DenTiet

UNION ALL
SELECT c.MaDot,N'RB7',N'Thiếu thời gian di chuyển khác cơ sở',p.MaGV,c.MaCa,NULL,
       CONCAT(N'GV ',p.MaGV,N' (',g.HoTen,N') ngày ',CONVERT(NVARCHAR(10),c.NgayThi,103),
              N', ca ',c.MaCa,N' (tiết ',c.TuTiet,N'–',c.DenTiet,
              N') và lịch dạy (tiết ',ld.TuTiet,N'–',ld.DenTiet,
              N', phòng/cơ sở ',COALESCE(ld.Phong,N'(không rõ)'),N') thiếu thời gian di chuyển.')
FROM dbo.PhanCongCoiThi p
JOIN dbo.CaThi c ON c.MaCa=p.MaCa
JOIN dbo.GiangVien g ON g.MaGV=p.MaGV
JOIN dbo.LichDayGV ld ON ld.MaGV=p.MaGV AND ld.NgayDay=c.NgayThi
LEFT JOIN dbo.CauHinhXepLich cfg ON cfg.MaDot=c.MaDot
WHERE dbo.fn_LaCoSoChinh(ld.Phong)=0
  AND NOT (ld.TuTiet<=c.DenTiet AND c.TuTiet<=ld.DenTiet)
  AND ((c.TuTiet>ld.DenTiet
        AND c.TuTiet-ld.DenTiet-1<COALESCE(cfg.SoTietDiChuyenToiThieu,1))
    OR (ld.TuTiet>c.DenTiet
        AND ld.TuTiet-c.DenTiet-1<COALESCE(cfg.SoTietDiChuyenToiThieu,1)))

UNION ALL
SELECT c.MaDot,N'RB8',N'Ca tối làm tổng lịch trong ngày vượt 12 tiết',p.MaGV,c.MaCa,NULL,
       CONCAT(N'GV ',p.MaGV,N' nhận ca tối ',c.MaCa,N' ngày ',
              CONVERT(NVARCHAR(10),c.NgayThi,103),N' với tổng tải ',
              ISNULL(f.SoTietNen,0)+ISNULL(a.SoTietThi,0),N' tiết, vượt giới hạn 12 tiết/ngày.')
FROM dbo.PhanCongCoiThi p
JOIN dbo.CaThi c ON c.MaCa=p.MaCa
CROSS APPLY (
    SELECT ISNULL((SELECT SUM(DenTiet-TuTiet+1)
                   FROM dbo.LichDayGV
                   WHERE MaGV=p.MaGV AND NgayDay=c.NgayThi),0)
         + ISNULL((SELECT SUM(DenTiet-TuTiet+1)
                   FROM dbo.PhanCongTrucDe
                   WHERE MaGV=p.MaGV AND NgayThi=c.NgayThi),0) AS SoTietNen
) f
CROSS APPLY (
    SELECT SUM(c2.DenTiet-c2.TuTiet+1) AS SoTietThi
    FROM dbo.PhanCongCoiThi p2
    JOIN dbo.CaThi c2 ON c2.MaCa=p2.MaCa
    WHERE p2.MaGV=p.MaGV AND c2.MaDot=c.MaDot AND c2.NgayThi=c.NgayThi
) a
WHERE c.TuTiet>=13
  AND ISNULL(f.SoTietNen,0)+ISNULL(a.SoTietThi,0)>12

UNION ALL
SELECT d.MaDot,N'RB9',N'Vượt giới hạn ca trong ngày/chuỗi liên tục',d.MaGV,x.MaCa,NULL,
       CONCAT(N'GV ',d.MaGV,N' ngày ',CONVERT(NVARCHAR(10),d.Ngay,103),
              N': tải nền ',d.SoTietNen,N' tiết/',d.SoBlockNen,N' lịch; TN ',d.SoCaTN,N'/',d.MaxTN,
              N'; TL ',d.SoCaTL,N'/',d.MaxTL,N'; chuỗi liên tục ',d.MaxContinuousEvents,N' lịch.')
FROM DailyRules d
OUTER APPLY (
    SELECT TOP (1) a.MaCa
    FROM Assigned a
    WHERE a.MaDot=d.MaDot AND a.MaGV=d.MaGV AND a.Ngay=d.Ngay
    ORDER BY a.TuTiet,a.MaCa
) x
WHERE d.SoCaTN>d.MaxTN
   OR d.SoCaTL>d.MaxTL
   OR (d.CoCaToi=1 AND d.MaxContinuousEvents>=3);
GO

ALTER PROCEDURE dbo.sp_KiemTraRangBuoc
    @MaDot VARCHAR(20),
    @ThrowIfFail BIT=0
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS(SELECT 1 FROM dbo.DotThi WHERE MaDot=@MaDot)
        THROW 53000,N'Đợt thi không tồn tại.',1;

    DECLARE @RB TABLE(MaRB NVARCHAR(10) PRIMARY KEY,TenRangBuoc NVARCHAR(200),SoViPham INT);
    INSERT @RB VALUES
        (N'RB1',N'Khớp định mức và đổi ca đã duyệt',0),
        (N'RB2',N'Mỗi ca đúng số GV cần cấp',0),
        (N'RB3',N'GV không coi 2 ca trùng thời gian',0),
        (N'RB4',N'GV không trùng lịch dạy hoặc trực đề',0),
        (N'RB5',N'Không trộn nhóm ca trong buổi',0),
        (N'RB6',N'Né lịch bận mức 1',0),
        (N'RB7',N'Thời gian di chuyển khác cơ sở',0),
        (N'RB9',N'Giới hạn ca trong ngày và lịch nối tiếp',0);

    UPDATE r SET SoViPham=x.SoViPham
    FROM @RB r
    CROSS APPLY (
        SELECT COUNT(*) AS SoViPham
        FROM dbo.vw_ViPhamRangBuocCung v
        WHERE v.MaDot=@MaDot AND v.MaRB=r.MaRB
    ) x
    WHERE r.MaRB IN(N'RB1',N'RB3',N'RB4',N'RB5',N'RB6',N'RB7',N'RB9');

    UPDATE @RB SET SoViPham=(
        SELECT COUNT(*) FROM dbo.CaThi c
        WHERE c.MaDot=@MaDot AND
              (SELECT COUNT(*) FROM dbo.PhanCongCoiThi p WHERE p.MaCa=c.MaCa)<>c.SoGVCanCap
    ) WHERE MaRB=N'RB2';

    SELECT MaRB,TenRangBuoc,SoViPham,
           CASE WHEN SoViPham=0 THEN CAST(100.00 AS DECIMAL(5,2)) ELSE CAST(0.00 AS DECIMAL(5,2)) END AS PhanTramDat,
           CASE WHEN SoViPham=0 THEN N'ĐẠT 100%' ELSE N'VI PHẠM' END AS KetQua
    FROM @RB ORDER BY MaRB;

    SELECT MaRB,LoaiViPham,MaGV,MaCa,MaCaLienQuan,MoTa
    FROM dbo.vw_ViPhamRangBuocCung
    WHERE MaDot=@MaDot
    UNION ALL
    SELECT N'RB2',N'Thiếu GV',NULL,c.MaCa,NULL,
           CONCAT(N'Ca ',c.MaCa,N' có ',
                  (SELECT COUNT(*) FROM dbo.PhanCongCoiThi p WHERE p.MaCa=c.MaCa),N'/',c.SoGVCanCap,N' GV')
    FROM dbo.CaThi c
    WHERE c.MaDot=@MaDot AND
          (SELECT COUNT(*) FROM dbo.PhanCongCoiThi p WHERE p.MaCa=c.MaCa)<c.SoGVCanCap
    ORDER BY MaRB,MaGV,MaCa;

    IF @ThrowIfFail=1 AND EXISTS(SELECT 1 FROM @RB WHERE SoViPham>0)
        THROW 53004,N'Các ràng buộc cứng chưa đạt. Lịch chưa được chốt.',1;
END;
GO

ALTER PROCEDURE dbo.sp_ChotXepLich @MaDot VARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS(SELECT 1 FROM dbo.DotThi WHERE MaDot=@MaDot)
        THROW 53000,N'Đợt thi không tồn tại.',1;

    DECLARE @RB7 INT=(SELECT COUNT(*) FROM dbo.vw_ViPhamRangBuocCung WHERE MaDot=@MaDot AND MaRB=N'RB7');
    DECLARE @N INT=(SELECT COUNT(*) FROM dbo.vw_ViPhamRangBuocCung WHERE MaDot=@MaDot AND MaRB<>N'RB7');
    DECLARE @ThieuCa INT=(SELECT COUNT(*) FROM dbo.CaThi c WHERE c.MaDot=@MaDot AND
        (SELECT COUNT(*) FROM dbo.PhanCongCoiThi p WHERE p.MaCa=c.MaCa)<c.SoGVCanCap);
    DECLARE @TongCa INT=(SELECT COUNT(*) FROM dbo.PhanCongCoiThi p JOIN dbo.CaThi c ON c.MaCa=p.MaCa WHERE c.MaDot=@MaDot);
    DECLARE @CaTrungLichBan INT=(SELECT COUNT(*) FROM dbo.PhanCongCoiThi p JOIN dbo.CaThi c ON c.MaCa=p.MaCa
        WHERE c.MaDot=@MaDot AND EXISTS(SELECT 1 FROM dbo.LichBanGV b WHERE b.MaGV=p.MaGV AND b.UuTien IN(2,3)
            AND b.NgayBan=c.NgayThi AND c.TuTiet<=b.DenTiet AND b.TuTiet<=c.DenTiet));
    DECLARE @TyLeNeLichBan DECIMAL(5,2)=CASE WHEN @TongCa=0 THEN 100.00 ELSE 100.0*(@TongCa-@CaTrungLichBan)/@TongCa END;
    DECLARE @TyLeToiThieu DECIMAL(5,2)=(SELECT TyLeNeLichBanToiThieu FROM dbo.CauHinhXepLich WHERE MaDot=@MaDot);

    IF @N>0 OR @RB7>0 OR @ThieuCa>0
        THROW 53001,N'Không thể chốt: ràng buộc cứng chưa đạt.',1;

    SELECT @MaDot MaDot,N'ĐẠT - có thể chốt lịch' KetQua,
           @TyLeNeLichBan TyLeNeLichBan,@TyLeToiThieu TyLeNeToiThieu;
END;
GO

/*
   During an approved swap the history and request status are written before
   the assignment update in the same transaction. This trigger keeps the
   other existing hard checks and rejects only quota over-assignment here;
   exact (including under-assignment) is checked after the complete batch by
   sp_KiemTraRangBuoc/sp_ChotXepLich.
*/
CREATE OR ALTER TRIGGER dbo.trg_PhanCong_RangBuocCung ON dbo.PhanCongCoiThi AFTER INSERT,UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Loi NVARCHAR(1000);
    SELECT TOP 1 @Loi=CONCAT(N'[',v.MaRB,N'] ',v.MoTa)
    FROM dbo.vw_ViPhamRangBuocCung v
    WHERE v.MaRB IN(N'RB2',N'RB3',N'RB4',N'RB5',N'RB6',N'RB7',N'RB9')
      AND ((v.MaGV IN(SELECT MaGV FROM inserted))
        OR (v.MaGV IN(SELECT MaGV FROM deleted))
        OR (v.MaCa IN(SELECT MaCa FROM inserted))
        OR (v.MaCaLienQuan IN(SELECT MaCa FROM inserted)));
    IF @Loi IS NOT NULL BEGIN ROLLBACK; THROW 53002,@Loi,1; END;

    ;WITH ApprovedHistory AS (
        SELECT ls.MaLichSu,ls.MaCa,ls.MaGV,ls.MaGVThayThe,
               ROW_NUMBER() OVER(PARTITION BY ls.MaCa ORDER BY ls.MaLichSu DESC) AS RN
        FROM dbo.LichSuDieuChinhLich ls
        JOIN dbo.YeuCauBaoBan y ON y.MaYeuCau=ls.MaYeuCau AND y.TrangThai='APPROVED'
        WHERE ls.HanhDong=N'DUYET_DOI_LICH'
          AND ls.MaGV IS NOT NULL AND ls.MaGVThayThe IS NOT NULL
    ), EffectiveCovers AS (
        SELECT h.MaCa,h.MaLichSu
        FROM ApprovedHistory h
        WHERE h.RN=1 AND EXISTS (
            SELECT 1 FROM dbo.PhanCongCoiThi p
            WHERE p.MaCa=h.MaCa AND p.MaGV=h.MaGVThayThe
        )
    ), TransferRows AS (
        SELECT c.MaDot,h.MaGV AS MaGVTruoc,h.MaGVThayThe AS MaGVSau
        FROM dbo.LichSuDieuChinhLich h
        JOIN dbo.YeuCauBaoBan y ON y.MaYeuCau=h.MaYeuCau AND y.TrangThai='APPROVED'
        JOIN dbo.CaThi c ON c.MaCa=h.MaCa
        JOIN EffectiveCovers e ON e.MaCa=h.MaCa AND h.MaLichSu<=e.MaLichSu
        WHERE h.HanhDong=N'DUYET_DOI_LICH'
          AND h.MaGV IS NOT NULL AND h.MaGVThayThe IS NOT NULL
    ), TransferDelta AS (
        SELECT MaDot,MaGV,SUM(Delta) AS Delta
        FROM (
            SELECT MaDot,MaGVTruoc AS MaGV,-1 AS Delta FROM TransferRows
            UNION ALL
            SELECT MaDot,MaGVSau AS MaGV,1 AS Delta FROM TransferRows
        ) d
        GROUP BY MaDot,MaGV
    ), ChangedAssignments AS (
        SELECT i.MaGV,c.MaDot FROM inserted i JOIN dbo.CaThi c ON c.MaCa=i.MaCa
        UNION
        SELECT d.MaGV,c.MaDot FROM deleted d JOIN dbo.CaThi c ON c.MaCa=d.MaCa
    ), AffectedPeriods AS (
        SELECT DISTINCT MaDot FROM ChangedAssignments
    ), AssignmentCounts AS (
        SELECT p.MaGV,c.MaDot,COUNT(*) AS SoCa
        FROM dbo.PhanCongCoiThi p JOIN dbo.CaThi c ON c.MaCa=p.MaCa
        WHERE EXISTS (SELECT 1 FROM AffectedPeriods x WHERE x.MaDot=c.MaDot)
        GROUP BY p.MaGV,c.MaDot
    ), LecturerScope AS (
        SELECT d.MaGV,d.MaDot
        FROM dbo.DinhMucPhanCong d
        JOIN AffectedPeriods a ON a.MaDot=d.MaDot
        UNION SELECT MaGV,MaDot FROM ChangedAssignments
        UNION SELECT MaGV,MaDot FROM TransferDelta
    ), Expected AS (
        SELECT s.MaGV,s.MaDot,ISNULL(d.SoCaQuyDinh,0)+ISNULL(td.Delta,0) AS SoCaCanXep
        FROM LecturerScope s
        LEFT JOIN dbo.DinhMucPhanCong d ON d.MaGV=s.MaGV AND d.MaDot=s.MaDot
        LEFT JOIN TransferDelta td ON td.MaGV=s.MaGV AND td.MaDot=s.MaDot
    )
    SELECT TOP 1 @Loi=CONCAT(N'[RB1] GV ',g.MaGV,N' vượt định mức hiệu lực ',e.SoCaCanXep,N' ca.')
    FROM ChangedAssignments g
    JOIN Expected e ON e.MaGV=g.MaGV AND e.MaDot=g.MaDot
    LEFT JOIN AssignmentCounts a ON a.MaGV=g.MaGV AND a.MaDot=g.MaDot
    WHERE ISNULL(a.SoCa,0)>e.SoCaCanXep;
    IF @Loi IS NOT NULL BEGIN ROLLBACK; THROW 53002,@Loi,1; END;
END;
GO
/*
    Bộ 8 ca kiểm thử RB7 được nhúng trực tiếp để file cài đặt tự kiểm tra logic.
    Chỉ dùng table variable; transaction luôn rollback, không ghi dữ liệu nghiệp vụ.
*/
BEGIN TRANSACTION;

DECLARE @TinhHuong TABLE(
    MaTinhHuong NVARCHAR(40) NOT NULL,
    PhongLichDay NVARCHAR(100) NULL,
    TietBatDauCaThi INT NOT NULL,
    TietKetThucCaThi INT NOT NULL,
    TietBatDauLichDay INT NOT NULL,
    TietKetThucLichDay INT NOT NULL,
    CoSoChinhMongDoi BIT NULL,
    ViPhamRB7MongDoi BIT NOT NULL,
    ViPhamRB4MongDoi BIT NOT NULL
);
INSERT @TinhHuong VALUES
(N'Khác cơ sở, sát giờ',N'B201 - 68 Nguyễn Huệ',5,7,1,4,0,1,0),
(N'Khác cơ sở, cách một tiết',N'B201 - 68 Nguyễn Huệ',6,8,1,4,0,0,0),
(N'Cơ sở chính, viết hoa',N'A507 - 140 LÊ TRỌNG TẤN',5,7,1,4,1,0,0),
(N'Cơ sở chính, không dấu',N'A507 - 140 le trong tan',5,7,1,4,1,0,0),
(N'Cơ sở chính, nhiều khoảng trắng',N'A507 -   140   Lê   Trọng Tấn ',5,7,1,4,1,0,0),
(N'Thiếu tên phòng',N'',5,7,1,4,NULL,0,0),
(N'Thiếu thông tin cơ sở',N'A507',5,7,1,4,NULL,0,0),
(N'Khác cơ sở, trùng lịch dạy RB4',N'B201 - 68 Nguyễn Huệ',5,7,4,6,0,0,1);

DECLARE @KetQua TABLE(
    MaTinhHuong NVARCHAR(40) NOT NULL,
    CoSoChinhThucTe BIT NULL,
    ViPhamRB7ThucTe BIT NOT NULL,
    ViPhamRB4ThucTe BIT NOT NULL
);
INSERT @KetQua(MaTinhHuong,CoSoChinhThucTe,ViPhamRB7ThucTe,ViPhamRB4ThucTe)
SELECT c.MaTinhHuong,
       dbo.fn_LaCoSoChinh(c.PhongLichDay),
       CONVERT(BIT,CASE
           WHEN dbo.fn_LaCoSoChinh(c.PhongLichDay)=0
            AND NOT (c.TietBatDauLichDay<=c.TietKetThucCaThi AND c.TietBatDauCaThi<=c.TietKetThucLichDay)
            AND (
                (c.TietBatDauCaThi>c.TietKetThucLichDay AND c.TietBatDauCaThi-c.TietKetThucLichDay-1<1)
                OR (c.TietBatDauLichDay>c.TietKetThucCaThi AND c.TietBatDauLichDay-c.TietKetThucCaThi-1<1)
            )
           THEN 1 ELSE 0 END),
       CONVERT(BIT,CASE
           WHEN c.TietBatDauLichDay<=c.TietKetThucCaThi AND c.TietBatDauCaThi<=c.TietKetThucLichDay
           THEN 1 ELSE 0 END)
FROM @TinhHuong c;

DECLARE @KhongDat BIT=0;
IF EXISTS (
    SELECT 1
    FROM @TinhHuong c
    JOIN @KetQua r ON r.MaTinhHuong=c.MaTinhHuong
    WHERE (c.CoSoChinhMongDoi IS NULL AND r.CoSoChinhThucTe IS NOT NULL)
       OR (c.CoSoChinhMongDoi IS NOT NULL AND (r.CoSoChinhThucTe IS NULL OR r.CoSoChinhThucTe<>c.CoSoChinhMongDoi))
       OR r.ViPhamRB7ThucTe<>c.ViPhamRB7MongDoi
       OR r.ViPhamRB4ThucTe<>c.ViPhamRB4MongDoi
)
    SET @KhongDat=1;

SELECT c.MaTinhHuong AS [Tình huống kiểm tra],
       CASE c.CoSoChinhMongDoi WHEN 1 THEN N'Cơ sở chính' WHEN 0 THEN N'Cơ sở khác' ELSE N'Chưa xác định' END AS [Cơ sở mong đợi],
       CASE r.CoSoChinhThucTe WHEN 1 THEN N'Cơ sở chính' WHEN 0 THEN N'Cơ sở khác' ELSE N'Chưa xác định' END AS [Cơ sở thực tế],
       CASE c.ViPhamRB7MongDoi WHEN 1 THEN N'Có vi phạm' ELSE N'Không vi phạm' END AS [RB7 mong đợi],
       CASE r.ViPhamRB7ThucTe WHEN 1 THEN N'Có vi phạm' ELSE N'Không vi phạm' END AS [RB7 thực tế],
       CASE c.ViPhamRB4MongDoi WHEN 1 THEN N'Có vi phạm' ELSE N'Không vi phạm' END AS [RB4 mong đợi],
       CASE r.ViPhamRB4ThucTe WHEN 1 THEN N'Có vi phạm' ELSE N'Không vi phạm' END AS [RB4 thực tế]
FROM @TinhHuong c JOIN @KetQua r ON r.MaTinhHuong=c.MaTinhHuong
ORDER BY c.MaTinhHuong;

ROLLBACK TRANSACTION;

IF @KhongDat=1
    THROW 53007,N'[RB7] Có tình huống kiểm tra ràng buộc thời gian di chuyển cho kết quả sai.',1;
GO

/* RB8 là ràng buộc mềm: vẫn báo vi phạm riêng, không xuất hiện trong view cứng. */
CREATE OR ALTER VIEW dbo.vw_ViPhamRangBuocMem_RB8
AS
WITH RankedDailyViolations AS (
    SELECT v.MaDot,v.MaRB,v.LoaiViPham,v.MaGV,v.MaCa,v.MaCaLienQuan,v.MoTa,
           ROW_NUMBER() OVER(PARTITION BY v.MaDot,v.MaGV,c.NgayThi
                             ORDER BY c.TuTiet,c.MaCa) AS RN
    FROM dbo.vw_ViPhamRangBuocCung_Detail v
    JOIN dbo.CaThi c ON c.MaCa=v.MaCa
    WHERE v.MaRB=N'RB8'
)
SELECT MaDot,MaRB,LoaiViPham,MaGV,MaCa,MaCaLienQuan,MoTa
FROM RankedDailyViolations
WHERE RN=1;
GO

CREATE OR ALTER VIEW dbo.vw_ViPhamRangBuocCung
AS
SELECT MaDot,MaRB,LoaiViPham,MaGV,MaCa,MaCaLienQuan,MoTa
FROM dbo.vw_ViPhamRangBuocCung_Detail
WHERE MaRB<>N'RB8';
GO

CREATE OR ALTER VIEW dbo.vw_ViPhamRangBuocCung_RB8
AS
SELECT v.MaDot,v.MaCa,v.MaGV,c.NgayThi,
       CAST(N'RB8' AS NVARCHAR(10)) AS MaRangBuoc,
       v.MoTa AS NoiDung
FROM dbo.vw_ViPhamRangBuocMem_RB8 v
LEFT JOIN dbo.CaThi c ON c.MaCa=v.MaCa;
GO

ALTER PROCEDURE dbo.sp_KiemTraRangBuoc_RB8
    @MaDot VARCHAR(20),
    @ThrowIfFail BIT=0 -- giữ tham số cũ; RB8 không còn chặn lưu/chốt lịch
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Bat BIT=ISNULL((SELECT Bat FROM dbo.CauHinhRangBuocMem
                             WHERE MaDot=@MaDot AND MaRB='RB8'),1);
    IF @Bat=0
    BEGIN
        SELECT CAST(1 AS BIT) AS HopLe,@MaDot AS MaDot,
               CAST(N'RB8 đang tắt cho đợt này; không tính điểm phạt.' AS NVARCHAR(200)) AS ThongBao;
        RETURN;
    END;

    IF NOT EXISTS(SELECT 1 FROM dbo.vw_ViPhamRangBuocMem_RB8 WHERE MaDot=@MaDot)
    BEGIN
        SELECT CAST(1 AS BIT) AS HopLe,
               CAST(N'RB8: Không có ngày ca tối làm tổng lịch vượt 12 tiết.' AS NVARCHAR(200)) AS ThongBao;
        RETURN;
    END;

    SELECT CAST(0 AS BIT) AS HopLe,MaDot,MaCa,MaGV,NgayThi,MaRangBuoc,NoiDung
    FROM dbo.vw_ViPhamRangBuocCung_RB8
    WHERE MaDot=@MaDot
    ORDER BY NgayThi,MaCa,MaGV;
END;
GO

ALTER PROCEDURE dbo.sp_KiemTraRangBuoc
    @MaDot VARCHAR(20),
    @ThrowIfFail BIT=0
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS(SELECT 1 FROM dbo.DotThi WHERE MaDot=@MaDot)
        THROW 53000,N'Đợt thi không tồn tại.',1;

    DECLARE @RB8Bat BIT=ISNULL((SELECT Bat FROM dbo.CauHinhRangBuocMem
                                WHERE MaDot=@MaDot AND MaRB='RB8'),1);
    DECLARE @RB TABLE(MaRB NVARCHAR(10) PRIMARY KEY,TenRangBuoc NVARCHAR(200),SoViPham INT);
    INSERT @RB VALUES
        (N'RB1',N'Khớp định mức và đổi ca đã duyệt',0),
        (N'RB2',N'Mỗi ca đúng số GV cần cấp',0),
        (N'RB3',N'GV không coi 2 ca trùng thời gian',0),
        (N'RB4',N'GV không trùng lịch dạy hoặc trực đề',0),
        (N'RB5',N'Không trộn nhóm ca trong buổi',0),
        (N'RB6',N'Né lịch bận mức 1',0),
        (N'RB7',N'Thời gian di chuyển khác cơ sở',0),
        (N'RB8',N'Tránh ca tối khi lịch trong ngày đã dày (mềm)',0),
        (N'RB9',N'Giới hạn ca trong ngày và lịch nối tiếp',0);

    UPDATE r SET SoViPham=x.SoViPham
    FROM @RB r
    CROSS APPLY (
        SELECT COUNT(*) AS SoViPham
        FROM dbo.vw_ViPhamRangBuocCung v
        WHERE v.MaDot=@MaDot AND v.MaRB=r.MaRB
    ) x
    WHERE r.MaRB IN(N'RB1',N'RB3',N'RB4',N'RB5',N'RB6',N'RB7',N'RB9');

    UPDATE @RB SET SoViPham=(
        SELECT COUNT(*) FROM dbo.CaThi c
        WHERE c.MaDot=@MaDot AND
              (SELECT COUNT(*) FROM dbo.PhanCongCoiThi p WHERE p.MaCa=c.MaCa)<>c.SoGVCanCap
    ) WHERE MaRB=N'RB2';
    UPDATE @RB SET SoViPham=CASE WHEN @RB8Bat=1 THEN
        (SELECT COUNT(*) FROM dbo.vw_ViPhamRangBuocMem_RB8 WHERE MaDot=@MaDot) ELSE 0 END
    WHERE MaRB=N'RB8';

    SELECT r.MaRB,r.TenRangBuoc,r.SoViPham,
           CASE WHEN r.MaRB=N'RB8' AND @RB8Bat=0 THEN CAST(NULL AS DECIMAL(5,2))
                WHEN r.SoViPham=0 THEN CAST(100.00 AS DECIMAL(5,2))
                ELSE CAST(0.00 AS DECIMAL(5,2)) END AS PhanTramDat,
           CASE WHEN r.MaRB=N'RB8' AND @RB8Bat=0 THEN N'MỀM ĐANG TẮT'
                WHEN r.MaRB=N'RB8' AND r.SoViPham>0 THEN N'MỀM - SẼ BỊ PHẠT'
                WHEN r.SoViPham=0 THEN N'ĐẠT 100%' ELSE N'VI PHẠM' END AS KetQua
    FROM @RB r ORDER BY r.MaRB;

    SELECT MaRB,LoaiViPham,MaGV,MaCa,MaCaLienQuan,MoTa
    FROM dbo.vw_ViPhamRangBuocCung
    WHERE MaDot=@MaDot
    UNION ALL
    SELECT N'RB8',LoaiViPham,MaGV,MaCa,MaCaLienQuan,MoTa
    FROM dbo.vw_ViPhamRangBuocMem_RB8
    WHERE MaDot=@MaDot AND @RB8Bat=1
    UNION ALL
    SELECT N'RB2',N'Thiếu GV',NULL,c.MaCa,NULL,
           CONCAT(N'Ca ',c.MaCa,N' có ',
                  (SELECT COUNT(*) FROM dbo.PhanCongCoiThi p WHERE p.MaCa=c.MaCa),N'/',c.SoGVCanCap,N' GV')
    FROM dbo.CaThi c
    WHERE c.MaDot=@MaDot AND
          (SELECT COUNT(*) FROM dbo.PhanCongCoiThi p WHERE p.MaCa=c.MaCa)<c.SoGVCanCap
    ORDER BY MaRB,MaGV,MaCa;

    IF @ThrowIfFail=1 AND EXISTS(SELECT 1 FROM @RB WHERE MaRB<>N'RB8' AND SoViPham>0)
        THROW 53004,N'Ràng buộc cứng chưa đạt. Lịch chưa được chốt.',1;
END;
GO
