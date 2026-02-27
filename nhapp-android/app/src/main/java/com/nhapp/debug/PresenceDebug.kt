package com.nhapp.debug
import io.github.jan.supabase.realtime.Presence
import kotlinx.serialization.json.decodeFromJsonElement
import com.nhapp.data.SupabaseSetup
import com.nhapp.ui.chat.UserPresence

fun debug(p: Presence) {
    // This is just to see what compiles
    // p.decodeAs<UserPresence>()
}
