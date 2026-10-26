-- Becoming a dukandar/distributor (register -> pending -> admin approval), suspension, booker
-- onboarding with phone claim, and team management guards on direct membership writes.
begin;
\ir helpers/setup.psql
select plan(43);

select tests.create_user('reg', '+923110000101', 'Rashid Memon');
select tests.create_user('outsider');
select tests.create_user('dist_owner');
select tests.create_user('booker');
select tests.create_user('mgr');
select tests.create_user('existing_shopkeeper', '+923110000777', 'Nadeem');
select tests.create_user('rider_user', '+923110000888', 'Imran');
select tests.make_admin('adm');
select tests.make_area('zone_r');
select tests.make_org('org_b', 'dist_owner', 'approved');
select tests.add_org_member('org_b', 'booker', 'booker');
select tests.add_org_member('org_b', 'mgr', 'manager', array['team.manage']);

-- Register a shop ---------------------------------------------------------------------------------
select tests.authenticate_as('reg');
select is(
  (public.register_shop(
    p_name => 'Rashid Kiryana Store', p_phone => '0300-1234567', p_address_line => 'Shop 4, Unit 6, Latifabad',
    p_area_id => tests.id('zone_r'), p_lat => 25.3725, p_lng => 68.3870
  )).status,
  'pending'::public.approval_status,
  'register_shop creates a pending shop'
);
select results_eq(
  $$ select role::text, status::text from public.my_role_contexts() where role = 'dukandar' $$,
  $$ values ('dukandar'::text, 'pending'::text) $$,
  'the new shop shows up in the switcher as pending'
);
select throws_ok(
  $$ select public.register_shop(p_name => 'Bad Phone Store', p_phone => '12345', p_address_line => 'Somewhere', p_area_id => null, p_lat => 25.37, p_lng => 68.38) $$,
  '22023', 'invalid_phone', 'an unreadable phone number is rejected'
);
select throws_ok(
  $$ select public.register_shop(p_name => 'No Pin Store', p_phone => '03001234567', p_address_line => 'Somewhere', p_area_id => null, p_lat => null, p_lng => null) $$,
  '22023', 'location_required', 'a map pin is required'
);
select tests.clear_authentication();
select tests.remember('reg_shop', (select id from public.shops where name = 'Rashid Kiryana Store'));

select is((select phone::text from public.shops where id = tests.id('reg_shop')), '+923001234567', 'shop phone is normalised to E.164');
select results_eq(
  format($$ select role::text, status::text from public.shop_staff where shop_id = %L and user_id = %L $$, tests.id('reg_shop'), tests.id('reg')),
  $$ values ('owner'::text, 'active'::text) $$,
  'the registrant is the active owner'
);
select is(
  (select is_live from public.storefront_settings where shop_id = tests.id('reg_shop')),
  false,
  'an offline storefront is prepared'
);
select ok(
  exists (select 1 from public.notifications where user_id = tests.id('adm') and kind = 'approval' and data ->> 'shop_id' = tests.id('reg_shop')::text),
  'admins are notified of the new registration'
);
select ok(
  exists (select 1 from public.audit_logs where action = 'shop.registered' and entity_id = tests.id('reg_shop')),
  'the registration is audited'
);

-- Approval ------------------------------------------------------------------------------------------
select tests.authenticate_as('reg');
select throws_ok(
  format($$ select public.approve_shop(%L) $$, tests.id('reg_shop')),
  '42501', 'not_authorized', 'only admins can approve shops'
);
select throws_ok(
  format($$ select public.switch_active_context('dukandar', %L) $$, tests.id('reg_shop')),
  '42501', 'context_not_allowed', 'a pending shop cannot be used yet'
);
select tests.clear_authentication();

select tests.authenticate_as('adm');
select is((public.approve_shop(tests.id('reg_shop'))).status, 'approved'::public.approval_status, 'admin approves the shop');
select throws_ok(
  format($$ select public.approve_shop(%L) $$, tests.id('reg_shop')),
  '55000', 'invalid_status', 'an approved shop cannot be approved again'
);
select tests.clear_authentication();

select is((select approved_by from public.shops where id = tests.id('reg_shop')), tests.id('adm'), 'approval records the admin');
select ok(
  exists (select 1 from public.notifications where user_id = tests.id('reg') and data ->> 'event' = 'shop.approved'),
  'the owner is notified of the approval'
);

