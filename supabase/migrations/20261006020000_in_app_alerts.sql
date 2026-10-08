-- Phase 10A pivot: keep the authenticated inbox while disabling remote push
-- dispatch. Scheduled operational alerts are now queued directly by Postgres.

create or replace function private.queue_notification(
  recipient uuid,
  kind text,
  heading text,
  message text,
  object_type text,
  object_id text,
  destination text,
  destination_id text,
  dedupe text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (
    recipient_user_id,
    notification_type,
    title,
    body,
    entity_type,
    entity_id,
    route_kind,
    route_entity_id,
    dedupe_key
  ) values (
    recipient,
    kind,
    heading,
    message,
    object_type,
    object_id,
    destination,
    destination_id,
    dedupe
  )
  on conflict (recipient_user_id, dedupe_key) do nothing;
exception
  when others then
    raise warning 'Unable to queue operational alert: %', sqlerrm;
end;
$$;

revoke all on function private.queue_notification(
  uuid, text, text, text, text, text, text, text, text
) from public, anon, authenticated;

create or replace function private.queue_new_reinspection_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  place_name text;
begin
  select place.name
  into place_name
  from public.places as place
  where place.id = new.place_id;

  perform private.queue_notification(
    new.bsi_uid,
    'new_reinspection_workload',
    'New Reinspection Workload',
    coalesce(place_name, 'A place') || ' requires a reinspection.',
    'reinspection',
    new.id,
    'bsi_reinspection',
    new.id,
    'new-reinspection:' || new.id
  );

  return new;
end;
$$;

create or replace function private.queue_barangay_reassignment_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'bsi'
    and new.assigned_barangay_id is distinct from old.assigned_barangay_id then
    perform private.queue_notification(
      new.id,
      'barangay_reassignment',
      'Barangay Assignment Updated',
      'Your assigned barangay has been changed to ' ||
        coalesce(new.assigned_barangay_name, 'a new barangay') || '.',
      'profile',
      new.id::text,
      'profile',
      null,
      'barangay-reassignment:' || new.id::text || ':' ||
        coalesce(new.assigned_barangay_id, 'none') || ':' ||
        extract(epoch from new.updated_at)::text
    );
  end if;

  return new;
end;
$$;

create or replace function private.queue_scheduled_operational_alerts()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  manila_today date := (now() at time zone 'Asia/Manila')::date;
  scheduled_day date;
  pending_case record;
  risky_case record;
  admin_profile record;
begin
  for pending_case in
    select
      reinspection.id,
      reinspection.bsi_uid,
      reinspection.original_inspection_id,
      reinspection.scheduled_date,
      place.name as place_name
    from public.reinspections as reinspection
    join public.places as place
      on place.id = reinspection.place_id
      and place.barangay_id = reinspection.barangay_id
    join public.bsi_profiles as bsi
      on bsi.id = reinspection.bsi_uid
      and bsi.active
      and not bsi.must_change_password
    where reinspection.status = 'pending'
  loop
    scheduled_day := (
      pending_case.scheduled_date at time zone 'Asia/Manila'
    )::date;

    if scheduled_day = manila_today + 1 then
      perform private.queue_notification(
        pending_case.bsi_uid,
        'reinspection_due_soon',
        'Reinspection Due Tomorrow',
        pending_case.place_name || ' is scheduled for reinspection tomorrow.',
        'reinspection',
        pending_case.id,
        'bsi_reinspection',
        pending_case.id,
        'due-soon:' || pending_case.id || ':' || scheduled_day::text
      );
    end if;

    if scheduled_day < manila_today then
      perform private.queue_notification(
        pending_case.bsi_uid,
        'reinspection_overdue',
        'Reinspection Overdue',
        pending_case.place_name || ' has an overdue reinspection.',
        'reinspection',
        pending_case.id,
        'bsi_reinspection',
        pending_case.id,
        'overdue:' || pending_case.id || ':' || scheduled_day::text
      );

      for admin_profile in
        select profile.id
        from public.bsi_profiles as profile
        where profile.role = 'admin'
          and profile.active
          and not profile.must_change_password
      loop
        perform private.queue_notification(
          admin_profile.id,
          'reinspection_overdue',
          'Reinspection Overdue',
          pending_case.place_name || ' has an overdue reinspection.',
          'inspection',
          pending_case.original_inspection_id,
          'admin_inspection',
          pending_case.original_inspection_id,
          'overdue:' || pending_case.id || ':' || scheduled_day::text
        );
      end loop;
    end if;
  end loop;

  for risky_case in
    select
      place.id as place_id,
      place.name as place_name,
      place.last_inspection_date,
      latest_inspection.id as inspection_id,
      latest_inspection.bsi_uid
    from public.places as place
    join lateral (
      select inspection.id, inspection.bsi_uid
      from public.inspections as inspection
      where inspection.place_id = place.id
        and inspection.barangay_id = place.barangay_id
      order by inspection.inspection_date desc, inspection.id desc
      limit 1
    ) as latest_inspection on true
    where place.risk_level = 'High'
      and place.status <> 'Compliant'
  loop
    if exists (
      select 1
      from public.bsi_profiles as bsi
      where bsi.id = risky_case.bsi_uid
        and bsi.active
        and not bsi.must_change_password
    ) then
      perform private.queue_notification(
        risky_case.bsi_uid,
        'high_risk_unresolved',
        'High-Risk Case Requires Attention',
        risky_case.place_name || ' has an unresolved High Risk inspection.',
        'place',
        risky_case.place_id,
        'bsi_place',
        risky_case.place_id,
        'high-risk:' || risky_case.place_id || ':' ||
          coalesce(risky_case.last_inspection_date::text, risky_case.inspection_id)
      );
    end if;

    for admin_profile in
      select profile.id
      from public.bsi_profiles as profile
      where profile.role = 'admin'
        and profile.active
        and not profile.must_change_password
    loop
      perform private.queue_notification(
        admin_profile.id,
        'high_risk_unresolved',
        'High-Risk Case Requires Attention',
        risky_case.place_name || ' has an unresolved High Risk inspection.',
        'inspection',
        risky_case.inspection_id,
        'admin_inspection',
        risky_case.inspection_id,
        'high-risk:' || risky_case.place_id || ':' ||
          coalesce(risky_case.last_inspection_date::text, risky_case.inspection_id)
      );
    end loop;
  end loop;
end;
$$;

revoke all on function private.queue_scheduled_operational_alerts()
from public, anon, authenticated;

-- The legacy delivery tables remain for compatibility, but token registration
-- is retired and any previously registered tokens are made inactive.
revoke execute on function public.register_push_token(text, text)
from authenticated;
revoke execute on function public.deactivate_push_token(text)
from authenticated;

update public.push_tokens
set active = false,
    updated_at = now()
where active;

-- Remove the old Edge Function job without dropping the legacy audit tables.
do $$
declare
  existing_job record;
begin
  for existing_job in
    select jobid
    from cron.job
    where jobname in (
      'suta-daily-operational-notifications',
      'suta-daily-operational-alerts'
    )
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;
end;
$$;

select cron.schedule(
  'suta-daily-operational-alerts',
  '0 0 * * *',
  $$select private.queue_scheduled_operational_alerts();$$
);
