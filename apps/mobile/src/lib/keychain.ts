/**
 * Secure API key storage backed by the OS keychain (iOS Keychain / Android
 * Keystore via react-native-keychain).
 */
import * as Keychain from 'react-native-keychain';

const SERVICE = 'com.ct4nk3r.universaldownloader.apikey';
const ACCOUNT = 'apiKey';

export async function getApiKey(): Promise<string | null> {
  const creds = await Keychain.getGenericPassword({ service: SERVICE });
  if (!creds) return null;
  return creds.password;
}

export async function setApiKey(key: string): Promise<void> {
  await Keychain.setGenericPassword(ACCOUNT, key, {
    service: SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
  });
}

export async function clearApiKey(): Promise<void> {
  await Keychain.resetGenericPassword({ service: SERVICE });
}
