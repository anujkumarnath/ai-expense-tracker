package com.anuj.expensetracker.util

import android.content.Context
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException
import java.security.SecureRandom

sealed class GoogleSignInResult {
    data class Success(val idToken: String) : GoogleSignInResult()
    data object Cancelled : GoogleSignInResult()
    data class Failure(val message: String) : GoogleSignInResult()
}

/** Wraps Credential Manager's "Sign in with Google" flow. Returns the raw
 * Google ID token on success — the caller exchanges it for a Worker session
 * via POST /auth/google (see ExpenseRepository.signInWithGoogle). */
object GoogleAuth {
    suspend fun signIn(context: Context, webClientId: String): GoogleSignInResult {
        if (webClientId.isBlank()) {
            return GoogleSignInResult.Failure("Google sign-in isn't set up on this build yet.")
        }
        val nonce = ByteArray(16).also(SecureRandom()::nextBytes).joinToString("") { "%02x".format(it) }
        val option = GetSignInWithGoogleOption.Builder(webClientId).setNonce(nonce).build()
        val request = GetCredentialRequest.Builder().addCredentialOption(option).build()

        return try {
            val response = CredentialManager.create(context).getCredential(context, request)
            val credential = response.credential
            if (credential is CustomCredential && credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
                GoogleSignInResult.Success(GoogleIdTokenCredential.createFrom(credential.data).idToken)
            } else {
                GoogleSignInResult.Failure("Unexpected sign-in response.")
            }
        } catch (e: GetCredentialCancellationException) {
            GoogleSignInResult.Cancelled
        } catch (e: NoCredentialException) {
            GoogleSignInResult.Failure("No Google account found on this device.")
        } catch (e: GetCredentialException) {
            GoogleSignInResult.Failure(e.message ?: "Couldn't sign you in — check your connection and try again.")
        } catch (e: GoogleIdTokenParsingException) {
            GoogleSignInResult.Failure("Couldn't read the Google credential.")
        }
    }
}
