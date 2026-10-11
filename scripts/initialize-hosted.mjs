// Private initialization: authentication is read from hidden stdin, never argv.
import fs from 'node:fs/promises';
process.stdout.write('Ready for private Site initialization (input hidden).\n');
if(process.stdin.isTTY)process.stdin.setRawMode(true);
const input=await new Promise((resolve,reject)=>{let value='';const read=chunk=>{value+=chunk.toString();if(value.includes('\u0003')){process.stdin.off('data',read);reject(new Error('Cancelled'));}else if(value.includes('\n')||value.includes('\r')){process.stdin.off('data',read);resolve(value.trim());}};process.stdin.on('data',read);process.stdin.resume();});
if(process.stdin.isTTY)process.stdin.setRawMode(false);process.stdin.pause();
const {url,token}=JSON.parse(input);
const target=new URL(url);if(target.protocol!=='https:'||!target.hostname.endsWith('.chatgpt.site'))throw new Error('Use the selected private Site HTTPS origin');
async function post(path,body,type='application/json'){
  const response=await fetch(new URL(path,target),{method:'POST',redirect:'error',headers:{'OAI-Sites-Authorization':`Bearer ${token}`,'Content-Type':type},body});
  const text=await response.text();if(!response.ok)throw new Error(`Initialization failed (${response.status}): ${text.slice(0,200)}`);
  return JSON.parse(text);
}
const payload=JSON.parse(await fs.readFile('private/import.json','utf8'));
const records=[],add=(entity,item)=>records.push({id:item.id,entity,payload:item,version:0});
for(const item of payload.transactions)add('transaction',item);
for(const item of payload.modules)add('module',item);
for(const name of payload.categories)add('category',{id:'category:'+name,name});
for(const [entity,items] of [['historical',payload.historicalSummaries],['review',payload.reviewItems]])for(let i=0;i<items.length;i++)add(entity,{...items[i],id:`${payload.source.sha256}:${entity}:${i}`});
add('source',{...payload.source,id:'source:'+payload.source.sha256});
let inserted=0,retained=0;
for(let i=0;i<records.length;i+=200){const result=await post('/api/import',JSON.stringify({records:records.slice(i,i+200)}));inserted+=result.inserted;retained+=result.retainedExisting;console.log(`Imported ${Math.min(i+200,records.length)}/${records.length} records`);}
const prefix=payload.source.sha256.slice(0,12);
for(const [path,name,type] of [
  ['Expense and Saving.xlsx',`${prefix}-Expense-and-Saving.xlsx`,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ['private/migration.json',`${prefix}-workbook-cell-archive.json`,'application/json'],
  ['private/import.json',`${prefix}-migration-import.json`,'application/json'],
]){const bytes=await fs.readFile(path);const result=await post('/api/archive?name='+encodeURIComponent(name),bytes,type);console.log(JSON.stringify({archive:result.name,size:bytes.length,alreadyExists:!!result.alreadyExists}));}
console.log(JSON.stringify({received:records.length,inserted,retainedExisting:retained,transactions:payload.transactions.length,modules:payload.modules.length}));
