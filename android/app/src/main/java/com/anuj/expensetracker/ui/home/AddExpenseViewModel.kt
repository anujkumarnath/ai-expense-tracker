package com.anuj.expensetracker.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.anuj.expensetracker.data.local.Prefs
import com.anuj.expensetracker.data.model.CreateExpenseRequest
import com.anuj.expensetracker.data.model.Expense
import com.anuj.expensetracker.data.remote.ApiResult
import com.anuj.expensetracker.data.repository.ExpenseRepository
import com.anuj.expensetracker.util.DateUtils
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class AddUiState(
    val amountText: String = "",
    val item: String = "",
    val category: String,
    val source: String,
    val amountError: String? = null,
    val saveError: String? = null,
    val saving: Boolean = false,
    val created: Expense? = null,
)

/** The manual, structured add form — a deliberately secondary path behind a
 * "New expense" affordance. The everyday path is the capture bar, which
 * saves straight away; this is for the rarer case of wanting every field
 * set precisely before it ever hits the list. */
class AddExpenseViewModel(private val repository: ExpenseRepository, private val prefs: Prefs) : ViewModel() {

    private val _uiState = MutableStateFlow(
        AddUiState(category = prefs.lastCategory ?: "Other", source = prefs.lastSource ?: ""),
    )
    val uiState: StateFlow<AddUiState> = _uiState

    fun onAmountChange(v: String) { _uiState.value = _uiState.value.copy(amountText = v, amountError = null) }
    fun onItemChange(v: String) { _uiState.value = _uiState.value.copy(item = v) }
    fun onCategoryChange(v: String) { _uiState.value = _uiState.value.copy(category = v) }
    fun onSourceChange(v: String) { _uiState.value = _uiState.value.copy(source = v) }

    fun save() {
        val s = _uiState.value
        val amount = s.amountText.toDoubleOrNull()
        if (amount == null || amount <= 0) {
            _uiState.value = s.copy(amountError = "Enter an amount to save this.")
            return
        }
        _uiState.value = s.copy(saving = true, saveError = null)
        viewModelScope.launch {
            val result = repository.createExpense(
                CreateExpenseRequest(
                    amount = amount,
                    category = s.category,
                    item = s.item,
                    source = s.source.ifBlank { "Other" },
                    date = DateUtils.todayIstYmd(),
                ),
            )
            _uiState.value = when (result) {
                is ApiResult.Success -> {
                    prefs.lastCategory = s.category
                    prefs.lastSource = s.source.ifBlank { null }
                    _uiState.value.copy(saving = false, created = result.data)
                }
                is ApiResult.Error -> _uiState.value.copy(saving = false, saveError = result.message)
            }
        }
    }
}
