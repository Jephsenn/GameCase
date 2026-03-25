import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/theme';

interface RatingStarsProps {
  rating: number; // 0–5
  size?: number;
  showCount?: number;
}

export default function RatingStars({ rating, size = 16, showCount }: RatingStarsProps) {
  const stars: React.ReactNode[] = [];
  const clamped = Math.max(0, Math.min(5, rating));

  for (let i = 1; i <= 5; i++) {
    if (clamped >= i) {
      stars.push(
        <Ionicons key={i} name="star" size={size} color={COLORS.warning} />,
      );
    } else if (clamped >= i - 0.5) {
      stars.push(
        <Ionicons key={i} name="star-half" size={size} color={COLORS.warning} />,
      );
    } else {
      stars.push(
        <Ionicons key={i} name="star-outline" size={size} color={COLORS.textMuted} />,
      );
    }
  }

  return (
    <View className="flex-row items-center gap-0.5">
      {stars}
      {showCount !== undefined && (
        <View className="ml-1">
          <Ionicons name="people-outline" size={size - 2} color={COLORS.textMuted} />
        </View>
      )}
    </View>
  );
}
