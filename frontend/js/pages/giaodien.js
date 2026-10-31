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
  const examIndex=items.findIndex(x=>x[0]==='exam'),lecturerIndex=items.findIndex(x=>x[0]==='lec');
  if(examIndex>=0&&lecturerIndex>=0){const [examItem]=items.splice(examIndex,1);items.splice(items.findIndex(x=>x[0]==='lec'),0,examItem)}
  return '<aside class="side"><div class="sec">Menu chính</div><nav class="nav" aria-label="Chức năng">'+
    items.filter(x=>canSee(x[0])).map(x=>'<button class="'+(view===x[0]?'on':'')+'" data-act="go" data-v="'+x[0]+'"'+(view===x[0]?' aria-current="page"':'')+'><span class="n">'+IC[NAV_IC[x[0]]]+'</span>'+esc(x[1])+(x[0]==='busy_reqs'?'<span class="nb" id="busyReqNavCount" aria-label="'+(adminBusyCount||0)+' yêu cầu chờ Admin xử lý"'+(adminBusyCount?'':' hidden')+'>'+(adminBusyCount>99?'99+':adminBusyCount||0)+'</span>':'')+'</button>').join('')+
    '</nav><div class="side-foot"><b>HUIT &middot; Khoa CNTT</b><span>Hệ thống nội bộ, chỉ dành cho quản trị viên</span><span>Phiên bản ProMax</span></div></aside>';
}
// Huy hiệu thông báo: so sánh với ID thông báo Admin đã xem lần cuối (lưu ở trình duyệt).
let adminBellRequestSeq=0;
function refreshAdminBell(force){
  if(!force&&Date.now()-(refreshAdminBell.t||0)<30000)return;refreshAdminBell.t=Date.now();
  const requestSeq=++adminBellRequestSeq;
  API.adminNotifications().then(r=>{
    // Ignore stale responses so an older in-flight refresh cannot clear a newer badge.
    if(requestSeq!==adminBellRequestSeq)return;
    const seen=+localStorage.getItem('huit-admin-seen')||0,n=(r.items||[]).filter(x=>Number(x.ID)>seen).length,d=$('#bellDot');
    if(d){d.textContent=n>9?'9+':n;d.hidden=!n}
  }).catch(()=>{});
}
function updateAdminBusyCountBadge(){
  const badge=$('#busyReqNavCount');
  if(!badge)return;
  const count=Number(adminBusyCount)||0;
  badge.textContent=count>99?'99+':String(count);
  badge.hidden=!count;
  badge.setAttribute('aria-label',count+' yêu cầu chờ Admin xử lý');
}
function refreshAdminBusyCount(force){
  if(!force&&Date.now()-(refreshAdminBusyCount.t||0)<30000)return;
  refreshAdminBusyCount.t=Date.now();
  const requestSeq=refreshAdminBusyCount.seq=(refreshAdminBusyCount.seq||0)+1;
  API.adminBusyRequests('PENDING').then(r=>{
    if(requestSeq!==refreshAdminBusyCount.seq)return;
    adminBusyCount=(r.items||[]).filter(x=>x.TrangThai==='PENDING').length;
    updateAdminBusyCountBadge();
    refreshDashboardTaskSummary();
  }).catch(()=>{});
}
function ensureAdminRequestPolling(){
  if(window.__adminRequestPolling)return;
  window.__adminRequestPolling=setInterval(()=>{
    if(cur){refreshAdminBell(true);refreshAdminBusyCount(true)}
  },30000);
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
    '<section class="login-form"><div><h1>Đăng nhập</h1><p class="muted" style="margin-bottom:18px">Hệ thống nội bộ Khoa Công nghệ Thông tin, chỉ dành cho quản trị viên.</p><label class="f"><span>Tên đăng nhập</span><input type="text" id="lu" value="admin" autocomplete="username"></label><label class="f"><span>Mật khẩu</span><input type="password" id="lp" value="demo" autocomplete="current-password"></label><div class="err" id="lerr"></div><button class="btn pri" data-act="login">Đăng nhập</button><p class="hint">Bản mẫu: mật khẩu bất kỳ. Chỉ Admin đăng nhập được.</p></div></section></div>';
}
function dashboardTasks(){
  const tasks=[];
  if(adminBusyCount>0)tasks.push({view:'busy_reqs',task:'pending-busy',count:adminBusyCount,title:adminBusyCount+' đơn xin đổi ca mới',detail:'Đã được giảng viên nhận lời, đang chờ Admin xem xét và xử lý.',action:'Xử lý ngay',level:'warn'});
  const issues=precheck().filter(x=>x.lv==='bad'||x.lv==='warn');
  issues.forEach(issue=>{
    const text=issue.t;let view='sched',title='Kiểm tra phân công',action='Mở Xếp lịch';
    if(text.includes('giảng viên nào được chọn tham gia')){view='lec';title='Chưa chọn giảng viên tham gia đợt thi';action='Chọn giảng viên'}
    else if(text.includes('Chưa có ca thi nào')){view='exam';title='Chưa tiếp nhận lịch thi';action='Tiếp nhận lịch thi'}
    else if(text.includes('định mức lớn hơn 0')||text.includes('định mức 0%')){view='lec';title='Kiểm tra định mức giảng viên';action='Mở Quản lý giảng viên'}
    else if(text.includes('lịch dạy')){view='lec';title='Kiểm tra lịch dạy giảng viên';action='Mở Quản lý giảng viên'}
    else if(text.includes('được chia nhiều ca')){view='lec';title='Kiểm tra định mức và số ca';action='Mở Quản lý giảng viên'}
    else if(text.includes('phân công đã khóa')){view='sched';title='Phân công đã khóa vi phạm ràng buộc';action='Kiểm tra phân công'}
    tasks.push({view,title,detail:text,action,level:issue.lv,count:1});
  });
  const need=S.exams.reduce((n,e)=>n+e.need,0),assigned=analyze().assigned;
  if(S.exams.length&&S.lecs.some(inDot)&&assigned<need){
    tasks.push({view:'sched',title:'Chưa xếp đủ lượt gác',detail:'Đã xếp '+assigned+' / '+need+' lượt. Mở bảng phân công để hoàn tất các ca còn thiếu.',action:'Hoàn tất phân công',level:'warn',count:1});
  }
  return tasks.slice(0,8);
}
function dashboardTaskTotal(tasks){return tasks.reduce((n,task)=>n+(Number(task.count)||1),0)}
function dashboardTaskListMarkup(tasks){
  if(!tasks.length)return '<div class="dashboard-tasks-empty">'+IC.ok+'<span><b>Không có việc nào cần xử lý</b><small>Các mục quan trọng hiện đã hoàn tất.</small></span></div>';
  return tasks.map(task=>'<button type="button" class="dashboard-task '+(task.level==='bad'?'is-bad':'is-warn')+'" data-act="go" data-v="'+task.view+'"'+(task.task?' data-task="'+task.task+'"':'')+'><span class="dashboard-task-icon">'+(task.level==='bad'?IC.bad:task.view==='busy_reqs'?IC.swap:IC.warn)+'</span><span class="dashboard-task-copy"><b>'+esc(task.title)+'</b><small>'+esc(task.detail)+'</small></span><span class="dashboard-task-action">'+esc(task.action)+' '+IC.arrow+'</span></button>').join('');
}
function dashboardIssueStatMarkup(tasks){
  const count=dashboardTaskTotal(tasks),first=tasks[0],icon='<div class="si">'+(count?IC.flag:IC.ok)+'</div>';
  const copy='<div class="dashboard-issue-copy"><span>Việc cần xử lý</span><b>'+String(count).padStart(2,'0')+'</b><small>'+(first?esc(first.title):'Mọi việc đã hoàn tất')+'</small>'+(first?'<em>'+esc(first.action)+' '+IC.arrow+'</em>':'')+'</div>';
  if(first&&canSee(first.view))return '<button id="dashboardIssueStat" type="button" class="stat ic hot dashboard-issue-stat" data-act="go" data-v="'+first.view+'"'+(first.task?' data-task="'+first.task+'"':'')+'>'+icon+copy+'</button>';
  return '<div id="dashboardIssueStat" class="stat ic '+(count?'hot':'done')+' dashboard-issue-stat">'+icon+copy+'</div>';
}
function refreshDashboardTaskSummary(){
  if(view!=='home')return;
  const tasks=dashboardTasks(),stat=$('#dashboardIssueStat'),list=$('#dashboardTaskList'),count=$('#dashboardTaskCount');
  if(stat)stat.outerHTML=dashboardIssueStatMarkup(tasks);
  if(list)list.innerHTML=dashboardTaskListMarkup(tasks);
  if(count)count.textContent=String(dashboardTaskTotal(tasks)).padStart(2,'0')+' việc';
}
function homeView(){
  const a=analyze(),need=S.exams.reduce((n,e)=>n+e.need,0);
  const pct=need?Math.round(a.assigned/need*100):0;
  const participating=S.lecs.filter(inDot).length;
  const participatingPct=S.lecs.length?Math.round(participating/S.lecs.length*100):0;
  const examKinds={theory:S.exams.filter(e=>e.kind==='LT').length,essay:S.exams.filter(e=>e.kind==='TL').length};
  const issues=precheck().filter(x=>x.lv!=='ok');
  const tasks=dashboardTasks();
  const ready=need>0&&a.assigned>=need&&!issues.some(x=>x.lv==='bad');
  const metric=(v,icon,title,value,footer,accent)=>{
    const content='<span class="dashboard-metric-label">'+title+'</span><span class="dashboard-metric-icon">'+icon+'</span><b class="dashboard-metric-value">'+value+'</b><span class="dashboard-metric-footer '+accent+'">'+footer+'</span>';
    return canSee(v)?'<button type="button" class="stat dashboard-metric '+accent+'" data-act="go" data-v="'+v+'">'+content+'</button>':'<div class="stat dashboard-metric '+accent+'">'+content+'</div>';
  };
  const stats=metric('lec',IC.users,'Tổng giảng viên',S.lecs.length,'<span>Tham gia coi thi:</span><b>'+participating+' GV ('+participatingPct+'%)</b>','lecturers')+
    metric('exam',IC.cal,'Ca thi đã tiếp nhận',S.exams.length,'<span>'+examKinds.theory+' Lý thuyết</span><i aria-hidden="true">•</i><b>'+examKinds.essay+' Tự luận</b>','exams')+
    metric('sched',IC.shield,'Độ phủ giám thị',pct+'%','<span>Lượt gác đã xếp:</span><b>'+a.assigned+' / '+need+' lượt</b>','coverage')+
    dashboardIssueStatMarkup(tasks);
  const dates=[...new Set(S.exams.map(e=>e.date))].sort().slice(0,5);
  const upcoming=dates.map(d=>{
    const L=S.exams.filter(e=>e.date===d),full=L.filter(e=>e.asg.length>=e.need).length,p=d.split('-'),r=Math.round(full/L.length*100);
    const st=full===L.length?'<span class="chip ok">Đã xếp lịch</span>':full>0?'<span class="chip warn">Đang xếp</span>':'<span class="chip">Chưa xếp</span>';
    return '<li class="pc"><div class="dd"><b>'+p[2]+'</b><span>Th.'+p[1]+'</span></div><div class="t" style="flex:1;min-width:0"><b>'+wd(d)+', '+fmtD(d)+'</b><span class="muted" style="display:block;font-size:12.5px">'+full+'/'+L.length+' ca/tiết đủ giám thị</span><div class="bar '+(r===100?'ok':'')+'" style="margin-top:5px"><i style="width:'+r+'%"></i></div></div>'+st+'</li>';
  }).join('');
  const rank=S.lecs.map(l=>({n:l.name,ld:loadOf(l.id,null),q:l.quota})).sort((x,y)=>y.ld-x.ld).slice(0,6),mx=Math.max(1,...rank.map(x=>x.ld));
  const work=rank.length&&mx>0?rank.map(x=>'<div class="wl"><span>'+esc(x.n)+'</span><div class="bar '+(x.q>0&&x.ld>x.q+1?'bad':'')+'"><i style="width:'+Math.round(x.ld/mx*100)+'%"></i></div><b>'+x.ld+'/'+x.q+'</b></div>').join('')+'<p class="hint">Thanh đỏ: vượt định mức quá 1 ca.</p>':'<p class="muted">Chưa có phân công để thống kê.</p>';
  const q=[['sched','Xếp lịch','pri'],['exam','Tiếp nhận lịch thi',''],['rep','Thống kê, báo cáo','']].filter(x=>canSee(x[0])).map(x=>'<button class="btn '+x[2]+'" data-act="go" data-v="'+x[0]+'">'+esc(x[1])+'</button>').join('');
  return '<div class="crumb">Trang chủ <span>/</span> Tổng quan</div>'+
    head('Xin chào, '+esc(cur.name),'Tổng quan công tác tổ chức và phân công lịch gác thi.')+
    '<div class="banner '+(ready?'ok':'warn')+'">'+(ready?IC.ok:IC.warn)+'<div class="t"><b>'+(ready?'Sẵn sàng cho kỳ thi sắp tới':'Còn '+(issues.length||1)+' việc cần hoàn tất')+'</b><span>'+(S.exams.length?'Đã tiếp nhận '+S.exams.length+' ca thi. '+(ready?'Toàn bộ đã được xếp giám thị.':'Còn thiếu dữ liệu hoặc phân công trước khi xếp lịch.'):'Chưa tiếp nhận lịch thi nào.')+'</span></div>'+(canSee('sched')?'<button class="btn sm" data-act="go" data-v="sched">Xem tiến độ '+IC.arrow+'</button>':'')+'</div>'+
    '<div class="stats dashboard-metrics">'+stats+'</div>'+
    '<div class="two eq"><div class="panel"><div class="ttl"><h2>Lịch thi sắp diễn ra</h2>'+(canSee('exam')?'<button class="btn sm ghost" data-act="go" data-v="exam">Xem tất cả '+IC.arrow+'</button>':'')+'</div>'+(upcoming?'<ul class="pcl">'+upcoming+'</ul>':'<p class="muted">Chưa có lịch thi. Import tại mục Tiếp nhận lịch thi.</p>')+'</div>'+
    '<div><div class="panel"><div class="ttl"><h2>Số lượt gác theo giảng viên</h2></div>'+work+'</div>'+
    '<div class="panel dashboard-tasks-panel"><div class="ttl"><h2>Việc cần xử lý</h2><span class="chip" id="dashboardTaskCount">'+String(dashboardTaskTotal(tasks)).padStart(2,'0')+' việc</span></div><div class="dashboard-task-list" id="dashboardTaskList">'+dashboardTaskListMarkup(tasks)+'</div><div class="row-end">'+q+'</div></div></div></div>';
}
function sysView(){
  const rows=S.users.map(u=>'<tr><td><b>'+esc(u.name)+'</b></td><td>'+esc(u.user)+'</td><td><select data-chg="role" data-id="'+u.id+'" aria-label="Vai trò">'+ROLES.map(r=>'<option'+(r===u.role?' selected':'')+'>'+r+'</option>').join('')+'</select></td><td><label class="sw"><input type="checkbox" data-chg="active" data-id="'+u.id+'"'+(u.on?' checked':'')+(u.id===1?' disabled':'')+' aria-label="Kích hoạt"><span></span></label></td><td class="r"><button class="btn sm ghost danger" data-act="del-user" data-id="'+u.id+'"'+(u.id===1?' disabled':'')+'>'+IC.trash+'Xóa</button></td></tr>').join('');
  const pm=MODS.map((m,i)=>'<tr><td>'+(i+1)+'. '+m+'</td>'+ROLES.map((r,ri)=>'<td class="c"><input type="checkbox" data-chg="perm" data-r="'+ri+'" data-i="'+i+'"'+(S.perms[r][i]?' checked':'')+(ri===0&&i===0?' disabled':'')+' aria-label="'+esc(r+' - '+m)+'"></td>').join('')+'</tr>').join('');
  return head('Quản lý hệ thống','Quản lý tài khoản, vai trò và quyền truy cập.','<button class="btn pri" data-act="add-user">'+IC.plus+'Thêm tài khoản</button>')+
    '<div class="panel"><h2>Tài khoản</h2><p class="sub">Tài khoản đầu tiên luôn được bật.</p><div class="tw"><table><thead><tr><th>Họ tên</th><th>Tên đăng nhập</th><th>Vai trò</th><th>Hoạt động</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div></div>'+
    '<div class="panel"><h2>Phân quyền theo vai trò</h2><p class="sub">Bỏ chọn để ẩn chức năng khỏi menu vai trò.</p><div class="tw"><table><thead><tr><th>Chức năng</th>'+ROLES.map(r=>'<th class="c">'+r+'</th>').join('')+'</tr></thead><tbody>'+pm+'</tbody></table></div></div>';
}
function accountSearchKey(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLowerCase()}
function accountRows(){
  const q=accountSearchKey(accountsSearch.trim());
  const matches=adminAccounts.filter(a=>{
    const stopped=a.TrangThaiGiangVien!=='Đang công tác';
    const passwordState=a.AccountStatusKnown===false?'missing':a.MustChangePassword?'pending':'ready';
    const searchMatch=!q||[a.HoTen,a.MaGV,a.Email].some(v=>accountSearchKey(v).includes(q));
    const passwordMatch=accountsPasswordFilter==='ALL'||accountsPasswordFilter===passwordState;
    const workMatch=accountsWorkFilter==='ALL'||(accountsWorkFilter==='STOPPED'?stopped:!stopped);
    return searchMatch&&passwordMatch&&workMatch;
  });
  const rows=matches.map(a=>{
    const maGV=esc(a.MaGV||''), stopped=a.TrangThaiGiangVien!=='Đang công tác';
    const initialsText=esc(initials(a.HoTen||a.MaGV||'?'));
    const workToggle='<button type="button" class="account-work-toggle '+(stopped?'stopped':'working')+'" data-act="toggle-account-employment" data-id="'+maGV+'" aria-pressed="'+(!stopped)+'" aria-label="'+(stopped?'Khôi phục trạng thái công tác':'Ngừng công tác')+' cho '+esc(a.HoTen||maGV)+'" title="'+(stopped?'Bấm để khôi phục công tác và mở đăng nhập':'Bấm để ngừng công tác và khóa đăng nhập')+'"><span class="account-switch" aria-hidden="true"><i></i></span><span class="account-work-label">'+esc(a.TrangThaiGiangVien||'Chưa rõ')+'</span></button>';
    const action='<button class="btn sm account-action" data-act="reset-user-password" data-id="'+maGV+'">'+IC.key+'Cấp mật khẩu tạm</button>';
    const loginDate=a.LastLoginAt?new Date(a.LastLoginAt):null;
    const loginText=loginDate&&!Number.isNaN(loginDate.getTime())?'<span>'+loginDate.toLocaleDateString('vi-VN')+'</span><small>lúc '+loginDate.toLocaleTimeString('vi-VN')+'</small>':'<em>Chưa đăng nhập</em>';
    const passwordStatus=a.AccountStatusKnown===false?'<span class="account-state neutral">Chưa có tài khoản</span>':a.MustChangePassword?'<span class="account-state pending">'+IC.clock+'Cần đổi mật khẩu</span>':'<span class="account-state ready">'+IC.ok+'Đã thiết lập</span>';
    return '<tr><td><div class="account-person"><span class="account-avatar">'+initialsText+'</span><span><b>'+esc(a.HoTen||'')+'</b><small>'+maGV+'</small></span></div></td><td class="account-email">'+esc(a.Email||'—')+'</td><td>'+workToggle+'</td><td>'+passwordStatus+'</td><td class="account-login">'+loginText+'</td><td class="account-action-cell">'+action+'</td></tr>'
  }).join('');
  return {rows:rows||'<tr><td colspan="6" class="empty">'+(adminAccounts.length?'Không tìm thấy tài khoản phù hợp.':'Chưa có tài khoản nào.')+'</td></tr>',count:matches.length,items:matches};
}
function refreshAccountRows(){
  const tbody=$('#userAccountRows'),count=$('#accountSearchCount'),result=accountRows();
  if(tbody)tbody.innerHTML=result.rows;
  if(count)count.textContent=result.count+' / '+adminAccounts.length+' tài khoản';
}
function accountsView(){
  const result=accountRows();
  const body=accountsLoading?'<tr><td colspan="6" class="empty">Đang tải danh sách tài khoản…</td></tr>':accountsError?'<tr><td colspan="6" class="empty">'+esc(accountsError)+'</td></tr>':result.rows;
  const working=adminAccounts.filter(a=>a.TrangThaiGiangVien==='Đang công tác'&&a.IsActive).length;
  const ready=adminAccounts.filter(a=>a.AccountStatusKnown!==false&&!a.MustChangePassword).length;
  const pending=adminAccounts.filter(a=>a.AccountStatusKnown!==false&&a.MustChangePassword).length;
  const readyPct=adminAccounts.length?Math.round(ready/adminAccounts.length*100):0;
  const stat=(icon,label,value,detail,kind)=>'<article class="account-stat '+kind+'"><span class="account-stat-icon">'+icon+'</span><span class="account-stat-copy"><small>'+label+'</small><b>'+value+'</b><em>'+detail+'</em></span></article>';
  return '<div class="account-page">'+head('Quản lý tài khoản','Kiểm soát quyền đăng nhập, trạng thái công tác và cấp lại mật khẩu tạm cho giảng viên.','<button class="btn" data-act="load-user-accounts">'+IC.refresh+'Làm mới dữ liệu</button><button class="btn pri" data-act="export-accounts">'+IC.down+'Xuất danh sách TK (.xlsx)</button>')+
    '<section class="account-stats" aria-label="Tổng quan tài khoản">'+stat(IC.users,'Đang công tác',working,'Trên tổng số '+adminAccounts.length+' tài khoản','green')+stat(IC.shield,'Đã thiết lập mật khẩu riêng',ready,readyPct+'% tổng số tài khoản','blue')+stat(IC.key,'Chờ đổi mật khẩu lần đầu',pending,'Cần đổi mật khẩu tạm','amber')+'</section>'+
    '<section class="panel account-list"><div class="account-list-head"><div class="account-list-title"><h2>Danh sách tài khoản giảng viên</h2><span class="account-count" id="accountSearchCount">'+(accountsLoading?'Đang tải…':accountsError?'':result.count+' / '+adminAccounts.length)+'</span><p>Giảng viên ngừng công tác sẽ không đăng nhập được; có thể khôi phục trạng thái khi quay lại trường.</p></div><div class="account-filters"><label class="account-search">'+IC.search+'<input type="text" data-inp="accounts-search" placeholder="Tìm tên, mã GV, email..." value="'+esc(accountsSearch)+'" aria-label="Tìm tài khoản giảng viên"></label><select data-chg="account-password-filter" aria-label="Lọc theo trạng thái mật khẩu"><option value="ALL"'+(accountsPasswordFilter==='ALL'?' selected':'')+'>Mật khẩu: Tất cả</option><option value="ready"'+(accountsPasswordFilter==='ready'?' selected':'')+'>Đã thiết lập</option><option value="pending"'+(accountsPasswordFilter==='pending'?' selected':'')+'>Cần đổi mật khẩu</option><option value="missing"'+(accountsPasswordFilter==='missing'?' selected':'')+'>Chưa có tài khoản</option></select><select data-chg="account-work-filter" aria-label="Lọc theo trạng thái công tác"><option value="ALL"'+(accountsWorkFilter==='ALL'?' selected':'')+'>Công tác: Tất cả</option><option value="WORKING"'+(accountsWorkFilter==='WORKING'?' selected':'')+'>Đang công tác</option><option value="STOPPED"'+(accountsWorkFilter==='STOPPED'?' selected':'')+'>Ngừng công tác</option></select></div></div><div class="tw account-table-wrap"><table class="account-table"><thead><tr><th>Giảng viên &amp; định danh</th><th>Email đăng nhập</th><th>Trạng thái công tác</th><th>Bảo mật mật khẩu</th><th>Đăng nhập cuối</th><th>Thao tác</th></tr></thead><tbody id="userAccountRows">'+body+'</tbody></table></div></section></div>';
}
function busyReqsView(){
  const list = adminBusyRequests;
  const pendingCount = list.filter(x=>x.TrangThai==='PENDING').length;
  const approvedCount = list.filter(x=>x.TrangThai==='APPROVED').length;
  const rejectedCount = list.filter(x=>x.TrangThai==='REJECTED').length;

  const reqStatusMap = {
    'PENDING': ['Chờ Admin xử lý', 'warn'],
    'APPROVED': ['Đã chấp nhận', 'ok'],
    'REJECTED': ['Đã từ chối', 'bad'],
    'WITHDRAWN': ['Người gửi đã rút đơn', '']
  };
  const nomineeResponseMap = {
    'PENDING': ['Chờ phản hồi', 'warn'],
    'ACCEPTED': ['Đã đồng ý', 'ok'],
    'DECLINED': ['Đã từ chối', 'bad'],
    'WITHDRAWN': ['Lời mời đã bị rút', '']
  };

  const rows = list.map(a => {
    const st = reqStatusMap[a.TrangThai] || [a.TrangThai, ''];
    const nomineeResponse=nomineeResponseMap[a.TrangThaiXacNhanThayThe]||['Chưa gửi lời mời',''];

    const actionBtn = a.TrangThai === 'PENDING'
      ? '<button class="btn sm pri" data-act="process-busy-request" data-id="'+a.MaYeuCau+'">Xem và xử lý</button>'
      : '<button class="btn sm" data-act="view-busy-detail" data-id="'+a.MaYeuCau+'">Chi tiết</button>';

    return '<tr>'+
      '<td><b>#'+a.MaYeuCau+'</b></td>'+
      '<td><b>'+esc(a.HoTen)+'</b><br><span class="hint" style="margin:0">'+esc(a.MaGV)+'</span></td>'+
      '<td>'+(a.TenGVThayTheDeNghi||a.MaGVThayTheDeNghi?'<b>'+esc(a.TenGVThayTheDeNghi||a.MaGVThayTheDeNghi)+'</b><br><span class="hint" style="margin:0">'+esc(a.MaGVThayTheDeNghi||'')+'</span><br><span class="chip '+nomineeResponse[1]+'">'+esc(nomineeResponse[0])+'</span>':'<span class="muted">Chưa chọn người được nhờ</span>')+'</td>'+
      '<td><div class="busy-request-reason" title="'+esc([a.LyDoBaoBan,a.GhiChuGV].filter(Boolean).join(' — '))+'"><b>'+esc(a.LyDoBaoBan||'Chưa nêu lý do')+'</b></div></td>'+
      '<td><span class="chip '+st[1]+'">'+esc(st[0])+'</span></td>'+
      '<td>'+actionBtn+'</td>'+
    '</tr>';
  }).join('');

  const body = busyReqsLoading
    ? '<tr><td colspan="6" class="empty">Đang tải danh sách yêu cầu báo bận…</td></tr>'
    : busyReqsError
    ? '<tr><td colspan="6" class="empty" style="color:var(--bad)">'+esc(busyReqsError)+'</td></tr>'
    : rows || '<tr><td colspan="6" class="empty">Không có yêu cầu báo bận nào.</td></tr>';

  const bulkApproveBtn = pendingCount && !busyReqsLoading && !busyReqsError
    ? '<button class="btn pri" data-act="accept-all-busy-requests" title="Duyệt các đơn đang chờ; từng đơn vẫn được kiểm tra ràng buộc">'+IC.ok+'Chấp nhận tất cả ('+pendingCount+')</button>'
    : '';

  return head('Quản lý yêu cầu báo bận',
    'Chỉ đơn đã được người nhận đồng ý mới chuyển đến đây.',
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
          '<option value="WITHDRAWN" '+(busyReqFilter==='WITHDRAWN'?'selected':'')+'>Người gửi đã rút đơn</option>'+
        '</select>'+
      '</div>'+
      '<div class="tw">'+
        '<table class="busy-requests-table">'+
          '<thead>'+
            '<tr>'+
              '<th>Mã YC</th>'+
              '<th>Giảng viên</th>'+
              '<th>Người được nhờ &amp; xác nhận</th>'+
              '<th>Lý do</th>'+
              '<th>Trạng thái</th>'+
              '<th>Thao tác</th>'+
            '</tr>'+
          '</thead>'+
          '<tbody>'+body+'</tbody>'+
        '</table>'+
      '</div>'+
      '<p class="hint">Ca thi, thời gian, ghi chú và kết quả xử lý được xem trong “Chi tiết”. Khi duyệt, hệ thống kiểm tra lại các ràng buộc RB1–RB6.</p>'+
    '</div>';
}
function filteredLecturers(){
  const q=plain(F.lq||'');
  return S.lecs.filter(l=>{
    const searchable=plain([l.name,l.id,l.dept].join(' '));
    return (!F.ld||l.dept===F.ld)&&(!F.ls||(F.ls==='in'?inDot(l):!inDot(l)))&&(!q||searchable.includes(q));
  });
}
function updateLecturerCount(){
  const el=$('#lcount');if(!el)return;
  const shown=filteredLecturers().length,total=S.lecs.length;
  el.textContent=shown===total?total+' giảng viên':shown+' / '+total+' giảng viên';
}
function lecRows(){
  const L=filteredLecturers();
  if(!L.length)return '<tr><td colspan="6" class="empty">Không tìm thấy giảng viên phù hợp với bộ lọc.</td></tr>';
  return L.map(l=>{
    const participating=inDot(l),hasSchedule=!!(l.busy.length||l.teach.length);
    return '<tr>'+
      '<td><div class="lec-person"><span class="lec-avatar">'+esc(initials(l.name))+'</span><span class="lec-person-copy"><b>'+esc(l.name)+'</b><small>Mã GV: '+esc(l.id)+'</small></span></div></td>'+
      '<td><span class="lec-department">'+esc(l.dept||'Chưa phân khoa')+'</span></td>'+
      '<td><span class="lec-participation '+(participating?'is-in':'is-out')+'"><i></i>'+(participating?'Tham gia đợt':'Không tham gia')+'</span></td>'+
      '<td><div class="lec-quota"><label><input type="number" min="0" max="100" value="'+l.pct+'" data-chg="pct" data-id="'+esc(l.id)+'"'+(participating?'':' disabled title="Chưa chọn tham gia đợt thi"')+' aria-label="Định mức phần trăm của '+esc(l.name)+'"><span>%</span></label><small>≈ '+l.quota+' ca</small></div></td>'+
      '<td><div class="lec-schedule"><span class="lec-schedule-summary '+(hasSchedule?'has-data':'')+'">'+(hasSchedule?'Dạy: '+l.teach.length+' ca <i>·</i> Bận: '+l.busy.length+' buổi':'Chưa khai báo lịch')+'</span><div class="lec-schedule-actions"><button class="btn sm" data-act="teaching-schedule" data-id="'+esc(l.id)+'">'+(l.teach.length?'Cập nhật lịch dạy':'Thêm lịch dạy')+'</button>'+(hasSchedule?' <button class="btn sm ghost danger icon-delete" data-act="clear-schedule" data-id="'+esc(l.id)+'" title="Xóa lịch dạy và lịch bận" aria-label="Xóa lịch dạy và lịch bận">'+IC.trash+'</button>':'')+'</div></div></td>'+
      '<td class="lec-row-actions"><button class="btn sm ghost" data-act="edit-lec" data-id="'+esc(l.id)+'">Sửa</button><button class="btn sm ghost danger" data-act="del-lec" data-id="'+esc(l.id)+'" title="Xóa giảng viên" aria-label="Xóa giảng viên">'+IC.trash+'Xóa</button></td>'+
      '</tr>';
  }).join('');
}
function lecView(){
  const total=S.lecs.length,participating=S.lecs.filter(inDot).length,withSchedule=S.lecs.filter(l=>l.busy.length||l.teach.length).length;
  const headerActions='<div class="lec-head-actions"><button class="btn lec-pick-top" data-act="pick-dot-lec" title="Chọn giảng viên tham gia đợt thi" aria-label="Chọn giảng viên tham gia đợt thi">'+IC.users+'Chọn GV tham gia</button><button class="btn lec-import-teach" data-act="pick-teach-file">'+IC.upload+'Import lịch dạy</button><button class="btn lec-import-busy" data-act="pick-busy-file">'+IC.calendarOff+'Import lịch bận</button><button class="btn lec-quota-all" data-act="quota-all">'+IC.percent+'Đặt định mức chung</button><button class="btn pri lec-add" data-act="add-lec">'+IC.users+'Thêm giảng viên</button></div>';
  return '<div class="lec-page">'+head('Quản lý giảng viên','Thiết lập danh sách tham gia đợt thi, định mức coi thi và lịch dạy/bận cá nhân.',headerActions)+
    '<input type="file" id="fileTeach" data-chg="teach-file" accept=".xlsx,.xls,.csv,.txt,.tsv" hidden>'+
    '<input type="file" id="fileBusy" data-chg="busy-file" accept=".xlsx,.xls,.csv,.txt,.tsv" hidden>'+
    (pendBusy?'<div class="panel"><h2>Kiểm tra import lịch bận</h2><p class="sub">'+esc(pendBusy.name)+' · '+pendBusy.rows.length+' dòng hợp lệ · '+pendBusy.errors.length+' dòng lỗi</p><p class="hint">Tên được ghép không phân biệt dấu; ngày được chuẩn hóa. “Cả ngày” tạo Sáng và Chiều; nếu trùng, giữ lý do ưu tiên cao nhất.</p>'+importSummary(pendBusy,'lịch bận')+'<div class="tools"><button class="btn pri" data-act="apply-busy"'+(pendBusy.rows.length&&!pendBusy.errors.length?'':' disabled')+'>Nhập lịch bận</button><button class="btn" data-act="cancel-busy">Hủy</button></div></div>':'')+
    (pendTeach?'<div class="panel"><h2>Kiểm tra lịch dạy</h2><p class="sub">'+esc(pendTeach.name)+' · '+pendTeach.rows.length+' ca học · '+pendTeach.teachers.length+' giảng viên</p><p class="hint">Chỉ cập nhật giảng viên trong danh sách; lịch dạy giúp tránh trùng ca thi.</p><div class="tools"><button class="btn pri" data-act="apply-teach"'+(pendTeach.rows.length?'':' disabled')+'>Nhập lịch dạy</button><button class="btn" data-act="cancel-teach">Hủy</button></div></div>':'')+
    '<section class="lec-overview" aria-label="Tổng quan giảng viên">'+
      '<article class="lec-summary-card"><span class="lec-summary-icon blue">'+IC.users+'</span><div><small>Tổng giảng viên</small><b>'+total+'</b><span>đang có trong hệ thống</span></div></article>'+
      '<article class="lec-summary-card lec-participation-card"><span class="lec-summary-icon green">'+IC.ok+'</span><div><small>Tham gia đợt này</small><b>'+participating+' <em>/ '+total+' GV</em></b><span>Chỉ người được chọn mới được xếp lịch</span></div></article>'+
      '<article class="lec-summary-card"><span class="lec-summary-icon teal">'+IC.cal+'</span><div><small>Đã có lịch dạy/bận</small><b>'+withSchedule+' <em>/ '+total+' GV</em></b><span>Thông tin dùng để tránh xung đột lịch</span></div></article>'+
      '<article class="lec-summary-card lec-cleanup-card"><div class="lec-cleanup-heading"><small>Làm sạch dữ liệu kỳ cũ</small><span class="lec-cleanup-warning" aria-hidden="true">'+IC.warn+'</span></div><div class="lec-cleanup-actions"><button class="btn sm danger" data-act="clear-all-teaching" title="Xóa toàn bộ lịch dạy của tất cả giảng viên">'+IC.trash+'Xóa lịch dạy</button><button class="btn sm danger" data-act="clear-all-busy" title="Xóa toàn bộ lịch bận của tất cả giảng viên">'+IC.trash+'Xóa lịch bận</button></div></article>'+
    '</section>'+
    '<section class="panel lec-table-panel"><div class="lec-filter-bar"><label class="lec-search">'+IC.search+'<input type="search" id="lq" data-inp="lq" placeholder="Tìm theo tên hoặc mã giảng viên..." value="'+esc(F.lq)+'" aria-label="Tìm giảng viên"></label><select data-chg="ls" aria-label="Lọc theo trạng thái tham gia"><option value=""'+(!F.ls?' selected':'')+'>Trạng thái: Tất cả ('+total+')</option><option value="in"'+(F.ls==='in'?' selected':'')+'>Tham gia đợt ('+participating+')</option><option value="out"'+(F.ls==='out'?' selected':'')+'>Không tham gia ('+(total-participating)+')</option></select><select data-chg="ld" aria-label="Lọc theo khoa"><option value="">Tất cả khoa</option>'+depts().map(d=>'<option value="'+esc(d)+'"'+(F.ld===d?' selected':'')+'>'+esc(d)+'</option>').join('')+'</select><button class="btn sm lec-refresh" data-act="refresh-lec" title="Làm mới dữ liệu giảng viên">'+IC.refresh+'Làm mới</button><span class="lec-result-count" id="lcount"></span></div><div class="tw lec-table-scroll"><table class="lec-table"><thead><tr><th>Giảng viên</th><th>Đơn vị / Khoa</th><th>Tham gia đợt</th><th>Định mức gác</th><th>Lịch dạy &amp; báo bận</th><th>Thao tác</th></tr></thead><tbody id="lecRows">'+lecRows()+'</tbody></table></div><p class="hint lec-table-hint">Chọn nhanh để cập nhật danh sách cho đợt thi hiện tại. Định mức chỉ áp dụng cho giảng viên đang tham gia đợt.</p></section></div>';
}
function importSummary(p,what){
  let h='<div class="tools"><span class="chip ok">'+p.rows.length+' dòng hợp lệ</span><span class="chip '+(p.errors.length?'bad':'')+'">'+p.errors.length+' dòng lỗi</span>'+(p.extra||'')+'</div>';
  if(p.errors.length)h+='<div class="tw"><table><thead><tr><th>Dòng</th><th>Lỗi cần sửa</th></tr></thead><tbody>'+p.errors.slice(0,12).map(e=>'<tr><td>'+e.line+'</td><td>'+esc(e.msg)+'</td></tr>').join('')+'</tbody></table></div>'+(p.errors.length>12?'<p class="hint">Còn '+(p.errors.length-12)+' dòng lỗi khác. Sửa file rồi import lại để đầy đủ.</p>':'');
  return h;
}
function examKindClass(kind){const value=String(kind||'').trim().toLowerCase();return value==='tl'||value.includes('tự luận')?'duty-essay':'duty-theory'}
function examRows(){
  const q=F.eq.trim().toLowerCase();
  const L=S.exams.filter(e=>(!F.ed||e.date===F.ed)&&(!F.ek||String(e.kind).toUpperCase()===F.ek)&&(!q||(e.date+' '+wd(e.date)+' '+fmtD(e.date)+' '+(e.period||SES[e.ses])+' '+(e.half==='S'?'sáng':'chiều')+' '+(LB[e.kind]||'')).toLowerCase().indexOf(q)>=0)).sort(cmpEx);
  if(!L.length)return '<tr><td colspan="7" class="empty">'+(S.exams.length?'Không có ca thi phù hợp bộ lọc.':'Chưa có ca thi. Hãy import file của bạn hoặc bấm “Thêm ca thi mới”.')+'</td></tr>';
  return L.map(e=>{
    const assigned=Array.isArray(e.asg)?e.asg.length:0,required=Number(e.need)||0,pct=required?Math.min(100,Math.round(assigned/required*100)):0;
    return '<tr><td><span class="exam-date"><i>'+wd(e.date)+'</i><b>'+fmtD(e.date)+'</b></span></td><td><span class="exam-period">Tiết '+esc(e.period||SES[e.ses])+'</span></td><td><span class="exam-session"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'+(e.half==='S'?'Sáng':'Chiều')+'</span></td><td><span class="chip exam-kind '+examKindClass(e.kind)+'">'+LB[e.kind]+'</span></td><td class="c exam-needed">'+required+'</td><td><div class="exam-progress"><span class="exam-progress-track"><i style="width:'+pct+'%"></i></span><span class="chip '+(assigned>=required?'ok':'warn')+'">'+assigned+'/'+required+' GV</span></div></td><td class="exam-row-actions"><button class="btn sm" data-act="edit-exam" data-id="'+e.id+'">Sửa</button><button class="btn sm ghost danger" data-act="del-exam" data-id="'+e.id+'" aria-label="Xóa ca thi">'+IC.trash+'Xóa</button></td></tr>'
  }).join('');
}
function examForm(e){
  const latest=(S.dots&&S.dots[0])||{};
  const years=[];const now=new Date().getFullYear();for(let y=2023;y<=now+3;y++)years.push(y+'-'+(y+1));
  const yh=e&&e.nam_hoc||latest.NamHoc||years.find(x=>x.startsWith(String(now)))||years[years.length-1];
  openModal({title:e?'Sửa ca thi':'Nhập ca thi',wide:true,body:
    '<p class="hint">Ngày thi là ngày thực tế. Hệ thống tự gắn ca vào đợt thi hiện tại.</p>'+   '<label class="f"><span>Ngày thi</span><input type="date" id="exDate" value="'+(e?e.date:'')+'"></label>'+    '<label class="f"><span>Tiết / ca thi</span><select id="exPeriod">'+EXAM_SLOTS.map(x=>'<option value="'+x[0]+'"'+((e?e.period===x[0]:false)?' selected':'')+'>'+x[0]+'</option>').join('')+'</select></label>'+    '<label class="f"><span>Loại ca</span><select id="exKind"><option value="LT"'+(e&&e.kind==='LT'?' selected':'')+'>Lý thuyết</option><option value="TL"'+(e&&e.kind==='TL'?' selected':'')+'>Tự luận</option></select></label>'+    '<label class="f"><span>Số giảng viên cần cấp</span><input type="number" id="exNeed" min="1" max="30" value="'+(e?e.need:2)+'"></label><div class="err" id="exErr"></div>',foot:'<button class="btn" data-act="close">Hủy</button><button class="btn pri" data-act="save-exam" data-id="'+(e?e.id:'')+'">'+(e?'Lưu thay đổi':'Lưu ca thi')+'</button>'});
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
  const totalNeed=S.exams.reduce((n,e)=>n+(Number(e.need)||0),0);
  const totalAssigned=S.exams.reduce((n,e)=>n+(Array.isArray(e.asg)?e.asg.length:0),0);
  const progress=totalNeed?Math.round(totalAssigned/totalNeed*100):0;
  const pageHead=head('Quản lý lịch thi','Khởi tạo ca thi thủ công hoặc nhập hàng loạt từ tệp dữ liệu chuẩn.','<button class="btn danger" data-act="clear-all-exams" title="Xóa toàn bộ ca thi">'+IC.trash+' Xóa tất cả</button><button class="btn pri" data-act="add-exam">'+IC.plus+'Thêm ca thi mới</button>');
  return '<div class="exam-page">'+pageHead+
    '<section class="exam-stats" aria-label="Tổng quan lịch thi">'+
      '<article class="exam-metric"><span class="exam-metric-icon blue">'+IC.clip+'</span><div><span>Tổng số ca thi</span><b>'+String(S.exams.length).padStart(2,'0')+'<small> ca</small></b></div></article>'+
      '<article class="exam-metric"><span class="exam-metric-icon amber">'+IC.users+'</span><div><span>Giảng viên cần cấp</span><b>'+String(totalNeed).padStart(2,'0')+'<small> lượt gác</small></b></div></article>'+
      '<article class="exam-metric"><span class="exam-metric-icon '+(progress>=100?'green':'red')+'">'+IC.flag+'</span><div><span>Tiến độ xếp lịch</span><b class="'+(progress>=100?'green':'red')+'">'+progress+'% <small>('+totalAssigned+'/'+totalNeed+' đã xếp)</small></b></div></article>'+
    '</section>'+
    '<section class="panel exam-import-panel"><div class="exam-import-drop"><span class="exam-import-icon">'+IC.clip+'</span><div class="exam-import-copy"><h2>Import danh sách ca thi nhanh</h2><p>Hỗ trợ định dạng .xlsx, .xls, .csv gồm 4 cột: <span>Ngày thi</span>, <span>Ca/tiết</span>, <span>Số GV cần</span>, <span>Loại ca</span>.</p></div><span class="exam-import-prompt">Chọn tệp từ máy tính</span><button class="btn exam-upload-button" data-act="pick-exam-file">'+IC.upload+' Chọn file tải lên</button></div><input type="file" id="fileExam" data-chg="file-exam" accept=".xlsx,.xls,.csv,.txt,.tsv" hidden></section>'+pv+
    '<section class="panel exam-list-panel"><div class="exam-list-heading"><div><h2>Danh sách ca thi</h2><span class="exam-list-count">'+S.exams.length+' ca</span></div><div class="exam-list-filters"><label class="exam-search">'+IC.search+'<input type="text" data-inp="eq" placeholder="Tìm ngày, tiết, buổi..." value="'+esc(F.eq)+'" aria-label="Tìm ca thi"></label><select data-chg="ek" aria-label="Lọc theo loại ca"><option value="">Tất cả loại ca</option><option value="LT"'+(F.ek==='LT'?' selected':'')+'>Lý thuyết</option><option value="TL"'+(F.ek==='TL'?' selected':'')+'>Tự luận</option></select><select data-chg="ed" aria-label="Lọc theo ngày"><option value="">Tất cả ngày</option>'+dates.map(d=>'<option value="'+d+'"'+(F.ed===d?' selected':'')+'>'+wd(d)+' '+fmtD(d)+'</option>').join('')+'</select></div></div><div class="tw"><table class="exam-table"><thead><tr><th>Ngày thi</th><th>Ca / tiết</th><th>Buổi</th><th>Hình thức</th><th class="c">Cần cấp</th><th>Trạng thái xếp</th><th class="exam-actions-head">Thao tác</th></tr></thead><tbody id="examRows">'+examRows()+'</tbody></table></div></section></div>';
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
  return head('Quản lý ràng buộc','Ràng buộc cứng luôn áp dụng; cấu hình các ràng buộc mềm.','<button class="btn pri" data-act="reset-soft">Khôi phục mặc định</button>')+
    '<div class="panel"><h2>Ràng buộc cứng</h2><p class="sub">Luôn áp dụng; mức bận 1 là bắt buộc.</p>'+hard+'</div>'+
    '<div class="panel"><h2>Ràng buộc mềm</h2><p class="sub">Mức bận 2–3 được tự động gán theo lý do.</p>'+soft+'</div>';
}

function schedView(){
  const a=analyze(),need=S.exams.reduce((n,e)=>n+e.need,0);
  const dates=[...new Set(S.exams.map(e=>e.date))].sort();
  const ring=(function(){const p=a.overall==null?0:a.overall,C=2*Math.PI*52,col=a.overall==null?'var(--line)':(p>=90?'var(--ok)':p>=70?'var(--blue)':'var(--warn)');
    return '<svg viewBox="0 0 140 140" width="150" height="150" role="img" aria-label="Tỷ lệ thỏa ràng buộc"><circle cx="70" cy="70" r="52" fill="none" stroke="var(--sky)" stroke-width="12"/><circle cx="70" cy="70" r="52" fill="none" stroke="'+col+'" stroke-width="12" stroke-linecap="round" stroke-dasharray="'+(C*p/100).toFixed(1)+' '+C.toFixed(1)+'" transform="rotate(-90 70 70)"/><text x="70" y="74" text-anchor="middle" class="v">'+(a.overall==null?'—':a.overall+'%')+'</text><text x="70" y="94" text-anchor="middle" class="l">thỏa ràng buộc</text></svg>'}());
  const qualityReady=a.overall===100;
  const side='<aside class="panel side-panel sched-quality"><div class="sched-quality-heading"><div><h2>Chất lượng xếp lịch</h2><p class="sub">Đã xếp '+a.assigned+' / '+need+' lượt gác thi</p></div><span class="sched-quality-badge '+(qualityReady?'good':'')+'">'+(qualityReady?'Tối ưu':'Đang kiểm tra')+'</span></div><div class="ring">'+ring+'</div>'+
    (qualityReady?'<div class="sched-quality-callout">'+IC.ok+'<div><b>Thỏa mãn mọi ràng buộc</b><span>Không phát hiện xung đột lịch dạy, lịch bận hay vượt định mức ca thi.</span></div></div>':'')+
    (a.assigned?a.list.map(x=>{
      const detail=x.id==='S1'&&a.S1
        ?'<div class="crow-detail"><span>Tổng lượt ngày giảng viên lên trường: <b>'+a.S1.total+'</b></span></div>'
        :'';
      return '<div class="crow"><div class="h"><b>'+esc(x.name)+(x.hard?' <span class="chip">Cứng</span>':'')+'</b><span>'+(x.pct==null?'—':x.pct+'%')+'</span></div><div class="bar '+(x.pct!=null&&x.pct<70?'bad':(x.pct===100?'ok':''))+'"><i style="width:'+(x.pct||0)+'%"></i></div>'+detail+'</div>';
    }).join(''):'<p class="muted">Chưa có phân công. Chạy xếp tự động hoặc xếp tay để xem tỷ lệ.</p>')+'</aside>';
  let board='';
  const L=S.exams.filter(e=>(!F.sd||e.date===F.sd)&&(!F.lack||e.asg.length<e.need)).sort(cmpEx);
  if(!L.length)board='<p class="muted sched-empty">'+(S.exams.length?'Không có ca thi phù hợp bộ lọc.':'Chưa có ca thi. Import tại mục Tiếp nhận lịch thi trước khi xếp.')+'</p>';
  let lastD='';
  L.forEach(e=>{
    if(e.date!==lastD){lastD=e.date;board+='<div class="day sched-day">'+IC.cal+'<span>'+wd(e.date)+', '+fmtD(e.date)+'</span></div>'}
    const chips=e.asg.map(x=>{const l=lec(x.l),iss=hardIssues(e,x.l);return '<span class="slot sched-staff'+(x.lock?' locked':'')+(iss.length?' bad':'')+'"'+(iss.length?' title="'+esc(iss.join(', '))+'"':'')+'><b>'+esc(l?l.name:'?')+'</b>'+(iss.length?' <i>'+esc(iss.join(', '))+'</i>':'')+'<button class="lk" data-act="lock" data-ex="'+e.id+'" data-l="'+x.l+'" aria-label="'+(x.lock?'Mở khóa':'Khóa')+' phân công" title="'+(x.lock?'Đang khóa, bấm để mở':'Bấm để khóa phân công này')+'">'+(x.lock?IC.lock:IC.unlock)+'</button><button class="sched-remove" data-act="unasg" data-ex="'+e.id+'" data-l="'+x.l+'" aria-label="Gỡ phân công" title="Gỡ khỏi ca này">'+IC.trash+'</button></span>'}).join('');
    let empt='';for(let i=e.asg.length;i<e.need;i++)empt+='<button class="slot empty sched-add-staff" data-act="pick" data-ex="'+e.id+'">'+IC.plus+'<span>Chọn giảng viên</span></button>';
    board+='<article class="ex sched-row"><div class="sched-period"><b>Tiết '+esc(e.period||SES[e.ses])+'</b><span>'+IC.sun+(e.half==='S'?'Buổi sáng':'Buổi chiều')+'</span></div><div class="sched-kind"><small>Hình thức</small><span class="chip exam-kind '+examKindClass(e.kind)+'"><i></i>'+LB[e.kind]+'</span></div><div class="slots sched-staff-list">'+chips+empt+'</div><div class="sched-progress"><span class="chip '+(e.asg.length>=e.need?'ok':'warn')+'">'+e.asg.length+'/'+e.need+'</span></div></article>';
  });
  const pcHtml=pre?'<div class="panel sched-precheck-result"><h2>Kết quả kiểm tra trước khi xếp</h2><ul style="list-style:none;padding:0;margin:8px 0 0">'+pre.list.map(x=>'<li class="pc '+x.lv+'">'+IC[x.lv]+'<span>'+esc(x.t)+'</span></li>').join('')+'</ul>'+(pre.blocked?'<div class="tools" style="margin-top:8px"><button class="btn" data-act="force-run">Vẫn chạy xếp</button></div>':'')+'</div>':'';
  const pageActions='<button class="btn sched-precheck" data-act="precheck">'+IC.shield+'Kiểm tra trước khi xếp</button><button class="btn pri sched-auto" data-act="auto">'+IC.wand+'Chạy xếp lịch tự động</button>';
  const share='<section class="panel sched-share-card"><span class="sched-share-icon">'+IC.eye+'</span><div class="sched-share-copy"><div class="sched-share-heading"><b>Quyền xem lịch chéo giữa các Giảng viên</b><span class="sched-share-state" id="scheduleSharingBadge">Đang tải…</span></div><p>Khi bật, giảng viên có thể xem toàn bộ bảng phân công của khoa để chủ động đổi ca.</p><span class="schedule-sharing-status" id="scheduleSharingStatus" role="status">Đang tải trạng thái chia sẻ…</span></div><div class="sched-share-controls"><button class="btn sm ghost" data-act="refresh-schedule-sharing" title="Đọc lại quyền chia sẻ hiện tại từ máy chủ" aria-label="Làm mới quyền chia sẻ">'+IC.refresh+'</button><button class="btn sched-share-toggle" data-act="toggle-schedule-sharing" aria-pressed="false" disabled><span class="sched-switch" aria-hidden="true"><i></i></span><span>Cho phép xem chung</span></button></div></section>';
  const assignmentState=S.scheduleDraftDirty&&S.schedulePublished?{label:'Có thay đổi chưa công bố',cls:'is-draft'}:S.scheduleDraftDirty&&a.assigned?{label:'Bản nháp chưa công bố',cls:'is-draft'}:S.schedulePublished?{label:'Đã công bố',cls:'has-assignments'}:a.assigned?{label:'Chưa công bố',cls:'is-draft'}:{label:'Chưa xếp lịch',cls:''};
  const assignment='<section class="panel sched-assignment"><div class="sched-assignment-heading"><div><div class="sched-title-line"><span class="sched-heading-icon">'+IC.cal+'</span><h2>Bảng phân công chi tiết</h2><span class="sched-assignment-state '+assignmentState.cls+'">'+assignmentState.label+'</span></div><p>Chỉnh sửa người gác, khóa các vị trí cần giữ và lưu lịch cho giảng viên.</p></div><div class="sched-filters"><label><input type="checkbox" data-chg="lack"'+(F.lack?' checked':'')+'>Chỉ hiện ca thiếu người</label><select data-chg="sd" aria-label="Lọc theo ngày"><option value="">Tất cả ngày thi</option>'+dates.map(d=>'<option value="'+d+'"'+(F.sd===d?' selected':'')+'>'+wd(d)+' '+fmtD(d)+'</option>').join('')+'</select></div></div><div class="assignment-actions sched-actions"><button class="btn pri" data-act="publish-assignments">'+IC.upload+'Lưu và Công bố lịch</button><button class="btn" data-act="save-hist">'+IC.history+'Lưu vào lịch sử</button><button class="btn" data-act="clear-unlocked" title="Chỉ xóa các chỉnh sửa chưa khóa trên bảng">'+IC.trash+'Xóa nháp chưa khóa</button><button class="btn ghost danger" data-act="unpublish-assignments" title="Chỉ gỡ lịch đã công bố khỏi lịch giảng viên; giữ nguyên bảng phân công admin">'+IC.trash+'Thu hồi lịch đã công bố</button></div><p class="hint assignment-help">“Xóa nháp chưa khóa” xóa phân công chưa khóa khỏi bảng admin. “Thu hồi lịch đã công bố” chỉ gỡ lịch khỏi phía giảng viên; bản phân công trên bảng admin vẫn được giữ làm nháp.</p><div class="sched-board">'+board+'</div></section>';
  return '<div class="sched-page">'+head('Điều phối & Xếp lịch gác thi','Chạy thuật toán phân công tự động, tinh chỉnh thủ công và ghim khóa các vị trí cố định.',pageActions)+pcHtml+'<div class="sched-layout"><div class="sched-main">'+share+assignment+'</div>'+side+'</div></div>';
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
      return '<tr><td>'+esc(h.time)+'</td><td>'+esc(h.mode)+'</td><td class="c">'+h.count+'</td><td class="c"><span class="chip '+(h.pct>=90?'ok':h.pct>=70?'':'warn')+'">'+(h.pct==null?'—':h.pct+'%')+'</span></td><td class="c">'+s1Mode+'</td><td>'+gap+'</td><td>'+idle+'</td><td class="c">'+penalty+'</td><td class="r"><button class="btn sm" data-act="restore" data-id="'+h.id+'">Khôi phục</button> <button class="btn sm ghost danger" data-act="del-hist" data-id="'+h.id+'">'+IC.trash+'Xóa</button></td></tr>';
    }).join('');
    body='<div class="panel"><div class="tw"><table><thead><tr><th>Thời gian</th><th>Cách xếp</th><th class="c">Lượt gác</th><th class="c">Tỷ lệ thỏa</th><th class="c">Mức S1</th><th>Ca gãy</th><th>Tiết trống</th><th class="c">Phạt S1</th><th></th></tr></thead><tbody>'+(rows||'<tr><td colspan="9" class="empty">Chưa có lần xếp nào được lưu. Mỗi lần xếp tự động sẽ được lưu tại đây.</td></tr>')+'</tbody></table></div></div>';
  }
  return head('Thống kê, báo cáo','Xem định mức, xuất lịch và lịch sử xếp.')+'<div class="tabs" role="tablist">'+tabs.map(t=>'<button role="tab" class="'+(tab6===t[0]?'on':'')+'" data-act="tab6" data-t="'+t[0]+'">'+t[1]+'</button>').join('')+'</div>'+body;
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

