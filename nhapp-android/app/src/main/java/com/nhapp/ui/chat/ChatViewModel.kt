package com.nhapp.ui.chat

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nhapp.data.repository.ChatRepository
import com.nhapp.data.model.Message
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import com.nhapp.data.SupabaseSetup
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.realtime.*
import kotlinx.serialization.Serializable

@Serializable
data class UserPresence(val isTyping: Boolean = false)

sealed class PartnerStatus {
    object Offline : PartnerStatus()
    object Online : PartnerStatus()
    object Typing : PartnerStatus()
}

sealed class ChatState {
    object Loading : ChatState()
    data class Success(val messages: List<Message>) : ChatState()
    data class Error(val message: String) : ChatState()
}

class ChatViewModel(
    private val chatId: String,
    private val repository: ChatRepository = ChatRepository()
) : ViewModel() {

    private val _state = MutableStateFlow<ChatState>(ChatState.Loading)
    val state = _state.asStateFlow()

    private val _partnerProfile = MutableStateFlow<com.nhapp.data.model.Profile?>(null)
    val partnerProfile = _partnerProfile.asStateFlow()

    private val _partnerStatus = MutableStateFlow<PartnerStatus>(PartnerStatus.Offline)
    val partnerStatus = _partnerStatus.asStateFlow()

    private val profileRepository = com.nhapp.data.repository.ProfileRepository()
    init {
        fetchPartnerProfile()
        fetchInitialMessages()
        setupRealtime()
    }
    
    private fun setupRealtime() {
        viewModelScope.launch {
            try {
                // 1. Connect the actual engine first
                try {
                    SupabaseSetup.client.realtime.connect()
                } catch (e: Exception) {
                    // Already connected
                }
                
                val channel = repository.getChatChannel(chatId)
                
                // 2. Simply collect the flow in a child coroutine so it doesn't block
                launch {
                    repository.getMessagesFlow(channel, chatId).collect { messages ->
                        Log.d("ChatViewModel", "Realtime updated: ${messages.size} msgs")
                        _state.value = ChatState.Success(messages.sortedBy { it.created_at })
                        repository.markMessagesAsRead(chatId, SupabaseSetup.client.auth.currentUserOrNull()?.id ?: "")
                    }
                }
                
                // 3. Actually join the room. Without this, the server never sends events!
                channel.subscribe()
                
            } catch (e: Exception) {
                e.printStackTrace()
                // If realtime fails, fallback to standard fetch
                fetchInitialMessages()
            }
        }
    }

    // Removed old observeMessages/Presence to use centralized setupRealtime

    private fun fetchPartnerProfile() {
        viewModelScope.launch {
            val myUserId = SupabaseSetup.client.auth.currentUserOrNull()?.id ?: return@launch
            val otherMember = repository.getOtherMember(chatId, myUserId)
            if (otherMember != null) {
                _partnerProfile.value = profileRepository.getProfile(otherMember.user_id)
            }
        }
    }

    private fun fetchInitialMessages() {
        viewModelScope.launch {
            try {
                val messages = repository.getMessages(chatId)
                _state.value = ChatState.Success(messages.sortedBy { it.created_at })
                
                // Mark as read after initial fetch
                repository.markMessagesAsRead(chatId, SupabaseSetup.client.auth.currentUserOrNull()?.id ?: "")
            } catch (e: Exception) {
                _state.value = ChatState.Error(e.message ?: "Failed to load messages")
            }
        }
    }

    fun setTyping(isTyping: Boolean) {
        viewModelScope.launch {
            try {
                val channel = repository.getChatChannel(chatId)
                channel.track(UserPresence(isTyping = isTyping))
            } catch (e: Exception) {
                // Ignore
            }
        }
    }

    fun sendMessage(senderId: String, content: String) {
        viewModelScope.launch {
            try {
                // Optimistic UI update for instant feedback
                val temporaryMessage = Message(
                    id = java.util.UUID.randomUUID().toString(),
                    chat_id = chatId,
                    sender_id = senderId,
                    content = content,
                    created_at = java.time.OffsetDateTime.now().toString()
                )
                
                val currentState = _state.value
                if (currentState is ChatState.Success) {
                    val updatedList = currentState.messages + temporaryMessage
                    _state.value = ChatState.Success(updatedList.sortedBy { it.created_at })
                }
                
                repository.sendMessage(chatId, senderId, content, null)
            } catch (e: Exception) {
                // We rely on Realtime observing to correct the list if it fails
                _state.value = ChatState.Error(e.message ?: "Failed to send message")
            }
        }
    }

    fun sendImage(senderId: String, byteArray: ByteArray, extension: String) {
        viewModelScope.launch(kotlinx.coroutines.Dispatchers.IO) {
            val temporaryMessageId = java.util.UUID.randomUUID().toString()
            try {
                Log.d("ChatViewModel", "Starting image send process...")
                // Optimistic UI update for instant feedback (showing a placeholder or loading state)
                val temporaryMessage = Message(
                    id = temporaryMessageId,
                    chat_id = chatId,
                    sender_id = senderId,
                    content = "📷 Sending image...",
                    image_url = null, // Can't reliably show local bytearray in this architecture easily without URI
                    created_at = java.time.OffsetDateTime.now().toString()
                )
                
                // Update UI on main thread safely
                kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Main) {
                    val currentState = _state.value
                    if (currentState is ChatState.Success) {
                        val updatedList = currentState.messages + temporaryMessage
                        _state.value = ChatState.Success(updatedList.sortedBy { it.created_at })
                    }
                }

                // Generate a unique filename
                val fileName = "$temporaryMessageId.$extension"
                Log.d("ChatViewModel", "Uploading image $fileName to Supabase Storage...")
                
                // Upload to storage
                val imageUrl = repository.uploadImage(byteArray, fileName)
                Log.d("ChatViewModel", "Image uploaded successfully. URL: $imageUrl")
                
                // Update the temporary UI bubble with the real image URL instantly!
                kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Main) {
                    val current = _state.value
                    if (current is ChatState.Success) {
                        val resolvedList = current.messages.map { msg ->
                            if (msg.id == temporaryMessageId) {
                                msg.copy(content = "", image_url = imageUrl)
                            } else {
                                msg
                            }
                        }
                        _state.value = ChatState.Success(resolvedList)
                    }
                }
                
                // Save message record with image url
                Log.d("ChatViewModel", "Inserting message record into database...")
                repository.sendMessage(chatId, senderId, "", imageUrl)
                Log.d("ChatViewModel", "Message record inserted successfully.")
                
            } catch (e: Exception) {
                Log.e("ChatViewModel", "Exception caught during image send!", e)
                kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Main) {
                    val current = _state.value
                    if (current is ChatState.Success) {
                        // Remove the loading bubble if it failed
                        val cleanupList = current.messages.filter { it.id != temporaryMessageId }
                        _state.value = ChatState.Success(cleanupList)
                    }
                    _state.value = ChatState.Error("Failed to upload image: ${e.message}")
                }
                e.printStackTrace()
            }
        }
    }

    fun deleteMessageForEveryone(messageId: String) {
        viewModelScope.launch {
            try {
                // Optimistic UI update for instant deletion feedback
                val currentState = _state.value
                if (currentState is ChatState.Success) {
                    val updatedList = currentState.messages.map { 
                        if (it.id == messageId) {
                            it.copy(content = "🚫 This message was deleted", image_url = null)
                        } else {
                            it
                        }
                    }
                    _state.value = ChatState.Success(updatedList)
                }

                repository.deleteMessage(messageId)
            } catch (e: Exception) {
                // If it fails, rely on the observer to resync the true state
            }
        }
    }
}
