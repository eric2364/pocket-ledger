export type TransactionKind = 'expense' | 'income' | 'transfer' | 'card_payment' | 'investment' | 'adjustment';
export type Transaction = {
  id: string; date: string | null; reportingPeriod: string; kind: TransactionKind;
  category: string; originalCategory?: string; description: string; account: string;
  currency: string; amountMinor: number; personalShareMinor: number;
  hkdAmountMinor?: number; hkdPersonalShareMinor?: number; exchangeRate?: string; project?: string; notes?: string;
  sourceSheet?: string; sourceReference?: string; createdAt: string; updatedAt: string;
  deletedAt?: string; syncStatus?: 'pending' | 'synced' | 'conflict'; version?: number;
};
export type ModuleRecord = { id: string; type: string; title: string; sourceSheet?: string; fields: Record<string, unknown> };
export type RecurringTemplate = {id:string; title:string; kind:TransactionKind; category:string; account:string; currency:string; amountMinor:number; frequency:'monthly'|'weekly'|'yearly'; anchorDay?:number; nextDate:string; project?:string};
export type ImportPayload = { schemaVersion: 1; source: {filename:string;sha256:string}; transactions:Transaction[]; categories:string[]; modules:ModuleRecord[]; historicalSummaries:unknown[]; reviewItems:unknown[] };
export type WalletBackup = {backupVersion:1;createdAt:string;records:{id:string;entity:string;payload:string;version:number;state:string}[];settings:{key:string;value:string}[];conflicts:{id:string;record_id:string;local_payload:string;remote_payload:string;created_at:string}[]};
