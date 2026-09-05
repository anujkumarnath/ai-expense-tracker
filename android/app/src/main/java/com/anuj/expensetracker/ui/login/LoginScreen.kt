package com.anuj.expensetracker.ui.login

import androidx.compose.foundation.Canvas
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
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
                contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = Spacing.xl, vertical = Spacing.md),
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

/** The four-color Google "G" mark, drawn on the required white backdrop
 * regardless of button color (Google's own button guidelines call for this
 * exact treatment) — a themed circle here is what read as a plain dark dot,
 * since the previous version put dark-on-accent text on a dark surface. */
@Composable
private fun GoogleMark() {
    Box(
        modifier = Modifier.size(20.dp).background(Color.White, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Canvas(modifier = Modifier.size(13.dp)) {
            val strokeWidth = size.minDimension * 0.24f
            val inset = strokeWidth / 2f
            val arcSize = Size(size.width - strokeWidth, size.height - strokeWidth)
            val topLeft = Offset(inset, inset)
            val style = Stroke(strokeWidth)

            drawArc(Color(0xFF4285F4), startAngle = -45f, sweepAngle = 90f, useCenter = false, topLeft = topLeft, size = arcSize, style = style)
            drawArc(Color(0xFF34A853), startAngle = 45f, sweepAngle = 90f, useCenter = false, topLeft = topLeft, size = arcSize, style = style)
            drawArc(Color(0xFFFBBC05), startAngle = 135f, sweepAngle = 80f, useCenter = false, topLeft = topLeft, size = arcSize, style = style)
            drawArc(Color(0xFFEA4335), startAngle = 215f, sweepAngle = 100f, useCenter = false, topLeft = topLeft, size = arcSize, style = style)

            // Crossbar — the stroke that turns the ring into a "G".
            drawRect(
                Color(0xFF4285F4),
                topLeft = Offset(size.width / 2f, size.height / 2f - strokeWidth / 2f),
                size = Size(size.width / 2f + inset, strokeWidth),
            )
        }
    }
}
