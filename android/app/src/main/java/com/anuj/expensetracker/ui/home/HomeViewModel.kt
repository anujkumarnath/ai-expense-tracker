package com.anuj.expensetracker.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.anuj.expensetracker.data.Constants
import com.anuj.expensetracker.data.local.Prefs
import com.anuj.expensetracker.data.model.CreateExpenseRequest
import com.anuj.expensetracker.data.model.Expense
import com.anuj.expensetracker.data.remote.ApiResult
import com.anuj.expensetracker.data.repository.ExpenseRepository
import com.anuj.expensetracker.util.DateUtils
import com.anuj.expensetracker.util.QuickParse
import com.anuj.expensetracker.util.toInr
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class HomeUiState(
    val loading: Boolean = true,
    val error: String? = null,
    val todayExpenses: List<Expense> = emptyList(),
    val todayTotal: Double = 0.0,
    val newlyAddedId: String? = null,
    val pendingDeleteLabel: String? = null,
    val capturing: Boolean = false,
    // One-shot info messages for the capture bar's snackbar — a save
    // confirmation ("₹250 · Coffee · Food · GPay") or a capture problem
    // (couldn't find an amount, or the request failed). Never blocks;
    // the typed text is preserved on error so the user can just fix it.
    val captureMessage: String? = null,
)

private const val UNDO_WINDOW_MS = 10000L

class HomeViewModel(
    private val repository: ExpenseRepository,
    private val prefs: Prefs,
) : ViewModel() {

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    private val _captureText = MutableStateFlow("")
    val captureText: StateFlow<String> = _captureText.asStateFlow()

    private var pendingDeleteJob: Job? = null
    private var pendingDeleteExpense: Expense? = null

    init {
        refresh()
    }

    fun refresh() {
        _uiState.value = _uiState.value.copy(loading = _uiState.value.todayExpenses.isEmpty(), error = null)
        viewModelScope.launch {
            val today = DateUtils.todayIstYmd()
            when (val result = repository.getExpenses(from = today, to = today)) {
                is ApiResult.Success -> _uiState.value = _uiState.value.copy(
                    loading = false,
                    error = null,
                    todayExpenses = result.data.expenses,
                    todayTotal = result.data.summary.grandTotal,
                )
                is ApiResult.Error -> _uiState.value = _uiState.value.copy(loading = false, error = result.message)
            }
        }
    }

    fun onCaptureTextChange(text: String) {
        _captureText.value = text
    }

    /** Text -> Send, or a voice transcript -> straight to submit. Parses
     * and saves immediately — no review step. If a mistake slips through,
     * the new row is right there to tap-to-edit or swipe-to-delete. */
    fun submitCapture(rawText: String = _captureText.value) {
        if (rawText.isBlank() || _uiState.value.capturing) return
        val parsed = QuickParse.parse(
            raw = rawText,
            sources = Constants.SOURCES,
            defaultCategory = prefs.lastCategory ?: "Other",
        )
        val amount = parsed.amount
        if (amount == null || amount <= 0) {
            _uiState.value = _uiState.value.copy(
                captureMessage = "Couldn't find an amount in “$rawText” — include a number, like “250 coffee”.",
            )
            return
        }

        _uiState.value = _uiState.value.copy(capturing = true)
        viewModelScope.launch {
            val source = parsed.source.ifBlank { prefs.lastSource ?: "Other" }
            val result = repository.createExpense(
                CreateExpenseRequest(
                    amount = amount,
                    category = parsed.category,
                    item = parsed.item,
                    source = source,
                    date = DateUtils.todayIstYmd(),
                ),
            )
            when (result) {
                is ApiResult.Success -> {
                    prefs.lastCategory = parsed.category
                    prefs.lastSource = source.takeIf { it != "Other" }
                    _captureText.value = ""
                    _uiState.value = _uiState.value.copy(
                        capturing = false,
                        todayExpenses = listOf(result.data) + _uiState.value.todayExpenses,
                        todayTotal = _uiState.value.todayTotal + result.data.amount,
                        newlyAddedId = result.data.id,
                        captureMessage = confirmationText(result.data),
                    )
                }
                is ApiResult.Error -> {
                    _uiState.value = _uiState.value.copy(capturing = false, captureMessage = result.message)
                }
            }
        }
    }

    fun consumeCaptureMessage() {
        _uiState.value = _uiState.value.copy(captureMessage = null)
    }

    /** A row saved via the manual "New expense" sheet lands the same way a
     * captured one does: prepended, highlighted, total updated in place. */
    fun onManuallyAdded(expense: Expense) {
        _uiState.value = _uiState.value.copy(
            todayExpenses = listOf(expense) + _uiState.value.todayExpenses,
            todayTotal = _uiState.value.todayTotal + expense.amount,
            newlyAddedId = expense.id,
        )
    }

    fun consumeNewlyAdded() {
        _uiState.value = _uiState.value.copy(newlyAddedId = null)
    }

    /** Optimistic, reversible delete: removed from the list immediately; the
     *  actual API call only fires after the undo window passes untouched. */
    fun requestDelete(expense: Expense) {
        pendingDeleteJob?.let { finalizePendingDelete() }

        pendingDeleteExpense = expense
        _uiState.value = _uiState.value.copy(
            todayExpenses = _uiState.value.todayExpenses.filterNot { it.id == expense.id },
            todayTotal = _uiState.value.todayTotal - expense.amount,
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
            todayExpenses = (_uiState.value.todayExpenses + expense).sortedByDescending { it.createdAt ?: it.date },
            todayTotal = _uiState.value.todayTotal + expense.amount,
            pendingDeleteLabel = null,
        )
    }

    private fun finalizePendingDelete() {
        pendingDeleteJob?.cancel()
        val toDelete = pendingDeleteExpense
        pendingDeleteExpense = null
        pendingDeleteJob = null
        if (toDelete != null) {
            viewModelScope.launch { repository.deleteExpense(toDelete.id) }
        }
    }

    private fun confirmationText(expense: Expense): String {
        val parts = mutableListOf(expense.amount.toInr())
        if (expense.item.isNotBlank()) parts += expense.item
        parts += expense.category
        if (expense.source.isNotBlank() && expense.source != "Other") parts += expense.source
        return parts.joinToString(" · ")
    }
}
