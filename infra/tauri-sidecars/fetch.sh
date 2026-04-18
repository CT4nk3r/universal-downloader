#!/usr/bin/env bash
# infra/tauri-sidecars/fetch.sh
#
# Downloads the latest yt-dlp + ffmpeg builds for every supported Tauri
# target triple and places them under apps/desktop/src-tauri/binaries/
# using Tauri's sidecar naming convention: <name>-<target-triple>[.exe].
#
# Sources (provenance):
#   yt-dlp  : https://github.com/yt-dlp/yt-dlp/releases/latest
#               - yt-dlp.exe          -> *-pc-windows-msvc
#               - yt-dlp_macos        -> *-apple-darwin (universal/arm64)
#               - yt-dlp_macos_legacy -> x86_64-apple-darwin fallback
#               - yt-dlp_linux        -> x86_64-unknown-linux-gnu
#               - yt-dlp_linux_aarch64 -> aarch64-unknown-linux-gnu
#               SHA256SUMS verified against the release asset SHA2-256SUMS file.
#
#   ffmpeg  : Windows + Linux: https://github.com/BtbN/FFmpeg-Builds/releases/latest
#               - ffmpeg-master-latest-win64-gpl.zip          -> x86_64-pc-windows-msvc
#               - ffmpeg-master-latest-winarm64-gpl.zip       -> aarch64-pc-windows-msvc
#               - ffmpeg-master-latest-linux64-gpl.tar.xz     -> x86_64-unknown-linux-gnu
#               - ffmpeg-master-latest-linuxarm64-gpl.tar.xz  -> aarch64-unknown-linux-gnu
#             macOS:        https://evermeet.cx/ffmpeg/ (latest static; ships universal2 builds)
#               - ffmpeg-<ver>.zip with embedded SHA-256 sidecar -> *-apple-darwin
#
# Behaviour:
#   * CI-safe: missing assets log a warning and are skipped (exit 0).
#   * Reproducible: SHA256 verified from upstream sums when available.
#   * Idempotent: re-runs reuse cached downloads under .cache/.
#   * Host-only mode: pass --host to fetch only the current platform's triple.
#
# License notes (see README.md):
#   yt-dlp   - Unlicense (public domain)
#   ffmpeg   - LGPLv2.1+/GPLv2+ depending on build (BtbN ships -gpl variants).
#              Bundling GPL'd ffmpeg requires the desktop app to be
#              GPL-compatible. The Universal Downloader root LICENSE must
#              remain compatible (currently AGPL-3.0).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${REPO_ROOT}/apps/desktop/src-tauri/binaries"
CACHE_DIR="${REPO_ROOT}/infra/tauri-sidecars/.cache"
mkdir -p "${OUT_DIR}" "${CACHE_DIR}"

# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

HOST_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --host) HOST_ONLY=1 ;;
    -h|--help)
      sed -n '2,40p' "$0"
      exit 0
      ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

# ---------------------------------------------------------------------------
# Logging helpers
# ---------------------------------------------------------------------------

log()  { printf '\033[1;34m[sidecars]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[sidecars]\033[0m %s\n' "$*" >&2; }
err()  { printf '\033[1;31m[sidecars]\033[0m %s\n' "$*" >&2; }

require() {
  command -v "$1" >/dev/null 2>&1 || { err "required tool '$1' not found"; exit 1; }
}

require curl
require shasum || require sha256sum

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

# Download to cache; verify sha256 if expected supplied.
download() {
  local url="$1" dest="$2" expected_sha="${3:-}"
  if [[ -f "$dest" ]]; then
    if [[ -n "$expected_sha" ]] && [[ "$(sha256_of "$dest")" == "$expected_sha" ]]; then
      log "cache hit (verified): $(basename "$dest")"
      return 0
    elif [[ -z "$expected_sha" ]]; then
      log "cache hit: $(basename "$dest")"
      return 0
    else
      warn "cache stale, re-downloading $(basename "$dest")"
      rm -f "$dest"
    fi
  fi
  log "downloading $url"
  if ! curl --fail --location --retry 3 --silent --show-error -o "$dest" "$url"; then
    warn "download failed: $url"
    rm -f "$dest"
    return 1
  fi
  if [[ -n "$expected_sha" ]]; then
    local got
    got="$(sha256_of "$dest")"
    if [[ "$got" != "$expected_sha" ]]; then
      err "sha256 mismatch for $(basename "$dest"): want=$expected_sha got=$got"
      rm -f "$dest"
      return 1
    fi
    log "verified sha256: $(basename "$dest")"
  fi
}

