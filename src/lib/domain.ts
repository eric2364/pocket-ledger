import type { Transaction } from './types';
import {normalizeCategory} from './categories';
/** Canonical category for use/editing; retain the exact source spelling. */
export function normalizeCategoryRecord<T extends {category:string;originalCategory?:string}>(record:T):T{
 const category=normalizeCategory(record.category);
 return category===record.category?record:{...record,category,originalCategory:record.originalCategory??record.category};
}
export function currencyDecimals(currency: string): number { return ['JPY','KRW'].includes(currency.toUpperCase()) ? 0 : 2; }
export function parseMoney(value:string, currency='HKD'):number {
  const scale=currencyDecimals(currency);
  const cleaned=value.trim().replace(/,/g,'');
  const match=/^([+-]?)(\d+)(?:\.(\d+))?$/.exec(cleaned);
  if(!match || (match[3]?.length??0)>scale) throw new Error(`Enter an amount with at most ${scale} decimal places`);
  const minor=BigInt(match[2])*10n**BigInt(scale)+BigInt((match[3]??'').padEnd(scale,'0')||'0');
  const signed=match[1]==='-'?-minor:minor;
  if(signed>BigInt(Number.MAX_SAFE_INTEGER)||signed<BigInt(Number.MIN_SAFE_INTEGER)) throw new Error('Amount is too large');
  return Number(signed);
}
export function formatMoney(minor:number,currency='HKD'):string {
  if(!Number.isSafeInteger(minor)) throw new Error('Money must be a safe integer');
  const scale=currencyDecimals(currency), n=BigInt(minor), sign=n<0n?'-':'', abs=n<0n?-n:n, divisor=10n**BigInt(scale);
  return `${sign}${abs/divisor}${scale?'.'+(abs%divisor).toString().padStart(scale,'0'):''}`;
}
export function validateTransaction(tx:Transaction):void {
  if(!tx||typeof tx!=='object')throw new Error('A transaction object is required');
  for(const key of ['id','category','account','description'] as const){if(typeof tx[key]!=='string'||(['id','category','account'].includes(key)&&!tx[key].trim()))throw new Error(`A valid ${key} is required`);}
  for(const key of ['createdAt','updatedAt'] as const)if(tx[key]!==undefined&&typeof tx[key]!=='string')throw new Error(`Invalid ${key}`);
  if(tx.date!==null&&(typeof tx.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(tx.date)||Number.isNaN(Date.parse(tx.date))||new Date(tx.date).toISOString().slice(0,10)!==tx.date))throw new Error('A valid calendar date is required');
  if(typeof tx.reportingPeriod!=='string'||!/^\d{4}(?:-\d{2})?$/.test(tx.reportingPeriod)||(tx.reportingPeriod.length===7&&(Number(tx.reportingPeriod.slice(5))<1||Number(tx.reportingPeriod.slice(5))>12)))throw new Error('A valid reporting period is required');
  if(!['expense','income','transfer','card_payment','investment','adjustment'].includes(tx.kind))throw new Error('Invalid transaction type');
  for(const value of [tx.amountMinor,tx.personalShareMinor,tx.hkdAmountMinor,tx.hkdPersonalShareMinor].filter(v=>v!==undefined))if(!Number.isSafeInteger(value))throw new Error('Amounts must be exact minor-unit integers');
  if(!Number.isSafeInteger(tx.amountMinor)||!Number.isSafeInteger(tx.personalShareMinor))throw new Error('An amount and personal share are required');
  const legacyRefund=tx.kind==='expense'&&tx.amountMinor<0&&!!tx.sourceSheet&&!!tx.sourceReference;
  if(tx.kind!=='adjustment'&&!legacyRefund&&tx.amountMinor<0)throw new Error('Use a positive amount for this transaction type');
  if(tx.amountMinor>=0&&(tx.personalShareMinor<0||tx.personalShareMinor>tx.amountMinor)||tx.amountMinor<0&&(tx.personalShareMinor>0||tx.personalShareMinor<tx.amountMinor))throw new Error('Personal share must be between zero and the total, with the same sign');
  if(tx.hkdAmountMinor!==undefined&&tx.amountMinor===0&&tx.hkdAmountMinor!==0)throw new Error('A zero amount cannot have a nonzero HKD equivalent');
  if(typeof tx.currency!=='string'||!/^[A-Z]{3}$/.test(tx.currency))throw new Error('Use a three-letter currency code');
}

