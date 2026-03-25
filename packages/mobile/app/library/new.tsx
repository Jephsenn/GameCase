import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { createLibrary } from '@/api/library';
import { queryKeys } from '@/constants/queryKeys';
import { COLORS } from '@/constants/theme';

export default function NewLibraryScreen() {
  const qc = useQueryClient();
  const titleRef = useRef<TextInput>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('private');

  const mutation = useMutation({
    mutationFn: () =>
      createLibrary({
        name: name.trim(),
        description: description.trim() || undefined,
        visibility,
      }),
    onSuccess: () => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      qc.invalidateQueries({ queryKey: queryKeys.libraries.all });
      router.back();
    },
  });

  const canSubmit = name.trim().length > 0 && !mutation.isPending;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View className="flex-row items-center justify-between mb-8">
            <Text className="text-2xl font-bold text-[#f1f5f9]">New Library</Text>
            <Pressable
              onPress={() => router.back()}
              className="h-9 w-9 items-center justify-center rounded-full bg-card active:opacity-70"
            >
              <Ionicons name="close" size={22} color={COLORS.textSecondary} />
            </Pressable>
          </View>

          {/* Name */}
          <Text className="text-sm font-semibold text-[#94a3b8] mb-2">
            Library Name <Text className="text-danger">*</Text>
          </Text>
          <TextInput
            ref={titleRef}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Favorites, Completed 2026"
            placeholderTextColor={COLORS.textMuted}
            maxLength={100}
            autoFocus
            returnKeyType="next"
            className="rounded-xl bg-card p-4 text-[#f1f5f9] text-base mb-1"
          />
          <Text className="text-xs text-[#64748b] mb-5 text-right">{name.length} / 100</Text>

          {/* Description */}
          <Text className="text-sm font-semibold text-[#94a3b8] mb-2">
            Description <Text className="text-[#64748b]">(optional)</Text>
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What's this library for?"
            placeholderTextColor={COLORS.textMuted}
            maxLength={500}
            multiline
            numberOfLines={3}
            className="rounded-xl bg-card p-4 text-[#f1f5f9] text-base mb-1"
            style={{ minHeight: 80, textAlignVertical: 'top' }}
          />
          <Text className="text-xs text-[#64748b] mb-6 text-right">
            {description.length} / 500
          </Text>

          {/* Visibility */}
          <Text className="text-sm font-semibold text-[#94a3b8] mb-3">Visibility</Text>
          <View className="flex-row gap-3 mb-8">
            <Pressable
              onPress={() => setVisibility('private')}
              className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3.5 active:opacity-70 ${
                visibility === 'private' ? 'bg-accent' : 'bg-card'
              }`}
            >
              <Ionicons
                name="lock-closed"
                size={16}
                color={visibility === 'private' ? '#fff' : COLORS.textSecondary}
              />
              <Text
                className={`text-sm font-semibold ${
                  visibility === 'private' ? 'text-white' : 'text-[#94a3b8]'
                }`}
              >
                Private
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setVisibility('public')}
              className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3.5 active:opacity-70 ${
                visibility === 'public' ? 'bg-accent' : 'bg-card'
              }`}
            >
              <Ionicons
                name="globe"
                size={16}
                color={visibility === 'public' ? '#fff' : COLORS.textSecondary}
              />
              <Text
                className={`text-sm font-semibold ${
                  visibility === 'public' ? 'text-white' : 'text-[#94a3b8]'
                }`}
              >
                Public
              </Text>
            </Pressable>
          </View>

          {/* Error */}
          {mutation.isError && (
            <Text className="text-danger text-sm mb-4 text-center">
              Something went wrong. Please try again.
            </Text>
          )}

          {/* Actions */}
          <Pressable
            onPress={() => mutation.mutate()}
            disabled={!canSubmit}
            className={`rounded-xl py-4 items-center mb-3 active:opacity-70 ${
              canSubmit ? 'bg-accent' : 'bg-border'
            }`}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text
                className={`text-base font-semibold ${canSubmit ? 'text-white' : 'text-[#64748b]'}`}
              >
                Create Library
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => router.back()}
            className="rounded-xl border border-border py-4 items-center active:opacity-70"
          >
            <Text className="text-base font-medium text-[#94a3b8]">Cancel</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
