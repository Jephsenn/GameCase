// metro.config.js — Expo + monorepo resolution for @gamecase/shared + NativeWind v4
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');
const sharedRoot = path.resolve(projectRoot, '../shared');

const config = getDefaultConfig(projectRoot);

// 1. Watch the shared package so we get live reloading of shared source
config.watchFolders = [sharedRoot];

// 2. Set the project root and workspace root for proper resolution
config.projectRoot = projectRoot;

// 3. Ensure Metro resolves node_modules from this package first
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];

// 4. Explicitly resolve packages that need monorepo-aware resolution
config.resolver.extraNodeModules = new Proxy(
  { '@gamecase/shared': sharedRoot },
  {
    get: (target, name) => {
      if (target.hasOwnProperty(name)) return target[name];
      // Fall back to mobile's own node_modules for everything else
      return path.join(projectRoot, 'node_modules', name);
    },
  },
);

// 5. Make sure .ts/.tsx in the shared package are resolved
config.resolver.sourceExts = [...(config.resolver.sourceExts || []), 'mjs', 'cjs'];

// 6. Fix react-native-reanimated v4.x: its "react-native" field points to
//    src/index which doesn't ship in the npm package. Force Metro to prefer
//    "main" (lib/module/index) over the broken "react-native" source field.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native-reanimated') {
    const reanimatedPkg = path.resolve(
      projectRoot,
      'node_modules/react-native-reanimated',
    );
    return {
      type: 'sourceFile',
      filePath: path.resolve(reanimatedPkg, 'lib/module/index.js'),
    };
  }
  // Use default resolution for everything else
  return context.resolveRequest(context, moduleName, platform);
};

// 7. Wrap with NativeWind for CSS interop support
module.exports = withNativeWind(config, { input: './global.css' });
