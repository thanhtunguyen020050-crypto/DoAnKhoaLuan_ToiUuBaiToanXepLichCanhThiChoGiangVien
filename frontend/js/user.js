(() => {
  const $ = s => document.querySelector(s);
  const base = window.API_BASE_URL || 'http://127.0.0.1:8000/api';
  const state = {user:null, page:'schedule', busyRequests:[], swaps:[], schedule:[], lecturers:[], notices:[], pendingCoverId:null, calendarDate:null, calendarMode:'week', selectedBusyCa:null};
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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
      r = await fetch(base+path,{...opts, headers});
    } catch (_) {
      throw new Error(`Không kết nối được Backend tại ${base}. Hãy mở terminal Backend và chạy: cd C:\\KhoaLuan_XepLichCaThi\\backend; .\\.venv\\Scripts\\python.exe run.py`);
    }
    const d=await r.json().catch(()=>({}));
    if(!r.ok) {
      const msg = typeof d.detail==='string'?d.detail:(d.detail?.message||((d.detail?.violations||[]).join('\n'))||'Yêu cầu không thành công ('+r.status+').');
      throw new Error(msg);
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

  async function refreshBell(){
    try{
      const r=await req('/user/notifications/'+encodeURIComponent(state.user.ma_gv));
      const n=(r.items||[]).filter(x=>!x.DaDoc).length;
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
      ['swaps','Nhờ coi thay',IC.swap],
      ['notices','Thông báo',IC.bell],
      ['password','Đổi mật khẩu',IC.key]
    ];
    $('#app').innerHTML=topbar()+`<div class="shell"><aside class="side"><div class="sec">Menu chính</div><nav class="nav">${nav.map(([id,label,ic])=>`<button data-page="${id}" class="${state.page===id?'on':''}"${state.page===id?' aria-current="page"':''}><span class="n">${ic}</span>${label}${id==='notices'?'<span class="nb" id="navDot" hidden></span>':''}</button>`).join('')}</nav><div class="side-foot"><b>HUIT · Khoa CNTT</b><span>Hệ thống nội bộ</span><span>Phiên bản 1.0.0</span></div></aside><main class="main">${content}</main></div>`;
    document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{state.page=b.dataset.page;renderPage()});
    $('#notifications').onclick=()=>{state.page='notices';renderPage()};
    $('#changePassword').onclick=()=>{state.page='password';renderPage()};
    $('#logout').onclick=()=>{state.user=null;sessionStorage.removeItem('authRole');sessionStorage.removeItem('lecturerSession');sessionStorage.removeItem('authToken');sessionStorage.removeItem('mustChangePassword');location.replace('login.html')};
    refreshBell();
  }

  function loginView(){
    $('#app').innerHTML=`<div class="login"><section class="login-art"><div class="lb">${logoMark(72)}<div class="uni">Trường Đại học Công Thương<br>Thành phố Hồ Chí Minh</div></div><div><h2>Hệ thống xếp lịch gác thi</h2><p>Tra cứu lịch gác thi cá nhân, báo bận cho quản trị viên và trao đổi đổi ca.</p></div><div class="mini" aria-hidden="true">${'<i class="a"></i>'.repeat(40)}</div></section><section class="login-form"><div><h1>Đăng nhập giảng viên</h1><p class="muted" style="margin-bottom:18px">Dùng mã giảng viên và mật khẩu do quản trị viên cấp.</p><form id="loginForm"><label class="f"><span>Mã giảng viên</span><input id="maGV" required maxlength="20" autocomplete="username"></label><label class="f"><span>Mật khẩu</span><input id="password" type="password" required autocomplete="current-password"></label><div class="err" id="error"></div><button class="btn pri" type="submit">Đăng nhập</button></form><p class="hint">Lần đầu đăng nhập, mật khẩu tạm là 1 và hệ thống bắt buộc đổi mật khẩu trước khi sử dụng.</p></div></section></div>`;
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
    $('#app').innerHTML=`<div class="login"><section class="login-art"><div class="lb">${logoMark(72)}<div class="uni">Trường Đại học Công Thương<br>Thành phố Hồ Chí Minh</div></div><div><h2>${required?'Đổi mật khẩu bắt buộc':'Bảo mật tài khoản'}</h2><p>Đặt mật khẩu riêng để bảo vệ tài khoản giảng viên.</p></div></section><section class="login-form"><div><h1>${required?'Đổi mật khẩu lần đầu':'Đổi mật khẩu'}</h1><p class="muted" style="margin-bottom:18px">8–16 ký tự, ít nhất một chữ hoa A–Z và một ký tự đặc biệt.</p><form id="pwForm"><label class="f"><span>Mật khẩu hiện tại</span><input id="oldPw" type="password" required></label><label class="f"><span>Mật khẩu mới</span><input id="newPw" type="password" required minlength="8" maxlength="16"></label><label class="f"><span>Nhập lại mật khẩu mới</span><input id="confirmPw" type="password" required minlength="8" maxlength="16"></label><div class="err" id="error"></div><button class="btn pri" type="submit">Lưu mật khẩu</button>${required?'':' <button class="btn" type="button" id="back">Quay lại</button>'}</form></div></section></div>`;
    if($('#back'))$('#back').onclick=()=>{state.page='schedule';renderPage()};
    $('#pwForm').onsubmit=async e=>{
      e.preventDefault();
      const old=$('#oldPw').value,n=$('#newPw').value,c=$('#confirmPw').value,er=$('#error');
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
        const [schedule, busy]=await Promise.all([
          req('/user/schedule/'+encodeURIComponent(state.user.ma_gv)),
          req('/user/busy-requests')
        ]);
        state.schedule=schedule.items||[];
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
    const today=new Date().toISOString().slice(0,10),list=state.schedule,up=list.filter(x=>x.NgayThi>=today).length;
    shell(`<div class="crumb">Trang chủ / Lịch gác thi</div><header class="ph"><div><h1>Lịch gác thi của tôi</h1><p>Xem ca gác theo tuần hoặc tháng. Các đơn báo bận cũng hiện trên lịch để bạn dễ theo dõi.</p></div><div class="ph-r"><button class="btn pri" id="goBusy">${IC.clip} Báo bận ca thi</button><button class="btn" id="refresh">${IC.refresh} Làm mới dữ liệu</button></div></header><div class="stats"><div class="stat ic"><div class="si">${IC.clip}</div><div><b>${list.length}</b><span>Tổng số ca</span></div></div><div class="stat ic"><div class="si">${IC.cal}</div><div><b>${up}</b><span>Ca sắp tới</span></div></div><div class="stat ic"><div class="si">${IC.ok}</div><div><b>${list.length-up}</b><span>Ca đã qua</span></div></div></div><div class="panel lecturer-calendar-panel"><div id="scheduleCalendar"></div></div>`);
    renderCalendarInto('#scheduleCalendar',{duties:list,busyRequests:state.busyRequests||[]});
    $('#refresh').onclick=renderPage;
    $('#goBusy').onclick=()=>{state.page='busy';renderPage()};
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
    (duties||[]).forEach(x=>events.push({
      kind:'duty',date:String(x.NgayThi||'').slice(0,10),start:tietToTime(x.TuTiet,false),end:tietToTime(x.DenTiet,true),
      maCa:String(x.MaCa||''),title:`Ca gác thi · tiết ${x.TuTiet}–${x.DenTiet}`,
      detail:`${LB[x.HinhThucThi]||x.HinhThucThi||'Ca thi'}${x.PhongThi?' · '+x.PhongThi:''}${x.MaCa?' · '+x.MaCa:''}`,
      sort:Number(x.TuTiet)||0
    }));
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
    const statusClass=event.kind==='busy'?(event.title.includes('đã duyệt')?'busy-approved':'busy-pending'):'duty-event';
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
    return `<div class="calendar-toolbar"><div class="calendar-nav"><button type="button" class="calendar-nav-btn" data-calendar-step="-1" aria-label="Khoảng trước">‹</button><button type="button" class="btn calendar-today" data-calendar-today>Hôm nay</button><button type="button" class="calendar-nav-btn" data-calendar-step="1" aria-label="Khoảng sau">›</button><strong>${esc(label)}</strong></div><div class="calendar-mode"><button type="button" class="${mode==='week'?'active':''}" data-calendar-mode="week">Tuần</button><button type="button" class="${mode==='month'?'active':''}" data-calendar-mode="month">Tháng</button></div></div><div class="calendar-legend"><span><i class="legend-duty"></i>Ca gác thi</span><span><i class="legend-pending"></i>Báo bận chờ duyệt</span><span><i class="legend-approved"></i>Báo bận đã duyệt</span></div><div class="calendar-scroll">${grid}</div>`;
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
    const pendingCount = list.filter(x=>x.TrangThai==='PENDING').length;
    const approvedCount = list.filter(x=>x.TrangThai==='APPROVED').length;
    const rejectedCount = list.filter(x=>x.TrangThai==='REJECTED').length;

    // Danh sách ca thi đang phân công của GV để chọn
    const activePendingSlots = new Set(list.filter(x=>x.TrangThai==='PENDING'&&x.MaCa).map(x=>String(x.MaCa)));

    // Bảng danh sách các yêu cầu báo bận đã gửi
    const reqStatusMap = {
      'APPROVED': ['Đã chấp nhận', 'ok'],
      'REJECTED': ['Đã từ chối', 'bad']
    };

    const tableRows = list.map(x => {
      const st = x.TrangThai==='PENDING'
        ? (x.MaGVThayTheDeNghi ? ['Chờ Admin duyệt', 'warn'] : x.MaCa ? ['Chờ chọn người coi thay', 'warn'] : ['Thiếu ca cụ thể', 'bad'])
        : (reqStatusMap[x.TrangThai] || [x.TrangThai, '']);
      const caInfo = x.MaCa ? `<b>Ca: ${esc(x.MaCa)}</b><br><span class="hint" style="margin:0">${fmt(x.NgayThi)} · Tiết ${x.TuTiet}–${x.DenTiet}</span>` : '<span class="muted">Không gắn ca cụ thể</span>';
      const timeRange = `${esc(x.ThoiGianBatDauBan ? x.ThoiGianBatDauBan.replace('T',' ') : '')}<br>đến ${esc(x.ThoiGianKetThucBan ? x.ThoiGianKetThucBan.replace('T',' ') : '')}`;
      
      let updateInfo = '<span class="muted">—</span>';
      if (x.TrangThai === 'PENDING' && x.MaGVThayTheDeNghi) {
        updateInfo = `<b>${esc(x.TenGVThayTheDeNghi || x.MaGVThayTheDeNghi)}</b><br><span class="hint" style="margin:0">Đã gửi Admin duyệt</span>`;
      } else if (x.TrangThai === 'APPROVED') {
        updateInfo = `<span style="color:var(--ok);font-weight:600">Đã điều chỉnh lịch</span><br><span class="hint" style="margin:0">GV thay thế: ${esc(x.TenGVThayThe || x.MaGVThayThe || 'Đã phân công lại')}</span>`;
      } else if (x.TrangThai === 'REJECTED') {
        updateInfo = `<span style="color:var(--bad);font-weight:500">Giữ nguyên lịch</span><br><span class="hint" style="margin:0">Lý do: ${esc(x.LyDoTuChoi || 'Không nêu')}</span>`;
      }

      return `<tr>
        <td><b>#${x.MaYeuCau}</b></td>
        <td>${caInfo}</td>
        <td><small>${timeRange}</small></td>
        <td><b>${esc(x.LyDoBaoBan)}</b>${x.GhiChuGV ? `<br><span class="hint" style="margin:0">${esc(x.GhiChuGV)}</span>` : ''}</td>
        <td><span class="chip ${st[1]}">${esc(st[0])}</span></td>
        <td><small>${x.ThoiGianGui ? x.ThoiGianGui.replace('T',' ') : ''}</small></td>
        <td>${updateInfo}</td>
        <td>${x.TrangThai==='PENDING'&&!x.MaGVThayTheDeNghi&&x.MaCa?`<button class="btn sm pri" data-cover-request="${x.MaYeuCau}">Chọn người coi thay</button> `:''}<button class="btn sm" data-view-busy="${x.MaYeuCau}">Chi tiết</button></td>
      </tr>`;
    }).join('');

    shell(`
      <div class="crumb">Trang chủ / Báo bận & Điều chỉnh lịch</div>
      <header class="ph">
        <div>
          <h1>Báo bận / Yêu cầu điều chỉnh lịch coi thi</h1>
          <p>Lưu đơn báo bận trước, sau đó chọn một giảng viên đủ điều kiện coi thay. Admin sẽ xem cả người được nhờ và quyết định cập nhật lịch.</p>
        </div>
        <div class="ph-r">
          <button class="btn pri" id="refreshBusy">${IC.refresh} Làm mới dữ liệu</button>
        </div>
      </header>

      <div class="stats">
        <div class="stat ic"><div class="si">${IC.clip}</div><div><b>${list.length}</b><span>Tổng yêu cầu</span></div></div>
        <div class="stat ic"><div class="si">${IC.warn}</div><div><b>${pendingCount}</b><span>Chờ chọn người / Admin</span></div></div>
        <div class="stat ic"><div class="si">${IC.ok}</div><div><b>${approvedCount}</b><span>Đã chấp nhận</span></div></div>
        <div class="stat ic"><div class="si">${IC.bad}</div><div><b>${rejectedCount}</b><span>Đã từ chối</span></div></div>
      </div>

      <div class="panel lecturer-calendar-panel busy-calendar-panel">
        <h2>Lịch gác thi và báo bận</h2>
        <p class="sub">Chọn một ca màu xanh trên lịch để tạo yêu cầu báo bận. Ca đã có yêu cầu chờ xử lý sẽ bị khóa chọn.</p>
        <div id="busyCalendar"></div>
      </div>

      <div class="u-grid">
        <form class="panel" id="busyForm">
          <h2>Gửi yêu cầu báo bận mới</h2>
          <p class="sub">Nhấn vào ca gác thi trên lịch phía trên. Sau đó nhập thời gian và lý do báo bận.</p>
          <label class="f busy-selected-field"><span>Ca gác thi đã chọn</span><input type="hidden" id="busyCa"><b id="busySelectedLabel">Chưa chọn ca trên lịch</b></label>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
            <label class="f">
              <span>2. Thời gian bắt đầu bận <b style="color:var(--bad)">*</b></span>
              <input type="datetime-local" id="busyStart" required>
            </label>
            <label class="f">
              <span>3. Thời gian kết thúc bận <b style="color:var(--bad)">*</b></span>
              <input type="datetime-local" id="busyEnd" required>
            </label>
          </div>

          <label class="f" style="margin-top:8px">
            <span>4. Lý do báo bận <b style="color:var(--bad)">*</b></span>
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
            <span>5. Ghi chú cho Admin và người được nhờ <small>(không bắt buộc)</small></span>
            <textarea id="busyNote" rows="2" maxlength="500" placeholder="Thông tin chi tiết hỗ trợ Admin sắp xếp phương án thay thế..."></textarea>
          </label>

          <div class="err" id="busyErr" role="alert"></div>
          <button class="btn pri" type="submit" id="btnSubmitBusy" style="margin-top:12px">
            ${IC.send} Lưu đơn & chọn người coi thay
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
          <p class="hint" style="margin-top:14px">
            Sau khi lưu đơn, bạn sẽ chọn người coi thay. Người được nhờ và Admin nhận thông báo; lịch chính thức chỉ đổi khi Admin chấp nhận.
          </p>
        </aside>
      </div>

      <div class="panel" style="margin-top:18px">
        <h2>Danh sách yêu cầu báo bận đã gửi</h2>
        <div class="tw">
          <table>
            <thead>
              <tr>
                <th>Mã YC</th>
                <th>Ca thi liên quan</th>
                <th>Thời gian bận</th>
                <th>Lý do & Ghi chú</th>
                <th>Trạng thái</th>
                <th>Thời gian gửi</th>
                <th>Người được nhờ / Kết quả</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows || '<tr><td colspan="8" class="empty">Bạn chưa gửi yêu cầu báo bận nào.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `);

    const form = $('#busyForm');
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

      const btn = $('#btnSubmitBusy');
      btn.disabled = true;
      btn.textContent = 'Đang lưu đơn...';

      try {
        const saved = await req('/user/busy-requests', {
          method: 'POST',
          body: JSON.stringify({
            ma_ca: maCa || null,
            thoi_gian_bat_dau: st,
            thoi_gian_ket_thuc: en,
            ly_do: reason,
            ghi_chu: note || null
          })
        });
        state.pendingCoverId = saved.ma_yeu_cau;
        state.page = 'swaps';
        toast('Đã lưu đơn báo bận. Chọn người coi thay để gửi Admin duyệt.');
        await renderPage();
      } catch (err) {
        errEl.textContent = err.message;
        btn.disabled = false;
        btn.innerHTML = `${IC.send} Lưu đơn & chọn người coi thay`;
      }
    };

    // Xem chi tiết yêu cầu
    document.querySelectorAll('[data-cover-request]').forEach(b => {
      b.onclick = () => openCoverChooser(b.dataset.coverRequest);
    });
    document.querySelectorAll('[data-view-busy]').forEach(b => {
      b.onclick = async () => {
        const id = b.dataset.viewBusy;
        try {
          const d = await req('/user/busy-requests/' + encodeURIComponent(id));
          const st = d.TrangThai==='PENDING'
            ? (d.MaGVThayTheDeNghi ? ['Chờ Admin duyệt', 'warn'] : d.MaCa ? ['Chờ chọn người coi thay', 'warn'] : ['Thiếu ca cụ thể', 'bad'])
            : (reqStatusMap[d.TrangThai] || [d.TrangThai, '']);
          let historyHtml = '';
          if (d.history && d.history.length) {
            historyHtml = `<div class="panel" style="margin-top:12px;background:var(--sub)">
              <b>Lịch sử điều chỉnh lịch coi thi</b>
              ${d.history.map(h => `<div style="font-size:13px;margin-top:6px;padding:6px 0;border-bottom:1px dashed var(--line)">
                <div><b>Hành động:</b> ${esc(h.HanhDong)} (${esc(h.ThoiDiem)})</div>
                <div><b>Trước:</b> ${esc(h.PhanCongTruoc)}</div>
                <div><b>Sau:</b> <span style="color:var(--ok);font-weight:600">${esc(h.PhanCongSau)}</span></div>
                <div><b>Người thực hiện:</b> ${esc(h.NguoiThucHien)}</div>
                ${h.LyDo ? `<div><b>Ghi chú:</b> ${esc(h.LyDo)}</div>` : ''}
              </div>`).join('')}
            </div>`;
          }

          openUserModal({
            title: `Chi tiết yêu cầu báo bận #${d.MaYeuCau}`,
            wide: true,
            body: `
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div>
                  <small class="muted">Trạng thái:</small><br>
                  <span class="chip ${st[1]}">${esc(st[0])}</span>
                </div>
                <div>
                  <small class="muted">Thời gian gửi:</small><br>
                  <b>${esc(d.ThoiGianGui ? d.ThoiGianGui.replace('T',' ') : '—')}</b>
                </div>
              </div>

              <div style="margin-top:12px">
                <small class="muted">Ca thi liên quan:</small><br>
                ${d.MaCa ? `<b>${esc(d.MaCa)}</b> (${fmt(d.NgayThi)}, tiết ${d.TuTiet}–${d.DenTiet}, phòng ${esc(d.PhongThi||'—')})` : '<i>Không gắn ca cụ thể</i>'}
              </div>

              <div style="margin-top:12px">
                <small class="muted">Thời gian bận:</small><br>
                <b>${esc(d.ThoiGianBatDauBan ? d.ThoiGianBatDauBan.replace('T',' ') : '')}</b> đến <b>${esc(d.ThoiGianKetThucBan ? d.ThoiGianKetThucBan.replace('T',' ') : '')}</b>
              </div>

              <div style="margin-top:12px">
                <small class="muted">Lý do báo bận:</small><br>
                <b>${esc(d.LyDoBaoBan)}</b>
              </div>

              ${d.MaGVThayTheDeNghi ? `<div style="margin-top:12px"><small class="muted">Giảng viên được nhờ coi thay:</small><br><b>${esc(d.TenGVThayTheDeNghi||d.MaGVThayTheDeNghi)}</b> (${esc(d.MaGVThayTheDeNghi)})</div>` : ''}

              ${d.GhiChuGV ? `<div style="margin-top:12px"><small class="muted">Ghi chú của giảng viên:</small><br>${esc(d.GhiChuGV)}</div>` : ''}

              <div style="margin-top:16px;padding:12px;border-radius:8px;background:var(--sub)">
                <b>Kết quả xử lý từ Admin</b><br>
                ${d.TrangThai === 'PENDING' ? (d.MaGVThayTheDeNghi ? '<span class="muted">Đã gửi người được nhờ và đang chờ quản trị viên xem xét.</span>' : '<span class="muted">Đơn đã lưu. Hãy vào mục “Nhờ coi thay” để chọn giảng viên đủ điều kiện.</span>') : ''}
                ${d.TrangThai === 'APPROVED' ? `<div style="color:var(--ok);margin-top:6px">
                  <b>ĐÃ CHẤP NHẬN:</b> Ca coi thi đã được điều chỉnh thành công.<br>
                  Người xử lý: <b>${esc(d.NguoiXuLy||'Admin')}</b> lúc ${esc(d.ThoiGianXuLy?d.ThoiGianXuLy.replace('T',' '):'—')}<br>
                  ${d.GhiChuAdmin ? `Ghi chú Admin: <i>${esc(d.GhiChuAdmin)}</i>` : ''}
                </div>` : ''}
                ${d.TrangThai === 'REJECTED' ? `<div style="color:var(--bad);margin-top:6px">
                  <b>ĐÃ TỪ CHỐI:</b> Lịch coi thi hiện tại được giữ nguyên.<br>
                  Lý do từ chối: <b style="color:var(--bad)">${esc(d.LyDoTuChoi||'Không nêu')}</b><br>
                  Người xử lý: <b>${esc(d.NguoiXuLy||'Admin')}</b> lúc ${esc(d.ThoiGianXuLy?d.ThoiGianXuLy.replace('T',' '):'—')}<br>
                  ${d.GhiChuAdmin ? `Ghi chú Admin: <i>${esc(d.GhiChuAdmin)}</i>` : ''}
                </div>` : ''}
              </div>

              ${historyHtml}
            `,
            foot: '<button class="btn" id="btnCloseDetail">Đóng</button>'
          });
          $('#btnCloseDetail').onclick = closeUserModal;
        } catch (ex) {
          toast(ex.message);
        }
      };
    });

    $('#refreshBusy').onclick = renderPage;
  }

  function swapsPage(){
    const list=state.busyRequests||[];
    const pending=list.filter(x=>x.TrangThai==='PENDING');
    const rows=list.map(x=>{
      const st=x.TrangThai==='PENDING'
        ? (x.MaGVThayTheDeNghi?['Đã gửi Admin duyệt','warn']:x.MaCa?['Cần chọn người coi thay','warn']:['Thiếu ca cụ thể','bad'])
        : x.TrangThai==='APPROVED'?['Đã được duyệt','ok']:['Bị từ chối','bad'];
      const ca=x.MaCa?`${fmt(x.NgayThi)} · tiết ${x.TuTiet}–${x.DenTiet} · ${esc(x.MaCa)}`:'Chưa gắn ca thi';
      const nominee=x.TenGVThayTheDeNghi||x.MaGVThayTheDeNghi||'—';
      const action=x.TrangThai==='PENDING'&&!x.MaGVThayTheDeNghi&&x.MaCa
        ? `<button class="btn sm pri" data-cover-request="${x.MaYeuCau}">Chọn giảng viên</button>`
        : x.TrangThai==='PENDING'&&!x.MaCa?'<span class="muted">Đơn cũ chưa gắn ca thi</span>':'<span class="muted">—</span>';
      return `<tr><td><b>#${x.MaYeuCau}</b></td><td>${ca}</td><td>${esc(x.LyDoBaoBan||'—')}</td><td>${esc(nominee)}</td><td><span class="chip ${st[1]}">${st[0]}</span></td><td>${action}</td></tr>`;
    }).join('');
    shell(`<div class="crumb">Trang chủ / Nhờ coi thay</div>
      <header class="ph"><div><h1>Nhờ giảng viên coi thay</h1><p>Đơn báo bận đã lưu sẽ xuất hiện tại đây. Chỉ các giảng viên đủ điều kiện RB1–RB6 cho đúng ca mới được chọn.</p></div><div class="ph-r"><button class="btn pri" id="refreshCover">${IC.refresh} Làm mới dữ liệu</button></div></header>
      <div class="u-steps"><div class="u-step on"><i>1</i><div><b>Lưu đơn báo bận</b><span>Chọn ca cụ thể cần thay</span></div></div><div class="u-step on"><i>2</i><div><b>Chọn người coi thay</b><span>Chỉ hiện người đủ điều kiện</span></div></div><div class="u-step"><i>3</i><div><b>Admin duyệt</b><span>Lịch chỉ đổi sau khi Admin chấp nhận</span></div></div></div>
      <div class="panel"><h2>Đơn báo bận và yêu cầu coi thay</h2><p class="sub">Sau khi gửi, giảng viên được nhờ và Admin đều nhận thông báo. Người được nhờ chưa tự ý thay lịch; Admin là người duyệt cuối cùng.</p><div class="tw"><table><thead><tr><th>Mã đơn</th><th>Ca cần thay</th><th>Lý do</th><th>Giảng viên được nhờ</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${rows||'<tr><td colspan="6" class="empty">Chưa có đơn báo bận. Hãy tạo đơn ở mục “Báo bận / Điều chỉnh”.</td></tr>'}</tbody></table></div></div>`);
    $('#refreshCover').onclick=renderPage;
    document.querySelectorAll('[data-cover-request]').forEach(b=>b.onclick=()=>openCoverChooser(b.dataset.coverRequest));
    const autoId=state.pendingCoverId;
    state.pendingCoverId=null;
    if(autoId) openCoverChooser(autoId);
  }

  async function openCoverChooser(requestId){
    openUserModal({title:'Đang kiểm tra giảng viên phù hợp…',body:'<p class="muted">Đang đối chiếu lịch dạy, lịch bận, định mức và các phân công khác.</p>',foot:'<button class="btn" id="cancelCoverLoad">Đóng</button>'});
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
      openUserModal({
        title:`Chọn người coi thay cho đơn #${d.MaYeuCau}`,
        wide:true,
        body:`<div class="panel" style="background:var(--sub);margin-bottom:12px"><b>Ca cần thay:</b><br>${esc(d.MaCa)} · ${date} · tiết ${d.TuTiet}–${d.DenTiet}<br><b>Lý do:</b> ${esc(d.LyDoBaoBan)}</div>
          <p class="sub">Danh sách dưới đây chỉ gồm giảng viên hiện đủ điều kiện. Admin sẽ kiểm tra lại các ràng buộc khi duyệt.</p>
          ${candidates.length?`<input type="search" id="coverSearch" placeholder="Tìm trong danh sách đủ điều kiện" style="width:100%;margin-bottom:8px"><div id="coverCandidates" style="max-height:300px;overflow:auto">${radios}</div>`:'<div class="panel"><p class="muted">Hiện không có giảng viên nào đủ điều kiện nhận ca này.</p></div>'}
          <div class="err" id="coverErr" role="alert"></div>`,
        foot:`<button class="btn" id="cancelCover">Hủy</button><button class="btn pri" id="sendCover" ${candidates.length?'':'disabled'}>${IC.send} Gửi yêu cầu nhờ coi thay</button>`
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
        }catch(e){err.textContent=e.message;btn.disabled=false;btn.innerHTML=IC.send+' Gửi yêu cầu nhờ coi thay'}
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
      tail=tail.replace(/\s*Yêu cầu đang chờ Admin duyệt; lịch chưa thay đổi\.?\s*$/,'');
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
        <div class="notice-fact notice-status"><span>Trạng thái</span><b>Chờ Admin duyệt · Lịch chưa thay đổi</b></div>
      </div>
      <div class="notice-long"><span>Lý do</span><p>${esc(reason||'Không có thông tin')}</p></div>
      ${note?`<div class="notice-long"><span>Ghi chú của người gửi</span><p>${esc(note)}</p></div>`:''}`;
    }
    const paragraphs=text.split(/(?<=\.)\s+/).filter(Boolean);
    return `<div class="notice-message">${(paragraphs.length?paragraphs:[text||'Không có nội dung']).map(p=>`<p>${esc(p)}</p>`).join('')}</div>`;
  }

  function noticesPage(){
    const n=state.notices,unread=n.filter(x=>!x.DaDoc).length;
    const cards=n.map(x=>{
      const isUnread=!x.DaDoc;
      const created=x.TaoLuc?new Date(x.TaoLuc).toLocaleString('vi-VN'):'—';
      const rejected=String(x.Loai||'').toLowerCase().includes('reject');
      return `<article class="notice-card ${isUnread?'unread':''}">
        <div class="notice-icon ${rejected?'rejected':''}">${rejected?IC.bad:IC.bell}</div>
        <div class="notice-content">
          <div class="notice-heading"><h3>${esc(x.TieuDe||'Thông báo')}</h3><span class="chip ${isUnread?'warn':'ok'}">${isUnread?'Chưa đọc':'Đã đọc'}</span></div>
          ${notificationDetails(x)}
          <div class="notice-created">${IC.cal}<span>${esc(created)}</span></div>
        </div>
        ${isUnread?`<button class="btn sm" data-read="${x.ID}">Đánh dấu đã đọc</button>`:''}
      </article>`;
    }).join('');
    shell(`<div class="crumb">Trang chủ / Thông báo</div><header class="ph"><div><h1>Thông báo</h1><p>Yêu cầu báo bận, nhận coi thay và kết quả xử lý.</p></div><div class="ph-r">${unread?'<button class="btn pri" id="readAll">Đánh dấu tất cả đã đọc</button>':''}</div></header><div class="panel notice-panel"><div class="notice-list">${cards||'<p class="muted">Chưa có thông báo.</p>'}</div></div>`);
    const mark=id=>req(`/user/notifications/${encodeURIComponent(state.user.ma_gv)}/${id}/read`,{method:'POST'});
    document.querySelectorAll('[data-read]').forEach(b=>b.onclick=async()=>{try{await mark(b.dataset.read);await renderPage()}catch(e){toast(e.message)}});
    const all=$('#readAll');if(all)all.onclick=async()=>{try{await Promise.all(n.filter(x=>!x.DaDoc).map(x=>mark(x.ID)));await renderPage()}catch(e){toast(e.message)}};
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
  if(document.readyState==='loading') window.addEventListener('DOMContentLoaded',initializeLecturerApp,{once:true});
  else initializeLecturerApp();
})();
