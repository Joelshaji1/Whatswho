package com.nhapp.data.repository

import com.nhapp.data.SupabaseSetup
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.gotrue.OtpType
import io.github.jan.supabase.gotrue.providers.builtin.OTP
import io.github.jan.supabase.gotrue.providers.builtin.Email
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class AuthRepository {
    private val auth = SupabaseSetup.client.auth

    suspend fun requestOtp(email: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            auth.signInWith(OTP) {
                this.email = email
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun verifyOtp(email: String, token: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            // `signInWith(OTP)` generates a MAGIC_LINK token by default, not SIGNUP.
            auth.verifyEmailOtp(
                type = OtpType.Email.MAGIC_LINK,
                email = email,
                token = token
            )
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun signInWithPassword(email: String, password: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            auth.signInWith(Email) {
                this.email = email
                this.password = password
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun signUpWithPassword(email: String, password: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            auth.signUpWith(Email) {
                this.email = email
                this.password = password
            }
            Result.success(Unit)
        } catch (e: Exception) {
            // Check if the user was actually created but the email just failed to send
            if (auth.currentUserOrNull() != null) {
                Result.success(Unit)
            } else {
                Result.failure(e)
            }
        }
    }

    fun getCurrentUser() = auth.currentUserOrNull()

    suspend fun signOut() = withContext(Dispatchers.IO) {
        try {
            auth.signOut()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
