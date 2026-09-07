-- SHIMON 회원 데이터베이스 초기 설정
-- Supabase Dashboard > SQL Editor에서 이 파일 전체를 한 번 실행하세요.

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    employee_code text not null unique,
    name text not null unique,
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


alter table public.profiles enable row level security;


drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);


drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);


grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;


-- Auth 회원가입이 완료되면 public.profiles에 회원정보를 자동 생성합니다.
create or replace function public.handle_new_shimon_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.profiles (
        id,
        employee_code,
        name,
        role,
        company,
        gender,
        phone,
        email,
        age,
        job_type,
        workplace,
        work_intensity,
        uniform,
        health_condition
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


-- 이 SQL을 실행하기 전에 만들어진 Auth 회원의 프로필을 보완합니다.
with profile_candidates as (
    select
        users.id,
        users.raw_user_meta_data ->> 'employeeCode' as employee_code,
        users.raw_user_meta_data ->> 'name' as name,
        users.raw_user_meta_data ->> 'role' as role,
        users.raw_user_meta_data ->> 'company' as company,
        users.raw_user_meta_data ->> 'gender' as gender,
        users.raw_user_meta_data ->> 'phone' as phone,
        users.email,
        nullif(users.raw_user_meta_data ->> 'age', '')::integer as age,
        users.raw_user_meta_data ->> 'jobType' as job_type,
        users.raw_user_meta_data ->> 'workplace' as workplace,
        users.raw_user_meta_data ->> 'workIntensity' as work_intensity,
        users.raw_user_meta_data ->> 'uniform' as uniform,
        users.raw_user_meta_data ->> 'healthCondition' as health_condition,
        users.created_at
    from auth.users
    where coalesce(users.raw_user_meta_data ->> 'employeeCode', '') <> ''
      and coalesce(users.raw_user_meta_data ->> 'name', '') <> ''
      and users.raw_user_meta_data ->> 'role' in ('worker', 'admin')
      and coalesce(users.raw_user_meta_data ->> 'company', '') <> ''
      and users.email is not null
),
deduplicated_profiles as (
    select distinct on (employee_code) *
    from profile_candidates
    order by employee_code, created_at desc
)
insert into public.profiles (
    id,
    employee_code,
    name,
    role,
    company,
    gender,
    phone,
    email,
    age,
    job_type,
    workplace,
    work_intensity,
    uniform,
    health_condition
)
select
    id,
    employee_code,
    name,
    role,
    company,
    gender,
    phone,
    email,
    age,
    job_type,
    workplace,
    work_intensity,
    uniform,
    health_condition
from deduplicated_profiles
on conflict do nothing;


-- 로그인한 사용자가 자기 계정만 탈퇴할 수 있게 합니다.
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


-- 계정 찾기: 사원정보가 모두 일치할 때 마스킹된 이메일만 반환합니다.
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
