package com.anuj.expensetracker.data.model

import kotlinx.serialization.Serializable

@Serializable
data class Report(
    val month: String,
    val displayMonth: String,
    val generatedAt: String,
    val breakdown: List<CategoryBreakdown> = emptyList(),
    val dailyTrend: List<DailyTrendPoint> = emptyList(),
    val grandTotal: Double,
    val transactionCount: Int,
    val avgPerDay: Double,
    val topCategory: String,
    val topSource: String,
)
