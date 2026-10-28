-- =============================================================================================
-- Phase 3 enum values. Kept in their own migration: a value added with ALTER TYPE cannot be
-- used in the same transaction that adds it.
-- =============================================================================================

-- Chat messages between a dukan and its distributor, and with TezDukan support.
alter type public.notification_kind add value if not exists 'chat';
