package com.nhapp.data.repository

import com.nhapp.data.SupabaseSetup
import com.nhapp.data.model.Chat
import com.nhapp.data.model.Message
import com.nhapp.data.model.ChatMember
import com.nhapp.data.model.Profile
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.realtime.realtime
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.RealtimeChannel
import io.github.jan.supabase.realtime.postgresListDataFlow
import io.github.jan.supabase.postgrest.query.filter.FilterOperator
import io.github.jan.supabase.postgrest.query.filter.FilterOperation
import io.github.jan.supabase.storage.storage
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.Serializable

class ChatRepository {
    private val postgrest = SupabaseSetup.client.postgrest
    private val storage = SupabaseSetup.client.storage

    suspend fun getChatsForUser(userId: String): List<Chat> {
        // Fetch chat IDs where the user is a member
        val chatIds = postgrest.from("chat_members")
            .select {
                filter {
                    eq("user_id", userId)
                }
            }
            .decodeList<ChatMember>()
            .map { it.chat_id }

        if (chatIds.isEmpty()) return emptyList()

        return postgrest.from("chats")
            .select {
                filter {
                    isIn("id", chatIds)
                }
            }
            .decodeList<Chat>()
    }

    suspend fun createChat(myUserId: String, otherUserId: String): Chat {
        val actualMyUserId = SupabaseSetup.client.auth.currentUserOrNull()?.id ?: myUserId
        if (actualMyUserId.isBlank()) throw Exception("Not logged in or invalid user ID")
        
        val newId = java.util.UUID.randomUUID().toString()
        val now = java.time.OffsetDateTime.now().toString()
        
        // Ensure my profile exists in case of trigger failure
        try {
            val myProfile = postgrest.from("profiles").select{filter{eq("id", actualMyUserId)}}.decodeSingleOrNull<Profile>()
            if (myProfile == null) {
                val fbEmail = SupabaseSetup.client.auth.currentUserOrNull()?.email ?: "Unknown"
                postgrest.from("profiles").insert(Profile(
                    id = actualMyUserId, name = fbEmail.substringBefore("@"), email = fbEmail, avatar_url = null, created_at = now
                ))
            }
        } catch(e: Exception) {}

        // 1. Create the chat
        postgrest.from("chats").insert(Chat(id = newId, created_by = actualMyUserId, created_at = now))
        
        // 2. Add members
        val member1 = ChatMember(chat_id = newId, user_id = actualMyUserId)
        val member2 = ChatMember(chat_id = newId, user_id = otherUserId)
        
        postgrest.from("chat_members").insert(member1)
        postgrest.from("chat_members").insert(member2)

        // No auto-welcome message - Real user testing only
        
        return Chat(id = newId, created_by = actualMyUserId, created_at = now)
    }

    suspend fun getOtherMember(chatId: String, myUserId: String): ChatMember? {
        return postgrest.from("chat_members")
            .select {
                filter {
                    eq("chat_id", chatId)
                    neq("user_id", myUserId)
                }
            }
            .decodeSingleOrNull<ChatMember>()
    }

    suspend fun getMessages(chatId: String): List<Message> {
        return postgrest.from("messages")
            .select {
                filter {
                    eq("chat_id", chatId)
                }
            }
            .decodeList<Message>()
    }

    suspend fun sendMessage(chatId: String, senderId: String, content: String, imageUrl: String? = null) {
        val message = Message(
            id = java.util.UUID.randomUUID().toString(),
            chat_id = chatId,
            sender_id = senderId,
            content = content,
            image_url = imageUrl,
            created_at = java.time.OffsetDateTime.now().toString()
        )
        postgrest.from("messages").insert(message)
    }

    suspend fun uploadImage(byteArray: ByteArray, fileName: String): String {
        try {
            val bucket = storage.from("chat_images")
            bucket.upload(fileName, byteArray, upsert = true)
            return bucket.publicUrl(fileName)
        } catch (e: Exception) {
            e.printStackTrace()
            throw Exception("Supabase Storage Error: ${e.message}")
        }
    }

    fun getMessagesFlow(channel: RealtimeChannel, chatId: String): Flow<List<Message>> {
        return channel.postgresListDataFlow(
            schema = "public",
            table = "messages",
            primaryKey = Message::id,
            filter = FilterOperation("chat_id", FilterOperator.EQ, chatId)
        )
    }

    fun getChatChannel(chatId: String) = SupabaseSetup.client.realtime.channel("messages_$chatId")

    @Serializable
    private data class ReadUpdateMapping(
        val read_at: String
    )

    suspend fun markMessagesAsRead(chatId: String, userId: String) {
        try {
            val messages = postgrest.from("messages").select {
                filter {
                    eq("chat_id", chatId)
                    neq("sender_id", userId)
                }
            }.decodeList<Message>()
            
            val unreadIds = messages.filter { it.read_at == null }.mapNotNull { it.id }
            if (unreadIds.isNotEmpty()) {
                val updatePayload = ReadUpdateMapping(
                    read_at = java.time.OffsetDateTime.now().toString()
                )
                postgrest.from("messages").update(updatePayload) {
                    filter {
                        isIn("id", unreadIds)
                    }
                }
            }
        } catch (e: Exception) {
            // Log or ignore read receipt failures to prevent chat crashes
        }
    }

    @Serializable
    private data class DeleteUpdateMapping(
        val content: String,
        val image_url: String? = null
    )

    suspend fun deleteMessage(messageId: String) {
        try {
            val updatePayload = DeleteUpdateMapping(
                content = "🚫 This message was deleted"
            )
            postgrest.from("messages").update(updatePayload) {
                filter {
                    eq("id", messageId)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
