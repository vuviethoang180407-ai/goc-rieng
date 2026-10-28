import { DatabaseSync } from "node:sqlite";
import { readFileSync,writeFileSync,mkdirSync,readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { transpileModule,ModuleKind,ScriptTarget } from "typescript";
import assert from "node:assert/strict";
mkdirSync(".sites-runtime",{recursive:true});
const compiled=transpileModule(readFileSync("app/social-service.ts","utf8"),{compilerOptions:{module:ModuleKind.ESNext,target:ScriptTarget.ES2022}}).outputText;
writeFileSync(".sites-runtime/service-test.mjs",compiled);
const {handleSocial,readPublication}=await import(pathToFileURL(process.cwd()+"/.sites-runtime/service-test.mjs"));
const sql=new DatabaseSync(":memory:");sql.exec("PRAGMA foreign_keys=ON");
for(const file of readdirSync("drizzle").filter(f=>f.endsWith(".sql")).sort())sql.exec(readFileSync("drizzle/"+file,"utf8"));
class Statement{
 constructor(query){this.query=query;this.args=[]}
 bind(...args){const s=new Statement(this.query);s.args=args;return s}
 async first(){return sql.prepare(this.query).get(...this.args)||null}
 async all(){return {results:sql.prepare(this.query).all(...this.args)}}
 async run(){return sql.prepare(this.query).run(...this.args)}
}
const db={prepare:q=>new Statement(q),batch:async stmts=>{sql.exec("BEGIN");try{const res=[];for(const s of stmts)res.push(await s.run());sql.exec("COMMIT");return res}catch(e){sql.exec("ROLLBACK");throw e}}};
const identities={a:{id:"a",name:"An"},b:{id:"b",name:"Bình"},c:{id:"c",name:"Chi"}};
let checks=0;
async function req(user,action,data={},status=200,query="",origin="https://test.local"){
 const r=await handleSocial(new Request("https://test.local/api/social"+query,{method:action?"POST":"GET",headers:action?{"content-type":"application/json",origin}:undefined,body:action?JSON.stringify({action,...data}):undefined}),db,identities[user]||null);
 const out=await r.json();assert.equal(r.status,status,JSON.stringify(out));checks++;return out;
}
await req(null,null,{},401);
let a=await req("a"),b=await req("b"),c=await req("c");
assert.notEqual(a.profile.code,b.profile.code);
await req("a","profile",{name:"An updated",bio:"Loves learning"});
const lookup=await req("b","resolve",{code:a.profile.code});assert.deepEqual(Object.keys(lookup.person).sort(),["bio","id","name"]);
await req("a","message",{peer:"b",body:"Blocked before friends"},403);
await req("a",null,{},403,"?view=messages&peer=b");
await req("a","request",{code:b.profile.code});
await req("a","respond",{peer:"b",accept:true},403);
await req("c","respond",{peer:"a",accept:true},403);
await req("b","respond",{peer:"a",accept:true});
await req("a","message",{peer:"b",body:"Hello Bình"});
const chat=await req("b",null,{},200,"?view=messages&peer=a");assert.equal(chat.messages[0].body,"Hello Bình");
await req("c",null,{},403,"?view=messages&peer=a");
await req("c","message",{peer:"a",body:"Not a friend"},403);
const created=await req("a","create-plan",{title:"Study together",description:"Friday",eventAt:"2026-11-01T12:00:00Z"}),id=created.id;
await req("a","invite-plan",{planId:id,peer:"c"},403);
await req("b","invite-plan",{planId:id,peer:"a"},403);
await req("a","invite-plan",{planId:id,peer:"b"});
await req("b","edit-plan",{planId:id,title:"Not allowed",description:""},403);
await req("a","edit-plan",{planId:id,title:"Updated plan",description:"New description",eventAt:"2026-11-02T12:00:00Z"});
await req("a","add-task",{planId:id,title:"Secret task",assignee:"b"},400);
await req("b","add-task",{planId:id,title:"Before joining"},403);
b=await req("b");assert.equal(b.plans[0].membership,"pending");assert.equal(b.plans[0].tasks.length,0);
await req("b","respond-plan",{planId:id,accept:true});
await req("a","add-task",{planId:id,title:"Prepare questions",assignee:"b",dueAt:"2026-10-30T00:00:00Z"});
await req("b","add-task",{planId:id,title:"Owner task",assignee:"a"});
b=await req("b");const task=b.plans[0].tasks.find(t=>t.assignee==="b"),other=b.plans[0].tasks.find(t=>t.assignee==="a");
await req("c","toggle-task",{id:task.id,done:true},403);
await req("b","toggle-task",{id:other.id,done:true},403);
await req("b","toggle-task",{id:task.id,done:true});
a=await req("a");assert.equal(a.plans[0].tasks.find(t=>t.id===task.id).done,1);
c=await req("c");assert.equal(c.plans.length,0);
const metrics=Array.from({length:4},()=>({name:"Test",current:1,target:2,description:"private",unit:"h"}));
await req("a","space",{space:{metrics,intention:"Private",tasks:[],notes:[{text:"Only An can read"}],learning:"",review:"",vision:""}});
a=await req("a");b=await req("b");assert.equal(a.space.notes[0].text,"Only An can read");assert.equal(b.space,null);
await req("a","space",{space:{metrics:metrics.slice(0,3)}},400);
await req("a","space",{space:{metrics:metrics.map(m=>({...m,target:0}))}},400);
await req("a","profile",{name:"CSRF",bio:""},403,"","https://evil.local");
await req("a","space",{space:{metrics,notes:[{text:42}],tasks:[],intention:"",learning:"",review:"",vision:""}},400);
const old=a.profile.code;await req("a","rotate-code");await req("c","resolve",{code:old},404);
await req("c","request",{code:b.profile.code});await req("b","respond",{peer:"c",accept:false});
await req("c","request",{code:b.profile.code});await req("c","cancel-request",{peer:"b"});
await req("a","message",{peer:"b",body:"<script>alert(1)</script>"});
const history=await req("b",null,{},200,"?view=messages&peer=a");assert.equal(history.messages.at(-1).body,"<script>alert(1)</script>");

const pubSpace={metrics,intention:"Published intention",tasks:[{text:"Public task",done:true}],notes:[{text:"Public note"}],learning:"Learning",review:"Reflection",vision:"Goal",messages:[{body:"MUST NOT LEAK"}],email:"hidden@example.test",profile:{code:"DO NOT LEAK"}};
await req(null,"publish-space",{space:pubSpace},401);
assert.equal(await readPublication(db,"invalid"),null);
const publication=await req("a","publish-space",{space:pubSpace});
assert.match(publication.token,/^[a-f0-9]{32}$/);
let publicPage=await readPublication(db,publication.token);
assert.equal(publicPage.profile.name,"An updated");
assert.equal(publicPage.space.notes[0].text,"Public note");
assert.deepEqual(Object.keys(publicPage.profile).sort(),["bio","name"]);
assert.equal(publicPage.space.messages,undefined);assert.equal(publicPage.space.email,undefined);assert.equal(publicPage.space.profile,undefined);
await req("b","unpublish-space",{userId:"a"});
assert.ok(await readPublication(db,publication.token));
await req("a","space",{space:{...pubSpace,notes:[{text:"New private draft"}]}});
publicPage=await readPublication(db,publication.token);
assert.equal(publicPage.space.notes[0].text,"Public note");
const updated=await req("a","publish-space",{space:{...pubSpace,notes:[{text:"Updated public note"}]}});
assert.equal(updated.token,publication.token);
assert.equal((await readPublication(db,publication.token)).space.notes[0].text,"Updated public note");
await req("a","unpublish-space",{});
assert.equal(await readPublication(db,publication.token),null);
const republished=await req("a","publish-space",{space:pubSpace});
assert.notEqual(republished.token,publication.token);
assert.equal(await readPublication(db,publication.token),null);
assert.equal((await req("b")).publication,null);
console.log("PASS: "+checks+" API checks plus public snapshot assertions; anonymous access, ownership, allowlisted fields, draft isolation and link revocation.");
sql.close();
