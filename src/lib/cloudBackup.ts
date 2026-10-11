import type {WalletBackup} from './types';
export function cloudBackup(records:{id:string;entity:string;payload:Record<string,unknown>;version:number}[]):WalletBackup{
  return {backupVersion:1,createdAt:new Date().toISOString(),records:records.map(row=>({id:row.id,entity:row.entity,payload:JSON.stringify(row.payload),version:row.version,state:'synced'})),settings:[],conflicts:[]};
}
