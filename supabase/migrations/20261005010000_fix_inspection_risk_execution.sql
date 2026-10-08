-- The invoker-rights inspections_set_risk trigger calls this pure calculator
-- as the authenticated BSI. Phase 8 revoked its EXECUTE permission, so every
-- authenticated submit_inspection insert/upsert fails with SQLSTATE 42501.
-- The helper only evaluates its JSON arguments; it reads/writes no tables.
-- Keep it private and invoker-rights. No RLS, RPC or scoring changes are needed.
grant execute on function private.calculate_inspection_risk(jsonb, jsonb)
  to authenticated;

-- The AFTER risk trigger runs before submit_inspection's final place update.
-- That update cannot repair attribution retroactively: the risk update already
-- has to satisfy places' existing WITH CHECK (updated_by_uid = auth.uid()).
-- Inspection write RLS ensures new.bsi_uid is the authenticated caller.
create or replace function private.update_place_risk_from_inspection()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.places
  set risk_level = new.risk_level,
      updated_by_uid = new.bsi_uid
  where id = new.place_id
    and barangay_id = new.barangay_id
    and (
      last_inspection_date is null
      or new.inspection_date >= last_inspection_date
    );
  return new;
end;
$$;
