import { useState } from 'react';
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
import { router, useLocalSearchParams } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { resetPassword } from '@/api/auth';
import { COLORS } from '@/constants/theme';

const schema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password too long'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [done, setDone] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = async (data: FormData) => {
    if (!token) {
      Toast.show({
        type: 'error',
        text1: 'Invalid link',
        text2: 'Please request a new password reset link.',
      });
      return;
    }
    setLoading(true);
    try {
      await resetPassword(token, data.password);
      setDone(true);
    } catch (err: unknown) {
      let message = 'Failed to reset password';
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { error?: string } } };
        message = axiosErr.response?.data?.error ?? message;
      }
      Toast.show({ type: 'error', text1: 'Error', text2: message });
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <View style={s.root}>
        <AuthBackground />
        <View style={[StyleSheet.absoluteFill, s.centerContent]}>
          <View style={s.stateCard}>
            <View style={s.errorIconWrap}>
              <Ionicons name="alert-circle-outline" size={36} color="#ef4444" />
            </View>
            <Text style={s.stateTitle}>Invalid reset link</Text>
            <Text style={s.stateBody}>
              This link is missing a reset token. Please request a new password reset.
            </Text>
            <Pressable onPress={() => router.replace('/(auth)/forgot-password')}>
              {({ pressed }) => (
                <View style={[s.btnPrimary, pressed && { opacity: 0.78 }]}>
                  <Text style={s.btnPrimaryText}>Request New Link</Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  if (done) {
    return (
      <View style={s.root}>
        <AuthBackground />
        <View style={[StyleSheet.absoluteFill, s.centerContent]}>
          <View style={s.stateCard}>
            <View style={s.successIconWrap}>
              <Ionicons name="checkmark-circle-outline" size={36} color="#22c55e" />
            </View>
            <Text style={s.stateTitle}>Password updated!</Text>
            <Text style={s.stateBody}>
              Your password has been reset. You can now sign in with your new password.
            </Text>
            <Pressable onPress={() => router.replace('/(auth)/login')}>
              {({ pressed }) => (
                <View style={[s.btnPrimary, pressed && { opacity: 0.78 }]}>
                  <Text style={s.btnPrimaryText}>Sign In</Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

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
          {/* Header */}
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
            <Text style={s.screenTitle}>Reset password</Text>
            <Text style={s.screenSub}>Enter your new password below.</Text>
          </View>

          {/* Glass card */}
          <View style={s.card}>

            {/* New password */}
            <View style={s.fieldGroup}>
              <Text style={s.label}>New Password</Text>
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
                      autoFocus
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

            {/* Confirm password */}
            <View style={s.fieldGroup}>
              <Text style={s.label}>Confirm Password</Text>
              <Controller
                control={control}
                name="confirmPassword"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View style={[s.inputRow, !!errors.confirmPassword && s.inputError]}>
                    <TextInput
                      style={s.inputFlex}
                      placeholderTextColor={COLORS.textMuted}
                      placeholder="••••••••"
                      secureTextEntry={!showConfirm}
                      autoCapitalize="none"
                      autoCorrect={false}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                    />
                    <Pressable onPress={() => setShowConfirm((v) => !v)} hitSlop={8}>
                      <Ionicons
                        name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color={COLORS.textMuted}
                      />
                    </Pressable>
                  </View>
                )}
              />
              {errors.confirmPassword && <Text style={s.errorText}>{errors.confirmPassword.message}</Text>}
            </View>

            <Pressable onPress={handleSubmit(onSubmit)} disabled={loading}>
              {({ pressed }) => (
                <View style={[s.btnPrimary, pressed && { opacity: 0.78 }]}>
                  {loading
                    ? <ActivityIndicator color="#ffffff" />
                    : <Text style={s.btnPrimaryText}>Reset Password</Text>
                  }
                </View>
              )}
            </Pressable>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 48 },
  centerContent: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },

  header: { alignItems: 'center', marginBottom: 24 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  logoBox: { width: 50, height: 50, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  logoLetter: { fontSize: 24, fontWeight: '900', color: '#ffffff' },
  logoText: { fontSize: 28, fontWeight: '700', color: '#ffffff', letterSpacing: -0.5 },
  logoAccent: { color: COLORS.accentLight },
  screenTitle: { fontSize: 24, fontWeight: '800', color: '#ffffff', letterSpacing: -0.4 },
  screenSub: { marginTop: 6, fontSize: 14, color: COLORS.textMuted },

  card: {
    backgroundColor: 'rgba(12,8,24,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.25)',
    borderRadius: 22,
    padding: 24,
  },

  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#9ca3af', marginBottom: 7, letterSpacing: 0.1 },
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

  btnPrimary: {
    backgroundColor: '#7c3aed',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 6,
  },
  btnPrimaryText: { color: '#ffffff', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },

  // State screens
  stateCard: {
    backgroundColor: 'rgba(12,8,24,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.25)',
    borderRadius: 22,
    padding: 28,
    alignItems: 'center',
    width: '100%',
  },
  errorIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  successIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  stateTitle: { fontSize: 22, fontWeight: '800', color: '#ffffff', marginBottom: 10, letterSpacing: -0.3 },
  stateBody: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
});
