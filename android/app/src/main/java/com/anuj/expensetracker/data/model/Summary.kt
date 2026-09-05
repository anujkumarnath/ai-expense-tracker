package com.anuj.expensetracker.data.model

import kotlinx.serialization.Serializable

@Serializable
data class CategoryBreakdown(
    val category: String,
    val total: Double,
    val count: Int,
    val percentage: Double,
)

@Serializable
data class DailyTrendPoint(
    // "DD-MM-YYYY"
    val date: String,
    val total: Double,
)

@Serializable
data class Summary(
    val grandTotal: Double,
    val transactionCount: Int,
    val avgPerDay: Double,
    val topCategory: String,
    val topSource: String,
    val breakdown: List<CategoryBreakdown> = emptyList(),
    val dailyTrend: List<DailyTrendPoint> = emptyList(),
)

@Serializable
data class DateRange(
    val start: String,
    val end: String,
)

@Serializable
data class ExpensesResponse(
    val month: String? = null,
    val displayMonth: String? = null,
    val from: String,
    val to: String,
    val days: Int,
    val range: DateRange,
    val summary: Summary,
    val expenses: List<Expense> = emptyList(),
)
