package com.ct4nk3r.universaldownloader

import android.content.Intent
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Exposes share-sheet / VIEW intent URLs to JS.
 *
 * JS API (see `apps/mobile/src/native/SharedUrlModule.ts`):
 *  - getInitialUrl(): Promise<string|null>
 *  - addUrlListener(cb), removeUrlListener(cb) — via NativeEventEmitter
 *    on the `SharedUrl` event.
 */
class SharedUrlModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  init {
    instance = this
    // Drain any URL captured before the JS bridge was ready.
    pendingInitial?.let { /* keep — getInitialUrl() will return it */ }
  }

  override fun getName(): String = NAME

  @ReactMethod
  fun getInitialUrl(promise: Promise) {
    promise.resolve(pendingInitial)
  }

  // Required by NativeEventEmitter on iOS/Android RN >= 0.65.
  @ReactMethod fun addListener(eventName: String) { /* no-op */ }

  @ReactMethod fun removeListeners(count: Int) { /* no-op */ }

  private fun emit(url: String) {
    val ctx = reactApplicationContext ?: return
    if (!ctx.hasActiveReactInstance()) {
      pendingInitial = url
      return
    }
    val payload = Arguments.createMap().apply { putString("url", url) }
    ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(EVENT, payload)
  }

  companion object {
    const val NAME = "SharedUrlModule"
    const val EVENT = "SharedUrl"
    private const val SCHEME = "universal-downloader"

    @Volatile private var instance: SharedUrlModule? = null
    @Volatile private var pendingInitial: String? = null

    /**
     * Called from MainActivity for both the launch intent and any
     * subsequent onNewIntent. Extracts a URL and either buffers it (if
     * RN isn't up yet) or emits the `SharedUrl` event.
     */
    fun handleIntent(intent: Intent) {
      val url = extractUrl(intent) ?: return
      val mod = instance
      if (mod == null) {
        pendingInitial = url
      } else {
        // Always update the buffered initial URL too so cold launches
        // through onCreate -> bridge ready see it via getInitialUrl().
        pendingInitial = url
        mod.emit(url)
      }
    }

    private fun extractUrl(intent: Intent): String? {
      // 1. ACTION_SEND of text/plain (typical share sheet)
      if (Intent.ACTION_SEND == intent.action && intent.type?.startsWith("text/") == true) {
        val text = intent.getStringExtra(Intent.EXTRA_TEXT)?.trim()
        if (!text.isNullOrEmpty()) {
          // Prefer the first URL substring if the text contains one.
          val match = Regex("""https?://\S+""").find(text)
          return match?.value ?: text
        }
      }
      // 2. ACTION_VIEW with our custom scheme: universal-downloader://share?url=…
      if (Intent.ACTION_VIEW == intent.action) {
        val data = intent.data ?: return null
        if (data.scheme == SCHEME) {
          val raw = data.getQueryParameter("url")
          if (!raw.isNullOrEmpty()) return raw
          return data.toString()
        }
        // Plain http(s) VIEW also accepted.
        if (data.scheme == "http" || data.scheme == "https") return data.toString()
      }
      return null
    }
  }
}
