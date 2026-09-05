package com.anuj.expensetracker.ui.reports

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.anuj.expensetracker.data.model.Expense
import com.anuj.expensetracker.data.model.Report
import com.anuj.expensetracker.data.remote.ApiResult
import com.anuj.expensetracker.data.repository.ExpenseRepository
import com.anuj.expensetracker.util.DateUtils
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class ReportsUiState(
    val month: String = DateUtils.currentMonthIst(),
    val loading: Boolean = true,
    val notGenerated: Boolean = false,
    val generating: Boolean = false,
    val report: Report? = null,
    val expenses: List<Expense> = emptyList(),
    val error: String? = null,
)

class ReportsViewModel(private val repository: ExpenseRepository) : ViewModel() {

    private val _uiState = MutableStateFlow(ReportsUiState())
    val uiState: StateFlow<ReportsUiState> = _uiState

    init {
        load()
    }

    fun onMonthChange(month: String) {
        _uiState.value = _uiState.value.copy(month = month)
        load()
    }

    fun load() {
        val month = _uiState.value.month
        _uiState.value = _uiState.value.copy(loading = true, notGenerated = false, error = null)
        viewModelScope.launch {
            when (val result = repository.getReport(month)) {
                is ApiResult.Success -> {
                    val expensesResult = repository.getExpenses(month = month)
                    val expenses = (expensesResult as? ApiResult.Success)?.data?.expenses.orEmpty()
                    _uiState.value = _uiState.value.copy(loading = false, report = result.data, expenses = expenses)
                }
                is ApiResult.Error -> {
                    if (result.code == 404) {
                        _uiState.value = _uiState.value.copy(loading = false, notGenerated = true, report = null)
                    } else {
                        _uiState.value = _uiState.value.copy(loading = false, error = result.message)
                    }
                }
            }
        }
    }

    fun generate() {
        val month = _uiState.value.month
        _uiState.value = _uiState.value.copy(generating = true)
        viewModelScope.launch {
            when (repository.generateReport(month)) {
                is ApiResult.Success -> load()
                is ApiResult.Error -> _uiState.value = _uiState.value.copy(generating = false, error = "Couldn't generate report.")
            }
        }
    }
}
