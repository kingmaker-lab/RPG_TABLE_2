const fs=require('fs'),vm=require('vm'),path=require('path');
const {DatabaseSync}=require('node:sqlite');
const assert=require('assert/strict');
let src=fs.readFileSync(path.join(__dirname,'..','deploy','worker.mjs'),'utf8');
src=src.replace("import { DurableObject } from 'cloudflare:workers';",'').replace('export class GameRoom extends DurableObject','class GameRoom extends DurableObject').replace('export default {','const workerDefault = {');
src+='\nglobalThis.__arcane = { GameRoom, workerDefault };\n';
class DurableObject { constructor(ctx,env){this.ctx=ctx;this.env=env;} }
class FakeSql {constructor(){this.db=new DatabaseSync(':memory:');} exec(query,...args){const prep=this.db.prepare(query);const isSelect=/^\s*SELECT\b/i.test(query);const converted=args.map(x=>x instanceof Uint8Array?Buffer.from(x):x);const rows=isSelect?prep.all(...converted):(prep.run(...converted),[]);return {toArray:()=>rows,one:()=>rows[0]};}}
class FakeContext {constructor(){this.storage={sql:new FakeSql()};this.sockets=[];} blockConcurrencyWhile(f){this.ready=f();}getWebSockets(){return this.sockets;} acceptWebSocket(ws){this.sockets.push(ws);}}
const sandbox={DurableObject,console,URL,Request,Response,Headers,TextEncoder,Uint8Array,Uint32Array,ArrayBuffer,Date,crypto:require('crypto').webcrypto,WebSocketPair:class{}};
sandbox.globalThis=sandbox;
vm.runInNewContext(src,sandbox,{filename:'beta'});
const {GameRoom,workerDefault}=sandbox.__arcane;
const instances=new Map();const env={ROOMS:{getByName(name){if(!instances.has(name)){const ctx=new FakeContext(), room=new GameRoom(ctx,env);instances.set(name,{room,ctx});}return instances.get(name).room;}}};
(async()=>{
const create=await workerDefault.fetch(new Request('https://beta.local/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Dungeon Test',host:'Mestre'})}),env);
assert.equal(create.status,201);const h=await create.json(); await instances.get(h.roomId).ctx.ready;
const state=await workerDefault.fetch(new Request(`https://beta.local/api/rooms/${h.roomId}/state`,{headers:{Authorization:`Bearer ${h.token}`}}),env);
assert.equal(state.status,200);assert.equal((await state.json()).state.members.length,1);
const joined=await workerDefault.fetch(new Request(`https://beta.local/api/rooms/${h.roomId}/join`,{method:'POST',body:JSON.stringify({name:'Jogador A'})}),env);
assert.equal(joined.status,201);const j=await joined.json();
const room=instances.get(h.roomId).room; const s=await room.snapshot(j.token);assert.equal(s.members.length,2);
const png=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]);
const upload=await workerDefault.fetch(new Request(`https://beta.local/api/rooms/${h.roomId}/media?kind=portrait`,{method:'POST',headers:{Authorization:`Bearer ${j.token}`,'Content-Type':'image/png'},body:png}),env);
assert.equal(upload.status,201,await upload.text());
// Can't read body twice; fetch to validate isolation.
const p=await room.readMedia(j.token, (await room.ctx.storage.sql.exec('SELECT id FROM media').one()).id);assert.equal(p.mime,'image/png');
const failedMap=await workerDefault.fetch(new Request(`https://beta.local/api/rooms/${h.roomId}/media?kind=map`,{method:'POST',headers:{Authorization:`Bearer ${j.token}`,'Content-Type':'image/png'},body:png}),env);
assert.equal(failedMap.status,403);
const uploadMap=await workerDefault.fetch(new Request(`https://beta.local/api/rooms/${h.roomId}/media?kind=map`,{method:'POST',headers:{Authorization:`Bearer ${h.token}`,'Content-Type':'image/png'},body:png}),env);assert.equal(uploadMap.status,201);
const fakews={deserializeAttachment:()=>({memberId:j.memberId}),send(){}};
await room.webSocketMessage(fakews,JSON.stringify({type:'character',character:{name:'Renard',maxHp:20,hp:17,photoId:null}}));
await room.webSocketMessage(fakews,JSON.stringify({type:'move',x:77,y:22}));
const after=await room.snapshot(j.token);assert.equal(after.members.find(x=>x.id===j.memberId).character.name,'Renard');assert.equal(after.members.find(x=>x.id===j.memberId).x,77);
await room.webSocketMessage(fakews,JSON.stringify({type:'chat',text:'A porta está aberta!'}));
await room.webSocketMessage(fakews,JSON.stringify({type:'roll',faces:20}));
const lastChat=(await room.snapshot(j.token)).chat;
assert(lastChat.some(m=>m.text==='A porta está aberta!'));
assert(lastChat.some(m=>m.kind==='roll' && /^🎲 d20: (?:[1-9]|1[0-9]|20)$/.test(m.text)));
console.log('QA local: sala, participantes, auth, imagens SQLite, permissões, ficha, movimento, chat e d20: OK');
})().catch(err=>{console.error(err);process.exitCode=1});