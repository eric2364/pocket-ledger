// @ts-nocheck
import {createClient} from 'npm:@supabase/supabase-js@2.117.3';
const TYPES=new Set(['saving','income-summary','expense-summary','tax','investment','reconciliation']);
const fail=(message,status=403)=>Object.assign(new Error(message),{status});
const enc=new TextEncoder(),dec=new TextDecoder();
const b64=bytes=>{const data=new Uint8Array(bytes);let text='';for(let i=0;i<data.length;i+=16384)text+=String.fromCharCode(...data.subarray(i,i+16384));return btoa(text);};
const unb64=text=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
const summarySheet=value=>typeof value==='string'&&/^(Saving|Income|\d{4}_Expense|TaxProjection|MonthlyInvestment)$/i.test(value);
function isProtected(record){return (record.entity==='review'&&(summarySheet(record.payload?.sourceSheet)||summarySheet(record.payload?.originalRecord?.sourceSheet)||TYPES.has(record.payload?.originalRecord?.type)||record.payload?.originalRecord?.entity==='historical'||TYPES.has(record.payload?.originalRecord?.payload?.type)))||record.entity==='historical'||record.payload?.encryptedSummary===1||record.payload?.lockedSummary===true||(record.entity==='module'&&TYPES.has(record.payload?.type));}
function lockedRecord(record){if(!isProtected(record))return record;return {...record,payload:{id:record.id,lockedSummary:true,type:record.payload?.type??'historical',sourceSheet:record.payload?.sourceSheet}};}
async function keyFor(password,salt){const material=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt:unb64(salt),iterations:100000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
async function seal(key,text,aad){const iv=crypto.getRandomValues(new Uint8Array(12));return {iv:b64(iv),ciphertext:b64(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode(aad)},key,enc.encode(text)))};}
async function open(key,envelope,aad){return dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(envelope.iv),additionalData:enc.encode(aad)},key,unb64(envelope.ciphertext)));}
async function createSummaryConfig(password){if(typeof password!=='string'||password.length<10||password.length>1024)throw fail('Use a password with at least 10 characters',400);const salt=b64(crypto.getRandomValues(new Uint8Array(16))),key=await keyFor(password,salt);return {key,config:{version:1,salt,iterations:100000,verifier:await seal(key,'pocket-ledger-summary-v1','summary-verifier')}};}
async function summaryKey(config,password){if(!config)throw fail('Set up your Summary password first',423);if(typeof password!=='string'||password.length>1024)throw fail('Summary password required',423);try{const key=await keyFor(password,config.salt);if(await open(key,config.verifier,'summary-verifier')!=='pocket-ledger-summary-v1')throw Error();return key;}catch{throw fail('Incorrect Summary password');}}
async function encryptRecord(record,key){return {...record,payload:{encryptedSummary:1,type:record.payload.type??'historical',sourceSheet:record.payload.sourceSheet,...await seal(key,JSON.stringify(record.payload),record.id+':'+record.entity)}};}
async function decryptRecord(record,key){if(record.payload.encryptedSummary!==1)throw fail('Summary contains records requiring encryption',409);return {...record,payload:JSON.parse(await open(key,record.payload,record.id+':'+record.entity))};}

/** Restore-compatible export; callers provide only authorized, decrypted rows. */
function cloudBackup(records,archives=[],createdAt=new Date().toISOString()){
 return {backupVersion:1,createdAt,records:records.map(row=>({...row,payload:JSON.stringify(row.payload),state:'synced'})),settings:[],conflicts:[],archives};
}

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
const apiFail=(message:string,status=400)=>Object.assign(new Error(message),{status});
Deno.serve(async(request:Request)=>{
 if(request.method==='OPTIONS')return new Response(null,{headers:cors});
 if(request.method!=='POST')return json({error:'POST required'},405);
 try{
  const url=Deno.env.get('SUPABASE_URL')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const authorization=request.headers.get('authorization')??'';
  if(!authorization.startsWith('Bearer '))throw apiFail('Sign in first',401);
  // Never trust decoded JWT claims. Verify identity with Supabase Auth.
  const {data:identity,error:authError}=await admin.auth.getUser(authorization.slice(7));
  if(authError||!identity.user)throw apiFail('Sign in first',401);
  const owner=identity.user.id;
  const allowedOwner=Deno.env.get('WALLET_OWNER_ID');
  if(allowedOwner&&owner!==allowedOwner)throw apiFail('This wallet belongs to another account',403);
  const body=await request.json();
  const {data:security,error:securityError}=await admin.from('wallet_summary_security').select('config').eq('user_id',owner).maybeSingle();
  if(securityError)throw apiFail('Summary service unavailable',503);
  if(body.action==='status')return json({configured:!!security});
  async function records(){const rows:any[]=[];for(let offset=0;;offset+=1000){const {data,error}=await admin.from('wallet_records').select('id,entity,payload,version,updated_at').eq('user_id',owner).order('id').range(offset,offset+999);if(error)throw apiFail('Could not read wallet',503);rows.push(...data);if(data.length<1000)break;}return rows;}
  async function archives(){const {data,error}=await admin.storage.from('wallet-private').list(owner,{limit:1000});if(error)throw apiFail('Could not list original files',503);return (data??[]).filter(item=>item.id).map(item=>({name:item.name,size:item.metadata?.size,uploaded:item.created_at}));}
  if(body.action==='archives')return json({archives:await archives()});
  if(body.action==='setup'){
   if(security)throw apiFail('Summary password already configured',409);
   if(body.password!==body.confirm)throw apiFail('Passwords do not match');
   const {key,config}=await createSummaryConfig(body.password);
   const protectedRows=(await records()).filter(isProtected);
   const encrypted=[];for(const row of protectedRows)encrypted.push(await encryptRecord(row,key));
   const {error}=await admin.rpc('wallet_setup_summary',{p_user_id:owner,p_config:config,p_records:encrypted});
   if(error)throw apiFail('Summary changed or password already configured. Refresh and try again.',409);
   return json({configured:true,records:protectedRows.map(row=>({...row,version:row.version+1}))});
  }
  if(!['unlock','backup','archive'].includes(body.action))throw apiFail('Unknown Summary action');
  // Atomically reserve a password attempt before deriving its key, so parallel guesses
  // cannot evade the per-user rolling limit. Password and decrypted data are never logged.
  const {data:allowed,error:attemptError}=await admin.rpc('wallet_summary_attempt',{p_user_id:owner});
  if(attemptError||allowed!==true)throw apiFail('Too many attempts. Wait one minute and try again.',429);
  const key=await summaryKey(security?.config,body.password);
  await admin.from('wallet_summary_security').update({failed_attempts:0,locked_until:null}).eq('user_id',owner);
  if(body.action==='archive'){
   if(typeof body.key!=='string'||! /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,179}$/.test(body.key)||body.key.includes('..'))throw apiFail('Invalid file name');
   const {data,error}=await admin.storage.from('wallet-private').download(owner+'/'+body.key);
   if(error||!data)throw apiFail('Original file not found',404);
   return new Response(data,{headers:{...cors,'Content-Type':data.type||'application/octet-stream','Content-Disposition':'attachment; filename="'+body.key+'"'}});
  }
  const output=[];for(const row of await records())if(isProtected(row))output.push(await decryptRecord(row,key));else if(body.action==='backup')output.push(row);
  return json(body.action==='backup'?cloudBackup(output,await archives()):{configured:true,records:output});
 }catch(error){const problem=error as Error&{status?:number};return json({error:problem.status?problem.message:'Summary request failed'},problem.status??500);}
});
