import test from 'node:test';
import assert from 'node:assert/strict';
import {readFavorites,validateFavorites} from '../src/lib/quickAdd';
test('ten configurable shortcuts survive setting serialization and preserve categories and kinds',()=>{
 const favorites=Array.from({length:10},(_,i)=>({id:`favorite-${i}`,label:i?'Label '+i:'',category:'Category '+i,kind:i===9?'income' as const:'expense' as const}));
 const valid=validateFavorites(favorites);assert.equal(valid[0].label,'CATEGORY 0');assert.deepEqual(readFavorites(JSON.stringify(valid)),valid);assert.equal(favorites[0].label,'');assert.throws(()=>validateFavorites([...favorites,{...favorites[0],id:'extra'}]),/10/);assert.throws(()=>validateFavorites([favorites[0],favorites[0]]),/unique/);assert.throws(()=>validateFavorites([{...favorites[0],category:' '}]),/category/);
});
test('empty shortcuts remain intentionally empty and malformed saved settings recover safe defaults',()=>{assert.deepEqual(readFavorites('[]'),[]);assert.equal(readFavorites('malformed').length,4);});

test('category shortcuts use uppercase while distinct custom labels remain intact',()=>{assert.equal(readFavorites(null)[0].label,'LUNCH');assert.equal(validateFavorites([{id:'a',label:'lunch',category:'Lunch',kind:'expense'}])[0].label,'LUNCH');});
