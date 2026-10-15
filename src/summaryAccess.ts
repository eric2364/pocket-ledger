import {SUMMARY_SESSION_MS,summarySessionActive} from './lib/summarySession';
export interface SummaryCloudRecord {id:string;entity:string;payload:Record<string,any>;version:number;}
let passwordInMemory:string|undefined;let accessGeneration=0;let expiresAt=0;
const types=new Set(['saving','income-summary','expense-summary','tax','investment','reconciliation']);
const summarySheet=(value:any)=>typeof value==='string'&&/^(Saving|Income|\d{4}_Expense|TaxProjection|MonthlyInvestment)$/i.test(value);
export function isProtectedSummary(entity:string,payload:any):boolean{return (entity==='review'&&(summarySheet(payload?.sourceSheet)||summarySheet(payload?.originalRecord?.sourceSheet)||types.has(payload?.originalRecord?.type)||payload?.originalRecord?.entity==='historical'||types.has(payload?.originalRecord?.payload?.type)))||entity==='historical'||payload?.encryptedSummary===1||payload?.lockedSummary===true||(entity==='module'&&types.has(payload?.type));}
async function call(path:string,body?:object){if(!(typeof location!=='undefined'&&location.hostname.endsWith('.chatgpt.site'))){const {getCloudConfig,summaryRequest}=await import('./lib/cloud');if(await getCloudConfig())return summaryRequest(path,body as Record<string,unknown>);} const response=await fetch('/api/summary/'+path,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});const data=await response.json();if(!response.ok)throw new Error(data.error||'Summary unavailable');return data;}
export async function summaryStatus():Promise<{configured:boolean}>{return call('status');}
export async function setupSummary(password:string,confirm=password):Promise<{configured:boolean;records:SummaryCloudRecord[]}>{lockSummary();const generation=accessGeneration;const result=await call('setup',{password,confirm});if(generation!==accessGeneration)throw new Error('Summary was locked. Unlock again.');passwordInMemory=password;expiresAt=Date.now()+SUMMARY_SESSION_MS;return result;}
export async function unlockSummary(password:string):Promise<{records:SummaryCloudRecord[]}>{lockSummary();const generation=accessGeneration;const result=await call('unlock',{password});if(generation!==accessGeneration)throw new Error('Summary was locked. Unlock again.');passwordInMemory=password;expiresAt=Date.now()+SUMMARY_SESSION_MS;return result;}
export function lockSummary(){passwordInMemory=undefined;expiresAt=0;accessGeneration++;}
export function summaryUnlocked(){if(!summarySessionActive(expiresAt))lockSummary();return passwordInMemory!==undefined;}
export function summaryExpiresAt(){return expiresAt;}
export function summaryHeaders():Record<string,string>{if(!summaryUnlocked())throw new Error('Unlock Summary before downloading files containing personal summary information.');return {'x-summary-password':passwordInMemory!};}

export function summaryPasswordValue(){if(!summaryUnlocked())throw new Error('Unlock Summary before downloading personal files.');return passwordInMemory!;}

/** Refresh decrypted records without extending the existing unlock session. */
export async function refreshUnlockedSummary():Promise<{records:SummaryCloudRecord[]}>{
 if(!summaryUnlocked())throw new Error('Unlock Summary before exporting your spreadsheet.');
 const generation=accessGeneration;
 const result=await call('unlock',{password:passwordInMemory!});
 if(generation!==accessGeneration||!summaryUnlocked())throw new Error('Summary was locked. Unlock again before exporting.');
 return result;
}
