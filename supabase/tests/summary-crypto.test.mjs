import test from 'node:test';
import assert from 'node:assert/strict';
import {createSummaryConfig,summaryKey,encryptRecord,decryptRecord,isProtected,lockedRecord} from '../functions/wallet-summary/crypto.mjs';
const password='Synthetic-only-password-123';
const baseline={id:'synthetic-baseline',entity:'module',version:1,payload:{id:'synthetic-baseline',type:'reconciliation',baselineTransactions:[{description:'private synthetic baseline'}]}};
test('protected baseline is encrypted and only correct independent password restores exact payload',async()=>{
 const {key,config}=await createSummaryConfig(password);
 const encrypted=await encryptRecord(baseline,key);
 assert(!JSON.stringify(encrypted).includes('private synthetic baseline'));
 assert.deepEqual((await decryptRecord(encrypted,await summaryKey(config,password))).payload,baseline.payload);
 await assert.rejects(summaryKey(config,'incorrect-password'));
 await assert.rejects(summaryKey(null,password));
 await assert.rejects(decryptRecord({...encrypted,id:'substituted-id'},key));
 await assert.rejects(decryptRecord({...encrypted,entity:'historical'},key));
});
test('random salt and IV prevent identical record/password ciphertext reuse',async()=>{
 const first=await createSummaryConfig(password),second=await createSummaryConfig(password);
 assert.notEqual(first.config.salt,second.config.salt);
 const one=await encryptRecord(baseline,first.key),two=await encryptRecord(baseline,first.key);
 assert.notEqual(one.payload.iv,two.payload.iv);assert.notEqual(one.payload.ciphertext,two.payload.ciphertext);
});
test('generic record redaction never contains baseline or protected review details',()=>{
 for(const row of [baseline,{id:'r',entity:'review',payload:{originalRecord:{entity:'historical',description:'private synthetic baseline'}}},{id:'h',entity:'historical',payload:{description:'private synthetic baseline'}}]){
  assert(isProtected(row));assert.equal(lockedRecord(row).payload.lockedSummary,true);
  assert(!JSON.stringify(lockedRecord(row)).includes('private synthetic baseline'));
 }
 const ordinary={id:'tx',entity:'transaction',payload:{id:'tx',description:'daily entry'}};
 assert(!isProtected(ordinary));assert.deepEqual(lockedRecord(ordinary),ordinary);
});
test('short and malformed setup passwords rejected',async()=>{
 await assert.rejects(createSummaryConfig('short'));
 await assert.rejects(createSummaryConfig(null));
 await assert.rejects(createSummaryConfig('x'.repeat(1025)));
});
