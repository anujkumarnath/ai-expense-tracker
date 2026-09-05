package com.anuj.expensetracker.ui.home

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import com.anuj.expensetracker.ui.theme.Accent
import com.anuj.expensetracker.ui.theme.AccentOn
import com.anuj.expensetracker.ui.theme.AccentSoft
import com.anuj.expensetracker.ui.theme.Border
import com.anuj.expensetracker.ui.theme.ComponentSize
import com.anuj.expensetracker.ui.theme.Radius
import com.anuj.expensetracker.ui.theme.Spacing
import com.anuj.expensetracker.ui.theme.Surface
import com.anuj.expensetracker.ui.theme.TextFaint
import com.anuj.expensetracker.ui.theme.TextSecondary

@Composable
fun CaptureBar(
    text: String,
    onTextChange: (String) -> Unit,
    onSubmit: () -> Unit,
    voiceLauncher: VoiceCaptureLauncher,
    voiceState: VoiceCaptureState,
    modifier: Modifier = Modifier,
    sending: Boolean = false,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(Surface)
            .padding(horizontal = Spacing.lg, vertical = Spacing.sm),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
    ) {
        // The mic is one continuous composable across idle <-> listening —
        // swapping it out mid-gesture would cancel the press. Press to
        // record, release to stop and submit, exactly like a chat app's
        // voice message button.
        VoiceMicButton(voiceLauncher = voiceLauncher, voiceState = voiceState, enabled = !sending)

        if (voiceState.isListening) {
            Text(
                "Listening… release to send",
                style = MaterialTheme.typography.bodyLarge,
                color = TextSecondary,
                modifier = Modifier.weight(1f),
            )
        } else {
            OutlinedTextField(
                value = text,
                onValueChange = onTextChange,
                enabled = !sending,
                modifier = Modifier.weight(1f),
                placeholder = { Text("250 coffee, gpay…") },
                singleLine = true,
                shape = RoundedCornerShape(Radius.pill),
                colors = OutlinedTextFieldDefaults.colors(
                    unfocusedBorderColor = Border,
                    focusedBorderColor = Accent,
                ),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = { if (text.isNotBlank()) onSubmit() }),
            )
        }

        val active = text.isNotBlank() && !sending && !voiceState.isListening
        IconButton(
            onClick = { if (active) onSubmit() },
            enabled = active,
            modifier = Modifier
                .size(ComponentSize.touchTarget)
                .background(if (active || sending) Accent else Border, CircleShape),
        ) {
            if (sending) {
                CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp, color = AccentOn)
            } else {
                Icon(Icons.Filled.ArrowUpward, contentDescription = "Save expense", tint = if (active) AccentOn else TextFaint)
            }
        }
    }
}

/** Press to start listening, release to stop — recording lasts exactly as
 * long as the finger is down, same interaction shape as a voice message. */
@Composable
private fun VoiceMicButton(voiceLauncher: VoiceCaptureLauncher, voiceState: VoiceCaptureState, enabled: Boolean) {
    val pulse by animateFloatAsState(
        targetValue = 1f + voiceState.level * 0.6f,
        animationSpec = tween(durationMillis = 120),
        label = "micPulse",
    )

    Box(
        modifier = Modifier
            .size(ComponentSize.touchTarget)
            .pointerInput(enabled) {
                if (!enabled) return@pointerInput
                detectTapGestures(
                    onPress = {
                        voiceLauncher.start()
                        tryAwaitRelease()
                        voiceState.stop()
                    },
                )
            },
        contentAlignment = Alignment.Center,
    ) {
        if (voiceState.isListening) {
            Box(
                modifier = Modifier
                    .size(ComponentSize.touchTarget * pulse.coerceAtMost(1.5f))
                    .background(AccentSoft, CircleShape),
            )
        }
        Icon(
            Icons.Filled.Mic,
            contentDescription = if (voiceState.isListening) "Recording — release to send" else "Hold to record",
            tint = if (voiceState.isListening) Accent else TextFaint,
        )
    }
}
