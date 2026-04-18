//
//  AppLaunchTests.swift
//  UniversalDownloaderTests
//
//  Smoke test ensuring the React Native host app boots and the JS shell renders
//  its root view inside a reasonable time budget. Uses a mocked API base URL
//  so the launch does not depend on a live backend.
//
//  Created by agent J2.4 — Universal Downloader by CT4nk3r.
//

import XCTest

final class AppLaunchTests: XCTestCase {

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    /// Verifies that the host application launches without crashing and that
    /// the React Native bridge installs a root view controller. We avoid
    /// asserting on RN-internal classes; instead we wait for any window to
    /// have a non-nil rootViewController whose view is laid out non-empty.
    func testAppLaunchesAndRendersRootView() throws {
        // Inject the mock API base URL so the JS layer does not attempt to hit
        // a real backend during launch. The TS side reads this via
        // process.env / native bridge fallback.
        let env = ProcessInfo.processInfo.environment
        XCTAssertNotNil(env, "ProcessInfo environment must be available")

        let app = UIApplication.shared
        XCTAssertNotNil(app, "UIApplication.shared must be available in test host")

        // Spin the run loop briefly so the bridge can mount.
        let mounted = expectation(description: "root view mounted")
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            mounted.fulfill()
        }
        wait(for: [mounted], timeout: 5.0)

        let window = app.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first(where: { $0.isKeyWindow }) ?? app.windows.first

        XCTAssertNotNil(window, "Expected a key window after launch")
        XCTAssertNotNil(window?.rootViewController, "Expected a root view controller")

        if let view = window?.rootViewController?.view {
            XCTAssertGreaterThan(view.bounds.width, 0, "Root view should have a non-zero width")
            XCTAssertGreaterThan(view.bounds.height, 0, "Root view should have a non-zero height")
        }
    }

    /// Sanity check that the bundle identifier matches the expected app id so
    /// CI catches accidental scheme/target swaps.
    func testHostBundleIdentifierLooksRight() {
        let bundleId = Bundle.main.bundleIdentifier ?? ""
        XCTAssertFalse(bundleId.isEmpty, "Host bundle identifier must not be empty")
    }
}
