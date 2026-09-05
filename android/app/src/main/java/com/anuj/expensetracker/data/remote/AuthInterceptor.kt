package com.anuj.expensetracker.data.remote

import com.anuj.expensetracker.data.local.TokenStore
import okhttp3.Interceptor
import okhttp3.Response

class AuthInterceptor(private val tokenStore: TokenStore) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = tokenStore.getToken()
        val request = chain.request().newBuilder().apply {
            if (!token.isNullOrBlank()) {
                header("Authorization", "Bearer $token")
            }
        }.build()

        val response = chain.proceed(request)
        // Mirrors dashboard/app.js: any 401 means the stored credential is no
        // longer valid, so clear it and let the UI fall back to the login screen.
        if (response.code == 401) {
            tokenStore.clear()
        }
        return response
    }
}
