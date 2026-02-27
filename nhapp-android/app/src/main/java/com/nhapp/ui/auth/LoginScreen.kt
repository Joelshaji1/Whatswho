package com.nhapp.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreen(
    viewModel: AuthViewModel = viewModel(),
    onLoginSuccess: () -> Unit
) {
    val state by viewModel.state.collectAsState()
    val email by viewModel.email.collectAsState()
    var otp by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var showPasswordLogin by remember { mutableStateOf(true) }
    var isSignUp by remember { mutableStateOf(false) }

    val whatsappDarkGreen = Color(0xFF075E54)
    val whatsappLightBackground = Color.White

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(whatsappLightBackground)
    ) {
        // WhatsApp Header
        Surface(
            color = whatsappDarkGreen,
            modifier = Modifier.fillMaxWidth().height(60.dp),
            shadowElevation = 4.dp
        ) {
            Box(contentAlignment = Alignment.Center) {
                Text(
                    text = "Welcome to NHAPP",
                    color = Color.White,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Medium
                )
            }
        }

        Spacer(modifier = Modifier.height(32.dp))

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = if (isSignUp) "Create your account" else "Verify your account",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = Color.Black
            )
            
            Spacer(modifier = Modifier.height(16.dp))
            
            Text(
                text = "WhatsApp will send an SMS message (carrier charges may apply) to verify your phone number. Enter your email and password below.",
                fontSize = 14.sp,
                color = Color.Gray,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(32.dp))

            when (state) {
                is AuthState.Idle, is AuthState.Error -> {
                    OutlinedTextField(
                        value = email,
                        onValueChange = { viewModel.onEmailChange(it) },
                        label = { Text("Email address") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = whatsappDarkGreen,
                            focusedLabelColor = whatsappDarkGreen
                        )
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    if (showPasswordLogin) {
                        OutlinedTextField(
                            value = password,
                            onValueChange = { password = it },
                            label = { Text("Password") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true,
                            visualTransformation = PasswordVisualTransformation(),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = whatsappDarkGreen,
                                focusedLabelColor = whatsappDarkGreen
                            )
                        )
                        Spacer(modifier = Modifier.height(24.dp))
                        Button(
                            onClick = { 
                                if (isSignUp) viewModel.signUpWithPassword(password)
                                else viewModel.signInWithPassword(password)
                            },
                            modifier = Modifier.fillMaxWidth().height(50.dp),
                            shape = RoundedCornerShape(25.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = whatsappDarkGreen)
                        ) {
                            Text(if (isSignUp) "Sign Up" else "Log In", fontSize = 16.sp, fontWeight = FontWeight.Bold)
                        }
                        Spacer(modifier = Modifier.height(16.dp))
                        TextButton(onClick = { isSignUp = !isSignUp }) {
                            Text(
                                if (isSignUp) "Already have an account? Log In" 
                                else "New user? Create an account", 
                                color = whatsappDarkGreen
                            )
                        }
                        TextButton(onClick = { showPasswordLogin = false }) {
                            Text("Use OTP instead", color = whatsappDarkGreen)
                        }
                    } else {
                        Button(
                            onClick = { viewModel.requestOtp() },
                            modifier = Modifier.fillMaxWidth().height(50.dp),
                            shape = RoundedCornerShape(25.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = whatsappDarkGreen)
                        ) {
                            Text("Next", fontSize = 16.sp, fontWeight = FontWeight.Bold)
                        }
                        Spacer(modifier = Modifier.height(16.dp))
                        TextButton(onClick = { showPasswordLogin = true }) {
                            Text("Login with Password", color = whatsappDarkGreen)
                        }
                    }
                    
                    if (state is AuthState.Error) {
                        Text(
                            text = (state as AuthState.Error).message,
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.padding(top = 16.dp)
                        )
                    }
                }
                is AuthState.Loading -> {
                    Spacer(modifier = Modifier.height(32.dp))
                    CircularProgressIndicator(color = whatsappDarkGreen)
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("Connecting...", color = Color.Gray)
                }
                is AuthState.OtpSent -> {
                    Text("OTP sent to $email", color = Color.Gray)
                    Spacer(modifier = Modifier.height(16.dp))
                    OutlinedTextField(
                        value = otp,
                        onValueChange = { otp = it },
                        label = { Text("Enter 6-digit code") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = whatsappDarkGreen,
                            focusedLabelColor = whatsappDarkGreen
                        )
                    )
                    Spacer(modifier = Modifier.height(24.dp))
                    Button(
                        onClick = { viewModel.verifyOtp(otp) },
                        modifier = Modifier.fillMaxWidth().height(50.dp),
                        shape = RoundedCornerShape(25.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = whatsappDarkGreen)
                    ) {
                        Text("Verify Code", fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    }
                }
                is AuthState.Success -> {
                    LaunchedEffect(Unit) {
                        onLoginSuccess()
                    }
                }
            }
        }
    }
}
