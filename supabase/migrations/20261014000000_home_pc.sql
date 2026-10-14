-- The PC your other devices work on by default ("home PC").
alter table public.devices add column is_home boolean not null default false;