select tests.authenticate_as('reg');
select lives_ok(
  format($$ select public.switch_active_context('dukandar', %L) $$, tests.id('reg_shop')),
  'after approval the owner can switch into the shop'
);
select tests.clear_authentication();

-- Suspension -----------------------------------------------------------------------------------------
select tests.authenticate_as('adm');
select throws_ok(
  format($$ select public.set_shop_status(%L, 'suspended') $$, tests.id('reg_shop')),
  '22023', 'reason_required', 'suspension needs a reason'
);
select is(
  (public.set_shop_status(tests.id('reg_shop'), 'suspended', 'Fake documents reported')).status,
  'suspended'::public.approval_status,
  'admin suspends the shop'
);
select tests.clear_authentication();
select is(
  (select active_role::text from public.profiles where id = tests.id('reg')),
  'customer',
  'suspension drops the owner back to the customer context'
);
select tests.authenticate_as('adm');
select is((public.set_shop_status(tests.id('reg_shop'), 'approved')).status, 'approved'::public.approval_status, 'admin reinstates the shop');
select tests.clear_authentication();

-- Rejection and resubmission ------------------------------------------------------------------------------
select tests.authenticate_as('reg');
select public.register_shop(p_name => 'Rashid Store Branch', p_phone => '+923001234568', p_address_line => 'Qasimabad Phase 1', p_area_id => null, p_lat => 25.40, p_lng => 68.33);
select tests.clear_authentication();
select tests.remember('reg_shop2', (select id from public.shops where name = 'Rashid Store Branch'));

select tests.authenticate_as('adm');
select throws_ok(
  format($$ select public.reject_shop(%L, '') $$, tests.id('reg_shop2')),
  '22023', 'reason_required', 'rejection needs a reason'
);
select is(
  (public.reject_shop(tests.id('reg_shop2'), 'Shop photo is not clear')).rejection_reason,
  'Shop photo is not clear',
  'admin rejects with a reason'
);
select tests.clear_authentication();

select tests.authenticate_as('outsider');
select throws_ok(
  format($$ select public.resubmit_shop(%L) $$, tests.id('reg_shop2')),
  '42501', 'not_authorized', 'only the owner can resubmit'
);
select tests.clear_authentication();

select tests.authenticate_as('reg');
select is((public.resubmit_shop(tests.id('reg_shop2'))).status, 'pending'::public.approval_status, 'the owner resubmits after fixing it');
select public.register_shop(p_name => 'Rashid Store Three', p_phone => '+923001234569', p_address_line => 'Hirabad Market', p_area_id => null, p_lat => 25.40, p_lng => 68.37);
select public.register_shop(p_name => 'Rashid Store Four', p_phone => '+923001234570', p_address_line => 'Saddar Bazaar', p_area_id => null, p_lat => 25.39, p_lng => 68.37);
select throws_ok(
  $$ select public.register_shop(p_name => 'Rashid Store Five', p_phone => '+923001234571', p_address_line => 'Paretabad', p_area_id => null, p_lat => 25.41, p_lng => 68.36) $$,
  '54000', 'too_many_pending_registrations', 'at most three shops can wait for review'
);

-- Distributor registration ------------------------------------------------------------------------------
select is(
  (public.register_organization(
    p_name => 'Rashid Distributors', p_phone => '0300 7654321', p_address_line => 'Plot 9, SITE Area', p_area_id => null,
    p_lat => 25.41, p_lng => 68.33, p_email => 'accounts@rashid.pk'
  )).status,
  'pending'::public.approval_status,
  'register_organization creates a pending distributor'
);
select tests.clear_authentication();
select tests.remember('reg_org', (select id from public.organizations where name = 'Rashid Distributors'));
select results_eq(
  format($$ select role::text, status::text from public.org_members where org_id = %L and user_id = %L $$, tests.id('reg_org'), tests.id('reg')),
  $$ values ('owner'::text, 'active'::text) $$,
  'the registrant owns the distributor'
);
select results_eq(
  format($$ select code, is_default from public.warehouses where org_id = %L $$, tests.id('reg_org')),
  $$ values ('MAIN'::text, true) $$,
  'a default warehouse is created'
);
select tests.authenticate_as('adm');
select is((public.approve_organization(tests.id('reg_org'))).status, 'approved'::public.approval_status, 'admin approves the distributor');
select tests.clear_authentication();
select tests.authenticate_as('reg');
select lives_ok(
  format($$ select public.switch_active_context('distributor', %L) $$, tests.id('reg_org')),
  'the owner can now switch into the distributor context'
);
select tests.clear_authentication();

