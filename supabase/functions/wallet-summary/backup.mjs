/** Restore-compatible export; callers provide only authorized, decrypted rows. */
export function cloudBackup(records,archives=[],createdAt=new Date().toISOString()){
 return {backupVersion:1,createdAt,records:records.map(row=>({...row,payload:JSON.stringify(row.payload),state:'synced'})),settings:[],conflicts:[],archives};
}
