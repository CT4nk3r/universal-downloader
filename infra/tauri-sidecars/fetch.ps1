<#
infra/tauri-sidecars/fetch.ps1

Windows-friendly counterpart of fetch.sh. Downloads the latest yt-dlp +
ffmpeg builds for each Tauri target triple and writes them to
apps/desktop/src-tauri/binaries/ using Tauri's sidecar naming convention.

Sources (provenance, see README.md):
  yt-dlp  : https://github.com/yt-dlp/yt-dlp/releases/latest
              - yt-dlp.exe          -> *-pc-windows-msvc
              - yt-dlp_macos        -> *-apple-darwin
              - yt-dlp_linux        -> x86_64-unknown-linux-gnu
              - yt-dlp_linux_aarch64 -> aarch64-unknown-linux-gnu
            SHA256 verified against the release SHA2-256SUMS file.
  ffmpeg  : https://github.com/BtbN/FFmpeg-Builds/releases/latest (win/linux, GPL)
            https://evermeet.cx/ffmpeg/                            (mac, universal2)

License notes:
  yt-dlp = Unlicense (public domain).
  ffmpeg = LGPLv2.1+/GPLv2+ (BtbN -gpl builds are GPL-licensed). Project
           LICENSE must remain GPL-compatible (currently AGPL-3.0).

Usage:
  pwsh -File infra/tauri-sidecars/fetch.ps1            # fetch all triples
  pwsh -File infra/tauri-sidecars/fetch.ps1 -Host      # current host only

CI-safe: missing assets emit a warning and are skipped.
#>

[CmdletBinding()]
param(
  [switch]$HostOnly
)

$ErrorActionPreference = 'Stop'
$ProgressPreference    = 'SilentlyContinue'

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$OutDir   = Join-Path $RepoRoot 'apps\desktop\src-tauri\binaries'
$CacheDir = Join-Path $PSScriptRoot '.cache'
New-Item -ItemType Directory -Force -Path $OutDir, $CacheDir | Out-Null

function Log  ($m) { Write-Host "[sidecars] $m" -ForegroundColor Cyan }
function Warn ($m) { Write-Warning "[sidecars] $m" }
function Fail ($m) { Write-Error  "[sidecars] $m" }

function Get-FileSha256 {
  param([string]$Path)
  (Get-FileHash -Algorithm SHA256 -Path $Path).Hash.ToLowerInvariant()
}

function Invoke-Download {
  param(
    [string]$Url,
    [string]$Dest,
    [string]$ExpectedSha = ''
  )
  if (Test-Path $Dest) {
    if ($ExpectedSha -and (Get-FileSha256 $Dest) -eq $ExpectedSha.ToLowerInvariant()) {
      Log "cache hit (verified): $(Split-Path $Dest -Leaf)"
      return $true
    } elseif (-not $ExpectedSha) {
      Log "cache hit: $(Split-Path $Dest -Leaf)"
      return $true
    } else {
      Warn "cache stale, re-downloading $(Split-Path $Dest -Leaf)"
      Remove-Item $Dest -Force
    }
  }
  Log "downloading $Url"
  try {
    Invoke-WebRequest -Uri $Url -OutFile $Dest -MaximumRedirection 5 -UseBasicParsing
  } catch {
    Warn "download failed: $Url ($($_.Exception.Message))"
    if (Test-Path $Dest) { Remove-Item $Dest -Force }
    return $false
  }
  if ($ExpectedSha) {
    $got = Get-FileSha256 $Dest
    if ($got -ne $ExpectedSha.ToLowerInvariant()) {
      Fail "sha256 mismatch for $(Split-Path $Dest -Leaf): want=$ExpectedSha got=$got"
      Remove-Item $Dest -Force
      return $false
    }
    Log "verified sha256: $(Split-Path $Dest -Leaf)"
  }
  return $true
}

function Place {
  param([string]$Src, [string]$Name, [string]$Triple, [string]$Ext = '')
  $target = Join-Path $OutDir ("{0}-{1}{2}" -f $Name, $Triple, $Ext)
  Copy-Item -Force $Src $target
  Log "placed $(Split-Path $target -Leaf)"
}

function Get-HostTriple {
  $arch = if ([Environment]::Is64BitOperatingSystem) {
    if ($env:PROCESSOR_ARCHITECTURE -match 'ARM64' -or
        $env:PROCESSOR_ARCHITEW6432  -match 'ARM64') { 'aarch64' } else { 'x86_64' }
  } else { 'x86_64' }
  if ($IsWindows) { return "$arch-pc-windows-msvc" }
  if ($IsMacOS)   { return "$arch-apple-darwin" }
  if ($IsLinux)   { return "$arch-unknown-linux-gnu" }
  return $null
}

$AllTriples = @(
  'x86_64-pc-windows-msvc',
  'aarch64-pc-windows-msvc',
  'x86_64-apple-darwin',
  'aarch64-apple-darwin',
  'x86_64-unknown-linux-gnu',
  'aarch64-unknown-linux-gnu'
)

if ($HostOnly) {
  $h = Get-HostTriple
  if (-not $h) { Fail 'could not detect host triple'; exit 1 }
  Log "host-only mode: $h"
  $Triples = @($h)
} else {
  $Triples = $AllTriples
}

# ----- yt-dlp -----------------------------------------------------------------

$YtdlpBase     = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download'
$YtdlpSumsUrl  = "$YtdlpBase/SHA2-256SUMS"
$YtdlpSumsFile = Join-Path $CacheDir 'yt-dlp.SHA2-256SUMS'

if (-not (Invoke-Download -Url $YtdlpSumsUrl -Dest $YtdlpSumsFile)) {
  Warn 'could not fetch yt-dlp SHA2-256SUMS; binaries will be unverified'
  Set-Content $YtdlpSumsFile ''
}

