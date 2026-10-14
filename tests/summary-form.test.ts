import test from 'node:test';
import assert from 'node:assert/strict';
import {summaryFormError} from '../src/lib/summaryForm';

test('Summary setup rejects empty, short or mismatched passwords before submitting',()=>{
 assert.match(summaryFormError(false,'','')!,/Enter/);assert.match(summaryFormError(false,'short','short')!,/10 characters/);
 assert.match(summaryFormError(false,'synthetic-password','different-password')!,/do not match/);
 assert.equal(summaryFormError(false,'synthetic-password','synthetic-password'),null);
});
test('Summary unlock requires a password without imposing a new setup rule on existing passwords',()=>{
 assert.match(summaryFormError(true,'','')!,/Enter/);assert.equal(summaryFormError(true,'existing',''),null);
});
