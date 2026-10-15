-- This directory is not populated yet. Keep the column required so every
-- provisioned staff member has an email matching their Supabase Auth identity.
alter table public.clinic_staff drop column login_phone;
alter table public.clinic_staff add column login_email text not null unique
  check (
    login_email = lower(btrim(login_email))
    and login_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  );
