import test from 'node:test';
import assert from 'node:assert/strict';
import {lockSummary,unlockSummary,refreshUnlockedSummary,summaryExpiresAt} from '../src/summaryAccess';

test('spreadsheet exports refresh Summary without extending unlock time and reject relocking during fetch',async()=>{
 const priorLocation=Object.getOwnPropertyDescriptor(globalThis,'location'),priorFetch=globalThis.fetch;
 Object.defineProperty(globalThis,'location',{configurable:true,value:{hostname:'synthetic.chatgpt.site'}});
 let requestCount=0;
 globalThis.fetch=async()=>({ok:true,json:async()=>({records:[{id:'fresh-summary',entity:'historical',payload:{revision:++requestCount},version:requestCount}]})}) as Response;
 try{
  await assert.rejects(refreshUnlockedSummary(),/Unlock Summary/);
  await unlockSummary('synthetic test password');
  const expiry=summaryExpiresAt();
  const refreshed=await refreshUnlockedSummary();
  assert.equal(refreshed.records[0].version,2);
  assert.equal(summaryExpiresAt(),expiry);
  let finish!:(value:Response)=>void;
  globalThis.fetch=()=>new Promise<Response>(resolve=>{finish=resolve;});
  const inFlight=refreshUnlockedSummary();
  lockSummary();
  finish({ok:true,json:async()=>({records:[]})} as Response);
  await assert.rejects(inFlight,/locked/);
 }finally{
  lockSummary();globalThis.fetch=priorFetch;
  if(priorLocation)Object.defineProperty(globalThis,'location',priorLocation);else Reflect.deleteProperty(globalThis,'location');
 }
});
