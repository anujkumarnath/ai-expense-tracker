package com.anuj.expensetracker.ui.navigation

import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Home
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.anuj.expensetracker.data.local.Prefs
import com.anuj.expensetracker.data.local.TokenStore
import com.anuj.expensetracker.data.repository.ExpenseRepository
import com.anuj.expensetracker.ui.account.AccountScreen
import com.anuj.expensetracker.ui.history.HistoryScreen
import com.anuj.expensetracker.ui.history.HistoryViewModel
import com.anuj.expensetracker.ui.home.HomeScreen
import com.anuj.expensetracker.ui.home.HomeViewModel
import com.anuj.expensetracker.ui.login.LoginScreen
import com.anuj.expensetracker.ui.login.LoginViewModel
import com.anuj.expensetracker.ui.reports.ReportsScreen
import com.anuj.expensetracker.ui.reports.ReportsViewModel

private data class Tab(val route: String, val label: String, val icon: androidx.compose.ui.graphics.vector.ImageVector)

private val tabs = listOf(
    Tab(Routes.HOME, "Home", Icons.Filled.Home),
    Tab(Routes.HISTORY, "History", Icons.Filled.History),
    Tab(Routes.REPORTS, "Reports", Icons.Filled.BarChart),
    Tab(Routes.ACCOUNT, "Account", Icons.Filled.AccountCircle),
)

@Composable
fun AppRoot(repository: ExpenseRepository, tokenStore: TokenStore, prefs: Prefs) {
    val isLoggedIn by tokenStore.isLoggedIn.collectAsStateWithLifecycle()

    if (!isLoggedIn) {
        val viewModel: LoginViewModel = viewModel(factory = viewModelFactory {
            initializer { LoginViewModel(repository, tokenStore) }
        })
        LoginScreen(viewModel)
        return
    }

    val navController = rememberNavController()

    Scaffold(
        bottomBar = {
            val backStackEntry by navController.currentBackStackEntryAsState()
            val currentRoute = backStackEntry?.destination
            NavigationBar {
                tabs.forEach { tab ->
                    NavigationBarItem(
                        selected = currentRoute?.hierarchy?.any { it.route == tab.route } == true,
                        onClick = {
                            navController.navigate(tab.route) {
                                popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(tab.icon, contentDescription = tab.label) },
                        label = { Text(tab.label) },
                    )
                }
            }
        },
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = Routes.HOME,
            // consumeWindowInsets tells descendants (e.g. HomeScreen's imePadding())
            // that this bottom space is already reserved for the tab bar, so the
            // keyboard only adds however much it exceeds that — no stacked gap.
            modifier = Modifier.padding(padding).consumeWindowInsets(padding),
        ) {
            composable(Routes.HOME) {
                val viewModel: HomeViewModel = viewModel(factory = viewModelFactory {
                    initializer { HomeViewModel(repository, prefs) }
                })
                HomeScreen(viewModel = viewModel, repository = repository, prefs = prefs)
            }
            composable(Routes.HISTORY) {
                val viewModel: HistoryViewModel = viewModel(factory = viewModelFactory {
                    initializer { HistoryViewModel(repository) }
                })
                HistoryScreen(viewModel = viewModel, repository = repository)
            }
            composable(Routes.REPORTS) {
                val viewModel: ReportsViewModel = viewModel(factory = viewModelFactory {
                    initializer { ReportsViewModel(repository) }
                })
                ReportsScreen(viewModel = viewModel, repository = repository)
            }
            composable(Routes.ACCOUNT) {
                AccountScreen(repository = repository, tokenStore = tokenStore, onLogout = { tokenStore.clear() })
            }
        }
    }
}
