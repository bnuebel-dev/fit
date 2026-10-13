package me.nuebel.fit.health

import android.app.Activity
import android.os.Bundle
import android.widget.TextView

/** Erklärt, wofür Fit Zugriff auf Health Connect braucht. Wird nur vom System geöffnet. */
class PermissionsRationaleActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val view = TextView(this)
        view.setPadding(48, 96, 48, 48)
        view.textSize = 16f
        view.text = "Fit schreibt beendete Trainings (Zeitraum, Titel und geschätzte aktive Kalorien) " +
            "nach Health Connect, damit andere Apps wie Oura sie lesen können. " +
            "Fit liest keine Daten aus Health Connect. Du kannst den Zugriff jederzeit in Health Connect widerrufen."
        setContentView(view)
    }
}
