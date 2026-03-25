import { Pressable, View, Text } from 'react-native';
import { Image } from 'expo-image';
import type { PublicUser } from '@/api/friends';
import { COLORS } from '@/constants/theme';

export interface UserRowProps {
  user: PublicUser;
  onPress?: () => void;
  right?: React.ReactNode;
}

export default function UserRow({ user, onPress, right }: UserRowProps) {
  const initials = (user.displayName ?? user.username).charAt(0).toUpperCase();

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-4 py-3 active:opacity-70"
      android_ripple={{ color: COLORS.border }}
    >
      {/* Avatar */}
      {user.avatarUrl ? (
        <Image
          source={{ uri: user.avatarUrl }}
          style={{ width: 40, height: 40, borderRadius: 20 }}
          contentFit="cover"
        />
      ) : (
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: COLORS.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: COLORS.textPrimary, fontSize: 16, fontWeight: '600' }}>
            {initials}
          </Text>
        </View>
      )}

      {/* Name block */}
      <View className="ml-3 flex-1">
        <Text className="text-sm font-bold text-[#f1f5f9]" numberOfLines={1}>
          {user.displayName ?? user.username}
        </Text>
        <Text className="text-xs text-[#94a3b8]" numberOfLines={1}>
          @{user.username}
        </Text>
      </View>

      {/* Right slot */}
      {right ? <View className="ml-2">{right}</View> : null}
    </Pressable>
  );
}
