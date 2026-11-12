-- The TezDukan assistant (AI) answers support chats first. Its messages need their own side.
-- Kept in its own migration: a value added with ALTER TYPE cannot be used in the same
-- transaction that adds it.
alter type public.chat_side add value if not exists 'assistant';
