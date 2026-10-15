import {validateTransaction} from './domain';
import {normalizeCategoryRecord, formatMoney, rowsToCsv} from './domain';
import type {Transaction, WalletBackup} from './types';

export const TRANSACTION_CSV_COLUMNS = ['id','date','reportingPeriod','kind','category','originalCategory','description','account','amountMinor','originalAmount','currency','exchangeRate','hkdAmountMinor','hkdPersonalShareMinor','personalShareMinor','personalShare','project','notes','sourceSheet','sourceReference','createdAt','updatedAt','deletedAt'];
export const LEDGER_CSV_COLUMNS = ['recordType','recordVersion','recordState',...TRANSACTION_CSV_COLUMNS,'payloadJson'];

/** RFC 4180 reader, including BOM, quoted newlines, escaped quotes and empty cells. */
export function parseCsv(text:string):Record<string,string>[] {
 const input=text.replace(/^\uFEFF/,''),rows:string[][]=[];let row:string[]=[],cell='',quoted=false,closed=false;
 for(let i=0;i<input.length;i++){
  const char=input[i];
  if(quoted){if(char==='"'){if(input[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=char;continue;}
  if(char==='"'){if(cell||closed)throw new Error('Unexpected quote in CSV');quoted=true;}
  else if(char===',' ){row.push(cell);cell='';closed=false;}
  else if(char==='\r'||char==='\n'){if(char==='\r'&&input[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v!==''))rows.push(row);row=[];cell='';closed=false;}
  else {if(closed)throw new Error('Unexpected text after CSV quote');cell+=char;}
 }
 if(quoted)throw new Error('Unclosed CSV quote');
 if(cell||row.length||closed){row.push(cell);rows.push(row);}
 const header=rows.shift();if(!header)return [];
 if(header.some(h=>!h)||new Set(header).size!==header.length)throw new Error('Invalid or duplicate CSV headers');
 return rows.map((values,index)=>{if(values.length!==header.length)throw new Error(`CSV row ${index+2} has the wrong number of columns`);return Object.fromEntries(header.map((key,i)=>[key,values[i]]));});
}

/** A complete snapshot, including deleted records, so refreshed readers cannot resurrect entries. */
export function exportLedgerCsv(backup:WalletBackup):string {
 const rows=backup.records.map(record=>{
  const payload=JSON.parse(record.payload);
  const tx=record.entity==='transaction'?normalizeCategoryRecord(payload as Transaction):undefined;
  const flat=tx?{...tx,originalAmount:formatMoney(tx.amountMinor,tx.currency),personalShare:formatMoney(tx.personalShareMinor,tx.currency)}:{id:record.id,sourceSheet:payload.sourceSheet??'',deletedAt:payload.deletedAt??''};
  return {...flat,recordType:record.entity,recordVersion:record.version,recordState:record.state,payloadJson:JSON.stringify(payload)};
 });
 return rowsToCsv(rows,LEDGER_CSV_COLUMNS);
}
function unescapeText(value:string):string {return /^'[\s\u0000-\u001f]*[=+\-@]/.test(value)?value.slice(1):value;}

export function importTransactionsCsv(text:string):Transaction[] {
 const seen=new Set<string>();
 return parseCsv(text).filter(row=>!row.recordType||row.recordType==='transaction').map(row=>{
  let tx:Transaction;
  if(row.payloadJson){tx=JSON.parse(row.payloadJson);if(tx.id!==row.id)throw new Error('CSV record ID mismatch');}
  else {
   const data:Record<string,unknown>={};
   for(const key of TRANSACTION_CSV_COLUMNS){if(['originalAmount','personalShare'].includes(key))continue;const value=row[key];
    if(key==='date')data.date=value||null;
    else if(['amountMinor','personalShareMinor','hkdAmountMinor','hkdPersonalShareMinor'].includes(key)){
     if(value){if(!/^-?\d+$/.test(value)||!Number.isSafeInteger(Number(value)))throw new Error(`Invalid CSV ${key}`);data[key]=Number(value);}
    }else if(value!==undefined&&value!=='')data[key]=unescapeText(value);
   }
   data.createdAt??='';data.updatedAt??='';data.description??='';tx=data as Transaction;
  }
  validateTransaction(tx);if(seen.has(tx.id))throw new Error('CSV contains duplicate transaction IDs');seen.add(tx.id);return tx;
 });
}
