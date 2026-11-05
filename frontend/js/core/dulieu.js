/* ========= Dữ liệu ========= */
function seed(){
  return{
    v:1,logo:LOGO,nid:1,
    users:[{id:1,name:'Quản trị viên',user:'admin',role:ROLES[0],on:true}],
    perms:{[ROLES[0]]:[1,1,1,1,1,1,0]},
    lecs:[],exams:[],dots:[],hist:[],schedulePublished:null,scheduleDraftDirty:false,
    soft:{S1:{on:true,w:10},S2:{on:true,w:9},S3:{on:true,w:8},S4:{on:true,w:7},S5:{on:true,w:6},S6:{on:true,w:4}}
  };
}
function normalizeSoft(value){
  const defaults={S1:{on:true,w:10},S2:{on:true,w:9},S3:{on:true,w:8},S4:{on:true,w:7},S5:{on:true,w:6},S6:{on:true,w:4}};
  const old=value&&typeof value==='object'?value:{};
  const legacy=!('S3'in old)&&!('S4'in old)&&!('S5'in old)&&!('S6'in old);
  const source=legacy?{
    S1:defaults.S1,
    S2:{...defaults.S2,on:old.S1?.on!==false},
    S3:defaults.S3,
    S4:defaults.S4,
    S5:{...defaults.S5,on:old.S2?.on!==false},
    S6:{...defaults.S6,on:old.S2?.on!==false}
  }:old;
  return Object.fromEntries(Object.entries(defaults).map(([id,d])=>{
    const c=source[id]&&typeof source[id]==='object'?source[id]:d;
    const weight=Number(c.w);
    return[id,{on:c.on!==false,w:Number.isFinite(weight)?Math.max(1,Math.min(10,Math.round(weight))):d.w}];
  }));
}
function load(){try{const o=JSON.parse(localStorage.getItem(KEY));if(o&&o.v===1&&o.lecs&&o.exams){o.soft=normalizeSoft(o.soft);return o}}catch(e){}return null}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
let S=load()||seed();
// Khôi phục phiên Admin từ trang đăng nhập chung để không hiện lại form đăng nhập nội bộ.
const adminSession = sessionStorage.getItem('authRole') === 'admin';
let cur=adminSession?(S.users.find(x=>String(x.user).toLowerCase()==='admin' && x.on) || S.users.find(x=>x.id===1 && x.on) || null):null,view='home',pend=null,pendL=null,pendTeach=null,pendBusy=null,pendDuty=null,pre=null,pick=null,tab6='quota',teachingEdit=null;
const F={lq:'',ld:'',ls:'',eq:'',ed:'',ek:'',sd:'',lack:false,xm:'lec'};
let adminAccounts=[],accountsLoading=false,accountsError='',accountsSearch='',accountsPasswordFilter='ALL',accountsWorkFilter='ALL';
let adminBusyRequests=[],busyReqsLoading=false,busyReqsError='',adminBusyCount=0;
let scheduleSharingEnabled=null,scheduleSharingLoading=false,scheduleSharingError='';
let busyReqFilter='ALL',busyReqSearch='';

