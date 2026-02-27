package com.nhapp.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nhapp.data.repository.AuthRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class AuthState {
    object Idle : AuthState()
    object Loading : AuthState()
    object OtpSent : AuthState()
    object Success : AuthState()
    data class Error(val message: String) : AuthState()
}

class AuthViewModel(private val repository: AuthRepository = AuthRepository()) : ViewModel() {

    private val _state = MutableStateFlow<AuthState>(AuthState.Idle)
    val state = _state.asStateFlow()

    private val _email = MutableStateFlow("")
    val email = _email.asStateFlow()

    fun onEmailChange(newEmail: String) {
        _email.value = newEmail
    }

    fun requestOtp() {
        viewModelScope.launch {
            _state.value = AuthState.Loading
            repository.requestOtp(_email.value)
                .onSuccess { _state.value = AuthState.OtpSent }
                .onFailure { _state.value = AuthState.Error(it.message ?: "Failed to send OTP") }
        }
    }

    fun verifyOtp(otp: String) {
        viewModelScope.launch {
            _state.value = AuthState.Loading
            repository.verifyOtp(_email.value, otp)
                .onSuccess { _state.value = AuthState.Success }
                .onFailure { _state.value = AuthState.Error(it.message ?: "Invalid OTP") }
        }
    }

    fun signInWithPassword(password: String) {
        viewModelScope.launch {
            _state.value = AuthState.Loading
            repository.signInWithPassword(_email.value, password)
                .onSuccess { _state.value = AuthState.Success }
                .onFailure { _state.value = AuthState.Error(it.message ?: "Login failed") }
        }
    }

    fun signUpWithPassword(password: String) {
        viewModelScope.launch {
            _state.value = AuthState.Loading
            repository.signUpWithPassword(_email.value, password)
                .onSuccess { _state.value = AuthState.Success }
                .onFailure { _state.value = AuthState.Error(it.message ?: "Registration failed") }
        }
    }

    fun signOut() {
        viewModelScope.launch {
            repository.signOut()
            _state.value = AuthState.Idle
        }
    }
}
