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
test('only empty or non-string Summary passwords are rejected',async()=>{
 for(const value of ['',null,undefined,1234]){await assert.rejects(createSummaryConfig(value));}
 const {config}=await createSummaryConfig('valid');
 for(const value of ['',null,undefined,1234]){await assert.rejects(summaryKey(config,value));}
});
test('single-character, numeric, Unicode, spaces and long passwords set up and unlock unchanged',async()=>{
 for(const password of ['a','1234','密碼🔐',' ',' spaces stay exact ','x'.repeat(2048)]){
  const {key,config}=await createSummaryConfig(password);
  const encrypted=await encryptRecord(baseline,key);
  assert.deepEqual((await decryptRecord(encrypted,await summaryKey(config,password))).payload,baseline.payload);
 }
});
test('existing encrypted configuration and records remain compatible',async()=>{
 // Synthetic fixture encrypted before removing password length restrictions.
 const config={version:1,salt:'0KDOGS6MbBJlNAihG69l+Q==',iterations:100000,verifier:{iv:'M6Du+vIHXuuUDtOy',ciphertext:'OYbf6ag3210DRAYTvLubUUIZrRzHXKTJidodieMtzv8p08F4t0lFUQ=='}};
 const record={id:'legacy-synthetic',entity:'historical',version:2,payload:{encryptedSummary:1,type:'historical',iv:'AoPhEPNu9Ll5SA9l',ciphertext:'NPL38mvWdA5YaYQRgQtr+rwqO/NPAvIvPbdDfIAneW5z4Fr8bs3fPIw+hx4QxyqR1N96qDv+4G9MQwmKBVWZJJPcbFQhOstF6lVZpeDoDw=='}};
 assert.deepEqual((await decryptRecord(record,await summaryKey(config,'Legacy-synthetic-password'))).payload,{id:'legacy-synthetic',description:'legacy synthetic data'});
 await assert.rejects(summaryKey(config,'different'));
});
