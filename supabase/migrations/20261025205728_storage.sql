-- =============================================================================================
-- Storage buckets and path-scoped policies.
--
-- Public buckets (read via public URLs, no policy needed for reads):
--   shop-media      <uid>/...                avatars and a user's own uploads (e.g. registration
--                                            photos before the shop exists)
--                   shop/<shop_id>/...       shop photo, cover, gallery (staff with storefront or
--                                            settings permission)
--                   org/<org_id>/...         distributor logo/cover (settings.manage)
--                   platform/...             category tiles, brand logos, banners (admins)
--   product-images  master/<master_product_id>/..., categories/..., brands/...   (admins)
--                   org/<org_id>/<distributor_product_id>/...                     (catalog.manage)
-- Private buckets (signed URLs only):
--   pod-photos        org/<org_id>/<order_id>/...         distributor team uploads; the ordering
--                                                         shop can read its own delivery photos
--   invoices          org/<org_id>/orders/<order_id>/...  B2B invoices/challans (order parties)
--                     org/<org_id>/billing/...            subscription invoices (billing.manage)
--                     shop/<shop_id>/...                  receipts, statements (billing/reports)
--   parchi-uploads    <uid>/...                           photos of handwritten order lists
--   payment-receipts  shop/<shop_id>/<org_id>/...         transfer receipts a shop sends a
--                                                         distributor (both sides can read)
--                     <uid>/...                           a user's own receipts
--   kyc-documents     <uid>/...                           registration documents (CNIC, NTN);
--                                                         readable by the uploader and platform staff
-- =============================================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('shop-media', 'shop-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('pod-photos', 'pod-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('invoices', 'invoices', false, 10485760, array['application/pdf']),
  ('parchi-uploads', 'parchi-uploads', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  ('payment-receipts', 'payment-receipts', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('kyc-documents', 'kyc-documents', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------------------------
-- shop-media
-- ---------------------------------------------------------------------------------------------
create policy shop_media_select on storage.objects for select to authenticated
  using (bucket_id = 'shop-media');

create policy shop_media_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'shop-media'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or ((storage.foldername(name))[1] = 'shop'
          and private.try_uuid((storage.foldername(name))[2]) in (select private.shop_ids_with_any_permission(array['storefront', 'settings'])))
      or ((storage.foldername(name))[1] = 'org'
          and private.try_uuid((storage.foldername(name))[2]) in (select private.org_ids_with_permission('settings.manage')))
      or ((storage.foldername(name))[1] = 'platform' and (select private.is_admin()))
    )
  );

create policy shop_media_update on storage.objects for update to authenticated
  using (
    bucket_id = 'shop-media'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or ((storage.foldername(name))[1] = 'shop'
          and private.try_uuid((storage.foldername(name))[2]) in (select private.shop_ids_with_any_permission(array['storefront', 'settings'])))
      or ((storage.foldername(name))[1] = 'org'
          and private.try_uuid((storage.foldername(name))[2]) in (select private.org_ids_with_permission('settings.manage')))
      or ((storage.foldername(name))[1] = 'platform' and (select private.is_admin()))
    )
  )
  with check (
    bucket_id = 'shop-media'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or ((storage.foldername(name))[1] = 'shop'
          and private.try_uuid((storage.foldername(name))[2]) in (select private.shop_ids_with_any_permission(array['storefront', 'settings'])))
      or ((storage.foldername(name))[1] = 'org'
          and private.try_uuid((storage.foldername(name))[2]) in (select private.org_ids_with_permission('settings.manage')))
      or ((storage.foldername(name))[1] = 'platform' and (select private.is_admin()))
    )
  );

create policy shop_media_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'shop-media'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or ((storage.foldername(name))[1] = 'shop'
          and private.try_uuid((storage.foldername(name))[2]) in (select private.shop_ids_with_any_permission(array['storefront', 'settings'])))
      or ((storage.foldername(name))[1] = 'org'
          and private.try_uuid((storage.foldername(name))[2]) in (select private.org_ids_with_permission('settings.manage')))
      or ((storage.foldername(name))[1] = 'platform' and (select private.is_admin()))
    )
  );

-- ---------------------------------------------------------------------------------------------
-- product-images
-- ---------------------------------------------------------------------------------------------
create policy product_images_select on storage.objects for select to authenticated
  using (bucket_id = 'product-images');

create policy product_images_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and (
      ((storage.foldername(name))[1] in ('master', 'categories', 'brands') and (select private.is_admin()))
      or ((storage.foldername(name))[1] = 'org'
          and private.try_uuid((storage.foldername(name))[2]) in (select private.org_ids_with_permission('catalog.manage')))
    )
  );

