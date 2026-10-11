import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {AppState,Platform} from 'react-native';
import {isProtectedSummary} from '../summaryAccess';
import {acknowledge,acceptRemoteBatch,getSetting,pendingRecords,preserveConflict,setSetting} from './repository';
const storage={getItem:async(key:string)=>Platform.OS==='web'?localStorage.getItem(key):SecureStore.getItemAsync(key),setItem:async(key:string,value:string)=>{if(Platform.OS==='web')localStorage.setItem(key,value);else await SecureStore.setItemAsync(key,value);},removeItem:async(key:string)=>{if(Platform.OS==='web')localStorage.removeItem(key);else await SecureStore.deleteItemAsync(key);}};
let client:SupabaseClient|undefined;
let syncing:Promise<{uploaded:number;conflicts:number;pending:number}>|undefined;
export function hasBuiltInCloud(){return !!(process.env.EXPO_PUBLIC_SUPABASE_URL&&process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);}
export async function getCloudConfig():Promise<{url:string;key:string}|null>{if(hasBuiltInCloud())return {url:process.env.EXPO_PUBLIC_SUPABASE_URL!,key:process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!};const raw=await storage.getItem('wallet-cloud-config');return raw?JSON.parse(raw):null;}
export async function configureCloud(url:string,key:string){
  const parsed=new URL(url);if(parsed.protocol!=='https:'||!key.trim())throw new Error('Use an HTTPS Supabase project URL and publishable key');
  if(key.startsWith('sb_secret_'))throw new Error('Use a publishable key, never a secret key');
  if(key.startsWith('eyJ')){try{const role=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role;if(role==='service_role')throw new Error('Use the anon or publishable key, never service_role');}catch(error){if(error instanceof Error&&error.message.includes('service_role'))throw error;}}
  url=parsed.origin;key=key.trim();
  const old=await getCloudConfig();if(old&&old.url!==url&&await getSetting('cloud-user'))throw new Error('This wallet is linked to another cloud project. Export and restore to a separate wallet before switching projects.');
  await storage.setItem('wallet-cloud-config',JSON.stringify({url,key}));client=undefined;await getClient();
}
async function getClient(){if(client)return client;const config=await getCloudConfig();if(!config)throw new Error('Configure Supabase in Settings first');client=createClient(config.url,config.key,{auth:{storage,autoRefreshToken:true,persistSession:true,detectSessionInUrl:false}});return client;}
AppState.addEventListener('change',state=>{if(!client)return;if(state==='active')client.auth.startAutoRefresh();else client.auth.stopAutoRefresh();});
export async function getSession(){if(!await getCloudConfig())return null;const {data,error}=await(await getClient()).auth.getSession();if(error)throw error;return data.session;}
export async function signIn(email:string,password:string){const {data,error}=await(await getClient()).auth.signInWithPassword({email,password});if(error)throw error;const bound=await getSetting('cloud-user');if(bound&&bound!==data.user.id){await(await getClient()).auth.signOut();throw new Error('This wallet belongs to a different account. Sign in with the original account.');}return data;}
export async function signUp(email:string,password:string){const {data,error}=await(await getClient()).auth.signUp({email,password});if(error)throw error;return data;}
export async function signOut(){const {error}=await(await getClient()).auth.signOut();if(error)throw error;}
export async function syncNow(){if(syncing)return syncing;syncing=performSync();try{return await syncing;}finally{syncing=undefined;}}
async function performSync(){const c=await getClient(),session=await getSession();if(!session)throw new Error('Sign in before synchronizing');const bound=await getSetting('cloud-user');if(bound&&bound!==session.user.id)throw new Error('Sign in with the account linked to this wallet');await setSetting('cloud-user',session.user.id);let uploaded=0,conflicts=0;
  for(const item of (await pendingRecords()).filter(r=>!isProtectedSummary(r.entity,JSON.parse(r.payload)))){
    const {data,error}=await c.rpc('save_wallet_record',{p_id:item.id,p_entity:item.entity,p_payload:JSON.parse(item.payload),p_expected_version:item.version});if(error)throw error;
    if(data.status==='saved'){await acknowledge(item.id,item.payload,data.version);uploaded++;}else{await preserveConflict(item.id,item.payload,data.remote);conflicts++;}
  }
  // Deterministic pagination includes all records, even when PostgREST caps responses.
  let offset=0;while(true){const {data,error}=await c.from('wallet_records_safe').select('id,entity,payload,version').order('id').range(offset,offset+499);if(error)throw error;await acceptRemoteBatch(data);if(data.length<500)break;offset+=data.length;}
  return {uploaded,conflicts,pending:(await pendingRecords()).length};
}
export async function uploadPrivateFile(filename:string,bytes:ArrayBuffer,contentType='application/octet-stream'){
  const c=await getClient(),session=await getSession();if(!session)throw new Error('Sign in before uploading');const path=`${session.user.id}/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
  const {error}=await c.storage.from('wallet-private').upload(path,bytes,{contentType,upsert:false});if(error)throw error;return {path};
}
export async function getPrivateFileUrl(path:string){const {data,error}=await(await getClient()).storage.from('wallet-private').createSignedUrl(path,60);if(error)throw error;return data.signedUrl;}

export async function summaryRequest(action:string,body:Record<string,unknown>={}){
  const config=await getCloudConfig(),session=await getSession();if(!config||!session)throw new Error('Sign in to unlock your private Summary.');
  const response=await fetch(`${config.url}/functions/v1/wallet-summary`,{method:'POST',headers:{'Content-Type':'application/json',apikey:config.key,Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({action,...body}),cache:'no-store'});
  if(!response.ok){const error=await response.json().catch(()=>({}));throw new Error(error.error||'Private Summary unavailable.');}
  if(action==='archive')return new Uint8Array(await response.arrayBuffer());return response.json();
}
export async function listPrivateArchives():Promise<{name:string;size:number}[]>{return (await summaryRequest('archives')).archives;}
