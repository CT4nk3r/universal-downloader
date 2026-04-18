package com.ct4nk3r.universaldownloader

import android.content.Intent
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.MediumTest
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Verifies the app declares an ACTION_SEND text/plain intent-filter and that
 * firing such an intent actually launches MainActivity (rather than being
 * rejected or routed elsewhere).
 */
@RunWith(AndroidJUnit4::class)
@MediumTest
class IntentShareTest {

    private val pkg = "com.ct4nk3r.universaldownloader"
    private val sharedUrl = "https://example.com/shared.mp4"
    private val launchTimeoutMs = 15_000L

    @Test
    fun manifestResolvesActionSendForPlainText() {
        val ctx = ApplicationProvider.getApplicationContext<android.content.Context>()
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, sharedUrl)
            setPackage(pkg)
        }
        val resolved = ctx.packageManager.queryIntentActivities(intent, 0)
        assertTrue(
            "Expected at least one activity in $pkg to handle ACTION_SEND text/plain",
            resolved.any { it.activityInfo.packageName == pkg }
        )
        // The first match should be MainActivity.
        val first = resolved.first { it.activityInfo.packageName == pkg }
        assertEquals("MainActivity should handle the share", "$pkg.MainActivity", first.activityInfo.name)
    }

    @Test
    fun firingShareIntent_bringsAppToForeground() {
        val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        device.pressHome()

        val ctx = ApplicationProvider.getApplicationContext<android.content.Context>()
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, sharedUrl)
            setPackage(pkg)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        ctx.startActivity(intent)

        val launched = device.wait(Until.hasObject(By.pkg(pkg).depth(0)), launchTimeoutMs)
        assertTrue("App $pkg did not come to foreground after share intent", launched)
        assertNotNull(device.findObject(By.pkg(pkg)))
    }
}