export function report(transactions:Transaction[],period?:string) {
  const totals:Record<string,{incomeMinor:number;expenseMinor:number;netMinor:number;categories:Record<string,number>}>= {};
  for(const tx of transactions){
    if(tx.deletedAt || (period&&!tx.reportingPeriod.startsWith(period)) || !['income','expense','adjustment'].includes(tx.kind)) continue;
    const category=normalizeCategory(tx.category),currency=tx.currency, bucket=totals[currency]??={incomeMinor:0,expenseMinor:0,netMinor:0,categories:{}};
    if(tx.kind==='adjustment'&&tx.personalShareMinor<0){bucket.expenseMinor-=tx.personalShareMinor;bucket.categories[category]=(bucket.categories[category]??0)-tx.personalShareMinor;} else if(tx.kind==='income'||tx.kind==='adjustment'){bucket.incomeMinor+=tx.personalShareMinor;} else {bucket.expenseMinor+=tx.personalShareMinor;bucket.categories[category]=(bucket.categories[category]??0)+tx.personalShareMinor;}
    bucket.netMinor=bucket.incomeMinor-bucket.expenseMinor;
    if(!Number.isSafeInteger(bucket.incomeMinor)||!Number.isSafeInteger(bucket.expenseMinor)||!Number.isSafeInteger(bucket.netMinor)) throw new Error('Report exceeds safe money range');
  }
  return totals;
}
export function csvCell(value:unknown):string {
  let s=value===undefined||value===null?'':typeof value==='object'?JSON.stringify(value):String(value);
  // Keep actual numeric fields numeric; neutralize potentially executable text.
  if(typeof value!=='number' && !/^-?\d+(?:\.\d+)?$/.test(s) && /^[\s\u0000-\u001f]*[=+\-@]/.test(s)) s="'"+s;
  return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
}
export function rowsToCsv(rows:Record<string,unknown>[],columns?:string[]):string {
  const keys=columns??Array.from(new Set(rows.flatMap(row=>Object.keys(row))));
  return '\uFEFF'+[keys.map(csvCell).join(','),...rows.map(row=>keys.map(key=>csvCell(row[key])).join(','))].join('\r\n')+'\r\n';
}
export function exportTransactionsCsv(transactions:Transaction[]):string {
  return rowsToCsv(transactions.map(raw=>{const tx=normalizeCategoryRecord(raw);return {...tx, originalAmount:formatMoney(tx.amountMinor,tx.currency),personalShare:formatMoney(tx.personalShareMinor,tx.currency)};}),['id','date','reportingPeriod','kind','category','originalCategory','description','account','amountMinor','originalAmount','currency','exchangeRate','hkdAmountMinor','hkdPersonalShareMinor','personalShareMinor','personalShare','project','notes','sourceSheet','sourceReference','createdAt','updatedAt','deletedAt']);
}

export function reportHkd(transactions:Transaction[],period?:string){
  let unconvertedCount=0;const converted:Transaction[]=[];
  for(const tx of transactions){if(tx.deletedAt||(period&&!tx.reportingPeriod.startsWith(period))||!['income','expense','adjustment'].includes(tx.kind))continue;
    if(tx.currency==='HKD'){converted.push(tx);continue;}
    if(tx.hkdAmountMinor===undefined&&tx.hkdPersonalShareMinor===undefined){unconvertedCount++;continue;}
    let share=tx.hkdPersonalShareMinor;
    if(share===undefined){if(tx.amountMinor===0){if(tx.hkdAmountMinor!==0)throw new Error('Invalid HKD equivalent');share=0;}else{const numerator=BigInt(tx.hkdAmountMinor!)*BigInt(tx.personalShareMinor),denominator=BigInt(tx.amountMinor),negative=(numerator<0n)!==(denominator<0n),n=numerator<0n?-numerator:numerator,d=denominator<0n?-denominator:denominator,rounded=(n+d/2n)/d;share=Number(negative?-rounded:rounded);if(!Number.isSafeInteger(share))throw new Error('HKD share exceeds safe money range');}}
    converted.push({...tx,currency:'HKD',amountMinor:tx.hkdAmountMinor??share,personalShareMinor:share});
  }
  return {...(report(converted).HKD??{incomeMinor:0,expenseMinor:0,netMinor:0,categories:{}}),unconvertedCount};
}
