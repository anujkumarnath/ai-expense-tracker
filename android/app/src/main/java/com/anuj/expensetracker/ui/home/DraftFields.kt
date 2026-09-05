package com.anuj.expensetracker.ui.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.anuj.expensetracker.data.Constants
import com.anuj.expensetracker.ui.components.CategoryIcon
import com.anuj.expensetracker.ui.theme.AccentSoft
import com.anuj.expensetracker.ui.theme.Danger
import com.anuj.expensetracker.ui.theme.Spacing
import com.anuj.expensetracker.ui.theme.TextSecondary

/**
 * The one editable field group used both for a new capture draft and for
 * editing an existing transaction — creation and editing share the same
 * surface so they feel like the same product, per the redesign brief.
 *
 * Category is chip-select only (it's a closed, server-validated set — no
 * text field, ever). Source is chips-as-shortcuts backed by free text
 * (it's genuinely open). Chips, not a dropdown menu, are what keep this
 * legible even with the numeric keyboard open: a single fixed-height row
 * never gets covered the way an expanding menu did.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DraftFields(
    amountText: String,
    onAmountChange: (String) -> Unit,
    item: String,
    onItemChange: (String) -> Unit,
    category: String,
    onCategoryChange: (String) -> Unit,
    source: String,
    onSourceChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    amountError: String? = null,
    amountFocusRequester: FocusRequester? = null,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(Spacing.lg)) {
        Column {
            OutlinedTextField(
                value = amountText,
                onValueChange = onAmountChange,
                modifier = Modifier.fillMaxWidth().let {
                    if (amountFocusRequester != null) it.focusRequester(amountFocusRequester) else it
                },
                textStyle = MaterialTheme.typography.displayMedium,
                placeholder = { Text("0", style = MaterialTheme.typography.displayMedium) },
                prefix = { Text("₹", style = MaterialTheme.typography.displayMedium) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                isError = amountError != null,
                singleLine = true,
            )
            if (amountError != null) {
                Text(amountError, color = Danger, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = Spacing.xs, start = Spacing.xs))
            }
        }

        OutlinedTextField(
            value = item,
            onValueChange = onItemChange,
            placeholder = { Text("What was it for? (optional)") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
        )

        Column {
            Text("Category", style = MaterialTheme.typography.labelLarge, color = TextSecondary, modifier = Modifier.padding(bottom = Spacing.sm))
            val categoryListState = rememberLazyListState()
            LaunchedEffect(category) {
                val index = Constants.CATEGORIES.indexOf(category)
                if (index >= 0) categoryListState.animateScrollToItem(index)
            }
            LazyRow(state = categoryListState, horizontalArrangement = Arrangement.spacedBy(Spacing.sm)) {
                items(Constants.CATEGORIES) { option ->
                    val selected = option == category
                    FilterChip(
                        selected = selected,
                        onClick = { onCategoryChange(option) },
                        label = { Text(option) },
                        leadingIcon = { CategoryIcon(option, size = 18.dp) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = AccentSoft,
                            selectedLabelColor = MaterialTheme.colorScheme.onSurface,
                        ),
                    )
                }
            }
        }

        Column {
            Text("Paid with", style = MaterialTheme.typography.labelLarge, color = TextSecondary, modifier = Modifier.padding(bottom = Spacing.sm))
            val sourceListState = rememberLazyListState()
            LaunchedEffect(source) {
                val index = Constants.SOURCES.indexOfFirst { it.equals(source, ignoreCase = true) }
                if (index >= 0) sourceListState.animateScrollToItem(index)
            }
            LazyRow(state = sourceListState, horizontalArrangement = Arrangement.spacedBy(Spacing.sm)) {
                items(Constants.SOURCES) { option ->
                    val selected = option.equals(source, ignoreCase = true)
                    FilterChip(
                        selected = selected,
                        onClick = { onSourceChange(option) },
                        label = { Text(option) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = AccentSoft,
                            selectedLabelColor = MaterialTheme.colorScheme.onSurface,
                        ),
                    )
                }
            }
            val isCustomSource = source.equals("Other", ignoreCase = true) ||
                (source.isNotBlank() && Constants.SOURCES.none { it.equals(source, ignoreCase = true) })
            if (isCustomSource) {
                OutlinedTextField(
                    value = if (source.equals("Other", ignoreCase = true)) "" else source,
                    onValueChange = onSourceChange,
                    placeholder = { Text("Custom source") },
                    modifier = Modifier.fillMaxWidth().padding(top = Spacing.sm),
                    singleLine = true,
                )
            }
        }
    }
}
