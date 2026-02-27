package com.nhapp.service

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import android.util.Log
import com.nhapp.data.SupabaseSetup
import com.nhapp.data.repository.ProfileRepository
import io.github.jan.supabase.gotrue.auth
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class NhappMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d("FCM", "New token: $token")
        
        // Update token in Supabase Profiles if user is currently logged in
        val user = SupabaseSetup.client.auth.currentUserOrNull()
        if (user != null) {
            CoroutineScope(Dispatchers.IO).launch {
                ProfileRepository().updateFcmToken(user.id, token)
            }
        }
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        Log.d("FCM", "From: ${remoteMessage.from}")
        // Handle incoming notification
    }
}
