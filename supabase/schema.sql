-- NHAPP Supabase Schema

-- 1. Users table (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    name TEXT,
    avatar_url TEXT,
    fcm_token TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Chats table
CREATE TABLE IF NOT EXISTS public.chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id)
);

-- 3. Chat members junction table
CREATE TABLE IF NOT EXISTS public.chat_members (
    chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    PRIMARY KEY (chat_id, user_id)
);

-- 4. Messages table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES public.profiles(id) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_chat_id_created_at ON public.messages(chat_id, created_at DESC);

-- RLS (Row Level Security) Policies

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Profiles: Anyone can view profiles, but only users can update their own
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Security Definer function to break RLS recursion
CREATE OR REPLACE FUNCTION public.get_chats_for_user(u_id UUID)
RETURNS TABLE (chat_id UUID) AS $$
BEGIN
    RETURN QUERY SELECT cm.chat_id FROM public.chat_members cm WHERE cm.user_id = u_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Chats: Users can see chats they are members of or if they created it
CREATE POLICY "Users can view their chats" ON public.chats FOR SELECT 
USING (
    created_by = auth.uid() OR 
    id IN (SELECT get_chats_for_user(auth.uid()))
);

CREATE POLICY "Authenticated users can create chats" ON public.chats FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Chat Members: Users can see members of chats they belong to
CREATE POLICY "Users can view chat members" ON public.chat_members FOR SELECT
USING (chat_id IN (SELECT get_chats_for_user(auth.uid())));

CREATE POLICY "Authenticated users can join chats" ON public.chat_members FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Messages: Users can see and send messages in chats they belong to
CREATE POLICY "Users can view messages in their chats" ON public.messages FOR SELECT
USING (chat_id IN (SELECT get_chats_for_user(auth.uid())));

CREATE POLICY "Users can send messages to their chats" ON public.messages FOR INSERT
WITH CHECK (
    auth.uid() = sender_id AND 
    chat_id IN (SELECT get_chats_for_user(auth.uid()))
);

-- Users can UPDATE their own messages (for soft-deletes) 
CREATE POLICY "Users can edit their own messages" ON public.messages FOR UPDATE
USING (auth.uid() = sender_id);

-- Users can UPDATE messages sent TO them (for read receipts)
CREATE POLICY "Users can mark received messages as read" ON public.messages FOR UPDATE
USING (
    auth.uid() != sender_id AND 
    chat_id IN (SELECT get_chats_for_user(auth.uid()))
);

-- Trigger to auto-create profile row on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (new.id, split_part(new.email, '@', 1));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
