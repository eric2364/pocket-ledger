import test from 'node:test';
import assert from 'node:assert/strict';
import {readAllPages} from '../functions/wallet-summary/pagination.mjs';
test('all records preserved when project returns fewer rows than requested',async()=>{
 const records=Array.from({length:211},(_,id)=>({id}));const starts=[];
 const result=await readAllPages(async(start,end)=>{starts.push(start);return records.slice(start,Math.min(end+1,start+100));});
 assert.deepEqual(result,records);assert.deepEqual(starts,[0,100,200,211]);
});
test('exact page boundary and empty database terminate without missing or duplicate records',async()=>{
 const records=Array.from({length:20},(_,id)=>({id}));
 assert.deepEqual(await readAllPages(async(start,end)=>records.slice(start,end+1),10),records);
 assert.deepEqual(await readAllPages(async()=>[]),[]);
});