function Get-YtdlpSha {
  param([string]$Asset)
  $line = Get-Content $YtdlpSumsFile | Where-Object {
    $parts = $_ -split '\s+', 2
    $parts.Length -ge 2 -and ($parts[1] -eq $Asset -or $parts[1] -eq "*$Asset")
  } | Select-Object -First 1
  if ($line) { ($line -split '\s+')[0] } else { '' }
}

function Get-YtdlpAsset {
  param([string]$Triple)
  switch -Wildcard ($Triple) {
    '*pc-windows-msvc'           { 'yt-dlp.exe' }
    '*apple-darwin'              { 'yt-dlp_macos' }
    'x86_64-unknown-linux-gnu'   { 'yt-dlp_linux' }
    'aarch64-unknown-linux-gnu'  { 'yt-dlp_linux_aarch64' }
    default                      { '' }
  }
}

function Fetch-Ytdlp {
  param([string]$Triple)
  $asset = Get-YtdlpAsset $Triple
  if (-not $asset) { Warn "no yt-dlp asset for $Triple"; return }
  $cached = Join-Path $CacheDir $asset
  $sha = Get-YtdlpSha $asset
  if (Invoke-Download -Url "$YtdlpBase/$asset" -Dest $cached -ExpectedSha $sha) {
    $ext = if ($Triple -like '*windows*') { '.exe' } else { '' }
    Place -Src $cached -Name 'yt-dlp' -Triple $Triple -Ext $ext
  } else {
    Warn "skipping yt-dlp for $Triple"
  }
}

# ----- ffmpeg -----------------------------------------------------------------

$FfmpegBtbn     = 'https://github.com/BtbN/FFmpeg-Builds/releases/latest/download'
$FfmpegEvermeet = 'https://evermeet.cx/ffmpeg/getrelease/zip'

function Get-FfmpegBtbnArchive {
  param([string]$Triple)
  switch ($Triple) {
    'x86_64-pc-windows-msvc'     { 'ffmpeg-master-latest-win64-gpl.zip' }
    'aarch64-pc-windows-msvc'    { 'ffmpeg-master-latest-winarm64-gpl.zip' }
    'x86_64-unknown-linux-gnu'   { 'ffmpeg-master-latest-linux64-gpl.tar.xz' }
    'aarch64-unknown-linux-gnu'  { 'ffmpeg-master-latest-linuxarm64-gpl.tar.xz' }
    default                      { '' }
  }
}

function Expand-Archive-Cross {
  param([string]$Archive, [string]$Dest)
  New-Item -ItemType Directory -Force -Path $Dest | Out-Null
  if ($Archive -like '*.zip') {
    Expand-Archive -Path $Archive -DestinationPath $Dest -Force
  } elseif ($Archive -like '*.tar.xz') {
    $tar = Get-Command tar -ErrorAction SilentlyContinue
    if (-not $tar) { Warn "tar required to extract $Archive"; return $false }
    & tar -xJf $Archive -C $Dest
    if ($LASTEXITCODE -ne 0) { return $false }
  } else {
    Warn "unknown archive: $Archive"
    return $false
  }
  return $true
}

function Fetch-FfmpegBtbn {
  param([string]$Triple)
  $archive = Get-FfmpegBtbnArchive $Triple
  if (-not $archive) { Warn "no ffmpeg archive for $Triple"; return }
  $cached = Join-Path $CacheDir $archive
  if (-not (Invoke-Download -Url "$FfmpegBtbn/$archive" -Dest $cached)) {
    Warn "skipping ffmpeg for $Triple"; return
  }
  $workdir = Join-Path $CacheDir "extract-$Triple"
  if (Test-Path $workdir) { Remove-Item -Recurse -Force $workdir }
  if (-not (Expand-Archive-Cross -Archive $cached -Dest $workdir)) { return }
  $ext = if ($Triple -like '*windows*') { '.exe' } else { '' }
  $bin = Get-ChildItem -Recurse -File -Path $workdir -Filter "ffmpeg$ext" |
           Select-Object -First 1
  if (-not $bin) { Warn "ffmpeg not found inside $archive"; return }
  Place -Src $bin.FullName -Name 'ffmpeg' -Triple $Triple -Ext $ext
}

function Fetch-FfmpegMac {
  param([string]$Triple)
  $cached = Join-Path $CacheDir "ffmpeg-macos-$Triple.zip"
  if (-not (Invoke-Download -Url $FfmpegEvermeet -Dest $cached)) {
    Warn "skipping ffmpeg for $Triple"; return
  }
  $workdir = Join-Path $CacheDir "extract-$Triple"
  if (Test-Path $workdir) { Remove-Item -Recurse -Force $workdir }
  Expand-Archive -Path $cached -DestinationPath $workdir -Force
  $bin = Get-ChildItem -Recurse -File -Path $workdir -Filter 'ffmpeg' |
           Select-Object -First 1
  if (-not $bin) { Warn 'ffmpeg not found in evermeet zip'; return }
  Place -Src $bin.FullName -Name 'ffmpeg' -Triple $Triple
}

function Fetch-Ffmpeg {
  param([string]$Triple)
  if ($Triple -like '*apple-darwin') { Fetch-FfmpegMac $Triple }
  else                                { Fetch-FfmpegBtbn $Triple }
}

# ----- Driver -----------------------------------------------------------------

foreach ($t in $Triples) {
  Log "=== target: $t ==="
  Fetch-Ytdlp  -Triple $t
  Fetch-Ffmpeg -Triple $t
}

Log "done. binaries in: $OutDir"
