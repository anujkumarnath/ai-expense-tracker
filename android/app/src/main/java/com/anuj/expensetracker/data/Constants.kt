package com.anuj.expensetracker.data

/** Mirrors src/constants.js — single source of truth kept in sync manually. */
object Constants {
    // Strictly validated server-side on POST/PUT /expenses — use as a fixed dropdown.
    val CATEGORIES = listOf(
        "Food", "Transport", "Shopping", "Bills", "Health", "Entertainment",
        "Groceries", "Subscriptions", "Investment", "Other",
    )

    // Only a suggestion list server-side — `source` is free-form, just needs non-empty text.
    val SOURCES = listOf(
        "Cash", "UPI", "Credit Card", "Amazon Pay", "GPay", "PhonePe", "Debit Card", "Other",
    )
}
