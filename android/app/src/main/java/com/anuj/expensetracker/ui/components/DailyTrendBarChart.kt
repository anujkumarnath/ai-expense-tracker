package com.anuj.expensetracker.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.anuj.expensetracker.data.model.DailyTrendPoint
import com.anuj.expensetracker.ui.theme.Accent
import com.anuj.expensetracker.ui.theme.Border
import com.anuj.expensetracker.ui.theme.TextSecondary

@Composable
fun DailyTrendBarChart(points: List<DailyTrendPoint>, modifier: Modifier = Modifier) {
    if (points.isEmpty()) {
        Text("No data for this range", color = TextSecondary, style = MaterialTheme.typography.bodyMedium, modifier = modifier)
        return
    }

    val textMeasurer = rememberTextMeasurer()
    val labelStyle = MaterialTheme.typography.labelSmall.copy(fontSize = 9.sp, color = TextSecondary)
    val max = (points.maxOfOrNull { it.total } ?: 0.0).takeIf { it > 0 } ?: 1.0

    Column(modifier = modifier.fillMaxWidth()) {
        Canvas(modifier = Modifier.fillMaxWidth().height(160.dp)) {
            val gridColor = Border
            val chartHeight = size.height - 20.dp.toPx()
            // gridlines
            for (i in 0..3) {
                val y = chartHeight * i / 3
                drawLine(color = gridColor, start = Offset(0f, y), end = Offset(size.width, y), strokeWidth = 1f)
            }

            val barCount = points.size
            val gap = 4.dp.toPx()
            val barWidth = ((size.width - gap * (barCount - 1)) / barCount).coerceAtLeast(2f)

            points.forEachIndexed { i, p ->
                val barHeight = (p.total / max * chartHeight).toFloat().coerceAtLeast(1f)
                val x = i * (barWidth + gap)
                drawRoundRect(
                    color = Accent,
                    topLeft = Offset(x, chartHeight - barHeight),
                    size = Size(barWidth, barHeight),
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(3.dp.toPx(), 3.dp.toPx()),
                )

                if (barCount <= 15 || i % (barCount / 10 + 1) == 0) {
                    val label = p.date.take(5) // DD-MM
                    val layout = textMeasurer.measure(label, labelStyle)
                    drawText(
                        textLayoutResult = layout,
                        topLeft = Offset(x + barWidth / 2 - layout.size.width / 2, chartHeight + 4.dp.toPx()),
                    )
                }
            }
        }
    }
}