create policy product_images_update on storage.objects for update to authenticated
  using (
    bucket_id = 'product-images'
    and (
      ((storage.foldername(name))[1] in ('master', 'categories', 'brands') and (select private.is_admin()))
      or ((storage.foldername(name))[1] = 'org'
          and private.try_uuid((storage.foldername(name))[2]) in (select private.org_ids_with_permission('catalog.manage')))
    )
  )
  with check (
    bucket_id = 'product-images'
    and (
      ((storage.foldername(name))[1] in ('master', 'categories', 'brands') and (select private.is_admin()))
      or ((storage.foldername(name))[1] = 'org'
          and private.try_uuid((storage.foldername(name))[2]) in (select private.org_ids_with_permission('catalog.manage')))
    )
  );

create policy product_images_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'product-images'
    and (
      ((storage.foldername(name))[1] in ('master', 'categories', 'brands') and (select private.is_admin()))
      or ((storage.foldername(name))[1] = 'org'
          and private.try_uuid((storage.foldername(name))[2]) in (select private.org_ids_with_permission('catalog.manage')))
    )
  );

-- ---------------------------------------------------------------------------------------------
-- pod-photos: org/<org_id>/<order_id>/...
-- ---------------------------------------------------------------------------------------------
create policy pod_photos_select on storage.objects for select to authenticated
  using (
    bucket_id = 'pod-photos'
    and (
      ((storage.foldername(name))[1] = 'org'
        and (
          private.try_uuid((storage.foldername(name))[2]) in (select private.my_org_ids())
          or private.try_uuid((storage.foldername(name))[3]) in (select o.id from public.orders o)
        ))
      or (select private.is_platform_staff())
    )
  );

create policy pod_photos_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'pod-photos'
    and (storage.foldername(name))[1] = 'org'
    and private.try_uuid((storage.foldername(name))[2]) in (select private.my_org_ids())
  );

create policy pod_photos_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'pod-photos'
    and (storage.foldername(name))[1] = 'org'
    and private.try_uuid((storage.foldername(name))[2]) in (select private.org_ids_with_permission('delivery.manage'))
  );

-- ---------------------------------------------------------------------------------------------
-- invoices
-- ---------------------------------------------------------------------------------------------
create policy invoices_select on storage.objects for select to authenticated
  using (
    bucket_id = 'invoices'
    and (
      ((storage.foldername(name))[1] = 'org'
        and (
          private.try_uuid((storage.foldername(name))[2]) in (
            select private.org_ids_with_any_permission(array['orders.view', 'orders.manage', 'collections.manage', 'credit.manage', 'analytics.view', 'billing.manage'])
          )
          or ((storage.foldername(name))[3] = 'orders'
              and private.try_uuid((storage.foldername(name))[4]) in (select o.id from public.orders o))
        ))
      or ((storage.foldername(name))[1] = 'shop'
          and private.try_uuid((storage.foldername(name))[2]) in (select private.shop_ids_with_any_permission(array['billing', 'reports', 'orders'])))
      or (select private.is_platform_staff())
    )
  );

create policy invoices_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'invoices'
    and (
      ((storage.foldername(name))[1] = 'org'
        and (storage.foldername(name))[3] = 'orders'
        and private.try_uuid((storage.foldername(name))[2]) in (select private.org_ids_with_any_permission(array['orders.manage', 'collections.manage'])))
      or ((storage.foldername(name))[1] = 'shop'
          and private.try_uuid((storage.foldername(name))[2]) in (select private.shop_ids_with_any_permission(array['billing', 'reports'])))
    )
  );

-- ---------------------------------------------------------------------------------------------
-- parchi-uploads: <uid>/...
-- ---------------------------------------------------------------------------------------------
create policy parchi_uploads_select on storage.objects for select to authenticated
  using (
    bucket_id = 'parchi-uploads'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_platform_staff()))
  );
create policy parchi_uploads_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'parchi-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy parchi_uploads_delete on storage.objects for delete to authenticated
  using (bucket_id = 'parchi-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------------------------
-- payment-receipts
-- ---------------------------------------------------------------------------------------------
create policy payment_receipts_select on storage.objects for select to authenticated
  using (
    bucket_id = 'payment-receipts'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or ((storage.foldername(name))[1] = 'shop'
        and (
          private.try_uuid((storage.foldername(name))[2]) in (select private.shop_ids_with_any_permission(array['orders', 'khata', 'reports']))
          or private.try_uuid((storage.foldername(name))[3]) in (select private.org_ids_with_any_permission(array['collections.manage', 'credit.manage']))
        ))
      or (select private.is_platform_staff())
    )
  );
create policy payment_receipts_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'payment-receipts'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or ((storage.foldername(name))[1] = 'shop'
          and private.try_uuid((storage.foldername(name))[2]) in (select private.shop_ids_with_any_permission(array['orders', 'khata'])))
    )
  );

-- ---------------------------------------------------------------------------------------------
-- kyc-documents: <uid>/...
-- ---------------------------------------------------------------------------------------------
create policy kyc_documents_select on storage.objects for select to authenticated
  using (
    bucket_id = 'kyc-documents'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_platform_staff()))
  );
create policy kyc_documents_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'kyc-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy kyc_documents_delete on storage.objects for delete to authenticated
  using (bucket_id = 'kyc-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
