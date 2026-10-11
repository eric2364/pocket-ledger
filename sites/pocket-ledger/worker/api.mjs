import {isProtected,lockedRecord,securityConfig,authorizeSummary,setupSummary,summaryRecords,rejectProtectedWrite} from './summary-security.mjs';
// This API is supported ONLY behind a confirmed owner-private Sites boundary.
// Dispatch authenticates visitors and consumes service credentials before routing.
const ENTITIES = new Set(['transaction','module','template','category','historical','review','source']);
const json = (value, status = 200, extra = {}) => new Response(JSON.stringify(value), {status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store',...extra}});
function requireSameOrigin(request) {
  const origin=request.headers.get('origin');
  if(origin && origin!==new URL(request.url).origin) throw Object.assign(new Error('Origin rejected'),{status:403});
}
async function readJSON(request, max=12*1024*1024) {
  if(Number(request.headers.get('content-length'))>max) throw Object.assign(new Error('Request too large'),{status:413});
  const text=await request.text();if(text.length>max)throw Object.assign(new Error('Request too large'),{status:413});
  try{return JSON.parse(text);}catch{throw Object.assign(new Error('Invalid JSON'),{status:400});}
}
function validate(record) {
  if(!record || typeof record.id!=='string' || !record.id || record.id.length>512 || !ENTITIES.has(record.entity) || !record.payload || typeof record.payload!=='object' || Array.isArray(record.payload))throw Object.assign(new Error('Invalid record'),{status:400});
  if(!Number.isSafeInteger(record.version??0) || (record.version??0)<0)throw Object.assign(new Error('Invalid record version'),{status:400});
  const payload=JSON.stringify(record.payload);if(payload.length>1024*1024)throw Object.assign(new Error('Record too large'),{status:413});
  return {...record,payload,version:record.version??0};
}
const unpack=row=>row?{id:row.id,entity:row.entity,payload:JSON.parse(row.payload),version:row.version}:null;
async function saveRecord(db,input){
  const r=validate(input);
  const row=await db.prepare(`INSERT INTO wallet_records(id,entity,payload,version,updated_at) VALUES(?,?,?,1,?) ON CONFLICT(id) DO UPDATE SET entity=excluded.entity,payload=excluded.payload,version=wallet_records.version+1,updated_at=excluded.updated_at WHERE wallet_records.version=? AND ?>0 RETURNING id,entity,payload,version`).bind(r.id,r.entity,r.payload,new Date().toISOString(),r.version,r.version).first();
  if(row)return {id:r.id,status:'saved',version:row.version};
  const remote=await db.prepare('SELECT id,entity,payload,version FROM wallet_records WHERE id=?').bind(r.id).first();
  // Retry after a response was lost: acknowledge the already persisted content.
  if(remote && remote.entity===r.entity && remote.payload===r.payload)return {id:r.id,status:'saved',version:remote.version};
  return {id:r.id,status:'conflict',version:remote?.version??0,remote:unpack(remote)};
}
function importRecords(body){
  if(Array.isArray(body.records))return body.records;
  if(body.schemaVersion!==1 || !body.source?.sha256 || !Array.isArray(body.transactions))throw Object.assign(new Error('Unsupported import'),{status:400});
  const records=[];
  const add=(entity,item)=>records.push({id:item.id,entity,payload:item,version:0});
  for(const item of body.transactions)add('transaction',item);
  for(const item of body.modules??[])add('module',item);
  for(const name of body.categories??[])add('category',{id:'category:'+name,name});
  for(const [entity,items] of [['historical',body.historicalSummaries],['review',body.reviewItems]])for(let i=0;i<(items??[]).length;i++)add(entity,{...(typeof items[i]==='object'&&items[i]!==null?items[i]:{value:items[i]}),id:`${body.source.sha256}:${entity}:${i}`});
  add('source',{...body.source,id:'source:'+body.source.sha256});
  return records;
}
function safeName(name){if(!name||name.length>180||!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name)||name.includes('..'))throw Object.assign(new Error('Invalid archive name'),{status:400});return name;}
async function archiveList(bucket){const items=[];let cursor;do{const page=await bucket.list({prefix:'archives/',cursor});items.push(...page.objects.map(o=>({name:o.key.slice(9),size:o.size,uploaded:o.uploaded})));cursor=page.truncated?page.cursor:undefined;}while(cursor);return items;}
export async function handleApi(request,env){
  const url=new URL(request.url),path=url.pathname,user=request.headers.get('oai-authenticated-user-id');
  if(!path.startsWith('/api/'))return null;
  try{
    // Import/archive writes without visitor identity use the owner-private service
    // boundary. Never deploy these routes to a public/shared Site.
    const serviceWrite=request.method==='POST' && (path==='/api/import'||path==='/api/archive');
    if(!user&&!serviceWrite)return json({error:'Sign in with ChatGPT'},401);
    if(request.method!=='GET')requireSameOrigin(request);
    if(path==='/api/session'&&request.method==='GET')return json({authenticated:true});
    if(path==='/api/summary/status'&&request.method==='GET')return json({configured:!!await securityConfig(env.DB)});
    if(path==='/api/summary/setup'&&request.method==='POST'){
      const body=await readJSON(request,4096);if(body.confirm!==undefined&&body.confirm!==body.password)return json({error:'Passwords do not match'},400);
      const status=await setupSummary(env.DB,body.password);const key=await authorizeSummary(env.DB,body.password);return json({...status,records:await summaryRecords(env.DB,key)});
    }
    if(path==='/api/summary/unlock'&&request.method==='POST'){
      const body=await readJSON(request,4096);const key=await authorizeSummary(env.DB,body.password);return json({records:await summaryRecords(env.DB,key)});
    }
    if(path==='/api/records'&&request.method==='GET'){
      const after=url.searchParams.get('after')??'',limit=500;
      if(after.length>512)return json({error:'Invalid cursor'},400);
      const since=url.searchParams.get('since'),checkpoint=url.searchParams.get('until')??new Date().toISOString();
      const validDate=value=>/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
      if(!validDate(checkpoint)||(since&&!validDate(since))||(since&&since>checkpoint))return json({error:'Invalid checkpoint'},400);
      const query=since?'SELECT id,entity,payload,version FROM wallet_records WHERE id>? AND updated_at>=? AND updated_at<=? ORDER BY id LIMIT ?':'SELECT id,entity,payload,version FROM wallet_records WHERE id>? AND updated_at<=? ORDER BY id LIMIT ?';
      const {results}=await env.DB.prepare(query).bind(...(since?[after,since,checkpoint,limit+1]:[after,checkpoint,limit+1])).all();
      const page=results.slice(0,limit);
      return json({records:page.map(row=>lockedRecord(unpack(row))),nextCursor:results.length>limit?page.at(-1).id:null,checkpoint});
    }
    if(path==='/api/sync'&&request.method==='POST'){
      const body=await readJSON(request,4*1024*1024);if(!Array.isArray(body.records)||body.records.length>100)return json({error:'Send at most 100 records'},400);
      body.records.forEach(validate);
      for(const record of body.records)await rejectProtectedWrite(env.DB,record);
      const results=[];for(const record of body.records)results.push(await saveRecord(env.DB,record));
      return json({results});
    }
    if(path==='/api/import'&&request.method==='POST'){
      const records=importRecords(await readJSON(request));records.forEach(validate);
      const configured=await securityConfig(env.DB);
      if(configured)for(const record of records)if(isProtected(record)){
        const existing=await env.DB.prepare('SELECT id FROM wallet_records WHERE id=?').bind(record.id).first();
        if(!existing)return json({error:'New Summary imports require a protected migration'},403);
      }
      // Existing protected IDs cannot be replaced or recast via imports.
      for(const record of records)if(!isProtected(record))await rejectProtectedWrite(env.DB,record);
      let inserted=0;for(let i=0;i<records.length;i+=50){const batch=records.slice(i,i+50).map(validate).map(r=>env.DB.prepare('INSERT OR IGNORE INTO wallet_records(id,entity,payload,version,updated_at) VALUES(?,?,?,1,?)').bind(r.id,r.entity,r.payload,new Date().toISOString()));const results=await env.DB.batch(batch);for(const result of results)inserted+=result.meta?.changes??0;}
      return json({received:records.length,inserted,retainedExisting:records.length-inserted});
    }
    if(path==='/api/backup'&&request.method==='GET'){
      const summaryKey=await authorizeSummary(env.DB,request.headers.get('x-summary-password'));const decrypted=new Map((await summaryRecords(env.DB,summaryKey)).map(r=>[r.id,r]));
      const {results}=await env.DB.prepare('SELECT id,entity,payload,version FROM wallet_records ORDER BY id').all();
      return json({backupVersion:1,createdAt:new Date().toISOString(),records:results.map(row=>({...row,payload:decrypted.has(row.id)?JSON.stringify(decrypted.get(row.id).payload):row.payload,state:'synced'})),settings:[],conflicts:[],archives:await archiveList(env.BUCKET)},200,{'content-disposition':'attachment; filename="wallet-cloud-backup.json"'});
    }
    if(path==='/api/archive'){
      if(request.method==='GET'&&!url.searchParams.has('name'))return json({archives:await archiveList(env.BUCKET)});
      const name=safeName(url.searchParams.get('name')),key='archives/'+name;
      if(request.method==='POST'){
        const max=30*1024*1024;if(Number(request.headers.get('content-length'))>max)return json({error:'Archive too large'},413);
        const bytes=await request.arrayBuffer();if(bytes.byteLength>max)return json({error:'Archive too large'},413);
        const existing=await env.BUCKET.head(key);if(existing)return json({name,alreadyExists:true});
        await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:request.headers.get('content-type')??'application/octet-stream'}});
        return json({name,size:bytes.byteLength});
      }
      if(request.method==='GET'){await authorizeSummary(env.DB,request.headers.get('x-summary-password'));const object=await env.BUCKET.get(key);if(!object)return json({error:'Archive not found'},404);return new Response(object.body,{headers:{'content-type':object.httpMetadata?.contentType??'application/octet-stream','content-disposition':`attachment; filename="${name}"`,'cache-control':'private, no-store'}});}
    }
    return json({error:'Route or method not found'},404);
  }catch(error){return json({error:error.status?error.message:'Cloud request failed'},error.status??500);}
}
