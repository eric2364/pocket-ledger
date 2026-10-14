-- Hardened Supabase projects may not grant new tables to service_role by default.
-- The verified Edge Function needs reads; setup remains the atomic security-definer
-- RPC. Browser roles receive no additional permissions and RLS stays enabled.
grant select on public.wallet_records to service_role;
grant select on public.wallet_summary_security to service_role;
grant update (failed_attempts,locked_until) on public.wallet_summary_security to service_role;
