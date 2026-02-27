package com.nhapp.ui.chat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nhapp.data.repository.ChatRepository
import com.nhapp.data.model.Chat
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class ChatListState {
    object Loading : ChatListState()
    data class Success(val chats: List<com.nhapp.data.model.ChatWithProfile>) : ChatListState()
    data class Error(val message: String) : ChatListState()
}

class ChatListViewModel(
    private val userId: String,
    private val repository: ChatRepository = ChatRepository()
) : ViewModel() {

    private val profileRepository: com.nhapp.data.repository.ProfileRepository = com.nhapp.data.repository.ProfileRepository()

    private val _state = MutableStateFlow<ChatListState>(ChatListState.Loading)
    val state = _state.asStateFlow()

    private val _searchResult = MutableStateFlow<com.nhapp.data.model.Profile?>(null)
    val searchResult = _searchResult.asStateFlow()

    private val _searchError = MutableStateFlow<String?>(null)
    val searchError = _searchError.asStateFlow()

    init {
        loadChats()
    }

    private fun loadChats() {
        viewModelScope.launch {
            try {
                val chats = repository.getChatsForUser(userId)
                val chatsWithProfiles = chats.map { chat ->
                    val otherMember = repository.getOtherMember(chat.id!!, userId)
                    val profile = otherMember?.let { profileRepository.getProfile(it.user_id) }
                    com.nhapp.data.model.ChatWithProfile(chat, profile)
                }
                _state.value = ChatListState.Success(chatsWithProfiles)
            } catch (e: Exception) {
                _state.value = ChatListState.Error(e.message ?: "Failed to load chats")
            }
        }
    }

    fun searchUserByEmail(email: String) {
        viewModelScope.launch {
            _searchError.value = null
            _searchResult.value = null
            try {
                val profile = profileRepository.getProfileByEmail(email.trim())
                if (profile != null && profile.id != userId) {
                    _searchResult.value = profile
                } else if (profile?.id == userId) {
                    _searchError.value = "You cannot chat with yourself."
                } else {
                    _searchError.value = "User not found."
                }
            } catch (e: Exception) {
                _searchError.value = "Error searching for user."
            }
        }
    }

    fun clearSearch() {
        _searchResult.value = null
        _searchError.value = null
    }

    fun startChat(otherUserId: String, onChatCreated: (Chat) -> Unit) {
        viewModelScope.launch {
            try {
                val chat = repository.createChat(userId, otherUserId)
                onChatCreated(chat)
            } catch (e: Exception) {
                android.util.Log.e("ChatListViewModel", "startChat failed", e)
                _state.value = ChatListState.Error(e.message ?: "Failed to start chat")
            }
        }
    }
}
