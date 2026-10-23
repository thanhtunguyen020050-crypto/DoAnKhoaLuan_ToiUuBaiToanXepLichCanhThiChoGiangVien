/* ========= Hằng số ========= */
const KEY='huit-gacthi-v5';
const LOGO='assets/logo-huit.png';
const SES={1:'Ca 1 (07:00)',2:'Ca 2 (09:30)',3:'Ca 3 (13:00)',4:'Ca 4 (15:30)'};
const EXAM_SLOTS=[['1 → 2',1,2],['1 → 3',1,3],['3 → 4',3,4],['4 → 6',4,6],['5 → 6',5,6],['7 → 8',7,8],['7 → 9',7,9],['9 → 10',9,10],['10 → 12',10,12],['11 → 12',11,12]];
const ROLES=['Quản trị viên'];
const MODS=['Quản lý hệ thống','Quản lý giảng viên','Tiếp nhận lịch thi','Quản lý ràng buộc','Xếp lịch','Thống kê, báo cáo','Quản lý account','Quản lý báo bận'];
const VIEWS=['sys','lec','exam','cons','sched','rep','accounts','busy_reqs'];
const WD=['CN','T2','T3','T4','T5','T6','T7'];
const HARD=[
  {id:'H1',name:'Trong khoảng định mức ±1 ca',desc:'Giảng viên có định mức dương được nhận lệch tối đa 1 ca so với số ca theo tỷ lệ; định mức 0% thì không nhận ca.'},
  {id:'H2',name:'Đủ giám thị mỗi ca',desc:'Mỗi ca thi có đủ số giảng viên theo yêu cầu.'},
  {id:'H3',name:'Không trùng thời gian',desc:'Một giảng viên không gác hai ca cùng ngày, cùng giờ.'},
  {id:'H4',name:'Không xếp vào lịch dạy',desc:'Không xếp giảng viên gác thi vào thời gian đã có lịch dạy.'},
  {id:'H5',name:'Một buổi một loại ca',desc:'Trong cùng một buổi, giảng viên chỉ gác một loại ca: lý thuyết hoặc tự luận.'},
  {id:'H6',name:'Phải né lịch bận mức 1',desc:'Đi công tác, họp theo quyết định của Trường là ràng buộc cứng: không được xếp vào thời gian đã khai báo bận mức 1.'}
];
const SOFT=[
  {id:'S1',name:'Giảm ca gãy',desc:'Ưu tiên xếp các ca của cùng giảng viên liền tiết và trong cùng buổi; tính khoảng trống tiết hoặc phải quay lại trường buổi khác là ca gãy.'},
  {id:'S2',name:'Né lịch bận mức 2–3',desc:'Mức 2 (việc gia đình) được ưu tiên né mạnh; mức 3 (sức khỏe/khẩn cấp đột xuất) được ưu tiên né sau cùng. Hệ thống tự xác định mức từ Lý do, không cho người dùng tự chọn mức.'}
];
const svg=(p,s=16)=>'<svg viewBox="0 0 24 24" width="'+s+'" height="'+s+'" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>';
const LB={LT:'Lý thuyết',TL:'Tự luận'};
const IC={
  lock:svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',14),
  unlock:svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-1.5"/>',14),
  x:svg('<path d="M6 6l12 12M18 6L6 18"/>',14),
  plus:svg('<path d="M12 5v14M5 12h14"/>'),
  upload:svg('<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>'),
  search:svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'),
  logout:svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>'),
  ok:svg('<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',18),
  warn:svg('<path d="M12 3l10 18H2z"/><path d="M12 10v4M12 18h.01"/>',18),
  bad:svg('<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',18),
  info:svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',18),
  shield:svg('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><rect x="9" y="10" width="6" height="5" rx="1"/>',20),
  cal:svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',15),
  users:svg('<circle cx="9" cy="8" r="3"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6"/><circle cx="17" cy="8" r="2.5"/><path d="M17 12.5c2.7.5 4.5 2.6 4.5 5"/>',18),
  clip:svg('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v3H9z"/><path d="M9 11h6M9 15h6"/>',18),
  swap:svg('<path d="M7 4l-4 4 4 4M3 8h13M17 12l4 4-4 4M21 16H8"/>',18),
  flag:svg('<path d="M5 3v18M5 4h11l-2.5 4L16 12H5"/>',18),
  arrow:svg('<path d="M5 12h14M13 6l6 6-6 6"/>',13),
  bell:svg('<path d="M6 9a6 6 0 1 1 12 0c0 6 2 7 2 7H4s2-1 2-7M10 20a2 2 0 0 0 4 0"/>',18),
  key:svg('<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M16 7l3 3"/>',18),
  home:svg('<path d="M3 11 12 3l9 8M5 10v10h14V10"/>',18),
  inbox:svg('<path d="M3 13h5l1 3h6l1-3h5M5 5h14l2 8v6H3v-6z"/>',18),
  sliders:svg('<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',18),
  chart:svg('<path d="M4 20V4M4 20h16M8 16v-5M13 16V8M18 16v-3"/>',18),
  gear:svg('<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',18),
  send:svg('<path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/>',18),
  down:svg('<path d="M12 5v14M6 13l6 6 6-6"/>',18)
};

