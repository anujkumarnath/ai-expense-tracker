package com.anuj.expensetracker.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.ReceiptLong
import androidx.compose.material.icons.filled.SearchOff
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.anuj.expensetracker.ui.theme.Danger
import com.anuj.expensetracker.ui.theme.DangerSoft
import com.anuj.expensetracker.ui.theme.Spacing
import com.anuj.expensetracker.ui.theme.SurfaceVariant
import com.anuj.expensetracker.ui.theme.TextFaint
import com.anuj.expensetracker.ui.theme.TextSecondary

@Composable
fun LoadingState(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.fillMaxWidth().padding(Spacing.xxxl),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.md),
    ) {
        CircularProgressIndicator(modifier = Modifier.size(28.dp), strokeWidth = 2.5.dp)
    }
}

/** Genuinely nothing recorded yet — distinct icon and tone from "no results". */
@Composable
fun EmptyState(
    title: String,
    subtitle: String? = null,
    modifier: Modifier = Modifier,
) = StateScaffold(icon = Icons.Filled.ReceiptLong, iconTint = TextFaint, title = title, subtitle = subtitle, modifier = modifier)

/** A filter/search produced zero results — distinct from a truly empty list. */
@Composable
fun NoResultsState(subtitle: String? = "Try a different search or filter.", modifier: Modifier = Modifier) =
    StateScaffold(icon = Icons.Filled.SearchOff, iconTint = TextFaint, title = "No matches", subtitle = subtitle, modifier = modifier)

/** Network/server failure — distinct red tone + a retry action. */
@Composable
fun ErrorState(message: String, onRetry: (() -> Unit)? = null, modifier: Modifier = Modifier) {
    StateScaffold(
        icon = Icons.Filled.WifiOff,
        iconTint = Danger,
        iconBg = DangerSoft,
        title = "Something went wrong",
        subtitle = message,
        modifier = modifier,
    ) {
        if (onRetry != null) {
            Button(onClick = onRetry) { Text("Retry") }
        }
    }
}

/** No network at all. */
@Composable
fun OfflineState(onRetry: (() -> Unit)? = null, modifier: Modifier = Modifier) {
    StateScaffold(
        icon = Icons.Filled.CloudOff,
        iconTint = Danger,
        iconBg = DangerSoft,
        title = "You're offline",
        subtitle = "Check your connection and try again.",
        modifier = modifier,
    ) {
        if (onRetry != null) {
            Button(onClick = onRetry) { Text("Retry") }
        }
    }
}

@Composable
private fun StateScaffold(
    icon: ImageVector,
    title: String,
    subtitle: String?,
    modifier: Modifier = Modifier,
    iconTint: androidx.compose.ui.graphics.Color = TextFaint,
    iconBg: androidx.compose.ui.graphics.Color = SurfaceVariant,
    action: @Composable (() -> Unit)? = null,
) {
    Column(
        modifier = modifier.fillMaxWidth().padding(Spacing.xxxl),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.sm),
    ) {
        Box(
            modifier = Modifier.size(56.dp).background(iconBg, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = null, tint = iconTint, modifier = Modifier.size(26.dp))
        }
        Text(title, style = MaterialTheme.typography.titleMedium, textAlign = TextAlign.Center)
        if (subtitle != null) {
            Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = TextSecondary, textAlign = TextAlign.Center)
        }
        if (action != null) {
            Box(modifier = Modifier.padding(top = Spacing.sm)) { action() }
        }
    }
}
