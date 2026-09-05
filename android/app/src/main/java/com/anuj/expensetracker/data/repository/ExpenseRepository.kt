package com.anuj.expensetracker.data.repository

import com.anuj.expensetracker.data.model.ApiErrorBody
import com.anuj.expensetracker.data.model.CreateExpenseRequest
import com.anuj.expensetracker.data.model.Expense
import com.anuj.expensetracker.data.model.ExpensesResponse
import com.anuj.expensetracker.data.model.GoogleAuthRequest
import com.anuj.expensetracker.data.model.GoogleAuthResponse
import com.anuj.expensetracker.data.model.Report
import com.anuj.expensetracker.data.model.UpdateExpenseRequest
import com.anuj.expensetracker.data.remote.ApiResult
import com.anuj.expensetracker.data.remote.ExpenseTrackerApi
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import retrofit2.HttpException
import java.io.IOException

/** Single repository for the whole app — no per-feature split, matching the
 *  established "no forced layering" convention. */
class ExpenseRepository(private val api: ExpenseTrackerApi) {

    private val lenientJson = Json { ignoreUnknownKeys = true }

    suspend fun getExpenses(month: String? = null, from: String? = null, to: String? = null): ApiResult<ExpensesResponse> =
        safeCall { api.getExpenses(month = month, from = from, to = to) }

    suspend fun createExpense(request: CreateExpenseRequest): ApiResult<Expense> =
        safeCall { api.createExpense(request).expense }

    suspend fun updateExpense(id: String, request: UpdateExpenseRequest): ApiResult<Expense> =
        safeCall { api.updateExpense(id, request).expense }

    suspend fun deleteExpense(id: String): ApiResult<Unit> =
        safeCall { api.deleteExpense(id) }.let {
            when (it) {
                is ApiResult.Success -> ApiResult.Success(Unit)
                is ApiResult.Error -> it
            }
        }

    suspend fun getReport(month: String): ApiResult<Report> = safeCall { api.getReport(month) }

    suspend fun generateReport(month: String): ApiResult<Report> = safeCall { api.generateReport(month) }

    /** Returns the plain-text confirmation/warning string from /parse. */
    suspend fun parse(text: String): ApiResult<String> = safeCall {
        val body = text.toRequestBody("text/plain".toMediaType())
        api.parse(body).string()
    }

    /** Validates a candidate token BEFORE it's persisted, mirroring dashboard/app.js's
     *  tokenLogin() validation call. Uses an explicit-token request so it never touches
     *  TokenStore/AuthInterceptor — avoids the set-then-validate race that would otherwise
     *  let a cancelled in-flight validation call wrongly clear an already-confirmed token. */
    suspend fun validateToken(token: String, month: String): ApiResult<Unit> =
        when (val result = safeCall { api.getExpensesWithToken("Bearer $token", month) }) {
            is ApiResult.Success -> ApiResult.Success(Unit)
            is ApiResult.Error -> result
        }

    suspend fun signInWithGoogle(idToken: String): ApiResult<GoogleAuthResponse> =
        safeCall { api.googleAuth(GoogleAuthRequest(idToken)) }

    private suspend inline fun <T> safeCall(block: () -> T): ApiResult<T> {
        return try {
            ApiResult.Success(block())
        } catch (e: HttpException) {
            val message = e.response()?.errorBody()?.string()?.let { raw ->
                runCatching { lenientJson.decodeFromString(ApiErrorBody.serializer(), raw).error }
                    .getOrNull()
            } ?: "Request failed (${e.code()})"
            ApiResult.Error(message, e.code())
        } catch (e: IOException) {
            ApiResult.Error("Network error — check your connection.")
        } catch (e: Exception) {
            ApiResult.Error(e.message ?: "Unexpected error")
        }
    }
}
