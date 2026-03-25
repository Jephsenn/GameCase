import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import type { ActivityItem } from '@/api/activity';
import { relativeTime } from '@/lib/time';
import { COLORS } from '@/constants/theme';

interface ActivityCardProps {
  item: ActivityItem;
  onGamePress: (slug: string) => void;
  onUserPress: (username: string) => void;
}

function getActivityText(item: ActivityItem): string {
  const title = item.game?.title ?? '';
  switch (item.type) {
    case 'game_added':
      return `added ${title} to their library`;
    case 'game_completed':
      return `completed ${title}`;
    case 'game_rated': {
      const stars = item.metadata && typeof item.metadata['rating'] === 'number'
        ? item.metadata['rating']
        : null;
      return stars !== null ? `rated ${title} ${stars}/5 stars` : `rated ${title}`;
    }
    case 'friend_added':
      return 'made a new friend';
    case 'library_created':
      return 'created a new library';
    default:
      return 'did something';
  }
}

export default function ActivityCard({ item, onGamePress, onUserPress }: ActivityCardProps) {
  const { user } = item;
  const initials = (user.displayName ?? user.username).charAt(0).toUpperCase();
  const activityText = getActivityText(item);

  return (
    <View className="bg-card rounded-xl mb-3 p-3 mx-4 flex-row">
      {/* Avatar */}
      <Pressable onPress={() => onUserPress(user.username)} className="active:opacity-70">
        {user.avatarUrl ? (
          <Image
            source={{ uri: user.avatarUrl }}
            style={{ width: 36, height: 36, borderRadius: 18 }}
            contentFit="cover"
          />
        ) : (
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: COLORS.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' }}>
              {initials}
            </Text>
          </View>
        )}
      </Pressable>

      {/* Content */}
      <View className="ml-3 flex-1">
        {/* Top row: name + time */}
        <View className="flex-row items-center justify-between mb-1">
          <Pressable onPress={() => onUserPress(user.username)} className="active:opacity-70">
            <Text className="text-sm font-bold text-[#f1f5f9]">
              {user.displayName ?? user.username}
            </Text>
          </Pressable>
          <Text className="text-xs text-[#64748b]">{relativeTime(item.createdAt)}</Text>
        </View>

        {/* Activity description */}
        <Text className="text-sm text-[#94a3b8]">{activityText}</Text>

        {/* Game thumbnail */}
        {item.game ? (
          <Pressable
            onPress={() => onGamePress(item.game!.slug)}
            className="mt-2 flex-row items-center gap-2 active:opacity-70"
          >
            {item.game.coverImage ? (
              <Image
                source={{ uri: item.game.coverImage }}
                style={{ width: 40, height: 40, borderRadius: 6 }}
                contentFit="cover"
              />
            ) : (
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 6,
                  backgroundColor: COLORS.border,
                }}
              />
            )}
            <Text className="text-xs font-semibold text-[#f1f5f9] flex-1" numberOfLines={2}>
              {item.game.title}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
