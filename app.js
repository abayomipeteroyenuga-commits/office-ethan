const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];

const STORE = {
  users: "ethan_users_v1",
  session: "ethan_session_v1",
  data: "ethan_data_v1"
};

const seed = {
  students: [],
  instructors: [],
  courses: [],
  payments: [],
  enrolments: [],
  announcements: [],
  notifications: []
};

function loadData(){
  const saved = localStorage.getItem(STORE.data);
  if(saved){
    try{
      const parsed = JSON.parse(saved);
      const demoEmails = new Set(["amina@example.com","david@example.com","grace@example.com","parent@example.com"]);
      parsed.students = Array.isArray(parsed.students) ? parsed.students.filter(s=>!demoEmails.has(String(s.email||"").toLowerCase())) : [];
      parsed.instructors = Array.isArray(parsed.instructors) ? parsed.instructors.filter(i=>!["Samuel Adeyemi","Mariam Bello","Daniel Peter"].includes(i.name)) : [];
      parsed.payments = Array.isArray(parsed.payments) ? parsed.payments.filter(p=>!["Amina Yusuf","David Okoro","Grace Adewale"].includes(p.student)) : [];
      parsed.announcements = Array.isArray(parsed.announcements) ? parsed.announcements.filter(a=>a.title!=="Welcome to ETHAN ERP & LMS" && a.title!=="New cybersecurity course") : [];
      parsed.notifications = [];
      parsed.enrolments = Array.isArray(parsed.enrolments) ? parsed.enrolments : [];
      parsed.courses = Array.isArray(parsed.courses) ? parsed.courses.filter(c=>!["EDA-CYB-101","EDA-EXC-101","EDA-DMK-201","EDA-AIB-101","EDA-CAN-101","EDA-WEB-101"].includes(c.code)) : [];
      localStorage.setItem(STORE.data, JSON.stringify(parsed));
      return parsed;
    }catch(_){}
  }
  localStorage.setItem(STORE.data, JSON.stringify(seed));
  return structuredClone(seed);
}
let data = loadData();
data.enrolments = Array.isArray(data.enrolments) ? data.enrolments : [];
let currentUser = null;
let portalState = { myStudent:null, myEnrolments:[], myPayments:[], backendLoaded:false };
let currentPage = "dashboard";

function getUsers(){ return JSON.parse(localStorage.getItem(STORE.users) || "[]"); }
function saveUsers(users){ localStorage.setItem(STORE.users, JSON.stringify(users)); }
function setSession(user){
  localStorage.setItem(STORE.session, JSON.stringify({email:user.email, ts:Date.now()}));
}
function initials(name){ return name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0].toUpperCase()).join("") || "EU"; }

const ETHAN_SUPER_ADMIN_EMAILS = new Set(["fedora4jesus@gmail.com"]);
function resolveAuthenticatedRole(authUser, profile){
  const email=String(authUser?.email||profile?.email||"").trim().toLowerCase();
  if(ETHAN_SUPER_ADMIN_EMAILS.has(email)) return "super_admin";
  const dbRole=String(profile?.role||"").trim().toLowerCase();
  if(["super_admin","admin","instructor","student","parent"].includes(dbRole)) return dbRole;
  const metaRole=String(authUser?.user_metadata?.role||"").trim().toLowerCase();
  if(["super_admin","admin","instructor","student","parent"].includes(metaRole)) return metaRole;
  return "student";
}

function portalRoleLabel(user){
  if(user?.role==="student"){
    if(user?.learnerType==="professional") return "Professional";
    if(user?.learnerType==="business_owner") return "Business Owner";
    return "Student";
  }
  return String(user?.role||"student").replaceAll("_"," ").replace(/\b\w/g,m=>m.toUpperCase());
}


// Staff accounts are created securely through Supabase Staff Management.


$$(".auth-tab").forEach(btn=>btn.addEventListener("click",()=>{
  $$(".auth-tab").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");
  $("#signinForm").classList.toggle("hidden", btn.dataset.authTab!=="signin");
  $("#signupForm").classList.toggle("hidden", btn.dataset.authTab!=="signup");
}));

$$(".toggle-password").forEach(btn=>btn.addEventListener("click",()=>{
  const input = document.getElementById(btn.dataset.target);
  input.type = input.type==="password" ? "text":"password";
  btn.textContent = input.type==="password" ? "Show":"Hide";
}));

$("#signupForm").addEventListener("submit", async e=>{
  e.preventDefault();
  const firstName=$("#firstName").value.trim(), lastName=$("#lastName").value.trim();
  const email=$("#signupEmail").value.trim().toLowerCase(), phone=$("#signupPhone").value.trim();
  const learnerType=$("#signupRole").value, role="student", password=$("#signupPassword").value, confirm=$("#confirmPassword").value;
  const msg=$("#signupMessage");
  if(password!==confirm){ msg.textContent="Passwords do not match."; msg.className="form-message error"; return; }
  try{
    if(window.ETHAN_BACKEND?.ready){
      await window.ETHAN_BACKEND.signUp({email,password,firstName,lastName,phone,role,learnerType});
      msg.textContent="Account created. Check your email if confirmation is enabled."; msg.className="form-message success";
    }else{
      if(getUsers().some(u=>u.email===email)){ msg.textContent="An account with this email already exists."; msg.className="form-message error"; return; }
      const users=getUsers();
      const prefix="EDA-ST";
      const user={firstName,lastName,name:`${firstName} ${lastName}`,email,phone,role,learnerType,password,id:`${prefix}-${String(users.length+1).padStart(4,"0")}`};
      users.push(user); saveUsers(users);
      if(role==="student" && !data.students.some(s=>s.email.toLowerCase()===email)){
        data.students.push({id:user.id,name:user.name,email,program:"Awaiting course allocation",status:"Pending Payment",progress:0,payment:"Unpaid"});
        persist();
      }
      msg.textContent="Account created. Learning access begins after verified payment and course allocation."; msg.className="form-message success";
    }
    $("#signupForm").reset();
    setTimeout(()=>$(".auth-tab[data-auth-tab='signin']").click(),900);
  }catch(err){
    msg.textContent=err.message||"Unable to create account.";msg.className="form-message error";
  }
});

$("#signinForm").addEventListener("submit", async e=>{
  e.preventDefault();
  const email=$("#signinEmail").value.trim().toLowerCase(), password=$("#signinPassword").value;
  const msg=$("#signinMessage");
  try{
    if(window.ETHAN_BACKEND?.ready){
      const result=await window.ETHAN_BACKEND.signIn(email,password);
      const authUser=result.user;
      let profile=null;
      try{ profile=await window.ETHAN_BACKEND.getProfile(authUser.id); }catch(_){}
      const role=resolveAuthenticatedRole(authUser,profile);
      const user={
        firstName:profile?.first_name||authUser.user_metadata?.first_name||"Ethan",
        lastName:profile?.last_name||authUser.user_metadata?.last_name||"User",
        name:`${profile?.first_name||authUser.user_metadata?.first_name||"Ethan"} ${profile?.last_name||authUser.user_metadata?.last_name||"User"}`.trim(),
        email:authUser.email, phone:profile?.phone||"", role, learnerType:authUser.user_metadata?.learner_type||authUser.user_metadata?.learnerType||"student", id:authUser.id
      };
      currentUser=user; openPortal(user);
    }else{
      const user=getUsers().find(u=>u.email===email && u.password===password);
      if(!user){msg.textContent="Email or password is incorrect.";msg.className="form-message error";return;}
      setSession(user); openPortal(user);
    }
  }catch(err){
    msg.textContent=err.message||"Unable to sign in.";msg.className="form-message error";
  }
});

$("#forgotPasswordBtn").addEventListener("click",()=>{
  showModal("Password reset","Enter your account email and request a reset link.",`
    <label>Email address<input id="resetEmail" type="email" placeholder="you@example.com"></label>
  `,async ()=>{
    const email=$("#resetEmail").value.trim().toLowerCase();
    if(!email) return alert("Enter your email address.");
    if(window.ETHAN_BACKEND?.ready){
      try{ await window.ETHAN_BACKEND.resetPassword(email); closeModal(); alert("Password reset email requested."); }
      catch(err){ alert(err.message||"Unable to request reset."); }
    }else{
      alert("Preview mode: connect Supabase in config.js to send password-reset emails.");
    }
  });
});

$("#logoutBtn").addEventListener("click",async ()=>{
  if(window.ETHAN_BACKEND?.ready){ try{ await window.ETHAN_BACKEND.signOut(); }catch(_){} }
  localStorage.removeItem(STORE.session); currentUser=null; $("#portal").classList.add("hidden"); $("#authScreen").classList.remove("hidden");
});

$("#menuBtn").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
$("#notificationBtn").addEventListener("click",()=>$("#notificationPanel").classList.toggle("hidden"));
$("#closeNotif").addEventListener("click",()=>$("#notificationPanel").classList.add("hidden"));

$("#globalSearch").addEventListener("keydown", e=>{
  if(e.key!=="Enter") return;
  const q=e.target.value.toLowerCase().trim();
  if(!q) return;
  const match=data.courses.find(c=>String(c.title||"").toLowerCase().includes(q)) || data.students.find(s=>String(s.name||"").toLowerCase().includes(q));
  if(match) alert(`Found: ${match.title || match.name}`);
  else alert("No matching learner or course was found.");
});

const adminNav = [
  ["dashboard","▦","Dashboard"],["students","👥","Learners"],["instructors","🧑‍🏫","Instructors"],["staff","🛡","Staff Management"],
  ["courses","📚","Courses"],["lms","▶","LMS"],["assignments","📝","Assignments"],["quizzes","✅","Quizzes"],
  ["attendance","📅","Attendance"],["timetable","🕒","Timetable"],["payments","💳","Fees & Payments"],
  ["results","📊","Results"],["certificates","🎓","Certificates"],["announcements","📣","Announcements"],["reports","📈","Reports"],["settings","⚙","Settings"]
];
const navByRole = {
  super_admin: adminNav,
  admin: adminNav,
  student:[
    ["dashboard","▦","Dashboard"],["courses","📚","My Courses"],["lms","▶","Continue Learning"],["assignments","📝","Assignments"],
    ["quizzes","✅","Quizzes & Exams"],["attendance","📅","Attendance"],["payments","💳","Fees & Payments"],
    ["results","📊","Results"],["certificates","🎓","Certificates"],["announcements","📣","Announcements"],["profile","👤","Profile"]
  ],
  parent:[
    ["dashboard","▦","Dashboard"],["students","👥","My Children"],["attendance","📅","Attendance"],["payments","💳","Fees & Payments"],
    ["results","📊","Results"],["announcements","📣","Announcements"],["profile","👤","Profile"]
  ],
  instructor:[
    ["dashboard","▦","Dashboard"],["courses","📚","My Courses"],["lms","▶","Course Builder"],["students","👥","My Students"],
    ["assignments","📝","Assignments"],["quizzes","✅","Quizzes"],["attendance","📅","Attendance"],["results","📊","Results"],["announcements","📣","Announcements"],["profile","👤","Profile"]
  ]
};

async function openPortal(user){
  currentUser=user;
  $("#authScreen").classList.add("hidden"); $("#portal").classList.remove("hidden");
  $("#userName").textContent=user.name; $("#userRole").textContent=portalRoleLabel(user);
  $("#userAvatar").textContent=initials(user.name);
  await hydratePortalData(user);
  renderNav();
  renderNotifications();
  navigate("dashboard");
}

async function hydratePortalData(user){
  portalState={myStudent:null,myEnrolments:[],myPayments:[],backendLoaded:false};
  if(window.ETHAN_BACKEND?.ready){
    try{
      if(user.role==="student"){
        portalState.myStudent=await window.ETHAN_BACKEND.getStudentByUserId(user.id);
        if(portalState.myStudent){
          portalState.myEnrolments=await window.ETHAN_BACKEND.listStudentEnrolments(portalState.myStudent.id);
          portalState.myPayments=await window.ETHAN_BACKEND.listMyPayments(portalState.myStudent.id);
        }
      } else if(["admin","super_admin","instructor"].includes(user.role)){
        const [students,courses] = await Promise.all([
          window.ETHAN_BACKEND.listStudents(),
          window.ETHAN_BACKEND.listCourses()
        ]);
        if(Array.isArray(students)) data.students=students.map(s=>({
          id:s.id, studentNo:s.student_no, name:[s.profiles?.first_name,s.profiles?.last_name].filter(Boolean).join(" ")||s.student_no||"Learner",
          email:s.profiles?.email||"", program:"Awaiting allocation", status:s.status||"Active", progress:0, payment:"Unpaid", userId:s.user_id
        }));
        if(Array.isArray(courses)) data.courses=courses.map(c=>({
          id:c.id,code:c.code,title:c.title,category:c.difficulty||"Course",instructor:"Assigned by academy",
          duration:c.duration||"Self-paced",progress:0,lessons:0,completed:0,fee:Number(c.fee||0),published:c.published
        }));
        if(user.role==="admin" || user.role==="super_admin"){
          try{
            const [staff,payments] = await Promise.all([
              window.ETHAN_BACKEND.listStaff(),
              window.ETHAN_BACKEND.listPayments()
            ]);
            data.instructors = (staff||[]).filter(x=>x.role==="instructor").map((x,i)=>({
              id:x.id||`EDA-IN-${String(i+1).padStart(3,"0")}`,
              name:[x.first_name,x.last_name].filter(Boolean).join(" ")||"Instructor",
              email:x.email||"", specialization:"Assigned courses", courses:0, status:"Active"
            }));
            data.payments = (payments||[]).map(p=>({
              ref:p.reference, student:p.students?.profiles ? [p.students.profiles.first_name,p.students.profiles.last_name].filter(Boolean).join(" ") : "Learner",
              studentId:p.student_id, description:p.description||"Training Fee", amount:Number(p.amount||0),
              date:p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "—",
              status:p.verified ? "Verified" : "Pending"
            }));
          }catch(_){}
        }
      }
      try{
        const announcements=await window.ETHAN_BACKEND.listAnnouncements();
        data.announcements=(announcements||[]).map(a=>({id:a.id,title:a.title,message:a.message,date:a.created_at?new Date(a.created_at).toLocaleDateString():""}));
      }catch(_){}
      try{
        const notifications=await window.ETHAN_BACKEND.listMyNotifications();
        data.notifications=(notifications||[]).map(n=>({title:n.title,message:n.message,time:n.created_at?new Date(n.created_at).toLocaleString():""}));
      }catch(_){}
      portalState.backendLoaded=true;
    }catch(err){ console.warn("Portal data could not be fully loaded",err); }
  }else if(user.role==="student"){
    portalState.myStudent=data.students.find(s=>(s.email||"").toLowerCase()===user.email.toLowerCase())||null;
    const sid=portalState.myStudent?.id;
    portalState.myEnrolments=data.enrolments.filter(e=>e.studentId===sid).map(e=>({ ...e, course:data.courses.find(c=>(c.id||c.code)===e.courseId || c.code===e.courseCode) })).filter(e=>e.course);
  }
}

