package com.ct4nk3r.universaldownloader

import android.content.Intent
import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

/**
 * Main React Native activity. Forwards inbound share/view intents to
 * [SharedUrlModule] so the JS layer's `useSharedUrl` hook can pick up
 * the URL.
 */
class MainActivity : ReactActivity() {

  override fun getMainComponentName(): String = "UniversalDownloader"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
    DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    // Buffer the launching intent so getInitialUrl() can return it.
    intent?.let { SharedUrlModule.handleIntent(it) }
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    SharedUrlModule.handleIntent(intent)
  }
}
