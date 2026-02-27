ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;
UPDATE public.profiles p SET email = u.email FROM auth.users u WHERE p.id = u.id AND p.email IS NULL;
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger AS $BODY BEGIN INSERT INTO public.profiles (id, name, email) VALUES (new.id, split_part(new.email, '@', 1), new.email); RETURN new; END; $BODY LANGUAGE plpgsql SECURITY DEFINER;
