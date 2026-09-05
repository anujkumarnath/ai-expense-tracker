package com.anuj.expensetracker.ui.edit

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.anuj.expensetracker.data.model.Expense
import com.anuj.expensetracker.data.model.UpdateExpenseRequest
import com.anuj.expensetracker.data.remote.ApiResult
import com.anuj.expensetracker.data.repository.ExpenseRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class EditUiState(
    val amountText: String,
    val item: String,
    val category: String,
    val source: String,
    val amountError: String? = null,
    val saveError: String? = null,
    val saving: Boolean = false,
    val saved: Boolean = false,
)

class EditExpenseViewModel(private val repository: ExpenseRepository, private val original: Expense) : ViewModel() {

    private val _uiState = MutableStateFlow(
        EditUiState(
            amountText = formatAmount(original.amount),
            item = original.item,
            category = original.category,
            source = original.source,
        ),
    )
    val uiState: StateFlow<EditUiState> = _uiState

    fun onAmountChange(v: String) { _uiState.value = _uiState.value.copy(amountText = v, amountError = null) }
    fun onItemChange(v: String) { _uiState.value = _uiState.value.copy(item = v) }
    fun onCategoryChange(v: String) { _uiState.value = _uiState.value.copy(category = v) }
    fun onSourceChange(v: String) { _uiState.value = _uiState.value.copy(source = v) }

    fun save() {
        val s = _uiState.value
        val amount = s.amountText.toDoubleOrNull()
        if (amount == null || amount <= 0) {
            _uiState.value = s.copy(amountError = "Enter a valid amount.")
            return
        }
        _uiState.value = s.copy(saving = true, saveError = null)
        viewModelScope.launch {
            val result = repository.updateExpense(
                original.id,
                UpdateExpenseRequest(amount = amount, category = s.category, item = s.item, source = s.source.ifBlank { "Other" }),
            )
            _uiState.value = when (result) {
                is ApiResult.Success -> _uiState.value.copy(saving = false, saved = true)
                is ApiResult.Error -> _uiState.value.copy(saving = false, saveError = result.message)
            }
        }
    }

    private fun formatAmount(value: Double): String =
        if (value == value.toLong().toDouble()) value.toLong().toString() else value.toString()
}
