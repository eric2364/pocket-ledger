import {normalizeCategory} from './categories';
export interface QuickFavorite{id:string;label:string;category:string;kind:'expense'|'income';}
export const defaultFavorites:QuickFavorite[]=['Lunch','Coffee','Transport','Salary'].map(category=>({id:`default-${category}`,label:normalizeCategory(category),category:normalizeCategory(category),kind:category==='Salary'?'income':'expense'}));
export function validateFavorites(rows:QuickFavorite[]):QuickFavorite[]{
 if(!Array.isArray(rows)||rows.length>10)throw new Error('Choose up to 10 quick-add favorites.');
 const ids=new Set<string>();return rows.map(row=>{if(!row||typeof row.id!=='string'||!row.id||ids.has(row.id))throw new Error('Each favorite needs a unique ID.');ids.add(row.id);if(typeof row.category!=='string'||!row.category.trim())throw new Error('Choose a category for every favorite.');if(row.kind!=='expense'&&row.kind!=='income')throw new Error('Choose Expense or Income for each favorite.');if(typeof row.label!=='string')throw new Error('Choose a label for each favorite.');return {...row,category:normalizeCategory(row.category),label:!row.label.trim()||normalizeCategory(row.label)===normalizeCategory(row.category)?normalizeCategory(row.category):row.label.trim()};});
}
export function readFavorites(raw:string|null|undefined):QuickFavorite[]{try{return raw?validateFavorites(JSON.parse(raw)):defaultFavorites.map(row=>({...row}));}catch{return defaultFavorites.map(row=>({...row}));}}
