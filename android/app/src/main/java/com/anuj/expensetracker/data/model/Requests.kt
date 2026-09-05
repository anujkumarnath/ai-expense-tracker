package com.anuj.expensetracker.data.model

import kotlinx.serialization.Serializable

@Serializable
data class CreateExpenseRequest(
    val amount: Double,
    val category: String? = null,
    val item: String? = null,
    val source: String? = null,
    // "YYYY-MM-DD"
    val date: String? = null,
)

@Serializable
data class UpdateExpenseRequest(
    val amount: Double? = null,
    val category: String? = null,
    val item: String? = null,
    val source: String? = null,
)

@Serializable
data class ExpenseEnvelope(
    val ok: Boolean = true,
    val expense: Expense,
)

@Serializable
data class OkResponse(
    val ok: Boolean = true,
)

@Serializable
data class ApiErrorBody(
    val error: String? = null,
    val ok: Boolean? = null,
)

@Serializable
data class GoogleAuthRequest(val idToken: String)

@Serializable
data class GoogleAuthResponse(
    val token: String,
    val email: String,
    val expiresIn: Long,
)
