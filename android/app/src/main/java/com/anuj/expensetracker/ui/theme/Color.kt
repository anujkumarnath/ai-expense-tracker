package com.anuj.expensetracker.ui.theme

import androidx.compose.ui.graphics.Color

// A new palette, deliberately distinct from the old GitHub-dark-inspired one.
// Warm-neutral graphite rather than blue-black, one confident accent instead
// of a generic blue, and category color pulled far back — icons carry the
// distinguishing signal now, color is a whisper behind them.

val Bg = Color(0xFF131311)
val Surface = Color(0xFF1D1C19)
val SurfaceVariant = Color(0xFF201F1B)
val SurfaceRaised = Color(0xFF262520)
val Border = Color(0xFF34322B)
val BorderFaint = Color(0xFF24231F)

val TextPrimary = Color(0xFFF2F0E9)
val TextSecondary = Color(0xFFA6A399)
val TextFaint = Color(0xFF6E6C62)

val Accent = Color(0xFF2FA98C)
val AccentOn = Color(0xFF06231C)
val AccentSoft = Color(0x242FA98C)
val AccentSoftStrong = Color(0x402FA98C)

val Danger = Color(0xFFE2604F)
val DangerSoft = Color(0x1FE2604F)
val Warning = Color(0xFFD9A441)
val WarningSoft = Color(0x1FD9A441)

// Ten muted category tints (backgrounds only, at low alpha) + the icon that
// carries the real signal. See CategoryIcon.kt.
private val CategoryTints = mapOf(
    "Food" to Color(0xFFE2604F),
    "Transport" to Color(0xFF4E8FD1),
    "Shopping" to Color(0xFFB07CC6),
    "Bills" to Color(0xFFD9A441),
    "Health" to Color(0xFF5FB37C),
    "Entertainment" to Color(0xFFD1618F),
    "Groceries" to Color(0xFF3FAFA6),
    "Subscriptions" to Color(0xFF8C82D6),
    "Investment" to Color(0xFF2FA98C),
    "Other" to Color(0xFF8A8778),
)

fun categoryTint(category: String): Color = CategoryTints[category] ?: CategoryTints.getValue("Other")
fun categoryTintSoft(category: String): Color = categoryTint(category).copy(alpha = 0.14f)
