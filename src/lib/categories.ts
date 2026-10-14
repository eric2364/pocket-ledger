/** One display/grouping key; source spellings remain available in originalCategory. */
export function normalizeCategory(value:string):string{return value.trim().toUpperCase();}
export function normalizeCategories(values:string[]):string[]{return [...new Set(values.map(normalizeCategory).filter(Boolean))].sort((a,b)=>a.localeCompare(b));}
