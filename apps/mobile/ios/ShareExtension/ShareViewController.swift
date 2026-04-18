//
//  ShareViewController.swift
//  Universal Downloader Share Extension
//
//  Receives a shared URL (or text containing a URL) from the iOS share
//  sheet, then opens the host app via the `universal-downloader://share?url=…`
//  custom scheme. The host app's `SharedUrlModule` (via `useSharedUrl`)
//  picks the URL up and pre-fills the Home screen.
//
import UIKit
import Social
import MobileCoreServices
import UniformTypeIdentifiers

@objc(ShareViewController)
class ShareViewController: SLComposeServiceViewController {

  override func isContentValid() -> Bool { true }

  override func viewDidLoad() {
    super.viewDidLoad()
    extractAndForward()
  }

  override func didSelectPost() {
    self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
  }

  override func configurationItems() -> [Any]! { [] }

  // MARK: - Extraction

  private func extractAndForward() {
    guard let items = extensionContext?.inputItems as? [NSExtensionItem] else {
      finishCancel(); return
    }
    let urlType = UTType.url.identifier
    let textType = UTType.plainText.identifier

    for item in items {
      guard let providers = item.attachments else { continue }
      for provider in providers {
        if provider.hasItemConformingToTypeIdentifier(urlType) {
          provider.loadItem(forTypeIdentifier: urlType, options: nil) { [weak self] data, _ in
            if let url = data as? URL { self?.openHost(with: url.absoluteString) }
            else if let s = data as? String, let u = URL(string: s) { self?.openHost(with: u.absoluteString) }
            else { self?.finishCancel() }
          }
          return
        }
        if provider.hasItemConformingToTypeIdentifier(textType) {
          provider.loadItem(forTypeIdentifier: textType, options: nil) { [weak self] data, _ in
            if let s = data as? String,
               let match = s.range(of: #"https?://[^\s]+"#, options: .regularExpression) {
              self?.openHost(with: String(s[match]))
            } else {
              self?.finishCancel()
            }
          }
          return
        }
      }
    }
    finishCancel()
  }

  // MARK: - Host launch

  private func openHost(with rawUrl: String) {
    let encoded = rawUrl.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? rawUrl
    let target = URL(string: "universal-downloader://share?url=\(encoded)")
    DispatchQueue.main.async { [weak self] in
      guard let self = self, let target = target else { self?.finishCancel(); return }
      self.openURL(target)
      self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }
  }

  /// Walks the responder chain to call UIApplication.openURL: from inside an
  /// extension (Apple disallows the direct API).
  @objc @discardableResult
  private func openURL(_ url: URL) -> Bool {
    var responder: UIResponder? = self
    while let r = responder {
      if let app = r as? UIApplication {
        return app.perform(#selector(openURL(_:)), with: url) != nil
      }
      responder = r.next
    }
    return false
  }

  private func finishCancel() {
    self.extensionContext?.cancelRequest(withError: NSError(domain: "ShareExtension", code: 0))
  }
}
