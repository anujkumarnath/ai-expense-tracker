package com.anuj.expensetracker.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class SplitInfo(
    val totalBill: Double = 0.0,
    val myItems: List<String> = emptyList(),
    val sharedItems: List<String> = emptyList(),
    val splitWith: Int = 0,
    val myShare: Double = 0.0,
)

@Serializable
data class Expense(
    @SerialName("_id") val id: String,
    // ISO instant, IST-midnight but serialized as UTC — do NOT use for display.
    val date: String,
    // "DD-MM-YYYY" — always use this for display.
    val displayDate: String,
    val amount: Double,
    val category: String,
    val item: String = "",
    val source: String,
    val currency: String = "INR",
    val createdAt: String? = null,
    val updatedAt: String? = null,
    val splitInfo: SplitInfo? = null,
)
