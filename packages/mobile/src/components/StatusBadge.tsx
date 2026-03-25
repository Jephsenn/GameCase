import { View, Text } from 'react-native';
import type { DefaultLibraryType } from '@gamecase/shared';
import { COLORS } from '@/constants/theme';

interface StatusBadgeProps {
  status: DefaultLibraryType;
}

const STATUS_CONFIG: Record<DefaultLibraryType, { label: string; bg: string; text: string }> = {
  currently_playing: {
    label: 'Playing',
    bg: COLORS.accent,
    text: COLORS.textPrimary,
  },
  played: {
    label: 'Played',
    bg: COLORS.success,
    text: COLORS.textPrimary,
  },
  want_to_play: {
    label: 'Want to Play',
    bg: COLORS.textSecondary,
    text: COLORS.background,
  },
  backlog: {
    label: 'Backlog',
    bg: COLORS.warning,
    text: COLORS.background,
  },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <View
      className="rounded-full px-3 py-1"
      style={{ backgroundColor: config.bg }}
    >
      <Text
        className="text-xs font-semibold"
        style={{ color: config.text }}
      >
        {config.label}
      </Text>
    </View>
  );
}
