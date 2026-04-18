import { spawn, spawnSync, ChildProcessWithoutNullStreams } from 'node:child_process';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import type { Options } from '@wdio/types';

/**
 * tauri-driver based wdio config for the Universal Downloader desktop app.
 *
 * - Windows: requires Microsoft Edge WebView2 Runtime + the matching `msedgedriver.exe`
 *   (tauri-driver proxies to it). Built binary is `universal-downloader.exe`.
 * - Linux: requires `WebKitWebDriver` (from `webkit2gtk-driver` / `webkit2gtk-4.1`).
 *   Built binary is `universal-downloader`.
 *
 * Override the platform with TAURI_PLATFORM=windows|linux. Defaults to current OS.
 */

const PLATFORM = (process.env.TAURI_PLATFORM || (process.platform === 'win32' ? 'windows' : 'linux')).toLowerCase();
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const TARGET_DIR =
  process.env.TAURI_TARGET_DIR ||
  path.join(REPO_ROOT, 'apps', 'desktop', 'src-tauri', 'target');

// Cargo binary name (see apps/desktop/src-tauri/Cargo.toml -> [package].name).
const BIN_NAME = PLATFORM === 'windows' ? 'universal-downloader.exe' : 'universal-downloader';

// Allow opting into a specific profile; default to release (what `tauri build` produces).
const PROFILE = process.env.TAURI_PROFILE || 'release';

const APP_BINARY_PATH =
  process.env.TAURI_APP_BINARY ||
  path.join(TARGET_DIR, PROFILE, BIN_NAME);

if (!fs.existsSync(APP_BINARY_PATH)) {
  // Don't hard-fail config load; just warn — CI may build before invoking wdio.
  // eslint-disable-next-line no-console
  console.warn(`[wdio.conf] App binary not found at ${APP_BINARY_PATH}. Build with \`pnpm tauri build\` first.`);
}

let tauriDriver: ChildProcessWithoutNullStreams | undefined;

function resolveTauriDriver(): string {
  if (process.env.TAURI_DRIVER_PATH) return process.env.TAURI_DRIVER_PATH;

  // Try to locate `tauri-driver` on PATH first.
  const probe = spawnSync(PLATFORM === 'windows' ? 'where' : 'which', ['tauri-driver'], {
    encoding: 'utf-8',
  });
  if (probe.status === 0 && probe.stdout.trim()) {
    return probe.stdout.split(/\r?\n/)[0]!.trim();
  }

  // Fallback to the default cargo install location.
  const cargoBin = path.join(
    os.homedir(),
    '.cargo',
    'bin',
    PLATFORM === 'windows' ? 'tauri-driver.exe' : 'tauri-driver',
  );
  return cargoBin;
}

export const config: Options.Testrunner = {
  runner: 'local',
  autoCompileOpts: {
    autoCompile: true,
    tsNodeOpts: {
      project: './tsconfig.json',
      transpileOnly: true,
    },
  },

  specs: ['./specs/**/*.e2e.ts'],
  exclude: [],

  maxInstances: 1,

  capabilities: [
    {
      maxInstances: 1,
      'tauri:options': {
        application: APP_BINARY_PATH,
      },
      // Required by webdriver, but tauri-driver ignores it.
      browserName: PLATFORM === 'windows' ? 'webview2' : 'webkit',
    } as WebdriverIO.Capabilities,
  ],

  logLevel: (process.env.WDIO_LOG_LEVEL as Options.Testrunner['logLevel']) || 'info',
  bail: 0,
  waitforTimeout: 10_000,
  connectionRetryTimeout: 120_000,
  connectionRetryCount: 3,

  // tauri-driver speaks WebDriver on 127.0.0.1:4444 by default.
  hostname: process.env.TAURI_DRIVER_HOST || '127.0.0.1',
  port: Number(process.env.TAURI_DRIVER_PORT || 4444),
  path: '/',

  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 120_000,
  },
  reporters: ['spec'],

  // Spawn tauri-driver before the WDIO session is created and kill it after.
  onPrepare() {
    const driverBin = resolveTauriDriver();
    // eslint-disable-next-line no-console
    console.log(`[wdio.conf] Spawning tauri-driver: ${driverBin} (platform=${PLATFORM})`);
    tauriDriver = spawn(driverBin, [], {
      stdio: ['ignore', 'inherit', 'inherit'],
      env: {
        ...process.env,
        // On Linux this is the path to WebKitWebDriver; on Windows to msedgedriver.
        ...(process.env.NATIVE_DRIVER_PATH
          ? { NATIVE_DRIVER_PATH: process.env.NATIVE_DRIVER_PATH }
          : {}),
      },
    });

    tauriDriver.on('error', (err) => {
      // eslint-disable-next-line no-console
      console.error('[wdio.conf] tauri-driver failed to start:', err);
    });
  },

  onComplete() {
    if (tauriDriver && !tauriDriver.killed) {
      tauriDriver.kill('SIGTERM');
    }
  },
};
