import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/theme';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
}

export default function EmptyState({ icon, title, subtitle, action }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-8 py-16">
      <Ionicons name={icon} size={56} color={COLORS.textMuted} />
      <Text className="mt-4 text-lg font-bold text-[#f1f5f9] text-center">{title}</Text>
      {subtitle ? (
        <Text className="mt-2 text-sm text-[#94a3b8] text-center">{subtitle}</Text>
      ) : null}
      {action ? (
        <Pressable
          onPress={action.onPress}
          className="mt-6 rounded-xl bg-accent px-6 py-3 active:opacity-70"
        >
          <Text className="text-sm font-semibold text-white">{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
