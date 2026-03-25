import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'GameCase',
  slug: 'gamecase',
  owner: 'jjosephsen',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0f172a',
  },
  userInterfaceStyle: 'dark',
  newArchEnabled: true,
  scheme: 'gamecase',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.bruddasindustries.gamecase',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/icon.png',
      backgroundColor: '#0f172a',
    },
    package: 'com.bruddasindustries.gamecase',
  },
  web: {
    bundler: 'metro',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-image-picker',
    'expo-apple-authentication',
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api/v1',
    googleClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '',
    googleRedirectUri: process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI || 'https://auth.expo.io/@jjosephsen/gamecase',
    eas: {
      // Set this after running: npx eas init
      // See DEPLOYMENT.md for instructions.
      projectId: process.env.EAS_PROJECT_ID || undefined,
    },
  },
});
