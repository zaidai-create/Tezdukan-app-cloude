-- Registering a dukan or distributor takes the owner's CNIC and a photo of the place: the
-- documents must be the applicant's own uploads, stay private to them and the TezDukan team,
-- and the registration waits for an admin.
begin;
\ir helpers/setup.psql
select plan(16);

select tests.create_user('applicant');
select tests.create_user('stranger');
select tests.make_admin('boss');
select tests.make_area('latifabad');
grant insert, update on tests.refs to authenticated;

-- What the phone uploaded: three photos in the applicant's folder, one in someone else's.
insert into storage.objects (bucket_id, name, owner)
select 'kyc-documents', tests.id('applicant')::text || '/' || f, tests.id('applicant')
  from unnest(array['front.webp', 'back.webp', 'shop.webp', 'warehouse.webp']) f;
insert into storage.objects (bucket_id, name, owner)
values ('kyc-documents', tests.id('stranger')::text || '/front.webp', tests.id('stranger'));

select tests.authenticate_as('applicant');
select set_config('tests.me', tests.id('applicant')::text, false);

select throws_ok(
  format($$ select public.apply_for_dukan('Bismillah Store', '03001234567', 'Shop 4, Main Road', %L, 25.39, 68.36,
            '4130', %L, %L, %L) $$,
         tests.id('latifabad'), current_setting('tests.me') || '/front.webp',
         current_setting('tests.me') || '/back.webp', current_setting('tests.me') || '/shop.webp'),
  '22023', 'invalid_cnic', 'a CNIC needs all 13 digits'
);
select throws_ok(
  format($$ select public.apply_for_dukan('Bismillah Store', '03001234567', 'Shop 4, Main Road', %L, 25.39, 68.36,
            '41303-1234567-1', %L, %L, %L) $$,
         tests.id('latifabad'), current_setting('tests.me') || '/front.webp',
         current_setting('tests.me') || '/front.webp', current_setting('tests.me') || '/shop.webp'),
  '22023', 'documents_required', 'the same photo cannot be both sides'
);
select throws_ok(
  format($$ select public.apply_for_dukan('Bismillah Store', '03001234567', 'Shop 4, Main Road', %L, 25.39, 68.36,
            '41303-1234567-1', %L, %L, %L) $$,
         tests.id('latifabad'), tests.id('stranger')::text || '/front.webp',
         current_setting('tests.me') || '/back.webp', current_setting('tests.me') || '/shop.webp'),
  '22023', 'documents_required', 'someone else''s upload is refused'
);
select throws_ok(
  format($$ select public.apply_for_dukan('Bismillah Store', '03001234567', 'Shop 4, Main Road', %L, 25.39, 68.36,
            '41303-1234567-1', %L, %L, %L) $$,
         tests.id('latifabad'), current_setting('tests.me') || '/never-uploaded.webp',
         current_setting('tests.me') || '/back.webp', current_setting('tests.me') || '/shop.webp'),
  '22023', 'documents_required', 'a photo that was never uploaded is refused'
);

select tests.remember('dukan', (public.apply_for_dukan(
  'Bismillah Store', '03001234567', 'Shop 4, Main Road', tests.id('latifabad'), 25.39, 68.36,
  '41303-1234567-1', current_setting('tests.me') || '/front.webp',
  current_setting('tests.me') || '/back.webp', current_setting('tests.me') || '/shop.webp',
  p_ntn => ' 1234567-8 '
) ->> 'id')::uuid);
select is(
  (select status::text from public.shops where id = tests.id('dukan')), 'pending',
  'a new dukan waits for the TezDukan team'
);
select is(
  (select cnic_number from public.registration_documents where shop_id = tests.id('dukan')), '4130312345671',
  'the CNIC is kept as digits'
);
select is(
  (select ntn from public.shops where id = tests.id('dukan')), '1234567-8',
  'the optional NTN is kept'
);

select tests.remember('distributor', (public.apply_for_distributor(
  'Indus Wholesale', '03001234567', 'Godown 2, Site Area', tests.id('latifabad'), 25.39, 68.36,
  array[tests.id('latifabad')], '4130312345671', current_setting('tests.me') || '/front.webp',
  current_setting('tests.me') || '/back.webp', current_setting('tests.me') || '/warehouse.webp'
) ->> 'id')::uuid);
select is(
  (select status::text from public.organizations where id = tests.id('distributor')), 'pending',
  'a new distributor waits too'
);
select is(
  (select count(*)::integer from jsonb_array_elements(public.my_applications()) a
    where a ->> 'status' = 'pending' and (a ->> 'has_documents')::boolean),
  2, 'the applicant sees both applications with their documents'
);
select is(
  (select count(*)::integer from public.registration_documents), 2,
  'the applicant can read their own documents'
);

select tests.authenticate_as('stranger');
select is(
  (select count(*)::integer from public.registration_documents), 0,
  'nobody else can'
);
select is(public.my_applications(), '[]'::jsonb, 'and their applications list is empty');
select throws_ok(
  format($$ insert into public.registration_documents (shop_id, cnic_number, cnic_front_path, cnic_back_path, place_photo_path)
            values (%L, '4130312345671', 'a', 'b', 'c') $$, tests.id('dukan')),
  '42501', null, 'documents cannot be written around the functions'
);

select tests.authenticate_as('boss');
select is(
  (select s -> 'documents' ->> 'cnic_number' from jsonb_array_elements(public.admin_approvals() -> 'shops') s
    where s ->> 'id' = tests.id('dukan')::text),
  '4130312345671', 'the approvals queue shows the documents to the team'
);
select public.reject_shop(tests.id('dukan'), 'CNIC photo is blurry');

select tests.authenticate_as('applicant');
select is(
  (select a ->> 'rejection_reason' from jsonb_array_elements(public.my_applications()) a
    where a ->> 'id' = tests.id('dukan')::text),
  'CNIC photo is blurry', 'a rejected applicant sees why'
);

select tests.authenticate_as('boss');
select public.approve_organization(tests.id('distributor'));
select tests.authenticate_as('applicant');
select is(
  (select a ->> 'status' from jsonb_array_elements(public.my_applications()) a
    where a ->> 'id' = tests.id('distributor')::text),
  'approved', 'and an approved one sees that'
);

select * from finish();
rollback;
