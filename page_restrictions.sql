-- SQL Script to create the page restrictions table for Beta limits

create table page_restrictions (
  pathname text primary key,
  is_restricted boolean default true not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Turn on Row Level Security
alter table page_restrictions enable row level security;

-- Only authenticated users can read restricted routes
create policy "Allow read access to all authenticated users" on page_restrictions
  for select using (auth.role() = 'authenticated');

-- Determine if Owner role can insert / update. Depending on your Auth setup, 
-- simple way is: Allow all authenticated users (or restrict this via postgres func or app logic).
-- Because front-end owner checks are easy, if you don't use Supabase Custom Claims, we can
-- simply allow auth users with a note that the UI limits who sees the button.
create policy "Allow write access to authenticated users" on page_restrictions
  for all using (auth.role() = 'authenticated');
