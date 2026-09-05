package com.anuj.expensetracker.data.local

import android.content.Context

/**
 * Not secret — plain SharedPreferences. Remembers the last category/source
 * used so new drafts default to something more useful than "Other".
 */
class Prefs(context: Context) {
    private val sp = context.getSharedPreferences("expense_tracker_prefs", Context.MODE_PRIVATE)

    var lastCategory: String?
        get() = sp.getString(KEY_CATEGORY, null)
        set(value) { sp.edit().putString(KEY_CATEGORY, value).apply() }

    var lastSource: String?
        get() = sp.getString(KEY_SOURCE, null)
        set(value) { sp.edit().putString(KEY_SOURCE, value).apply() }

    companion object {
        private const val KEY_CATEGORY = "last_category"
        private const val KEY_SOURCE = "last_source"
    }
}
