package com.anuj.expensetracker.ui.history

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.anuj.expensetracker.data.model.Expense
import com.anuj.expensetracker.data.remote.ApiResult
import com.anuj.expensetracker.data.repository.ExpenseRepository
import com.anuj.expensetracker.util.DateUtils
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class HistoryUiState(
    val loading: Boolean = true,
    val error: String? = null,
    val all: List<Expense> = emptyList(),
    val query: String = "",
    val category: String? = null,
    val pendingDeleteLabel: String? = null,
) {
    val filtered: List<Expense> get() = all.filter { e ->
        (category == null || e.category == category) &&
            (query.isBlank() || e.item.contains(query, ignoreCase = true) || e.category.contains(query, ignoreCase = true) || e.source.contains(query, ignoreCase = true))
    }
}

private const val UNDO_WINDOW_MS = 10000L

class HistoryViewModel(private val repository: ExpenseRepository) : ViewModel() {

    private val _uiState = MutableStateFlow(HistoryUiState())
    val uiState: StateFlow<HistoryUiState> = _uiState.asStateFlow()

    private var pendingDeleteJob: Job? = null
    private var pendingDeleteExpense: Expense? = null

    init {
        load()
    }

    fun load() {
        _uiState.value = _uiState.value.copy(loading = _uiState.value.all.isEmpty(), error = null)
        viewModelScope.launch {
            // Last 90 days is enough for a "history" surface without paging complexity.
            val from = DateUtils.shiftDaysIst(-90)
            val to = DateUtils.todayIstYmd()
            when (val result = repository.getExpenses(from = from, to = to)) {
                is ApiResult.Success -> _uiState.value = _uiState.value.copy(loading = false, all = result.data.expenses)
                is ApiResult.Error -> _uiState.value = _uiState.value.copy(loading = false, error = result.message)
            }
        }
    }

    fun onQueryChange(q: String) { _uiState.value = _uiState.value.copy(query = q) }
    fun onCategoryFilterChange(c: String?) { _uiState.value = _uiState.value.copy(category = c) }

    fun requestDelete(expense: Expense) {
        pendingDeleteJob?.let { finalizePendingDelete() }
        pendingDeleteExpense = expense
        _uiState.value = _uiState.value.copy(
            all = _uiState.value.all.filterNot { it.id == expense.id },
            pendingDeleteLabel = expense.item.ifBlank { expense.category },
        )
        pendingDeleteJob = viewModelScope.launch {
            delay(UNDO_WINDOW_MS)
            val toDelete = pendingDeleteExpense
            pendingDeleteExpense = null
            pendingDeleteJob = null
            _uiState.value = _uiState.value.copy(pendingDeleteLabel = null)
            if (toDelete != null) repository.deleteExpense(toDelete.id)
        }
    }

    fun undoDelete() {
        val expense = pendingDeleteExpense ?: return
        pendingDeleteJob?.cancel()
        pendingDeleteJob = null
        pendingDeleteExpense = null
        _uiState.value = _uiState.value.copy(
            all = (_uiState.value.all + expense).sortedByDescending { it.createdAt ?: it.date },
            pendingDeleteLabel = null,
        )
    }

    private fun finalizePendingDelete() {
        pendingDeleteJob?.cancel()
        val toDelete = pendingDeleteExpense
        pendingDeleteExpense = null
        pendingDeleteJob = null
        if (toDelete != null) viewModelScope.launch { repository.deleteExpense(toDelete.id) }
    }
}
