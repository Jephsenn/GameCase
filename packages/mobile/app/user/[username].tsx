import { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { getPublicProfile, getPublicLibraries, type PublicLibrary } from '@/api/users';
import { getUserActivity, type ActivityItem } from '@/api/activity';
import {
  getFriendshipStatus,
  sendFriendRequest,
  respondToRequest,
  removeFriend,
  type FriendshipStatus,
} from '@/api/friends';
import ActivityCard from '@/components/ActivityCard';
import { queryKeys } from '@/constants/queryKeys';
import { COLORS } from '@/constants/theme';
import { useAuthStore } from '@/store/auth.store';

// ─── Friend status button row ─────────────────────────────────────────────────
interface FriendButtonRowProps {
  targetUserId: string;
  targetUsername: string;
}

function FriendButtonRow({ targetUserId, targetUsername }: FriendButtonRowProps) {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);

  // Skip if viewing own profile
  if (currentUser?.id === targetUserId) return null;

  const { data: statusData, isLoading } = useQuery({
    queryKey: queryKeys.friends.status(targetUsername),
    queryFn: () => getFriendshipStatus(targetUserId),
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.friends.status(targetUsername) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.friends.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.friends.pending });
    void queryClient.invalidateQueries({ queryKey: queryKeys.friends.sent });
  }, [queryClient, targetUsername]);

  const sendMutation = useMutation({
    mutationFn: () => sendFriendRequest(targetUsername),
    onSuccess: invalidate,
  });

  const respondMutation = useMutation({
    mutationFn: (payload: { id: string; action: 'accept' | 'decline' }) =>
      respondToRequest(payload.id, payload.action),
    onSuccess: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: (friendshipId: string) => removeFriend(friendshipId),
    onSuccess: invalidate,
  });

  if (isLoading) {
    return (
      <View className="items-center py-2">
        <ActivityIndicator color={COLORS.accent} />
      </View>
    );
  }

  const status: FriendshipStatus | undefined = statusData?.status;
  const friendshipId = statusData?.id;
  const direction = statusData?.direction;

  if (!status || status === 'declined') {
    return (
      <Pressable
        onPress={() => sendMutation.mutate()}
        disabled={sendMutation.isPending}
        className="bg-accent rounded-xl px-6 py-3 items-center active:opacity-70 disabled:opacity-40"
      >
        <Text className="text-sm font-bold text-white">Add Friend</Text>
      </Pressable>
    );
  }

  if (status === 'pending' && direction === 'received' && friendshipId) {
    // Incoming request — show Accept / Decline
    return (
      <View className="flex-row gap-3">
        <Pressable
          onPress={() => respondMutation.mutate({ id: friendshipId, action: 'accept' })}
          disabled={respondMutation.isPending}
          className="flex-1 bg-accent rounded-xl py-3 items-center active:opacity-70 disabled:opacity-40"
        >
          <Text className="text-sm font-bold text-white">Accept</Text>
        </Pressable>
        <Pressable
          onPress={() => respondMutation.mutate({ id: friendshipId, action: 'decline' })}
          disabled={respondMutation.isPending}
          className="flex-1 border border-accent rounded-xl py-3 items-center active:opacity-70 disabled:opacity-40"
        >
          <Text className="text-sm font-semibold text-accent-light">Decline</Text>
        </Pressable>
      </View>
    );
  }

  if (status === 'pending') {
    // Outgoing request
    return (
      <View className="border border-border rounded-xl px-6 py-3 items-center">
        <Text className="text-sm font-semibold text-[#94a3b8]">Request Sent</Text>
      </View>
    );
  }

  if (status === 'accepted' && friendshipId) {
    return (
      <View className="flex-row gap-3">
        <View className="flex-1 border border-success rounded-xl py-3 items-center">
          <Text className="text-sm font-semibold text-success">Friends</Text>
        </View>
        <Pressable
          onPress={() =>
            Alert.alert('Remove friend', `Remove ${targetUsername} from friends?`, [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Remove',
                style: 'destructive',
                onPress: () => removeMutation.mutate(friendshipId),
              },
            ])
          }
          className="border border-border rounded-xl px-4 py-3 items-center active:opacity-70">
          <Text className="text-sm text-[#94a3b8]">Remove</Text>
        </Pressable>
      </View>
    );
  }

  return null;
}

// ─── Library row ──────────────────────────────────────────────────────────────
interface LibraryRowProps {
  lib: PublicLibrary;
  isOwner: boolean;
  ownerUsername: string;
}

