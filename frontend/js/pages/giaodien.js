/* ========= Giao diện ========= */
function canSee(v){if(v==='home')return true;const i=VIEWS.indexOf(v);return i>=0&&!!(S.perms[cur.role]&&S.perms[cur.role][i])}
function topbar(){
  const d=new Date();
  return '<header class="topbar"><div class="tb-brand">'+logoHTML(38)+'<div><div class="uni">Trường Đại học Công Thương TP.HCM</div><h1>Hệ thống xếp lịch gác thi</h1><div class="sub">Khoa Công nghệ Thông tin &middot; Chỉ dành cho quản trị viên</div></div></div>'+
    '<div class="tb-r"><span class="pillbox">'+IC.cal+'<span class="hide-sm">'+d.toLocaleDateString('vi-VN',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'})+'</span></span>'+
    '<button class="ibtn" data-act="admin-notifications" title="Thông báo" aria-label="Thông báo">'+IC.bell+'<span class="dot" id="bellDot" hidden></span></button><div class="tb-user"><div class="tb-av">'+esc(initials(cur.name))+'</div><div><b>'+esc(cur.name)+'</b><span>'+esc(cur.role)+'</span></div><button class="ibtn" data-act="change-admin-password" title="Đổi mật khẩu Admin" aria-label="Đổi mật khẩu Admin">'+IC.key+'</button><button class="ibtn" data-act="logout" title="Đăng xuất" aria-label="Đăng xuất">'+IC.logout+'</button></div></div></header>';
}
const NAV_IC={home:'home',sys:'gear',lec:'users',exam:'inbox',cons:'sliders',sched:'cal',rep:'chart',accounts:'key',busy_reqs:'clip'};
function sidebar(){
  const items=[['home','Tổng quan']].concat(VIEWS.map((v,i)=>[v,MODS[i]]));
  return '<aside class="side"><div class="sec">Menu chính</div><nav class="nav" aria-label="Chức năng">'+
    items.filter(x=>canSee(x[0])).map(x=>'<button class="'+(view===x[0]?'on':'')+'" data-act="go" data-v="'+x[0]+'"'+(view===x[0]?' aria-current="page"':'')+'><span class="n">'+IC[NAV_IC[x[0]]]+'</span>'+esc(x[1])+'</button>').join('')+
    '</nav><div class="side-foot"><b>HUIT &middot; Khoa CNTT</b><span>Hệ thống nội bộ, chỉ dành cho quản trị viên</span><span>Phiên bản 1.0.0</span></div></aside>';
}
// Huy hiệu thông báo: so sánh với ID thông báo Admin đã xem lần cuối (lưu ở trình duyệt).
function refreshAdminBell(force){
  if(!force&&Date.now()-(refreshAdminBell.t||0)<30000)return;refreshAdminBell.t=Date.now();
  API.adminNotifications().then(r=>{
    const seen=+localStorage.getItem('huit-admin-seen')||0,n=(r.items||[]).filter(x=>x.ID>seen).length,d=$('#bellDot');
    if(d){d.textContent=n>9?'9+':n;d.hidden=!n}
  }).catch(()=>{});
}
function initials(n){return String(n||'').trim().split(/\s+/).slice(-2).map(w=>w[0]).join('').toUpperCase()}
function head(t,sub,right){
  const subtitle=sub?'<p>'+esc(sub)+'</p>':'';
  return '<header class="ph"><div><h1>'+esc(t)+'</h1>'+subtitle+'</div><div class="ph-r">'+(right||'')+'</div></header>';
}
function loginView(){
  let cells='';const lv=['','a','b','','a','','c','b','a','','','b','a','','c','a','b','','a','a','','c','','b','','a','b','','a','','c','a','','b','','a','a','b','','c'];
  for(let i=0;i<40;i++)cells+='<i class="'+lv[i]+'"></i>';
  return '<div class="login"><section class="login-art"><div class="lb">'+logoHTML(72)+'<div class="uni">Trường Đại học Công Thương<br>Thành phố Hồ Chí Minh</div></div><div><h2>Hệ thống xếp lịch gác thi</h2><p>Phân công giám thị đúng định mức, không trùng ca, và kiểm chứng được mức độ thỏa ràng buộc của từng lịch.</p></div><div class="mini" aria-hidden="true">'+cells+'</div></section>'+
    '<section class="login-form"><div><h1>Đăng nhập</h1><p class="muted" style="margin-bottom:18px">Hệ thống nội bộ Khoa Công nghệ Thông tin, chỉ dành cho quản trị viên.</p><label class="f"><span>Tên đăng nhập</span><input type="text" id="lu" value="admin" autocomplete="username"></label><label class="f"><span>Mật khẩu</span><input type="password" id="lp" value="demo" autocomplete="current-password"></label><div class="err" id="lerr"></div><button class="btn pri" data-act="login">Đăng nhập</button><p class="hint">Bản mẫu: nhập bất kỳ mật khẩu nào. Chỉ tài khoản quản trị viên mới đăng nhập được hệ thống này. Bấm vào logo để đổi ảnh khác nếu cần.</p></div></section></div>';
}
function homeView(){
  const a=analyze(),need=S.exams.reduce((n,e)=>n+e.need,0);
  const pct=need?Math.round(a.assigned/need*100):0;
  const issues=precheck().filter(x=>x.lv!=='ok');
  const ready=need>0&&a.assigned>=need&&!issues.some(x=>x.lv==='bad');
  const go=(v,html,cls)=>canSee(v)?'<button class="stat ic'+cls+'" data-act="go" data-v="'+v+'">'+html+'</button>':'<div class="stat ic'+cls+'">'+html+'</div>';
  const card=(ic,n,l)=>'<div class="si">'+ic+'</div><div><b>'+n+'</b><span>'+l+'</span></div>';
  const stats=go('lec',card(IC.users,S.lecs.length,'Giảng viên'),'')+go('exam',card(IC.clip,S.exams.length,'Ca thi đã tiếp nhận'),'')+go('sched',card(IC.swap,pct+'%',a.assigned+' / '+need+' lượt gác'),'')+go('sched',card(IC.flag,issues.length,'Việc cần xử lý'),issues.length?' hot':'');
  const dates=[...new Set(S.exams.map(e=>e.date))].sort().slice(0,5);
  const upcoming=dates.map(d=>{
    const L=S.exams.filter(e=>e.date===d),full=L.filter(e=>e.asg.length>=e.need).length,p=d.split('-'),r=Math.round(full/L.length*100);
    const st=full===L.length?'<span class="chip ok">Đã xếp lịch</span>':full>0?'<span class="chip warn">Đang xếp</span>':'<span class="chip">Chưa xếp</span>';
    return '<li class="pc"><div class="dd"><b>'+p[2]+'</b><span>Th.'+p[1]+'</span></div><div class="t" style="flex:1;min-width:0"><b>'+wd(d)+', '+fmtD(d)+'</b><span class="muted" style="display:block;font-size:12.5px">'+full+'/'+L.length+' ca/tiết đủ giám thị</span><div class="bar '+(r===100?'ok':'')+'" style="margin-top:5px"><i style="width:'+r+'%"></i></div></div>'+st+'</li>';
  }).join('');
  const rank=S.lecs.map(l=>({n:l.name,ld:loadOf(l.id,null),q:l.quota})).sort((x,y)=>y.ld-x.ld).slice(0,6),mx=Math.max(1,...rank.map(x=>x.ld));
  const work=rank.length&&mx>0?rank.map(x=>'<div class="wl"><span>'+esc(x.n)+'</span><div class="bar '+(x.q>0&&x.ld>x.q+1?'bad':'')+'"><i style="width:'+Math.round(x.ld/mx*100)+'%"></i></div><b>'+x.ld+'/'+x.q+'</b></div>').join('')+'<p class="hint">Thanh đỏ: vượt định mức quá 1 ca.</p>':'<p class="muted">Chưa có phân công để thống kê.</p>';
  const todo=issues.slice(0,4).map(x=>'<li class="pc '+(x.lv==='bad'?'bad':'warn')+'">'+IC[x.lv]+'<span>'+esc(x.t)+'</span></li>').join('');
  const q=[['sched','Xếp lịch','pri'],['exam','Tiếp nhận lịch thi',''],['rep','Thống kê, báo cáo','']].filter(x=>canSee(x[0])).map(x=>'<button class="btn '+x[2]+'" data-act="go" data-v="'+x[0]+'">'+esc(x[1])+'</button>').join('');
  return '<div class="crumb">Trang chủ <span>/</span> Tổng quan</div>'+
    head('Xin chào, '+esc(cur.name),'Tổng quan công tác tổ chức và phân công lịch gác thi.')+
    '<div class="banner '+(ready?'ok':'warn')+'">'+(ready?IC.ok:IC.warn)+'<div class="t"><b>'+(ready?'Sẵn sàng cho kỳ thi sắp tới':'Còn '+(issues.length||1)+' việc cần hoàn tất')+'</b><span>'+(S.exams.length?'Đã tiếp nhận '+S.exams.length+' ca thi. '+(ready?'Toàn bộ đã được xếp giám thị.':'Còn thiếu dữ liệu hoặc phân công trước khi xếp lịch.'):'Chưa tiếp nhận lịch thi nào.')+'</span></div>'+(canSee('sched')?'<button class="btn sm" data-act="go" data-v="sched">Xem tiến độ '+IC.arrow+'</button>':'')+'</div>'+
    '<div class="stats">'+stats+'</div>'+
    '<div class="two eq"><div class="panel"><div class="ttl"><h2>Lịch thi sắp diễn ra</h2>'+(canSee('exam')?'<button class="btn sm ghost" data-act="go" data-v="exam">Xem tất cả '+IC.arrow+'</button>':'')+'</div>'+(upcoming?'<ul class="pcl">'+upcoming+'</ul>':'<p class="muted">Chưa có lịch thi. Import ở mục Tiếp nhận lịch thi.</p>')+'</div>'+
    '<div><div class="panel"><div class="ttl"><h2>Số lượt gác theo giảng viên</h2></div>'+work+'</div>'+
    '<div class="panel"><div class="ttl"><h2>Việc cần hoàn tất</h2><span class="chip">'+issues.length+' mục</span></div>'+(todo?'<ul class="pcl">'+todo+'</ul>':'<p class="muted">Không có việc nào cần xử lý.</p>')+'<div class="row-end">'+q+'</div></div></div></div>';
}
function sysView(){
  const rows=S.users.map(u=>'<tr><td><b>'+esc(u.name)+'</b></td><td>'+esc(u.user)+'</td><td><select data-chg="role" data-id="'+u.id+'" aria-label="Vai trò">'+ROLES.map(r=>'<option'+(r===u.role?' selected':'')+'>'+r+'</option>').join('')+'</select></td><td><label class="sw"><input type="checkbox" data-chg="active" data-id="'+u.id+'"'+(u.on?' checked':'')+(u.id===1?' disabled':'')+' aria-label="Kích hoạt"><span></span></label></td><td class="r"><button class="btn sm ghost danger" data-act="del-user" data-id="'+u.id+'"'+(u.id===1?' disabled':'')+'>Xóa</button></td></tr>').join('');
  const pm=MODS.map((m,i)=>'<tr><td>'+(i+1)+'. '+m+'</td>'+ROLES.map((r,ri)=>'<td class="c"><input type="checkbox" data-chg="perm" data-r="'+ri+'" data-i="'+i+'"'+(S.perms[r][i]?' checked':'')+(ri===0&&i===0?' disabled':'')+' aria-label="'+esc(r+' - '+m)+'"></td>').join('')+'</tr>').join('');
  return head('Quản lý hệ thống','Tài khoản đăng nhập và quyền truy cập từng chức năng.','<button class="btn pri" data-act="add-user">'+IC.plus+'Thêm tài khoản</button>')+
    '<div class="panel"><h2>Tài khoản</h2><p class="sub">Tài khoản đầu tiên luôn được bật để tránh bị khóa khỏi hệ thống.</p><div class="tw"><table><thead><tr><th>Họ tên</th><th>Tên đăng nhập</th><th>Vai trò</th><th>Hoạt động</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div></div>'+
    '<div class="panel"><h2>Phân quyền theo vai trò</h2><p class="sub">Chức năng không được tích sẽ bị ẩn khỏi menu của vai trò đó.</p><div class="tw"><table><thead><tr><th>Chức năng</th>'+ROLES.map(r=>'<th class="c">'+r+'</th>').join('')+'</tr></thead><tbody>'+pm+'</tbody></table></div></div>';
}
function accountsView(){
  const rows=adminAccounts.map(a=>'<tr><td><b>'+esc(a.HoTen||'')+'</b></td><td>'+esc(a.MaGV||'')+'</td><td>'+esc(a.Email||'—')+'</td><td>'+(a.IsActive?'<span class="chip ok">Đang hoạt động</span>':'<span class="chip bad">Đã khóa</span>')+'</td><td>'+(a.AccountStatusKnown===false?'<span class="chip">Chưa có trạng thái</span>':a.MustChangePassword?'<span class="chip warn">Cần đổi mật khẩu</span>':'<span class="chip ok">Đã thiết lập</span>')+'</td><td>'+esc(a.TrangThaiGiangVien||'')+'</td><td>'+esc(a.LastLoginAt?new Date(a.LastLoginAt).toLocaleString('vi-VN'):'Chưa đăng nhập')+'</td><td><button class="btn sm" data-act="reset-user-password" data-id="'+esc(a.MaGV||'')+'">Cấp mật khẩu tạm</button></td></tr>').join('');
  const body=accountsLoading?'<tr><td colspan="8" class="empty">Đang tải tài khoản từ SQL Server…</td></tr>':accountsError?'<tr><td colspan="8" class="empty">'+esc(accountsError)+'</td></tr>':rows||'<tr><td colspan="8" class="empty">Chưa có tài khoản user trong SQL Server.</td></tr>';
  return head('Quản lý account','','<button class="btn pri" data-act="load-user-accounts">'+IC.refresh+'Làm mới dữ liệu</button>')+
    '<div class="panel"><h2>Tài khoản user</h2><p class="sub">Danh sách bao gồm cả tài khoản đang hoạt động và đã khóa. Admin có thể cấp mật khẩu tạm nếu user quên mật khẩu.</p><div class="tw"><table><thead><tr><th>Họ tên</th><th>Mã giảng viên</th><th>Email</th><th>Hoạt động</th><th>Mật khẩu</th><th>Trạng thái giảng viên</th><th>Đăng nhập lần cuối</th><th>Thao tác</th></tr></thead><tbody>'+body+'</tbody></table></div></div>';
}
function busyReqsView(){
  const list = adminBusyRequests;
  const pendingCount = list.filter(x=>x.TrangThai==='PENDING').length;
  const approvedCount = list.filter(x=>x.TrangThai==='APPROVED').length;
  const rejectedCount = list.filter(x=>x.TrangThai==='REJECTED').length;

  const reqStatusMap = {
    'PENDING': ['Chờ Admin xử lý', 'warn'],
    'APPROVED': ['Đã chấp nhận', 'ok'],
    'REJECTED': ['Đã từ chối', 'bad']
  };

  const rows = list.map(a => {
    const st = reqStatusMap[a.TrangThai] || [a.TrangThai, ''];
    const caInfo = a.MaCa ? '<b>'+esc(a.MaCa)+'</b><br><span class="hint" style="margin:0">'+fmtD(a.NgayThi)+' · Tiết '+(a.TuTiet||'')+'–'+(a.DenTiet||'')+' (P.'+esc(a.PhongThi||'—')+')</span>' : '<span class="muted">Không gắn ca cụ thể</span>';
    const timeRange = esc(a.ThoiGianBatDauBan ? a.ThoiGianBatDauBan.replace('T',' ') : '')+'<br>→ '+esc(a.ThoiGianKetThucBan ? a.ThoiGianKetThucBan.replace('T',' ') : '');
    
    let resInfo = '<span class="muted">—</span>';
    if (a.TrangThai === 'APPROVED') {
      resInfo = '<span style="color:var(--ok);font-weight:600">Đã đổi GV</span><br><span class="hint" style="margin:0">Thay bởi: '+esc(a.TenGVThayThe || a.MaGVThayThe || 'Đã phân công lại')+'</span>';
    } else if (a.TrangThai === 'REJECTED') {
      resInfo = '<span style="color:var(--bad);font-weight:500">Giữ nguyên lịch</span><br><span class="hint" style="margin:0">Lý do: '+esc(a.LyDoTuChoi || 'Không nêu')+'</span>';
    }

    const actionBtn = a.TrangThai === 'PENDING'
      ? '<button class="btn sm pri" data-act="process-busy-request" data-id="'+a.MaYeuCau+'">Xem & Xử lý</button>'
      : '<button class="btn sm" data-act="view-busy-detail" data-id="'+a.MaYeuCau+'">Chi tiết</button>';

    return '<tr>'+
      '<td><b>#'+a.MaYeuCau+'</b></td>'+
      '<td><b>'+esc(a.HoTen)+'</b><br><span class="hint" style="margin:0">'+esc(a.MaGV)+'</span></td>'+
      '<td>'+caInfo+'</td>'+
      '<td>'+(a.TenGVThayTheDeNghi||a.MaGVThayTheDeNghi?'<b>'+esc(a.TenGVThayTheDeNghi||a.MaGVThayTheDeNghi)+'</b><br><span class="hint" style="margin:0">'+esc(a.MaGVThayTheDeNghi||'')+'</span>':'<span class="muted">—</span>')+'</td>'+
      '<td><small>'+timeRange+'</small></td>'+
      '<td><b>'+esc(a.LyDoBaoBan)+'</b>'+(a.GhiChuGV ? '<br><span class="hint" style="margin:0">'+esc(a.GhiChuGV)+'</span>' : '')+'</td>'+
      '<td><span class="chip '+st[1]+'">'+esc(st[0])+'</span></td>'+
      '<td><small>'+esc(a.ThoiGianGui ? a.ThoiGianGui.replace('T',' ') : '')+'</small></td>'+
      '<td>'+resInfo+'</td>'+
      '<td>'+actionBtn+'</td>'+
    '</tr>';
  }).join('');

  const body = busyReqsLoading
    ? '<tr><td colspan="10" class="empty">Đang tải danh sách yêu cầu báo bận từ SQL Server…</td></tr>'
    : busyReqsError
    ? '<tr><td colspan="10" class="empty" style="color:var(--bad)">'+esc(busyReqsError)+'</td></tr>'
    : rows || '<tr><td colspan="10" class="empty">Không có yêu cầu báo bận nào.</td></tr>';

  const bulkApproveBtn = pendingCount && !busyReqsLoading && !busyReqsError
    ? '<button class="btn pri" data-act="accept-all-busy-requests" title="Chấp nhận các đơn đang chờ trong danh sách hiện tại; từng đơn vẫn được kiểm tra ràng buộc">'+IC.ok+'Chấp nhận tất cả ('+pendingCount+')</button>'
    : '';

  return head('Quản lý yêu cầu báo bận',
    'Xem đơn báo bận cùng giảng viên được nhờ coi thay, kiểm tra ràng buộc rồi quyết định cập nhật lịch.',
    '<button class="btn" data-act="load-busy-requests">'+IC.refresh+'Làm mới dữ liệu</button>'+bulkApproveBtn) +
    '<div class="stats">'+
      '<div class="stat ic"><div class="si">'+IC.clip+'</div><div><b>'+list.length+'</b><span>Tổng số yêu cầu</span></div></div>'+
      '<div class="stat ic hot"><div class="si">'+IC.warn+'</div><div><b>'+pendingCount+'</b><span>Chờ xử lý</span></div></div>'+
      '<div class="stat ic done"><div class="si">'+IC.ok+'</div><div><b>'+approvedCount+'</b><span>Đã chấp nhận</span></div></div>'+ 
      '<div class="stat ic rejected"><div class="si">'+IC.bad+'</div><div><b>'+rejectedCount+'</b><span>Đã từ chối</span></div></div>'+ 
    '</div>'+
    '<div class="panel">'+
      '<h2>Danh sách yêu cầu báo bận</h2>'+
      '<div class="tools">'+
        '<div class="grow">'+
          '<input type="text" data-inp="busy-search" placeholder="Tìm người gửi, người được nhờ hoặc mã ca thi..." value="'+esc(busyReqSearch)+'" aria-label="Tìm yêu cầu báo bận">'+
        '</div>'+
        '<select data-chg="busy-filter" aria-label="Lọc theo trạng thái">'+
          '<option value="ALL" '+(busyReqFilter==='ALL'?'selected':'')+'>Tất cả trạng thái</option>'+
          '<option value="PENDING" '+(busyReqFilter==='PENDING'?'selected':'')+'>Chờ xử lý (PENDING)</option>'+
          '<option value="APPROVED" '+(busyReqFilter==='APPROVED'?'selected':'')+'>Đã chấp nhận (APPROVED)</option>'+
          '<option value="REJECTED" '+(busyReqFilter==='REJECTED'?'selected':'')+'>Đã từ chối (REJECTED)</option>'+
        '</select>'+
      '</div>'+
      '<div class="tw">'+
        '<table>'+
          '<thead>'+
            '<tr>'+
              '<th>Mã YC</th>'+
              '<th>Giảng viên</th>'+
              '<th>Ca thi liên quan</th>'+
              '<th>Giảng viên được nhờ</th>'+
              '<th>Thời gian bận</th>'+
              '<th>Lý do</th>'+
              '<th>Trạng thái</th>'+
              '<th>Thời gian gửi</th>'+
              '<th>Kết quả xử lý</th>'+
              '<th>Thao tác</th>'+
            '</tr>'+
          '</thead>'+
          '<tbody>'+body+'</tbody>'+
        '</table>'+
      '</div>'+
      '<p class="hint">Đơn chỉ xuất hiện tại đây sau khi giảng viên đã chọn người được nhờ. Yêu cầu chờ xử lý được ưu tiên; khi chấp nhận, hệ thống kiểm tra lại RB1–RB6 trước khi cập nhật lịch chính thức.</p>'+
    '</div>';
}
function lecRows(){
  const q=F.lq.trim().toLowerCase();
  const L=S.lecs.filter(l=>(!F.ld||l.dept===F.ld)&&(!q||l.name.toLowerCase().indexOf(q)>=0));
  if(!L.length)return '<tr><td colspan="5" class="empty">Không có giảng viên phù hợp trong SQL Server.</td></tr>';
  return L.map(l=>'<tr><td><b>'+esc(l.name)+'</b></td><td>'+esc(l.dept)+'</td><td><input type="number" min="0" max="100" value="'+l.pct+'" data-chg="pct" data-id="'+l.id+'" aria-label="Định mức phần trăm của '+esc(l.name)+'"> <span class="muted">= '+l.quota+' ca</span></td><td><button class="btn sm" data-act="busy" data-id="'+l.id+'">'+(l.busy.length||l.teach.length?'<span class="chip warn">Dạy '+l.teach.length+' ca &middot; Bận '+l.busy.length+' buổi</span>':'Khai báo')+'</button>'+(l.busy.length||l.teach.length?' <button class="btn sm ghost danger" data-act="clear-schedule" data-id="'+l.id+'" title="Xóa toàn bộ lịch dạy và lịch bận của giảng viên này">Xóa lịch</button>':'')+' </td><td class="r"><button class="btn sm ghost" data-act="edit-lec" data-id="'+l.id+'">Sửa</button> <button class="btn sm ghost danger" data-act="del-lec" data-id="'+l.id+'">Xóa</button></td></tr>').join('');
}
function lecView(){
  return head('Quản lý giảng viên','Danh sách giảng viên lấy trực tiếp từ SQL Server. Định mức và lịch dạy/bận được lưu trong cơ sở dữ liệu.',
    '<button class="btn pri" data-act="refresh-lec">'+IC.refresh+'Làm mới dữ liệu</button><button class="btn" data-act="quota-all">Đặt định mức chung</button><button class="btn" data-act="pick-teach-file">'+IC.upload+'Import lịch dạy</button><button class="btn" data-act="pick-busy-file">'+IC.upload+'Import lịch bận</button><button class="btn danger" data-act="clear-all-teaching" title="Xóa toàn bộ lịch dạy của tất cả giảng viên">'+IC.x+' Xóa tất cả lịch dạy</button><button class="btn danger" data-act="clear-all-busy" title="Xóa toàn bộ lịch bận của tất cả giảng viên">'+IC.x+' Xóa tất cả lịch bận</button><button class="btn pri" data-act="add-lec">'+IC.plus+'Thêm giảng viên</button>')+
    '<input type="file" id="fileTeach" data-chg="teach-file" accept=".xlsx,.xls,.csv,.txt,.tsv" hidden>'+
    '<input type="file" id="fileBusy" data-chg="busy-file" accept=".xlsx,.xls,.csv,.txt,.tsv" hidden>'+
    (pendBusy?'<div class="panel"><h2>Kiểm tra import lịch bận</h2><p class="sub">'+esc(pendBusy.name)+' · '+pendBusy.rows.length+' dòng hợp lệ · '+pendBusy.errors.length+' dòng lỗi</p><p class="hint"><b>Họ tên</b> được đối chiếu không phân biệt hoa/thường, dấu và khoảng trắng thừa. <b>Ngày</b> 22/1/2026 và 22/01/2026 được chuẩn hóa thành cùng ngày. “Cả ngày” sẽ tạo cả Sáng và Chiều. Nếu cùng GV/ngày/buổi có nhiều lý do, hệ thống giữ lý do có mức ưu tiên cao nhất.</p>'+importSummary(pendBusy,'lịch bận')+'<div class="tools"><button class="btn pri" data-act="apply-busy"'+(pendBusy.rows.length&&!pendBusy.errors.length?'':' disabled')+'>Nhập lịch bận</button><button class="btn" data-act="cancel-busy">Hủy</button></div></div>':'')+
    (pendTeach?'<div class="panel"><h2>Kiểm tra lịch dạy</h2><p class="sub">'+esc(pendTeach.name)+' · '+pendTeach.rows.length+' ca học · '+pendTeach.teachers.length+' giảng viên</p><p class="hint">Chỉ import lịch dạy cho giảng viên đã có trong SQL Server. Lịch dạy được lưu riêng trong <b>LichDayGV</b> và là ràng buộc cứng 100%. Không tự tạo giảng viên mới và không ghi vào <b>LichBanGV</b>.</p><div class="tools"><button class="btn pri" data-act="apply-teach"'+(pendTeach.rows.length?'':' disabled')+'>Nhập lịch dạy</button><button class="btn" data-act="cancel-teach">Hủy</button></div></div>':'')+
    '<div class="panel"><div class="tools"><div class="grow"><input type="text" id="lq" data-inp="lq" placeholder="Tìm theo tên giảng viên" value="'+esc(F.lq)+'" aria-label="Tìm giảng viên"></div><select data-chg="ld" aria-label="Lọc theo khoa"><option value="">Tất cả khoa</option>'+depts().map(d=>'<option'+(F.ld===d?' selected':'')+'>'+esc(d)+'</option>').join('')+'</select><span class="muted" id="lcount"></span></div><div class="tw"><table><thead><tr><th>Họ tên</th><th>Khoa</th><th>Định mức (%)</th><th>Lịch dạy / bận</th><th></th></tr></thead><tbody id="lecRows">'+lecRows()+'</tbody></table></div><p class="hint">Dữ liệu giảng viên được lấy từ SQL Server. Định mức được lưu theo tỷ lệ % và số ca quy định được tính theo tổng nhu cầu của đợt thi.</p></div>';
}
function importSummary(p,what){
  let h='<div class="tools"><span class="chip ok">'+p.rows.length+' dòng hợp lệ</span><span class="chip '+(p.errors.length?'bad':'')+'">'+p.errors.length+' dòng lỗi</span>'+(p.extra||'')+'</div>';
  if(p.errors.length)h+='<div class="tw"><table><thead><tr><th>Dòng</th><th>Lỗi cần sửa</th></tr></thead><tbody>'+p.errors.slice(0,12).map(e=>'<tr><td>'+e.line+'</td><td>'+esc(e.msg)+'</td></tr>').join('')+'</tbody></table></div>'+(p.errors.length>12?'<p class="hint">Còn '+(p.errors.length-12)+' dòng lỗi khác. Sửa file rồi import lại để đầy đủ.</p>':'');
  return h;
}
function examRows(){
  const q=F.eq.trim().toLowerCase();
  const L=S.exams.filter(e=>(!F.ed||e.date===F.ed)&&(!q||(e.date+' '+fmtD(e.date)+' '+(e.period||SES[e.ses])).toLowerCase().indexOf(q)>=0)).sort(cmpEx);
  if(!L.length)return '<tr><td colspan="6" class="empty">Chưa có ca thi. Hãy import file của bạn hoặc bấm “Nhập ca thi”.</td></tr>';
  return L.map(e=>'<tr><td>'+wd(e.date)+' '+fmtD(e.date)+'</td><td>'+esc(e.period||SES[e.ses])+'</td><td>'+(e.half==='S'?'Sáng':'Chiều')+'</td><td><span class="chip">'+LB[e.kind]+'</span></td><td class="c">'+e.need+'</td><td><span class="chip '+(e.asg.length>=e.need?'ok':'')+'">'+e.asg.length+'/'+e.need+'</span> <button class="btn sm" data-act="edit-exam" data-id="'+e.id+'">Sửa</button> <button class="btn sm ghost danger" data-act="del-exam" data-id="'+e.id+'" aria-label="Xóa ca thi">Xóa</button></td></tr>').join('');
}
function examForm(e){
  const latest=(S.dots&&S.dots[0])||{};
  const years=[];const now=new Date().getFullYear();for(let y=2023;y<=now+3;y++)years.push(y+'-'+(y+1));
  const yh=e&&e.nam_hoc||latest.NamHoc||years.find(x=>x.startsWith(String(now)))||years[years.length-1];
  openModal({title:e?'Sửa ca thi':'Nhập ca thi',wide:true,body:
    '<p class="hint">Ngày thi là ngày thực tế. Hệ thống tự gắn ca vào đợt thi hiện tại.</p>'+    '<label class="f"><span>Ngày thi</span><input type="date" id="exDate" value="'+(e?e.date:'')+'"></label>'+    '<label class="f"><span>Tiết / ca thi</span><select id="exPeriod">'+EXAM_SLOTS.map(x=>'<option value="'+x[0]+'"'+((e?e.period===x[0]:false)?' selected':'')+'>'+x[0]+'</option>').join('')+'</select></label>'+    '<label class="f"><span>Loại ca</span><select id="exKind"><option value="LT"'+(e&&e.kind==='LT'?' selected':'')+'>Lý thuyết</option><option value="TL"'+(e&&e.kind==='TL'?' selected':'')+'>Tự luận</option></select></label>'+    '<label class="f"><span>Số giảng viên cần cấp</span><input type="number" id="exNeed" min="1" max="30" value="'+(e?e.need:2)+'"></label><div class="err" id="exErr"></div>',foot:'<button class="btn" data-act="close">Hủy</button><button class="btn pri" data-act="save-exam" data-id="'+(e?e.id:'')+'">'+(e?'Lưu thay đổi':'Lưu vào SQL Server')+'</button>'});
}

function examView(){
  let pv='';
  if(pend){
    const key=e=>e.date+'|'+(e.period||rangeFor(e).join('-'));
    const old=new Set(S.exams.map(key)),nw=new Set(pend.rows.map(key));
    let same=0,add=0;nw.forEach(k=>{old.has(k)?same++:add++});
    const gone=[...old].filter(k=>!nw.has(k)).length;
    pend.extra=S.exams.length?'<span class="chip">'+same+' ca giữ nguyên</span><span class="chip">'+add+' ca mới</span><span class="chip '+(gone?'warn':'')+'">'+gone+' ca không còn</span>':'';
    pv='<div class="panel"><h2>Kiểm tra file đầu vào</h2><p class="sub">'+esc(pend.name)+'</p>'+importSummary(pend,'ca thi')+
      (S.exams.length&&pend.rows.length?'<p class="hint">Các ca trùng ngày và tiết sẽ giữ lại phân công hiện có.</p>':'')+
      '<div class="tools" style="margin-top:12px"><button class="btn pri" data-act="do-import-exam"'+(pend.rows.length?'':' disabled')+'>'+(S.exams.length?'Thay lịch ca thi hiện tại bằng '+pend.rows.length+' dòng':'Nhập '+pend.rows.length+' ca thi')+'</button><button class="btn" data-act="cancel-import-exam">Hủy</button></div></div>';
  }
  const dates=[...new Set(S.exams.map(e=>e.date))].sort();
  return head('Quản lý lịch thi','Nhập ngày thi thực tế → Tiết/ca → Loại ca → Số giảng viên cần. Dữ liệu được lưu trực tiếp vào SQL Server.',
    '<button class="btn danger" data-act="clear-all-exams" title="Xóa toàn bộ ca thi">'+IC.x+' Xóa tất cả ca thi</button><button class="btn pri" data-act="add-exam">'+IC.plus+'Nhập ca thi</button>')+
    '<div class="panel"><h2>Import ca thi của bạn</h2><p class="sub">Excel hoặc CSV gồm 4 cột theo thứ tự: Ngày thi, Ca/tiết, Số giảng viên cần, Loại ca (Lý thuyết/Tự luận). Có thể đặt hàng tiêu đề. Ví dụ ca/tiết: 1 → 2.</p><div class="drop"><p>Chọn file Excel hoặc CSV của bạn</p><div class="tools" style="justify-content:center;margin:0"><button class="btn pri" data-act="pick-exam-file">'+IC.upload+'Import ca thi</button></div></div><input type="file" id="fileExam" data-chg="file-exam" accept=".xlsx,.xls,.csv,.txt,.tsv" hidden></div>'+pv+
    '<div class="panel"><h2>Danh sách ca thi</h2><div class="tools"><div class="grow"><input type="text" data-inp="eq" placeholder="Tìm theo ngày hoặc ca/tiết" value="'+esc(F.eq)+'" aria-label="Tìm ca thi"></div><select data-chg="ed" aria-label="Lọc theo ngày"><option value="">Tất cả ngày</option>'+dates.map(d=>'<option value="'+d+'"'+(F.ed===d?' selected':'')+'>'+wd(d)+' '+fmtD(d)+'</option>').join('')+'</select></div><div class="tw"><table><thead><tr><th>Ngày</th><th>Ca/tiết</th><th>Buổi</th><th>Loại ca</th><th class="c">Cần cấp</th><th>Đã xếp</th></tr></thead><tbody id="examRows">'+examRows()+'</tbody></table></div></div>';
}
function consView(){
  const hard=HARD.map(h=>'<div class="cons"><span class="lockico">'+IC.shield+'</span><div class="t"><b>'+h.name+'</b><span>'+h.desc+'</span></div><span class="chip">Bắt buộc</span></div>').join('');
  const soft=SOFT.map(s=>{
    const c=S.soft[s.id];
    const control=s.id==='S2'
      ? '<span class="chip">Mức cố định theo Lý do</span>'
      : '<label class="w">Mức ưu tiên <input type="range" min="1" max="10" value="'+c.w+'" data-inp="soft-w" data-id="'+s.id+'"'+(c.on?'':' disabled')+' aria-label="Mức ưu tiên"><output>'+c.w+'</output></label>';
    return '<div class="cons"><label class="sw"><input type="checkbox" data-chg="soft-on" data-id="'+s.id+'"'+(c.on?' checked':'')+' aria-label="Bật '+esc(s.name)+'"><span></span></label><div class="t"><b>'+s.name+'</b><span>'+s.desc+'</span></div>'+control+'</div>';
  }).join('');
  return head('Quản lý ràng buộc','Xem ràng buộc cứng và cấu hình ràng buộc mềm cho thuật toán xếp lịch.','<button class="btn pri" data-act="reset-soft">Khôi phục mặc định</button>')+
    '<div class="panel"><h2>Ràng buộc cứng</h2><p class="sub">Luôn được áp dụng khi xếp tự động. Mức 1 của lịch bận là ràng buộc cứng tuyệt đối.</p>'+hard+'</div>'+
    '<div class="panel"><h2>Ràng buộc mềm</h2><p class="sub">Mức 2 và mức 3 của lịch bận được hệ thống tự chấm theo Lý do; người dùng không nhập tay mức ưu tiên.</p>'+soft+'</div>';
}

function schedView(){
  const a=analyze(),need=S.exams.reduce((n,e)=>n+e.need,0);
  const dates=[...new Set(S.exams.map(e=>e.date))].sort();
  const ring=(function(){const p=a.overall==null?0:a.overall,C=2*Math.PI*52,col=a.overall==null?'var(--line)':(p>=90?'var(--ok)':p>=70?'var(--blue)':'var(--warn)');
    return '<svg viewBox="0 0 140 140" width="150" height="150" role="img" aria-label="Tỷ lệ thỏa ràng buộc"><circle cx="70" cy="70" r="52" fill="none" stroke="var(--sky)" stroke-width="12"/><circle cx="70" cy="70" r="52" fill="none" stroke="'+col+'" stroke-width="12" stroke-linecap="round" stroke-dasharray="'+(C*p/100).toFixed(1)+' '+C.toFixed(1)+'" transform="rotate(-90 70 70)"/><text x="70" y="74" text-anchor="middle" class="v">'+(a.overall==null?'—':a.overall+'%')+'</text><text x="70" y="94" text-anchor="middle" class="l">thỏa ràng buộc</text></svg>'}());
  const side='<div class="panel side-panel"><h2>Tỷ lệ thỏa ràng buộc</h2><p class="sub">'+a.assigned+'/'+need+' lượt gác đã xếp</p><div class="ring">'+ring+'</div>'+
    (a.assigned?a.list.map(x=>{
      const detail=x.id==='S1'&&a.S1
        ?'<div class="crow-detail"><span>Tổng lượt ngày giảng viên lên trường: <b>'+a.S1.total+'</b></span></div>'
        :'';
      return '<div class="crow"><div class="h"><b>'+esc(x.name)+(x.hard?' <span class="chip">Cứng</span>':'')+'</b><span>'+(x.pct==null?'—':x.pct+'%')+'</span></div><div class="bar '+(x.pct!=null&&x.pct<70?'bad':(x.pct===100?'ok':''))+'"><i style="width:'+(x.pct||0)+'%"></i></div>'+detail+'</div>';
    }).join(''):'<p class="muted">Chưa có phân công. Chạy xếp tự động hoặc xếp tay để xem tỷ lệ.</p>')+'</div>';
  let board='';
  const L=S.exams.filter(e=>(!F.sd||e.date===F.sd)&&(!F.lack||e.asg.length<e.need)).sort(cmpEx);
  if(!L.length)board='<p class="muted" style="padding:18px 0">'+(S.exams.length?'Không có ca thi phù hợp bộ lọc.':'Chưa có ca thi. Import lịch thi ở mục 3 trước khi xếp.')+'</p>';
  let lastD='';
  L.forEach(e=>{
    if(e.date!==lastD){lastD=e.date;board+='<div class="day">'+wd(e.date)+', '+fmtD(e.date)+'</div>'}
    const chips=e.asg.map(x=>{const l=lec(x.l),iss=hardIssues(e,x.l);return '<span class="slot'+(x.lock?' locked':'')+(iss.length?' bad':'')+'"'+(iss.length?' title="'+esc(iss.join(', '))+'"':'')+'>'+esc(l?l.name:'?')+(iss.length?' <i>'+esc(iss.join(', '))+'</i>':'')+'<button class="lk" data-act="lock" data-ex="'+e.id+'" data-l="'+x.l+'" aria-label="'+(x.lock?'Mở khóa':'Khóa')+' phân công" title="'+(x.lock?'Đang khóa, bấm để mở':'Bấm để khóa phân công này')+'">'+(x.lock?IC.lock:IC.unlock)+'</button><button data-act="unasg" data-ex="'+e.id+'" data-l="'+x.l+'" aria-label="Gỡ phân công" title="Gỡ khỏi ca này">'+IC.x+'</button></span>'}).join('');
    let empt='';for(let i=e.asg.length;i<e.need;i++)empt+='<button class="slot empty" data-act="pick" data-ex="'+e.id+'">+ Chọn giảng viên</button>';
    board+='<div class="ex"><div><b>'+esc(e.period||SES[e.ses])+'</b><span class="s">'+(e.half==='S'?'Buổi sáng':'Buổi chiều')+'</span></div><div><b>Ca thi</b><span class="s">'+LB[e.kind]+'</span></div><div class="slots">'+chips+empt+'</div><div><span class="chip '+(e.asg.length>=e.need?'ok':'warn')+'">'+e.asg.length+'/'+e.need+'</span></div></div>';
  });
  const pcHtml=pre?'<div class="panel"><h2>Kết quả kiểm tra trước khi xếp</h2><ul style="list-style:none;padding:0;margin:8px 0 0">'+pre.list.map(x=>'<li class="pc '+x.lv+'">'+IC[x.lv]+'<span>'+esc(x.t)+'</span></li>').join('')+'</ul>'+(pre.blocked?'<div class="tools" style="margin-top:8px"><button class="btn" data-act="force-run">Vẫn chạy xếp</button></div>':'')+'</div>':'';
  return head('Xếp lịch','Kiểm tra dữ liệu, xếp tự động, chỉnh tay và khóa các phân công cần giữ.',
    '<button class="btn" data-act="precheck">Kiểm tra trước khi xếp</button><button class="btn pri" data-act="auto">Xếp tự động</button>')+
    '<div class="two"><div>'+pcHtml+'<div class="panel"><div class="tools"><h2 style="margin-right:auto">Bảng phân công</h2><select data-chg="sd" aria-label="Lọc theo ngày"><option value="">Tất cả ngày</option>'+dates.map(d=>'<option value="'+d+'"'+(F.sd===d?' selected':'')+'>'+wd(d)+' '+fmtD(d)+'</option>').join('')+'</select><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-chg="lack"'+(F.lack?' checked':'')+'>Chỉ ca thiếu người</label></div><div class="tools"><button class="btn pri sm" data-act="publish-assignments">Lưu phân công lên hệ thống</button><button class="btn sm" data-act="clear-unlocked">Xóa phần chưa khóa</button><button class="btn sm" data-act="save-hist">Lưu bản này vào lịch sử</button></div>'+board+'</div></div>'+side+'</div>';
}
function repView(){
  const tabs=[['quota','Ca đã gác so với định mức'],['export','Xuất lịch'],['hist','Lịch sử các lần xếp']];
  let body='';
  if(tab6==='quota'){
    const rows=S.lecs.map(l=>{const d=loadOf(l.id,null),q=l.quota||0,min=q>0?Math.max(0,q-1):0,max=q>0?q+1:0,p=q?Math.min(100,Math.round(d/q*100)):0,ok=q>0?d>=min&&d<=max:d===0;
      const st=q===0?(d===0?'<span class="chip ok">Không phân công</span>':'<span class="chip bad">Định mức 0 ca</span>'):d<min?'<span class="chip warn">Thiếu '+(min-d)+' ca ngoài mức cho phép</span>':d>max?'<span class="chip bad">Vượt '+(d-max)+' ca ngoài mức cho phép</span>':'<span class="chip ok">Trong khoảng '+min+'–'+max+' ca</span>';
      return '<tr><td><b>'+esc(l.name)+'</b></td><td>'+esc(l.dept)+'</td><td class="c">'+q+'</td><td class="c"><b>'+d+'</b></td><td style="min-width:120px"><div class="bar '+(!ok?'bad':'')+'"><i style="width:'+p+'%"></i></div></td><td>'+st+'</td></tr>'}).join('');
    const none=S.lecs.filter(l=>loadOf(l.id,null)===0).length,over=S.lecs.filter(l=>{const q=l.quota||0,d=loadOf(l.id,null);return q>0?(d<Math.max(0,q-1)||d>q+1):d!==0}).length,tot=S.exams.reduce((n,e)=>n+e.asg.length,0);
    body='<div class="stats"><div class="stat"><b>'+tot+'</b><span>Lượt gác đã xếp</span></div><div class="stat '+(none?'hot':'done')+'"><b>'+none+'</b><span>Giảng viên chưa có ca</span></div><div class="stat '+(over?'rejected':'done')+'"><b>'+over+'</b><span>Giảng viên ngoài khoảng định mức cho phép</span></div></div><div class="panel"><div class="tw"><table><thead><tr><th>Giảng viên</th><th>Khoa</th><th class="c">Định mức</th><th class="c">Đã gác</th><th>Tiến độ</th><th>Trạng thái</th></tr></thead><tbody>'+(rows||'<tr><td colspan="6" class="empty">Chưa có giảng viên.</td></tr>')+'</tbody></table></div></div>';
  }
  if(tab6==='export'){
    const d=exportData(F.xm);
    body='<div class="panel"><div class="tools"><div class="seg" role="group" aria-label="Kiểu xuất">'+[['lec','Theo giảng viên'],['ses','Theo ca thi']].map(x=>'<button class="'+(F.xm===x[0]?'on':'')+'" data-act="xmode" data-m="'+x[0]+'">'+x[1]+'</button>').join('')+'</div><span class="muted" style="margin-right:auto">'+d.rows.length+' dòng</span><button class="btn" data-act="copy"'+(d.rows.length?'':' disabled')+'>Sao chép</button><button class="btn pri" data-act="xlsx"'+(d.rows.length?'':' disabled')+'>'+IC.upload.replace('M12 16V4M7 9l5-5 5 5M5 20h14','M12 4v12M7 11l5 5 5-5M5 20h14')+'Tải file Excel</button></div><div class="tw"><table><thead><tr>'+d.head.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+(d.rows.length?d.rows.slice(0,80).map(r=>'<tr>'+r.map(c=>'<td>'+esc(c)+'</td>').join('')+'</tr>').join(''):'<tr><td colspan="'+d.head.length+'" class="empty">Chưa có phân công để xuất. Sang mục 5 để xếp lịch.</td></tr>')+'</tbody></table></div>'+(d.rows.length>80?'<p class="hint">Hiển thị 80 dòng đầu. Bản sao chép có đủ '+d.rows.length+' dòng.</p>':'')+'</div>';
  }
  if(tab6==='hist'){
    const rows=S.hist.slice().reverse().map(h=>{
      const s1=h.s1||{};
      const s1Mode=s1.on===false?'Tắt':(s1.weight==null?'—':s1.weight);
      const gap=s1.gapDays==null?'—':s1.gapDays+' ngày / '+(s1.gapEvents??'—')+' khoảng';
      const idle=s1.idlePeriods==null?'—':s1.idlePeriods+' tiết';
      const penalty=s1.penalty==null?'—':s1.penalty;
      return '<tr><td>'+esc(h.time)+'</td><td>'+esc(h.mode)+'</td><td class="c">'+h.count+'</td><td class="c"><span class="chip '+(h.pct>=90?'ok':h.pct>=70?'':'warn')+'">'+(h.pct==null?'—':h.pct+'%')+'</span></td><td class="c">'+s1Mode+'</td><td>'+gap+'</td><td>'+idle+'</td><td class="c">'+penalty+'</td><td class="r"><button class="btn sm" data-act="restore" data-id="'+h.id+'">Khôi phục</button> <button class="btn sm ghost danger" data-act="del-hist" data-id="'+h.id+'">Xóa</button></td></tr>';
    }).join('');
    body='<div class="panel"><div class="tw"><table><thead><tr><th>Thời gian</th><th>Cách xếp</th><th class="c">Lượt gác</th><th class="c">Tỷ lệ thỏa</th><th class="c">Mức S1</th><th>Ca gãy</th><th>Tiết trống</th><th class="c">Phạt S1</th><th></th></tr></thead><tbody>'+(rows||'<tr><td colspan="9" class="empty">Chưa có lần xếp nào được lưu. Mỗi lần xếp tự động sẽ được lưu tại đây.</td></tr>')+'</tbody></table></div></div>';
  }
  return head('Thống kê, báo cáo','Đối chiếu ca đã gác với định mức, xuất lịch và xem lại các lần xếp.')+'<div class="tabs" role="tablist">'+tabs.map(t=>'<button role="tab" class="'+(tab6===t[0]?'on':'')+'" data-act="tab6" data-t="'+t[0]+'">'+t[1]+'</button>').join('')+'</div>'+body;
}
function exportData(mode){
  const ex=S.exams.slice().sort(cmpEx);let head,rows=[];
  if(mode==='lec'){head=['Giảng viên','Ngày','Ca/tiết','Buổi','Loại ca'];S.lecs.forEach(l=>ex.filter(e=>e.asg.some(a=>a.l===l.id)).forEach(e=>rows.push([l.name,fmtD(e.date),e.period||SES[e.ses],e.half==='S'?'Sáng':'Chiều',LB[e.kind]])))}
  else{const m=Math.max(1,...S.exams.map(e=>e.need));head=['Ngày','Ca/tiết','Buổi','Loại ca','Số GV cần','Số GV đã xếp'];for(let i=1;i<=m;i++)head.push('Giám thị '+i);ex.forEach(e=>{const r=[fmtD(e.date),e.period||SES[e.ses],e.half==='S'?'Sáng':'Chiều',LB[e.kind],e.need,e.asg.length];for(let i=0;i<m;i++){const a=e.asg[i];r.push(a?(lec(a.l)||{}).name:'')}rows.push(r)})}
  return{head:head,rows:rows};
}
function assignmentMatrix(){
  const all=S.exams.slice().sort((a,b)=>a.date.localeCompare(b.date)||rangeFor(a)[0]-rangeFor(b)[0]||String(a.period||'').localeCompare(String(b.period||''))),groups=new Map();
  all.forEach(e=>{const period=e.period||EXAM_SLOTS.find(s=>s[1]===rangeFor(e)[0]&&s[2]===rangeFor(e)[1])?.[0]||SES[e.ses],key=e.date+'|'+period+'|'+e.kind;if(!groups.has(key))groups.set(key,{date:e.date,period:period,start:rangeFor(e)[0],half:e.half,kind:e.kind,need:0,lecs:new Set()});const g=groups.get(key);g.need+=e.need;e.asg.forEach(a=>g.lecs.add(a.l))});
  const slots=[...groups.values()],NL=S.lecs.length,lo=18,hi=Math.max(18,17+NL),tot=17+NL,W=Math.max(3+slots.length,13),
    rows=Array.from({length:tot+3},()=>Array(W).fill('')),pad=x=>String(x).padStart(2,'0'),
    thu=d=>{const p=d.split('-').map(Number),k=new Date(p[0],p[1]-1,p[2]).getDay();return 'Thứ '+(k===0?8:k+1)},
    cl=c=>XLSX.utils.encode_col(c),lastC=cl(2+slots.length),merges=[];
  ['Ngày thi','','Tiết','Buổi','Loại ca','Số GV cần cấp','Số GV đã cấp','Số GV chưa cấp'].forEach((t,i)=>{rows[9+i][0]=t});
  rows[6][8]='DỰ KIẾN PHÂN CÔNG GIẢNG VIÊN COI THI';
  slots.forEach((g,i)=>{const c=i+3;rows[9][c]=fmtD(g.date);rows[10][c]=thu(g.date);rows[11][c]=g.period;rows[12][c]=g.half==='S'?'Sáng':'Chiều';rows[13][c]=LB[g.kind];rows[14][c]=g.need});
  for(let i=0;i<slots.length;){let j=i+1;while(j<slots.length&&slots[j].date===slots[i].date)j++;if(j-i>1){merges.push({s:{r:9,c:i+3},e:{r:9,c:j+2}});merges.push({s:{r:10,c:i+3},e:{r:10,c:j+2}})}i=j}
  S.lecs.forEach((l,i)=>{const r=17+i;rows[r][0]=l.name;rows[r][1]=l.quota||0;slots.forEach((g,j)=>{if(g.lecs.has(l.id))rows[r][j+3]='x'})});
  const t=new Date();rows[tot+2][3]='TP. HCM, ngày '+pad(t.getDate())+' tháng '+pad(t.getMonth()+1)+' năm '+t.getFullYear();
  merges.push({s:{r:tot+2,c:3},e:{r:tot+2,c:12}});
  const ws=XLSX.utils.aoa_to_sheet(rows),
    set=(r,c,o)=>{const a=XLSX.utils.encode_cell({r:r,c:c});ws[a]=Object.assign(ws[a]||{t:'s',v:''},o)},
    fm=(r,c,f,v,z)=>set(r,c,{t:'n',f:f,v:v,z:z}),
    ln={style:'thin',color:{rgb:'FF000000'}},bd={top:ln,bottom:ln,left:ln,right:ln},cen={horizontal:'center',vertical:'center',wrapText:true},
    SL={font:{name:'Arial',sz:10,bold:true},alignment:cen,border:bd},SH={font:{name:'Calibri',sz:11},alignment:cen,border:bd},
    SN={font:{name:'Times New Roman',sz:11},border:bd},SQ={font:{name:'Times New Roman',sz:11,color:{rgb:'FFFF0000'}},alignment:{horizontal:'center'},border:bd},
    SX={font:{name:'Calibri',sz:11},alignment:{horizontal:'center'},border:bd};
  for(let r=9;r<=tot;r++)for(let c=0;c<3+slots.length;c++){
    const s=r<=16?(c<3?SL:SH):r<tot?(c===0?SN:c<3?SQ:SX):(c<3?SN:null);if(s)set(r,c,{s:s});
  }
  set(6,8,{s:{font:{name:'Times New Roman',sz:14,bold:true}}});set(tot+2,3,{s:{font:{name:'Calibri',sz:11},alignment:{horizontal:'right'}}});
  let sn=0,sg=0,sq=0,sl=0;
  slots.forEach((g,j)=>{const c=j+3,k=cl(c);sn+=g.need;sg+=g.lecs.size;fm(15,c,'COUNTIF('+k+lo+':'+k+hi+',"x")',g.lecs.size);fm(16,c,k+'15-'+k+'16',g.need-g.lecs.size)});
  fm(14,2,'SUM(D15:'+lastC+'15)',sn);fm(15,2,'SUM(D16:'+lastC+'16)',sg);fm(16,2,'SUM(D17:'+lastC+'17)',sn-sg);
  S.lecs.forEach((l,i)=>{const r=17+i,n=slots.filter(g=>g.lecs.has(l.id)).length;sq+=l.quota||0;sl+=n;set(r,1,{z:'#,##0'});fm(r,2,'COUNTIF(D'+(r+1)+':'+lastC+(r+1)+',"x")',n);set(r,2,{s:SQ})});
  fm(tot,1,'SUM(B'+lo+':B'+hi+')',sq,'#,##0');fm(tot,2,'SUM(C'+lo+':C'+hi+')',sl);
  ws['!merges']=merges;ws['!cols']=[{wch:26},{wch:10},{wch:7}].concat(slots.map(()=>({wch:10})));
  ws['!rows']=rows.map((_,i)=>({hpt:i===6?19:i===9?45:i===11||i===13?30:15}));
  return ws;
}

