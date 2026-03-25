import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/theme';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
}

export default function StatCard({
  label,
  value,
  icon,
  color = COLORS.accent,
}: StatCardProps) {
  return (
    <View className="flex-1 rounded-xl bg-card p-4 items-center">
      <Ionicons name={icon} size={22} color={color} />
      <Text
        className="mt-2 text-xl font-bold text-[#f1f5f9]"
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text className="mt-0.5 text-xs text-[#64748b] text-center" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
