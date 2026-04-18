package com.ct4nk3r.universaldownloader

import android.content.Intent
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import org.junit.Assert.assertNotNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * End-to-end queue flow:
 *   1. Launch the app via an explicit intent.
 *   2. Use UIAutomator to paste a URL into the first editable field.
 *   3. Tap the first preset chip / button (best-effort: matches "preset" text).
 *   4. Tap the enqueue / download action.
 *
 * The test is intentionally tolerant: real RN selectors are owned by the UI
 * agent. Failures here surface as "could not find element" rather than crashes.
 */
@RunWith(AndroidJUnit4::class)
@LargeTest
class QueueFlowTest {

    private lateinit var device: UiDevice
    private val pkg = "com.ct4nk3r.universaldownloader"
    private val launchTimeoutMs = 15_000L
    private val findTimeoutMs = 10_000L
    private val sampleUrl = "https://example.com/video.mp4"

    @Before
    fun setUp() {
        device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        device.pressHome()

        val ctx = ApplicationProvider.getApplicationContext<android.content.Context>()
        val intent = ctx.packageManager.getLaunchIntentForPackage(pkg)?.apply {
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TASK)
        }
        assertNotNull("Launch intent for $pkg must exist", intent)
        ctx.startActivity(intent)

        device.wait(Until.hasObject(By.pkg(pkg).depth(0)), launchTimeoutMs)
    }

    @Test
    fun pasteUrl_selectPreset_enqueue() {
        // 1. Find the first editable text field and type the URL.
        val editable = device.wait(Until.findObject(By.clazz("android.widget.EditText")), findTimeoutMs)
        assertNotNull("Expected an EditText for URL input", editable)
        editable.text = sampleUrl

        // 2. Tap a preset chip. Tries common labels first, falls back to any
        //    clickable element containing "preset" (case-insensitive).
        val presetCandidates = listOf("Audio", "Video", "Best", "MP3", "MP4", "Default")
        var presetTapped = false
        for (label in presetCandidates) {
            val obj = device.findObject(By.text(label))
            if (obj != null && obj.isClickable) {
                obj.click()
                presetTapped = true
                break
            }
        }
        if (!presetTapped) {
            val fallback = device.findObject(By.descContains("preset"))
            fallback?.click()
        }

        // 3. Tap the enqueue / download / add button.
        val actionLabels = listOf("Enqueue", "Add", "Download", "Start", "Queue")
        var actionTapped = false
        for (label in actionLabels) {
            val btn = device.wait(Until.findObject(By.text(label)), 2_000L)
            if (btn != null) {
                btn.click()
                actionTapped = true
                break
            }
        }
        assertNotNull("No enqueue-style action button found", if (actionTapped) Any() else null)

        // 4. Best-effort verification: app is still in foreground.
        device.waitForIdle(2_000L)
        assertNotNull(device.findObject(By.pkg(pkg)))
    }
}
