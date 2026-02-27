ALTER TABLE public.chats DROP CONSTRAINT IF EXISTS chats_created_by_fkey;
ALTER TABLE public.chats ADD CONSTRAINT chats_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
