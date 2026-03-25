import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import AuthBackground from '@/components/AuthBackground';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '@/store/auth.store';
import { login as apiLogin, googleCodeExchange, oauthLogin } from '@/api/auth';
import { queryClient } from '@/lib/queryClient';
import { COLORS } from '@/constants/theme';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';

WebBrowser.maybeCompleteAuthSession();

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
};

export default function LoginScreen() {
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '';

  // ── Google OAuth — direct PKCE flow (no Expo proxy) ───────────────
  // auth.expo.io proxy was blocked by Google's OAuth policy in May 2024.
  // We now use promptAsync() with the app's custom scheme as redirectUri.
  //
  // In Expo Go:       redirectUri = exp://127.0.0.1:8081  (add to Google Console)
  // In dev/prod build: redirectUri = gamecase://       (add to Google Console)
  //
  // Google Console → OAuth 2.0 Client (iOS or Android) → add the URI above.
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'gamecase' });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: googleClientId,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      scopes: ['openid', 'profile', 'email'],
      usePKCE: true,
    },
    discovery,
  );

  // Handle the auth response once it arrives
  useEffect(() => {
    if (!response) return;

    if (response.type === 'success') {
      const code = response.params.code;
      setGoogleLoading(true);
      googleCodeExchange(code, request?.codeVerifier ?? '', redirectUri)
        .then(async (authResult) => {
          await setTokens(authResult.accessToken, authResult.refreshToken);
          setUser(authResult.user);
          queryClient.clear();
          router.replace('/(tabs)');
        })
        .catch((err: unknown) => {
          let message = 'Google login failed';
          if (err && typeof err === 'object' && 'response' in err) {
            const axiosErr = err as { response?: { data?: { error?: string } } };
            message = axiosErr.response?.data?.error ?? message;
          } else if (err instanceof Error) {
            message = err.message;
          }
          Toast.show({ type: 'error', text1: 'OAuth Error', text2: message });
        })
        .finally(() => setGoogleLoading(false));
    } else if (response.type === 'error') {
      Toast.show({
        type: 'error',
        text1: 'OAuth Error',
        text2: response.error?.message ?? 'Authentication failed',
      });
    }
    // 'dismiss' = user cancelled, do nothing
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  const handleAppleSignIn = async () => {
    try {
      setAppleLoading(true);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error('No identity token received from Apple');
      const result = await oauthLogin(credential.identityToken, 'apple');
      await setTokens(result.accessToken, result.refreshToken);
      setUser(result.user);
      queryClient.clear();
      router.replace('/(tabs)');
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && err.code === 'ERR_REQUEST_CANCELED') return;
      let message = 'Apple sign-in failed';
      if (err instanceof Error) message = err.message;
      Toast.show({ type: 'error', text1: 'Apple Sign-In Error', text2: message });
    } finally {
      setAppleLoading(false);
    }
  };

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      const result = await apiLogin(data);
      await setTokens(result.accessToken, result.refreshToken);
      setUser(result.user);
      queryClient.clear();
      router.replace('/(tabs)');
    } catch (err: unknown) {
      let message = 'Login failed';
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { error?: string } } };
        message = axiosErr.response?.data?.error ?? message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      Toast.show({ type: 'error', text1: 'Login Error', text2: message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.root}>
      <AuthBackground />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={StyleSheet.absoluteFill}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header — matches landing page G logo */}
          <View style={s.header}>
            <View style={s.logoRow}>
              <LinearGradient
                colors={['#7c3aed', '#a855f7', '#d946ef']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.logoBox}
              >
                <Text style={s.logoLetter}>G</Text>
              </LinearGradient>
              <Text style={s.logoText}>
                Game<Text style={s.logoAccent}>Tracker</Text>
              </Text>
            </View>
            <Text style={s.screenTitle}>Welcome back</Text>
            <Text style={s.screenSub}>Sign in to your account</Text>
          </View>

          {/* Glass card */}
          <View style={s.card}>

            {/* Email */}
            <View style={s.fieldGroup}>
              <Text style={s.label}>Email</Text>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={[s.input, !!errors.email && s.inputError]}
                    placeholderTextColor={COLORS.textMuted}
                    placeholder="you@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                  />
                )}
              />
              {errors.email && <Text style={s.errorText}>{errors.email.message}</Text>}
            </View>

            {/* Password */}
            <View style={s.fieldGroup}>
              <Text style={s.label}>Password</Text>
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View style={[s.inputRow, !!errors.password && s.inputError]}>
                    <TextInput
                      style={s.inputFlex}
                    placeholderTextColor={COLORS.textMuted}
                      placeholder="••••••••"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                    />
                    <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color={COLORS.textMuted}
                      />
                    </Pressable>
                  </View>
                )}
              />
              {errors.password && <Text style={s.errorText}>{errors.password.message}</Text>}
            </View>

            {/* Forgot password */}
            <View style={s.forgotRow}>
              <Link href="/(auth)/forgot-password" asChild>
                <Pressable>
                  <Text style={s.forgotText}>Forgot password?</Text>
                </Pressable>
              </Link>
            </View>

            {/* Sign In button */}
            <Pressable onPress={handleSubmit(onSubmit)} disabled={loading}>
              {({ pressed }) => (
                <View style={[s.btnPrimary, pressed && { opacity: 0.78 }]}>
                  {loading
                    ? <ActivityIndicator color="#ffffff" />
                    : <Text style={s.btnPrimaryText}>Sign In</Text>
                  }
                </View>
              )}
            </Pressable>

            {/* Divider */}
            <View style={s.divider}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>or</Text>
              <View style={s.dividerLine} />
            </View>

            {/* Google */}
            <Pressable onPress={() => void promptAsync()} disabled={!request || googleLoading}>
              {({ pressed }) => (
                <View style={[s.btnGoogle, pressed && { opacity: 0.78 }]}>
                  {googleLoading
                    ? <ActivityIndicator color="#f1f5f9" />
                    : <>
                        <Ionicons name="logo-google" size={18} color="#f1f5f9" />
                        <Text style={s.btnGoogleText}>Sign in with Google</Text>
                      </>
                  }
                </View>
              )}
            </Pressable>

            {/* Apple — iOS only */}
            {Platform.OS === 'ios' && (
              appleLoading
                ? <View style={s.btnApplePlaceholder}><ActivityIndicator color="#f1f5f9" /></View>
                : <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                    cornerRadius={12}
                    style={s.btnApple}
                    onPress={handleAppleSignIn}
                  />
            )}

            {/* Register link */}
            <View style={s.switchRow}>
              <Text style={s.switchText}>Don't have an account? </Text>
              <Link href="/(auth)/register" asChild>
                <Pressable>
                  <Text style={s.switchLink}>Sign Up</Text>
                </Pressable>
              </Link>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 48 },

  // ── Header ──
  header: { alignItems: 'center', marginBottom: 24 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  logoBox: { width: 50, height: 50, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  logoLetter: { fontSize: 24, fontWeight: '900', color: '#ffffff' },
  logoText: { fontSize: 28, fontWeight: '700', color: '#ffffff', letterSpacing: -0.5 },
  logoAccent: { color: COLORS.accentLight },
  screenTitle: { fontSize: 24, fontWeight: '800', color: '#ffffff', letterSpacing: -0.4 },
  screenSub: { marginTop: 6, fontSize: 14, color: COLORS.textMuted },

  // ── Glass card ──
  card: {
    backgroundColor: 'rgba(12,8,24,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.25)',
    borderRadius: 22,
    padding: 24,
  },

  // ── Fields ──
  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 7, letterSpacing: 0.1 },
  input: {
    backgroundColor: 'rgba(15,10,28,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(99,80,150,0.38)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#f1f5f9',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15,10,28,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(99,80,150,0.38)',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  inputFlex: { flex: 1, paddingVertical: 14, fontSize: 15, color: '#f1f5f9' },
  inputError: { borderColor: 'rgba(239,68,68,0.65)' },
  errorText: { marginTop: 5, fontSize: 12, color: '#ef4444' },

  forgotRow: { alignItems: 'flex-end', marginBottom: 20 },
  forgotText: { fontSize: 13, color: COLORS.accentLight, fontWeight: '500' },

  // ── Buttons ──
  btnPrimary: {
    backgroundColor: '#7c3aed',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 6,
  },
  btnPrimaryText: { color: '#ffffff', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },

  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(99,80,150,0.22)' },
  dividerText: { marginHorizontal: 12, fontSize: 13, color: COLORS.textMuted },

  btnGoogle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(30,20,52,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(99,80,150,0.38)',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 24,
  },
  btnGoogleText: { color: '#e2e8f0', fontSize: 15, fontWeight: '600' },

  btnApple: { width: '100%', height: 50, marginBottom: 24 },
  btnApplePlaceholder: {
    height: 50,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },

  switchRow: { flexDirection: 'row', justifyContent: 'center' },
  switchText: { color: COLORS.textMuted, fontSize: 14 },
  switchLink: { color: COLORS.accentLight, fontSize: 14, fontWeight: '600' },
});
