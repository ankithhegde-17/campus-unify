-- Removes every dummy student created by seed_10000_students.sql.
-- Only touches accounts with the @students.campus-unify.test email domain.

begin;

create temporary table seed_ids on commit drop as
select id from auth.users where email like '%@students.campus-unify.test';

delete from public.role_assignments where user_id in (select id from seed_ids);
delete from public.profiles where id in (select id from seed_ids);
delete from auth.identities where user_id in (select id from seed_ids);
delete from auth.users where id in (select id from seed_ids);

commit;
