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
import { router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { forgotPassword } from '@/api/auth';
import { COLORS } from '@/constants/theme';

const schema = z.object({
  email: z.string().email('Invalid email address'),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordScreen() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      await forgotPassword(data.email);
      setSent(true);
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Something went wrong',
        text2: 'Please try again later.',
      });
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <View style={s.root}>
        <AuthBackground />
        <View style={[StyleSheet.absoluteFill, s.centerContent]}>
          <View style={s.confirmCard}>
            <View style={s.confirmIconWrap}>
              <Ionicons name="mail-open-outline" size={36} color="#a78bfa" />
            </View>
            <Text style={s.confirmTitle}>Check your email</Text>
            <Text style={s.confirmBody}>
              If an account exists for{' '}
              <Text style={s.confirmEmail}>{getValues('email')}</Text>
              , a password reset link has been sent.
            </Text>
            <Pressable onPress={() => router.replace('/(auth)/login')}>
              {({ pressed }) => (
                <View style={[s.btnPrimary, pressed && { opacity: 0.78 }]}>
                  <Text style={s.btnPrimaryText}>Back to Sign In</Text>
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
          {/* Back button */}
          <Pressable onPress={() => router.back()} hitSlop={8} style={s.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textSecondary} />
          </Pressable>

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
            <Text style={s.screenTitle}>Forgot password?</Text>
            <Text style={s.screenSub}>We’ll email you a reset link.</Text>
          </View>

          {/* Glass card */}
          <View style={s.card}>
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
                    autoFocus
                  />
                )}
              />
              {errors.email && <Text style={s.errorText}>{errors.email.message}</Text>}
            </View>

            <Pressable onPress={handleSubmit(onSubmit)} disabled={loading}>
              {({ pressed }) => (
                <View style={[s.btnPrimary, pressed && { opacity: 0.78 }]}>
                  {loading
                    ? <ActivityIndicator color="#ffffff" />
                    : <Text style={s.btnPrimaryText}>Send Reset Link</Text>
                  }
                </View>
              )}
            </Pressable>

            <Pressable onPress={() => router.back()} style={s.backLink}>
              <Text style={s.backLinkText}>Back to Sign In</Text>
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

  backBtn: { marginBottom: 24 },

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
  inputError: { borderColor: 'rgba(239,68,68,0.65)' },
  errorText: { marginTop: 5, fontSize: 12, color: '#ef4444' },

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

  backLink: { alignItems: 'center' },
  backLinkText: { fontSize: 14, color: COLORS.textMuted },

  // Confirmation screen
  confirmCard: {
    backgroundColor: 'rgba(12,8,24,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.25)',
    borderRadius: 22,
    padding: 28,
    alignItems: 'center',
    width: '100%',
  },
  confirmIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(124,58,237,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  confirmTitle: { fontSize: 22, fontWeight: '800', color: '#ffffff', marginBottom: 10, letterSpacing: -0.3 },
  confirmBody: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  confirmEmail: { color: COLORS.accentLight, fontWeight: '600' },
});
