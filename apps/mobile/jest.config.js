module.exports = {
  preset: 'react-native',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native|@react-navigation|react-native-screens|react-native-safe-area-context|react-native-keychain|react-native-mmkv)',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/ios/', '/android/'],
  setupFiles: ['./jest.setup.js'],
};