-- Booker onboarding and phone claim -----------------------------------------------------------------------
select tests.authenticate_as('booker');
select public.register_shop(
  p_name => 'Bismillah General Store', p_phone => '+923110000555', p_address_line => 'Near Hirabad Chowk',
  p_area_id => null, p_lat => 25.403, p_lng => 68.368, p_onboarded_by_org_id => tests.id('org_b')
);
select public.register_shop(
  p_name => 'Nadeem Mart', p_phone => '+923110000777', p_address_line => 'Saddar, Hyderabad',
  p_area_id => null, p_lat => 25.388, p_lng => 68.372, p_onboarded_by_org_id => tests.id('org_b')
);
select tests.clear_authentication();
select tests.remember('onboarded', (select id from public.shops where name = 'Bismillah General Store'));

select is((select owner_id from public.shops where id = tests.id('onboarded')), null::uuid, 'an onboarded shop has no owner until the phone is verified');
select is(
  (select assigned_booker_id from public.retailer_accounts where org_id = tests.id('org_b') and shop_id = tests.id('onboarded')),
  tests.id('org_b:booker'),
  'the onboarding booker is assigned to the new retailer account'
);
select is(
  (select owner_id from public.shops where name = 'Nadeem Mart'),
  tests.id('existing_shopkeeper'),
  'an existing TezDukan user with the shop phone owns it immediately'
);
select tests.authenticate_as('outsider');
select throws_ok(
  format($$ select public.register_shop(p_name => 'Ghost Store', p_phone => '+923110000556', p_address_line => 'Nowhere', p_area_id => null, p_lat => 25.4, p_lng => 68.3, p_onboarded_by_org_id => %L) $$, tests.id('org_b')),
  '42501', 'not_authorized', 'only that distributor''s team can onboard shops for it'
);
select tests.clear_authentication();

select tests.create_user('shopkeeper', '+923110000555', 'Bismillah Owner');
select results_eq(
  format($$ select s.owner_id, ss.role::text, ss.status::text from public.shops s join public.shop_staff ss on ss.shop_id = s.id where s.id = %L $$, tests.id('onboarded')),
  format($$ values (%L::uuid, 'owner'::text, 'active'::text) $$, tests.id('shopkeeper')),
  'verifying the shop phone claims the shop'
);

-- Team management guards (direct writes to org_members) ----------------------------------------------------
select tests.authenticate_as('mgr');
select lives_ok(
  format($$ insert into public.org_members (org_id, phone, role, display_name) values (%L, '+923110000888', 'rider', 'Imran') $$, tests.id('org_b')),
  'a member with team.manage invites by phone'
);
select lives_ok(
  format($$ insert into public.org_members (org_id, phone, role, display_name) values (%L, '+923110000999', 'booker', 'Asif') $$, tests.id('org_b')),
  'inviting someone who is not on TezDukan yet'
);
select throws_ok(
  format($$ insert into public.org_members (org_id, phone, role) values (%L, '+923110000998', 'owner') $$, tests.id('org_b')),
  '42501', 'only_owner_can_manage_owners', 'only owners can add owners'
);
select throws_ok(
  format($$ update public.org_members set role = 'owner' where org_id = %L and user_id = auth.uid() $$, tests.id('org_b')),
  '42501', null, 'members cannot change their own access'
);
select tests.clear_authentication();

select results_eq(
  format($$ select user_id, status::text from public.org_members where org_id = %L and phone = '+923110000888' $$, tests.id('org_b')),
  format($$ values (%L::uuid, 'active'::text) $$, tests.id('rider_user')),
  'an existing user joins immediately'
);
select is(
  (select status::text from public.org_members where org_id = tests.id('org_b') and phone = '+923110000999'),
  'invited',
  'a new phone stays invited'
);
select tests.create_user('asif', '+923110000999', 'Asif');
select is(
  (select user_id from public.org_members where org_id = tests.id('org_b') and phone = '+923110000999'),
  tests.id('asif'),
  'the invite is accepted when that phone is verified'
);

select tests.authenticate_as('dist_owner');
select throws_ok(
  format($$ delete from public.org_members where org_id = %L and user_id = auth.uid() $$, tests.id('org_b')),
  '23514', 'last_owner', 'the last owner cannot leave'
);
select tests.clear_authentication();

select * from finish();
rollback;
