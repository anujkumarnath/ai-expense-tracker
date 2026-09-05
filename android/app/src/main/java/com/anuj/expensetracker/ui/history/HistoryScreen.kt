package com.anuj.expensetracker.ui.history

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.anuj.expensetracker.data.Constants
import com.anuj.expensetracker.data.model.Expense
import com.anuj.expensetracker.data.repository.ExpenseRepository
import com.anuj.expensetracker.ui.components.ErrorState
import com.anuj.expensetracker.ui.components.LoadingState
import com.anuj.expensetracker.ui.components.NoResultsState
import com.anuj.expensetracker.ui.components.TransactionRow
import com.anuj.expensetracker.ui.edit.EditExpenseSheet
import com.anuj.expensetracker.ui.edit.EditExpenseViewModel
import com.anuj.expensetracker.ui.theme.AccentSoft
import com.anuj.expensetracker.ui.theme.Spacing
import com.anuj.expensetracker.ui.theme.TextSecondary
import com.anuj.expensetracker.util.DateUtils

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HistoryScreen(viewModel: HistoryViewModel, repository: ExpenseRepository) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    var editTarget by remember { mutableStateOf<Expense?>(null) }

    LaunchedEffect(uiState.pendingDeleteLabel) {
        val label = uiState.pendingDeleteLabel ?: return@LaunchedEffect
        val result = snackbarHostState.showSnackbar(
            message = "Deleted “$label”",
            actionLabel = "Undo",
            duration = androidx.compose.material3.SnackbarDuration.Long,
        )
        if (result == SnackbarResult.ActionPerformed) viewModel.undoDelete()
    }

    Scaffold(
        // The outer AppRoot Scaffold (NavGraph.kt) already consumes status-bar
        // and navigation-bar insets; consuming them again here doubles the gap.
        contentWindowInsets = WindowInsets(0, 0, 0, 0),
        topBar = { TopAppBar(title = { Text("History") }, windowInsets = WindowInsets(0, 0, 0, 0)) },
        // Same fix as Home: without imePadding here, a delete-undo snackbar
        // triggered while the search keyboard is open renders behind it.
        snackbarHost = { SnackbarHost(snackbarHostState, modifier = Modifier.imePadding()) },
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            OutlinedTextField(
                value = uiState.query,
                onValueChange = viewModel::onQueryChange,
                placeholder = { Text("Search expenses") },
                leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.lg, vertical = Spacing.sm),
            )

            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
                contentPadding = PaddingValues(horizontal = Spacing.lg),
            ) {
                item {
                    FilterChip(
                        selected = uiState.category == null,
                        onClick = { viewModel.onCategoryFilterChange(null) },
                        label = { Text("All") },
                        colors = FilterChipDefaults.filterChipColors(selectedContainerColor = AccentSoft),
                    )
                }
                items(Constants.CATEGORIES) { cat ->
                    FilterChip(
                        selected = uiState.category == cat,
                        onClick = { viewModel.onCategoryFilterChange(if (uiState.category == cat) null else cat) },
                        label = { Text(cat) },
                        colors = FilterChipDefaults.filterChipColors(selectedContainerColor = AccentSoft),
                    )
                }
            }

            Box(modifier = Modifier.weight(1f).fillMaxWidth().padding(top = Spacing.sm)) {
                val filtered = uiState.filtered
                when {
                    uiState.loading -> LoadingState(modifier = Modifier.fillMaxSize())
                    uiState.error != null && uiState.all.isEmpty() ->
                        ErrorState(uiState.error.orEmpty(), onRetry = viewModel::load, modifier = Modifier.fillMaxSize())
                    filtered.isEmpty() -> NoResultsState(modifier = Modifier.fillMaxSize())
                    else -> {
                        val grouped = filtered.groupBy { it.displayDate }
                        LazyColumn(contentPadding = PaddingValues(bottom = Spacing.xl)) {
                            grouped.forEach { (day, expenses) ->
                                item(key = "header-$day") {
                                    Text(
                                        text = DateUtils.dayLabel(day),
                                        style = MaterialTheme.typography.labelLarge,
                                        color = TextSecondary,
                                        modifier = Modifier.padding(horizontal = Spacing.lg, vertical = Spacing.sm),
                                    )
                                }
                                items(expenses, key = { it.id }) { expense ->
                                    TransactionRow(
                                        expense = expense,
                                        onClick = { editTarget = expense },
                                        onDelete = { viewModel.requestDelete(expense) },
                                        showDate = false,
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    editTarget?.let { target ->
        val editViewModel = remember(target.id) { EditExpenseViewModel(repository, target) }
        EditExpenseSheet(
            viewModel = editViewModel,
            onDismiss = { editTarget = null },
            onSaved = { editTarget = null; viewModel.load() },
            onRequestDelete = { editTarget = null; viewModel.requestDelete(target) },
        )
    }
}
