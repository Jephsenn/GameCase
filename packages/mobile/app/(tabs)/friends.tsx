import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

import {
  getFriends,
  getPendingRequests,
  getSentRequests,
  sendFriendRequest,
  respondToRequest,
  removeFriend,
  type Friendship,
  type FriendItem,
} from '@/api/friends';
import { searchUsers, type PublicUserProfile } from '@/api/users';
import UserRow from '@/components/UserRow';
import EmptyState from '@/components/EmptyState';
import { queryKeys } from '@/constants/queryKeys';
import { COLORS } from '@/constants/theme';

type Tab = 'friends' | 'requests' | 'find';

// ─── Debounce hook ───────────────────────────────────────────────────────────
function useDebounce(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

// ─── Tab toggle ──────────────────────────────────────────────────────────────
function TabBar({
  active,
  onChange,
  pendingCount,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
  pendingCount: number;
}) {
  const tabs: { key: Tab; label: string }[] = [
    { key: 'friends', label: 'Friends' },
    { key: 'requests', label: 'Requests' },
    { key: 'find', label: 'Find People' },
  ];

  return (
    <View className="flex-row mx-4 mb-4 bg-card rounded-xl p-1">
      {tabs.map((t) => (
        <Pressable
          key={t.key}
          onPress={() => onChange(t.key)}
          className={`flex-1 py-2 rounded-lg items-center active:opacity-80 ${
            active === t.key ? 'bg-accent' : ''
          }`}
        >
          <View className="flex-row items-center gap-1">
            <Text
              className={`text-xs font-semibold ${
                active === t.key ? 'text-white' : 'text-[#94a3b8]'
              }`}
            >
              {t.label}
            </Text>
            {t.key === 'requests' && pendingCount > 0 ? (
              <View className="bg-danger rounded-full min-w-[16px] h-[16px] items-center justify-center px-1">
                <Text className="text-white text-[9px] font-bold">{pendingCount}</Text>
              </View>
            ) : null}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

// ─── Friends view ────────────────────────────────────────────────────────────
function FriendsView() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, isRefetching, refetch } = useQuery({
    queryKey: queryKeys.friends.all,
    queryFn: getFriends,
  });

  const removeMutation = useMutation({
    mutationFn: (friendshipId: string) => removeFriend(friendshipId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.friends.all });
    },
  });

  const confirmRemove = (item: FriendItem) => {
    Alert.alert(
      'Remove friend',
      `Remove ${item.displayName ?? item.username} from friends?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeMutation.mutate(item.friendshipId),
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color={COLORS.accent} />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="mx-4 mt-6 rounded-xl bg-card p-6 items-center">
        <Text className="text-base font-semibold text-[#f1f5f9]">Couldn&apos;t load friends</Text>
        <Text className="mt-1 text-sm text-[#94a3b8] text-center">
          Check your connection and try again.
        </Text>
        <Pressable
          onPress={() => void refetch()}
          className="mt-4 rounded-lg bg-accent px-6 py-2.5 active:opacity-70"
        >
          <Text className="text-sm font-semibold text-white">Retry</Text>
        </Pressable>
      </View>
    );
  }

  const friends = data ?? [];

  return (
    <FlatList
      data={friends}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          tintColor={COLORS.accent}
          colors={[COLORS.accent]}
        />
      }
      contentContainerStyle={friends.length === 0 ? { flex: 1 } : { paddingBottom: 24 }}
      ListEmptyComponent={
        <EmptyState
          icon="person-add-outline"
          title="No friends yet"
          subtitle="Find people to add!"
        />
      }
      renderItem={({ item }) => (
        <UserRow
          user={item}
          onPress={() => router.push({ pathname: '/user/[username]', params: { username: item.username } } as never)}
          right={
            <Pressable
              onPress={() => confirmRemove(item)}
              className="border border-border rounded-lg px-3 py-1.5 active:opacity-70"
            >
              <Text className="text-xs text-[#94a3b8]">Remove</Text>
            </Pressable>
          }
        />
      )}
    />
  );
}

// ─── Requests view ───────────────────────────────────────────────────────────
function RequestsView() {
  const queryClient = useQueryClient();

  const { data: pending, isLoading: pendingLoading, isRefetching: pendingRefetching, refetch: refetchPending } = useQuery({
    queryKey: queryKeys.friends.pending,
    queryFn: getPendingRequests,
  });

  const { data: sent, isLoading: sentLoading, isRefetching: sentRefetching, refetch: refetchSent } = useQuery({
    queryKey: queryKeys.friends.sent,
    queryFn: getSentRequests,
  });

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.friends.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.friends.pending });
    void queryClient.invalidateQueries({ queryKey: queryKeys.friends.sent });
  };

  const respondMutation = useMutation({
    mutationFn: ({
      friendshipId,
      action,
    }: {
      friendshipId: string;
      action: 'accept' | 'decline';
    }) => respondToRequest(friendshipId, action),
    onSuccess: () => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      invalidateAll();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (friendshipId: string) => removeFriend(friendshipId),
    onSuccess: invalidateAll,
  });

  const isLoading = pendingLoading || sentLoading;

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color={COLORS.accent} />
      </View>
    );
  }

  const incomingList = pending ?? [];
  const sentList = sent ?? [];

  return (
    <FlatList
      data={[...incomingList.map((f) => ({ ...f, _section: 'incoming' as const })), ...sentList.map((f) => ({ ...f, _section: 'sent' as const }))]}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl
          refreshing={pendingRefetching || sentRefetching}
          onRefresh={() => { void refetchPending(); void refetchSent(); }}
          tintColor={COLORS.accent}
          colors={[COLORS.accent]}
        />
      }
      contentContainerStyle={{ paddingBottom: 24 }}
      ListHeaderComponent={
        <>
          <Text className="px-4 pt-2 pb-2 text-xs font-bold text-[#64748b] uppercase tracking-widest">
            Incoming ({incomingList.length})
          </Text>
          {incomingList.length === 0 ? (
            <Text className="px-4 py-3 text-sm text-[#64748b]">No incoming requests</Text>
          ) : null}
        </>
      }
      renderItem={({ item }) => {
        if (item._section === 'incoming') {
          return (
            <UserRow
              user={item.requester}
              onPress={() => router.push(`/user/${item.requester.username}` as never)}
              right={
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() =>
                      respondMutation.mutate({ friendshipId: item.id, action: 'accept' })
                    }
                    className="bg-accent rounded-lg px-3 py-1.5 active:opacity-70"
                  >
                    <Text className="text-xs font-semibold text-white">Accept</Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      respondMutation.mutate({ friendshipId: item.id, action: 'decline' })
                    }
                    className="border border-accent rounded-lg px-3 py-1.5 active:opacity-70"
                  >
                    <Text className="text-xs font-semibold text-accent-light">Decline</Text>
                  </Pressable>
                </View>
              }
            />
          );
        }
        // sent section — add a section header before the first sent item
        return (
          <UserRow
            user={item.recipient}
            onPress={() => router.push(`/user/${item.recipient.username}` as never)}
            right={
              <Pressable
                onPress={() => cancelMutation.mutate(item.id)}
                className="active:opacity-70"
              >
                <Text className="text-xs text-[#94a3b8]">Cancel</Text>
              </Pressable>
            }
          />
        );
      }}
      ListFooterComponent={
        <>
          <Text className="px-4 pt-4 pb-2 text-xs font-bold text-[#64748b] uppercase tracking-widest">
            Sent ({sentList.length})
          </Text>
          {sentList.length === 0 ? (
            <Text className="px-4 py-3 text-sm text-[#64748b]">No sent requests</Text>
          ) : null}
        </>
      }
    />
  );
}

// ─── Find People view ────────────────────────────────────────────────────────
function FindPeopleView() {
  const queryClient = useQueryClient();
  const [rawQuery, setRawQuery] = useState('');
  const [localSentIds, setLocalSentIds] = useState<Set<string>>(new Set());
  const debounced = useDebounce(rawQuery, 400);
  const enabled = debounced.length >= 2;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: queryKeys.users.search(debounced),
    queryFn: () => searchUsers(debounced),
    enabled,
  });

  const { data: sentRequests } = useQuery({
    queryKey: queryKeys.friends.sent,
    queryFn: getSentRequests,
  });

  const sentUserIds = new Set((sentRequests ?? []).map((r) => r.recipient.id));

  const sendMutation = useMutation({
    mutationFn: ({ username }: { id: string; username: string }) => sendFriendRequest(username),
    onSuccess: (_data, { id }) => {
      setLocalSentIds((prev) => new Set(prev).add(id));
      void queryClient.invalidateQueries({ queryKey: queryKeys.friends.sent });
    },
  });

  const users: PublicUserProfile[] = data ?? [];

  return (
    <View className="flex-1">
      {/* Search input */}
      <View className="mx-4 mb-4 flex-row items-center bg-card rounded-xl px-3 py-2 border border-border">
        <TextInput
          value={rawQuery}
          onChangeText={setRawQuery}
          placeholder="Search by username…"
          placeholderTextColor={COLORS.textMuted}
          className="flex-1 text-sm text-[#f1f5f9]"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {(isLoading || isFetching) && enabled ? (
          <ActivityIndicator size="small" color={COLORS.accent} />
        ) : null}
      </View>

      {!enabled ? (
        <EmptyState
          icon="search-outline"
          title="Find friends"
          subtitle="Search by username (min 2 chars)"
        />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          contentContainerStyle={users.length === 0 ? { flex: 1 } : { paddingBottom: 24 }}
          ListEmptyComponent={
            !isLoading ? (
              <EmptyState icon="person-outline" title="No users found" />
            ) : null
          }
          renderItem={({ item }) => (
            <UserRow
              user={item}
              onPress={() => router.push(`/user/${item.username}` as never)}
              right={
                (() => {
                  const alreadySent = sentUserIds.has(item.id) || localSentIds.has(item.id);
                  return (
                    <Pressable
                      onPress={() => !alreadySent && sendMutation.mutate({ id: item.id, username: item.username })}
                      disabled={alreadySent || sendMutation.isPending}
                      className={`rounded-lg px-3 py-1.5 ${
                        alreadySent ? 'bg-[#1e293b]' : 'bg-accent active:opacity-70'
                      }`}
                    >
                      <Text className={`text-xs font-semibold ${
                        alreadySent ? 'text-[#64748b]' : 'text-white'
                      }`}>
                        {alreadySent ? 'Sent' : 'Add'}
                      </Text>
                    </Pressable>
                  );
                })()
              }
            />
          )}
        />
      )}
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function FriendsScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('friends');

  const { data: pending } = useQuery({
    queryKey: queryKeys.friends.pending,
    queryFn: getPendingRequests,
  });
  const pendingCount = pending?.length ?? 0;

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="px-4 pt-2 pb-4">
        <Text className="text-2xl font-bold text-[#f1f5f9]">Friends</Text>
      </View>

      <TabBar active={activeTab} onChange={setActiveTab} pendingCount={pendingCount} />

      {activeTab === 'friends' && <FriendsView />}
      {activeTab === 'requests' && <RequestsView />}
      {activeTab === 'find' && <FindPeopleView />}
    </SafeAreaView>
  );
}
