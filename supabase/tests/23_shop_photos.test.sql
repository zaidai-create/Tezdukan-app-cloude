-- Dukandars upload product photos and their dukan's logo and banner, only into their own folder.
begin;
\ir helpers/setup.psql
select plan(6);

select tests.create_user('owner');
select tests.create_user('stranger');
select tests.make_shop('photo_mart', 'owner');
grant insert, update on tests.refs to authenticated;
select 'shop/' || tests.id('photo_mart')::text || '/' as prefix \gset

select tests.authenticate_as('owner');
select lives_ok(
  format($$ insert into storage.objects (bucket_id, name, owner) values ('product-images', %L, auth.uid()) $$,
         :'prefix' || 'p1.webp'),
  'the dukandar can upload a product photo into the dukan folder'
);
select is(
  public.update_shop_profile(tests.id('photo_mart'), :'prefix' || 'logo.webp', :'prefix' || 'banner.webp', 'Fresh every day') ->> 'cover_path',
  :'prefix' || 'banner.webp', 'and set the dukan logo and banner'
);
select throws_ok(
  format($$ select public.update_shop_profile(%L, 'shop/00000000-0000-0000-0000-000000000000/x.webp') $$, tests.id('photo_mart')),
  '22023', 'invalid_path', 'but not with a picture from another folder'
);
select is(
  public.update_shop_profile(tests.id('photo_mart'), null, '', null) ->> 'cover_path', null,
  'an empty banner clears it'
);

select tests.authenticate_as('stranger');
select throws_ok(
  format($$ insert into storage.objects (bucket_id, name, owner) values ('product-images', %L, auth.uid()) $$,
         :'prefix' || 'p2.webp'),
  '42501', null, 'someone else cannot upload into the dukan folder'
);
select throws_ok(
  format($$ select public.update_shop_profile(%L, null, null, 'Hacked') $$, tests.id('photo_mart')),
  '42501', 'not_allowed', 'or change the dukan profile'
);

select * from finish();
rollback;
