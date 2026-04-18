# Getting Started

This guide walks you through using Universal Downloader on each supported surface and shows
how to provision an API key for programmatic access.

## 1. Pick your client

=== "Web"

    1. Open the hosted instance (or your self-hosted URL).
    2. Sign in or continue as a guest (limited quota).
    3. Paste a media URL into the search bar and press **Fetch**.
    4. Choose your preferred format/quality and click **Download**.

=== "Desktop"

    1. Download the installer for your OS from
       [Releases](https://github.com/CT4nk3r/universal-downloader/releases).
    2. Launch **Universal Downloader**.
    3. On first run, point the app at your API endpoint
       (defaults to the public instance) and paste your API key under
       **Settings → Account**.
    4. Drag-and-drop a URL or paste it into the address bar.

=== "Mobile"

    1. Install the APK (Android) or join the TestFlight beta (iOS — TBD).
    2. Grant storage permission so files can be saved to your device.
    3. Open **Settings → API** and enter your endpoint + API key.
    4. Use the system **Share** sheet from any browser to send a URL to the app.

## 2. Your first download

Regardless of client, the flow is the same:

1. **Resolve** — the app calls `POST /v1/resolve` with your URL.
2. **Pick a format** — the response lists available qualities, codecs, and sizes.
3. **Download** — the client streams from `GET /v1/download/{job_id}` (or saves directly).

## 3. API key setup

Programmatic access (and the desktop/mobile clients) authenticate with a bearer token.

### Generate a key

If you are using a hosted instance:

1. Sign in to the web UI.
2. Open **Settings → API Keys → Create new key**.
3. Copy the token — it is shown **only once**.

If you are self-hosting, generate a key from the API container:

```bash
docker exec -it universal-downloader-api \
  pnpm --filter @ud/api cli keys:create --label "my-laptop"
```

### Use the key

Send the key as a bearer token on every request:

```bash
curl -H "Authorization: Bearer $UD_API_KEY" \
  https://api.example.com/v1/extractors
```

Or, in a `.env` file consumed by the desktop/mobile client:

```env
UD_API_BASE_URL=https://api.example.com
UD_API_KEY=ud_live_xxxxxxxxxxxxxxxxxxxxxxxx
```

!!! warning "Keep keys secret"
    API keys grant access to your quota and download history. Never commit them to source
    control. Rotate any key that is exposed.

## Next

- Browse the full [API Reference](api.md).
- Learn about deployment in [Self-Hosting](self-hosting.md).
- Read the [Responsible Use](responsible-use.md) policy before downloading anything.
