-- Phase 10A profile presentation fields and private avatar storage.

alter table public.bsi_profiles
  add column avatar_path text;

alter table public.bsi_profiles
  add constraint bsi_profiles_avatar_path_check check (
    avatar_path is null
    or avatar_path = 'users/' || id::text || '/avatar'
  );

create or replace function public.update_own_profile(
  p_name text,
  p_contact_number text,
  p_avatar_path text default null
)
returns public.bsi_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  updated_profile public.bsi_profiles;
begin
  if caller_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'Full name is required.' using errcode = '23514';
  end if;

  if btrim(coalesce(p_contact_number, '')) = '' then
    raise exception 'Contact number is required.' using errcode = '23514';
  end if;

  if p_avatar_path is not null
    and p_avatar_path <> ('users/' || caller_id::text || '/avatar') then
    raise exception 'The avatar path must belong to the authenticated user.'
      using errcode = '42501';
  end if;

  update public.bsi_profiles
  set name = btrim(p_name),
      contact_number = btrim(p_contact_number),
      avatar_path = p_avatar_path
  where id = caller_id
    and active
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'An active authenticated profile is required.'
      using errcode = '42501';
  end if;

  return updated_profile;
end;
$$;

revoke all on function public.update_own_profile(text, text, text)
  from public, anon;
grant execute on function public.update_own_profile(text, text, text)
  to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'profile-avatars',
  'profile-avatars',
  false,
  5 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can read their own profile avatar"
on storage.objects for select to authenticated
using (
  bucket_id = 'profile-avatars'
  and name = 'users/' || (select auth.uid())::text || '/avatar'
  and exists (
    select 1 from public.bsi_profiles profile
    where profile.id = (select auth.uid()) and profile.active
  )
);

create policy "Active admins can read profile avatars"
on storage.objects for select to authenticated
using (
  bucket_id = 'profile-avatars'
  and (select private.is_active_admin())
);

create policy "Users can upload their own profile avatar"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-avatars'
  and name = 'users/' || (select auth.uid())::text || '/avatar'
  and exists (
    select 1 from public.bsi_profiles profile
    where profile.id = (select auth.uid()) and profile.active
  )
);

create policy "Users can update their own profile avatar"
on storage.objects for update to authenticated
using (
  bucket_id = 'profile-avatars'
  and name = 'users/' || (select auth.uid())::text || '/avatar'
  and owner_id = (select auth.uid())::text
)
with check (
  bucket_id = 'profile-avatars'
  and name = 'users/' || (select auth.uid())::text || '/avatar'
  and owner_id = (select auth.uid())::text
  and exists (
    select 1 from public.bsi_profiles profile
    where profile.id = (select auth.uid()) and profile.active
  )
);

create policy "Users can delete their own profile avatar"
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-avatars'
  and name = 'users/' || (select auth.uid())::text || '/avatar'
  and owner_id = (select auth.uid())::text
);
