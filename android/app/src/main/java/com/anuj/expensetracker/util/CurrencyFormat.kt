package com.anuj.expensetracker.util

import java.text.NumberFormat
import java.util.Locale

private val inrFormat: NumberFormat by lazy {
    NumberFormat.getInstance(Locale("en", "IN")).apply {
        maximumFractionDigits = 2
        minimumFractionDigits = 0
    }
}

/** Mirrors dashboard/app.js's inr() formatter. */
fun Double.toInr(): String = "₹" + inrFormat.format(this)
