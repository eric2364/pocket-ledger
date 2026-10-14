import test from 'node:test';
import assert from 'node:assert/strict';
import {SUMMARY_SESSION_MS,summarySessionActive} from '../src/lib/summarySession';
test('Summary expires after ten elapsed minutes even if a background timer was suspended',()=>{
 const opened=1000000,expires=opened+SUMMARY_SESSION_MS;
 assert.equal(SUMMARY_SESSION_MS,600000);
 assert.equal(summarySessionActive(expires,opened+599999),true);
 assert.equal(summarySessionActive(expires,opened+600000),false);
 assert.equal(summarySessionActive(expires,opened+3600000),false);
 assert.equal(summarySessionActive(0,opened),false);
});

test('unlocked password survives navigation calls but expires before protected downloads',async()=>{
 const access=await import('../src/summaryAccess');
 const originalFetch=globalThis.fetch,originalNow=Date.now;
 const originalLocation=Object.getOwnPropertyDescriptor(globalThis,'location');
 let now=1000000;
 Object.defineProperty(globalThis,'location',{value:{hostname:'test.chatgpt.site'},configurable:true});
 Date.now=()=>now;
 globalThis.fetch=async()=>new Response(JSON.stringify({records:[]}),{status:200});
 try{
  await access.unlockSummary('synthetic-test');
  const deadline=access.summaryExpiresAt();
  assert.equal(access.summaryUnlocked(),true);
  now+=599999;
  assert.equal(access.summaryHeaders()['x-summary-password'],'synthetic-test');
  assert.equal(access.summaryExpiresAt(),deadline,'checking access must not extend expiry');
  now++;
  assert.throws(()=>access.summaryHeaders(),/Unlock Summary/);
  assert.equal(access.summaryUnlocked(),false);
  await access.unlockSummary('synthetic-test');
  access.lockSummary();
  assert.throws(()=>access.summaryPasswordValue(),/Unlock Summary/);
 }finally{
  access.lockSummary();globalThis.fetch=originalFetch;Date.now=originalNow;
  if(originalLocation)Object.defineProperty(globalThis,'location',originalLocation);else delete (globalThis as any).location;
 }
});
