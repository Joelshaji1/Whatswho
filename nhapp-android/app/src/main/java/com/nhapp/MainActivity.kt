package com.nhapp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.BackHandler
import androidx.compose.runtime.*
import com.nhapp.data.SupabaseSetup
import com.nhapp.ui.auth.LoginScreen
import com.nhapp.ui.chat.ChatListScreen
import com.nhapp.ui.chat.ChatDetailScreen
import com.nhapp.ui.chat.ChatListViewModel
import com.nhapp.ui.chat.ChatViewModel
import androidx.lifecycle.viewmodel.compose.viewModel
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.gotrue.SessionStatus
import kotlinx.coroutines.flow.map
import androidx.compose.material3.ExperimentalMaterial3Api
import com.nhapp.data.repository.ProfileRepository
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers

@OptIn(ExperimentalMaterial3Api::class)
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            var currentScreen by remember { mutableStateOf<Screen>(Screen.Login) }
            var selectedChatId by remember { mutableStateOf<String?>(null) }
            
            val user by SupabaseSetup.client.auth.sessionStatus
                .map { if (it is SessionStatus.Authenticated) it.session.user else null }
                .collectAsState(initial = null)
                
            LaunchedEffect(user) {
                if (user != null && currentScreen == Screen.Login) {
                    currentScreen = Screen.ChatList
                } else if (user == null && currentScreen != Screen.Login) {
                    currentScreen = Screen.Login
                }
                
                // Fetch and sync FCM token if user is logged in
                user?.id?.let { userId ->
                    FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
                        if (task.isSuccessful) {
                            val token = task.result
                            kotlinx.coroutines.CoroutineScope(Dispatchers.IO).launch {
                                ProfileRepository().updateFcmToken(userId, token)
                            }
                        }
                    }
                }
            }

            when (currentScreen) {
                is Screen.Login -> LoginScreen(onLoginSuccess = { 
                    currentScreen = Screen.ChatList 
                })
                is Screen.ChatList -> {
                    val userId = user?.id ?: ""
                    ChatListScreen(
                        // Use userId as a key to ensure we get a fresh ViewModel for each user session
                        viewModel = viewModel(key = userId) { ChatListViewModel(userId) },
                        onChatClick = { chat ->
                            selectedChatId = chat.id
                            currentScreen = Screen.ChatDetail
                        }
                    )
                }
                is Screen.ChatDetail -> {
                    val chatId = selectedChatId ?: ""
                    val userId = user?.id ?: ""
                    
                    BackHandler {
                        currentScreen = Screen.ChatList
                    }
                    
                    ChatDetailScreen(
                        // Use chatId as a key to ensure fresh messaging data
                        viewModel = viewModel(key = chatId) { ChatViewModel(chatId) },
                        currentUserId = userId,
                        onBackClick = { currentScreen = Screen.ChatList }
                    )
                }
            }
        }
    }
}

sealed class Screen {
    object Login : Screen()
    object ChatList : Screen()
    object ChatDetail : Screen()
}
