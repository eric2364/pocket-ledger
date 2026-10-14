import {createClient} from 'npm:@supabase/supabase-js@2.117.3';
import {createSummaryConfig,summaryKey,isProtected,encryptRecord,decryptRecord} from './crypto.mjs';
import {cloudBackup} from './backup.mjs';
import {readAllPages} from './pagination.mjs';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
const apiFail=(message:string,status=400,code='summary_request_failed')=>Object.assign(new Error(message),{status,code});
// Only static stages and SQLSTATE are logged; no record content or credentials.
function backendFailure(stage:string,error:{code?:string}){console.error(JSON.stringify({service:'wallet-summary',stage,sqlstate:typeof error.code==='string'&&/^[A-Z0-9]{5}$/.test(error.code)?error.code:'unavailable'}));}
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
  if(securityError){backendFailure('security_read',securityError);throw apiFail('Summary service unavailable. Please try again later.',503,'summary_security_read_failed');}
  if(body.action==='status')return json({configured:!!security});
  async function records(){return readAllPages(async(start:number,end:number)=>{const {data,error}=await admin.from('wallet_records').select('id,entity,payload,version,updated_at').eq('user_id',owner).order('id').range(start,end);if(error){backendFailure('records_read',error);throw apiFail('Could not read wallet. Please try again later.',503,'summary_records_read_failed');}return data;});}
  async function archives(){const {data,error}=await admin.storage.from('wallet-private').list(owner,{limit:1000});if(error)throw apiFail('Could not list original files',503);return (data??[]).filter(item=>item.id).map(item=>({name:item.name,size:item.metadata?.size,uploaded:item.created_at}));}
  if(body.action==='archives')return json({archives:await archives()});
  if(body.action==='setup'){
   if(security)throw apiFail('Summary password already configured',409);
   if(body.password!==body.confirm)throw apiFail('Passwords do not match');
   const {key,config}=await createSummaryConfig(body.password);
   const protectedRows=(await records()).filter(isProtected);
   const encrypted=[];for(const row of protectedRows)encrypted.push(await encryptRecord(row,key));
   const {error}=await admin.rpc('wallet_setup_summary',{p_user_id:owner,p_config:config,p_records:encrypted});
   if(error){backendFailure('setup_commit',error);if(error.code==='P0001')throw apiFail('Summary changed or password already configured. Refresh and try again.',409,'summary_setup_conflict');throw apiFail('Could not save Summary password. Your records were not changed. Please try again later.',503,'summary_setup_save_failed');}
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
 }catch(error){const problem=error as Error&{status?:number;code?:string};if(!problem.status)backendFailure('unexpected',{code:undefined});return json({error:problem.status?problem.message:'Summary request failed. Please try again later.',code:problem.code??'summary_unexpected'},problem.status??500);}
});
