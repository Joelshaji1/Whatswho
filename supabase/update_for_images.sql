-- NHAPP Storage and Schema Updates for Image Support

-- 1. Add image_url column to messages table
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. Create Bucket for chat images
-- Note: You might need to do this via the Supabase Dashboard if you don't have SQL access to the storage schema.
-- But here is the SQL for it:
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat_images', 'chat_images', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Set up Storage RLS Policies for the 'chat_images' bucket
-- Allow authenticated users to upload and view images
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'chat_images');
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'chat_images' AND auth.role() = 'authenticated');

-- 4. Enable Full Replica Identity on messages table for Realtime UPDATEs
-- This is strictly required so that when a message is soft-deleted (updated to 'This message was deleted'), 
-- Supabase broadcasts the FULL updated row to the other user instead of just the changed columns, which crashes the Kotlin listener.
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- 5. Enable Realtime Broadcast for the messages table
-- This is the missing link! If the table isn't in the supabase_realtime publication, 
-- Postgres will NEVER push new messages or deleted updates to the other phone's websocket!
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
