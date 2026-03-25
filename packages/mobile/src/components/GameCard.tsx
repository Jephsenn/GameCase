import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import type { GameListItem } from '@gamecase/shared';
import RatingStars from './RatingStars';
import { COLORS } from '@/constants/theme';

interface GameCardProps {
  game: GameListItem;
  mode: 'grid' | 'list';
  onPress?: () => void;
  onLongPress?: () => void;
}

export default function GameCard({ game, mode, onPress, onLongPress }: GameCardProps) {
  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push(`/game/${game.slug}` as never);
    }
  };

  if (mode === 'list') {
    return (
      <Pressable
        onPress={handlePress}
        onLongPress={onLongPress}
        className="mx-4 mb-3 flex-row rounded-xl bg-card p-3 active:opacity-70"
      >
        <Image
          source={{ uri: game.coverImage || game.backgroundImage || undefined }}
          style={{ width: 80, height: 80, borderRadius: 8 }}
          contentFit="cover"
          placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
          transition={200}
        />
        <View className="ml-3 flex-1 justify-center">
          <Text
            className="text-base font-semibold text-[#f1f5f9]"
            numberOfLines={2}
          >
            {game.title}
          </Text>
          {game.genres.length > 0 && (
            <Text
              className="mt-1 text-xs text-[#94a3b8]"
              numberOfLines={1}
            >
              {game.genres.map((g) => g.name).join(', ')}
            </Text>
          )}
          {game.rating != null && (
            <View className="mt-1.5">
              <RatingStars rating={game.rating} size={12} />
            </View>
          )}
        </View>
      </Pressable>
    );
  }

  // Grid mode
  return (
    <Pressable
      onPress={handlePress}
      onLongPress={onLongPress}
        className="mb-3 flex-1 rounded-xl bg-card overflow-hidden mx-1.5 active:opacity-70"
    >
      <View>
        <Image
          source={{ uri: game.coverImage || game.backgroundImage || undefined }}
          style={{ aspectRatio: 16 / 9, width: '100%' }}
          contentFit="cover"
          placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
          transition={200}
        />
        {game.rating != null && (
          <View
            className="absolute top-2 right-2 rounded-md px-1.5 py-0.5"
            style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
          >
              <Text className="text-xs font-bold text-warning">
              {game.rating.toFixed(1)}
            </Text>
          </View>
        )}
      </View>
      <View className="p-2">
        <Text
          className="text-sm font-semibold text-[#f1f5f9]"
          numberOfLines={2}
        >
          {game.title}
        </Text>
        {game.genres.length > 0 && (
          <Text
            className="mt-0.5 text-xs text-[#94a3b8]"
            numberOfLines={1}
          >
            {game.genres.map((g) => g.name).join(', ')}
          </Text>
        )}
      </View>
    </Pressable>
  );
}
