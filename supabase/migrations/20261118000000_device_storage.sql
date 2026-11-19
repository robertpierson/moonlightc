-- PC storage: whether this PC lets your other devices keep files in its MoonlightC Storage folder (set only by the PC).
alter table public.devices add column if not exists storage_on boolean not null default false;
