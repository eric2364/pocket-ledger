// PostgREST can apply a project limit below the requested range. Advance by
// rows actually returned and stop only on empty, so setup cannot truncate data.
export async function readAllPages(fetchPage,pageSize=1000){
 const rows=[];let offset=0;
 while(true){const page=await fetchPage(offset,offset+pageSize-1);if(!Array.isArray(page))throw new Error('Invalid wallet page');if(page.length===0)return rows;rows.push(...page);offset+=page.length;}
}
