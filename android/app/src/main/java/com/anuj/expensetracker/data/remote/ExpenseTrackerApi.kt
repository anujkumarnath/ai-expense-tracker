package com.anuj.expensetracker.data.remote

import com.anuj.expensetracker.data.model.CreateExpenseRequest
import com.anuj.expensetracker.data.model.ExpenseEnvelope
import com.anuj.expensetracker.data.model.ExpensesResponse
import com.anuj.expensetracker.data.model.GoogleAuthRequest
import com.anuj.expensetracker.data.model.GoogleAuthResponse
import com.anuj.expensetracker.data.model.OkResponse
import com.anuj.expensetracker.data.model.Report
import com.anuj.expensetracker.data.model.UpdateExpenseRequest
import okhttp3.RequestBody
import okhttp3.ResponseBody
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.Headers
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

interface ExpenseTrackerApi {

    @GET("expenses")
    suspend fun getExpenses(
        @Query("month") month: String? = null,
        @Query("from") from: String? = null,
        @Query("to") to: String? = null,
    ): ExpensesResponse

    // Explicit-token variant used only to validate a candidate token on the login
    // screen, before it's persisted — bypasses AuthInterceptor's stored token.
    @GET("expenses")
    suspend fun getExpensesWithToken(
        @Header("Authorization") authorization: String,
        @Query("month") month: String,
    ): ExpensesResponse

    @POST("expenses")
    suspend fun createExpense(@Body body: CreateExpenseRequest): ExpenseEnvelope

    @PUT("expenses/{id}")
    suspend fun updateExpense(@Path("id") id: String, @Body body: UpdateExpenseRequest): ExpenseEnvelope

    @DELETE("expenses/{id}")
    suspend fun deleteExpense(@Path("id") id: String): OkResponse

    @GET("reports/{month}")
    suspend fun getReport(@Path("month") month: String): Report

    @POST("reports/{month}")
    suspend fun generateReport(@Path("month") month: String): Report

    // /parse is plain text both ways — bypass the JSON converter entirely.
    @POST("parse")
    @Headers("Content-Type: text/plain")
    suspend fun parse(@Body text: RequestBody): ResponseBody

    @GET("health")
    suspend fun health(@Query("check") check: String? = null): ResponseBody

    // Public: exchanges a verified Google ID token for a Worker session token,
    // used by AuthInterceptor exactly like the static bearer token.
    @POST("auth/google")
    suspend fun googleAuth(@Body body: GoogleAuthRequest): GoogleAuthResponse
}