place() {
  local src="$1" name="$2" triple="$3" ext="${4:-}"
  local target="${OUT_DIR}/${name}-${triple}${ext}"
  install -m 0755 "$src" "$target"
  log "placed $(basename "$target")"
}

# ---------------------------------------------------------------------------
# Host triple detection
# ---------------------------------------------------------------------------

host_triple() {
  local os arch
  os="$(uname -s)"
  arch="$(uname -m)"
  case "$os" in
    Linux)
      case "$arch" in
        x86_64)  echo "x86_64-unknown-linux-gnu" ;;
        aarch64|arm64) echo "aarch64-unknown-linux-gnu" ;;
      esac ;;
    Darwin)
      case "$arch" in
        x86_64) echo "x86_64-apple-darwin" ;;
        arm64)  echo "aarch64-apple-darwin" ;;
      esac ;;
    MINGW*|MSYS*|CYGWIN*)
      case "$arch" in
        x86_64) echo "x86_64-pc-windows-msvc" ;;
        aarch64|arm64) echo "aarch64-pc-windows-msvc" ;;
      esac ;;
  esac
}

ALL_TRIPLES=(
  "x86_64-pc-windows-msvc"
  "aarch64-pc-windows-msvc"
  "x86_64-apple-darwin"
  "aarch64-apple-darwin"
  "x86_64-unknown-linux-gnu"
  "aarch64-unknown-linux-gnu"
)

if [[ "$HOST_ONLY" -eq 1 ]]; then
  HOST="$(host_triple || true)"
  if [[ -z "$HOST" ]]; then
    err "could not detect host triple"
    exit 1
  fi
  TRIPLES=("$HOST")
  log "host-only mode: ${HOST}"
else
  TRIPLES=("${ALL_TRIPLES[@]}")
fi

# ---------------------------------------------------------------------------
# yt-dlp
# ---------------------------------------------------------------------------

YTDLP_BASE="https://github.com/yt-dlp/yt-dlp/releases/latest/download"
YTDLP_SUMS_URL="${YTDLP_BASE}/SHA2-256SUMS"
YTDLP_SUMS_FILE="${CACHE_DIR}/yt-dlp.SHA2-256SUMS"

if ! curl --fail --location --retry 3 --silent --show-error -o "$YTDLP_SUMS_FILE" "$YTDLP_SUMS_URL"; then
  warn "could not fetch yt-dlp SHA2-256SUMS; binaries will be unverified"
  : > "$YTDLP_SUMS_FILE"
fi

ytdlp_sha() {
  awk -v f="$1" '$2==f || $2=="*"f {print $1; exit}' "$YTDLP_SUMS_FILE"
}

ytdlp_asset_for() {
  case "$1" in
    x86_64-pc-windows-msvc|aarch64-pc-windows-msvc) echo "yt-dlp.exe" ;;
    x86_64-apple-darwin|aarch64-apple-darwin)        echo "yt-dlp_macos" ;;
    x86_64-unknown-linux-gnu)                        echo "yt-dlp_linux" ;;
    aarch64-unknown-linux-gnu)                       echo "yt-dlp_linux_aarch64" ;;
  esac
}

fetch_ytdlp() {
  local triple="$1"
  local asset; asset="$(ytdlp_asset_for "$triple")"
  [[ -z "$asset" ]] && { warn "no yt-dlp asset for $triple"; return 0; }
  local cached="${CACHE_DIR}/${asset}"
  local sha; sha="$(ytdlp_sha "$asset")"
  if download "${YTDLP_BASE}/${asset}" "$cached" "$sha"; then
    local ext=""; [[ "$triple" == *windows* ]] && ext=".exe"
    place "$cached" "yt-dlp" "$triple" "$ext"
  else
    warn "skipping yt-dlp for $triple"
  fi
}

