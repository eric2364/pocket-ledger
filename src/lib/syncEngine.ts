export type PendingRow={id:string;entity:string;payload:string;version:number};
export type RemoteRow={id:string;entity:string;payload:Record<string,unknown>;version:number};
export type SyncResult={uploaded:number;conflicts:number;pending:number;protectedPending:number};
export interface SyncDependencies{
 pending():Promise<PendingRow[]>;
 protected(entity:string,payload:unknown):boolean;
 save(row:PendingRow):Promise<unknown>;
 acknowledge(id:string,payload:string,version:number):Promise<void>;
 preserveConflict(id:string,payload:string,remote:RemoteRow|null):Promise<void>;
 conflicts():Promise<unknown[]>;
 fetchPage(start:number,end:number):Promise<RemoteRow[]>;
 acceptRemote(rows:RemoteRow[]):Promise<void>;
}
function validRemote(value:any):value is RemoteRow{return !!value&&typeof value.id==='string'&&typeof value.entity==='string'&&!!value.payload&&typeof value.payload==='object'&&!Array.isArray(value.payload)&&Number.isSafeInteger(value.version)&&value.version>0;}
/** A saved acknowledgement is trusted only after its cloud version is validated.
 * Pending writes remain durable if any network operation fails. */
export async function synchronize(deps:SyncDependencies):Promise<SyncResult>{
 let uploaded=0;
 // A second snapshot catches edits made while the first upload is in flight.
 // Bound work under continuous editing; outstanding changes remain visibly pending.
 for(let round=0;round<3;round++){
  const pending=(await deps.pending()).filter(row=>!deps.protected(row.entity,JSON.parse(row.payload)));
  if(!pending.length)break;
  for(const row of pending){
   const response:any=await deps.save(row);
   if(response?.status==='saved'&&Number.isSafeInteger(response.version)&&response.version>0&&response.version>=row.version){await deps.acknowledge(row.id,row.payload,response.version);uploaded++;}
   else if(response?.status==='conflict'&&(response.remote===null||(validRemote(response.remote)&&response.remote.id===row.id))){await deps.preserveConflict(row.id,row.payload,response.remote);}
   else throw new Error('Cloud did not confirm this save. Your changes remain on this device; retry sync.');
  }
 }
 let offset=0;
 while(true){const rows=await deps.fetchPage(offset,offset+499);if(!Array.isArray(rows)||rows.some(row=>!validRemote(row)))throw new Error('Cloud returned incomplete records. Retry sync.');if(!rows.length)break;await deps.acceptRemote(rows);offset+=rows.length;}
 const pending=await deps.pending();
 return {uploaded,conflicts:(await deps.conflicts()).length,pending:pending.length,protectedPending:pending.filter(row=>deps.protected(row.entity,JSON.parse(row.payload))).length};
}