function studentEnrolments(){ return currentUser?.role==="student" ? (portalState.myEnrolments||[]) : []; }
function studentCourses(){ return studentEnrolments().map(e=>e.course).filter(Boolean); }
function emptyState(title,message,action=""){ return `<div class="card" style="text-align:center;padding:34px"><h3>${title}</h3><p class="muted" style="max-width:620px;margin:8px auto 18px">${message}</p>${action}</div>`; }
function renderNav(){
  const role=currentUser.role==="admin"?"admin":currentUser.role;
  const nav=navByRole[role]||navByRole.student;
  $("#sideNav").innerHTML=nav.map(([id,icon,label])=>`<button class="nav-item" data-page="${id}"><span>${icon}</span><span>${label}</span></button>`).join("");
  $$("#sideNav .nav-item").forEach(b=>b.addEventListener("click",()=>{navigate(b.dataset.page);$("#sidebar").classList.remove("open")}));
}
function navigate(page){
  currentPage=page;
  $$("#sideNav .nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  const label=($("#sideNav .nav-item.active span:last-child")||{}).textContent || "Dashboard";
  $("#pageTitle").textContent=label; $("#pageEyebrow").textContent=portalRoleLabel(currentUser).toUpperCase()+" PORTAL";
  const renderers={dashboard:renderDashboard,students:renderStudents,parents:renderParents,instructors:renderInstructors,staff:renderStaff,courses:renderCourses,lms:renderLMS,assignments:renderAssignments,quizzes:renderQuizzes,attendance:renderAttendance,timetable:renderTimetable,payments:renderPayments,results:renderResults,certificates:renderCertificates,announcements:renderAnnouncements,reports:renderReports,settings:renderSettings,profile:renderProfile};
  (renderers[page]||renderDashboard)();
}

function stat(label,value,sub,icon){return `<div class="stat-card"><div class="stat-icon">${icon}</div><div><small class="stat-label">${label}</small><strong class="stat-value">${value}</strong><span class="stat-sub">${sub}</span></div></div>`}
function pageHead(title,desc,action=""){return `<div class="page-title-block"><div class="toolbar"><div><h1>${title}</h1><p class="muted">${desc}</p></div>${action}</div></div>`}

function renderDashboard(){
  const role=currentUser.role;
  if(role==="admin" || role==="super_admin"){
    $("#content").innerHTML=`
      <div class="hero-card"><div><span class="eyebrow" style="color:#a9cfff">ACADEMY OVERVIEW</span><h1>Welcome back, ${currentUser.firstName}</h1><p>Manage learners, courses, finance and academic operations from one place.</p></div><div class="hero-actions"><button class="secondary-btn" onclick="navigate('students')">Manage Students</button><button class="secondary-btn" onclick="navigate('courses')">Manage Courses</button></div></div>
      <div class="stats-grid">${stat("Total Students",data.students.length,"Active learner records","👥")}${stat("Active Courses",data.courses.length,"Published catalogue","📚")}${stat("Instructors",data.instructors.length,"Teaching staff","🧑‍🏫")}${stat("Payments","₦175,000","Recent confirmed","💳")}</div>
      <div class="dashboard-grid">
        <div class="card"><div class="card-head"><h3>Student Progress</h3><button class="text-btn" onclick="navigate('students')">View students</button></div><div class="progress-list">${data.students.map(s=>`<div class="progress-row"><div class="progress-top"><strong>${s.name}</strong><span>${s.progress}%</span></div><small class="muted">${s.program}</small><div class="progress"><span style="width:${s.progress}%"></span></div></div>`).join("")}</div></div>
        <div class="card"><div class="card-head"><h3>Quick Actions</h3></div><div class="quick-grid">${[["Add Student","students"],["Create Course","courses"],["Record Payment","payments"],["Mark Attendance","attendance"],["Publish Result","results"],["Issue Certificate","certificates"]].map(([a,p])=>`<div class="quick-card" onclick="navigate('${p}')"><strong>${a}</strong><p class="muted">Open module</p></div>`).join("")}</div></div>
      </div>`;
  } else if(role==="student"){
    const courses=studentCourses();
    const average=courses.length?Math.round(courses.reduce((n,c)=>n+Number(c.progress||0),0)/courses.length):0;
    $("#content").innerHTML=`
      <div class="hero-card"><div><span class="eyebrow" style="color:#a9cfff">STUDENT PORTAL</span><h1>Welcome back, ${currentUser.firstName}</h1><p>${courses.length?"Your paid course allocation is active. Continue learning below.":"Your account is ready. Course access opens only after payment is verified and Admin allocates your course."}</p></div><button class="secondary-btn" onclick="navigate('${courses.length?"lms":"payments"}')">${courses.length?"Continue Learning":"View Payment Status"}</button></div>
      <div class="stats-grid">${stat("My Courses",String(courses.length),courses.length?"Allocated courses":"No course allocated yet","📚")}${stat("Average Progress",average+"%",courses.length?"Across allocated courses":"Starts after allocation","📈")}${stat("Assignments","0",courses.length?"Published assignments appear here":"No active course","📝")}${stat("Certificates","0","Issued after successful completion","🎓")}</div>
      ${courses.length?`<div class="card"><div class="card-head"><h3>My Course Progress</h3></div><div class="progress-list">${courses.map(c=>`<div class="progress-row"><div class="progress-top"><strong>${c.title}</strong><span>${Number(c.progress||0)}%</span></div><small class="muted">${c.duration||"Self-paced"}</small><div class="progress"><span style="width:${Number(c.progress||0)}%"></span></div></div>`).join("")}</div></div>`:emptyState("No courses allocated yet","Registration does not automatically enrol you in a course. Once your payment is confirmed, Admin will allocate the exact course you paid for and your lessons/videos will become available.",`<button class="primary-btn" onclick="navigate('payments')">Payment & Course Access</button>`)}`;
  } else if(role==="parent"){
    $("#content").innerHTML=`
      <div class="hero-card"><div><span class="eyebrow" style="color:#a9cfff">PARENT PORTAL</span><h1>Welcome, ${currentUser.firstName}</h1><p>Follow your child's learning progress, attendance, results and fees.</p></div></div>
      <div class="stats-grid">${stat("Linked Children","1","Student account","👥")}${stat("Attendance","94%","This month","📅")}${stat("Overall Progress","72%","Current term","📈")}${stat("Outstanding","₦35,000","Fee balance","💳")}</div>
      ${studentTable(data.students.slice(0,1))}`;
  } else {
    $("#content").innerHTML=`
      <div class="hero-card"><div><span class="eyebrow" style="color:#a9cfff">INSTRUCTOR PORTAL</span><h1>Welcome, ${currentUser.firstName}</h1><p>Manage teaching, lessons, assignments, attendance and student performance.</p></div><button class="secondary-btn" onclick="navigate('lms')">Open Course Builder</button></div>
      <div class="stats-grid">${stat("My Courses","3","Assigned courses","📚")}${stat("My Students","48","Active learners","👥")}${stat("To Grade","8","Submissions","📝")}${stat("Today's Classes","2","Scheduled","🕒")}</div>
      <div class="card"><div class="card-head"><h3>Assigned Courses</h3></div>${courseCards(data.courses.slice(0,3))}</div>`;
  }
}

function studentTable(list){
 return `<div class="card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Student ID</th><th>Name</th><th>Program</th><th>Progress</th><th>Payment</th><th>Status</th></tr></thead><tbody>${list.map(s=>`<tr><td>${s.id}</td><td><strong>${s.name}</strong><br><small class="muted">${s.email}</small></td><td>${s.program}</td><td>${s.progress}%</td><td><span class="badge ${s.payment==="Paid"?"green":"gold"}">${s.payment}</span></td><td><span class="badge green">${s.status}</span></td></tr>`).join("")}</tbody></table></div></div>`;
}
function renderStudents(){
  const list=currentUser.role==="student" ? [] : data.students;
  $("#content").innerHTML=pageHead("Learners","Registered learner accounts. New learners create their own account from the public Create Account tab.")+
    (list.length?studentTable(list):emptyState("No learner records yet","Registered Students, Professionals and Business Owners will appear here."));
}
function showStudentModal(){
 showModal("Add Student","Create a new student record.",`
  <div class="grid-2"><label>Full name<input id="mStudentName"></label><label>Email<input id="mStudentEmail" type="email"></label></div>
  <div class="grid-2"><label>Programme<input id="mStudentProgram"></label><label>Payment status<select id="mStudentPayment"><option>Unpaid</option><option>Part Paid</option><option>Paid</option></select></label></div>
 `,()=>{
   const name=$("#mStudentName").value.trim(), email=$("#mStudentEmail").value.trim(), program=$("#mStudentProgram").value.trim();
   if(!name||!email||!program) return alert("Please complete all fields.");
   data.students.push({id:`EDA-ST-${String(data.students.length+1).padStart(4,"0")}`,name,email,program,status:"Active",progress:0,payment:$("#mStudentPayment").value});
   persist(); closeModal(); renderStudents();
 });
}
function renderParents(){
 $("#content").innerHTML=pageHead("Parents & Guardians","Manage parent accounts and linked students.",`<button class="primary-btn">+ Add Parent</button>`)+`
 <div class="card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Parent</th><th>Email</th><th>Linked Students</th><th>Status</th></tr></thead><tbody>
 <tr><td><strong>Mrs. Yusuf</strong></td><td>parent@example.com</td><td>Amina Yusuf</td><td><span class="badge green">Active</span></td></tr>
 </tbody></table></div></div>`;
}
function renderInstructors(){
 const rows=data.instructors||[];
 $("#content").innerHTML=pageHead("Instructors","View instructor accounts and teaching staff.",`<button class="primary-btn" id="manageInstructorStaffBtn">Manage Staff Accounts</button>`)+
 (rows.length?`<div class="card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Name</th><th>Email</th><th>Specialization</th><th>Status</th></tr></thead><tbody>${rows.map(i=>`<tr><td><strong>${i.name}</strong></td><td>${i.email||"—"}</td><td>${i.specialization||"Assigned courses"}</td><td><span class="badge green">${i.status||"Active"}</span></td></tr>`).join("")}</tbody></table></div></div>`:emptyState("No instructor accounts yet","Create Instructor accounts securely from Staff Management."));
 $("#manageInstructorStaffBtn").onclick=()=>navigate("staff");
}
async function renderStaff(){
  if(!["admin","super_admin"].includes(currentUser.role)){
    $("#content").innerHTML=emptyState("Access restricted","Only Admin and Super Admin can manage staff accounts.");
    return;
  }
  let staff=[];
  try{
    if(window.ETHAN_BACKEND?.ready) staff=await window.ETHAN_BACKEND.listStaff();
  }catch(err){ console.warn(err); }
  const allowed=currentUser.role==="super_admin"?["admin","instructor"]:["instructor"];
  $("#content").innerHTML=pageHead("Staff Management","Create secure staff accounts. Staff sign in through the same Sign In form and are routed by role.",`<button class="primary-btn" id="createStaffBtn">+ Create Staff Account</button>`)+`
  <div class="card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead><tbody>${staff.length?staff.map(x=>`<tr><td><strong>${[x.first_name,x.last_name].filter(Boolean).join(" ")||"Staff User"}</strong></td><td>${x.email||"—"}</td><td><span class="badge blue">${String(x.role||"").replace("_"," ")}</span></td><td><span class="badge green">Active</span></td></tr>`).join(""):`<tr><td colspan="4">No staff records loaded yet.</td></tr>`}</tbody></table></div></div>`;
  $("#createStaffBtn").onclick=()=>showModal("Create Staff Account","Create an Admin or Instructor account. A temporary password can be changed later with Forgot Password.",`
    <div class="grid-2"><label>First name<input id="staffFirst" required></label><label>Last name<input id="staffLast" required></label></div>
    <label>Email address<input id="staffEmail" type="email" required></label>
    <label>Phone number<input id="staffPhone" type="tel"></label>
    <label>Role<select id="staffRole">${allowed.map(r=>`<option value="${r}">${r==="admin"?"Admin":"Instructor"}</option>`).join("")}</select></label>
    <label>Temporary password<input id="staffPassword" type="password" minlength="8" required></label>
    <p class="muted">For security, public users cannot register as staff.</p>
  `,async()=>{
    const payload={firstName:$("#staffFirst").value.trim(),lastName:$("#staffLast").value.trim(),email:$("#staffEmail").value.trim().toLowerCase(),phone:$("#staffPhone").value.trim(),role:$("#staffRole").value,password:$("#staffPassword").value};
    if(!payload.firstName||!payload.lastName||!payload.email||payload.password.length<8) return alert("Complete the required fields. Password must be at least 8 characters.");
    try{
      await window.ETHAN_BACKEND.createStaff(payload);
      closeModal(); alert(`${payload.role==="admin"?"Admin":"Instructor"} account created. The staff member can now sign in with the same login page.`); renderStaff();
    }catch(err){ alert(err.message||"Staff account could not be created. Make sure the create-staff Edge Function is deployed."); }
  });
}


/* v8.8 - Structured readable study notes for every course */
let currentStudyCourseTitle = "";

function escHtml(v){
  return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
}

function courseProfile(title){
 const t=String(title||"").toLowerCase();
 let domain="digital technology";
 let definition=`${title} is a structured professional subject that develops the knowledge, methods and practical skills needed to use its concepts effectively in academic, workplace and business environments.`;
 let concepts=["Foundations and terminology","Purpose and professional applications","Core tools and features","Planning and workflow","Practical implementation","Quality control","Common mistakes","Performance measurement","Professional best practice","Continuous improvement"];
 let tools=["Relevant computer or mobile application","Practice files and guided exercises","Internet access where required","Spreadsheet or documentation tool for recording work"];
 let scenario=`Ethan Digital Academy wants to apply ${title} to improve a real learning, workplace or business process. The learner must identify the problem, define the objective, choose appropriate tools, complete the work, measure the result and recommend improvements.`;

 if(/digital marketing/.test(t)){
   domain="digital marketing";
   definition="Digital marketing is the planned use of digital channels, content, technology and measurable data to attract, engage, convert and retain customers.";
   concepts=["Customer and audience research","Marketing objectives and SMART goals","Digital marketing funnel","Content strategy and content pillars","Search engine optimization (SEO)","Social media marketing","Email marketing","Paid media fundamentals","Landing pages and conversion","Analytics, KPIs and optimization"];
   tools=["Website or landing page","Search and SEO tools","Social media platforms","Email marketing platform","Canva or another design tool","Spreadsheet or analytics dashboard"];
 } else if(/excel|google sheets|data|power bi|statistics|dashboard|reporting|business intelligence/.test(t)){
   domain="data and analytics";
   definition=`${title} develops the ability to organize, calculate, analyze, interpret and present information so that data can support reliable decisions.`;
   concepts=["Data structure","Accurate data entry","Cleaning and validation","Calculations and measures","Sorting and filtering","Analysis","Visualization","Dashboards","Interpretation","Reporting and decision-making"];
   tools=["Microsoft Excel, Google Sheets or the relevant analytics tool","Practice datasets","Calculator where appropriate","Reporting template"];
 } else if(/word|document/.test(t)){
   domain="document productivity";
   definition=`${title} focuses on creating, formatting, reviewing and presenting professional documents accurately and consistently.`;
   concepts=["Document planning","Page setup","Text formatting","Styles and hierarchy","Tables and objects","Headers and footers","Review and collaboration","References","Export and printing","Document standards"];
   tools=["Microsoft Word or compatible word processor","Practice documents","PDF reader"];
 } else if(/powerpoint|presentation/.test(t)){
   domain="professional presentation";
   definition=`${title} is the structured use of slides, text, visuals and delivery techniques to communicate information clearly to an audience.`;
   concepts=["Audience and purpose","Message hierarchy","Slide structure","Typography","Visual communication","Charts and media","Transitions","Speaker preparation","Accessibility","Presentation review"];
   tools=["Microsoft PowerPoint or compatible presentation software","Image/chart resources","Presentation display where available"];
 } else if(/canva|graphic|photoshop|coreldraw|logo|brand|figma|ui\/ux/.test(t)){
   domain="creative design";
   definition=`${title} applies visual communication principles and digital tools to create clear, attractive and purposeful designs.`;
   concepts=["Design purpose","Audience","Visual hierarchy","Typography","Colour","Alignment and spacing","Images and graphics","Brand consistency","Usability","Export and quality control"];
   tools=["Relevant design application","Brand assets","Image resources","Practice design brief"];
 } else if(/video|capcut|photography|storytelling|content creation/.test(t)){
   domain="digital media production";
   definition=`${title} covers the planning, creation, editing and delivery of visual or audiovisual media for education, communication or marketing.`;
   concepts=["Purpose and audience","Pre-production planning","Composition","Lighting","Audio","Editing","Story structure","Captions","Publishing formats","Performance review"];
   tools=["Phone or camera","Relevant editing application","Microphone where available","Media storage"];
 } else if(/facebook|instagram|tiktok|youtube|linkedin|social media|whatsapp|content marketing|email marketing|influencer|affiliate|personal branding|reputation/.test(t)){
   domain="online marketing and communication";
   definition=`${title} is the planned use of relevant digital communication channels to reach a defined audience, build relationships and support measurable objectives.`;
   concepts=["Audience research","Account or channel optimization","Content strategy","Content pillars","Publishing formats","Community engagement","Calls to action","Lead generation","Analytics","Optimization"];
   tools=["Relevant platform","Content calendar","Design/video tool","Analytics dashboard","Spreadsheet"];
 } else if(/seo|search engine|google ads|meta ads|marketing analytics/.test(t)){
   domain="performance marketing";
   definition=`${title} uses structured research, digital platforms and measurable performance data to improve online visibility, traffic, leads or conversions.`;
   concepts=["Search or audience intent","Research","Campaign objectives","Targeting","Content or creative","Landing experience","Measurement","KPIs","Optimization","Reporting"];
   tools=["Relevant advertising/search platform","Analytics tool","Website or landing page","Spreadsheet"];
 } else if(/artificial intelligence|ai |chatgpt|prompt engineering|generative/.test(t)){
   domain="artificial intelligence";
   definition=`${title} develops practical understanding of AI systems and how they can be used responsibly to support research, productivity, content and business workflows.`;
   concepts=["AI capabilities and limitations","Prompt design","Context","Output evaluation","Fact checking","Privacy","Responsible use","Workflow integration","Automation","Human review"];
   tools=["Approved AI assistant","Source documents","Productivity tools","Verification sources"];
 } else if(/python|javascript|programming|software development|api|git|github/.test(t)){
   domain="software and programming";
   definition=`${title} develops structured problem-solving skills for creating, understanding, testing or managing software and digital systems.`;
   concepts=["Problem definition","Logic","Data and variables","Conditions","Repetition","Functions","Input and output","Testing","Debugging","Documentation"];
   tools=["Code editor","Browser or relevant runtime","Practice exercises","Version-control tools where relevant"];
 } else if(/web|html|css|wordpress|e-commerce website|landing page|hosting|domain/.test(t)){
   domain="web technology";
   definition=`${title} covers the planning, creation, publication and maintenance of useful web-based information or services.`;
   concepts=["Purpose and audience","Information architecture","Page structure","Content","Responsive design","Usability","Domains and hosting","Security","Performance","Maintenance"];
   tools=["Browser","Code editor or website builder","Hosting environment where required","Testing checklist"];
 } else if(/cybersecurity|security|hardware|maintenance|it support|windows|file management|cloud storage|computer/.test(t)){
   domain="IT and digital operations";
   definition=`${title} develops practical knowledge for using, supporting, maintaining or protecting computer systems and digital information effectively.`;
   concepts=["System components","User needs","Configuration","Safe operation","Troubleshooting","Maintenance","Security","Backups","Documentation","Support procedure"];
   tools=["Computer","Operating-system tools","Relevant utilities","Practice checklist"];
 } else if(/business|entrepreneur|freelanc|remote work|project management|crm|erp|e-commerce/.test(t)){
   domain="digital business";
   definition=`${title} applies structured processes, digital tools and measurable decisions to improve professional or business performance.`;
   concepts=["Business objective","Customer or stakeholder needs","Process mapping","Digital tools","Roles and responsibilities","Records","Communication","KPIs","Risk and quality","Continuous improvement"];
   tools=["Productivity suite","Spreadsheet","Communication tools","Relevant business platform"];
 }

 return {
   domain,definition,concepts,tools,
   example:`A learner is given a realistic ${title} assignment. The learner first defines the required result, selects the appropriate tools, completes the task step by step, checks the work against professional standards and records the final outcome.`,
   caseStudy:`ETHAN DIGITAL ACADEMY — ${title.toUpperCase()} CASE STUDY

Situation:
Ethan Digital Academy wants to use ${title} to improve a realistic academic, professional or business activity.

Problem:
The current activity needs a clearer structure, better use of digital tools and a measurable way to judge success.

Objective:
Apply the principles of ${title} to produce a professional result that solves the identified problem.

Target users or stakeholders:
1. Learners who need practical digital competence.
2. Professionals who need efficient workplace methods.
3. Business owners who need better digital processes and measurable outcomes.

Approach:
- Define the problem and expected result.
- Identify the people affected by the work.
- Select the relevant ${title} concepts and tools.
- Plan the work before implementation.
- Complete the task using accepted professional practice.
- Check accuracy, usability, clarity and safety.
- Record evidence of the completed work.
- Measure the result using suitable indicators.
- Recommend improvements.

Evidence to collect:
Completed work, screenshots where appropriate, calculations or records, observations, decisions and a short evaluation.

Evaluation:
Success is determined by whether the completed work meets the original objective, is accurate and professional, and produces a useful result for the intended user. The learner should explain what worked, what did not work and what should be improved next time.`
 };
}
function buildCourseStudyGuide(title){
 const p=courseProfile(title);
 return {
   title,
   introduction:`This professional course introduces ${title} through structured explanation, guided examples, case-study analysis and practical application. Learners are expected to understand the subject, apply it to realistic tasks and evaluate the quality of their work. The course is designed for paid Ethan Digital Academy enrollees and connects knowledge directly to academic, workplace and business use.`,
   definition:p.definition,
   objectives:[
     `Explain the meaning, purpose and professional importance of ${title}.`,
     `Identify and explain the major concepts used in ${title}.`,
     `Select appropriate tools and resources for a ${title} task.`,
     `Plan a realistic ${title} activity before implementation.`,
     `Apply the correct workflow to complete a professional task.`,
     `Evaluate completed work using accuracy, clarity, usability and other relevant standards.`,
     `Recognize common mistakes, risks and weak practices in ${title}.`,
     `Use evidence and appropriate performance indicators to measure results.`,
     `Complete a practical ${title} project and explain the decisions made.`,
     `Recommend improvements after reviewing the final result.`
   ],
   concepts:p.concepts,
   tools:p.tools,
   example:p.example,
   caseStudy:p.caseStudy,
   practical:[
     `Choose a realistic academic, workplace or business problem connected to ${title}.`,
     "Write a clear objective and describe the expected result.",
     "Identify the intended user, customer or stakeholder.",
     `Select at least five relevant ${title} concepts from this course.`,
     "List the tools and resources required for the work.",
     "Create a short implementation plan before starting.",
     "Complete the practical work step by step.",
     "Keep suitable evidence such as screenshots, records, calculations, observations or design decisions.",
     "Check the final work for accuracy, clarity, usability and professionalism.",
     "Write a short evaluation explaining the result and at least three improvements."
   ],
   assessment:[
     `Define ${title} in your own words and explain why it is important.`,
     `Describe five important concepts used in ${title}.`,
     "Explain how you would choose the correct tools for a practical task.",
     `Give one realistic professional or business use of ${title}.`,
     "State three common mistakes that can reduce the quality of completed work.",
     "Explain how evidence or KPIs can be used to evaluate a result.",
     `Using the Ethan Digital Academy case study, explain the problem, objective, approach and expected result.`,
     `Prepare a one-page plan for a practical ${title} project.`
   ],
   summary:`${title} should be understood as both knowledge and practical competence. A professional learner must understand the terminology, plan the work, use appropriate tools, follow a clear process, check the quality of the output and evaluate the final result. Repeated practice and evidence-based improvement are essential to mastery.`
 };
}
function renderGuideHtml(g){
  const list=a=>`<ul>${a.map(x=>`<li>${escHtml(x)}</li>`).join("")}</ul>`;
  return `
    <header class="study-cover">
      <span class="eyebrow">ETHAN DIGITAL ACADEMY STUDY NOTE</span>
      <h1>${escHtml(g.title)}</h1>
      <p>Structured learning material for enrolled learners.</p>
    </header>
    <section><h2>1. Introduction</h2><p>${escHtml(g.introduction)}</p></section>
    <section><h2>2. Definition</h2><p>${escHtml(g.definition)}</p></section>
    <section><h2>3. Learning Objectives</h2>${list(g.objectives)}</section>
    <section><h2>4. Key Concepts</h2>${list(g.concepts)}</section>
    ${g.tools.length?`<section><h2>5. Tools and Resources</h2>${list(g.tools)}</section>`:""}
    <section><h2>${g.tools.length?"6":"5"}. Worked Example</h2><p>${escHtml(g.example)}</p></section>
    <section><h2>${g.tools.length?"7":"6"}. Case Study</h2><div class="study-case">${escHtml(g.caseStudy).replace(/\n/g,"<br>")}</div></section>
    <section><h2>${g.tools.length?"8":"7"}. Practical Activity</h2>${list(g.practical)}</section>
    <section><h2>${g.tools.length?"9":"8"}. Review Questions / Assessment</h2>${list(g.assessment)}</section>
    <section><h2>${g.tools.length?"10":"9"}. Summary</h2><p>${escHtml(g.summary)}</p></section>
  `;
}

function openCourseStudy(title){
  currentStudyCourseTitle=decodeURIComponent(title);
  if(currentUser?.role==="student"){
    const allocated=studentCourses().some(c=>String(c.title||"").trim().toLowerCase()===currentStudyCourseTitle.trim().toLowerCase());
    if(!allocated){
      alert("This course material is available only after verified payment and course allocation.");
      navigate("courses");
      return;
    }
  }else if(!canAccessAllCourseMaterials()){
    alert("You do not have permission to access this course material.");
    return;
  }
  const g=buildCourseStudyGuide(currentStudyCourseTitle);
  $("#content").innerHTML=pageHead("Course Study Note",
    isSuperAdmin() ? "Super Admin academic access: read, review and export the complete course material." :
    "Paid enrollee study material. Read online or save your personal study copy.",
    `<div class="study-actions"><button class="secondary-btn" id="downloadWordBtn">Download Word</button><button class="primary-btn" id="printPdfBtn">Save as PDF / Print</button></div>`)+
    `<article class="study-reader">${renderGuideHtml(g)}</article>`;
  $("#downloadWordBtn").onclick=()=>downloadCourseWord(g);
  $("#printPdfBtn").onclick=()=>printCoursePdf(g);
}

function downloadCourseWord(g){
  const styles=`<style>
  body{font-family:Arial,sans-serif;color:#1f2937;line-height:1.6;margin:40px}
  h1{color:#24496b;font-size:28px} h2{color:#24496b;margin-top:24px;font-size:20px}
  .study-case{background:#f4f7fa;padding:16px;border-left:4px solid #24496b}
  li{margin:6px 0}
  </style>`;
  const doc=`<!doctype html><html><head><meta charset="utf-8">${styles}</head><body>
  <p><strong>ETHAN DIGITAL ACADEMY</strong></p>${renderGuideHtml(g)}
  </body></html>`;
  const blob=new Blob(["\ufeff",doc],{type:"application/msword"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=`${g.title.replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"")}-Study-Note.doc`;
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

function printCoursePdf(g){
  const w=window.open("","_blank");
  if(!w){ alert("Please allow pop-ups to save the study note as PDF."); return; }
  w.document.write(`<!doctype html><html><head><title>${escHtml(g.title)} - Ethan Digital Academy</title>
  <style>
    @page{size:A4;margin:18mm}
    body{font-family:Arial,sans-serif;color:#1f2937;line-height:1.55}
    h1{color:#24496b;font-size:28px}h2{color:#24496b;font-size:19px;margin-top:24px;border-bottom:1px solid #e5e7eb;padding-bottom:6px}
    .eyebrow{font-size:11px;letter-spacing:1.4px;color:#9b7a3c;font-weight:700}
    .study-cover{padding-bottom:16px;border-bottom:2px solid #24496b;margin-bottom:24px}
    .study-case{background:#f6f8fa;padding:14px;border-left:4px solid #24496b}
    li{margin:5px 0}
  </style></head><body>${renderGuideHtml(g)}<script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`);
  w.document.close();
}

function courseCards(list){
 return `<div class="course-grid">${list.map(c=>{
   const encoded=encodeURIComponent(c.title||"Course");
   return `<article class="course-card"><div class="course-thumb"><strong>${c.category||"Course"}</strong></div><div class="course-body"><small class="muted">${c.code||""}</small><h3>${c.title}</h3><p class="muted">${c.instructor||"Ethan Digital Academy"}</p><div class="course-meta"><span>${c.duration||"Self-paced"}</span><span>${Number(c.progress||0)}%</span></div><div class="progress"><span style="width:${Number(c.progress||0)}%"></span></div><div class="course-card-actions"><button class="primary-btn" onclick="openCourseStudy('${encoded}')">${currentUser.role==="student"?"Read Course Note":"Preview Study Note"}</button><button class="secondary-btn" onclick="navigate('lms')">${currentUser.role==="student"?"Learning Area":"Course Builder"}</button></div></div></article>`;
 }).join("")}</div>`;
}
function renderCourses(){
 const add=(currentUser.role==="admin"||currentUser.role==="super_admin"||currentUser.role==="instructor")?`<button class="primary-btn" id="addCourseBtn">+ Create Course</button>`:"";
 $("#content").innerHTML=pageHead(currentUser.role==="student"?"My Courses":"Courses","Browse and manage the academy course catalogue.",add)+courseCards(data.courses);
 if($("#addCourseBtn")) $("#addCourseBtn").onclick=()=>showModal("Create Course","Add a course to the catalogue.",`
  <label>Course title<input id="courseTitle"></label><div class="grid-2"><label>Category<input id="courseCat"></label><label>Duration<input id="courseDur" placeholder="6 weeks"></label></div>
 `,()=>{
  const t=$("#courseTitle").value.trim(),cat=$("#courseCat").value.trim(),dur=$("#courseDur").value.trim();if(!t||!cat||!dur)return alert("Complete all fields.");
  data.courses.push({code:`EDA-CRS-${String(data.courses.length+1).padStart(3,"0")}`,title:t,category:cat,instructor:currentUser.name,duration:dur,progress:0,lessons:0,completed:0});persist();closeModal();renderCourses();
 });
}

const cyberLessons=[
 {title:"1. Introduction to Cybersecurity",body:`<h1>Introduction to Cybersecurity</h1><p>Cybersecurity is the practice of protecting computers, networks, applications, devices and information from unauthorized access, disruption, damage or theft.</p><h2>Learning objectives</h2><ul><li>Explain cybersecurity in simple terms.</li><li>Identify common digital assets that need protection.</li><li>Understand the role of people, processes and technology.</li></ul><div class="callout"><strong>Key idea:</strong> Cybersecurity is not only an IT issue. People, processes and technology must work together.</div>`},
 {title:"2. CIA Triad",body:`<h1>The CIA Triad</h1><p>The three core security objectives are confidentiality, integrity and availability.</p><h2>Confidentiality</h2><p>Only authorized people should access protected information.</p><h2>Integrity</h2><p>Information should remain accurate and should not be changed without authorization.</p><h2>Availability</h2><p>Authorized users should be able to access systems when needed.</p>`},
 {title:"3. Threats, Vulnerabilities & Risk",body:`<h1>Threats, Vulnerabilities & Risk</h1><p>A <strong>threat</strong> can cause harm. A <strong>vulnerability</strong> is a weakness. <strong>Risk</strong> is the possibility that a threat will exploit a vulnerability and create damage.</p><div class="callout">A simple model is: Risk ≈ Likelihood × Impact.</div>`},
 {title:"4. Password & Authentication Security",body:`<h1>Password & Authentication Security</h1><p>Use long, unique passwords or passphrases. Multi-factor authentication adds another independent verification factor.</p><h2>Authentication factors</h2><ul><li>Something you know</li><li>Something you have</li><li>Something you are</li></ul>`},
 {title:"5. Network Security",body:`<h1>Network Security</h1><p>Network security protects connected systems and the information moving between them.</p><h2>Common controls</h2><ul><li>Firewalls</li><li>Secure Wi-Fi</li><li>Network segmentation</li><li>Monitoring</li><li>Secure remote access</li></ul>`}
];
let lessonIndex=0;
function renderLMS(){
 $("#content").innerHTML=pageHead(currentUser.role==="instructor"?"Course Builder":"Learning Classroom","Study structured lessons and track your progress.")+`
 <div class="lesson-layout">
  <aside class="lesson-menu">${cyberLessons.map((l,i)=>`<button data-lesson="${i}" class="${i===lessonIndex?"active":""}">${l.title}</button>`).join("")}</aside>
  <article class="lesson-content">
    <small class="eyebrow">CYBERSECURITY FUNDAMENTALS</small>
    ${cyberLessons[lessonIndex].body}
    <h3>Practical activity</h3><p>Review the security settings on one of your own accounts or devices. Record which protections are enabled, such as a strong password, screen lock, updates and multi-factor authentication.</p>
    <div class="lesson-nav"><button class="secondary-btn" id="prevLesson" ${lessonIndex===0?"disabled":""}>← Previous</button><button class="primary-btn" id="completeLesson">${lessonIndex===cyberLessons.length-1?"Complete Lesson":"Mark Complete & Next →"}</button></div>
  </article>
 </div>`;
 $$(".lesson-menu button").forEach(b=>b.onclick=()=>{lessonIndex=+b.dataset.lesson;renderLMS()});
 $("#prevLesson").onclick=()=>{if(lessonIndex>0){lessonIndex--;renderLMS()}};
 $("#completeLesson").onclick=()=>{if(lessonIndex<cyberLessons.length-1){lessonIndex++;renderLMS()}else alert("Lesson completed. Your learning progress has been saved in this browser preview.")};
}
function renderAssignments(){
 $("#content").innerHTML=pageHead("Assignments","View, submit and grade practical learning tasks.",currentUser.role==="admin"||currentUser.role==="instructor"?`<button class="primary-btn">+ Create Assignment</button>`:"")+`
 <div class="card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Assignment</th><th>Course</th><th>Due Date</th><th>Status</th><th>Score</th></tr></thead><tbody>
 <tr><td>Security Awareness Audit</td><td>Cybersecurity Fundamentals</td><td>18 Sep 2026</td><td><span class="badge gold">In Progress</span></td><td>—</td></tr>
 <tr><td>Excel Sales Dashboard</td><td>Microsoft Excel Mastery</td><td>20 Sep 2026</td><td><span class="badge blue">Submitted</span></td><td>Pending</td></tr>
 </tbody></table></div></div>`;
}
function renderQuizzes(){
 $("#content").innerHTML=pageHead("Quizzes & Examinations","Assessment centre for quizzes and examinations.",currentUser.role==="admin"||currentUser.role==="instructor"?`<button class="primary-btn">+ Create Quiz</button>`:"")+`
 <div class="course-grid">
  <div class="course-card"><div class="course-body"><span class="badge blue">Quiz</span><h3>Cybersecurity Module 1</h3><p class="muted">10 questions • 15 minutes • Pass mark 60%</p><button class="primary-btn">Start Quiz</button></div></div>
  <div class="course-card"><div class="course-body"><span class="badge gold">Exam</span><h3>Excel Final Assessment</h3><p class="muted">25 questions • 45 minutes • Pass mark 70%</p><button class="secondary-btn">View Details</button></div></div>
 </div>`;
}
function renderAttendance(){
 $("#content").innerHTML=pageHead("Attendance","Monitor attendance across courses and classes.",currentUser.role==="admin"||currentUser.role==="instructor"?`<button class="primary-btn">Mark Attendance</button>`:"")+`
 <div class="stats-grid">${stat("Present","42","Today","✅")}${stat("Absent","3","Today","✕")}${stat("Late","2","Today","⏱")}${stat("Rate","89%","This month","📈")}</div>
 ${studentTable(data.students)}`;
}
function renderTimetable(){
 $("#content").innerHTML=pageHead("Timetable","Today's and upcoming classes.")+`
 <div class="card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Day</th><th>Course</th><th>Instructor</th><th>Time</th><th>Mode</th></tr></thead><tbody>
 <tr><td>Monday</td><td>Cybersecurity Fundamentals</td><td>Daniel Peter</td><td>10:00 – 12:00</td><td><span class="badge blue">Classroom</span></td></tr>
 <tr><td>Tuesday</td><td>Microsoft Excel Mastery</td><td>Mariam Bello</td><td>13:00 – 15:00</td><td><span class="badge green">Online</span></td></tr>
 </tbody></table></div></div>`;
}
function renderPayments(){
 $("#content").innerHTML=pageHead("Fees & Payments","Track fees, balances, transactions and receipts.",currentUser.role==="admin"?`<button class="primary-btn" id="recordPaymentBtn">+ Record Payment</button>`:"")+`
 <div class="stats-grid">${stat("Total Expected","₦250,000","Current records","💰")}${stat("Received","₦175,000","Confirmed","✅")}${stat("Outstanding","₦75,000","Remaining","⏳")}${stat("Payment Rate","70%","Current","📈")}</div>
 <div class="card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Reference</th><th>Student</th><th>Description</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead><tbody>${data.payments.map(p=>`<tr><td>${p.ref}</td><td>${p.student}</td><td>${p.description}</td><td>₦${p.amount.toLocaleString()}</td><td>${p.date}</td><td><span class="badge green">${p.status}</span></td></tr>`).join("")}</tbody></table></div></div>`;
 if($("#recordPaymentBtn")) $("#recordPaymentBtn").onclick=()=>showModal("Record Payment","Record a verified manual payment.",`
 <label>Student<select id="payStudent">${data.students.map(s=>`<option>${s.name}</option>`).join("")}</select></label><label>Description<input id="payDesc"></label><label>Amount<input id="payAmount" type="number"></label>
 `,()=>{const amount=+$("#payAmount").value;if(!amount)return alert("Enter a valid amount.");data.payments.unshift({ref:`EDA-PAY-${1000+data.payments.length+1}`,student:$("#payStudent").value,description:$("#payDesc").value||"Training Fee",amount,date:new Date().toISOString().slice(0,10),status:"Confirmed"});persist();closeModal();renderPayments()});
}
function renderResults(){
 $("#content").innerHTML=pageHead("Results","Academic assessment results and performance.")+`
 <div class="card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Course</th><th>Assessment</th><th>Score</th><th>Grade</th><th>Status</th></tr></thead><tbody>
 <tr><td>Cybersecurity Fundamentals</td><td>Module 1 Quiz</td><td>82%</td><td>A</td><td><span class="badge green">Passed</span></td></tr>
 <tr><td>Microsoft Excel Mastery</td><td>Practical 2</td><td>76%</td><td>B</td><td><span class="badge green">Passed</span></td></tr>
 </tbody></table></div></div>`;
}
function renderCertificates(){
 $("#content").innerHTML=pageHead("Certificates","Issue, manage and verify course certificates.",currentUser.role==="admin"?`<button class="primary-btn">Issue Certificate</button>`:"")+`
 <div class="card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Certificate ID</th><th>Student</th><th>Course</th><th>Issue Date</th><th>Status</th></tr></thead><tbody>
 <tr><td>EDA-CERT-2026-001</td><td>${currentUser.role==="student"?currentUser.name:"Grace Adewale"}</td><td>Digital Skills Foundation</td><td>05 Sep 2026</td><td><span class="badge green">Valid</span></td></tr>
 </tbody></table></div></div>`;
}
function renderAnnouncements(){
 $("#content").innerHTML=pageHead("Announcements","Academy updates and important information.",currentUser.role==="admin"||currentUser.role==="instructor"?`<button class="primary-btn" id="newAnnouncementBtn">+ New Announcement</button>`:"")+`
 <div class="progress-list">${data.announcements.map(a=>`<div class="card"><strong>${a.title}</strong><p>${a.message}</p><small class="muted">${a.date}</small></div>`).join("")}</div>`;
 if($("#newAnnouncementBtn")) $("#newAnnouncementBtn").onclick=()=>showModal("New Announcement","Publish an academy announcement.",`<label>Title<input id="annTitle"></label><label>Message<textarea id="annMsg" rows="4"></textarea></label>`,()=>{if(!$("#annTitle").value.trim()||!$("#annMsg").value.trim())return alert("Complete title and message.");data.announcements.unshift({title:$("#annTitle").value.trim(),message:$("#annMsg").value.trim(),date:"Today"});persist();closeModal();renderAnnouncements()});
}
function renderReports(){
 $("#content").innerHTML=pageHead("Reports","Academy reporting across students, finance and learning.")+`
 <div class="quick-grid">${["Student Enrolment","Course Completion","Attendance","Payments & Revenue","Outstanding Fees","Academic Performance"].map(x=>`<div class="quick-card"><strong>${x}</strong><p class="muted">View report</p><button class="secondary-btn">Open</button></div>`).join("")}</div>`;
}
function renderSettings(){
 $("#content").innerHTML=pageHead("Settings","Configure academy, academic, payment and security preferences.")+`
 <div class="dashboard-grid">
 <div class="card"><h3>General Settings</h3><label>Academy Name<input value="Ethan Digital Academy" style="width:100%;padding:11px;border:1px solid var(--line);border-radius:10px"></label><br><br><label>Website<input value="https://ethandigitalacademy.org" style="width:100%;padding:11px;border:1px solid var(--line);border-radius:10px"></label><br><br><button class="primary-btn">Save Settings</button></div>
 <div class="card"><h3>Platform Status</h3><p><span class="badge green">Frontend Ready</span></p><p><span class="badge gold">Backend connection pending</span></p><p class="muted">Add your Supabase project details to config.js to connect production authentication and database services.</p></div>
 </div>`;
}
function renderProfile(){
 $("#content").innerHTML=pageHead("Profile","Your account and personal information.")+`
 <div class="card"><div style="display:flex;gap:16px;align-items:center"><div class="avatar" style="width:72px;height:72px;font-size:23px">${initials(currentUser.name)}</div><div><h2 style="margin:0">${currentUser.name}</h2><p class="muted">${currentUser.email}</p><span class="badge blue">${currentUser.role}</span></div></div></div>`;
}
function renderNotifications(){
 $("#notificationList").innerHTML=data.notifications.map(n=>`<div class="notification-item"><strong>${n.title}</strong><div>${n.message}</div><small>${n.time}</small></div>`).join("");
}
function persist(){localStorage.setItem(STORE.data,JSON.stringify(data))}
function showModal(title,desc,body,onSave){
 const el=document.createElement("div");el.className="modal-backdrop";el.id="activeModal";el.innerHTML=`<div class="modal"><div class="card-head"><div><h3>${title}</h3><p class="muted">${desc}</p></div><button class="icon-btn" id="modalClose">✕</button></div>${body}<div class="modal-actions"><button class="secondary-btn" id="modalCancel">Cancel</button><button class="primary-btn" id="modalSave">Save</button></div></div>`;
 document.body.appendChild(el); $("#modalClose").onclick=closeModal;$("#modalCancel").onclick=closeModal;$("#modalSave").onclick=onSave;
}
function closeModal(){const m=$("#activeModal");if(m)m.remove()}

(async function restore(){
 if(window.ETHAN_BACKEND?.ready){
   try{
     const session=await window.ETHAN_BACKEND.getSession();
     if(session?.user){
       let profile=null; try{profile=await window.ETHAN_BACKEND.getProfile(session.user.id)}catch(_){}
       const user={firstName:profile?.first_name||"Ethan",lastName:profile?.last_name||"User",name:`${profile?.first_name||"Ethan"} ${profile?.last_name||"User"}`,email:session.user.email,phone:profile?.phone||"",role:resolveAuthenticatedRole(session.user,profile),learnerType:session.user.user_metadata?.learner_type||session.user.user_metadata?.learnerType||"student",id:session.user.id};
       openPortal(user); return;
     }
   }catch(_){}
 }
 const s=JSON.parse(localStorage.getItem(STORE.session)||"null"); if(!s)return;
 const user=getUsers().find(u=>u.email===s.email); if(user)openPortal(user);
})();

if("serviceWorker" in navigator){
  window.addEventListener("load", async ()=>{
    try{
      const reg = await navigator.serviceWorker.register("./sw.js",{updateViaCache:"none"});
      await reg.update();
    }catch(_){}
  });
}


/* v5: payment-controlled course allocation */


const ETHAN_APPROVED_BANKS = [
  {bank:"United Bank for Africa (UBA)", accountNumber:"1021643438"},
  {bank:"Kuda Microfinance Bank", accountNumber:"3003847218"}
];
function approvedBankPaymentHtml(){
 return `<section class="approved-payment-box">
   <div class="approved-payment-head">
     <span class="eyebrow">APPROVED PAYMENT ACCOUNTS</span>
     <h3>Bank Transfer Details</h3>
     <p>Make course payments only to one of the approved Ethan Digital Academy bank accounts below. Course access is activated after payment verification and allocation.</p>
   </div>
   <div class="approved-bank-grid">
     ${ETHAN_APPROVED_BANKS.map(b=>`<div class="approved-bank">
       <small>BANK</small><strong>${b.bank}</strong>
       <small>ACCOUNT NUMBER</small><div class="bank-account-number">${b.accountNumber}</div>
     </div>`).join("")}
   </div>
   <div class="payment-warning"><strong>Important:</strong> Keep your transfer receipt or payment reference. Payment does not automatically unlock a course until it has been verified by an authorized administrator.</div>
 </section>`;
}


/* v9.2 - Super Admin full academic access */
function isSuperAdmin(){
  return currentUser?.role === "super_admin";
}
function canAccessAllCourseMaterials(){
  return ["super_admin","admin","instructor"].includes(currentUser?.role||"");
}
function canCreateCourses(){
  return ["super_admin","admin","instructor"].includes(currentUser?.role||"");
}
function allAcademyCoursesForStaff(){
  const dbCourses = Array.isArray(data.courses) ? data.courses : [];
  const seen = new Set(dbCourses.map(c=>String(c.title||"").trim().toLowerCase()));
  const catalogueCourses = ETHAN_PUBLIC_COURSES
    .filter(c=>!seen.has(String(c.name||"").trim().toLowerCase()))
    .map((c,i)=>({
      id:`catalogue-${i+1}`,
      code:`EDA-${String(i+1).padStart(3,"0")}`,
      title:c.name,
      duration:"Self-paced",
      progress:0,
      published:true,
      catalogue:true
    }));
  return [...dbCourses, ...catalogueCourses];
}

function getPublicCourseByTitle(title){
  return ETHAN_PUBLIC_COURSES.find(c=>String(c.name||"").trim().toLowerCase()===String(title||"").trim().toLowerCase());
}
function learnerCourseCard(c){
  const publicInfo=getPublicCourseByTitle(c.title)||{};
  const fee=publicInfo.feeNGN?formatCoursePrice(publicInfo.feeNGN):"";
  const encoded=encodeURIComponent(c.title||"Course");
  const progress=Math.max(0,Math.min(100,Number(c.progress||0)));
  return `<article class="learner-course-card">
    <div class="learner-course-card-top">
      <span class="course-status-badge">PAID • ACTIVE</span>
      <span class="course-progress-label">${progress}%</span>
    </div>
    <div class="learner-course-icon">${escHtml((c.title||"DC").split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase())}</div>
    <small>${escHtml(c.code||"DIGITAL COURSE")}</small>
    <h3>${escHtml(c.title||"Course")}</h3>
    <p>${escHtml(publicInfo.brief||"Your allocated Ethan Digital Academy course.")}</p>
    <div class="learner-progress"><span style="width:${progress}%"></span></div>
    <div class="learner-course-meta">
      <span>${escHtml(c.duration||"Self-paced")}</span>
      ${fee?`<span>${escHtml(fee)}</span>`:""}
    </div>
    <div class="learner-course-actions">
      <button class="primary-btn" onclick="openCourseStudy('${encoded}')">Open Course</button>
      <button class="secondary-btn" onclick="navigate('lms')">Learning Area</button>
    </div>
  </article>`;
}
function lockedCatalogueCard(c){
  return `<article class="catalogue-lock-card">
    <div>
      <span class="lock-chip">LOCKED</span>
      <h4>${escHtml(c.name)}</h4>
      <p>${escHtml(c.brief)}</p>
    </div>
    <div class="catalogue-lock-footer">
      <strong>${formatCoursePrice(c.feeNGN)}</strong>
      <button class="secondary-btn" onclick="navigate('payments')">Enrol / Pay</button>
    </div>
  </article>`;
}
function renderStudentHome(){
  const courses=studentCourses();
  const learnerLabel=portalRoleLabel(currentUser);
  const firstName=escHtml(currentUser.firstName||currentUser.name||"Learner");
  const paidCount=courses.length;
  const avgProgress=paidCount?Math.round(courses.reduce((s,c)=>s+Number(c.progress||0),0)/paidCount):0;

  $("#content").innerHTML=`
    <section class="student-home-hero">
      <div>
        <span class="eyebrow">ETHAN DIGITAL ACADEMY</span>
        <h1>Welcome, ${firstName}</h1>
        <p>${escHtml(learnerLabel)} learning portal. Your paid digital courses, study materials and learning progress are all in one place.</p>
      </div>
      <div class="student-home-profile">
        <small>ACCOUNT TYPE</small>
        <strong>${escHtml(learnerLabel)}</strong>
      </div>
    </section>

    <section class="student-home-stats">
      <div><small>PAID COURSES</small><strong>${paidCount}</strong></div>
      <div><small>AVERAGE PROGRESS</small><strong>${avgProgress}%</strong></div>
      <div><small>LEARNING ACCESS</small><strong>${paidCount?"Active":"Locked"}</strong></div>
      <div><small>COURSE CATALOGUE</small><strong>100</strong></div>
    </section>

    <section class="student-section">
      <div class="student-section-head">
        <div>
          <span class="eyebrow">MY LEARNING</span>
          <h2>My Digital Courses</h2>
          <p>These are the courses allocated to your account after payment verification.</p>
        </div>
        <button class="secondary-btn" onclick="navigate('courses')">View My Courses</button>
      </div>
      ${courses.length
        ? `<div class="learner-course-grid">${courses.map(learnerCourseCard).join("")}</div>`
        : `<div class="student-empty-panel">
            <div>
              <span class="empty-icon">ED</span>
              <h3>No paid course allocated yet</h3>
              <p>Your account is active, but learning materials remain locked until payment is verified and a course is allocated to you.</p>
            </div>
            <button class="primary-btn" onclick="navigate('payments')">View Enrolment & Payment</button>
          </div>`
      }
    </section>

    <section class="student-section">
      <div class="student-section-head">
        <div>
          <span class="eyebrow">EXPLORE ETHAN</span>
          <h2>Digital Courses</h2>
          <p>Browse Ethan Digital Academy courses. Course materials remain locked until payment and allocation.</p>
        </div>
        <div class="student-catalogue-tools">
          <select id="insideCourseCurrency">
            <option value="NGN">₦ Naira</option>
            <option value="USD">$ USD</option>
            <option value="GBP">£ Pounds</option>
            <option value="EUR">€ EUR</option>
          </select>
          <input id="insideCourseSearch" placeholder="Search digital courses..." />
        </div>
      </div>
      <div id="insideCourseGrid" class="inside-catalogue-grid">
        ${ETHAN_PUBLIC_COURSES.slice(0,12).map(lockedCatalogueCard).join("")}
      </div>
      <div class="student-catalogue-more">
        <button class="secondary-btn" id="showAllInsideCourses">View All 100 Digital Courses</button>
      </div>
    </section>

    <section class="student-section">
      ${approvedBankPaymentHtml()}
    </section>

    <section class="student-section student-quick-links">
      <div class="student-section-head">
        <div>
          <span class="eyebrow">LEARNING PORTAL</span>
          <h2>Quick Access</h2>
        </div>
      </div>
      <div class="quick-access-grid">
        <button onclick="navigate('lms')"><strong>Learning Area</strong><span>Open paid study materials</span></button>
        <button onclick="navigate('payments')"><strong>Payments</strong><span>Check payment status</span></button>
        <button onclick="navigate('assignments')"><strong>Assignments</strong><span>View course assignments</span></button>
        <button onclick="navigate('certificates')"><strong>Certificates</strong><span>View earned certificates</span></button>
      </div>
    </section>`;

  const search=$("#insideCourseSearch");
  const currency=$("#insideCourseCurrency");
  const grid=$("#insideCourseGrid");
  const showAll=$("#showAllInsideCourses");
  let showingAll=false;

  function repaintInsideCourses(){
    const q=(search?.value||"").trim().toLowerCase();
    const source=q||showingAll?ETHAN_PUBLIC_COURSES:ETHAN_PUBLIC_COURSES.slice(0,12);
    const filtered=source.filter(c=>!q || `${c.name} ${c.brief}`.toLowerCase().includes(q));
    grid.innerHTML=filtered.map(lockedCatalogueCard).join("") || `<div class="student-empty-panel"><div><h3>No matching course</h3><p>Try another course name or keyword.</p></div></div>`;
  }
  if(currency){
    currency.value=ethanDisplayCurrency;
    currency.onchange=()=>{updateCatalogueCurrency(currency.value);repaintInsideCourses();};
  }
  if(search) search.oninput=repaintInsideCourses;
  if(showAll) showAll.onclick=()=>{showingAll=!showingAll;showAll.textContent=showingAll?"Show Fewer Courses":"View All 100 Digital Courses";repaintInsideCourses();};
}

function renderDashboard(){
  if(currentUser?.role==="student"){ renderStudentHome(); return; }
  renderDashboardLegacy();
  if(isSuperAdmin()){
    const host=$("#content");
    if(host){
      host.insertAdjacentHTML("afterbegin",`<section class="superadmin-academic-panel">
        <div>
          <span class="eyebrow">SUPER ADMIN ACADEMIC CONTROL</span>
          <h2>Full Course & Learning Access</h2>
          <p>Access every course, open complete study materials, export PDF/Word copies and create new courses.</p>
        </div>
        <div class="superadmin-actions">
          <button class="primary-btn" onclick="navigate('lms')">Open All Courses</button>
          <button class="secondary-btn" onclick="openCreateCourseForm()">Create Course</button>
        </div>
      </section>`);
    }
  }
}
function renderDashboardLegacy(){
 const role=currentUser.role;
 if(role==="student"){
   const courses=studentCourses();
   if(!courses.length){
     $("#content").innerHTML=`
       <div class="hero-card"><div><span class="eyebrow" style="color:#a9cfff">WELCOME TO ETHAN DIGITAL ACADEMY</span><h1>Welcome, ${currentUser.firstName}</h1><p>Your account is ready. You have not been allocated any course yet.</p></div><button class="secondary-btn" onclick="navigate('payments')">Payment Status</button></div>
       <div class="stats-grid">${stat("My Courses","0","Awaiting allocation","📚")}${stat("Learning Progress","0%","No course started","📈")}${stat("Assignments","0","No active course","📝")}${stat("Certificates","0","Earn after completion","🎓")}</div>
       ${emptyState("No courses allocated yet","To begin learning, complete the required payment with Ethan Digital Academy. After payment is verified, an Admin will allocate your approved course and its lessons/videos to this account.",`<button class="primary-btn" onclick="navigate('payments')">View Fees & Payment Status</button>`)}
     `;
     return;
   }
   const avg=Math.round(courses.reduce((a,c)=>a+Number(c.progress||0),0)/courses.length);
   $("#content").innerHTML=`
      <div class="hero-card"><div><span class="eyebrow" style="color:#a9cfff">MY LEARNING</span><h1>Welcome back, ${currentUser.firstName}</h1><p>Your allocated courses are ready. Continue from your assigned learning materials.</p></div><button class="secondary-btn" onclick="navigate('lms')">Continue Learning</button></div>
      <div class="stats-grid">${stat("My Courses",String(courses.length),"Allocated by academy","📚")}${stat("Average Progress",avg+"%","Across allocated courses","📈")}${stat("Assignments","0","Shown when assigned","📝")}${stat("Certificates","0","Issued after completion","🎓")}</div>
      <div class="card"><div class="card-head"><h3>My Allocated Courses</h3></div>${courseCards(courses)}</div>`;
   return;
 }
 if(role==="admin" || role==="super_admin"){
   $("#content").innerHTML=`
      <div class="hero-card"><div><span class="eyebrow" style="color:#a9cfff">ACADEMY OVERVIEW</span><h1>Welcome back, ${currentUser.firstName}</h1><p>Manage registrations, verify payments and allocate courses before learning access is opened.</p></div><div class="hero-actions"><button class="secondary-btn" onclick="navigate('students')">Manage Students</button><button class="secondary-btn" onclick="navigate('payments')">Verify & Allocate</button></div></div>
      <div class="stats-grid">${stat("Registered Students",data.students.length,"Learner records","👥")}${stat("Course Catalogue",data.courses.length,"Available courses","📚")}${stat("Instructors",data.instructors.length,"Teaching staff","🧑‍🏫")}${stat("Access Rule","Payment","Before allocation","🔐")}</div>
      <div class="dashboard-grid"><div class="card"><div class="card-head"><h3>Student Status</h3></div>${studentTable(data.students)}</div><div class="card"><div class="card-head"><h3>Admission Flow</h3></div><div class="progress-list"><div class="progress-row"><strong>1. Registration</strong><p class="muted">Student creates account with zero courses.</p></div><div class="progress-row"><strong>2. Payment verification</strong><p class="muted">Admin records and confirms payment.</p></div><div class="progress-row"><strong>3. Course allocation</strong><p class="muted">Admin selects the paid course and enrols the student.</p></div><div class="progress-row"><strong>4. Learning access</strong><p class="muted">Lessons and videos become available only for allocated courses.</p></div></div></div></div>`;
   return;
 }
 if(role==="parent"){
   $("#content").innerHTML=`<div class="hero-card"><div><span class="eyebrow" style="color:#a9cfff">PARENT PORTAL</span><h1>Welcome, ${currentUser.firstName}</h1><p>Follow linked children's approved learning, attendance, results and fees.</p></div></div>${emptyState("No sample academic records","Only real records linked to your children will appear here.")}`;
   return;
 }
 $("#content").innerHTML=`<div class="hero-card"><div><span class="eyebrow" style="color:#a9cfff">INSTRUCTOR PORTAL</span><h1>Welcome, ${currentUser.firstName}</h1><p>Manage only courses and students assigned by the academy.</p></div><button class="secondary-btn" onclick="navigate('lms')">Open Course Builder</button></div><div class="stats-grid">${stat("Assigned Courses","—","From Admin allocations","📚")}${stat("Assigned Students","—","Paid/enrolled learners","👥")}${stat("To Grade","0","Current submissions","📝")}${stat("Today's Classes","—","Check timetable","🕒")}</div>`;
}

function renderCourses(){
 const isStudent=currentUser.role==="student";
 const list=isStudent?studentCourses():data.courses;
 const canCreate=["admin","super_admin","instructor"].includes(currentUser.role);
 const add=canCreate?`<button class="primary-btn" id="addCourseBtn">+ Create Course</button>`:"";
 if(isStudent && !list.length){
   $("#content").innerHTML=pageHead("My Digital Courses","Only courses allocated after verified payment appear here.")+emptyState("No courses allocated","Your account has no active enrolment yet. Once payment is confirmed and Admin allocates a course, it will appear here automatically.",`<button class="primary-btn" onclick="navigate('payments')">Check Payment Status</button>`);
   return;
 }
 $("#content").innerHTML=pageHead(isStudent?"My Courses":"Courses",isStudent?"Your approved and allocated learning programmes.":"Manage the academy course catalogue.",add)+
   (list.length?courseCards(list):emptyState("No courses created yet","Create the first course when you are ready."));
 if($("#addCourseBtn")) $("#addCourseBtn").onclick=()=>showModal("Create Course","Add a course to the Academy catalogue.",`
  <label>Course title<input id="courseTitle"></label>
  <div class="grid-2"><label>Category / level<input id="courseCat" placeholder="Beginner"></label><label>Duration<input id="courseDur" placeholder="6 weeks"></label></div>
 `,async()=>{
  const t=$("#courseTitle").value.trim(),cat=$("#courseCat").value.trim(),dur=$("#courseDur").value.trim();
  if(!t||!cat||!dur)return alert("Complete all fields.");
  const code=`EDA-CRS-${Date.now().toString().slice(-6)}`;
  try{
    if(window.ETHAN_BACKEND?.ready){
      const c=await window.ETHAN_BACKEND.createCourse({code,title:t,difficulty:cat,duration:dur,published:false,created_by:currentUser.id});
      data.courses.unshift({id:c.id,code:c.code,title:c.title,category:c.difficulty||cat,instructor:currentUser.name,duration:c.duration||dur,progress:0,lessons:0,completed:0,fee:Number(c.fee||0),published:c.published});
    }else{
      data.courses.unshift({code,title:t,category:cat,instructor:currentUser.name,duration:dur,progress:0,lessons:0,completed:0,published:false});
      persist();
    }
    closeModal();renderCourses();
  }catch(err){alert(err.message||"Course could not be created.");}
 });
}


function openCreateCourseForm(){
 if(!canCreateCourses()){ alert("You do not have permission to create courses."); return; }
 $("#content").innerHTML=pageHead("Create Course","Add a new Ethan Digital Academy course to the academic catalogue.")+
 `<form id="createCourseForm" class="course-create-form">
   <div class="form-grid">
     <label>Course Code<input id="newCourseCode" required placeholder="e.g. EDA-DMK-301"></label>
     <label>Course Title<input id="newCourseTitle" required placeholder="Enter course title"></label>
     <label>Duration<input id="newCourseDuration" placeholder="e.g. 6 Weeks"></label>
     <label>Difficulty<select id="newCourseDifficulty"><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></label>
   </div>
   <label>Course Description<textarea id="newCourseDescription" rows="5" placeholder="Short professional description"></textarea></label>
   <div class="form-actions">
     <button type="button" class="secondary-btn" onclick="navigate('lms')">Cancel</button>
     <button type="submit" class="primary-btn">Create Course</button>
   </div>
 </form>`;
 $("#createCourseForm").onsubmit=async(e)=>{
   e.preventDefault();
   const payload={
     code:$("#newCourseCode").value.trim(),
     title:$("#newCourseTitle").value.trim(),
     duration:$("#newCourseDuration").value.trim()||"Self-paced",
     difficulty:$("#newCourseDifficulty").value,
     description:$("#newCourseDescription").value.trim(),
     published:false,
     created_by:currentUser.id
   };
   if(!payload.code||!payload.title){alert("Course code and title are required.");return;}
   try{
     if(window.EthanSupabase?.isConfigured?.() && typeof window.EthanSupabase.createCourse==="function"){
       const created=await window.EthanSupabase.createCourse(payload);
       if(created) data.courses=[created,...(data.courses||[])];
     }else{
       data.courses=[{...payload,id:`local-${Date.now()}`,progress:0},...(data.courses||[])];
       saveData?.();
     }
     alert("Course created successfully.");
     navigate("lms");
   }catch(err){
     console.error(err);
     alert(err?.message||"Could not create course.");
   }
 };
}

function renderLMS(){
 if(currentUser.role==="student"){
   const courses=studentCourses();
   if(!courses.length){
     $("#content").innerHTML=pageHead("Learning Classroom","Course materials are protected until enrolment.")+
       emptyState("Learning access locked","You have not yet been allocated a paid course. Registration alone does not unlock course notes, lessons or videos.",`<button class="primary-btn" onclick="navigate('payments')">View Payment Status</button>`);
     return;
   }
   $("#content").innerHTML=pageHead("Learning Classroom","Choose one of your allocated courses to begin structured study.")+
     `<div class="learning-course-list">${courses.map(c=>`<button class="learning-course-row" onclick="openCourseStudy('${encodeURIComponent(c.title||"Course")}')"><div><small>${escHtml(c.code||"ALLOCATED COURSE")}</small><strong>${escHtml(c.title)}</strong><span>Introduction, definition, objectives, key concepts, examples, case study, practical activities and assessment.</span></div><b>Open Study Note →</b></button>`).join("")}</div>`;
   return;
 }

 if(canAccessAllCourseMaterials()){
   const list=allAcademyCoursesForStaff();
   const isSA=isSuperAdmin();
   $("#content").innerHTML=pageHead(
     isSA?"Super Admin Course Library":currentUser.role==="instructor"?"Instructor Course Library":"Course Library",
     isSA?"Full academic access to every Ethan Digital Academy course, study material, PDF/Word export and course creation.":"Review and manage available course materials.",
     canCreateCourses()?`<button class="primary-btn" onclick="openCreateCourseForm()">Create Course</button>`:""
   )+
   `<div class="admin-course-summary">
      <div><small>TOTAL COURSE LIBRARY</small><strong>${list.length}</strong></div>
      <div><small>MATERIAL ACCESS</small><strong>Full</strong></div>
      <div><small>WORD / PDF</small><strong>Enabled</strong></div>
      <div><small>CREATE COURSE</small><strong>${canCreateCourses()?"Enabled":"Disabled"}</strong></div>
    </div>`+
   `<div class="learning-course-list">${list.map(c=>`<div class="learning-course-row staff-course-row">
      <div><small>${escHtml(c.code||"COURSE")}</small><strong>${escHtml(c.title)}</strong><span>${c.catalogue?"Ethan Digital Academy catalogue course":"Database course"} • Full study material available</span></div>
      <div class="staff-course-actions">
        <button class="secondary-btn" onclick="openCourseStudy('${encodeURIComponent(c.title||"Course")}')">Open Material</button>
        <button class="primary-btn" onclick="openCourseStudy('${encodeURIComponent(c.title||"Course")}')">PDF / Word</button>
      </div>
    </div>`).join("")}</div>`;
   return;
 }

 $("#content").innerHTML=pageHead("Learning Management","No course access available.");
}

function renderAssignments(){
 if(currentUser.role==="student" && !studentCourses().length){ $("#content").innerHTML=pageHead("Assignments","Assignments appear only for allocated courses.")+emptyState("No assignments","You have no allocated course yet."); return; }
 $("#content").innerHTML=pageHead("Assignments","Assignments for your allocated courses.",currentUser.role==="admin"||currentUser.role==="super_admin"||currentUser.role==="instructor"?`<button class="primary-btn">+ Create Assignment</button>`:"")+emptyState("No current assignments","Assignments will appear here when your instructor publishes them.");
}
function renderQuizzes(){
 if(currentUser.role==="student" && !studentCourses().length){ $("#content").innerHTML=pageHead("Quizzes & Examinations","Assessments are linked to allocated courses.")+emptyState("No assessments","You have no active course assessment yet."); return; }
 $("#content").innerHTML=pageHead("Quizzes & Examinations","Assessments published for allocated courses.")+emptyState("No current assessment","Your instructor will publish quizzes and examinations here.");
}
function renderAttendance(){
 if(currentUser.role==="student"){ $("#content").innerHTML=pageHead("Attendance","Your real attendance record.")+emptyState(studentCourses().length?"No attendance recorded yet":"No attendance record","Attendance begins after your course is allocated and classes start."); return; }
 $("#content").innerHTML=pageHead("Attendance","Monitor attendance for enrolled learners.",currentUser.role==="admin"||currentUser.role==="super_admin"||currentUser.role==="instructor"?`<button class="primary-btn">Mark Attendance</button>`:"")+studentTable(data.students);
}
function renderResults(){
 if(currentUser.role==="student"){ $("#content").innerHTML=pageHead("Results","Only your published results are shown.")+emptyState("No results yet",studentCourses().length?"Results will appear after you complete graded assessments.":"Results become available after course allocation and assessment."); return; }
 $("#content").innerHTML=pageHead("Results","Academic assessment results and performance.")+emptyState("No result selected","Published learner results will appear here.");
}
function renderCertificates(){
 if(currentUser.role==="student"){ $("#content").innerHTML=pageHead("Certificates","Certificates are issued after successful course completion.")+emptyState("No certificate yet",studentCourses().length?"Complete the required course and assessments to qualify.":"You need an allocated course before certificate progress can begin."); return; }
 $("#content").innerHTML=pageHead("Certificates","Issue, manage and verify course certificates.",currentUser.role==="admin"||currentUser.role==="super_admin"?`<button class="primary-btn">Issue Certificate</button>`:"")+emptyState("Certificate records","Issued certificates will appear here.");
}

async function allocateAfterPayment(student,course,amount,description){
 if(window.ETHAN_BACKEND?.ready){
   const reference=`EDA-PAY-${Date.now()}`;
   await window.ETHAN_BACKEND.createPayment({reference,student_id:student.id,description:description||course.title,amount,method:"bank_transfer",verified:true,verified_by:currentUser.id});
   await window.ETHAN_BACKEND.createEnrolment({student_id:student.id,course_id:course.id,status:"active"});
   return reference;
 }
 const reference=`EDA-PAY-${1000+data.payments.length+1}`;
 data.payments.unshift({ref:reference,student:student.name,studentId:student.id,description:description||course.title,amount,date:new Date().toISOString().slice(0,10),status:"Confirmed",courseCode:course.code});
 if(!data.enrolments.some(e=>e.studentId===student.id && (e.courseId===(course.id||course.code) || e.courseCode===course.code))){
   data.enrolments.push({studentId:student.id,courseId:course.id||course.code,courseCode:course.code,status:"active",allocatedAt:new Date().toISOString()});
 }
 student.payment="Paid"; student.program=course.title; student.status="Active"; persist(); return reference;
}

function renderPayments(){
 if(currentUser.role==="student"){
   const localPayments=portalState.myPayments?.length ? portalState.myPayments : data.payments.filter(p=>(p.studentId && p.studentId===portalState.myStudent?.id) || (!p.studentId && p.student===currentUser.name));
   const courses=studentCourses();
   $("#content").innerHTML=pageHead("Fees & Payments","Payment must be verified before course access is allocated.")+`
     <div class="stats-grid">${stat("Course Access",courses.length?"Active":"Pending",courses.length?"Course allocated":"Awaiting verified payment","🔐")}${stat("Allocated Courses",String(courses.length),"After payment confirmation","📚")}${stat("Recorded Payments",String(localPayments.length),"Your account","💳")}${stat("Learning Access",courses.length?"Open":"Locked",courses.length?"Enrolled":"No enrolment","▶")}</div>
     ${courses.length?emptyState("Payment verified / course allocated","Your approved course access is active. Open My Courses to start learning.",`<button class="primary-btn" onclick="navigate('courses')">Open My Courses</button>`):emptyState("Payment required before allocation","Registering creates your student account only. Make payment through the Academy's approved payment method. Admin will verify it and allocate the course you paid for; only then will lessons/videos open.")}`;
   return;
 }
 const canVerify=currentUser.role==="admin"||currentUser.role==="super_admin";
 $("#content").innerHTML=pageHead("Fees, Payments & Course Allocation","Verify a learner's payment and allocate exactly the course paid for.",canVerify?`<button class="primary-btn" id="recordPaymentBtn">+ Verify Payment & Allocate Course</button>`:"")+`
   <div class="card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Reference</th><th>Student</th><th>Description / Course</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead><tbody>${data.payments.map(p=>`<tr><td>${p.ref||p.reference||"—"}</td><td>${p.student||"Student"}</td><td>${p.description||"Training Fee"}</td><td>₦${Number(p.amount||0).toLocaleString()}</td><td>${p.date||"—"}</td><td><span class="badge green">${p.status||"Confirmed"}</span></td></tr>`).join("")||`<tr><td colspan="6">No payments recorded yet.</td></tr>`}</tbody></table></div></div>`;
 if($("#recordPaymentBtn")) $("#recordPaymentBtn").onclick=()=>{ if(!data.students.length) return alert("No registered learner is available yet."); if(!data.courses.length) return alert("Create at least one course before allocating payment."); showModal("Verify Payment & Allocate Course","Choose the learner and the exact paid course. Saving confirms payment and creates the enrolment.",`
   <label>Student<select id="payStudent">${data.students.map(s=>`<option value="${s.id}">${s.name} ${s.studentNo?`(${s.studentNo})`:""}</option>`).join("")}</select></label>
   <label>Course<select id="payCourse">${data.courses.map(c=>`<option value="${c.id||c.code}">${c.title}${c.fee?` — ₦${Number(c.fee).toLocaleString()}`:""}</option>`).join("")}</select></label>
   <label>Amount received<input id="payAmount" type="number" min="1" required></label><label>Payment description<input id="payDesc" placeholder="Training fee / bank transfer"></label>
 `,async()=>{const student=data.students.find(s=>s.id===$("#payStudent").value),course=data.courses.find(c=>(c.id||c.code)===$("#payCourse").value),amount=Number($("#payAmount").value);if(!student||!course||!amount)return alert("Select student, course and enter a valid payment amount.");try{const ref=await allocateAfterPayment(student,course,amount,$("#payDesc").value.trim());closeModal();alert(`Payment ${ref} verified. ${course.title} has been allocated to ${student.name}.`);renderPayments();}catch(err){alert(err.message||"Payment could not be verified or course allocated.")}}); };
}

// v7 public header convenience action
window.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('[data-jump-auth]').forEach(btn=>btn.addEventListener('click',()=>{
    const target=btn.dataset.jumpAuth;
    document.querySelector(`.auth-tab[data-auth-tab="${target}"]`)?.click();
    document.querySelector('.professional-card')?.scrollIntoView({behavior:'smooth',block:'center'});
  }));
});




function renderParents(){
  $("#content").innerHTML=pageHead("Parent Accounts","Parent registration is not part of the current public learner model.")+
    emptyState("Parent module not in active use","Current public account categories are Student, Professional and Business Owner.");
}

/* v8.5 production audit overrides */
function renderTimetable(){
  $("#content").innerHTML=pageHead("Timetable","Classes and schedules appear here when they are published.")+
    emptyState("No timetable published yet","There are no scheduled classes to display at the moment.");
}

function renderAnnouncements(){
  const items=Array.isArray(data.announcements)?data.announcements:[];
  const canPost=["admin","super_admin","instructor"].includes(currentUser.role);
  $("#content").innerHTML=pageHead("Announcements","Academy updates and important information.",canPost?`<button class="primary-btn" id="newAnnouncementBtn">+ New Announcement</button>`:"")+
    (items.length?`<div class="progress-list">${items.map(a=>`<div class="section-row"><strong>${a.title}</strong><p>${a.message}</p><small class="muted">${a.date||""}</small></div>`).join("")}</div>`:
    emptyState("No announcements yet","Published Academy announcements will appear here."));
  if($("#newAnnouncementBtn")) $("#newAnnouncementBtn").onclick=()=>showModal("New Announcement","Publish an academy announcement.",
    `<label>Title<input id="annTitle"></label><label>Message<textarea id="annMsg" rows="4"></textarea></label>`,async()=>{
      const title=$("#annTitle").value.trim(), message=$("#annMsg").value.trim();
      if(!title||!message) return alert("Complete title and message.");
      try{
        if(window.ETHAN_BACKEND?.ready){
          const a=await window.ETHAN_BACKEND.createAnnouncement({title,message,audience:"all",created_by:currentUser.id});
          data.announcements.unshift({id:a.id,title:a.title,message:a.message,date:a.created_at?new Date(a.created_at).toLocaleDateString():"Today"});
        }else{
          data.announcements.unshift({title,message,date:new Date().toLocaleDateString()});persist();
        }
        closeModal();renderAnnouncements();
      }catch(err){alert(err.message||"Announcement could not be published.");}
    });
}

function renderReports(){
  if(!["admin","super_admin"].includes(currentUser.role)){
    $("#content").innerHTML=emptyState("Access restricted","Reports are available to Admin and Super Admin.");
    return;
  }
  $("#content").innerHTML=pageHead("Reports","Open live operational areas to review current academy records.")+
  `<div class="module-links">
    <button class="module-link" onclick="navigate('students')"><strong>Learner Records</strong><span>Review registrations and learner status →</span></button>
    <button class="module-link" onclick="navigate('courses')"><strong>Course Catalogue</strong><span>Review courses and publication status →</span></button>
    <button class="module-link" onclick="navigate('payments')"><strong>Payments & Allocations</strong><span>Review verified payments and enrolments →</span></button>
    <button class="module-link" onclick="navigate('attendance')"><strong>Attendance</strong><span>Review attendance when records are available →</span></button>
    <button class="module-link" onclick="navigate('results')"><strong>Results</strong><span>Review published assessment results →</span></button>
    <button class="module-link" onclick="navigate('certificates')"><strong>Certificates</strong><span>Review issued certificates →</span></button>
  </div>`;
}

function renderSettings(){
  if(!["admin","super_admin"].includes(currentUser.role)){
    $("#content").innerHTML=emptyState("Access restricted","Settings are available to Admin and Super Admin.");
    return;
  }
  const connected=Boolean(window.ETHAN_BACKEND?.ready);
  $("#content").innerHTML=pageHead("Settings","Academy identity and platform connection status.")+`
   <div class="settings-layout">
    <div class="settings-section">
      <h3>Academy</h3>
      <label>Academy Name<input id="academyNameSetting" value="Ethan Digital Academy"></label>
      <label>Website<input id="academyWebsiteSetting" value="https://ethandigitalacademy.org"></label>
      <button class="primary-btn" id="saveAcademySettings">Save Settings</button>
    </div>
    <div class="settings-section">
      <h3>Platform Status</h3>
      <p><span class="badge ${connected?"green":"gold"}">${connected?"Supabase Connected":"Supabase Not Connected"}</span></p>
      <p class="muted">${connected?"Authentication and database services are connected.":"Add valid Supabase project details to config.js before production use."}</p>
    </div>
   </div>`;
  $("#saveAcademySettings").onclick=()=>{
    localStorage.setItem("ethan_academy_settings",JSON.stringify({
      name:$("#academyNameSetting").value.trim(),
      website:$("#academyWebsiteSetting").value.trim()
    }));
    alert("Settings saved in this browser.");
  };
}

function renderNotifications(){
  const items=Array.isArray(data.notifications)?data.notifications:[];
  $("#notificationList").innerHTML=items.length
    ? items.map(n=>`<div class="notification-item"><strong>${n.title}</strong><div>${n.message}</div><small>${n.time||""}</small></div>`).join("")
    : `<div class="notification-item"><strong>No new notifications</strong><div>Important account and learning updates will appear here.</div></div>`;
}


const ETHAN_FX_RATES={NGN:1,USD:1/1500,GBP:1/2000,EUR:1/1750};
let ethanDisplayCurrency=localStorage.getItem("ethan_display_currency")||"NGN";
function formatCoursePrice(feeNGN,currency=ethanDisplayCurrency){
 const amount=Number(feeNGN||0)*(ETHAN_FX_RATES[currency]||1);
 const rounded=currency==="NGN"?Math.round(amount/1000)*1000:Math.round(amount);
 return new Intl.NumberFormat(currency==="NGN"?"en-NG":"en-GB",{style:"currency",currency,maximumFractionDigits:0}).format(rounded);
}
function updateCatalogueCurrency(currency){
 ethanDisplayCurrency=currency;localStorage.setItem("ethan_display_currency",currency);
 const s=document.getElementById("courseCatalogueSelect"),p=document.getElementById("courseBriefPrice");
 if(s&&s.value!==""&&p){const c=ETHAN_PUBLIC_COURSES[Number(s.value)];if(c)p.textContent=formatCoursePrice(c.feeNGN,currency);}
}

const ETHAN_PUBLIC_COURSES = [{"name": "Computer Appreciation", "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.", "feeNGN": 45000}, {"name": "Microsoft Word", "brief": "Learn to create, format and manage professional documents for academic, office and business use.", "feeNGN": 55000}, {"name": "Microsoft Excel", "brief": "Learn practical spreadsheet skills for organizing data, calculations, analysis, reporting and everyday business work.", "feeNGN": 55000}, {"name": "Microsoft PowerPoint", "brief": "Learn to design and deliver clear, professional presentations using effective layouts, visuals and presentation tools.", "feeNGN": 65000}, {"name": "Microsoft Access", "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.", "feeNGN": 55000}, {"name": "Google Workspace", "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.", "feeNGN": 55000}, {"name": "Internet & Email Skills", "brief": "Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks.", "feeNGN": 45000}, {"name": "Typing & Keyboard Mastery", "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.", "feeNGN": 45000}, {"name": "Computer Hardware Fundamentals", "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.", "feeNGN": 45000}, {"name": "Computer Maintenance", "brief": "Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks.", "feeNGN": 45000}, {"name": "IT Support Fundamentals", "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.", "feeNGN": 45000}, {"name": "Windows Productivity", "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.", "feeNGN": 45000}, {"name": "File Management & Cloud Storage", "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.", "feeNGN": 45000}, {"name": "Cybersecurity Awareness", "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.", "feeNGN": 65000}, {"name": "Digital Literacy", "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.", "feeNGN": 45000}, {"name": "Canva Graphic Design", "brief": "Build practical visual design skills for creating professional digital content, graphics and user-focused creative work.", "feeNGN": 55000}, {"name": "Advanced Canva Design", "brief": "Build practical visual design skills for creating professional digital content, graphics and user-focused creative work.", "feeNGN": 75000}, {"name": "Adobe Photoshop Basics", "brief": "Build practical visual design skills for creating professional digital content, graphics and user-focused creative work.", "feeNGN": 55000}, {"name": "CorelDRAW Essentials", "brief": "Build practical visual design skills for creating professional digital content, graphics and user-focused creative work.", "feeNGN": 55000}, {"name": "Brand Identity Design", "brief": "Build practical visual design skills for creating professional digital content, graphics and user-focused creative work.", "feeNGN": 55000}, {"name": "Social Media Graphics", "brief": "Learn how to use major digital platforms professionally for communication, content, audience growth and business development.", "feeNGN": 55000}, {"name": "Flyer & Poster Design", "brief": "Build practical visual design skills for creating professional digital content, graphics and user-focused creative work.", "feeNGN": 45000}, {"name": "Logo Design Fundamentals", "brief": "Build practical visual design skills for creating professional digital content, graphics and user-focused creative work.", "feeNGN": 45000}, {"name": "UI/UX Design Fundamentals", "brief": "Build practical visual design skills for creating professional digital content, graphics and user-focused creative work.", "feeNGN": 75000}, {"name": "Figma for Beginners", "brief": "Build practical visual design skills for creating professional digital content, graphics and user-focused creative work.", "feeNGN": 75000}, {"name": "CapCut Video Editing", "brief": "Develop practical media-production skills for creating engaging visual content for digital platforms and professional projects.", "feeNGN": 55000}, {"name": "Advanced Video Editing", "brief": "Develop practical media-production skills for creating engaging visual content for digital platforms and professional projects.", "feeNGN": 75000}, {"name": "Content Creation", "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.", "feeNGN": 55000}, {"name": "Mobile Photography", "brief": "Develop practical media-production skills for creating engaging visual content for digital platforms and professional projects.", "feeNGN": 45000}, {"name": "Digital Storytelling", "brief": "Develop practical media-production skills for creating engaging visual content for digital platforms and professional projects.", "feeNGN": 45000}, {"name": "Facebook Marketing", "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.", "feeNGN": 55000}, {"name": "Instagram Marketing", "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.", "feeNGN": 55000}, {"name": "TikTok Marketing", "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.", "feeNGN": 55000}, {"name": "YouTube Marketing", "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.", "feeNGN": 55000}, {"name": "LinkedIn Marketing", "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.", "feeNGN": 55000}, {"name": "WhatsApp Business Marketing", "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.", "feeNGN": 55000}, {"name": "Social Media Management", "brief": "Learn how to use major digital platforms professionally for communication, content, audience growth and business development.", "feeNGN": 55000}, {"name": "Content Marketing", "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.", "feeNGN": 55000}, {"name": "Email Marketing", "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.", "feeNGN": 55000}, {"name": "SEO Fundamentals", "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.", "feeNGN": 65000}, {"name": "Advanced SEO", "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.", "feeNGN": 75000}, {"name": "Search Engine Marketing", "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.", "feeNGN": 45000}, {"name": "Google Ads Fundamentals", "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.", "feeNGN": 75000}, {"name": "Meta Ads Fundamentals", "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.", "feeNGN": 75000}, {"name": "Marketing Analytics", "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.", "feeNGN": 65000}, {"name": "Digital Marketing Strategy", "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.", "feeNGN": 65000}, {"name": "Influencer Marketing", "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.", "feeNGN": 45000}, {"name": "Affiliate Marketing", "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.", "feeNGN": 45000}, {"name": "Personal Branding", "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.", "feeNGN": 55000}, {"name": "Online Reputation Management", "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.", "feeNGN": 45000}, {"name": "Artificial Intelligence Fundamentals", "brief": "Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks.", "feeNGN": 65000}, {"name": "AI for Business", "brief": "Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks.", "feeNGN": 65000}, {"name": "Prompt Engineering", "brief": "Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks.", "feeNGN": 65000}, {"name": "Generative AI Tools", "brief": "Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks.", "feeNGN": 65000}, {"name": "ChatGPT for Productivity", "brief": "Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks.", "feeNGN": 45000}, {"name": "AI Content Creation", "brief": "Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks.", "feeNGN": 65000}, {"name": "AI for Digital Marketing", "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.", "feeNGN": 65000}, {"name": "AI for Education", "brief": "Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks.", "feeNGN": 65000}, {"name": "AI Automation", "brief": "Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks.", "feeNGN": 75000}, {"name": "Responsible AI", "brief": "Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks.", "feeNGN": 45000}, {"name": "Web Design Fundamentals", "brief": "Build practical visual design skills for creating professional digital content, graphics and user-focused creative work.", "feeNGN": 75000}, {"name": "HTML & CSS", "brief": "Learn the essential concepts and practical tools used to create, publish and maintain modern websites and web experiences.", "feeNGN": 45000}, {"name": "JavaScript Fundamentals", "brief": "Learn the essential concepts and practical tools used to create, publish and maintain modern websites and web experiences.", "feeNGN": 45000}, {"name": "WordPress Website Design", "brief": "Learn to create, format and manage professional documents for academic, office and business use.", "feeNGN": 75000}, {"name": "No-Code Website Building", "brief": "Learn the essential concepts and practical tools used to create, publish and maintain modern websites and web experiences.", "feeNGN": 65000}, {"name": "E-commerce Website Setup", "brief": "Learn the essential concepts and practical tools used to create, publish and maintain modern websites and web experiences.", "feeNGN": 75000}, {"name": "Landing Page Design", "brief": "Build practical visual design skills for creating professional digital content, graphics and user-focused creative work.", "feeNGN": 45000}, {"name": "Web Hosting & Domains", "brief": "Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks.", "feeNGN": 45000}, {"name": "Website SEO", "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.", "feeNGN": 65000}, {"name": "Website Maintenance", "brief": "Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks.", "feeNGN": 65000}, {"name": "Python for Beginners", "brief": "Build foundational technical skills through clear concepts and practical exercises for modern software, data and application development.", "feeNGN": 75000}, {"name": "JavaScript Programming", "brief": "Learn the essential concepts and practical tools used to create, publish and maintain modern websites and web experiences.", "feeNGN": 75000}, {"name": "Database Fundamentals", "brief": "Build foundational technical skills through clear concepts and practical exercises for modern software, data and application development.", "feeNGN": 65000}, {"name": "SQL Fundamentals", "brief": "Build foundational technical skills through clear concepts and practical exercises for modern software, data and application development.", "feeNGN": 75000}, {"name": "Supabase Fundamentals", "brief": "Build foundational technical skills through clear concepts and practical exercises for modern software, data and application development.", "feeNGN": 75000}, {"name": "Git & GitHub", "brief": "Build foundational technical skills through clear concepts and practical exercises for modern software, data and application development.", "feeNGN": 45000}, {"name": "Software Development Basics", "brief": "Build foundational technical skills through clear concepts and practical exercises for modern software, data and application development.", "feeNGN": 75000}, {"name": "API Fundamentals", "brief": "Build foundational technical skills through clear concepts and practical exercises for modern software, data and application development.", "feeNGN": 65000}, {"name": "Automation with No-Code Tools", "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.", "feeNGN": 65000}, {"name": "App Development Fundamentals", "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.", "feeNGN": 75000}, {"name": "Data Analysis Fundamentals", "brief": "Learn how to organize, analyze, visualize and communicate data for better academic, operational and business decisions.", "feeNGN": 65000}, {"name": "Excel Data Analysis", "brief": "Learn practical spreadsheet skills for organizing data, calculations, analysis, reporting and everyday business work.", "feeNGN": 65000}, {"name": "Power BI Fundamentals", "brief": "Learn how to organize, analyze, visualize and communicate data for better academic, operational and business decisions.", "feeNGN": 75000}, {"name": "Google Sheets Advanced", "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.", "feeNGN": 75000}, {"name": "Data Visualization", "brief": "Learn how to organize, analyze, visualize and communicate data for better academic, operational and business decisions.", "feeNGN": 45000}, {"name": "Business Intelligence", "brief": "Gain practical digital-business and workplace skills for managing customers, projects, operations, online services and career opportunities.", "feeNGN": 65000}, {"name": "Basic Statistics for Data", "brief": "Learn how to organize, analyze, visualize and communicate data for better academic, operational and business decisions.", "feeNGN": 45000}, {"name": "Data Cleaning", "brief": "Learn how to organize, analyze, visualize and communicate data for better academic, operational and business decisions.", "feeNGN": 45000}, {"name": "Dashboard Design", "brief": "Build practical visual design skills for creating professional digital content, graphics and user-focused creative work.", "feeNGN": 45000}, {"name": "Reporting & Analytics", "brief": "Learn how to organize, analyze, visualize and communicate data for better academic, operational and business decisions.", "feeNGN": 45000}, {"name": "Entrepreneurship in the Digital Age", "brief": "Gain practical digital-business and workplace skills for managing customers, projects, operations, online services and career opportunities.", "feeNGN": 55000}, {"name": "Digital Business Fundamentals", "brief": "Gain practical digital-business and workplace skills for managing customers, projects, operations, online services and career opportunities.", "feeNGN": 55000}, {"name": "E-commerce Fundamentals", "brief": "Gain practical digital-business and workplace skills for managing customers, projects, operations, online services and career opportunities.", "feeNGN": 55000}, {"name": "Online Business Setup", "brief": "Gain practical digital-business and workplace skills for managing customers, projects, operations, online services and career opportunities.", "feeNGN": 45000}, {"name": "Freelancing Fundamentals", "brief": "Gain practical digital-business and workplace skills for managing customers, projects, operations, online services and career opportunities.", "feeNGN": 55000}, {"name": "Remote Work Skills", "brief": "Gain practical digital-business and workplace skills for managing customers, projects, operations, online services and career opportunities.", "feeNGN": 55000}, {"name": "Customer Relationship Management", "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.", "feeNGN": 45000}, {"name": "ERP Fundamentals", "brief": "Gain practical digital-business and workplace skills for managing customers, projects, operations, online services and career opportunities.", "feeNGN": 65000}, {"name": "CRM Fundamentals", "brief": "Gain practical digital-business and workplace skills for managing customers, projects, operations, online services and career opportunities.", "feeNGN": 65000}, {"name": "Project Management Fundamentals", "brief": "Gain practical digital-business and workplace skills for managing customers, projects, operations, online services and career opportunities.", "feeNGN": 65000}];


document.addEventListener('DOMContentLoaded', () => {
  const browseBtn = document.getElementById('browseCoursesBtn');
  const wrap = document.getElementById('catalogueDropdownWrap');
  const select = document.getElementById('courseCatalogueSelect');
  const panel = document.getElementById('catalogueBriefPanel');
  const title = document.getElementById('courseBriefTitle');
  const text = document.getElementById('courseBriefText');

  if (!browseBtn || !wrap || !select || !panel || !Array.isArray(ETHAN_PUBLIC_COURSES)) return;

  if (!select.dataset.loaded) {
    ETHAN_PUBLIC_COURSES.forEach((course, i) => {
      const option = document.createElement('option');
      option.value = String(i);
      option.textContent = course.name;
      select.appendChild(option);
    });
    select.dataset.loaded = 'true';
  }

  browseBtn.addEventListener('click', () => {
    wrap.classList.toggle('hidden');
    if (!wrap.classList.contains('hidden')) {
      select.focus();
      browseBtn.textContent = 'Hide Courses';
    } else {
      browseBtn.textContent = 'Browse Courses';
      panel.classList.add('hidden');
      select.value = '';
    }
  });

  select.addEventListener('change', () => {
    const index = Number(select.value);
    if (!Number.isInteger(index) || !ETHAN_PUBLIC_COURSES[index]) {
      panel.classList.add('hidden');
      return;
    }
    const course = ETHAN_PUBLIC_COURSES[index];
    title.textContent = course.name;
    text.textContent = course.brief;
    panel.classList.remove('hidden');
  });
});

window.addEventListener("DOMContentLoaded",()=>{
 const cur=document.getElementById("catalogueCurrencySelect");
 if(cur){cur.value=ethanDisplayCurrency;cur.addEventListener("change",()=>updateCatalogueCurrency(cur.value));}
 const s=document.getElementById("courseCatalogueSelect");
 if(s)s.addEventListener("change",()=>{const c=ETHAN_PUBLIC_COURSES[Number(s.value)],p=document.getElementById("courseBriefPrice");if(c&&p)p.textContent=formatCoursePrice(c.feeNGN);});
});

/* v9.1 approved bank payment page */
function renderPayments(){
 if(currentUser.role==="student"){
   const records=portalState.myPayments||[];
   $("#content").innerHTML=pageHead("Payments & Enrolment","Use only the approved Ethan Digital Academy accounts shown below.")+
     approvedBankPaymentHtml()+
     `<section class="payment-history-section"><div class="student-section-head"><div><span class="eyebrow">MY ACCOUNT</span><h2>Payment Status</h2><p>Your verified payments and course-access status.</p></div></div>
       ${records.length?table(["Reference","Amount","Status","Date"],records.map(p=>[
         escHtml(p.reference||p.id||"Payment"),
         escHtml(String(p.amount||"")),
         statusBadge(p.status||"pending"),
         escHtml(p.created_at?new Date(p.created_at).toLocaleDateString():"")
       ])):emptyState("No verified payment record yet","After making a bank transfer, your payment must be verified before a course can be allocated.")}
     </section>`;
   return;
 }
 if(!["admin","super_admin"].includes(currentUser.role)){
   $("#content").innerHTML=pageHead("Payments","Payment information.")+approvedBankPaymentHtml();
   return;
 }
 const rows=(data.payments||[]).map(p=>[
   escHtml(p.student||p.student_name||p.student_id||"Learner"),
   escHtml(String(p.amount||"")),
   statusBadge(p.status||"pending"),
   escHtml(p.description||p.reference||"Course payment")
 ]);
 $("#content").innerHTML=pageHead("Payments & Verification","Verify learner payments before allocating course access.")+
   approvedBankPaymentHtml()+
   `<section class="payment-history-section"><div class="student-section-head"><div><span class="eyebrow">ADMINISTRATION</span><h2>Payment Records</h2></div></div>
   ${rows.length?table(["Learner","Amount","Status","Description"],rows):emptyState("No payment records","Verified and pending payment records will appear here.")}</section>`;
}
