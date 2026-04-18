# Mobile (Android) Tests — J2.5

Test suites for the React Native Android host app
(`com.ct4nk3r.universaldownloader`, `MainActivity`).

## Layout

```
apps/mobile/android/app/src/
├── androidTest/java/com/ct4nk3r/universaldownloader/
│   ├── AppLaunchTest.kt      # Espresso/ActivityScenario launch + root view
│   ├── QueueFlowTest.kt      # UIAutomator: paste URL → preset → enqueue
│   └── IntentShareTest.kt    # ACTION_SEND text/plain handling
└── test/java/com/ct4nk3r/universaldownloader/
    └── UnitSampleTest.kt     # Pure-JVM smoke
```

## Running

From `apps/mobile/android/`:

```bash
# Pure JVM unit tests (fast, no device required)
./gradlew :app:testDebugUnitTest

# Instrumented tests (requires connected emulator / device with USB debugging)
./gradlew :app:connectedDebugAndroidTest

# Single test class
./gradlew :app:connectedDebugAndroidTest \
    -Pandroid.testInstrumentationRunnerArguments.class=com.ct4nk3r.universaldownloader.AppLaunchTest

# Single test method
./gradlew :app:connectedDebugAndroidTest \
    -Pandroid.testInstrumentationRunnerArguments.class=com.ct4nk3r.universaldownloader.AppLaunchTest#appLaunches_andRootViewIsPresent
```

Reports land in:
- `apps/mobile/android/app/build/reports/tests/testDebugUnitTest/index.html`
- `apps/mobile/android/app/build/reports/androidTests/connected/index.html`

## Required gradle additions

The current `apps/mobile/android/app/build.gradle` does **not** declare a test
runner or any test dependencies. The following must be added (do **not** edit
performed by this agent — listed here for the build/owner agent):

### 1. `android { defaultConfig { … } }`
```groovy
testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
```

### 2. `android { … }` (so test sources compile against Kotlin 1.8 JVM target)
```groovy
testOptions {
    unitTests {
        includeAndroidResources = true
    }
}
```

### 3. `dependencies { … }`
```groovy
// JVM unit tests (src/test)
testImplementation "junit:junit:4.13.2"

// Instrumented tests (src/androidTest)
androidTestImplementation "androidx.test.ext:junit:1.2.1"
androidTestImplementation "androidx.test:runner:1.6.2"
androidTestImplementation "androidx.test:rules:1.6.1"
androidTestImplementation "androidx.test:core:1.6.1"
androidTestImplementation "androidx.test:core-ktx:1.6.1"
androidTestImplementation "androidx.test.espresso:espresso-core:3.6.1"
androidTestImplementation "androidx.test.espresso:espresso-intents:3.6.1"
androidTestImplementation "androidx.test.uiautomator:uiautomator:2.3.0"
```

Versions track the AndroidX Test BOM as of this writing; pin to whatever the
rest of the monorepo uses if there's a shared `versions.gradle`.

## Notes / known limitations

- `QueueFlowTest` uses heuristic UIAutomator selectors (text "Audio", "Video",
  "Enqueue", …). Once the UI agent adds stable
  `accessibilityLabel` / `testID` props on the RN side, these should be replaced
  with `By.res(pkg, "<id>")` lookups against the resource-id mirrors that RN
  emits for `testID`.
- `IntentShareTest.firingShareIntent_bringsAppToForeground` requires the device
  to be unlocked. In CI use `adb shell input keyevent 82` after boot, or run on
  an emulator started with `-no-snapshot -no-boot-anim`.
- No Compose / Espresso view-matcher assertions are wired up — the RN host
  exposes a single `ReactRootView`, so view-tree matchers add little value
  beyond what `ActivityScenario` already covers.
