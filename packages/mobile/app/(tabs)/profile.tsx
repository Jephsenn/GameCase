import { useState } from 'react';
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
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';

import { useAuthStore } from '@/store/auth.store';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/constants/queryKeys';
import { COLORS } from '@/constants/theme';
import { getMe, uploadAvatar, deleteAccount } from '@/api/auth';
import { getUserStats } from '@/api/library';
import { createPortalSession } from '@/api/billing';
import StatCard from '@/components/StatCard';

function DefaultAvatar({ size = 80 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#1e293b',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#334155',
      }}
    >
      <Ionicons name="person" size={size * 0.5} color="#64748b" />
    </View>
  );
}

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const queryClient = useQueryClient();
  const [avatarUploading, setAvatarUploading] = useState(false);

  const isPro = user?.plan === 'pro';

  // Always refresh user from API on mount to keep store in sync
  useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: async () => {
      const me = await getMe();
      setUser(me);
      return me;
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: getUserStats,
    enabled: isPro,
  });

  const handlePickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setAvatarUploading(true);
    try {
      const avatarUrl = await uploadAvatar(asset.uri, asset.mimeType ?? 'image/jpeg');
      if (user) {
        setUser({ ...user, avatarUrl });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
      Toast.show({ type: 'success', text1: 'Avatar updated' });
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to upload avatar' });
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const { url } = await createPortalSession();
      await WebBrowser.openBrowserAsync(url);
    } catch {
      Toast.show({ type: 'error', text1: 'Could not open subscription portal' });
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await clearAuth();
          queryClient.clear();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount();
              await clearAuth();
              queryClient.clear();
              router.replace('/(auth)/login');
            } catch {
              Toast.show({ type: 'error', text1: 'Failed to delete account' });
            }
          },
        },
      ],
    );
  };

  if (!user?.username) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center" edges={['top']}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </SafeAreaView>
    );
  }

  const displayName = (user.displayName ?? user.username ?? '').trim() || user.username || '?';
  const topGenre = stats?.topGenres?.[0]?.name ?? '—';

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Header ── */}
        <View className="items-center px-6 pt-8 pb-6">
          {/* Avatar */}
          <Pressable onPress={handlePickAvatar} className="relative">
            {user.avatarUrl ? (
              <Image
                source={{ uri: user.avatarUrl }}
                style={{ width: 80, height: 80, borderRadius: 40 }}
                contentFit="cover"
              />
            ) : (
              <DefaultAvatar size={80} />
            )}
            {avatarUploading && (
              <View
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 40,
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ActivityIndicator color="#fff" />
              </View>
            )}
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                backgroundColor: COLORS.accent,
                borderRadius: 10,
                width: 22,
                height: 22,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="camera" size={13} color="#fff" />
            </View>
          </Pressable>

          {/* Name + Pro badge */}
          <View className="flex-row items-center mt-3 gap-2">
            <Text className="text-xl font-bold text-[#f1f5f9]">{displayName}</Text>
            {isPro && (
              <View className="bg-warning rounded px-2 py-0.5">
                <Text className="text-black text-xs font-bold">PRO</Text>
              </View>
            )}
          </View>

          <Text className="text-sm text-[#94a3b8] mt-0.5">@{user.username}</Text>

          {user.bio ? (
            <Text className="text-sm text-[#94a3b8] mt-2 text-center">{user.bio}</Text>
          ) : null}

          {/* Edit Profile button */}
          <Pressable
            onPress={() => router.push('/profile/edit')}
            className="mt-4 border border-accent rounded-lg px-6 py-2 active:opacity-70"
          >
              <Text className="text-sm font-semibold text-accent-light">Edit Profile</Text>
          </Pressable>

          {/* Upgrade button (free users) */}
          {!isPro && (
            <Pressable
              onPress={() => router.push('/billing/upgrade')}
              className="mt-3 w-full bg-accent rounded-lg py-3 items-center active:opacity-80"
            >
              <Text className="text-sm font-bold text-white">✦  Upgrade to Pro</Text>
            </Pressable>
          )}
        </View>

        {/* ── Year in Review (Pro only) ── */}
        {isPro && stats && (
          <View className="px-4 pb-6">
            <Text className="text-base font-bold text-[#f1f5f9] mb-3">
              Year in Review
            </Text>

            {/* Stat grid row 1 */}
            <View className="flex-row gap-3 mb-3">
              <StatCard
                label="Games Tracked"
                value={stats.totalGamesTracked}
                icon="game-controller"
              />
              <StatCard
                label="Avg Rating"
                value={
                  stats.averageRating != null ? stats.averageRating.toFixed(1) : '—'
                }
                icon="star"
                color={COLORS.warning}
              />
            </View>
            {/* Stat grid row 2 */}
            <View className="flex-row gap-3 mb-4">
              <StatCard
                label="Added This Year"
                value={stats.gamesAddedThisYear}
                icon="calendar"
                color={COLORS.success}
              />
              <StatCard
                label="Top Genre"
                value={topGenre}
                icon="musical-notes"
                color={COLORS.accentLight}
              />
              <StatCard
                label="Friends"
                value={stats.friendCount}
                icon="people"
                color={COLORS.textSecondary}
              />
            </View>

            {/* Top Rated Games */}
            {stats.topRatedGames.length > 0 && (
              <>
                <Text className="text-sm font-semibold text-[#f1f5f9] mb-2">
                  Top Rated Games
                </Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {stats.topRatedGames.map((game) => (
                    <Pressable
                      key={game.slug}
                      onPress={() => router.push(`/game/${game.slug}`)}
                      style={{ flex: 1 }}
                      className="active:opacity-70"
                    >
                      <Image
                        source={{ uri: game.backgroundImage ?? undefined }}
                        style={{ width: '100%', aspectRatio: 1.56, borderRadius: 8 }}
                        contentFit="cover"
                      />
                      <Text
                        className="text-xs text-[#f1f5f9] mt-1 font-medium"
                        numberOfLines={1}
                      >
                        {game.title}
                      </Text>
                      <View className="flex-row items-center mt-0.5">
                        <Ionicons name="star" size={11} color={COLORS.warning} />
                        <Text className="text-xs text-[#94a3b8] ml-1">
                          {game.userRating.toFixed(1)}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
          </View>
        )}

        {/* ── Quick Links ── */}
        <View className="px-4 pb-4">
          <Text className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-2">
            Quick Links
          </Text>
          <View className="bg-card rounded-xl overflow-hidden">
            <QuickLink
              icon="bulb-outline"
              label="My Recommendations"
              onPress={() => router.push('/recommendations')}
            />
            <Separator />
            <QuickLink
              icon="logo-steam"
              label="Steam Import"
              badge={!isPro ? 'Pro' : undefined}
              onPress={() => router.push('/steam')}
            />
            <Separator />
            <QuickLink
              icon="card-outline"
              label="Manage Subscription"
              onPress={handleManageSubscription}
            />
            <Separator />
            <QuickLink
              icon="notifications-outline"
              label="Notifications"
              onPress={() => router.push('/notifications' as never)}
            />
          </View>
        </View>

        {/* ── Danger Zone ── */}
        <View className="px-4 pb-10">
          <Text className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-2">
            Account
          </Text>
          <Pressable
            onPress={handleSignOut}
            className="border border-danger rounded-lg py-3 items-center mb-3 active:opacity-70"
          >
            <Text className="text-sm font-semibold text-danger">Sign Out</Text>
          </Pressable>
          <Pressable
            onPress={handleDeleteAccount}
            className="border border-border rounded-lg py-3 items-center active:opacity-70"
          >
            <Text className="text-sm text-[#64748b]">Delete Account</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ──────────────────────────────────

interface QuickLinkProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  badge?: string;
  onPress: () => void;
}

function QuickLink({ icon, label, badge, onPress }: QuickLinkProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-4 py-3.5 active:bg-border"
    >
      <Ionicons name={icon} size={20} color={COLORS.textSecondary} />
      <Text className="flex-1 ml-3 text-sm text-[#f1f5f9]">{label}</Text>
      {badge && (
        <View className="bg-warning rounded px-1.5 py-0.5 mr-2">
          <Text className="text-black text-xs font-bold">{badge}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
    </Pressable>
  );
}

function Separator() {
  return <View className="h-px bg-border ml-12" />;
}
