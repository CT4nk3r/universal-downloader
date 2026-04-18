import { NativeModules } from 'react-native';

export interface SaveToDeviceSpec {
  saveVideo(url: string): Promise<void>;
  saveAudio(url: string): Promise<void>;
}

const LINKING_ERROR =
  `The native module 'SaveToDeviceModule' is not linked. Rebuild the app after installing.`;

const native = (NativeModules as { SaveToDeviceModule?: SaveToDeviceSpec }).SaveToDeviceModule;

export const SaveToDeviceModule: SaveToDeviceSpec =
  native ??
  new Proxy({} as SaveToDeviceSpec, {
    get() {
      return () => Promise.reject(new Error(LINKING_ERROR));
    },
  });
