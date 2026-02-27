# NHAPP Setup Guide (Android + Supabase)

Follow these steps to deploy and run NHAPP.

## 1. Supabase Setup
1.  **Create a Project**: Go to [Supabase](https://supabase.com/) and create a new project.
2.  **Database Schema**: Copy the contents of `supabase/schema.sql` into the Supabase SQL Editor and run it. This creates the tables and RLS policies.
3.  **Storage**: Create a public bucket named `avatars` in the Storage section.
4.  **Auth**:
    - Enable **Email OTP** in Authentication > Providers.
    - Disable "Confirm email" if you want to test without a real SMTP server (Supabase will simulate sending).

## 2. Firebase Setup (for Push Notifications)
1.  **Create a Firebase Project**: Go to [Firebase Console](https://console.firebase.google.com/).
2.  **Add Android App**: Use package name `com.nhapp`.
3.  **Download `google-services.json`**: Place it in `nhapp-android/app/`.
4.  **Enable FCM**: In Firebase project settings, get the "Cloud Messaging" server key (or use the V2 API credentials) and add them to Supabase (Project Settings > API > Messaging).

## 3. Android Project Configuration
1.  **Supabase Credentials**: Open `SupabaseSetup.kt` and replace `your-project-url` and `your-anon-key` with values from Supabase Project Settings > API.
2.  **Build**: Open the project in Android Studio and sync Gradle.
3.  **Run**: Deploy the app to an emulator or physical device.

## 4. Key Functional Areas
- **Login**: Enter an email to receive an OTP. Verify the OTP to enter the chat list.
- **Messaging**: Start a chat (you can manually insert a chat entry in Supabase `chat_members` for testing 1:1) and send messages in real-time.
- **Profile**: Upload an avatar and update your name.
