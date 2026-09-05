package com.anuj.expensetracker.ui.components

import androidx.compose.animation.core.tween
import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.Text
import androidx.compose.material3.rememberSwipeToDismissBoxState
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.anuj.expensetracker.data.model.Expense
import com.anuj.expensetracker.ui.theme.Accent
import com.anuj.expensetracker.ui.theme.ComponentSize
import com.anuj.expensetracker.ui.theme.Danger
import com.anuj.expensetracker.ui.theme.Spacing
import com.anuj.expensetracker.ui.theme.TextSecondary
import com.anuj.expensetracker.ui.theme.AmountRowStyle
import com.anuj.expensetracker.util.toInr

/**
 * The one transaction representation used everywhere (Home, History,
 * Reports) — no per-screen re-implementations. Swipe left to delete
 * (with undo handled by the caller's snackbar), tap to edit.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TransactionRow(
    expense: Expense,
    onClick: () -> Unit,
    onDelete: () -> Unit,
    modifier: Modifier = Modifier,
    isNew: Boolean = false,
    showDate: Boolean = true,
    swipeEnabled: Boolean = true,
) {
    // Swipe is deliberately withheld until a freshly-inserted row settles —
    // SwipeToDismissBox briefly reveals its background during first layout,
    // which reads as a spurious delete-icon flash on a row nobody swiped.
    var settled by remember(expense.id) { mutableStateOf(!isNew) }
    LaunchedEffect(expense.id, isNew) {
        if (isNew) {
            settled = false
            kotlinx.coroutines.delay(1200)
            settled = true
        }
    }

    if (!swipeEnabled || !settled) {
        RowContent(expense = expense, onClick = onClick, isNew = isNew && !settled, showDate = showDate, modifier = modifier)
        return
    }

    val dismissState = rememberSwipeToDismissBoxState(
        confirmValueChange = { value ->
            if (value == SwipeToDismissBoxValue.EndToStart) {
                onDelete()
                true
            } else {
                false
            }
        },
    )

    SwipeToDismissBox(
        state = dismissState,
        enableDismissFromStartToEnd = false,
        backgroundContent = {
            Box(
                modifier = Modifier.fillMaxSize().background(Danger).padding(horizontal = Spacing.xl),
                contentAlignment = Alignment.CenterEnd,
            ) {
                Icon(Icons.Default.Delete, contentDescription = "Delete", tint = Color.White)
            }
        },
        modifier = modifier,
    ) {
        RowContent(expense = expense, onClick = onClick, isNew = false, showDate = showDate)
    }
}

@Composable
private fun RowContent(expense: Expense, onClick: () -> Unit, isNew: Boolean, showDate: Boolean, modifier: Modifier = Modifier) {
    // A thin accent stripe marks "just added" — background/text colors are
    // never touched, so legibility can't regress no matter the row's content.
    val stripeAlpha by animateColorAsState(
        targetValue = if (isNew) Accent else Color.Transparent,
        animationSpec = tween(durationMillis = 500),
        label = "newStripe",
    )

    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = modifier
            .fillMaxWidth()
            .height(IntrinsicSize.Min)
            // Opaque on purpose: this row sits stacked over the swipe-to-delete
            // background, which must stay hidden until an actual swipe reveals it.
            .background(MaterialTheme.colorScheme.background)
            .clickable(onClick = onClick)
            .padding(horizontal = Spacing.lg, vertical = Spacing.md),
    ) {
        Box(
            modifier = Modifier
                .fillMaxHeight()
                .width(3.dp)
                .background(stripeAlpha),
        )
        Spacer(Modifier.width(Spacing.md - 3.dp))
        CategoryIcon(expense.category, size = ComponentSize.iconCircle)
        Spacer(Modifier.width(Spacing.md))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = expense.item.ifBlank { expense.category },
                style = MaterialTheme.typography.bodyLarge,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            val metaParts = listOfNotNull(
                expense.source.takeIf { it.isNotBlank() && it != "Other" },
                if (showDate) expense.displayDate else null,
            )
            if (metaParts.isNotEmpty()) {
                Text(
                    text = metaParts.joinToString("  ·  "),
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        Spacer(Modifier.width(Spacing.md))
        Text(
            text = expense.amount.toInr(),
            style = AmountRowStyle,
        )
    }
}
