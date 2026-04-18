/**
 * Metro config — monorepo aware.
 * See: https://metrobundler.dev/docs/configuration/#monorepo
 */
const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const defaultConfig = getDefaultConfig(projectRoot);

/** @type {import('metro-config').MetroConfig} */
const config = {
  // Watch the whole monorepo so changes in workspace packages trigger rebuilds.
  watchFolders: [workspaceRoot],
  resolver: {
    // Force Metro to look up modules only in these locations (no hierarchical
    // walk up — pnpm symlinks otherwise confuse Metro).
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
      path.resolve(workspaceRoot, 'packages'),
    ],
    disableHierarchicalLookup: true,
  },
};

module.exports = mergeConfig(defaultConfig, config);
