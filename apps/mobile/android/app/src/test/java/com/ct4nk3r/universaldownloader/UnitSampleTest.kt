package com.ct4nk3r.universaldownloader

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Pure-JVM smoke test. Runs as part of `./gradlew :app:testDebugUnitTest`.
 * Exists to confirm the unit test source set, JUnit runner, and Kotlin
 * compilation for `src/test` are wired up correctly.
 */
class UnitSampleTest {

    @Test
    fun arithmeticSanity() {
        assertEquals(4, 2 + 2)
    }

    @Test
    fun packageConstantHasExpectedShape() {
        val pkg = "com.ct4nk3r.universaldownloader"
        assertTrue(pkg.startsWith("com.ct4nk3r."))
        assertEquals(3, pkg.split(".").size)
    }
}
