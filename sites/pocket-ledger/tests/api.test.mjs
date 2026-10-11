import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handleApi} from '../worker/api.mjs';

function fixture(){
  const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../drizzle/0000_wallet.sql',import.meta.url),'utf8'));
  sqlite.exec(readFileSync(new URL('../drizzle/0001_summary_security.sql',import.meta.url),'utf8'));
  const DB={prepare(sql){let params=[];return {bind(...values){params=values;return this;},async first(){return sqlite.prepare(sql).get(...params)??null;},async all(){return {results:sqlite.prepare(sql).all(...params)};},async run(){const output=sqlite.prepare(sql).run(...params);return {meta:{changes:Number(output.changes)}};}};},async batch(statements){sqlite.exec('BEGIN');try{const result=[];for(const stmt of statements)result.push(await stmt.run());sqlite.exec('COMMIT');return result;}catch(error){sqlite.exec('ROLLBACK');throw error;}}};
  const objects=new Map();const BUCKET={async head(key){return objects.get(key)??null;},async put(key,bytes,options){objects.set(key,{key,bytes,size:bytes.byteLength,uploaded:new Date(),httpMetadata:options.httpMetadata});},async get(key){const object=objects.get(key);return object?{...object,body:object.bytes}:null;},async list(){return {objects:[...objects.values()],truncated:false};}};
  return {DB,BUCKET,sqlite};
}
const tx=(id='one',version=0,amount=12000)=>({id,entity:'transaction',payload:{id,type:'expense',amountMinor:amount},version});
async function request(env,path,method='GET',body,authenticated=true,headers={}){
  return handleApi(new Request('https://wallet.example'+path,{method,headers:{...(authenticated?{'oai-authenticated-user-id':'owner'}:{}),...(body?{'content-type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined}),env);
}
test('visitor records and backup require Sites identity',async()=>{const env=fixture();for(const path of ['/api/session','/api/records','/api/backup','/api/archive'])assert.equal((await request(env,path,'GET',undefined,false)).status,401);});
test('sync retries preserve one record; stale edits conflict without replacing data',async()=>{
  const env=fixture();const a=await(await request(env,'/api/sync','POST',{records:[tx()]})).json();assert.equal(a.results[0].version,1);
  const retry=await(await request(env,'/api/sync','POST',{records:[tx()]})).json();assert.equal(retry.results[0].status,'saved');assert.equal(retry.results[0].version,1);
  const update=await(await request(env,'/api/sync','POST',{records:[tx('one',1,13000)]})).json();assert.equal(update.results[0].version,2);
  const stale=await(await request(env,'/api/sync','POST',{records:[tx('one',1,14000)]})).json();assert.equal(stale.results[0].status,'conflict');assert.equal(stale.results[0].remote.payload.amountMinor,13000);
  assert.equal(env.sqlite.prepare('SELECT COUNT(*) AS n FROM wallet_records').get().n,1);
});
test('private service initialization is idempotent and retains mobile edits',async()=>{
  const env=fixture();const source={schemaVersion:1,source:{sha256:'test'},transactions:[tx().payload],categories:['食物'],modules:[],historicalSummaries:[],reviewItems:[]};
  assert.equal((await(await request(env,'/api/import','POST',source,false)).json()).inserted,3);
  await request(env,'/api/sync','POST',{records:[tx('one',1,15000)]});
  assert.equal((await(await request(env,'/api/import','POST',source,false)).json()).inserted,0);
  assert.equal((await(await request(env,'/api/records')).json()).records.find(r=>r.id==='one').payload.amountMinor,15000);
});
test('keyset pagination retrieves every record across page boundaries',async()=>{
  const env=fixture();await request(env,'/api/import','POST',{records:Array.from({length:503},(_,i)=>tx(String(i).padStart(4,'0')))},false);
  const page=await(await request(env,'/api/records')).json();assert.equal(page.records.length,500);assert.equal(page.nextCursor,'0499');
  const rest=await(await request(env,'/api/records?after='+page.nextCursor)).json();assert.equal(rest.records.length,3);assert.equal(rest.nextCursor,null);
});
test('invalid writes and cross-origin writes do not change stored records',async()=>{
  const env=fixture();assert.equal((await request(env,'/api/sync','POST',{records:[tx()]},true,{origin:'https://evil.example'})).status,403);
  assert.equal((await request(env,'/api/sync','POST',{records:[tx(),{...tx('two'),entity:'invalid'}]})).status,400);
  assert.equal(env.sqlite.prepare('SELECT COUNT(*) AS n FROM wallet_records').get().n,0);
});
test('archives preserve original bytes and reject traversal names',async()=>{
  const env=fixture();const bytes=new Uint8Array([80,75,0,255]);
  const uploaded=await handleApi(new Request('https://wallet.example/api/archive?name=source.xlsx',{method:'POST',body:bytes}),env);assert.equal(uploaded.status,200);
  await request(env,'/api/summary/setup','POST',{password:'test password 123'});
  const object=await request(env,'/api/archive?name=source.xlsx','GET',undefined,true,{'x-summary-password':'test password 123'});assert.deepEqual(new Uint8Array(await object.arrayBuffer()),bytes);
  assert.equal((await request(env,'/api/archive?name=..%2Fsource.xlsx')).status,400);
  await request(env,'/api/sync','POST',{records:[tx()]});
  const backup=await(await request(env,'/api/backup','GET',undefined,true,{'x-summary-password':'test password 123'})).json();assert.equal(backup.archives[0].name,'source.xlsx');
  assert.equal(backup.backupVersion,1);assert.deepEqual(backup.settings,[]);assert.deepEqual(backup.conflicts,[]);
  assert.equal(typeof backup.records[0].payload,'string');assert.equal(backup.records[0].state,'synced');assert.equal(JSON.parse(backup.records[0].payload).amountMinor,12000);
});
test('incremental checkpoint catches changes made behind a pagination cursor on the next pull',async()=>{
  const env=fixture(),old='2026-10-11T01:00:00.000Z',checkpoint='2026-10-11T02:00:00.000Z',later='2026-10-11T03:00:00.000Z';
  await request(env,'/api/import','POST',{records:Array.from({length:503},(_,i)=>tx(String(i).padStart(4,'0')))},false);
  env.sqlite.prepare('UPDATE wallet_records SET updated_at=?').run(old);
  const first=await(await request(env,'/api/records?until='+checkpoint)).json();assert.equal(first.checkpoint,checkpoint);assert.equal(first.records.length,500);
  env.sqlite.prepare('UPDATE wallet_records SET updated_at=?,version=2,payload=? WHERE id=?').run(later,JSON.stringify(tx('0001',2,17000).payload),'0001');
  const second=await(await request(env,'/api/records?after='+first.nextCursor+'&until='+checkpoint)).json();assert.equal(second.records.length,3);assert.equal(second.checkpoint,checkpoint);
  const next=await(await request(env,'/api/records?since='+checkpoint+'&until='+later)).json();assert.equal(next.records.length,1);assert.equal(next.records[0].id,'0001');assert.equal(next.records[0].payload.amountMinor,17000);
  const replay=await(await request(env,'/api/records?since='+later+'&until='+later)).json();assert.equal(replay.records.length,1);
  assert.equal((await request(env,'/api/records?since=invalid')).status,400);
  assert.equal((await request(env,'/api/records?since='+later+'&until='+checkpoint)).status,400);
});

test('summary password encrypts data at rest and generic endpoints cannot bypass the lock',async()=>{
 const env=fixture(),secret={id:'saving-1',entity:'module',payload:{id:'saving-1',type:'saving',title:'Secret account',fields:{balance:998877}},version:0};
 await request(env,'/api/import','POST',{records:[secret,tx()]},false);
 let page=await(await request(env,'/api/records')).json();assert.equal(page.records.find(r=>r.id===secret.id).payload.lockedSummary,true);assert.equal(JSON.stringify(page).includes('998877'),false);
 assert.equal((await request(env,'/api/backup')).status,423);assert.equal((await request(env,'/api/summary/setup','POST',{password:'short'})).status,400);
 const setup=await(await request(env,'/api/summary/setup','POST',{password:'strong personal password'})).json();assert.equal(setup.records[0].payload.fields.balance,998877);
 const stored=env.sqlite.prepare('SELECT payload FROM wallet_records WHERE id=?').get(secret.id).payload;assert.equal(stored.includes('998877'),false);assert.equal(stored.includes('Secret account'),false);assert.equal(JSON.parse(stored).encryptedSummary,1);
 assert.equal((await request(env,'/api/summary/unlock','POST',{password:'wrong password'})).status,403);
 const unlock=await(await request(env,'/api/summary/unlock','POST',{password:'strong personal password'})).json();assert.deepEqual(unlock.records[0].payload,secret.payload);
 assert.equal((await request(env,'/api/summary/setup','POST',{password:'another strong password'})).status,409);
 assert.equal((await request(env,'/api/sync','POST',{records:[secret]})).status,403);
 assert.equal((await request(env,'/api/sync','POST',{records:[tx(secret.id,2)]})).status,403);
 assert.equal((await request(env,'/api/import','POST',{records:[{...secret,id:'new-secret'}]},false)).status,403);
 assert.equal((await request(env,'/api/import','POST',{records:[secret]},false)).status,200);
 assert.equal((await request(env,'/api/backup','GET',undefined,true,{'x-summary-password':'bad'})).status,403);
 const backup=await(await request(env,'/api/backup','GET',undefined,true,{'x-summary-password':'strong personal password'})).json();assert.equal(JSON.parse(backup.records.find(r=>r.id===secret.id).payload).fields.balance,998877);
 assert.equal((await request(env,'/api/summary/status','GET',undefined,false)).status,401);
});
test('summary encryption handles realistic row volume, large baselines and annual reviews atomically',async()=>{
 const env=fixture(),records=Array.from({length:580},(_,i)=>({id:'protected-'+i,entity:'module',payload:{id:'protected-'+i,type:'expense-summary',fields:{value:i}},version:0}));
 records.push({id:'baseline',entity:'module',payload:{id:'baseline',type:'reconciliation',fields:{entries:Array.from({length:12000},(_,i)=>({id:i,amount:12345}))}},version:0});
 records.push({id:'annual-review',entity:'review',payload:{id:'annual-review',sourceSheet:'2026_Expense',originalValue:'sensitive annual info'},version:0});
 await request(env,'/api/import','POST',{records},false);
 const setup=await request(env,'/api/summary/setup','POST',{password:'large dataset password'});assert.equal(setup.status,200);const data=await setup.json();assert.equal(data.protectedRecords,582);assert.equal(data.records.find(r=>r.id==='baseline').payload.fields.entries.length,12000);
 const list=await(await request(env,'/api/records')).json();assert.equal(JSON.stringify(list).includes('sensitive annual info'),false);assert.equal(list.records.find(r=>r.id==='annual-review').payload.lockedSummary,true);
 const row=env.sqlite.prepare('SELECT payload FROM wallet_records WHERE id=?').get('baseline'),payload=JSON.parse(row.payload);payload.ciphertext=payload.ciphertext.slice(0,-4)+'AAAA';env.sqlite.prepare('UPDATE wallet_records SET payload=? WHERE id=?').run(JSON.stringify(payload),'baseline');
 assert.equal((await request(env,'/api/summary/unlock','POST',{password:'large dataset password'})).status,500);
 assert.equal((await request(env,'/api/archive?name=unknown.xlsx')).status,423);
});
