package com.anuj.expensetracker.ui.login

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.anuj.expensetracker.BuildConfig
import com.anuj.expensetracker.ui.theme.Accent
import com.anuj.expensetracker.ui.theme.AccentOn
import com.anuj.expensetracker.ui.theme.AccentSoft
import com.anuj.expensetracker.ui.theme.Danger
import com.anuj.expensetracker.ui.theme.Spacing
import com.anuj.expensetracker.ui.theme.TextFaint
import com.anuj.expensetracker.ui.theme.TextSecondary
import com.anuj.expensetracker.util.GoogleAuth
import com.anuj.expensetracker.util.GoogleSignInResult
import kotlinx.coroutines.launch

@Composable
fun LoginScreen(viewModel: LoginViewModel) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var showTokenFallback by remember { mutableStateOf(false) }

    fun startGoogleSignIn() {
        scope.launch {
            when (val result = GoogleAuth.signIn(context, BuildConfig.GOOGLE_WEB_CLIENT_ID)) {
                is GoogleSignInResult.Success -> viewModel.signInWithGoogle(result.idToken)
                is GoogleSignInResult.Cancelled -> viewModel.cancelGoogleSignIn()
                is GoogleSignInResult.Failure -> viewModel.onGoogleSignInFailed(result.message)
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize().padding(Spacing.xl), contentAlignment = Alignment.Center) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(
                modifier = Modifier.size(64.dp).background(AccentSoft, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Filled.AccountBalanceWallet, contentDescription = null, tint = Accent, modifier = Modifier.size(30.dp))
            }
            Text(
                "Expense Tracker",
                style = MaterialTheme.typography.headlineSmall,
                modifier = Modifier.padding(top = Spacing.lg),
            )
            Text(
                "Track what you spend, fast. Sign in to sync your expenses across devices.",
                style = MaterialTheme.typography.bodyMedium,
                color = TextSecondary,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = Spacing.xs, bottom = Spacing.xxl),
            )

            Button(
                onClick = ::startGoogleSignIn,
                enabled = !uiState.loading,
                colors = ButtonDefaults.buttonColors(containerColor = Accent, contentColor = AccentOn),
                modifier = Modifier.fillMaxWidth(),
            ) {
                if (uiState.loading) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp, color = AccentOn)
                } else {
                    GoogleMark()
                    Text("Continue with Google", modifier = Modifier.padding(start = Spacing.sm))
                }
            }

            if (uiState.error != null) {
                Text(
                    uiState.error.orEmpty(),
                    color = Danger,
                    style = MaterialTheme.typography.bodySmall,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = Spacing.md),
                )
            }

            // Temporary fallback while Google sign-in is being rolled out —
            // not part of the intended long-term surface. See
            // GOOGLE_SIGNIN_UX_SPEC.md.
            TextButton(onClick = { showTokenFallback = !showTokenFallback }, modifier = Modifier.padding(top = Spacing.xl)) {
                Text("Use an access token instead", color = TextFaint, style = MaterialTheme.typography.bodySmall)
            }
            if (showTokenFallback) {
                TokenFallback(loading = uiState.loading, onSignIn = viewModel::signIn)
            }
        }
    }
}

@Composable
private fun TokenFallback(loading: Boolean, onSignIn: (String) -> Unit) {
    var token by remember { mutableStateOf("") }
    Column(modifier = Modifier.fillMaxWidth().padding(top = Spacing.md), horizontalAlignment = Alignment.CenterHorizontally) {
        OutlinedTextField(
            value = token,
            onValueChange = { token = it },
            label = { Text("Access token") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth(),
        )
        TextButton(onClick = { onSignIn(token) }, enabled = !loading, modifier = Modifier.padding(top = Spacing.sm)) {
            Text("Sign in with token")
        }
    }
}

/** A minimal "G" mark — avoids bundling Google's branded asset while still
 * reading unambiguously as the Google button. */
@Composable
private fun GoogleMark() {
    Box(
        modifier = Modifier.size(18.dp).background(MaterialTheme.colorScheme.surface, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            "G",
            style = MaterialTheme.typography.labelLarge,
            color = AccentOn,
        )
    }
}
