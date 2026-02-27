package com.nhapp.ui.chat

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.background
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.lifecycle.viewModelScope
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import java.io.ByteArrayOutputStream
import coil.compose.AsyncImage
import com.nhapp.data.model.Message
import com.nhapp.data.model.Profile
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatDetailScreen(
    viewModel: ChatViewModel,
    currentUserId: String,
    onBackClick: () -> Unit
) {
    val state by viewModel.state.collectAsState()
    val partner by viewModel.partnerProfile.collectAsState()
    val partnerStatus by viewModel.partnerStatus.collectAsState()
    var messageText by remember { mutableStateOf("") }
    val context = LocalContext.current
    
    val imagePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri ->
        uri?.let {
            viewModel.viewModelScope.launch(kotlinx.coroutines.Dispatchers.IO) {
                try {
                    val inputStream = context.contentResolver.openInputStream(it)
                    val originalBitmap = BitmapFactory.decodeStream(inputStream)
                    inputStream?.close()

                    if (originalBitmap != null) {
                        // Scale down if image is too large (max 1024px)
                        var width = originalBitmap.width
                        var height = originalBitmap.height
                        val maxSize = 1024
                        if (width > maxSize || height > maxSize) {
                            val ratio = width.toFloat() / height.toFloat()
                            if (ratio > 1) {
                                width = maxSize
                                height = (maxSize / ratio).toInt()
                            } else {
                                height = maxSize
                                width = (maxSize * ratio).toInt()
                            }
                        }
                        
                        val resizedBitmap = Bitmap.createScaledBitmap(originalBitmap, width, height, true)
                        val outputStream = ByteArrayOutputStream()
                        // Compress to 70% quality JPEG to ensure rapid uploads over mobile networks
                        resizedBitmap.compress(Bitmap.CompressFormat.JPEG, 70, outputStream)
                        val compressedBytes = outputStream.toByteArray()
                        
                        viewModel.sendImage(currentUserId, compressedBytes, "jpg")
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
    }
    LaunchedEffect(messageText) {
        if (messageText.isNotBlank()) {
            viewModel.setTyping(true)
            kotlinx.coroutines.delay(3000) // Reset after 3 seconds of inactivity
            viewModel.setTyping(false)
        } else {
            viewModel.setTyping(false)
        }
    }
    var messageToDelete by remember { mutableStateOf<Message?>(null) }

    val whatsappDarkGreen = Color(0xFF075E54)
    val whatsappTealGreen = Color(0xFF128C7E)
    val whatsappBackground = Color(0xFFECE5DD)

    var hiddenMessages by remember { mutableStateOf(setOf<String>()) }

    if (messageToDelete != null) {
        val isMyMessage = messageToDelete?.sender_id == currentUserId
        
        AlertDialog(
            onDismissRequest = { messageToDelete = null },
            title = { Text("Delete message?") },
            text = { Text("Choose how you want to delete this message.") },
            confirmButton = {
                Column(horizontalAlignment = Alignment.End) {
                    if (isMyMessage) {
                        TextButton(onClick = {
                            messageToDelete?.id?.let { viewModel.deleteMessageForEveryone(it) }
                            messageToDelete = null
                        }) {
                            Text("DELETE FOR EVERYONE", color = whatsappDarkGreen)
                        }
                    }
                    TextButton(onClick = {
                        messageToDelete?.id?.let { hiddenMessages = hiddenMessages + it }
                        messageToDelete = null
                    }) {
                        Text("DELETE FOR ME", color = whatsappDarkGreen)
                    }
                }
            },
            dismissButton = {
                TextButton(onClick = { messageToDelete = null }) {
                    Text("CANCEL", color = Color.Gray)
                }
            }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Surface(
                            modifier = Modifier.size(36.dp),
                            shape = RoundedCornerShape(18.dp),
                            color = Color.LightGray
                        ) {
                            // Avatar placeholder
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        Column {
                            Text(partner?.name ?: "Chat", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = Color.White)
                            val statusText = when (partnerStatus) {
                                is PartnerStatus.Typing -> "typing..."
                                is PartnerStatus.Online -> "online"
                                is PartnerStatus.Offline -> ""
                            }
                            if (statusText.isNotEmpty()) {
                                Text(statusText, style = MaterialTheme.typography.labelSmall, color = Color.White.copy(alpha = 0.9f))
                            }
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = Color.White)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = whatsappDarkGreen
                )
            )
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(whatsappBackground)
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                Box(modifier = Modifier.weight(1f)) {
                    when (state) {
                        is ChatState.Loading -> CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                        is ChatState.Success -> {
                            val messages = (state as ChatState.Success).messages
                            if (messages.isEmpty()) {
                                Text(
                                    "No messages yet. Say hi!",
                                    modifier = Modifier.align(Alignment.Center),
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = Color.Gray
                                )
                            } else {
                                val visibleMessages = messages.filter { msg ->
                                    msg.id !in hiddenMessages
                                }
                                
                                LazyColumn(
                                    modifier = Modifier.fillMaxSize(),
                                    reverseLayout = true,
                                    contentPadding = PaddingValues(16.dp)
                                ) {
                                    items(visibleMessages.reversed(), key = { it.id ?: it.created_at ?: "" }) { message ->
                                        MessageBubble(
                                            message = message, 
                                            isMe = message.sender_id == currentUserId,
                                            onLongClick = { messageToDelete = message }
                                        )
                                    }
                                }
                            }
                        }
                        is ChatState.Error -> Text(
                            (state as ChatState.Error).message,
                            modifier = Modifier.align(Alignment.Center),
                            color = MaterialTheme.colorScheme.error
                        )
                    }
                }

                Surface(
                    tonalElevation = 0.dp,
                    modifier = Modifier.fillMaxWidth().padding(8.dp),
                    color = Color.Transparent
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.Bottom
                    ) {
                        Surface(
                            modifier = Modifier
                                .weight(1f),
                            shape = RoundedCornerShape(24.dp),
                            color = Color.White,
                            shadowElevation = 1.dp
                        ) {
                            TextField(
                                value = messageText,
                                onValueChange = { messageText = it },
                                modifier = Modifier.fillMaxWidth(),
                                placeholder = { Text("Message", color = Color.Gray) },
                                colors = TextFieldDefaults.colors(
                                    focusedContainerColor = Color.Transparent,
                                    unfocusedContainerColor = Color.Transparent,
                                    focusedIndicatorColor = Color.Transparent,
                                    unfocusedIndicatorColor = Color.Transparent
                                ),
                                trailingIcon = {
                                    IconButton(onClick = { imagePickerLauncher.launch("image/*") }) {
                                        Icon(Icons.Default.AttachFile, contentDescription = "Attach", tint = Color.Gray)
                                    }
                                },
                                maxLines = 6
                            )
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        FloatingActionButton(
                            onClick = {
                                if (messageText.isNotBlank()) {
                                    viewModel.sendMessage(currentUserId, messageText)
                                    messageText = ""
                                }
                            },
                            containerColor = whatsappTealGreen,
                            contentColor = Color.White,
                            modifier = Modifier.size(48.dp),
                            shape = RoundedCornerShape(24.dp),
                            elevation = FloatingActionButtonDefaults.elevation(2.dp)
                        ) {
                            Icon(Icons.Default.Send, contentDescription = "Send", modifier = Modifier.size(20.dp).offset(x = 2.dp))
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun MessageBubble(
    message: Message, 
    isMe: Boolean,
    onLongClick: () -> Unit
) {
    val bubbleColor = if (isMe) Color(0xFFDCF8C6) else Color.White
    val tickColor = if (message.read_at != null) Color(0xFF34B7F1) else Color.Gray

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalAlignment = if (isMe) Alignment.End else Alignment.Start
    ) {
        Surface(
            color = bubbleColor,
            shape = RoundedCornerShape(
                topStart = 12.dp,
                topEnd = 12.dp,
                bottomStart = if (isMe) 12.dp else 0.dp,
                bottomEnd = if (isMe) 0.dp else 12.dp
            ),
            tonalElevation = 1.dp,
            shadowElevation = 1.dp,
            modifier = Modifier.combinedClickable(
                onClick = { /* No-op */ },
                onLongClick = onLongClick
            )
        ) {
            Box(modifier = Modifier.padding(start = 8.dp, top = 4.dp, end = 8.dp, bottom = 4.dp)) {
                Column {
                    if (!message.image_url.isNullOrEmpty()) {
                        AsyncImage(
                            model = message.image_url,
                            contentDescription = null,
                            modifier = Modifier
                                .fillMaxWidth(0.7f)
                                .heightIn(max = 240.dp)
                                .padding(bottom = 4.dp)
                                .clip(RoundedCornerShape(8.dp)),
                            contentScale = ContentScale.Crop
                        )
                    }
                    if (message.content.isNotBlank()) {
                        Text(
                            text = message.content,
                            style = MaterialTheme.typography.bodyLarge,
                            modifier = Modifier.padding(end = if (isMe) 60.dp else 40.dp, bottom = 12.dp)
                        )
                    } else {
                         // Add padding if it's only an image to prevent overlap with time
                         Spacer(modifier = Modifier.height(16.dp).width(if (isMe) 60.dp else 40.dp))
                    }
                }
                
                Row(
                    modifier = Modifier.align(Alignment.BottomEnd),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    val time = message.created_at?.substringAfter("T")?.substringBefore(".")?.substring(0, 5) ?: ""
                    Text(
                        text = time,
                        style = MaterialTheme.typography.labelSmall.copy(fontSize = 11.sp),
                        color = Color.Gray,
                    )
                    if (isMe) {
                        Spacer(modifier = Modifier.width(4.dp))
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = Icons.Default.Done,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp).offset(x = (-4).dp),
                                tint = tickColor
                            )
                            Icon(
                                imageVector = Icons.Default.Done,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp),
                                tint = tickColor
                            )
                        }
                    }
                }
            }
        }
    }
}
