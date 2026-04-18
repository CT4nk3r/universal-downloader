package com.ct4nk3r.universaldownloader

import android.content.ContentValues
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * Downloads a remote URL and inserts it into the platform MediaStore so it
 * appears in Photos/Gallery (videos) or Music/Files (audio).
 */
class SaveToDeviceModule(private val ctx: ReactApplicationContext) :
  ReactContextBaseJavaModule(ctx) {

  private val executor = Executors.newSingleThreadExecutor()

  override fun getName(): String = "SaveToDeviceModule"

  @ReactMethod
  fun saveVideo(url: String, promise: Promise) {
    executor.execute {
      try {
        val name = guessName(url, "mp4")
        val mime = "video/mp4"
        val values = ContentValues().apply {
          put(MediaStore.MediaColumns.DISPLAY_NAME, name)
          put(MediaStore.MediaColumns.MIME_TYPE, mime)
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            put(MediaStore.MediaColumns.RELATIVE_PATH,
                Environment.DIRECTORY_MOVIES + "/UniversalDownloader")
            put(MediaStore.MediaColumns.IS_PENDING, 1)
          }
        }
        val collection = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q)
          MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
        else MediaStore.Video.Media.EXTERNAL_CONTENT_URI

        val resolver = ctx.contentResolver
        val uri = resolver.insert(collection, values)
          ?: throw IllegalStateException("MediaStore.insert returned null")

        downloadInto(url) { input ->
          resolver.openOutputStream(uri)?.use { out -> input.copyTo(out) }
            ?: throw IllegalStateException("openOutputStream failed")
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          values.clear()
          values.put(MediaStore.MediaColumns.IS_PENDING, 0)
          resolver.update(uri, values, null, null)
        }
        promise.resolve(null)
      } catch (t: Throwable) {
        promise.reject("save_failed", t.message, t)
      }
    }
  }

  @ReactMethod
  fun saveAudio(url: String, promise: Promise) {
    executor.execute {
      try {
        val name = guessName(url, "m4a")
        val mime = if (name.endsWith(".mp3")) "audio/mpeg" else "audio/mp4"
        val values = ContentValues().apply {
          put(MediaStore.MediaColumns.DISPLAY_NAME, name)
          put(MediaStore.MediaColumns.MIME_TYPE, mime)
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            put(MediaStore.MediaColumns.RELATIVE_PATH,
                Environment.DIRECTORY_MUSIC + "/UniversalDownloader")
            put(MediaStore.MediaColumns.IS_PENDING, 1)
          }
        }
        val collection = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q)
          MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
        else MediaStore.Audio.Media.EXTERNAL_CONTENT_URI

        val resolver = ctx.contentResolver
        val uri = resolver.insert(collection, values)
          ?: throw IllegalStateException("MediaStore.insert returned null")

        downloadInto(url) { input ->
          resolver.openOutputStream(uri)?.use { out -> input.copyTo(out) }
            ?: throw IllegalStateException("openOutputStream failed")
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          values.clear()
          values.put(MediaStore.MediaColumns.IS_PENDING, 0)
          resolver.update(uri, values, null, null)
        }
        promise.resolve(null)
      } catch (t: Throwable) {
        promise.reject("save_failed", t.message, t)
      }
    }
  }

  // --- helpers ------------------------------------------------------------

  private fun downloadInto(url: String, sink: (java.io.InputStream) -> Unit) {
    val conn = (URL(url).openConnection() as HttpURLConnection).apply {
      connectTimeout = 30_000
      readTimeout = 60_000
      requestMethod = "GET"
    }
    try {
      conn.connect()
      if (conn.responseCode !in 200..299) {
        throw IllegalStateException("HTTP ${conn.responseCode}")
      }
      conn.inputStream.use(sink)
    } finally {
      conn.disconnect()
    }
  }

  private fun guessName(url: String, fallbackExt: String): String {
    val tail = url.substringAfterLast('/').substringBefore('?')
    return if (tail.contains('.')) tail
    else "download-${System.currentTimeMillis()}.$fallbackExt"
  }
}
