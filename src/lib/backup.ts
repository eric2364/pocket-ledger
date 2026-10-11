import {validateTransaction} from './domain';
import type {WalletBackup} from './types';
export function validateBackup(value:WalletBackup){
 if(value.backupVersion!==1||!Array.isArray(value.records)||!Array.isArray(value.settings)||!Array.isArray(value.conflicts))throw new Error('Unsupported backup format');
 const ids=new Set<string>();for(const row of value.records){if(!row.id||ids.has(row.id)||!['transaction','module','template','category','historical','review','source'].includes(row.entity)||!Number.isSafeInteger(row.version)||row.version<0||!['pending','synced','conflict'].includes(row.state))throw new Error('Invalid backup record');ids.add(row.id);const payload=JSON.parse(row.payload);if(payload.id!==row.id)throw new Error('Backup record ID mismatch');if(row.entity==='transaction')validateTransaction(payload);}
 for(const item of value.settings)if(typeof item.key!=='string'||typeof item.value!=='string')throw new Error('Invalid backup settings');
 for(const item of value.conflicts)if(!item.id||!item.record_id||typeof item.local_payload!=='string'||typeof item.remote_payload!=='string'||typeof item.created_at!=='string')throw new Error('Invalid backup conflict');
}
export function validateImport(value:import('./types').ImportPayload){
 if(!value||value.schemaVersion!==1||typeof value.source?.filename!=='string'||!value.source.filename.trim()||typeof value.source?.sha256!=='string'||!value.source.sha256.trim())throw new Error('Unsupported import format');
 for(const key of ['transactions','categories','modules','historicalSummaries','reviewItems'] as const)if(!Array.isArray(value[key]))throw new Error(`Import ${key} must be an array`);
 const ids=new Set<string>();for(const item of value.transactions){validateTransaction(item);if(ids.has(item.id))throw new Error('Import contains duplicate IDs');ids.add(item.id);}
 for(const name of value.categories)if(typeof name!=='string'||!name.trim())throw new Error('Invalid import category');
 for(const item of value.modules){if(!item||typeof item.id!=='string'||!item.id||typeof item.type!=='string'||!item.type||typeof item.title!=='string'||!item.fields||typeof item.fields!=='object'||Array.isArray(item.fields)||ids.has(item.id))throw new Error('Invalid import supporting record');ids.add(item.id);}
}
