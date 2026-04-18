package com.ct4nk3r.universaldownloader

import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Smoke test: launches MainActivity and asserts the root view is present.
 *
 * This is a minimal Espresso-style test that does not depend on any specific
 * RN UI element being mounted — it only verifies the activity comes up and the
 * decor view is attached. Heavier UI assertions live in QueueFlowTest.
 */
@RunWith(AndroidJUnit4::class)
class AppLaunchTest {

    @Test
    fun appLaunches_andRootViewIsPresent() {
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            scenario.onActivity { activity ->
                val root = activity.window?.decorView?.rootView
                assertNotNull("Root view should be attached after launch", root)
                // RN host activity should expose a non-null content view.
                val content = activity.findViewById<android.view.View>(android.R.id.content)
                assertNotNull("android.R.id.content should resolve", content)
            }
        }
    }

    @Test
    fun packageNameMatchesExpected() {
        val ctx = InstrumentationRegistry.getInstrumentation().targetContext
        assertEquals("com.ct4nk3r.universaldownloader", ctx.packageName)
        // Also verify the device is reachable (sanity, not a real assertion).
        val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        assertNotNull(device)
    }
}
