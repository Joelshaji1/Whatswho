package com.nhapp.data.repository

import com.nhapp.data.SupabaseSetup
import com.nhapp.data.model.Profile
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.storage.storage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class ProfileRepository {
    private val postgrest = SupabaseSetup.client.postgrest
    private val storage = SupabaseSetup.client.storage

    suspend fun getProfile(userId: String): Profile? {
        return postgrest.from("profiles").select {
            filter { eq("id", userId) }
        }.decodeSingleOrNull<Profile>()
    }

    suspend fun getProfileByEmail(email: String): Profile? {
        return postgrest.from("profiles").select {
            filter { ilike("email", email.trim()) }
        }.decodeSingleOrNull<Profile>()
    }

    suspend fun updateProfile(userId: String, name: String?, avatarUrl: String?) {
        val updates = mutableMapOf<String, String?>()
        if (name != null) updates["name"] = name
        if (avatarUrl != null) updates["avatar_url"] = avatarUrl

        postgrest.from("profiles").update(updates) {
            filter { eq("id", userId) }
        }
    }

    suspend fun updateFcmToken(userId: String, token: String) = withContext(Dispatchers.IO) {
        try {
            val updates = mapOf("fcm_token" to token)
            postgrest.from("profiles").update(updates) {
                filter { eq("id", userId) }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    suspend fun uploadAvatar(userId: String, bytes: ByteArray): String = withContext(Dispatchers.IO) {
        val bucket = storage.from("avatars")
        val path = "$userId/avatar.jpg"
        bucket.upload(path, bytes, upsert = true)
        bucket.publicUrl(path)
    }
    suspend fun getAllProfiles(): List<Profile> {
        return postgrest.from("profiles").select().decodeList<Profile>()
    }
}
