-- Supabase Schema for AppVault

-- 1. Create custom extension for UUID if not exists
create extension if not exists "uuid-ossp";

-- 2. Profiles Table (Linked to auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text,
  email text unique not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- 3. Customers Table (Linking user to Stripe Customer)
create table if not exists public.customers (
  user_id uuid references public.profiles(id) on delete cascade primary key,
  stripe_customer_id text unique not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.customers enable row level security;
create policy "Users can view own customer record" on public.customers for select using (auth.uid() = user_id);

-- 4. Subscriptions Table
create table if not exists public.subscriptions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  stripe_subscription_id text unique not null,
  status text not null, -- 'active', 'canceled', 'past_due', etc.
  price_id text not null,
  current_period_end timestamp with time zone not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.subscriptions enable row level security;
create policy "Users can view own subscriptions" on public.subscriptions for select using (auth.uid() = user_id);
-- Migration: add updated_at if table already exists:
-- ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone default timezone('utc'::text, now()) not null;

-- 5. Payments Table (for invoices/payments history)
create table if not exists public.payments (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  stripe_invoice_id text unique not null,
  amount integer not null, -- in cents
  currency text not null,
  status text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.payments enable row level security;
create policy "Users can view own payments" on public.payments for select using (auth.uid() = user_id);

-- 6. Accounts Table (Migrated from localStorage)
create table if not exists public.accounts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  password text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.accounts enable row level security;
create policy "Users can view own accounts" on public.accounts for select using (auth.uid() = user_id);
create policy "Users can insert own accounts" on public.accounts for insert with check (auth.uid() = user_id);
create policy "Users can update own accounts" on public.accounts for update using (auth.uid() = user_id);
create policy "Users can delete own accounts" on public.accounts for delete using (auth.uid() = user_id);

-- 7. Trigger to automatically create a profile for new users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', 'User'));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 8. Migration: add UNIQUE constraint on subscriptions.user_id
--    Run this once in your Supabase SQL editor if the table already exists:
--    ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_user_id_unique UNIQUE (user_id);
--    If the table is new, the constraint below is already included.
alter table public.subscriptions
  add constraint if not exists subscriptions_user_id_unique unique (user_id);

-- 9. Migration: add updated_at column to existing subscriptions table
--    Run this once in your Supabase SQL editor:
--    ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone default timezone('utc'::text, now()) not null;
