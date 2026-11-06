/* ========= Dữ liệu ========= */
function seed(){
  return{
    v:1,softV:3,logo:LOGO,nid:1,solverPenaltyReport:null,scheduleRunError:null,scheduleTimeLimit:120,
    users:[{id:1,name:'Quản trị viên',user:'admin',role:ROLES[0],on:true}],
    perms:{[ROLES[0]]:[1,1,1,1,1,1,0]},
    lecs:[],exams:[],dots:[],hist:[],schedulePublished:null,scheduleDraftDirty:false,
    soft:{RB8:{on:true,w:8},S1:{on:true,w:7},S3:{on:true,w:6},S2:{on:true,w:5},S4:{on:true,w:4},S5:{on:true,w:3},S6:{on:true,w:2},S7:{on:true,w:1}}
  };
}
function normalizeSoft(value,version){
  const defaults={RB8:{on:true,w:8},S1:{on:true,w:7},S3:{on:true,w:6},S2:{on:true,w:5},S4:{on:true,w:4},S5:{on:true,w:3},S6:{on:true,w:2},S7:{on:true,w:1}};
  const old=value&&typeof value==='object'?value:{};
  const hasCurrentRuleIds=Number(version)>=2||Object.prototype.hasOwnProperty.call(old,'RB8')||Object.prototype.hasOwnProperty.call(old,'S7');
  const source=hasCurrentRuleIds?old:{
    S1:defaults.S1,
    S2:old.S1,
    S3:old.S2,
    S4:old.S3,
    S5:old.S4,
    S6:old.S5,
    S7:old.S6
  };
  return Object.fromEntries(Object.entries(defaults).map(([id,d])=>{
    const c=source[id]&&typeof source[id]==='object'?source[id]:d;
    return[id,{on:c.on!==false,w:d.w}];
  }));
}
function softStateFromConfig(rules){
  return Object.fromEntries(SOFT.map((rule,index)=>[
    rule.id,{on:rules?.[rule.id]?.on!==false,w:SOFT.length-index}
  ]));
}
function softRuleFlags(){return Object.fromEntries(SOFT.map(rule=>[rule.id,S.soft?.[rule.id]?.on!==false]))}
function load(){try{const o=JSON.parse(localStorage.getItem(KEY));if(o&&o.v===1&&o.lecs&&o.exams){o.soft=normalizeSoft(o.soft,o.softV);o.softV=3;o.scheduleTimeLimit=[30,120,300].includes(Number(o.scheduleTimeLimit))?Number(o.scheduleTimeLimit):120;return o}}catch(e){}return null}
function save(){try{const persisted={...S,lecs:S.lecs.map(({duty,rb9OtherExams,...lecturer})=>lecturer)};localStorage.setItem(KEY,JSON.stringify(persisted))}catch(e){}}
let S=load()||seed();
// Khôi phục phiên Admin từ trang đăng nhập chung để không hiện lại form đăng nhập nội bộ.
const adminSession = sessionStorage.getItem('authRole') === 'admin';
let cur=adminSession?(S.users.find(x=>String(x.user).toLowerCase()==='admin' && x.on) || S.users.find(x=>x.id===1 && x.on) || null):null,view='home',pend=null,pendL=null,pendTeach=null,pendBusy=null,pendDuty=null,pre=null,pick=null,tab6='quota',teachingEdit=null;
const F={lq:'',ld:'',ls:'',eq:'',ed:'',ek:'',sd:'',lack:false,xm:'lec'};
let adminAccounts=[],accountsLoading=false,accountsError='',accountsSearch='',accountsPasswordFilter='ALL',accountsWorkFilter='ALL';
let adminBusyRequests=[],busyReqsLoading=false,busyReqsError='',adminBusyCount=0;
let scheduleSharingEnabled=null,scheduleSharingLoading=false,scheduleSharingError='';
let busyReqFilter='ALL',busyReqSearch='';

