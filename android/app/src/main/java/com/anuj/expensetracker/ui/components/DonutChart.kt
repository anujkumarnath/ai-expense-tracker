package com.anuj.expensetracker.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.anuj.expensetracker.data.model.CategoryBreakdown
import com.anuj.expensetracker.ui.theme.TextSecondary
import com.anuj.expensetracker.ui.theme.categoryTint
import com.anuj.expensetracker.util.toInr

private val ChartSize = 130.dp

@Composable
fun DonutChart(breakdown: List<CategoryBreakdown>, modifier: Modifier = Modifier) {
    if (breakdown.isEmpty()) {
        Text("No spending yet", color = TextSecondary, style = MaterialTheme.typography.bodyMedium, modifier = modifier)
        return
    }

    val total = breakdown.sumOf { it.total }.takeIf { it > 0 } ?: 1.0
    val strokeWidthDp = 16.dp

    Row(modifier = modifier, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
        Canvas(modifier = Modifier.size(ChartSize)) {
            val stroke = Stroke(width = strokeWidthDp.toPx())
            val diameter = size.minDimension - stroke.width
            val topLeft = Offset((size.width - diameter) / 2f, (size.height - diameter) / 2f)
            val arcSize = Size(diameter, diameter)
            var startAngle = -90f
            breakdown.forEach { b ->
                val sweep = (b.total / total * 360.0).toFloat()
                drawArc(
                    color = categoryTint(b.category),
                    startAngle = startAngle,
                    sweepAngle = sweep,
                    useCenter = false,
                    topLeft = topLeft,
                    size = arcSize,
                    style = stroke,
                )
                startAngle += sweep
            }
        }

        Column(verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.weight(1f)) {
            breakdown.sortedByDescending { it.total }.forEach { b ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    LegendDot(categoryTint(b.category))
                    Text(
                        b.category,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.weight(1f),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(b.total.toInr(), style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

@Composable
private fun LegendDot(color: Color) {
    androidx.compose.foundation.layout.Box(
        modifier = Modifier
            .size(10.dp)
            .background(color, CircleShape),
    )
}
