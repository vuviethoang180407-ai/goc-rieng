type Identity={id:string;name:string};
class HttpError extends Error { constructor(public status:number,message:string){super(message)} }
function fail(status:number,message:string):never{throw new HttpError(status,message)}
function text(v:unknown,max:number,optional=false):string { if(typeof v!=="string") {if(optional && v==null)return "";fail(400,"Nội dung không hợp lệ.")}const s=v.trim();if((!optional&&!s)||s.length>max)fail(400,"Nội dung trống hoặc quá dài.");return s; }
function date(v:unknown):string|null {if(v==null||v==="")return null;const s=text(v,40);const d=new Date(s);if(!Number.isFinite(d.getTime()))fail(400,"Ngày giờ không hợp lệ.");return d.toISOString()}
export async function handleSocial(request:Request,db:D1Database,user:Identity|null):Promise<Response>{
 const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
 try {
  if(!user)fail(401,"Hãy đăng nhập để mở không gian của bạn.");
  if(!db)fail(503,"Lưu trữ chưa sẵn sàng.");
  const u=user.id, now=()=>new Date().toISOString();
  const one=async(sql:string,...args:any[])=>db.prepare(sql).bind(...args).first<any>();
  const all=async(sql:string,...args:any[])=>(await db.prepare(sql).bind(...args).all<any>()).results;
  const run=async(sql:string,...args:any[])=>db.prepare(sql).bind(...args).run();
  if(request.method==="POST"){
   const origin=request.headers.get("origin");
   if(origin!==new URL(request.url).origin)fail(403,"Yêu cầu phải được gửi từ trang này.");
   if(!request.headers.get("content-type")?.startsWith("application/json"))fail(415,"Cần dữ liệu JSON.");
  }
  await run("INSERT OR IGNORE INTO profiles (id,name,bio,code,created) VALUES (?,?,?,?,?)",u,user.name.slice(0,60),"",crypto.randomUUID().replaceAll("-",""),now());
  const profile=await one("SELECT id,name,bio,code FROM profiles WHERE id=?",u);
  const pair=(peer:string)=>u<peer?[u,peer]:[peer,u];
  const friend=async(peer:string)=>{const [a,b]=pair(peer);if(!await one("SELECT 1 FROM friendships WHERE a=? AND b=? AND status='accepted'",a,b))fail(403,"Chỉ bạn bè đã xác nhận mới có thể tương tác.");};
  const member=async(id:string)=>{const p=await one("SELECT p.*,m.status AS membership FROM plans p JOIN members m ON m.plan_id=p.id WHERE p.id=? AND m.user_id=? AND m.status='accepted'",id,u);if(!p)fail(403,"Bạn không có quyền mở kế hoạch này.");return p};
  const url=new URL(request.url);
  if(request.method==="GET"){
   const view=url.searchParams.get("view")||"snapshot";
   if(view==="messages"){
    const peer=text(url.searchParams.get("peer"),200);await friend(peer);
    const rows=await all("SELECT id,sender,recipient,body,created FROM (SELECT * FROM messages WHERE (sender=? AND recipient=?) OR (sender=? AND recipient=?) ORDER BY created DESC,id DESC LIMIT 200) ORDER BY created,id",u,peer,peer,u);
    return json({messages:rows});
   }
   if(view!=="snapshot")fail(404,"Không tìm thấy.");
   const friends=await all("SELECT p.id,p.name,p.bio FROM profiles p JOIN friendships f ON ((f.a=? AND f.b=p.id) OR (f.b=? AND f.a=p.id)) WHERE f.status='accepted' ORDER BY p.name",u,u);
   const requests=await all("SELECT p.id,p.name,p.bio,f.sender,f.created FROM profiles p JOIN friendships f ON ((f.a=? AND f.b=p.id) OR (f.b=? AND f.a=p.id)) WHERE f.status='pending' ORDER BY f.created DESC",u,u);
   const plans=await all("SELECT p.*,m.status AS membership,pr.name AS owner_name FROM plans p JOIN members m ON m.plan_id=p.id JOIN profiles pr ON pr.id=p.owner WHERE m.user_id=? ORDER BY p.created DESC",u);
   for(const p of plans){
    if(p.membership==="accepted"){
     p.members=await all("SELECT pr.id,pr.name,m.status FROM members m JOIN profiles pr ON pr.id=m.user_id WHERE m.plan_id=?",p.id);
     p.tasks=await all("SELECT * FROM tasks WHERE plan_id=? ORDER BY created,id",p.id);
    }else{p.tasks=[];p.members=[]}
   }
   const space=await one("SELECT data FROM spaces WHERE user_id=?",u);
   return json({profile,friends,requests,plans,space:space?JSON.parse(space.data):null});
  }
  if(request.method!=="POST")fail(405,"Phương thức không hỗ trợ.");
  const raw=await request.text();if(raw.length>100000)fail(413,"Dữ liệu quá lớn.");
  let body:any;try{body=JSON.parse(raw)}catch{fail(400,"Dữ liệu JSON không hợp lệ.")}
  if(!body||typeof body!=="object")fail(400,"Dữ liệu không hợp lệ.");
  switch(body.action){
   case "profile":{
    const name=text(body.name,60),bio=text(body.bio,180,true);
    await run("UPDATE profiles SET name=?,bio=? WHERE id=?",name,bio,u);return json({ok:true});
   }
   case "rotate-code":{
    const code=crypto.randomUUID().replaceAll("-","");await run("UPDATE profiles SET code=? WHERE id=?",code,u);return json({code});
   }
   case "resolve":{
    const code=text(body.code,200).split("?invite=").pop()!.split(/[&#]/)[0];
    if(!/^[a-f0-9]{32}$/.test(code))fail(400,"Mã kết bạn không hợp lệ.");
    const person=await one("SELECT id,name,bio FROM profiles WHERE code=?",code);
    if(!person)fail(404,"Không tìm thấy mã này. Có thể chủ mã đã đổi mã.");
    if(person.id===u)fail(400,"Đây là mã của chính bạn.");return json({person});
   }
   case "request":{
    const code=text(body.code,64);const p=await one("SELECT id FROM profiles WHERE code=?",code);
    if(!p||p.id===u)fail(400,"Mã kết bạn không hợp lệ.");
    const [a,b]=pair(p.id);const f=await one("SELECT status,sender FROM friendships WHERE a=? AND b=?",a,b);
    if(f)fail(409,f.status==="accepted"?"Hai bạn đã là bạn bè.":"Đã có lời mời. Hãy kiểm tra danh sách lời mời.");
    await run("INSERT OR IGNORE INTO friendships(a,b,sender,status,created) VALUES(?,?,?,'pending',?)",a,b,u,now());return json({ok:true});
   }
   case "respond":{
    const peer=text(body.peer,200);const [a,b]=pair(peer);
    if(typeof body.accept!=="boolean")fail(400,"Lựa chọn không hợp lệ.");
    const f=await one("SELECT * FROM friendships WHERE a=? AND b=? AND status='pending'",a,b);
    if(!f||f.sender===u)fail(403,"Bạn không thể xử lý lời mời này.");
    if(body.accept)await run("UPDATE friendships SET status='accepted' WHERE a=? AND b=? AND status='pending' AND sender<>?",a,b,u);
    else await run("DELETE FROM friendships WHERE a=? AND b=? AND status='pending' AND sender<>?",a,b,u);
    return json({ok:true});
   }
   case "cancel-request":{
    const peer=text(body.peer,200);const [a,b]=pair(peer);
    await run("DELETE FROM friendships WHERE a=? AND b=? AND sender=? AND status='pending'",a,b,u);return json({ok:true});
   }
   case "message":{
    const peer=text(body.peer,200);await friend(peer);const message=text(body.body,2000),id=crypto.randomUUID();
    await run("INSERT INTO messages(id,sender,recipient,body,created) VALUES(?,?,?,?,?)",id,u,peer,message,now());
    return json({ok:true,id});
   }
   case "create-plan":{
    const title=text(body.title,100),description=text(body.description,500,true),event=date(body.eventAt),id=crypto.randomUUID();
    await db.batch([db.prepare("INSERT INTO plans(id,owner,title,description,event_at,created) VALUES(?,?,?,?,?,?)").bind(id,u,title,description,event,now()),db.prepare("INSERT INTO members(plan_id,user_id,status) VALUES(?,?,'accepted')").bind(id,u)]);
    return json({ok:true,id});
   }
   case "edit-plan":{
    const id=text(body.planId,100);const p=await member(id);
    if(p.owner!==u)fail(403,"Chỉ người tạo được chỉnh sửa kế hoạch.");
    await run("UPDATE plans SET title=?,description=?,event_at=? WHERE id=?",text(body.title,100),text(body.description,500,true),date(body.eventAt),id);
    return json({ok:true});
   }
   case "invite-plan":{
    const id=text(body.planId,100),peer=text(body.peer,200);const p=await member(id);
    if(p.owner!==u)fail(403,"Chỉ người tạo kế hoạch được gửi lời mời.");await friend(peer);
    await run("INSERT OR IGNORE INTO members(plan_id,user_id,status) VALUES(?,?,'pending')",id,peer);return json({ok:true});
   }
   case "respond-plan":{
    const id=text(body.planId,100);const p=await one("SELECT p.owner FROM plans p JOIN members m ON p.id=m.plan_id WHERE p.id=? AND m.user_id=? AND m.status='pending'",id,u);
    if(!p||typeof body.accept!=="boolean")fail(403,"Lời mời không hợp lệ.");await friend(p.owner);
    if(body.accept)await run("UPDATE members SET status='accepted' WHERE plan_id=? AND user_id=? AND status='pending'",id,u);
    else await run("DELETE FROM members WHERE plan_id=? AND user_id=? AND status='pending'",id,u);
    return json({ok:true});
   }
   case "add-task":{
    const id=text(body.planId,100);await member(id);const title=text(body.title,180),assignee=text(body.assignee,200,true)||null;
    if(assignee&&!await one("SELECT 1 FROM members WHERE plan_id=? AND user_id=? AND status='accepted'",id,assignee))fail(400,"Chỉ giao việc cho thành viên đã tham gia.");
    await run("INSERT INTO tasks(id,plan_id,title,assignee,due_at,done,created) VALUES(?,?,?,?,?,0,?)",crypto.randomUUID(),id,title,assignee,date(body.dueAt),now());return json({ok:true});
   }
   case "toggle-task":{
    const task=await one("SELECT * FROM tasks WHERE id=?",text(body.id,100));if(!task)fail(404,"Không tìm thấy công việc.");
    const p=await member(task.plan_id);
    if(p.owner!==u&&task.assignee!==u)fail(403,"Chỉ người được giao hoặc chủ kế hoạch được đổi trạng thái.");
    if(typeof body.done!=="boolean")fail(400,"Trạng thái không hợp lệ.");
    await run("UPDATE tasks SET done=? WHERE id=?",body.done?1:0,task.id);return json({ok:true});
   }
   case "space":{
    const s=body.space;if(!s||typeof s!=="object"||Array.isArray(s)||!Array.isArray(s.metrics)||s.metrics.length!==4)fail(400,"Cần đúng bốn chỉ số.");
    for(const m of s.metrics){text(m.name,50);text(m.description,130,true);text(m.unit,20,true);if(!Number.isFinite(m.current)||m.current<0||!Number.isFinite(m.target)||m.target<=0)fail(400,"Giá trị chỉ số không hợp lệ.")}
    for(const k of ["intention","learning","review","vision"])text(s[k],k==="intention"?150:5000,true);
    if(!Array.isArray(s.notes)||!Array.isArray(s.tasks)||s.notes.length>300||s.tasks.length>300)fail(400,"Tối đa 300 ghi chép và 300 việc cá nhân.");
    for(const n of s.notes)text(n?.text,300);
    for(const t of s.tasks){text(t?.text,150);if(typeof t.done!=="boolean")fail(400,"Trạng thái việc không hợp lệ.");}
    const data=JSON.stringify(s);if(data.length>60000)fail(400,"Không gian đã đầy. Hãy bớt ghi chép trước khi lưu.");
    await run("INSERT INTO spaces(user_id,data) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data",u,data);return json({ok:true});
   }
   default:fail(400,"Thao tác không hợp lệ.");
  }
 }catch(e){if(e instanceof HttpError)return json({error:e.message},e.status);console.error("Social API error",e instanceof Error?e.message:"unknown");return json({error:"Không thể hoàn tất. Vui lòng thử lại."},500)}
}
