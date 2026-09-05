package com.anuj.expensetracker.ui.home

import android.content.Intent
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import java.util.Locale

/** In-app voice capture state — no system speech-recognition popup, no
 * separate Activity. Recognition runs against Android's speech service in
 * the background while this screen renders its own "Listening…" UI, the
 * same way WhatsApp records a voice message without leaving the chat. */
class VoiceCaptureState internal constructor(private val recognizer: SpeechRecognizer, private val intent: Intent) {
    var isListening by mutableStateOf(false)
        internal set
    var level by mutableFloatStateOf(0f) // 0f..1f, drives the pulse animation
        internal set
    var error by mutableStateOf<String?>(null)
        internal set

    // cancel() itself triggers RecognitionListener.onError() on many Android
    // versions (typically ERROR_CLIENT) — without this, tapping the user's
    // own Cancel button would incorrectly show a "couldn't hear you" message.
    internal var suppressNextError = false

    fun start() {
        error = null
        recognizer.startListening(intent)
    }

    fun stop() {
        recognizer.stopListening()
    }

    fun cancel() {
        suppressNextError = true
        recognizer.cancel()
        isListening = false
        level = 0f
    }
}

@Composable
fun rememberVoiceCaptureState(onResult: (String) -> Unit): VoiceCaptureState {
    val context = LocalContext.current

    val recognizer = remember { SpeechRecognizer.createSpeechRecognizer(context) }
    val intent = remember {
        Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale("en", "IN").toString())
        }
    }
    val state = remember { VoiceCaptureState(recognizer, intent) }

    DisposableEffect(recognizer) {
        recognizer.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: android.os.Bundle?) { state.isListening = true }
            override fun onBeginningOfSpeech() { state.isListening = true }
            override fun onRmsChanged(rmsdB: Float) {
                // Roughly normalize the typical -2..10 range SpeechRecognizer emits.
                state.level = ((rmsdB + 2f) / 12f).coerceIn(0f, 1f)
            }
            override fun onBufferReceived(buffer: ByteArray?) {}
            override fun onEndOfSpeech() { state.isListening = false; state.level = 0f }
            override fun onError(error: Int) {
                state.isListening = false
                state.level = 0f
                val suppress = state.suppressNextError
                state.suppressNextError = false
                // NO_MATCH / SPEECH_TIMEOUT are just "heard nothing useful" — not
                // failures worth surfacing as an error message. A user-initiated
                // cancel() is suppressed too — that's not a failure either.
                if (!suppress && error != SpeechRecognizer.ERROR_NO_MATCH && error != SpeechRecognizer.ERROR_SPEECH_TIMEOUT) {
                    state.error = "Couldn't hear that — try again."
                }
            }
            override fun onResults(results: android.os.Bundle?) {
                state.isListening = false
                state.level = 0f
                val transcript = results
                    ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    ?.firstOrNull()
                if (!transcript.isNullOrBlank()) onResult(transcript)
            }
            override fun onPartialResults(partialResults: android.os.Bundle?) {}
            override fun onEvent(eventType: Int, params: android.os.Bundle?) {}
        })
        onDispose { recognizer.destroy() }
    }

    return state
}

/** Handles the RECORD_AUDIO permission dance, then hands back a launcher
 * that starts in-app listening (or the permission prompt first). */
@Composable
fun rememberVoiceCaptureLauncher(voiceState: VoiceCaptureState): VoiceCaptureLauncher {
    val context = LocalContext.current
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) voiceState.start()
    }
    return remember {
        VoiceCaptureLauncher {
            val hasPermission = androidx.core.content.ContextCompat.checkSelfPermission(
                context,
                android.Manifest.permission.RECORD_AUDIO,
            ) == android.content.pm.PackageManager.PERMISSION_GRANTED

            if (hasPermission) {
                voiceState.start()
            } else {
                permissionLauncher.launch(android.Manifest.permission.RECORD_AUDIO)
            }
        }
    }
}

class VoiceCaptureLauncher(private val launch: () -> Unit) {
    fun start() = launch()
}
