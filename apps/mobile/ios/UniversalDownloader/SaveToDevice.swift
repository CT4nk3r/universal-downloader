//
//  SaveToDevice.swift
//  Universal Downloader
//
//  RN bridge that downloads a remote file via URLSession and writes it to
//  the user's Photos library (videos) or Files / Documents (audio).
//
import Foundation
import Photos
import UIKit
import React

@objc(SaveToDeviceModule)
class SaveToDeviceModule: NSObject {

  @objc static func requiresMainQueueSetup() -> Bool { false }

  // MARK: - Public bridge

  @objc(saveVideo:resolver:rejecter:)
  func saveVideo(_ url: NSString,
                 resolver: @escaping RCTPromiseResolveBlock,
                 rejecter: @escaping RCTPromiseRejectBlock) {
    download(urlString: url as String, suggestedExt: "mp4") { result in
      switch result {
      case .failure(let err):
        rejecter("download_failed", err.localizedDescription, err)
      case .success(let local):
        self.requestPhotosAuth { granted in
          guard granted else {
            rejecter("permission_denied", "Photo library permission denied", nil)
            return
          }
          PHPhotoLibrary.shared().performChanges({
            PHAssetChangeRequest.creationRequestForAssetFromVideo(atFileURL: local)
          }) { ok, err in
            if ok { resolver(nil) }
            else { rejecter("save_failed", err?.localizedDescription ?? "save failed", err) }
          }
        }
      }
    }
  }

  @objc(saveAudio:resolver:rejecter:)
  func saveAudio(_ url: NSString,
                 resolver: @escaping RCTPromiseResolveBlock,
                 rejecter: @escaping RCTPromiseRejectBlock) {
    download(urlString: url as String, suggestedExt: "m4a") { result in
      switch result {
      case .failure(let err):
        rejecter("download_failed", err.localizedDescription, err)
      case .success(let local):
        // Move into the app's Documents directory (visible in Files app
        // when UIFileSharingEnabled / LSSupportsOpeningDocumentsInPlace
        // are set in Info.plist).
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let dest = docs.appendingPathComponent(local.lastPathComponent)
        do {
          if FileManager.default.fileExists(atPath: dest.path) {
            try FileManager.default.removeItem(at: dest)
          }
          try FileManager.default.moveItem(at: local, to: dest)
          DispatchQueue.main.async {
            // Offer the standard share/Files picker for "Save to Files".
            let dic = UIDocumentInteractionController(url: dest)
            dic.presentOpenInMenu(from: .zero,
                                  in: UIApplication.shared.windows.first?.rootViewController?.view ?? UIView(),
                                  animated: true)
          }
          resolver(nil)
        } catch {
          rejecter("save_failed", error.localizedDescription, error)
        }
      }
    }
  }

  // MARK: - Helpers

  private func requestPhotosAuth(_ cb: @escaping (Bool) -> Void) {
    let status = PHPhotoLibrary.authorizationStatus(for: .addOnly)
    switch status {
    case .authorized, .limited: cb(true)
    case .notDetermined:
      PHPhotoLibrary.requestAuthorization(for: .addOnly) { s in
        cb(s == .authorized || s == .limited)
      }
    default: cb(false)
    }
  }

  private func download(urlString: String,
                        suggestedExt: String,
                        completion: @escaping (Result<URL, Error>) -> Void) {
    guard let src = URL(string: urlString) else {
      completion(.failure(NSError(domain: "SaveToDevice", code: 1,
                                  userInfo: [NSLocalizedDescriptionKey: "Bad URL"])))
      return
    }
    let task = URLSession.shared.downloadTask(with: src) { tmp, _, err in
      if let err = err { completion(.failure(err)); return }
      guard let tmp = tmp else {
        completion(.failure(NSError(domain: "SaveToDevice", code: 2,
                                    userInfo: [NSLocalizedDescriptionKey: "No file"])))
        return
      }
      let name = src.lastPathComponent.isEmpty
        ? "download-\(Int(Date().timeIntervalSince1970)).\(suggestedExt)"
        : src.lastPathComponent
      let dest = FileManager.default.temporaryDirectory.appendingPathComponent(name)
      do {
        if FileManager.default.fileExists(atPath: dest.path) {
          try FileManager.default.removeItem(at: dest)
        }
        try FileManager.default.moveItem(at: tmp, to: dest)
        completion(.success(dest))
      } catch {
        completion(.failure(error))
      }
    }
    task.resume()
  }
}
