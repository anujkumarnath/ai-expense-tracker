package com.anuj.expensetracker.ui.home

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.anuj.expensetracker.data.local.Prefs
import com.anuj.expensetracker.data.model.Expense
import com.anuj.expensetracker.data.repository.ExpenseRepository
import com.anuj.expensetracker.ui.components.EmptyState
import com.anuj.expensetracker.ui.components.ErrorState
import com.anuj.expensetracker.ui.components.LoadingState
import com.anuj.expensetracker.ui.components.TransactionRow
import com.anuj.expensetracker.ui.edit.EditExpenseSheet
import com.anuj.expensetracker.ui.edit.EditExpenseViewModel
import com.anuj.expensetracker.ui.theme.Spacing
import com.anuj.expensetracker.ui.theme.TextFaint
import com.anuj.expensetracker.ui.theme.TextSecondary
import com.anuj.expensetracker.util.toInr

@Composable
fun HomeScreen(viewModel: HomeViewModel, repository: ExpenseRepository, prefs: Prefs) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val captureText by viewModel.captureText.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    var editTarget by remember { mutableStateOf<Expense?>(null) }
    var showAddSheet by remember { mutableStateOf(false) }

    val voiceState = rememberVoiceCaptureState { transcript ->
        viewModel.onCaptureTextChange(transcript)
        viewModel.submitCapture(transcript)
    }
    val voiceCapture = rememberVoiceCaptureLauncher(voiceState)

    LaunchedEffect(voiceState.error) {
        val message = voiceState.error ?: return@LaunchedEffect
        snackbarHostState.showSnackbar(message = message, withDismissAction = true)
        voiceState.error = null
    }

    LaunchedEffect(uiState.pendingDeleteLabel) {
        val label = uiState.pendingDeleteLabel ?: return@LaunchedEffect
        val result = snackbarHostState.showSnackbar(
            message = "Deleted “$label”",
            actionLabel = "Undo",
            withDismissAction = false,
            duration = androidx.compose.material3.SnackbarDuration.Long,
        )
        if (result == SnackbarResult.ActionPerformed) viewModel.undoDelete()
    }

    LaunchedEffect(uiState.captureMessage) {
        val message = uiState.captureMessage ?: return@LaunchedEffect
        snackbarHostState.showSnackbar(message = message, withDismissAction = true)
        viewModel.consumeCaptureMessage()
    }

    Scaffold(
        // The outer AppRoot Scaffold (NavGraph.kt) already consumes status-bar
        // and navigation-bar insets; consuming them again here doubles the gap.
        contentWindowInsets = WindowInsets(0, 0, 0, 0),
        // Scaffold places the snackbar at its own fixed bottom edge, which
        // does NOT shift with the content's imePadding() below — without
        // this, an error snackbar fires but renders invisibly behind the
        // open keyboard. This was a real, confirmed bug, not speculative.
        snackbarHost = { SnackbarHost(snackbarHostState, modifier = Modifier.imePadding()) },
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding).imePadding()) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.lg, vertical = Spacing.lg),
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Today", style = MaterialTheme.typography.labelLarge, color = TextSecondary)
                    Text(uiState.todayTotal.toInr(), style = MaterialTheme.typography.displayLarge)
                }
                IconButton(onClick = { showAddSheet = true }) {
                    Icon(Icons.Filled.Add, contentDescription = "New expense", tint = TextFaint)
                }
            }

            Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                when {
                    uiState.loading -> LoadingState(modifier = Modifier.fillMaxSize())
                    uiState.error != null && uiState.todayExpenses.isEmpty() ->
                        ErrorState(uiState.error.orEmpty(), onRetry = viewModel::refresh, modifier = Modifier.fillMaxSize())
                    uiState.todayExpenses.isEmpty() ->
                        EmptyState(
                            title = "Nothing recorded today",
                            subtitle = "Type or say what you spent below — it'll show up right here.",
                            modifier = Modifier.fillMaxSize(),
                        )
                    else -> LazyColumn(contentPadding = PaddingValues(bottom = Spacing.lg)) {
                        items(uiState.todayExpenses, key = { it.id }) { expense ->
                            TransactionRow(
                                expense = expense,
                                onClick = { editTarget = expense },
                                onDelete = { viewModel.requestDelete(expense) },
                                isNew = expense.id == uiState.newlyAddedId,
                                showDate = false,
                            )
                        }
                    }
                }
            }

            CaptureBar(
                text = captureText,
                onTextChange = viewModel::onCaptureTextChange,
                onSubmit = { viewModel.submitCapture() },
                voiceLauncher = voiceCapture,
                voiceState = voiceState,
                sending = uiState.capturing,
            )
        }
    }

    LaunchedEffect(uiState.newlyAddedId) {
        if (uiState.newlyAddedId != null) {
            kotlinx.coroutines.delay(1500)
            viewModel.consumeNewlyAdded()
        }
    }

    editTarget?.let { target ->
        val editViewModel = remember(target.id) { EditExpenseViewModel(repository, target) }
        EditExpenseSheet(
            viewModel = editViewModel,
            onDismiss = { editTarget = null },
            onSaved = { editTarget = null; viewModel.refresh() },
            onRequestDelete = { editTarget = null; viewModel.requestDelete(target) },
        )
    }

    if (showAddSheet) {
        // A fresh instance per open (matching EditExpenseViewModel's pattern
        // below) — reusing one across opens would leak the previous attempt's
        // typed values and its already-fired `created` event into the next.
        val addViewModel = remember(showAddSheet) { AddExpenseViewModel(repository, prefs) }
        AddExpenseSheet(
            viewModel = addViewModel,
            onDismiss = { showAddSheet = false },
            onSaved = { expense -> showAddSheet = false; viewModel.onManuallyAdded(expense) },
        )
    }
}
