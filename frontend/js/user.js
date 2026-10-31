(() => {
  const $ = s => document.querySelector(s);
  const base = window.API_BASE_URL || 'http://127.0.0.1:8000/api';
  const state = {user:null, page:'schedule', busyRequests:[], swaps:[], schedule:[], allSchedules:[], scheduleAccess:{can_view_all:false,lecturers:[]}, scheduleViewer:'mine', lecturers:[], notices:[], pendingCoverId:null, calendarDate:null, calendarMode:'week', selectedBusyCa:null};
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const friendlyError = (message, status) => status >= 500 || /SQL Server|ODBC|SQLExecDirect|SQLDriverConnect|invalid object name|stored procedure|dbo\.|database|SQLSTATE|Microsoft/i.test(String(message||''))
    ? 'Chưa thể hoàn tất thao tác. Vui lòng thử lại; nếu lỗi tiếp diễn, hãy liên hệ quản trị viên.'
    : String(message||'Yêu cầu không thành công.');
  const logoSrc = (() => {
    try {
      const savedLogo = JSON.parse(localStorage.getItem(KEY) || 'null')?.logo;
      return savedLogo && savedLogo !== 'assets/logo-huit.png' ? savedLogo : LOGO;
    }
    catch { return LOGO; }
  })();
  const logoMark = size => `<div class="logo-wrap"><img src="${esc(logoSrc)}" alt="Logo Trường Đại học Công Thương" style="width:${size}px;height:${size}px;object-fit:contain"></div>`;
  
  async function req(path, opts={}) {
    const token = sessionStorage.getItem('authToken');
    const headers = {'Content-Type':'application/json', ...(opts.headers || {})};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    let r;
    try {
      // Schedule data must be read fresh after an admin publishes/removes it.
      r = await fetch(base+path,{...opts, headers, cache:opts.cache||'no-store'});
    } catch (_) {
      throw new Error('Không thể gửi yêu cầu ngay lúc này. Vui lòng thử lại sau hoặc liên hệ quản trị viên.');
    }
    const d=await r.json().catch(()=>({}));
    if(!r.ok) {
      const msg = typeof d.detail==='string'?d.detail:(d.detail?.message||((d.detail?.violations||[]).join('\n'))||'Yêu cầu không thành công.');
      const error=new Error(friendlyError(msg, r.status));
      error.status=r.status;
      throw error;
    }
    return d;
  }

  const fmt = d => d ? new Date(String(d).slice(0,10)+'T00:00:00').toLocaleDateString('vi-VN') : '';
  const slot = (date,a,b) => `${fmt(date)} · tiết ${a}–${b}`;
  const todayLabel = () => new Date().toLocaleDateString('vi-VN',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'});
  
  function toast(m){let t=$('#toast');if(!t){t=document.createElement('div');t.id='toast';t.setAttribute('role','status');document.body.appendChild(t)}t.textContent=m;t.style.display='block';clearTimeout(toast.h);toast.h=setTimeout(()=>t.style.display='none',3500)}
  const initialsOf=n=>String(n||'GV').trim().split(/\s+/).slice(-2).map(w=>w[0]).join('').toUpperCase();
  
  function openUserModal(o) {
    const m = $('#modal');
    if (!m) return;
    m.innerHTML = '<div class="ov" id="userOvClose"><div class="md '+(o.wide?'wide':'')+'" role="dialog" aria-modal="true" aria-label="'+esc(o.title)+'"><header><h3>'+esc(o.title)+'</h3><button class="x" id="userModalClose" aria-label="Đóng">'+IC.x+'</button></header><div class="bd">'+o.body+'</div>'+(o.foot?'<footer>'+o.foot+'</footer>':'')+'</div></div>';
    $('#userModalClose').onclick = closeUserModal;
    $('#userOvClose').onclick = e => { if (e.target.id === 'userOvClose') closeUserModal(); };
  }
  function closeUserModal() {
    const m = $('#modal');
    if (m) m.innerHTML = '';
  }

  function isNoticeRead(notice){
    const response=String(notice.TrangThaiPhanHoiThayThe||'').toUpperCase();
    const invitationAnswered=notice.Loai==='BusyCoverRequested'&&['ACCEPTED','DECLINED'].includes(response);
    return Boolean(notice.DaDoc)||invitationAnswered;
  }

  async function refreshBell(){
    try{
      const r=await req('/user/notifications/'+encodeURIComponent(state.user.ma_gv));
      const n=(r.items||[]).filter(x=>!isNoticeRead(x)).length;
      state.unread=n;
      [['#bellDot',n>9?'9+':n],['#navDot',n]].forEach(([q,v])=>{const e=$(q);if(e){e.textContent=v;e.hidden=!n}});
    }catch(e){}
  }

  function topbar(){
    return `<header class="topbar"><div class="tb-brand">${logoMark(38)}<div><div class="uni">Trường Đại học Công Thương TP.HCM</div><h1>Hệ thống xếp lịch gác thi</h1><div class="sub">Khoa Công nghệ Thông tin · Cổng giảng viên</div></div></div><div class="tb-r"><span class="pillbox">${IC.cal}<span class="hide-sm">${todayLabel()}</span></span><button class="ibtn" id="notifications" title="Thông báo" aria-label="Thông báo">${IC.bell}<span class="dot" id="bellDot" hidden></span></button><div class="tb-user"><div class="tb-av">${esc(initialsOf(state.user.ho_ten))}</div><div><b>${esc(state.user.ho_ten)}</b><span>Giảng viên</span></div><button class="ibtn" id="changePassword" title="Đổi mật khẩu" aria-label="Đổi mật khẩu">${IC.key}</button><button class="ibtn" id="logout" title="Đăng xuất" aria-label="Đăng xuất">${IC.logout}</button></div></div></header>`;
  }

  function shell(content){
    const nav=[
      ['schedule','Lịch gác thi',IC.cal],
      ['busy','Báo bận / Điều chỉnh',IC.clip],
      ['swaps','Yêu cầu thay ca',IC.swap],
      ['notices','Thông báo',IC.bell],
      ['password','Đổi mật khẩu',IC.key]
    ];
    $('#app').innerHTML=topbar()+`<div class="shell"><aside class="side"><div class="sec">Menu chính</div><nav class="nav">${nav.map(([id,label,ic])=>`<button data-page="${id}" class="${state.page===id?'on':''}"${state.page===id?' aria-current="page"':''}><span class="n">${ic}</span>${label}${id==='notices'?'<span class="nb" id="navDot" hidden></span>':''}</button>`).join('')}</nav><div class="side-foot"><b>HUIT · Khoa CNTT</b><span>Hệ thống nội bộ</span><span>Phiên bản ProMax</span></div></aside><main class="main">${content}</main></div>`;
    document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{state.page=b.dataset.page;renderPage()});
    $('#notifications').onclick=()=>{state.page='notices';renderPage()};
    $('#changePassword').onclick=()=>{state.page='password';renderPage()};
    $('#logout').onclick=()=>{state.user=null;sessionStorage.removeItem('authRole');sessionStorage.removeItem('lecturerSession');sessionStorage.removeItem('authToken');sessionStorage.removeItem('mustChangePassword');location.replace('login.html')};
    refreshBell();
  }

  function loginView(){
    $('#app').innerHTML=`<div class="login"><section class="login-art"><div class="lb">${logoMark(72)}<div class="uni">Trường Đại học Công Thương<br>Thành phố Hồ Chí Minh</div></div><div><h2>Hệ thống xếp lịch gác thi</h2><p>Tra cứu lịch gác thi cá nhân, báo bận cho quản trị viên và trao đổi đổi ca.</p></div><div class="mini" aria-hidden="true">${'<i class="a"></i>'.repeat(40)}</div></section><section class="login-form"><div><h1>Đăng nhập giảng viên</h1><p class="muted" style="margin-bottom:18px">Dùng mã giảng viên và mật khẩu do quản trị viên cấp.</p><form id="loginForm"><label class="f"><span>Mã giảng viên</span><input id="maGV" required maxlength="20" autocomplete="username"></label><label class="f"><span>Mật khẩu</span><input id="password" type="password" required autocomplete="current-password"></label><div class="err" id="error"></div><button class="btn pri" type="submit">Đăng nhập</button></form><p class="hint">Lần đầu: mật khẩu tạm là 1; hệ thống sẽ yêu cầu đổi mật khẩu.</p></div></section></div>`;
    $('#loginForm').onsubmit=async e=>{
      e.preventDefault();
      const err=$('#error');
      try{
        const r=await req('/user/login',{method:'POST',body:JSON.stringify({ma_gv:$('#maGV').value.trim(),password:$('#password').value})});
        state.user=r;
        state.user.ma_gv=r.ma_gv;
        if(r.token) sessionStorage.setItem('authToken', r.token);
        if(r.must_change_password){passwordView(true)}else await renderPage();
      }catch(x){err.textContent=x.message}
    };
  }

  function passwordView(required=false){
    const account=esc(state.user?.ma_gv||'');
    $('#app').innerHTML=`<div class="login password-screen">
      <section class="login-art password-art">
        <div class="login-brand">${logoMark(60)}<div class="login-university"><b>Trường Đại học Công Thương TP.HCM</b><span>Khoa Công nghệ Thông tin</span></div></div>
        <div class="login-intro">
          <div class="login-kicker"><span>${IC.shield}</span>${required?'Yêu cầu bảo mật tài khoản':'Cập nhật bảo mật tài khoản'}</div>
          <h2>${required?'Thiết lập mật khẩu cá nhân':'Bảo vệ tài khoản của bạn'}</h2>
          <p>${required?'Để bảo vệ thông tin lịch coi thi và quyền lợi cá nhân, vui lòng đổi mật khẩu tạm được cấp trong lần đăng nhập đầu tiên.':'Hãy đổi mật khẩu định kỳ để bảo vệ thông tin lịch coi thi và quyền truy cập tài khoản.'}</p>
          <div class="login-feature-card password-progress">
            <div class="login-feature-heading"><span class="login-check">✓</span><b>${required?'TIẾN TRÌNH KÍCH HOẠT TÀI KHOẢN':'BẢO MẬT TÀI KHOẢN'}</b></div>
            <div class="password-steps">
              <div class="password-step done"><i>✓</i><span>1. ${required?'Đăng nhập bằng mật khẩu tạm':'Đăng nhập tài khoản'}</span></div>
              <div class="password-step current"><i>2</i><span>2. ${required?'Đổi mật khẩu bảo mật mới':'Cập nhật mật khẩu'} <b>(Đang thực hiện)</b></span></div>
              <div class="password-step${required?'':' done'}"><i>${required?'3':'✓'}</i><span>3. ${required?'Truy cập bảng tra cứu lịch gác thi':'Tiếp tục sử dụng cổng giảng viên'}</span></div>
            </div>
          </div>
        </div>
        <div class="login-art-footer"><span>© ${new Date().getFullYear()} Khoa CNTT – HUIT</span><span>Hỗ trợ kỹ thuật: Giáo vụ Khoa</span></div>
      </section>
      <section class="login-form password-form">
        <div class="password-panel">
          <div class="password-topline"><span class="password-account"><i></i>Tài khoản: <b>${account}</b></span><button class="password-logout" id="passwordLogout" type="button">${IC.logout} Đăng xuất</button></div>
          <div class="login-card password-card">
            <h1>${required?'Đổi mật khẩu lần đầu':'Đổi mật khẩu'}</h1>
            <p class="login-description">Thiết lập mật khẩu mới đáp ứng các tiêu chuẩn an toàn bên dưới để ${required?'mở khóa toàn bộ tính năng':'bảo vệ tài khoản'}.</p>
            <form id="pwForm" novalidate>
              <label class="f login-field"><span>Mật khẩu hiện tại${required?' (Mật khẩu tạm)':''}</span><div class="login-control"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="15" r="4"/><path d="m11 12 8-8 3 3-2 2 2 2-3 3-2-2-3 3"/></svg><input class="password-input" id="oldPw" type="password" required autocomplete="current-password" placeholder="${required?'Nhập lại mật khẩu tạm vừa cấp':'Nhập mật khẩu hiện tại'}"></div></label>
              <div class="password-field-heading"><label class="f login-field" for="newPw"><span>Mật khẩu mới</span></label><span class="password-live-status" id="passwordLiveStatus">Chưa nhập</span></div>
              <div class="login-control"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg><input class="password-input" id="newPw" type="password" required autocomplete="new-password" placeholder="Tạo mật khẩu từ 8–16 ký tự"></div>
              <div class="password-strength" id="passwordStrength" aria-hidden="true"><i></i><i></i><i></i></div>
              <section class="password-rules" aria-label="Yêu cầu mật khẩu">
                <h2>YÊU CẦU MẬT KHẨU:</h2>
                <ul>
                  <li id="ruleLength"><i></i><span>Độ dài từ <b>8 đến 16 ký tự</b></span></li>
                  <li id="ruleUpper"><i></i><span>Ít nhất <b>01 chữ cái in hoa (A–Z)</b></span></li>
                  <li id="ruleSpecial"><i></i><span>Ít nhất <b>01 ký tự đặc biệt</b> (ví dụ: !@#$%...)</span></li>
                </ul>
              </section>
              <div class="password-confirm-heading"><label class="f login-field" for="confirmPw"><span>Xác nhận mật khẩu mới</span></label><span class="password-live-status" id="confirmLiveStatus">Chưa nhập</span></div>
              <div class="login-control"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 19 6v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="m9 12 2 2 4-4"/></svg><input class="password-input" id="confirmPw" type="password" required autocomplete="new-password" placeholder="Nhập lại chính xác mật khẩu mới"></div>
              <div class="err" id="error" role="alert"></div>
              <button class="btn pri login-submit" id="pwSave" type="submit" disabled><span class="password-submit-check">✓</span>Lưu mật khẩu và tiếp tục</button>
              ${required?'':'<button class="password-back" id="back" type="button">Quay lại lịch gác thi</button>'}
            </form>
          </div>
          <p class="password-footnote">Mật khẩu của bạn được mã hóa an toàn theo tiêu chuẩn bảo mật của trường.</p>
        </div>
      </section>
    </div>`;
    if($('#back'))$('#back').onclick=()=>{state.page='schedule';renderPage()};
    $('#passwordLogout').onclick=()=>{state.user=null;sessionStorage.removeItem('authRole');sessionStorage.removeItem('lecturerSession');sessionStorage.removeItem('authToken');sessionStorage.removeItem('mustChangePassword');location.replace('login.html')};
    const oldInput=$('#oldPw'),newInput=$('#newPw'),confirmInput=$('#confirmPw'),saveButton=$('#pwSave');
    const updatePasswordFeedback=()=>{
      const value=newInput.value, length=Array.from(value).length;
      const checks={length:length>=8&&length<=16,upper:/[A-Z]/.test(value),special:/[^A-Za-z0-9]/.test(value)};
      [['#ruleLength',checks.length],['#ruleUpper',checks.upper],['#ruleSpecial',checks.special]].forEach(([selector,valid])=>$(selector).classList.toggle('met',valid));
      const score=Object.values(checks).filter(Boolean).length;
      $('#passwordStrength').dataset.level=String(score);
      $('#passwordLiveStatus').textContent=value?(score===3?'Đạt yêu cầu':`${score}/3 yêu cầu`):'Chưa nhập';
      $('#passwordLiveStatus').classList.toggle('ready',score===3);
      const confirmation=confirmInput.value, matches=Boolean(confirmation)&&confirmation===value;
      $('#confirmLiveStatus').textContent=confirmation?(matches?'Khớp mật khẩu':'Chưa khớp'):'Chưa nhập';
      $('#confirmLiveStatus').classList.toggle('ready',matches);
      saveButton.disabled=!(oldInput.value&&score===3&&matches);
    };
    [oldInput,newInput,confirmInput].forEach(input=>input.addEventListener('input',updatePasswordFeedback));
    updatePasswordFeedback();
    $('#pwForm').onsubmit=async e=>{
      e.preventDefault();
      const old=$('#oldPw').value,n=$('#newPw').value,c=$('#confirmPw').value,er=$('#error');
      updatePasswordFeedback();
      if(saveButton.disabled)return;
      if(n!==c){er.textContent='Mật khẩu nhập lại không khớp.';return}
      if(n.length<8||n.length>16||!/[A-Z]/.test(n)||! /[^A-Za-z0-9]/.test(n)){
        er.textContent='Mật khẩu phải dài 8–16 ký tự, có ít nhất một chữ hoa và một ký tự đặc biệt.';return
      }
      try{
        await req('/user/change-password',{method:'POST',body:JSON.stringify({ma_gv:state.user.ma_gv,current_password:old,new_password:n})});
        state.user.must_change_password=false;
        sessionStorage.removeItem('mustChangePassword');
        sessionStorage.setItem('lecturerSession',JSON.stringify(state.user));
        state.page='schedule';
        await renderPage();
      }catch(x){er.textContent=x.message}
    };
  }

  async function renderPage(){
    if(!state.user)return loginView();
    try{
      if(state.page==='schedule'){
        const [access, busy]=await Promise.all([
          req('/user/schedule-access'),
          req('/user/busy-requests')
        ]);
        state.scheduleAccess=access;
        const viewer=state.scheduleAccess.can_view_all?(state.scheduleViewer||'mine'):'mine';
        const allowed=new Set((state.scheduleAccess.lecturers||[]).map(x=>String(x.MaGV).toLowerCase()));
        state.scheduleViewer=viewer==='mine'||viewer==='all'||allowed.has(String(viewer).toLowerCase())?viewer:'mine';
        if(state.scheduleViewer==='all'){
          const all=await req('/user/schedules/all');
          state.allSchedules=all.items||[];state.schedule=[];
        }else{
          const maGV=state.scheduleViewer==='mine'?state.user.ma_gv:state.scheduleViewer;
          const schedule=await req('/user/schedule/'+encodeURIComponent(maGV));
          state.schedule=schedule.items||[];state.allSchedules=[];
        }
        state.busyRequests=busy.items||[];
      }
      if(state.page==='busy'){
        const [br, sc]=await Promise.all([
          req('/user/busy-requests'),
          req('/user/schedule/'+encodeURIComponent(state.user.ma_gv))
        ]);
        state.busyRequests=br.items;
        state.schedule=sc.items;
      }
      if(state.page==='swaps'){
        const [br,sc]=await Promise.all([
          req('/user/busy-requests'),
          req('/user/schedule/'+encodeURIComponent(state.user.ma_gv))
        ]);
        state.busyRequests=br.items||[];
        state.schedule=sc.items;
      }
      if(state.page==='notices'){
        const r=await req('/user/notifications/'+encodeURIComponent(state.user.ma_gv));
        state.notices=r.items;
      }
    }catch(e){
      shell(`<div class="crumb">Cổng giảng viên</div><div class="panel"><h2>Chưa tải được dữ liệu</h2><p>${esc(e.message)}</p><p class="hint">Bạn hãy tải lại trang. Nếu vẫn chưa xem được, vui lòng liên hệ quản trị viên.</p></div>`);
      return;
    }
    if(state.page==='schedule')return schedulePage();
    if(state.page==='busy')return busyPage();
    if(state.page==='swaps')return swapsPage();
    if(state.page==='notices')return noticesPage();
    return passwordView(false);
  }

  function schedulePage(){
    const isAll=state.scheduleViewer==='all'&&state.scheduleAccess.can_view_all;
    const isMine=state.scheduleViewer==='mine';
    const currentId=String(state.user.ma_gv).toLowerCase();
    const target=state.scheduleAccess.lecturers.find(x=>String(x.MaGV).toLowerCase()===String(state.scheduleViewer).toLowerCase());
    const list=isAll?state.allSchedules:state.schedule, today=new Date().toISOString().slice(0,10),up=list.filter(x=>x.NgayThi>=today).length;
    const title=isAll?'Lịch gác thi của tất cả giảng viên':isMine?'Lịch gác thi của tôi':`Lịch gác thi · ${target?.HoTen||state.scheduleViewer}`;
    const options=state.scheduleAccess.can_view_all?`<label class="schedule-viewer"><span>Xem lịch</span><select id="scheduleViewer" aria-label="Chọn lịch giảng viên"><option value="mine"${isMine?' selected':''}>Lịch của tôi</option><option value="all"${isAll?' selected':''}>Tất cả giảng viên</option>${(state.scheduleAccess.lecturers||[]).filter(x=>String(x.MaGV).toLowerCase()!==currentId).map(x=>`<option value="${esc(x.MaGV)}"${String(x.MaGV).toLowerCase()===String(state.scheduleViewer).toLowerCase()?' selected':''}>${esc(x.HoTen)} · ${esc(x.MaGV)}</option>`).join('')}</select></label>`:'';
    const body=isAll?allSchedulesTable(list):'<div id="scheduleCalendar"></div>';
    shell(`<div class="crumb">Trang chủ / Lịch gác thi</div><header class="ph"><div><h1>${esc(title)}</h1><p>${isAll?'Chọn giảng viên để xem lịch tuần hoặc tháng.':isMine?'Xem lịch tuần/tháng; đơn báo bận cũng hiện tại đây.':'Lịch tuần/tháng của giảng viên đã chọn.'}</p></div><div class="ph-r">${options}${isMine?`<button class="btn pri" id="goBusy">${IC.clip} Báo bận ca thi</button>`:''}<button class="btn" id="refresh">${IC.refresh} Làm mới dữ liệu</button></div></header><div class="stats"><div class="stat ic"><div class="si">${IC.clip}</div><div><b>${list.length}</b><span>${isAll?'Tổng lượt phân công':'Tổng số ca'}</span></div></div><div class="stat ic"><div class="si">${IC.cal}</div><div><b>${up}</b><span>Ca sắp tới</span></div></div><div class="stat ic"><div class="si">${IC.ok}</div><div><b>${list.length-up}</b><span>Ca đã qua</span></div></div></div><div class="panel lecturer-calendar-panel">${body}</div>`);
    if(!isAll)renderCalendarInto('#scheduleCalendar',{duties:list,busyRequests:isMine?(state.busyRequests||[]):[]});
    const viewer=$('#scheduleViewer');if(viewer)viewer.onchange=()=>{state.scheduleViewer=viewer.value;state.calendarDate=null;renderPage()};
    $('#refresh').onclick=renderPage;
    const goBusy=$('#goBusy');if(goBusy)goBusy.onclick=()=>{state.page='busy';renderPage()};
  }

  function allSchedulesTable(rows){
    const body=(rows||[]).map(x=>`<tr><td>${fmt(x.NgayThi)}</td><td>${esc(x.Thu||'')} · ${esc(x.MaCa||'')}</td><td>${esc(x.TuTiet)}–${esc(x.DenTiet)}</td><td><b>${esc(x.HoTen||x.MaGV)}</b><br><span class="hint" style="margin:0">${esc(x.MaGV)}</span></td><td>${esc(x.HinhThucThi||'')}</td><td>${esc(x.PhongThi||'—')}</td></tr>`).join('');
    return `<div class="tw"><table><thead><tr><th>Ngày thi</th><th>Ca</th><th>Tiết</th><th>Giảng viên</th><th>Hình thức</th><th>Phòng</th></tr></thead><tbody>${body||'<tr><td colspan="6" class="empty">Chưa có phân công nào.</td></tr>'}</tbody></table></div>`;
  }

  // Tiện ích tính giờ theo tiết học
  function tietToTime(tiet, isEnd=false) {
    const times = {
      1: ['07:00','07:50'], 2: ['07:50','08:40'], 3: ['08:50','09:40'], 4: ['09:40','10:30'],
      5: ['10:40','11:30'], 6: ['11:30','12:20'], 7: ['13:00','13:50'], 8: ['13:50','14:40'],
      9: ['14:50','15:40'], 10: ['15:40','16:30'], 11: ['16:40','17:30'], 12: ['17:30','18:20'],
      13: ['18:30','19:15'], 14: ['19:15','20:00'], 15: ['20:00','20:45'], 16: ['20:45','21:30']
    };
    const t = times[tiet] || ['07:00','11:30'];
    return isEnd ? t[1] : t[0];
  }

  function localDateKey(date){
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  }
  function dateFromKey(value){
    const key=String(value||'').slice(0,10);
    const match=key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match?new Date(Number(match[1]),Number(match[2])-1,Number(match[3])):new Date();
  }
  function startOfWeek(date){
    const start=new Date(date.getFullYear(),date.getMonth(),date.getDate());
    start.setDate(start.getDate()-((start.getDay()+6)%7));
    return start;
  }
  function calendarEvents(duties,busyRequests){
    const events=[];
    (duties||[]).forEach(x=>{
      const examType=String(x.HinhThucThi||'').trim().toLowerCase();
      const dutyClass=examType==='tl'||examType.includes('tự luận')?'duty-essay':'duty-theory';
      events.push({
        kind:'duty',dutyClass,date:String(x.NgayThi||'').slice(0,10),start:tietToTime(x.TuTiet,false),end:tietToTime(x.DenTiet,true),
        maCa:String(x.MaCa||''),title:`Ca gác thi · tiết ${x.TuTiet}–${x.DenTiet}`,
        detail:`${LB[x.HinhThucThi]||x.HinhThucThi||'Ca thi'}${x.PhongThi?' · '+x.PhongThi:''}${x.MaCa?' · '+x.MaCa:''}`,
        sort:Number(x.TuTiet)||0
      });
    });
    (busyRequests||[]).filter(x=>['PENDING','APPROVED'].includes(String(x.TrangThai||'').toUpperCase())).forEach(x=>{
      const rawStart=String(x.ThoiGianBatDauBan||'').replace('T',' ');
      const rawEnd=String(x.ThoiGianKetThucBan||'').replace('T',' ');
      const date=rawStart.slice(0,10),start=rawStart.slice(11,16),end=rawEnd.slice(11,16);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(start)||!/^\d{2}:\d{2}$/.test(end))return;
      const approved=String(x.TrangThai).toUpperCase()==='APPROVED';
      events.push({kind:'busy',date,start,end,maCa:String(x.MaCa||''),title:approved?'Báo bận đã duyệt':'Đơn báo bận chờ duyệt',detail:`#${x.MaYeuCau} · ${x.LyDoBaoBan||''}`,sort:clockMinutes(start)});
    });
    return events.filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x.date));
  }
  function clockMinutes(value){
    const match=String(value||'').match(/^(\d{1,2}):(\d{2})/);
    return match?Number(match[1])*60+Number(match[2]):0;
  }
  function calendarEventMarkup(event,options,month=false,overlap=false){
    const disabled=event.kind==='duty'&&options.disabledCas?.has(event.maCa);
    const selected=event.kind==='duty'&&options.selectedCa===event.maCa;
    const statusClass=event.kind==='busy'?(event.title.includes('đã duyệt')?'busy-approved':'busy-pending'):`duty-event ${event.dutyClass||'duty-theory'}`;
    const classes=`calendar-event ${statusClass}${selected?' selected':''}${disabled?' disabled':''}${options.selectable&&event.kind==='duty'?' selectable':''}${month?' month-event':''}`;
    const title=`${event.title} · ${event.detail}`;
    const content=month?`<b>${esc(event.start)} ${esc(event.title)}</b>`:`<b>${esc(event.title)}</b><span>${esc(event.detail)}</span>`;
    const selectable=options.selectable&&event.kind==='duty';
    const attrs=selectable?`data-calendar-select="${esc(event.maCa)}" ${disabled?'disabled':''}`:'';
    if(month)return selectable?`<button type="button" class="${classes}" title="${esc(title)}" aria-label="${esc(title)}" ${attrs}>${content}</button>`:`<div class="${classes}" title="${esc(title)}">${content}</div>`;
    const top=Math.max(0,clockMinutes(event.start)-7*60);
    const bottom=Math.min(22*60,clockMinutes(event.end))-7*60;
    const height=Math.max(34,bottom-top-3);
    let left='4px',width='calc(100% - 8px)';
    if(overlap&&event.kind==='duty')width='calc(50% - 6px)';
    if(overlap&&event.kind==='busy'){left='50%';width='calc(50% - 5px)';}
    const style=`top:${top}px;height:${height}px;left:${left};width:${width}`;
    return selectable?`<button type="button" class="${classes}" style="${style}" title="${esc(title)}" aria-label="${esc(title)}" ${attrs}>${content}</button>`:`<div class="${classes}" style="${style}" title="${esc(title)}">${content}</div>`;
  }
  function calendarWidgetMarkup(options){
    let anchor;
    if(state.calendarDate)anchor=dateFromKey(state.calendarDate);
    else{
      anchor=new Date();
      const currentWeek=startOfWeek(anchor),weekEnd=new Date(currentWeek);weekEnd.setDate(weekEnd.getDate()+6);
      const todayKey=localDateKey(anchor),weekEndKey=localDateKey(weekEnd);
      const dutyDates=(options.duties||[]).map(x=>String(x.NgayThi||'').slice(0,10)).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x));
      if(!dutyDates.some(x=>x>=localDateKey(currentWeek)&&x<=weekEndKey)){
        const next=dutyDates.filter(x=>x>=todayKey).sort()[0];
        if(next)anchor=dateFromKey(next);
      }
      state.calendarDate=localDateKey(anchor);
    }
    const mode=state.calendarMode==='month'?'month':'week';
    const events=calendarEvents(options.duties,options.busyRequests);
    const today=localDateKey(new Date());
    const weekDays=Array.from({length:7},(_,i)=>['T2','T3','T4','T5','T6','T7','CN'][(i+startOfWeek(anchor).getDay()+6)%7]);
    let label='';
    let grid='';
    if(mode==='week'){
      const days=Array.from({length:7},(_,i)=>{const d=startOfWeek(anchor);d.setDate(d.getDate()+i);return d;});
      const first=days[0],last=days[6];
      label=`${first.toLocaleDateString('vi-VN',{day:'numeric',month:'short'})} – ${last.toLocaleDateString('vi-VN',{day:'numeric',month:'short',year:'numeric'})}`;
      const labels=days.map((d,i)=>`<div class="calendar-day-heading ${localDateKey(d)===today?'today':''}"><span>${weekDays[i]}</span><b>${d.getDate()}</b></div>`).join('');
      const hourLabels=Array.from({length:15},(_,i)=>`<div>${String(i+7).padStart(2,'0')}:00</div>`).join('');
      const columns=days.map(d=>{
        const key=localDateKey(d),items=events.filter(x=>x.date===key).sort((a,b)=>a.sort-b.sort);
        return `<div class="calendar-day-column" data-date="${key}">${items.map(ev=>{
          const overlaps=Boolean(ev.maCa&&items.some(x=>x.kind!==ev.kind&&x.maCa===ev.maCa));
          return calendarEventMarkup(ev,options,false,overlaps);
        }).join('')}</div>`;
      }).join('');
      grid=`<div class="calendar-week" style="--calendar-hours:15"><div class="calendar-week-head"><div></div>${labels}</div><div class="calendar-time-grid"><div class="calendar-time-labels">${hourLabels}</div><div class="calendar-days-grid">${columns}</div></div></div>`;
    }else{
      const firstOfMonth=new Date(anchor.getFullYear(),anchor.getMonth(),1);
      const from=startOfWeek(firstOfMonth);
      const days=Array.from({length:42},(_,i)=>{const d=new Date(from);d.setDate(d.getDate()+i);return d;});
      label=anchor.toLocaleDateString('vi-VN',{month:'long',year:'numeric'});
      const headings=['T2','T3','T4','T5','T6','T7','CN'].map(d=>`<div class="calendar-month-heading">${d}</div>`).join('');
      const cells=days.map(d=>{
        const key=localDateKey(d),items=events.filter(x=>x.date===key).sort((a,b)=>a.sort-b.sort);
        const outside=d.getMonth()!==anchor.getMonth();
        return `<div class="calendar-month-day ${outside?'outside-month':''} ${key===today?'today':''}"><span class="calendar-date-number">${d.getDate()}</span><div class="calendar-month-events">${items.slice(0,4).map(ev=>calendarEventMarkup(ev,options,true,false)).join('')}${items.length>4?`<span class="calendar-more">+${items.length-4} ca khác</span>`:''}</div></div>`;
      }).join('');
      grid=`<div class="calendar-month-grid">${headings}${cells}</div>`;
    }
    return `<div class="calendar-toolbar"><div class="calendar-nav"><button type="button" class="calendar-nav-btn" data-calendar-step="-1" aria-label="Khoảng trước">‹</button><button type="button" class="btn calendar-today" data-calendar-today>Hôm nay</button><button type="button" class="calendar-nav-btn" data-calendar-step="1" aria-label="Khoảng sau">›</button><strong>${esc(label)}</strong></div><div class="calendar-mode"><button type="button" class="${mode==='week'?'active':''}" data-calendar-mode="week">Tuần</button><button type="button" class="${mode==='month'?'active':''}" data-calendar-mode="month">Tháng</button></div></div><div class="calendar-legend"><span><i class="legend-theory"></i>Ca lý thuyết</span><span><i class="legend-essay"></i>Ca tự luận</span><span><i class="legend-pending"></i>Báo bận chờ duyệt</span><span><i class="legend-approved"></i>Báo bận đã duyệt</span></div><div class="calendar-scroll">${grid}</div>`;
  }
  function renderCalendarInto(selector,options){
    const host=$(selector);
    if(!host)return;
    host.innerHTML=calendarWidgetMarkup(options);
    host.querySelectorAll('[data-calendar-step]').forEach(button=>button.onclick=()=>{
      const date=state.calendarDate?dateFromKey(state.calendarDate):new Date();
      if(state.calendarMode==='month'){date.setDate(1);date.setMonth(date.getMonth()+Number(button.dataset.calendarStep));}
      else date.setDate(date.getDate()+7*Number(button.dataset.calendarStep));
      state.calendarDate=localDateKey(date);
      renderCalendarInto(selector,options);
    });
    host.querySelector('[data-calendar-today]')?.addEventListener('click',()=>{
      state.calendarDate=localDateKey(new Date());
      renderCalendarInto(selector,options);
    });
    host.querySelectorAll('[data-calendar-mode]').forEach(button=>button.onclick=()=>{
      state.calendarMode=button.dataset.calendarMode;
      renderCalendarInto(selector,options);
    });
    if(options.onSelect)host.querySelectorAll('[data-calendar-select]:not(:disabled)').forEach(button=>button.onclick=()=>options.onSelect(button.dataset.calendarSelect));
  }

  // =====================================================================
  // GIAO DIỆN BÁO BẬN / ĐIỀU CHỈNH LỊCH CHO GIẢNG VIÊN (PHƯƠNG ÁN B)
  // =====================================================================
  function busyPage(){
    const list = state.busyRequests || [];
    // Danh sách ca thi đang phân công của GV để chọn
    const activePendingSlots = new Set(list.filter(x=>x.TrangThai==='PENDING'&&x.MaCa).map(x=>String(x.MaCa)));

    shell(`
      <div class="crumb">Trang chủ / Báo bận và Điều chỉnh lịch</div>
      <header class="ph">
        <div>
          <h1>Báo bận / Yêu cầu điều chỉnh lịch coi thi</h1>
      <p>Chọn ca, nhập lý do và mời người nhận thay. Đơn tới Admin sau khi họ đồng ý; theo dõi hoặc rút đơn tại “Yêu cầu thay ca”.</p>
        </div>
        <div class="ph-r">
          <button class="btn pri" id="refreshBusy">${IC.refresh} Làm mới dữ liệu</button>
        </div>
      </header>

      <div class="panel lecturer-calendar-panel busy-calendar-panel">
        <h2>Lịch gác thi và báo bận</h2>
        <p class="sub">Lý thuyết màu trắng, tự luận màu xanh lá. Ca đang chờ xử lý sẽ bị khóa.</p>
        <div id="busyCalendar"></div>
      </div>

      <div class="u-grid">
        <form class="panel" id="busyForm">
          <h2>Gửi yêu cầu báo bận mới</h2>
          <p class="sub">Chọn ca, điền thông tin và mời giảng viên thay.</p>
          <label class="f busy-selected-field"><span>Ca gác thi đã chọn</span><input type="hidden" id="busyCa"><b id="busySelectedLabel">Chưa chọn ca trên lịch</b></label>

          <label class="f" style="margin-top:12px">
            <span>2. Giảng viên được nhờ coi thay <b style="color:var(--bad)" id="busyNomineeRequired">*</b></span>
            <div class="searchable-picker" id="busyNomineePicker">
              <input type="search" id="busyNomineeSearch" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded="false" aria-controls="busyNomineeOptions" autocomplete="off" placeholder="Chọn hoặc tìm giảng viên đủ điều kiện" disabled>
              <div class="searchable-options" id="busyNomineeOptions" role="listbox" hidden></div>
            </div>
            <input type="hidden" id="busyNominee">
            <small class="hint" id="busyNomineeHint" style="display:block;margin-top:5px">Chọn ca để xem người đủ điều kiện.</small>
          </label>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
            <label class="f">
              <span>3. Thời gian bắt đầu bận <b style="color:var(--bad)">*</b></span>
              <input type="datetime-local" id="busyStart" required>
            </label>
            <label class="f">
              <span>4. Thời gian kết thúc bận <b style="color:var(--bad)">*</b></span>
              <input type="datetime-local" id="busyEnd" required>
            </label>
          </div>

          <label class="f" style="margin-top:8px">
            <span>5. Lý do báo bận <b style="color:var(--bad)">*</b></span>
            <select id="busyReasonSelect">
              <option value="">-- Chọn lý do thường gặp hoặc tự nhập bên dưới --</option>
              <option value="Đi công tác, họp theo quyết định của Trường">Đi công tác, họp theo quyết định của Trường</option>
              <option value="Bận việc gia đình (Hiếu, hỷ)">Bận việc gia đình (Hiếu, hỷ)</option>
              <option value="Sự cố sức khỏe / Bận việc khẩn cấp đột xuất">Sự cố sức khỏe / Bận việc khẩn cấp đột xuất</option>
              <option value="Trùng lịch hội nghị, bảo vệ luận văn / khóa luận">Trùng lịch hội nghị, bảo vệ luận văn / khóa luận</option>
              <option value="Lý do cá nhân đột xuất khác">Lý do cá nhân đột xuất khác</option>
            </select>
          </label>
          <input type="text" id="busyReasonCustom" placeholder="Hoặc nhập lý do chi tiết..." required style="margin-top:6px">

          <label class="f" style="margin-top:8px">
            <span>6. Ghi chú cho Admin và người được nhờ <small>(không bắt buộc)</small></span>
            <textarea id="busyNote" rows="2" maxlength="500" placeholder="Thông tin chi tiết hỗ trợ Admin sắp xếp phương án thay thế..."></textarea>
          </label>

          <div class="err" id="busyErr" role="alert"></div>
          <button class="btn pri" type="submit" id="btnSubmitBusy" style="margin-top:12px">
            ${IC.send} Gửi yêu cầu coi thay
          </button>
        </form>

        <aside class="panel u-prev" aria-label="Tóm tắt yêu cầu">
          <h2>Tóm tắt yêu cầu</h2>
          <div class="box">
            <small>Ca coi thi liên quan</small>
            <b id="pvBusyShift">Chưa chọn ca</b>
          </div>
          <div class="box" style="margin-top:10px">
            <small>Khoảng thời gian bận</small>
            <b id="pvBusyTime">Chưa chọn thời gian</b>
          </div>
          <div class="box" style="margin-top:10px">
            <small>Lý do</small>
            <b id="pvBusyReason">Chưa nhập lý do</b>
          </div>
          <div class="box" style="margin-top:10px">
            <small>Giảng viên được nhờ</small>
            <b id="pvBusyNominee">Chưa chọn giảng viên</b>
          </div>
          <p class="hint" style="margin-top:14px">
            Người nhận đồng ý trước; Admin duyệt mới đổi lịch.
          </p>
        </aside>
      </div>

    `);

    const form = $('#busyForm');
    const nomineeSelect=$('#busyNominee');
    const nomineeSearch=$('#busyNomineeSearch');
    const nomineePicker=$('#busyNomineePicker');
    const nomineeOptions=$('#busyNomineeOptions');
    let coverCandidates=[],coverCandidatesLoading=false,coverCandidatesRequest=0;
    let visibleCoverCandidates=[],activeNomineeIndex=-1;
    const updatePreview = () => {
      const selected = state.schedule.find(x=>String(x.MaCa)===String(state.selectedBusyCa||''));
      if (selected && selected.MaCa) {
        $('#pvBusyShift').textContent = `${selected.Thu||''}, ${fmt(selected.NgayThi)} · tiết ${selected.TuTiet}–${selected.DenTiet} (${selected.MaCa})`;
      } else {
        $('#pvBusyShift').textContent = 'Chưa chọn ca thi';
      }

      const st = $('#busyStart').value;
      const en = $('#busyEnd').value;
      if (st && en) {
        $('#pvBusyTime').textContent = `${st.replace('T', ' ')} → ${en.replace('T', ' ')}`;
      } else {
        $('#pvBusyTime').textContent = 'Chưa chọn đủ thời gian';
      }

      const r = $('#busyReasonCustom').value.trim() || $('#busyReasonSelect').value;
      $('#pvBusyReason').textContent = r || 'Chưa nhập lý do';
      const nominee=coverCandidates.find(x=>String(x.MaGV)===String(nomineeSelect.value));
      $('#pvBusyNominee').textContent=nominee?`${nominee.HoTen} (${nominee.MaGV})`:'Chưa chọn giảng viên';
    };

    const searchKey=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLocaleLowerCase();
    const nomineeLabel=x=>`${x.HoTen} (${x.MaGV}) · ${x.TenBoMon||''}`;
    const closeNomineeOptions=()=>{
      nomineeOptions.hidden=true;nomineeSearch.setAttribute('aria-expanded','false');
      nomineeSearch.removeAttribute('aria-activedescendant');activeNomineeIndex=-1;
    };
    const renderNomineeOptions=()=>{
      const selected=coverCandidates.find(x=>String(x.MaGV)===String(nomineeSelect.value));
      const typed=nomineeSearch.value.trim();
      const query=searchKey(selected&&typed===nomineeLabel(selected)?'':typed);
      visibleCoverCandidates=coverCandidates.filter(x=>searchKey(`${x.HoTen||''} ${x.MaGV||''} ${x.TenBoMon||''}`).includes(query));
      activeNomineeIndex=-1;
      nomineeOptions.innerHTML=visibleCoverCandidates.length
        ?visibleCoverCandidates.map((x,i)=>`<button type="button" id="busyNomineeOption${i}" class="searchable-option" role="option" aria-selected="${String(x.MaGV)===String(nomineeSelect.value)}" data-nominee="${esc(x.MaGV)}">${esc(nomineeLabel(x))}</button>`).join('')
        :'<div class="searchable-empty">Không tìm thấy giảng viên phù hợp.</div>';
      $('#busyNomineeHint').textContent=visibleCoverCandidates.length
        ?'Chỉ hiện người đủ điều kiện. Đơn tới Admin sau khi họ đồng ý.'
        :'Không tìm thấy tên phù hợp. Thử từ khóa khác.';
    };
    const openNomineeOptions=()=>{
      if(nomineeSearch.disabled||!coverCandidates.length)return;
      renderNomineeOptions();nomineeOptions.hidden=false;nomineeSearch.setAttribute('aria-expanded','true');
    };
    const chooseNominee=maGV=>{
      const selected=coverCandidates.find(x=>String(x.MaGV)===String(maGV));
      if(!selected)return;
      nomineeSelect.value=String(selected.MaGV);nomineeSearch.value=nomineeLabel(selected);
      $('#busyNomineeHint').textContent='Chỉ hiện người đủ điều kiện. Đơn tới Admin sau khi họ đồng ý.';
      closeNomineeOptions();updatePreview();
    };
    const setActiveNominee=index=>{
      const options=nomineeOptions.querySelectorAll('[role="option"]');
      if(!options.length)return;
      activeNomineeIndex=Math.max(0,Math.min(index,options.length-1));
      options.forEach((option,i)=>option.classList.toggle('active',i===activeNomineeIndex));
      const active=options[activeNomineeIndex];
      nomineeSearch.setAttribute('aria-activedescendant',active.id);active.scrollIntoView({block:'nearest'});
    };
    nomineeSearch.onfocus=()=>{if(nomineeSelect.value)nomineeSearch.select();openNomineeOptions()};
    nomineeSearch.oninput=()=>{nomineeSelect.value='';openNomineeOptions();updatePreview()};
    nomineeSearch.onkeydown=e=>{
      if(e.key==='ArrowDown'||e.key==='ArrowUp'){
        e.preventDefault();if(nomineeOptions.hidden)openNomineeOptions();
        setActiveNominee(activeNomineeIndex+(e.key==='ArrowDown'?1:-1));
      }else if(e.key==='Enter'&&!nomineeOptions.hidden){
        e.preventDefault();
        const index=activeNomineeIndex>=0?activeNomineeIndex:visibleCoverCandidates.length===1?0:-1;
        if(index>=0)chooseNominee(visibleCoverCandidates[index].MaGV);
      }else if(e.key==='Escape'&&!nomineeOptions.hidden){e.preventDefault();closeNomineeOptions()}
    };
    nomineeOptions.addEventListener('mousedown',e=>{if(e.target.closest('[data-nominee]'))e.preventDefault()});
    nomineeOptions.addEventListener('click',e=>{const option=e.target.closest('[data-nominee]');if(option)chooseNominee(option.dataset.nominee)});
    nomineePicker.addEventListener('focusout',()=>setTimeout(()=>{if(!nomineePicker.contains(document.activeElement))closeNomineeOptions()},0));

    const loadCoverCandidates=async maCa=>{
      const requestId=++coverCandidatesRequest;
      coverCandidates=[];visibleCoverCandidates=[];coverCandidatesLoading=!!maCa;nomineeSelect.value='';
      nomineeSearch.value='';nomineeSearch.disabled=true;
      nomineeSearch.placeholder=maCa?'Đang kiểm tra giảng viên phù hợp…':'Chọn ca trên lịch trước';
      nomineeOptions.innerHTML='';closeNomineeOptions();
      $('#busyNomineeRequired').hidden=true;
      $('#busyNomineeHint').textContent=maCa?'Đang kiểm tra lịch và định mức…':'Chọn ca để xem người đủ điều kiện.';
      updatePreview();
      if(!maCa)return;
      try{
        const response=await req('/user/busy-cover-candidates?ma_ca='+encodeURIComponent(maCa));
        if(requestId!==coverCandidatesRequest)return;
        coverCandidates=response.candidates||[];coverCandidatesLoading=false;
        if(coverCandidates.length){
          nomineeSearch.disabled=false;nomineeSearch.placeholder='Chọn hoặc tìm giảng viên đủ điều kiện';$('#busyNomineeRequired').hidden=false;
          renderNomineeOptions();
        }else{
          nomineeSearch.placeholder='Chưa có giảng viên đủ điều kiện';
          $('#busyNomineeHint').textContent='Chưa có người phù hợp. Bạn có thể chọn người thay sau.';
        }
        updatePreview();
      }catch(error){
        if(requestId!==coverCandidatesRequest)return;
        coverCandidatesLoading=false;
        nomineeSearch.placeholder='Không tải được danh sách giảng viên';
        $('#busyNomineeHint').textContent='Không tải được danh sách. Bạn có thể chọn người thay sau.';
        updatePreview();
      }
    };

    const calendarOptions={
      duties:state.schedule,
      busyRequests:list,
      selectable:true,
      selectedCa:state.selectedBusyCa,
      disabledCas:activePendingSlots,
      onSelect:maCa=>{
        const selected=state.schedule.find(x=>String(x.MaCa)===String(maCa));
        if(!selected)return;
        state.selectedBusyCa=String(selected.MaCa);
        const start=`${String(selected.NgayThi).slice(0,10)}T${tietToTime(selected.TuTiet,false)}`;
        const end=`${String(selected.NgayThi).slice(0,10)}T${tietToTime(selected.DenTiet,true)}`;
        $('#busyCa').value=state.selectedBusyCa;
        $('#busySelectedLabel').textContent=`${selected.Thu||''}, ${fmt(selected.NgayThi)} · Tiết ${selected.TuTiet}–${selected.DenTiet} (${selected.MaCa})`;
        $('#busyStart').value=start;
        $('#busyEnd').value=end;
        loadCoverCandidates(state.selectedBusyCa);
        updatePreview();
        calendarOptions.selectedCa=state.selectedBusyCa;
        renderCalendarInto('#busyCalendar',calendarOptions);
      }
    };
    renderCalendarInto('#busyCalendar',calendarOptions);

    if(state.selectedBusyCa){
      const previous=state.schedule.find(x=>String(x.MaCa)===String(state.selectedBusyCa));
      if(previous&&!activePendingSlots.has(String(previous.MaCa))){
        $('#busyCa').value=String(previous.MaCa);
        $('#busySelectedLabel').textContent=`${previous.Thu||''}, ${fmt(previous.NgayThi)} · Tiết ${previous.TuTiet}–${previous.DenTiet} (${previous.MaCa})`;
        $('#busyStart').value=`${String(previous.NgayThi).slice(0,10)}T${tietToTime(previous.TuTiet,false)}`;
        $('#busyEnd').value=`${String(previous.NgayThi).slice(0,10)}T${tietToTime(previous.DenTiet,true)}`;
        loadCoverCandidates(String(previous.MaCa));
      }else state.selectedBusyCa=null;
    }
    updatePreview();

    $('#busyReasonSelect').onchange = e => {
      if (e.target.value) {
        $('#busyReasonCustom').value = e.target.value;
      }
      updatePreview();
    };

    $('#busyStart').oninput = updatePreview;
    $('#busyEnd').oninput = updatePreview;
    $('#busyReasonCustom').oninput = updatePreview;
    nomineeSearch.onchange=updatePreview;

    // Gửi form báo bận
    form.onsubmit = async e => {
      e.preventDefault();
      const errEl = $('#busyErr');
      errEl.textContent = '';

      const maCa = state.selectedBusyCa;
      const st = $('#busyStart').value;
      const en = $('#busyEnd').value;
      const reason = $('#busyReasonCustom').value.trim();
      const note = $('#busyNote').value.trim();
      const nominee = nomineeSelect.value.trim() || null;

      if (!st || !en) {
        errEl.textContent = 'Vui lòng chọn thời gian bắt đầu và kết thúc bận.';
        return;
      }
      if (!maCa) {
        errEl.textContent = 'Vui lòng chọn ca thi cụ thể cần người coi thay.';
        return;
      }
      if (new Date(st) >= new Date(en)) {
        errEl.textContent = 'Thời gian bắt đầu bận phải trước thời gian kết thúc bận.';
        return;
      }
      if (!reason) {
        errEl.textContent = 'Vui lòng nhập lý do báo bận.';
        return;
      }
      if(coverCandidatesLoading){errEl.textContent='Đang tải danh sách giảng viên phù hợp. Vui lòng chờ một chút.';return}
      if(coverCandidates.length&&!nominee){errEl.textContent='Vui lòng chọn giảng viên được nhờ coi thay.';nomineeSearch.focus();openNomineeOptions();return}

      const btn = $('#btnSubmitBusy');
      btn.disabled = true;
      btn.textContent = 'Đang gửi đơn và lời mời...';

      try {
        const saved = await req('/user/busy-requests', {
          method: 'POST',
          body: JSON.stringify({
            ma_ca: maCa || null,
            thoi_gian_bat_dau: st,
            thoi_gian_ket_thuc: en,
            ly_do: reason,
            ghi_chu: note || null,
            ma_gv_thay_the: nominee
          })
        });
        state.selectedBusyCa=null;
        toast(saved.message||'Đã gửi đơn báo bận.');
        await renderPage();
      } catch (err) {
        errEl.textContent = err.message;
        btn.disabled = false;
        btn.innerHTML = `${IC.send} Gửi yêu cầu coi thay`;
      }
    };

    $('#refreshBusy').onclick = renderPage;
  }

  async function openBusyRequestDetail(id){
    try{
      const d=await req('/user/busy-requests/'+encodeURIComponent(id));
      const statusMap={PENDING:d.MaGVThayTheDeNghi?(d.TrangThaiXacNhanThayThe==='ACCEPTED'?['Chờ Admin duyệt','warn']:d.TrangThaiXacNhanThayThe==='DECLINED'?['Người được nhờ từ chối','bad']:['Chờ người được nhờ đồng ý','warn']):['Chờ chọn người coi thay','warn'],APPROVED:['Đã chấp nhận','ok'],REJECTED:['Đã từ chối','bad'],WITHDRAWN:['Đã rút đơn','']};
      const st=statusMap[d.TrangThai]||[d.TrangThai,''];
      const nomineeStatus=d.TrangThaiXacNhanThayThe==='ACCEPTED'?'Người được nhờ đã đồng ý; đơn chờ Admin duyệt.':d.TrangThaiXacNhanThayThe==='DECLINED'?'Người được nhờ từ chối; hãy chọn người khác.':d.TrangThaiXacNhanThayThe==='WITHDRAWN'?'Lời mời đã được thu hồi.':'Đang chờ người được nhờ phản hồi.';
      const result=d.TrangThai==='WITHDRAWN'?'Người gửi đã rút đơn. Lịch coi thi được giữ nguyên.':d.TrangThai==='PENDING'?nomineeStatus:d.TrangThai==='APPROVED'?`Đã điều chỉnh lịch. Giảng viên thay thế: ${d.TenGVThayThe||d.MaGVThayThe||'đã phân công lại'}.`:d.TrangThai==='REJECTED'?`Lịch được giữ nguyên. Lý do Admin từ chối: ${d.LyDoTuChoi||'Không nêu'}.`:'';
      const history=(d.history||[]).map(h=>`<div style="font-size:13px;margin-top:6px;padding:6px 0;border-bottom:1px dashed var(--line)"><div><b>${esc(h.HanhDong||'Điều chỉnh')}</b> · ${esc(h.ThoiDiem||'')}</div><div>Trước: ${esc(h.PhanCongTruoc||'—')}</div><div>Sau: ${esc(h.PhanCongSau||'—')}</div><div>Người thực hiện: ${esc(h.NguoiThucHien||'—')}</div>${h.LyDo?`<div>Ghi chú: ${esc(h.LyDo)}</div>`:''}</div>`).join('');
      openUserModal({title:`Chi tiết yêu cầu #${d.MaYeuCau}`,wide:true,body:`
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div><small class="muted">Trạng thái</small><br><span class="chip ${st[1]}">${esc(st[0])}</span></div><div><small class="muted">Thời gian gửi</small><br><b>${esc(d.ThoiGianGui?d.ThoiGianGui.replace('T',' '):'—')}</b></div></div>
        <div style="margin-top:12px"><small class="muted">Ca thi liên quan</small><br>${d.MaCa?`<b>${esc(d.MaCa)}</b> (${fmt(d.NgayThi)}, tiết ${d.TuTiet}–${d.DenTiet}, phòng ${esc(d.PhongThi||'—')})`:'Không gắn ca cụ thể'}</div>
        <div style="margin-top:12px"><small class="muted">Thời gian bận</small><br><b>${esc(d.ThoiGianBatDauBan?d.ThoiGianBatDauBan.replace('T',' '):'')}</b> đến <b>${esc(d.ThoiGianKetThucBan?d.ThoiGianKetThucBan.replace('T',' '):'')}</b></div>
        <div style="margin-top:12px"><small class="muted">Lý do báo bận</small><br><b>${esc(d.LyDoBaoBan||'—')}</b></div>
        ${d.MaGVThayTheDeNghi?`<div style="margin-top:12px"><small class="muted">Giảng viên được nhờ</small><br><b>${esc(d.TenGVThayTheDeNghi||d.MaGVThayTheDeNghi)}</b> (${esc(d.MaGVThayTheDeNghi)}) · ${esc(nomineeStatus)}</div>`:''}
        ${d.GhiChuGV?`<div style="margin-top:12px"><small class="muted">Ghi chú</small><br>${esc(d.GhiChuGV)}</div>`:''}
        ${result?`<div class="panel" style="margin-top:14px;background:var(--sub)"><b>Kết quả</b><br>${esc(result)}${d.LyDoTuChoi?`<br>Lý do: ${esc(d.LyDoTuChoi)}`:''}${d.NguoiXuLy?`<br>Người xử lý: ${esc(d.NguoiXuLy)}`:''}${d.ThoiGianXuLy?` · ${esc(d.ThoiGianXuLy.replace('T',' '))}`:''}</div>`:''}
        ${history?`<div class="panel" style="margin-top:12px"><b>Lịch sử điều chỉnh lịch coi thi</b>${history}</div>`:''}`,
        foot:'<button class="btn" id="closeBusyDetail">Đóng</button>'});
      $('#closeBusyDetail').onclick=closeUserModal;
    }catch(e){toast(e.message)}
  }

  function swapsPage(){
    const list=state.busyRequests||[];
    const pendingCount=list.filter(x=>x.TrangThai==='PENDING').length;
    const approvedCount=list.filter(x=>x.TrangThai==='APPROVED').length;
    const rejectedCount=list.filter(x=>x.TrangThai==='REJECTED').length;
    const withdrawnCount=list.filter(x=>x.TrangThai==='WITHDRAWN').length;
    const reqStatusMap={'APPROVED':['Đã chấp nhận','ok'],'REJECTED':['Đã từ chối','bad'],'WITHDRAWN':['Đã rút đơn','']};
    const rows=list.map(x=>{
      const st=x.TrangThai==='PENDING'
        ? (x.MaGVThayTheDeNghi?(x.TrangThaiXacNhanThayThe==='ACCEPTED'?['Chờ Admin duyệt','warn']:x.TrangThaiXacNhanThayThe==='DECLINED'?['Người được nhờ từ chối','bad']:['Chờ người được nhờ đồng ý','warn']):x.MaCa?['Chờ chọn người coi thay','warn']:['Thiếu ca cụ thể','bad'])
        : (reqStatusMap[x.TrangThai]||[x.TrangThai,'']);
      const caInfo=x.MaCa?`<b>Ca: ${esc(x.MaCa)}</b><br><span class="hint" style="margin:0">${fmt(x.NgayThi)} · Tiết ${x.TuTiet}–${x.DenTiet}</span>`:'<span class="muted">Không gắn ca cụ thể</span>';
      const timeRange=`${esc(x.ThoiGianBatDauBan?x.ThoiGianBatDauBan.replace('T',' '):'')}<br>đến ${esc(x.ThoiGianKetThucBan?x.ThoiGianKetThucBan.replace('T',' '):'')}`;
      let outcome='<span class="muted">—</span>';
      if(x.TrangThai==='PENDING'&&x.MaGVThayTheDeNghi){
        const response=x.TrangThaiXacNhanThayThe==='ACCEPTED'?'Đã đồng ý · chờ Admin duyệt':x.TrangThaiXacNhanThayThe==='DECLINED'?'Đã từ chối · cần chọn người khác':'Đang chờ phản hồi';
        outcome=`<b>${esc(x.TenGVThayTheDeNghi||x.MaGVThayTheDeNghi)}</b><br><span class="hint" style="margin:0">${response}</span>`;
      }else if(x.TrangThai==='APPROVED'){
        outcome=`<span style="color:var(--ok);font-weight:600">Đã điều chỉnh lịch</span><br><span class="hint" style="margin:0">GV thay thế: ${esc(x.TenGVThayThe||x.MaGVThayThe||'Đã phân công lại')}</span>`;
      }else if(x.TrangThai==='REJECTED'){
        outcome=`<span style="color:var(--bad);font-weight:500">Giữ nguyên lịch</span><br><span class="hint" style="margin:0">Lý do: ${esc(x.LyDoTuChoi||'Không nêu')}</span>`;
      }else if(x.TrangThai==='WITHDRAWN'){
        outcome='<span class="muted">Lịch được giữ nguyên</span>';
      }
      const canChooseReplacement=!x.MaGVThayTheDeNghi||['PENDING','DECLINED','ACCEPTED'].includes(x.TrangThaiXacNhanThayThe);
      const action=`<div class="request-actions">${x.TrangThai==='PENDING'&&canChooseReplacement&&x.MaCa?`<button class="btn sm pri" data-cover-request="${x.MaYeuCau}">${['PENDING','ACCEPTED'].includes(x.TrangThaiXacNhanThayThe)?'Đổi người được nhờ':x.MaGVThayTheDeNghi?'Chọn người khác':'Chọn người coi thay'}</button>`:''}${x.TrangThai==='PENDING'&&Number(x.CoTheNhacThay)===1?`<button class="btn sm" data-remind-cover="${x.MaYeuCau}">Nhắc phản hồi</button>`:''}${x.TrangThai==='PENDING'?`<button class="btn sm danger" data-withdraw-busy="${x.MaYeuCau}">Rút đơn</button>`:''}<button class="btn sm" data-view-busy="${x.MaYeuCau}">Chi tiết</button></div>`;
      return `<tr><td><b>#${x.MaYeuCau}</b></td><td>${caInfo}</td><td><small>${timeRange}</small></td><td><b>${esc(x.LyDoBaoBan||'—')}</b>${x.GhiChuGV?`<br><span class="hint" style="margin:0">${esc(x.GhiChuGV)}</span>`:''}</td><td><span class="chip ${st[1]}">${esc(st[0])}</span></td><td><small>${esc(x.ThoiGianGui?x.ThoiGianGui.replace('T',' '):'')}</small></td><td>${outcome}</td><td>${action}</td></tr>`;
    }).join('');
    shell(`<div class="crumb">Trang chủ / Yêu cầu thay ca</div>
      <header class="ph"><div><h1>Yêu cầu thay ca coi thi</h1><p>Theo dõi đơn, lời mời và kết quả xử lý.</p></div><div class="ph-r"><button class="btn pri" id="refreshCover">${IC.refresh} Làm mới dữ liệu</button></div></header>
      <div class="stats"><div class="stat ic"><div class="si">${IC.clip}</div><div><b>${list.length}</b><span>Tổng yêu cầu</span></div></div><div class="stat ic hot"><div class="si">${IC.warn}</div><div><b>${pendingCount}</b><span>Đang chờ</span></div></div><div class="stat ic done"><div class="si">${IC.ok}</div><div><b>${approvedCount}</b><span>Đã chấp nhận</span></div></div><div class="stat ic rejected"><div class="si">${IC.bad}</div><div><b>${rejectedCount}</b><span>Đã từ chối</span></div></div><div class="stat ic"><div class="si">${IC.clip}</div><div><b>${withdrawnCount}</b><span>Đã rút</span></div></div></div>
      <div class="panel"><h2>Danh sách đơn báo bận và yêu cầu thay ca</h2><p class="sub">Đổi người, nhắc sau 24 giờ hoặc rút đơn trước khi Admin duyệt.</p><div class="tw"><table><thead><tr><th>Mã YC</th><th>Ca thi liên quan</th><th>Thời gian bận</th><th>Lý do và Ghi chú</th><th>Trạng thái</th><th>Thời gian gửi</th><th>Người được nhờ / Kết quả</th><th>Thao tác</th></tr></thead><tbody>${rows||'<tr><td colspan="8" class="empty">Chưa có đơn báo bận. Tạo đơn tại mục “Báo bận / Điều chỉnh”.</td></tr>'}</tbody></table></div></div>`);
    $('#refreshCover').onclick=renderPage;
    document.querySelectorAll('[data-cover-request]').forEach(b=>b.onclick=()=>openCoverChooser(b.dataset.coverRequest));
    document.querySelectorAll('[data-withdraw-busy]').forEach(b=>b.onclick=async()=>{
      const id=b.dataset.withdrawBusy;
      if(!confirm(`Rút đơn báo bận #${id}? Lịch coi thi sẽ được giữ nguyên và lời mời coi thay sẽ bị thu hồi.`))return;
      b.disabled=true;
      try{const result=await req(`/user/busy-requests/${encodeURIComponent(id)}/withdraw`,{method:'POST'});toast(result.message||'Đã rút đơn báo bận.');await renderPage()}
      catch(e){toast(e.status===404?'Không tìm thấy API rút đơn. Hãy khởi động lại backend rồi tải lại trang.':e.message);b.disabled=false}
    });
    document.querySelectorAll('[data-remind-cover]').forEach(b=>b.onclick=async()=>{
      const id=b.dataset.remindCover;b.disabled=true;
      try{const result=await req(`/user/busy-requests/${encodeURIComponent(id)}/remind-cover`,{method:'POST'});toast(result.message||'Đã gửi lời nhắc.');await renderPage()}
      catch(e){toast(e.message);b.disabled=false}
    });
    document.querySelectorAll('[data-view-busy]').forEach(b=>b.onclick=()=>openBusyRequestDetail(b.dataset.viewBusy));
    const autoId=state.pendingCoverId;
    state.pendingCoverId=null;
    if(autoId) openCoverChooser(autoId);
  }

  async function openCoverChooser(requestId){
    openUserModal({title:'Đang kiểm tra giảng viên phù hợp…',body:'<p class="muted">Đang kiểm tra lịch và định mức.</p>',foot:'<button class="btn" id="cancelCoverLoad">Đóng</button>'});
    $('#cancelCoverLoad').onclick=closeUserModal;
    try{
      const [d,r]=await Promise.all([
        req('/user/busy-requests/'+encodeURIComponent(requestId)),
        req('/user/busy-requests/'+encodeURIComponent(requestId)+'/candidates')
      ]);
      const candidates=r.candidates||[];
      const radios=candidates.map((g,i)=>`<label class="u-opt" data-q="${esc((g.HoTen+' '+g.MaGV+' '+g.TenBoMon).toLowerCase())}" style="margin-bottom:8px">
        <input type="radio" name="coverLecturer" value="${esc(g.MaGV)}" data-name="${esc(g.HoTen)}" ${i===0?'checked':''}>
        <div><b>${esc(g.HoTen)} (${esc(g.MaGV)})</b><span>${esc(g.TenBoMon||'')} · ${g.DaCo}/${g.DinhMuc} ca hiện tại</span></div>
      </label>`).join('');
      const date=d.NgayThi?fmt(d.NgayThi):'';
      const replacingCurrentNominee=!!d.MaGVThayTheDeNghi&&['PENDING','ACCEPTED'].includes(d.TrangThaiXacNhanThayThe);
      const replacingAccepted=d.TrangThaiXacNhanThayThe==='ACCEPTED';
      openUserModal({
        title:`${replacingCurrentNominee?'Đổi người được nhờ':'Chọn người coi thay'} cho đơn #${d.MaYeuCau}`,
        wide:true,
        body:`<div class="panel" style="background:var(--sub);margin-bottom:12px"><b>Ca cần thay:</b><br>${esc(d.MaCa)} · ${date} · tiết ${d.TuTiet}–${d.DenTiet}<br><b>Lý do:</b> ${esc(d.LyDoBaoBan)}</div>
          ${replacingCurrentNominee?`<p class="hint">${replacingAccepted?'Người hiện tại đã đồng ý.':'Người hiện tại chưa phản hồi.'} Chọn người khác để thu hồi lời mời cũ; người mới phải đồng ý trước khi đơn tới Admin.</p>`:''}
          <p class="sub">Chỉ hiện người đủ điều kiện; Admin kiểm tra lại trước khi duyệt.</p>
          ${candidates.length?`<input type="search" id="coverSearch" placeholder="Tìm trong danh sách đủ điều kiện" style="width:100%;margin-bottom:8px"><div id="coverCandidates" style="max-height:300px;overflow:auto">${radios}</div>`:'<div class="panel"><p class="muted">Hiện không có giảng viên nào đủ điều kiện nhận ca này.</p></div>'}
          <div class="err" id="coverErr" role="alert"></div>`,
        foot:`<button class="btn" id="cancelCover">Hủy</button><button class="btn pri" id="sendCover" ${candidates.length?'':'disabled'}>${IC.send} ${replacingCurrentNominee?'Gửi lời mời mới':'Gửi yêu cầu nhờ coi thay'}</button>`
      });
      $('#cancelCover').onclick=closeUserModal;
      const search=$('#coverSearch');
      if(search)search.oninput=e=>{const q=e.target.value.trim().toLowerCase();document.querySelectorAll('#coverCandidates [data-q]').forEach(el=>el.hidden=q&&!el.dataset.q.includes(q))};
      $('#sendCover').onclick=async()=>{
        const selected=document.querySelector('input[name="coverLecturer"]:checked');
        const err=$('#coverErr'),btn=$('#sendCover');
        if(!selected){err.textContent='Chọn một giảng viên đủ điều kiện.';return}
        btn.disabled=true;btn.textContent='Đang gửi…';
        try{
          const sent=await req('/user/busy-requests/'+encodeURIComponent(requestId)+'/request-cover',{method:'POST',body:JSON.stringify({ma_gv_thay_the:selected.value})});
          closeUserModal();
          toast(sent.message||'Đã gửi yêu cầu coi thay.');
          await renderPage();
        }catch(e){err.textContent=e.message;btn.disabled=false;btn.innerHTML=IC.send+(replacingCurrentNominee?' Gửi lời mời mới':' Gửi yêu cầu nhờ coi thay')}
      };
    }catch(e){
      openUserModal({title:'Không tải được danh sách giảng viên',body:`<p class="err">${esc(e.message)}</p>`,foot:'<button class="btn" id="closeCoverError">Đóng</button>'});
      $('#closeCoverError').onclick=closeUserModal;
    }
  }

  function notificationDetails(x){
    const text=String(x.NoiDung||'').trim();
    const cover=text.match(/^Giảng viên (.+?) \(([^)]+)\) đã nhờ bạn coi thay ca (.+?) ngày (.+?), tiết (.+?) theo đơn báo bận #(.+?)\.(.*)$/);
    if(cover){
      let tail=cover[7].trim();
      tail=tail.replace(/\s*(?:Yêu cầu đang chờ Admin duyệt|Vui lòng chọn đồng ý hoặc từ chối lời mời\. Đơn chỉ được chuyển Admin sau khi bạn đồng ý); lịch chưa thay đổi\.?\s*$/,'');
      let note='';
      const noteMatch=tail.match(/\.?\s*Ghi chú của người gửi:\s*([\s\S]*)$/);
      if(noteMatch){note=noteMatch[1].trim();tail=tail.slice(0,noteMatch.index).trim()}
      const reason=tail.replace(/^Lý do:\s*/,'').replace(/[.\s]+$/,'');
      return `<div class="notice-facts">
        <div class="notice-fact"><span>Người nhờ</span><b>${esc(cover[1])} <small>(${esc(cover[2])})</small></b></div>
        <div class="notice-fact"><span>Ca thi</span><b>${esc(cover[3])}</b></div>
        <div class="notice-fact"><span>Ngày thi</span><b>${esc(cover[4])}</b></div>
        <div class="notice-fact"><span>Tiết</span><b>${esc(cover[5])}</b></div>
        <div class="notice-fact"><span>Mã đơn</span><b>#${esc(cover[6])}</b></div>
        <div class="notice-fact notice-status"><span>Trạng thái</span><b>${x.TrangThaiPhanHoiThayThe==='ACCEPTED'?'Bạn đã đồng ý · Chờ Admin duyệt':x.TrangThaiPhanHoiThayThe==='DECLINED'?'Bạn đã từ chối lời mời':x.TrangThaiPhanHoiThayThe==='WITHDRAWN'?'Người gửi đã rút đơn':x.TrangThaiPhanHoiThayThe==='SUPERSEDED'?'Lời mời đã được chuyển cho giảng viên khác':'Chờ bạn phản hồi · Lịch chưa thay đổi'}</b></div>
      </div>
      <div class="notice-long"><span>Lý do</span><p>${esc(reason||'Không có thông tin')}</p></div>
      ${note?`<div class="notice-long"><span>Ghi chú của người gửi</span><p>${esc(note)}</p></div>`:''}`;
    }
    const paragraphs=text.split(/(?<=\.)\s+/).filter(Boolean);
    return `<div class="notice-message">${(paragraphs.length?paragraphs:[text||'Không có nội dung']).map(p=>`<p>${esc(p)}</p>`).join('')}</div>`;
  }

  function noticesPage(){
    const n=state.notices,unread=n.filter(x=>!isNoticeRead(x)).length;
    const cards=n.map(x=>{
      const isUnread=!isNoticeRead(x);
      const created=x.TaoLuc?new Date(x.TaoLuc).toLocaleString('vi-VN'):'—';
      const rejected=String(x.Loai||'').toLowerCase().includes('reject');
      const responseButtons=x.Loai==='BusyCoverRequested'&&x.TrangThaiPhanHoiThayThe==='PENDING'
        ?`<button class="btn sm danger" data-cover-response="decline" data-notification-id="${esc(x.ID)}">Từ chối lời mời</button><button class="btn sm pri" data-cover-response="accept" data-notification-id="${esc(x.ID)}">✓ Đồng ý coi thay</button>`:'';
      const markReadButton=isUnread?`<button class="btn sm" data-read="${esc(x.ID)}">Đánh dấu đã đọc</button>`:'';
      const actions=responseButtons+markReadButton;
      return `<article class="notice-card ${isUnread?'unread':''}" data-notice-id="${esc(x.ID)}">
        <div class="notice-icon ${rejected?'rejected':''}">${rejected?IC.bad:IC.bell}</div>
        <div class="notice-content">
          <div class="notice-heading"><h3>${esc(x.TieuDe||'Thông báo')}</h3><span class="chip ${isUnread?'warn':'ok'}">${isUnread?'Chưa đọc':'Đã đọc'}</span></div>
          ${notificationDetails(x)}
          <div class="notice-created">${IC.cal}<span>${esc(created)}</span></div>
        </div>
        ${actions?`<div class="notice-actions">${actions}</div>`:''}
      </article>`;
    }).join('');
    shell(`<div class="crumb">Trang chủ / Thông báo</div><header class="ph"><div><h1>Thông báo</h1><p>Yêu cầu báo bận, nhận coi thay và kết quả xử lý.</p></div><div class="ph-r">${unread?'<button class="btn pri" id="readAll">Đánh dấu tất cả đã đọc</button>':''}</div></header><div class="panel notice-panel"><div class="notice-list">${cards||'<p class="muted">Chưa có thông báo.</p>'}</div></div>`);
    const mark=id=>req(`/user/notifications/${encodeURIComponent(state.user.ma_gv)}/${id}/read`,{method:'POST'});
    document.querySelectorAll('[data-read]').forEach(b=>b.onclick=async()=>{try{await mark(b.dataset.read);await renderPage()}catch(e){toast(e.message)}});
    document.querySelectorAll('[data-cover-response]').forEach(b=>b.onclick=()=>{
      const accept=b.dataset.coverResponse==='accept';
      const notice=n.find(item=>String(item.ID)===String(b.dataset.notificationId));
      if(!notice){toast('Không tìm thấy nội dung lời mời. Hãy tải lại trang.');return}
      const action=accept?'Đồng ý coi thay':'Từ chối lời mời';
      const note=accept
        ?'<p class="hint">Bạn xác nhận có thể nhận ca. Lịch chỉ thay đổi sau khi Admin xem nội dung và duyệt.</p>'
        :'<p class="hint">Người gửi sẽ được báo để chọn giảng viên khác. Lịch hiện tại chưa thay đổi.</p>';
      openUserModal({
        title:action,
        body:`${notificationDetails(notice)}${note}<div class="err" id="coverResponseError" role="alert"></div>`,
        foot:`<button class="btn" id="cancelCoverResponse">Quay lại</button><button class="btn ${accept?'pri':'danger'}" id="confirmCoverResponse">${accept?'Xác nhận đồng ý':'Xác nhận từ chối'}</button>`
      });
      $('#cancelCoverResponse').onclick=closeUserModal;
      $('#confirmCoverResponse').onclick=async()=>{
        const confirmButton=$('#confirmCoverResponse'),error=$('#coverResponseError');
        confirmButton.disabled=true;confirmButton.textContent='Đang gửi phản hồi…';
        try{
          const result=await req(`/user/busy-requests/${encodeURIComponent(notice.YeuCauBaoBanID)}/respond-cover`,{method:'POST',body:JSON.stringify({chap_nhan:accept})});
          closeUserModal();toast(result.message||'Đã ghi nhận phản hồi.');await renderPage();
        }catch(e){error.textContent=e.message;confirmButton.disabled=false;confirmButton.textContent=accept?'Xác nhận đồng ý':'Xác nhận từ chối'}
      };
    });
    const all=$('#readAll');if(all)all.onclick=async()=>{try{await Promise.all(n.filter(x=>!isNoticeRead(x)).map(x=>mark(x.ID)));await renderPage()}catch(e){toast(e.message)}};
  }

  function initializeLecturerApp(){
    if(sessionStorage.getItem('authRole')!=='user'){location.replace('login.html');return;}
    try {
      const saved=JSON.parse(sessionStorage.getItem('lecturerSession')||'null');
      if(!saved || !saved.ma_gv){location.replace('login.html');return;}
      state.user=saved;
      if(sessionStorage.getItem('mustChangePassword')==='1' || saved.must_change_password){passwordView(true);}
      else renderPage();
    } catch(e) { location.replace('login.html'); }
  }
  let scheduleRefreshTimer=null;
  function refreshScheduleWhenVisible(){
    if(!state.user||state.page!=='schedule'||document.visibilityState!=='visible')return;
    clearTimeout(scheduleRefreshTimer);
    scheduleRefreshTimer=setTimeout(()=>{if(state.user&&state.page==='schedule')renderPage()},120);
  }
  // Admin and lecturer pages are often open in separate tabs. Re-read SQL when
  // assignments change in another tab, or when the lecturer returns to this tab.
  window.addEventListener('storage',event=>{
    if(event.key==='huit-schedule-data-change'&&event.newValue)refreshScheduleWhenVisible();
  });
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible')refreshScheduleWhenVisible();
  });
  if(document.readyState==='loading') window.addEventListener('DOMContentLoaded',initializeLecturerApp,{once:true});
  else initializeLecturerApp();
})();
