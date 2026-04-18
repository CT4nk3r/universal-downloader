import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

export interface SharedUrlSpec {
  getInitialUrl(): Promise<string | null>;
}

const LINKING_ERROR =
  `The native module 'SharedUrlModule' is not linked. ` +
  `Make sure you've rebuilt the app after installing.`;

const native = (NativeModules as { SharedUrlModule?: SharedUrlSpec }).SharedUrlModule;

const proxy: SharedUrlSpec =
  native ??
  new Proxy({} as SharedUrlSpec, {
    get() {
      return () => {
        throw new Error(LINKING_ERROR);
      };
    },
  });

const emitter = native
  ? new NativeEventEmitter(native as unknown as Parameters<typeof NativeEventEmitter>[0])
  : null;

export type SharedUrlListener = (url: string) => void;

export const SharedUrlModule = {
  /** Returns the URL the app was launched with via share/intent, if any. */
  getInitialUrl(): Promise<string | null> {
    return proxy.getInitialUrl();
  },
  /** Subscribe to share-sheet/intent URL events while running. */
  addUrlListener(cb: SharedUrlListener): () => void {
    if (!emitter) return () => {};
    const sub = emitter.addListener('SharedUrl', (payload: { url: string }) => {
      if (payload && typeof payload.url === 'string') cb(payload.url);
    });
    return () => sub.remove();
  },
  /** Explicit removal helper for parity with the spec. */
  removeUrlListener(_cb: SharedUrlListener): void {
    /* listener handles managed by closure returned from addUrlListener */
  },
  platform: Platform.OS,
};
