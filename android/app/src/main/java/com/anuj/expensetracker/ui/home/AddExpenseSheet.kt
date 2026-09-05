package com.anuj.expensetracker.ui.home

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.anuj.expensetracker.data.model.Expense
import com.anuj.expensetracker.ui.theme.Spacing

/**
 * The secondary, structured way to add an expense — reached via an explicit
 * "New expense" affordance, not shown by default. The everyday path is the
 * capture bar on Home, which saves immediately; this sheet is for the rarer
 * case of wanting to set every field precisely before it exists.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddExpenseSheet(
    viewModel: AddExpenseViewModel,
    onDismiss: () -> Unit,
    onSaved: (Expense) -> Unit,
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    LaunchedEffect(uiState.created) {
        uiState.created?.let(onSaved)
    }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState) {
        Column(modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.lg)) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(bottom = Spacing.sm),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                TextButton(onClick = onDismiss) { Text("Cancel") }
                Text("New expense", style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                if (uiState.saving) {
                    CircularProgressIndicator(modifier = Modifier.padding(horizontal = Spacing.sm).size(20.dp), strokeWidth = 2.dp)
                } else {
                    TextButton(onClick = viewModel::save) { Text("Save") }
                }
            }

            Column(modifier = Modifier.verticalScroll(rememberScrollState()).padding(bottom = Spacing.xxl)) {
                DraftFields(
                    amountText = uiState.amountText,
                    onAmountChange = viewModel::onAmountChange,
                    item = uiState.item,
                    onItemChange = viewModel::onItemChange,
                    category = uiState.category,
                    onCategoryChange = viewModel::onCategoryChange,
                    source = uiState.source,
                    onSourceChange = viewModel::onSourceChange,
                    amountError = uiState.amountError,
                )
                if (uiState.saveError != null) {
                    Text(
                        uiState.saveError.orEmpty(),
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(top = Spacing.md),
                    )
                }
            }
        }
    }
}
