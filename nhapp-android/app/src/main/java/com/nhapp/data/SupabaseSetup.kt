package com.nhapp.data

import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.gotrue.Auth
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.realtime.Realtime
import io.github.jan.supabase.storage.Storage
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.HttpTimeout

object SupabaseSetup {
    // Replace with your actual project URL and Anon Key
    private const val SUPABASE_URL = "https://vcllrgssqonheiddzqdd.supabase.co"
    private const val SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjbGxyZ3NzcW9uaGVpZGR6cWRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NDg4MjUsImV4cCI6MjA4NzUyNDgyNX0.M2-_THBRJisSCD866U0oT7baOcG7AffAe2zjdXYOyG0"

    @OptIn(io.github.jan.supabase.annotations.SupabaseInternal::class)
    val client = createSupabaseClient(SUPABASE_URL, SUPABASE_KEY) {
        install(Postgrest)
        install(Auth)
        install(Realtime)
        install(Storage)
        // Use standard robust OkHttp engine
        httpEngine = OkHttp.create()
        
        // Increase default timeout to prevent login errors on physical device networks
        httpConfig {
            install(HttpTimeout) {
                requestTimeoutMillis = 45000
                connectTimeoutMillis = 45000
                socketTimeoutMillis = 45000
            }
        }
    }
}
