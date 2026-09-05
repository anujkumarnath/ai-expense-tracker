package com.anuj.expensetracker.util

import java.util.Calendar
import java.util.TimeZone

/** IST date helpers — ports of dashboard/app.js's currentMonthIST()/istNow()/shiftDays(). */
object DateUtils {

    private val IST = TimeZone.getTimeZone("Asia/Kolkata")

    private fun istCalendar(): Calendar = Calendar.getInstance(IST)

    fun currentMonthIst(): String {
        val cal = istCalendar()
        return "%04d-%02d".format(cal.get(Calendar.YEAR), cal.get(Calendar.MONTH) + 1)
    }

    fun todayIstYmd(): String = ymdOf(istCalendar())

    fun shiftDaysIst(n: Int): String {
        val cal = istCalendar()
        cal.add(Calendar.DAY_OF_MONTH, n)
        return ymdOf(cal)
    }

    private fun ymdOf(cal: Calendar): String =
        "%04d-%02d-%02d".format(cal.get(Calendar.YEAR), cal.get(Calendar.MONTH) + 1, cal.get(Calendar.DAY_OF_MONTH))

    private fun displayDateOf(cal: Calendar): String =
        "%02d-%02d-%04d".format(cal.get(Calendar.DAY_OF_MONTH), cal.get(Calendar.MONTH) + 1, cal.get(Calendar.YEAR))

    /** "DD-MM-YYYY" — matches the server's Expense.displayDate format, for direct comparison. */
    fun todayDisplayDate(): String = displayDateOf(istCalendar())

    fun yesterdayDisplayDate(): String {
        val cal = istCalendar()
        cal.add(Calendar.DAY_OF_MONTH, -1)
        return displayDateOf(cal)
    }

    /** "DD-MM-YYYY" -> a friendly group label: Today / Yesterday / the date itself. */
    fun dayLabel(displayDate: String): String = when (displayDate) {
        todayDisplayDate() -> "Today"
        yesterdayDisplayDate() -> "Yesterday"
        else -> displayDate
    }

    /** Last 12 months (including current), newest first, as "YYYY-MM". */
    fun recentMonths(count: Int = 12): List<String> {
        val cal = istCalendar()
        return (0 until count).map {
            val label = "%04d-%02d".format(cal.get(Calendar.YEAR), cal.get(Calendar.MONTH) + 1)
            cal.add(Calendar.MONTH, -1)
            label
        }
    }
}
