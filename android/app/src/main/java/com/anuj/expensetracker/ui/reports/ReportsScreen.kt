package com.anuj.expensetracker.ui.reports

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.anuj.expensetracker.data.model.Expense
import com.anuj.expensetracker.data.model.Report
import com.anuj.expensetracker.data.repository.ExpenseRepository
import com.anuj.expensetracker.ui.components.DailyTrendBarChart
import com.anuj.expensetracker.ui.components.DonutChart
import com.anuj.expensetracker.ui.components.EmptyState
import com.anuj.expensetracker.ui.components.ErrorState
import com.anuj.expensetracker.ui.components.LoadingState
import com.anuj.expensetracker.ui.components.StatChip
import com.anuj.expensetracker.ui.components.TransactionRow
import com.anuj.expensetracker.ui.edit.EditExpenseSheet
import com.anuj.expensetracker.ui.edit.EditExpenseViewModel
import com.anuj.expensetracker.ui.theme.AccentSoft
import com.anuj.expensetracker.ui.theme.Spacing
import com.anuj.expensetracker.ui.theme.TextSecondary
import com.anuj.expensetracker.util.DateUtils
import com.anuj.expensetracker.util.toInr
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReportsScreen(viewModel: ReportsViewModel, repository: ExpenseRepository) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val months = remember { DateUtils.recentMonths() }
    var editTarget by remember { mutableStateOf<Expense?>(null) }
    val scope = androidx.compose.runtime.rememberCoroutineScope()

    Scaffold(
        // The outer AppRoot Scaffold (NavGraph.kt) already consumes status-bar
        // and navigation-bar insets; consuming them again here doubles the gap.
        contentWindowInsets = WindowInsets(0, 0, 0, 0),
        topBar = {
            TopAppBar(
                title = { Text("Reports") },
                windowInsets = WindowInsets(0, 0, 0, 0),
                actions = {
                    if (uiState.report != null) {
                        IconButton(onClick = { shareReport(context, uiState.report!!) }) {
                            Icon(Icons.Filled.Share, contentDescription = "Share report")
                        }
                    }
                },
            )
        },
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = Spacing.lg, vertical = Spacing.sm),
            ) {
                items(months) { month ->
                    FilterChip(
                        selected = uiState.month == month,
                        onClick = { viewModel.onMonthChange(month) },
                        label = { Text(month) },
                        colors = FilterChipDefaults.filterChipColors(selectedContainerColor = AccentSoft),
                    )
                }
            }

            when {
                uiState.loading -> LoadingState(modifier = Modifier.fillMaxSize())
                uiState.notGenerated -> Column(modifier = Modifier.fillMaxSize().padding(Spacing.xl)) {
                    EmptyState(title = "No report for ${uiState.month} yet", subtitle = "Generate one from this month's recorded expenses.")
                    Button(onClick = viewModel::generate, enabled = !uiState.generating, modifier = Modifier.fillMaxWidth().padding(top = Spacing.lg)) {
                        Text(if (uiState.generating) "Generating…" else "Generate report")
                    }
                }
                uiState.error != null -> ErrorState(uiState.error.orEmpty(), onRetry = viewModel::load, modifier = Modifier.fillMaxSize())
                uiState.report != null -> ReportContent(uiState.report!!, uiState.expenses, onEdit = { editTarget = it }, modifier = Modifier.fillMaxSize())
            }
        }
    }

    editTarget?.let { target ->
        val editViewModel = remember(target.id) { EditExpenseViewModel(repository, target) }
        EditExpenseSheet(
            viewModel = editViewModel,
            onDismiss = { editTarget = null },
            onSaved = { editTarget = null; viewModel.load() },
            onRequestDelete = {
                editTarget = null
                scope.launch {
                    repository.deleteExpense(target.id)
                    viewModel.load()
                }
            },
        )
    }
}

@Composable
private fun ReportContent(
    report: Report,
    expenses: List<Expense>,
    onEdit: (Expense) -> Unit,
    modifier: Modifier = Modifier,
) {
    LazyColumn(modifier = modifier) {
        item {
            Row(modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.lg), horizontalArrangement = Arrangement.spacedBy(Spacing.sm)) {
                StatChip("Total", report.grandTotal.toInr(), modifier = Modifier.weight(1f))
                StatChip("Transactions", report.transactionCount.toString(), modifier = Modifier.weight(1f))
                StatChip("Avg/day", report.avgPerDay.toInr(), modifier = Modifier.weight(1f))
            }
            Spacer(Modifier.height(Spacing.sm))
            Row(modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.lg), horizontalArrangement = Arrangement.spacedBy(Spacing.sm)) {
                StatChip("Top category", report.topCategory, modifier = Modifier.weight(1f))
                StatChip("Top source", report.topSource, modifier = Modifier.weight(1f))
            }
        }
        item {
            Column(modifier = Modifier.fillMaxWidth().padding(Spacing.lg)) {
                Text("Category breakdown", style = MaterialTheme.typography.titleSmall, color = TextSecondary)
                Spacer(Modifier.height(Spacing.md))
                DonutChart(report.breakdown)
            }
        }
        item {
            Column(modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.lg, vertical = Spacing.sm)) {
                Text("Daily trend", style = MaterialTheme.typography.titleSmall, color = TextSecondary)
                Spacer(Modifier.height(Spacing.md))
                DailyTrendBarChart(report.dailyTrend)
            }
        }
        item {
            Text(
                "Transactions (${expenses.size})",
                style = MaterialTheme.typography.titleSmall,
                color = TextSecondary,
                modifier = Modifier.padding(horizontal = Spacing.lg, vertical = Spacing.lg),
            )
        }
        items(expenses, key = { it.id }) { e ->
            TransactionRow(expense = e, onClick = { onEdit(e) }, onDelete = {}, swipeEnabled = false)
        }
        item { Spacer(Modifier.height(Spacing.xxl)) }
    }
}

private fun shareReport(context: android.content.Context, report: Report) {
    val text = buildString {
        appendLine("Expense Report — ${report.displayMonth}")
        appendLine()
        appendLine("Total: ${report.grandTotal.toInr()}")
        appendLine("Transactions: ${report.transactionCount}")
        appendLine("Avg/day: ${report.avgPerDay.toInr()}")
        appendLine("Top category: ${report.topCategory}")
        appendLine("Top source: ${report.topSource}")
        appendLine()
        appendLine("Category breakdown:")
        report.breakdown.sortedByDescending { it.total }.forEach {
            appendLine("  ${it.category}: ${it.total.toInr()} (${it.percentage}%)")
        }
    }
    val intent = android.content.Intent(android.content.Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(android.content.Intent.EXTRA_TEXT, text)
    }
    context.startActivity(android.content.Intent.createChooser(intent, "Share report"))
}
