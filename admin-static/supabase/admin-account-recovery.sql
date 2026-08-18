-- 관리자 앱 이메일 찾기 전용 설정
-- Supabase Dashboard > SQL Editor > New query에서 전체 실행하세요.

create or replace function public.find_shimon_admin_account(
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
      and profiles.role = 'admin'
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

revoke all on function public.find_shimon_admin_account(text, text, text) from public;
grant execute on function public.find_shimon_admin_account(text, text, text)
to anon, authenticated;

notify pgrst, 'reload schema';
