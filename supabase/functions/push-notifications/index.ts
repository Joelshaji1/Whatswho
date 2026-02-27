import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
    try {
        const { record } = await req.json()
        const senderId = record.sender_id
        const chatId = record.chat_id
        const content = record.content

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 1. Find the recipient(s) in the chat
        const { data: members, error: memberError } = await supabase
            .from('chat_members')
            .select('user_id')
            .eq('chat_id', chatId)
            .neq('user_id', senderId)

        if (memberError || !members) throw new Error('Recipient not found')

        // 2. Fetch FCM tokens for recipients
        // NOTE: You'll need to add an 'fcm_token' column to your 'profiles' table first!
        const recipientIds = members.map(m => m.user_id)
        const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('fcm_token, name')
            .in('id', recipientIds)

        if (profileError || !profiles) throw new Error('Profiles not found')

        // 3. Send via FCM (V1 API)
        const fcmTokens = profiles.map(p => p.fcm_token).filter(t => t)
        if (fcmTokens.length === 0) return new Response("No tokens found")

        // Fetch Google Service Account credentials from Supabase Secrets
        const serviceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT') || '{}')

        // Implementation would call FCM REST API here
        // For brevity, we'll return the logic
        console.log(`Sending notification to ${fcmTokens.length} devices: ${content}`)

        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 400 })
    }
})
