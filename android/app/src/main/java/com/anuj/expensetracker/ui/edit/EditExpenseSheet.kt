package com.anuj.expensetracker.ui.edit

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import com.anuj.expensetracker.ui.home.DraftFields
import com.anuj.expensetracker.ui.theme.Danger
import com.anuj.expensetracker.ui.theme.Spacing

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditExpenseSheet(
    viewModel: EditExpenseViewModel,
    onDismiss: () -> Unit,
    onSaved: () -> Unit,
    onRequestDelete: () -> Unit,
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    LaunchedEffect(uiState.saved) {
        if (uiState.saved) onSaved()
    }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState) {
        Column(modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.lg)) {
            // Save is pinned in this top row — it is never covered by the
            // keyboard, unlike the old form where Save sat at the bottom.
            Row(
                modifier = Modifier.fillMaxWidth().padding(bottom = Spacing.sm),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                TextButton(onClick = onDismiss) { Text("Cancel") }
                Text("Edit expense", style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                IconButton(onClick = onRequestDelete) {
                    Icon(Icons.Filled.Delete, contentDescription = "Delete", tint = Danger)
                }
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
