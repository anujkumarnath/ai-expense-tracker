package com.anuj.expensetracker

import android.graphics.Color.TRANSPARENT
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.anuj.expensetracker.data.local.Prefs
import com.anuj.expensetracker.data.local.TokenStore
import com.anuj.expensetracker.data.remote.RetrofitClient
import com.anuj.expensetracker.data.repository.ExpenseRepository
import com.anuj.expensetracker.ui.navigation.AppRoot
import com.anuj.expensetracker.ui.theme.Bg
import com.anuj.expensetracker.ui.theme.ExpenseTrackerTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // App is always dark-themed, so system bar icons must always be light —
        // never derive style from the device's light/dark setting.
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(TRANSPARENT),
        )

        val tokenStore = TokenStore(applicationContext)
        val prefs = Prefs(applicationContext)
        val api = RetrofitClient.create(tokenStore)
        val repository = ExpenseRepository(api)

        setContent {
            ExpenseTrackerTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = Bg) {
                    AppRoot(repository = repository, tokenStore = tokenStore, prefs = prefs)
                }
            }
        }
    }
}
