-- Read-only admin diagnostics. Counts and privileges only; no personal payloads,
-- user identifiers, passwords, salts, ciphertext or record versions are returned.
select count(*) as total_records,
 count(*) filter(where public.wallet_is_protected(entity,payload)) as protected_records,
 count(*) filter(where payload->>'encryptedSummary'='1') as encrypted_records
from public.wallet_records;
select count(*) as configured_accounts from public.wallet_summary_security;
select
 has_table_privilege('service_role','public.wallet_records','SELECT') as can_read_records,
 has_table_privilege('service_role','public.wallet_summary_security','SELECT') as can_read_configuration,
 has_column_privilege('service_role','public.wallet_summary_security','failed_attempts','UPDATE') as can_reset_attempt_count,
 has_column_privilege('service_role','public.wallet_summary_security','locked_until','UPDATE') as can_reset_attempt_lock,
 has_function_privilege('service_role','public.wallet_setup_summary(uuid,jsonb,jsonb)','EXECUTE') as can_setup_summary;
select current_setting('pgrst.db_max_rows',true) as project_row_limit,
 current_setting('statement_timeout',true) as statement_timeout;
