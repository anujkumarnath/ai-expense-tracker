package com.anuj.expensetracker.util

/**
 * Client-side heuristic parser for capture input ("250 coffee gpay",
 * "spent 250 on coffee using GPay", or just "250"). Produces an editable
 * DRAFT — nothing is saved until the user confirms it. This is what makes
 * pre-save review possible at all: the backend's /parse endpoint commits
 * directly and returns plain text, so it can't back a review step. This
 * heuristic trades some of the server LLM's linguistic range for a capture
 * flow that never touches the network until Save, and is honest about the
 * amount it actually found rather than guessing at zero.
 */
data class ParsedDraft(
    val amount: Double?,
    val item: String,
    val category: String,
    val source: String,
)

object QuickParse {

    private val categoryKeywords: Map<String, List<String>> = linkedMapOf(
        "Food" to listOf("coffee", "tea", "chai", "lunch", "dinner", "breakfast", "snack", "restaurant", "food", "pizza", "burger", "zomato", "swiggy", "cafe"),
        "Transport" to listOf("uber", "ola", "cab", "taxi", "petrol", "diesel", "fuel", "metro", "bus", "train", "auto", "parking", "toll"),
        "Shopping" to listOf("amazon", "flipkart", "myntra", "shopping", "clothes", "shoes", "electronics"),
        "Bills" to listOf("bill", "electricity", "water bill", "rent", "wifi", "broadband", "recharge", "emi", "insurance"),
        "Health" to listOf("doctor", "medicine", "pharmacy", "hospital", "gym", "medical"),
        "Entertainment" to listOf("movie", "netflix", "spotify", "concert", "cinema", "prime video"),
        "Groceries" to listOf("grocery", "groceries", "supermarket", "vegetables", "milk", "bigbasket", "blinkit", "zepto"),
        "Subscriptions" to listOf("subscription", "membership"),
        "Investment" to listOf("sip", "mutual fund", "stocks", "stock", "gold", " fd ", "deposit", "investment", "ppf", "nps"),
    )

    private val sourceAliases: Map<String, String> = linkedMapOf(
        "google pay" to "GPay", "gpay" to "GPay",
        "phonepe" to "PhonePe",
        "upi" to "UPI",
        "cash" to "Cash",
        "credit card" to "Credit Card",
        "debit card" to "Debit Card",
        "amazon pay" to "Amazon Pay",
        "card" to "Credit Card",
    )

    private val fillerWords = setOf(
        "spent", "spend", "paid", "pay", "for", "on", "using", "with", "via",
        "rs", "rs.", "inr", "the", "a", "an", "to", "of", "towards", "bought",
    )

    private val amountRegex = Regex("""(?:₹|rs\.?|inr)?\s*(\d+(?:[.,]\d{1,2})?)""", RegexOption.IGNORE_CASE)

    fun parse(raw: String, sources: List<String>, defaultCategory: String): ParsedDraft {
        val text = raw.trim()
        val lower = text.lowercase()

        val match = amountRegex.find(text)
        val amount = match?.groupValues?.get(1)?.replace(",", "")?.toDoubleOrNull()

        var foundSource: String? = null
        for ((alias, canonical) in sourceAliases) {
            if (lower.contains(alias)) { foundSource = canonical; break }
        }
        if (foundSource == null) {
            foundSource = sources.firstOrNull { lower.contains(it.lowercase()) }
        }

        var foundCategory: String? = null
        for ((cat, keywords) in categoryKeywords) {
            if (keywords.any { lower.contains(it) }) { foundCategory = cat; break }
        }

        var remaining = if (match != null) text.replaceRange(match.range, " ") else text
        val strippedTokens = (sourceAliases.keys + (foundSource?.lowercase()?.let { listOf(it) } ?: emptyList())).toSet()
        val item = remaining
            .split(Regex("\\s+"))
            .filter { it.isNotBlank() }
            .filterNot { word ->
                val w = word.lowercase().trim(',', '.', '!', '?')
                w.isBlank() || w in fillerWords || strippedTokens.any { w == it }
            }
            .joinToString(" ")
            .trim()
            .replaceFirstChar { it.uppercase() }

        return ParsedDraft(
            amount = amount,
            item = item,
            category = foundCategory ?: defaultCategory,
            source = foundSource.orEmpty(),
        )
    }
}
