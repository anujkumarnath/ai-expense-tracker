package com.anuj.expensetracker.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DirectionsCar
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.LocalGroceryStore
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material.icons.filled.Receipt
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.filled.ShoppingBag
import androidx.compose.material.icons.filled.Subscriptions
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material.icons.outlined.Category
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.anuj.expensetracker.ui.theme.categoryTint
import com.anuj.expensetracker.ui.theme.categoryTintSoft

private fun iconFor(category: String): ImageVector = when (category) {
    "Food" -> Icons.Filled.Restaurant
    "Transport" -> Icons.Filled.DirectionsCar
    "Shopping" -> Icons.Filled.ShoppingBag
    "Bills" -> Icons.Filled.Receipt
    "Health" -> Icons.Filled.Favorite
    "Entertainment" -> Icons.Filled.Movie
    "Groceries" -> Icons.Filled.LocalGroceryStore
    "Subscriptions" -> Icons.Filled.Subscriptions
    "Investment" -> Icons.Filled.TrendingUp
    else -> Icons.Outlined.Category
}

/**
 * The category signal: a shape (icon) first, a whisper of tinted color second.
 * Never a solid saturated pill — color alone never carries the meaning.
 */
@Composable
fun CategoryIcon(category: String, size: androidx.compose.ui.unit.Dp = 36.dp, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .size(size)
            .background(categoryTintSoft(category), CircleShape),
    ) {
        Icon(
            imageVector = iconFor(category),
            contentDescription = category,
            tint = categoryTint(category),
            modifier = Modifier.size(size * 0.52f).align(androidx.compose.ui.Alignment.Center),
        )
    }
}
