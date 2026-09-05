package com.anuj.expensetracker.ui.login

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.anuj.expensetracker.data.local.TokenStore
import com.anuj.expensetracker.data.remote.ApiResult
import com.anuj.expensetracker.data.repository.ExpenseRepository
import com.anuj.expensetracker.util.DateUtils
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class LoginUiState(
    val loading: Boolean = false,
    val error: String? = null,
)

class LoginViewModel(
    private val repository: ExpenseRepository,
    private val tokenStore: TokenStore,
) : ViewModel() {

    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState

    fun signIn(token: String) {
        val trimmed = token.trim()
        if (trimmed.isEmpty()) {
            _uiState.value = LoginUiState(error = "Token required.")
            return
        }

        _uiState.value = LoginUiState(loading = true)

        viewModelScope.launch {
            when (val result = repository.validateToken(trimmed, DateUtils.currentMonthIst())) {
                is ApiResult.Success -> {
                    tokenStore.setToken(trimmed)
                    _uiState.value = LoginUiState()
                }
                is ApiResult.Error -> {
                    val message = if (result.code == 401) "Invalid token." else result.message
                    _uiState.value = LoginUiState(error = message)
                }
            }
        }
    }

    fun signInWithGoogle(idToken: String) {
        _uiState.value = LoginUiState(loading = true)
        viewModelScope.launch {
            when (val result = repository.signInWithGoogle(idToken)) {
                is ApiResult.Success -> {
                    tokenStore.setToken(result.data.token)
                    _uiState.value = LoginUiState()
                }
                is ApiResult.Error -> _uiState.value = LoginUiState(error = result.message)
            }
        }
    }

    /** A cancelled system picker isn't an error — the user just changed
     * their mind. Return to the idle state without any message. */
    fun cancelGoogleSignIn() {
        _uiState.value = LoginUiState()
    }

    /** Credential Manager itself failed (no account, Play services issue,
     * etc.) — before any network call to our backend was even made. */
    fun onGoogleSignInFailed(message: String) {
        _uiState.value = LoginUiState(error = message)
    }
}
