package com.anuj.expensetracker.ui.account

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.anuj.expensetracker.data.local.TokenStore
import com.anuj.expensetracker.data.remote.ApiResult
import com.anuj.expensetracker.data.repository.ExpenseRepository
import com.anuj.expensetracker.ui.theme.Accent
import com.anuj.expensetracker.ui.theme.Danger
import com.anuj.expensetracker.ui.theme.Radius
import com.anuj.expensetracker.ui.theme.Spacing
import com.anuj.expensetracker.ui.theme.Surface
import com.anuj.expensetracker.ui.theme.TextSecondary
import com.anuj.expensetracker.util.DateUtils
import kotlinx.coroutines.launch

private sealed class SyncStatus {
    object Unknown : SyncStatus()
    object Checking : SyncStatus()
    object Ok : SyncStatus()
    object Failed : SyncStatus()
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AccountScreen(repository: ExpenseRepository, tokenStore: TokenStore, onLogout: () -> Unit) {
    val scope = rememberCoroutineScope()
    var status by remember { mutableStateOf<SyncStatus>(SyncStatus.Unknown) }
    val maskedToken = remember {
        val token = tokenStore.getToken().orEmpty()
        if (token.length <= 8) "········" else token.take(4) + "····" + token.takeLast(4)
    }

    Scaffold(
        // The outer AppRoot Scaffold (NavGraph.kt) already consumes status-bar
        // and navigation-bar insets; consuming them again here doubles the gap.
        contentWindowInsets = WindowInsets(0, 0, 0, 0),
        topBar = { TopAppBar(title = { Text("Account") }, windowInsets = WindowInsets(0, 0, 0, 0)) },
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding).padding(Spacing.lg), verticalArrangement = Arrangement.spacedBy(Spacing.xl)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth().background(Surface, RoundedCornerShape(Radius.md)).padding(Spacing.lg),
            ) {
                androidx.compose.foundation.layout.Box(
                    modifier = Modifier.size(48.dp).background(Accent, CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Text("A", color = MaterialTheme.colorScheme.onPrimary, style = MaterialTheme.typography.titleLarge)
                }
                Column(modifier = Modifier.padding(start = Spacing.md)) {
                    Text("This device", style = MaterialTheme.typography.titleMedium)
                    Text("Token $maskedToken", style = MaterialTheme.typography.bodySmall, color = TextSecondary)
                }
            }

            Column {
                Text("Sync", style = MaterialTheme.typography.labelLarge, color = TextSecondary, modifier = Modifier.padding(bottom = Spacing.sm))
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth().background(Surface, RoundedCornerShape(Radius.md)).padding(Spacing.lg),
                ) {
                    when (status) {
                        SyncStatus.Checking -> CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                        SyncStatus.Ok -> Icon(Icons.Filled.CheckCircle, contentDescription = null, tint = Accent)
                        SyncStatus.Failed -> Icon(Icons.Filled.ErrorOutline, contentDescription = null, tint = Danger)
                        SyncStatus.Unknown -> Icon(Icons.Filled.Sync, contentDescription = null, tint = TextSecondary)
                    }
                    Column(modifier = Modifier.padding(start = Spacing.md).weight(1f)) {
                        Text(
                            when (status) {
                                SyncStatus.Checking -> "Checking…"
                                SyncStatus.Ok -> "Connected"
                                SyncStatus.Failed -> "Can't reach the server"
                                SyncStatus.Unknown -> "Not checked yet"
                            },
                            style = MaterialTheme.typography.bodyLarge,
                        )
                    }
                    OutlinedButton(onClick = {
                        status = SyncStatus.Checking
                        scope.launch {
                            val result = repository.getExpenses(month = DateUtils.currentMonthIst())
                            status = if (result is ApiResult.Success) SyncStatus.Ok else SyncStatus.Failed
                        }
                    }) { Text("Check") }
                }
            }

            androidx.compose.foundation.layout.Spacer(modifier = Modifier.weight(1f))

            Button(
                onClick = onLogout,
                modifier = Modifier.fillMaxWidth(),
                colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = Surface, contentColor = Danger),
            ) { Text("Log out") }
        }
    }
}