function LibraryRow({ lib, isOwner, ownerUsername }: LibraryRowProps) {
  const handlePress = () => {
    if (isOwner) {
      router.push(`/library/${lib.slug}`);
    } else {
      router.push({
        pathname: '/library/[slug]',
        params: { slug: lib.slug, username: ownerUsername },
      } as never);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      className="flex-row items-center bg-card rounded-xl px-4 py-3 mb-2 active:opacity-70"
    >
      <Ionicons name="library-outline" size={20} color={COLORS.textSecondary} />
      <View className="ml-3 flex-1">
        <Text className="text-sm font-semibold text-[#f1f5f9]" numberOfLines={1}>
          {lib.name}
        </Text>
        <Text className="text-xs text-[#94a3b8]">{lib.itemCount} games</Text>
      </View>
      <View
        className={`rounded-full px-2 py-0.5 ${
          lib.visibility === 'public' ? 'bg-success/20' : 'bg-border'
        }`}
      >
        <Text
          className={`text-[10px] font-semibold ${
            lib.visibility === 'public' ? 'text-success' : 'text-[#94a3b8]'
          }`}
        >
          {lib.visibility}
        </Text>
      </View>
    </Pressable>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const currentUser = useAuthStore((s) => s.user);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: queryKeys.users.profile(username),
    queryFn: () => getPublicProfile(username),
    enabled: !!username,
  });

  const { data: libraries } = useQuery({
    queryKey: ['users', 'libraries', username],
    queryFn: () => getPublicLibraries(username),
    enabled: !!username,
  });

  const { data: activityData } = useQuery({
    queryKey: ['users', 'activity', profile?.id],
    queryFn: () => getUserActivity(profile!.id, 1, 5),
    enabled: !!profile?.id,
  });

  const handleGamePress = useCallback((slug: string) => {
    router.push(`/game/${slug}`);
  }, []);

  const handleUserPress = useCallback((uname: string) => {
    router.push(`/user/${uname}` as never);
  }, []);

  const isOwner = currentUser?.id === profile?.id;
  const initials = profile
    ? (profile.displayName ?? profile.username).charAt(0).toUpperCase()
    : '?';

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Back header */}
      <View className="flex-row items-center px-4 pt-2 pb-3">
        <Pressable onPress={() => router.back()} className="mr-3 active:opacity-70 p-1">
          <Ionicons name="arrow-back" size={24} color={COLORS.textSecondary} />
        </Pressable>
        <Text className="text-lg font-bold text-[#f1f5f9]" numberOfLines={1}>
          {username}
        </Text>
      </View>

      {profileLoading || !profile ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={COLORS.accent} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar + info */}
          <View className="items-center px-6 py-4">
            {profile.avatarUrl ? (
              <Image
                source={{ uri: profile.avatarUrl }}
                style={{ width: 72, height: 72, borderRadius: 36 }}
                contentFit="cover"
              />
            ) : (
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: COLORS.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: COLORS.textPrimary, fontSize: 28, fontWeight: '700' }}>
                  {initials}
                </Text>
              </View>
            )}
            <Text className="mt-3 text-xl font-bold text-[#f1f5f9]">
              {profile.displayName ?? profile.username}
            </Text>
            <Text className="text-sm text-[#94a3b8]">@{profile.username}</Text>
            {profile.bio ? (
              <Text className="mt-2 text-sm text-[#94a3b8] text-center">{profile.bio}</Text>
            ) : null}
          </View>

          {/* Friend button */}
          <View className="mx-4 mb-4">
            <FriendButtonRow targetUserId={profile.id} targetUsername={profile.username} />
          </View>

          {/* Stats */}
          {libraries && libraries.length > 0 ? (
            <View className="mx-4 bg-card rounded-xl px-4 py-3 mb-4 flex-row items-center">
              <Ionicons name="library-outline" size={18} color={COLORS.textSecondary} />
              <Text className="ml-2 text-sm text-[#94a3b8]">
                {libraries.length} {libraries.length === 1 ? 'library' : 'libraries'}
              </Text>
            </View>
          ) : null}

          {/* Libraries section */}
          {libraries && libraries.length > 0 ? (
            <View className="mx-4 mb-4">
              <Text className="text-xs font-bold text-[#64748b] uppercase tracking-widest mb-3">
                Libraries
              </Text>
              {libraries.map((lib) => (
                <LibraryRow key={lib.id} lib={lib} isOwner={isOwner} ownerUsername={username} />
              ))}
            </View>
          ) : null}

          {/* Activity section */}
          {activityData && activityData.items.length > 0 ? (
            <View className="mb-4">
              <Text className="px-4 text-xs font-bold text-[#64748b] uppercase tracking-widest mb-3">
                Recent Activity
              </Text>
              {activityData.items.map((item: ActivityItem) => (
                <ActivityCard
                  key={item.id}
                  item={item}
                  onGamePress={handleGamePress}
                  onUserPress={handleUserPress}
                />
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
