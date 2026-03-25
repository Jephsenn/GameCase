import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Toast from 'react-native-toast-message';

import { useAuthStore } from '@/store/auth.store';
import { COLORS } from '@/constants/theme';
import { updateMe, uploadAvatar } from '@/api/auth';

const schema = z.object({
  displayName: z.string().max(100, 'Max 100 characters').optional(),
  bio: z.string().max(500, 'Max 500 characters').optional(),
});

type FormData = z.infer<typeof schema>;

function DefaultAvatar({ size = 72 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: COLORS.card,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: COLORS.border,
      }}
    >
      <Ionicons name="person" size={size * 0.5} color="#64748b" />
    </View>
  );
}

export default function EditProfileModal() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatarUrl ?? null);
  const [avatarChanged, setAvatarChanged] = useState(false);
  const [saving, setSaving] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: user?.displayName ?? '',
      bio: user?.bio ?? '',
    },
  });

  useEffect(() => {
    if (user) {
      reset({ displayName: user.displayName ?? '', bio: user.bio ?? '' });
      setAvatarUri(user.avatarUrl ?? null);
    }
  }, [user, reset]);

  const handlePickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setAvatarUri(result.assets[0].uri);
    setAvatarChanged(true);
  };

  const onSave = handleSubmit(async (values) => {
    setSaving(true);
    try {
      let updatedUser = user;

      if (avatarChanged && avatarUri) {
        const newUrl = await uploadAvatar(avatarUri);
        if (updatedUser) {
          updatedUser = { ...updatedUser, avatarUrl: newUrl };
        }
      }

      const patched = await updateMe({
        displayName: values.displayName || undefined,
        bio: values.bio || undefined,
      });
      setUser({ ...(updatedUser ?? patched), ...patched });

      Toast.show({ type: 'success', text1: 'Profile saved' });
      router.back();
    } catch {
      Toast.show({ type: 'error', text1: 'Could not save profile' });
    } finally {
      setSaving(false);
    }
  });

  const canSave = (isDirty || avatarChanged) && !saving;
  const displayName = (user?.displayName ?? user?.username ?? '').trim();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── Nav header ── */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <Pressable onPress={() => router.back()} hitSlop={8} className="active:opacity-60">
            <Text className="text-base text-[#94a3b8]">Cancel</Text>
          </Pressable>
          <Text className="text-base font-bold text-[#f1f5f9]">Edit Profile</Text>
          <Pressable
            onPress={onSave}
            disabled={!canSave}
            hitSlop={8}
            className="active:opacity-60"
          >
            {saving ? (
              <ActivityIndicator size="small" color={COLORS.accent} />
            ) : (
              <Text
                className={`text-base font-semibold ${canSave ? 'text-accent-light' : 'text-border'}`}
              >
                Save
              </Text>
            )}
          </Pressable>
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
          {/* Avatar picker */}
          <View className="items-center mb-8">
            <Pressable onPress={handlePickAvatar} className="relative active:opacity-70">
              {avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={{ width: 72, height: 72, borderRadius: 36 }}
                  contentFit="cover"
                />
              ) : (
                <DefaultAvatar size={72} />
              )}
              <View
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  backgroundColor: COLORS.accent,
                  borderRadius: 10,
                  width: 22,
                  height: 22,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="camera" size={13} color="#fff" />
              </View>
            </Pressable>
            <Text className="text-xs text-[#94a3b8] mt-2">Tap to change photo</Text>
          </View>

          {/* Display Name */}
          <View className="mb-5">
            <Text className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-2">
              Display Name
            </Text>
            <Controller
              control={control}
              name="displayName"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Your display name"
                  placeholderTextColor={COLORS.textMuted}
                  maxLength={100}
                  className="bg-card rounded-xl px-4 py-3 text-[#f1f5f9] text-sm"
                />
              )}
            />
            {errors.displayName && (
              <Text className="text-xs text-danger mt-1">
                {errors.displayName.message}
              </Text>
            )}
          </View>

          {/* Bio */}
          <View className="mb-5">
            <Text className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-2">
              Bio
            </Text>
            <Controller
              control={control}
              name="bio"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Tell people a little about yourself"
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                  numberOfLines={4}
                  maxLength={500}
                  textAlignVertical="top"
                  className="bg-card rounded-xl px-4 py-3 text-[#f1f5f9] text-sm min-h-[96px]"
                />
              )}
            />
            {errors.bio && (
              <Text className="text-xs text-danger mt-1">{errors.bio.message}</Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
