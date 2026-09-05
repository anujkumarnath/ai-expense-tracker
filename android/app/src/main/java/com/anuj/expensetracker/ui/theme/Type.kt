package com.anuj.expensetracker.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

// Roboto (Android's system face) rather than a bundled webfont: it is the
// idiomatic native choice, has excellent tabular-figure rendering (this is
// an amount-first app — digits lining up matters more than typographic
// novelty), and adds no APK weight or font-loading complexity. The token
// system is the explicit type SCALE below, not the typeface itself.

val AppTypography = Typography().let { base ->
    base.copy(
        // The number the whole app is built around — today's total, the
        // draft amount. Large, bold, tabular.
        displayLarge = base.displayLarge.copy(fontWeight = FontWeight.Bold, fontSize = 44.sp, letterSpacing = (-0.5).sp),
        displayMedium = base.displayMedium.copy(fontWeight = FontWeight.Bold, fontSize = 34.sp, letterSpacing = (-0.3).sp),
        headlineSmall = base.headlineSmall.copy(fontWeight = FontWeight.SemiBold),
        titleLarge = base.titleLarge.copy(fontWeight = FontWeight.SemiBold),
        titleMedium = base.titleMedium.copy(fontWeight = FontWeight.SemiBold),
        titleSmall = base.titleSmall.copy(fontWeight = FontWeight.SemiBold, letterSpacing = 0.2.sp),
        bodyLarge = base.bodyLarge.copy(fontSize = 16.sp),
        bodyMedium = base.bodyMedium.copy(fontSize = 14.sp),
        labelLarge = base.labelLarge.copy(fontWeight = FontWeight.SemiBold),
        labelSmall = base.labelSmall.copy(letterSpacing = 0.4.sp, fontWeight = FontWeight.Medium),
    )
}

/** Amount style used in transaction rows — one shared definition, not per-screen. */
val AmountRowStyle = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 16.sp, letterSpacing = (-0.1).sp)
