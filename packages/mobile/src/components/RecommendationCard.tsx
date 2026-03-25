import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import type { Recommendation } from '@/api/recommendations';
import RatingStars from './RatingStars';

interface RecommendationCardProps {
  recommendation: Recommendation;
  onPress: () => void;
  onDismiss: () => void;
}

export default function RecommendationCard({
  recommendation,
  onPress,
  onDismiss,
}: RecommendationCardProps) {
  const { game, reason } = recommendation;

  return (
    <Pressable
      onPress={onPress}
      className="flex-row bg-card rounded-xl mb-3 p-3 active:opacity-80"
    >
      {/* Cover Image */}
      <Image
        source={{ uri: game.backgroundImage ?? undefined }}
        style={{ width: 64, height: 80, borderRadius: 8 }}
        contentFit="cover"
      />

      {/* Info */}
      <View className="flex-1 ml-3 justify-between">
        <View>
          <Text
            className="text-[#f1f5f9] font-bold text-sm"
            numberOfLines={2}
          >
            {game.title}
          </Text>
          <Text
            className="mt-1 text-xs text-[#94a3b8]"
            numberOfLines={2}
          >
            {reason}
          </Text>
        </View>

        {/* Bottom row */}
        <View className="flex-row items-center justify-between mt-2">
          <RatingStars rating={game.rating ?? 0} size={13} />
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            hitSlop={8}
            className="active:opacity-60"
          >
            <Text className="text-xs text-danger font-medium">Dismiss</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}
