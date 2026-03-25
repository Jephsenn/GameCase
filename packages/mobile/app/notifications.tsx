import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import EmptyState from '@/components/EmptyState';
import { COLORS } from '@/constants/theme';

export default function NotificationsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center px-4 pb-3 pt-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          className="mr-3 active:opacity-60"
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.textSecondary} />
        </Pressable>
        <Text className="text-2xl font-bold text-[#f1f5f9]">Notifications</Text>
      </View>

      {/* TODO: wire up push notifications — see MOBILE_POLISH_PROMPT.md Gap 9 */}
      <EmptyState
        icon="notifications-outline"
        title="Notifications"
        subtitle="Push notifications are coming soon."
      />
    </SafeAreaView>
  );
}