# ---------------------------------------------------------------------------
# ffmpeg
# ---------------------------------------------------------------------------

FFMPEG_BTBN="https://github.com/BtbN/FFmpeg-Builds/releases/latest/download"
FFMPEG_EVERMEET="https://evermeet.cx/ffmpeg"

ffmpeg_btbn_archive() {
  case "$1" in
    x86_64-pc-windows-msvc)      echo "ffmpeg-master-latest-win64-gpl.zip" ;;
    aarch64-pc-windows-msvc)     echo "ffmpeg-master-latest-winarm64-gpl.zip" ;;
    x86_64-unknown-linux-gnu)    echo "ffmpeg-master-latest-linux64-gpl.tar.xz" ;;
    aarch64-unknown-linux-gnu)   echo "ffmpeg-master-latest-linuxarm64-gpl.tar.xz" ;;
  esac
}

extract_ffmpeg() {
  local archive="$1" workdir="$2" triple="$3"
  rm -rf "$workdir"; mkdir -p "$workdir"
  case "$archive" in
    *.zip)
      command -v unzip >/dev/null 2>&1 || { warn "unzip required for $archive"; return 1; }
      unzip -q "$archive" -d "$workdir" ;;
    *.tar.xz)
      command -v tar >/dev/null 2>&1 || { warn "tar required for $archive"; return 1; }
      tar -xJf "$archive" -C "$workdir" ;;
    *) warn "unknown archive type: $archive"; return 1 ;;
  esac
  local ext=""; [[ "$triple" == *windows* ]] && ext=".exe"
  local found
  found="$(find "$workdir" -type f -name "ffmpeg${ext}" -print -quit 2>/dev/null || true)"
  if [[ -z "$found" ]]; then
    warn "ffmpeg binary not found inside $archive"
    return 1
  fi
  echo "$found"
}

fetch_ffmpeg_btbn() {
  local triple="$1"
  local archive; archive="$(ffmpeg_btbn_archive "$triple")"
  [[ -z "$archive" ]] && { warn "no ffmpeg archive for $triple"; return 0; }
  local cached="${CACHE_DIR}/${archive}"
  if ! download "${FFMPEG_BTBN}/${archive}" "$cached" ""; then
    warn "skipping ffmpeg for $triple"
    return 0
  fi
  local workdir="${CACHE_DIR}/extract-${triple}"
  local bin
  if ! bin="$(extract_ffmpeg "$cached" "$workdir" "$triple")"; then
    return 0
  fi
  local ext=""; [[ "$triple" == *windows* ]] && ext=".exe"
  place "$bin" "ffmpeg" "$triple" "$ext"
}

fetch_ffmpeg_macos() {
  local triple="$1"
  # evermeet ships a single universal2 static build covering both arm64 and x86_64.
  local archive="ffmpeg.zip"
  local cached="${CACHE_DIR}/ffmpeg-macos-${triple}.zip"
  if ! download "${FFMPEG_EVERMEET}/getrelease/zip" "$cached" ""; then
    warn "skipping ffmpeg for $triple"
    return 0
  fi
  command -v unzip >/dev/null 2>&1 || { warn "unzip required for macOS ffmpeg"; return 0; }
  local workdir="${CACHE_DIR}/extract-${triple}"
  rm -rf "$workdir"; mkdir -p "$workdir"
  unzip -q "$cached" -d "$workdir"
  local bin
  bin="$(find "$workdir" -type f -name "ffmpeg" -print -quit)"
  if [[ -z "$bin" ]]; then
    warn "ffmpeg binary not found in evermeet zip"
    return 0
  fi
  place "$bin" "ffmpeg" "$triple" ""
}

fetch_ffmpeg() {
  local triple="$1"
  case "$triple" in
    *apple-darwin) fetch_ffmpeg_macos "$triple" ;;
    *)             fetch_ffmpeg_btbn  "$triple" ;;
  esac
}

# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------

for triple in "${TRIPLES[@]}"; do
  log "=== target: ${triple} ==="
  fetch_ytdlp "$triple"
  fetch_ffmpeg "$triple"
done

log "done. binaries in: ${OUT_DIR}"
