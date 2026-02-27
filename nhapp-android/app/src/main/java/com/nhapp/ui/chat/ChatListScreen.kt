package com.nhapp.ui.chat

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.nhapp.data.model.Chat
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.foundation.background
import androidx.compose.ui.Alignment
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Message
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatListScreen(
    viewModel: ChatListViewModel,
    onChatClick: (com.nhapp.data.model.Chat) -> Unit
) {
    val state by viewModel.state.collectAsState()
    val searchResult by viewModel.searchResult.collectAsState()
    val searchError by viewModel.searchError.collectAsState()
    var showUserSelection by remember { mutableStateOf(false) }
    var searchQuery by remember { mutableStateOf("") }
    var selectedTabIndex by remember { mutableIntStateOf(0) } // 0: Chats, 1: Status, 2: Calls
    
    val whatsappDarkGreen = Color(0xFF075E54)
    val whatsappTealGreen = Color(0xFF128C7E)
    val whatsappLightGreen = Color(0xFF25D366)

    Scaffold(
        topBar = {
            Column(modifier = Modifier.background(whatsappDarkGreen)) {
                TopAppBar(
                    title = { Text("NHAPP", fontWeight = FontWeight.Bold, color = Color.White) },
                    actions = {
                        IconButton(onClick = { /* Search action */ }) {
                            Icon(Icons.Default.Search, contentDescription = "Search", tint = Color.White)
                        }
                        val authViewModel: com.nhapp.ui.auth.AuthViewModel = androidx.lifecycle.viewmodel.compose.viewModel()
                        IconButton(onClick = { authViewModel.signOut() }) {
                            Icon(Icons.Default.MoreVert, contentDescription = "More", tint = Color.White)
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = whatsappDarkGreen,
                        titleContentColor = Color.White
                    )
                )
                
                // Interactive Tabs
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceAround
                ) {
                    Box(modifier = Modifier.weight(1f).clickable { selectedTabIndex = 0 }.padding(vertical = 12.dp), contentAlignment = Alignment.Center) {
                        TabItem("CHATS", isSelected = selectedTabIndex == 0)
                    }
                    Box(modifier = Modifier.weight(1f).clickable { selectedTabIndex = 1 }.padding(vertical = 12.dp), contentAlignment = Alignment.Center) {
                        TabItem("STATUS", isSelected = selectedTabIndex == 1)
                    }
                    Box(modifier = Modifier.weight(1f).clickable { selectedTabIndex = 2 }.padding(vertical = 12.dp), contentAlignment = Alignment.Center) {
                        TabItem("CALLS", isSelected = selectedTabIndex == 2)
                    }
                }
                
                // Tab Indicator
                Box(
                    modifier = Modifier
                        .fillMaxWidth(0.33f)
                        .offset(x = (androidx.compose.ui.platform.LocalConfiguration.current.screenWidthDp.dp / 3) * selectedTabIndex)
                        .height(3.dp)
                        .background(Color.White)
                )
            }
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { 
                    if (selectedTabIndex == 0) showUserSelection = true 
                },
                containerColor = whatsappLightGreen,
                contentColor = Color.White,
                shape = CircleShape
            ) {
                val icon = when(selectedTabIndex) {
                    0 -> Icons.Default.Message
                    1 -> Icons.Default.CameraAlt
                    else -> Icons.Default.Call
                }
                Icon(icon, contentDescription = null)
            }
        }
    ) { padding ->
        Column(modifier = Modifier.padding(padding).fillMaxSize()) {
            // Always show error if it exists - REMOVED, now handled in when statement
            // if (state is ChatListState.Error) {
            //     Text(
            //         text = (state as ChatListState.Error).message,
            //         color = MaterialTheme.colorScheme.error,
            //         style = MaterialTheme.typography.bodySmall,
            //         modifier = Modifier.padding(16.dp)
            //     )
            // }

            if (showUserSelection) {
                // ... (Search UI remains mostly unchanged but wrapped)
                Column(modifier = Modifier.padding(16.dp).weight(1f)) {
                    Text("New Chat", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, modifier = Modifier.padding(bottom = 16.dp))
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = { searchQuery = it },
                        label = { Text("Search email...") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp)
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Button(
                        onClick = { viewModel.searchUserByEmail(searchQuery) },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = whatsappTealGreen)
                    ) {
                        Text("Search")
                    }
                    
                    if (searchError != null) {
                        Text(searchError!!, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 8.dp))
                    }
                    
                    searchResult?.let { profile ->
                        Spacer(modifier = Modifier.height(16.dp))
                        ListItem(
                            leadingContent = { ProfileAvatar(profile.name, size = 50.dp) },
                            headlineContent = { Text(profile.name ?: "User", fontWeight = FontWeight.Bold) },
                            supportingContent = { Text(profile.email ?: "", color = Color.Gray) },
                            modifier = Modifier.clickable { 
                                viewModel.startChat(profile.id) { newChat ->
                                    onChatClick(newChat)
                                    showUserSelection = false
                                    viewModel.clearSearch()
                                    searchQuery = ""
                                }
                            }
                        )
                    }
                }
                TextButton(onClick = { 
                    showUserSelection = false 
                    viewModel.clearSearch()
                    searchQuery = ""
                }, modifier = Modifier.padding(16.dp)) {
                    Text("Go Back", color = whatsappTealGreen)
                }
            } else {
                when (selectedTabIndex) {
                    0 -> { // Chats Tab
                        when (state) {
                            is ChatListState.Loading -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { 
                                CircularProgressIndicator(color = whatsappTealGreen) 
                            }
                            is ChatListState.Success -> {
                                val chats = (state as ChatListState.Success).chats
                                if (chats.isEmpty()) {
                                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                        Text("No chats yet. Tap the button to start.", color = Color.Gray)
                                    }
                                } else {
                                    LazyColumn {
                                        items(chats) { chat ->
                                            ChatItem(chat, onClick = { onChatClick(chat.chat) })
                                        }
                                    }
                                }
                            }
                            is ChatListState.Error -> {
                                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                    Text((state as ChatListState.Error).message, color = Color.Red)
                                }
                            }
                        }
                    }
                    1 -> { // Status Tab Placeholder
                        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("Status", style = MaterialTheme.typography.headlineMedium, color = Color.Gray)
                                Text("This is a placeholder for your status updates.", color = Color.Gray)
                            }
                        }
                    }
                    2 -> { // Calls Tab Placeholder
                        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("Calls", style = MaterialTheme.typography.headlineMedium, color = Color.Gray)
                                Text("Call history will appear here.", color = Color.Gray)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun TabItem(label: String, isSelected: Boolean) {
    Text(
        text = label,
        color = if (isSelected) Color.White else Color.White.copy(alpha = 0.6f),
        fontWeight = FontWeight.Bold,
        fontSize = 14.sp,
        modifier = Modifier.padding(vertical = 4.dp)
    )
}

@Composable
fun ChatItem(chat: com.nhapp.data.model.ChatWithProfile, onClick: () -> Unit) {
    val name = chat.partnerProfile?.name ?: "Unknown"
    ListItem(
        leadingContent = { ProfileAvatar(name, size = 56.dp) },
        headlineContent = { 
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(name, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyLarge)
                Text("12:00", style = MaterialTheme.typography.labelSmall, color = Color.Gray)
            }
        },
        supportingContent = { 
            Text("Tap to message $name", color = Color.Gray, maxLines = 1) 
        },
        modifier = Modifier.clickable { onClick() }.padding(vertical = 4.dp)
    )
    HorizontalDivider(modifier = Modifier.padding(start = 88.dp, end = 16.dp), color = Color.LightGray.copy(alpha = 0.3f))
}

@Composable
fun ProfileAvatar(name: String?, size: androidx.compose.ui.unit.Dp = 48.dp) {
    Box(
        modifier = Modifier
            .size(size)
            .clip(CircleShape)
            .background(Color(0xFFEEEEEE)),
        contentAlignment = Alignment.Center
    ) {
        if (name != null) {
            Text(
                text = name.take(1).uppercase(),
                color = Color.Gray,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
        } else {
            Icon(Icons.Default.AccountCircle, contentDescription = null, tint = Color.LightGray, modifier = Modifier.size(size * 0.6f))
        }
    }
}
