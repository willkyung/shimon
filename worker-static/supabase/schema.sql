-- SHIMON 근로자 앱 Supabase 설정
-- Supabase Dashboard > SQL Editor에서 이 파일 전체를 실행하세요.

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    employee_code text not null unique,
    name text not null,
    role text not null check (role in ('worker', 'admin')),
    company text not null,
    gender text,
    phone text,
    email text not null unique,
    age integer check (age is null or age between 18 and 80),
    job_type text,
    workplace text,
    work_intensity text,
    uniform text,
    health_condition text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 이전 스키마의 이름 UNIQUE 제약은 동명이인을 막으므로 제거합니다.
alter table public.profiles drop constraint if exists profiles_name_key;

alter table public.profiles enable row level security;

drop policy if exists users_read_own_profile on public.profiles;
create policy users_read_own_profile
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists users_update_own_profile on public.profiles;
create policy users_update_own_profile
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

-- Auth 회원가입이 끝나면 프로필을 자동 생성합니다.
create or replace function public.handle_new_shimon_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.profiles (
        id, employee_code, name, role, company, gender, phone, email,
        age, job_type, workplace, work_intensity, uniform, health_condition
    )
    values (
        new.id,
        new.raw_user_meta_data ->> 'employeeCode',
        new.raw_user_meta_data ->> 'name',
        new.raw_user_meta_data ->> 'role',
        new.raw_user_meta_data ->> 'company',
        new.raw_user_meta_data ->> 'gender',
        new.raw_user_meta_data ->> 'phone',
        new.email,
        nullif(new.raw_user_meta_data ->> 'age', '')::integer,
        new.raw_user_meta_data ->> 'jobType',
        new.raw_user_meta_data ->> 'workplace',
        new.raw_user_meta_data ->> 'workIntensity',
        new.raw_user_meta_data ->> 'uniform',
        new.raw_user_meta_data ->> 'healthCondition'
    );

    return new;
end;
$$;

drop trigger if exists on_shimon_user_created on auth.users;
create trigger on_shimon_user_created
after insert on auth.users
for each row execute procedure public.handle_new_shimon_user();

-- 이 SQL보다 먼저 생성된 Auth 회원의 누락 프로필을 보완합니다.
insert into public.profiles (
    id, employee_code, name, role, company, gender, phone, email,
    age, job_type, workplace, work_intensity, uniform, health_condition
)
select
    users.id,
    users.raw_user_meta_data ->> 'employeeCode',
    users.raw_user_meta_data ->> 'name',
    users.raw_user_meta_data ->> 'role',
    users.raw_user_meta_data ->> 'company',
    users.raw_user_meta_data ->> 'gender',
    users.raw_user_meta_data ->> 'phone',
    users.email,
    nullif(users.raw_user_meta_data ->> 'age', '')::integer,
    users.raw_user_meta_data ->> 'jobType',
    users.raw_user_meta_data ->> 'workplace',
    users.raw_user_meta_data ->> 'workIntensity',
    users.raw_user_meta_data ->> 'uniform',
    users.raw_user_meta_data ->> 'healthCondition'
from auth.users as users
where coalesce(users.raw_user_meta_data ->> 'employeeCode', '') <> ''
  and coalesce(users.raw_user_meta_data ->> 'name', '') <> ''
  and users.raw_user_meta_data ->> 'role' in ('worker', 'admin')
  and coalesce(users.raw_user_meta_data ->> 'company', '') <> ''
  and users.email is not null
on conflict do nothing;

-- 로그인한 사용자는 자기 Auth 계정만 삭제할 수 있습니다.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := (select auth.uid());
begin
    if current_user_id is null then
        raise exception '로그인이 필요합니다.';
    end if;

    delete from auth.users
    where id = current_user_id;
end;
$$;

revoke all on function public.delete_own_account() from public;
revoke all on function public.delete_own_account() from anon;
grant execute on function public.delete_own_account() to authenticated;

-- 사원정보가 모두 일치할 때 마스킹된 이메일만 반환합니다.
create or replace function public.find_shimon_account(
    p_employee_code text,
    p_name text,
    p_phone text
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    matched_email text;
    email_name text;
    email_domain text;
begin
    select profiles.email
    into matched_email
    from public.profiles as profiles
    where lower(trim(profiles.employee_code)) = lower(trim(p_employee_code))
      and trim(profiles.name) = trim(p_name)
      and regexp_replace(coalesce(profiles.phone, ''), '[^0-9]', '', 'g') =
          regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')
      and profiles.role = 'worker'
    limit 1;

    if matched_email is null then
        return null;
    end if;

    email_name := split_part(matched_email, '@', 1);
    email_domain := split_part(matched_email, '@', 2);

    return
        case
            when length(email_name) <= 2 then left(email_name, 1) || '***'
            else left(email_name, 2) || repeat('*', greatest(length(email_name) - 2, 3))
        end
        || '@' || email_domain;
end;
$$;

revoke all on function public.find_shimon_account(text, text, text) from public;
grant execute on function public.find_shimon_account(text, text, text) to anon, authenticated;
