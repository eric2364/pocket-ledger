import test from 'node:test';
import assert from 'node:assert/strict';
import {summaryFormError} from '../src/lib/summaryForm';

test('Summary setup requires only a non-empty password and exact confirmation',()=>{
 assert.match(summaryFormError(false,'','')!,/Enter/);
 assert.match(summaryFormError(false,'synthetic-password','different-password')!,/do not match/);
 for(const password of ['a','1234','密碼🔐',' ',' spaces stay exact ','x'.repeat(2048)])assert.equal(summaryFormError(false,password,password),null);
 assert.match(summaryFormError(false,' spaced ','spaced')!,/do not match/);
});
test('Summary unlock accepts any non-empty password without trimming or length restrictions',()=>{
 assert.match(summaryFormError(true,'','')!,/Enter/);
 for(const password of ['a','1234','密碼🔐',' ','x'.repeat(2048),'existing'])assert.equal(summaryFormError(true,password,''),null);
});
