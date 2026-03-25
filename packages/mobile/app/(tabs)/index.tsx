import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  Text,
  View,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';

import { getActivityFeed, type ActivityItem } from '@/api/activity';
import { useAuthStore } from '@/store/auth.store';
import {
  getRecommendations,
  dismissRecommendation,
  generateRecommendations,
  type Recommendation,
} from '@/api/recommendations';
import { ActivityFeedCard, RecFeedCard } from '@/components/FeedCard';
import EmptyState from '@/components/EmptyState';
import { queryKeys } from '@/constants/queryKeys';
import { COLORS } from '@/constants/theme';

// ── Feed item union type ──────────────────────────────────────────────────────

type FeedTab = 'all' | 'activity' | 'foryou';

type FeedItem =
  | { _type: 'activity'; id: string; data: ActivityItem }
  | { _type: 'rec'; id: string; data: Recommendation };

const TABS: { key: FeedTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all',      label: 'All',        icon: 'home-outline' },
  { key: 'activity', label: 'Friends',    icon: 'people-outline' },
  { key: 'foryou',   label: 'For You',    icon: 'sparkles-outline' },
];

// Insert a recommendation every N activity items in the "All" view
const REC_INTERVAL = 3;

// ── Component ─────────────────────────────────────────────────────────────────

export default function FeedScreen() {
  const qc = useQueryClient();
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const currentUser = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<FeedTab>('all');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Card height: fills the available space between status bar, feed header,
  // tab bar, and a small peek showing the next card.
  const TAB_BAR_HEIGHT = 88;   // matches _layout.tsx tabBarStyle.height
  const FEED_HEADER_HEIGHT = 56; // Feed title + filter pills row
  const NEXT_CARD_PEEK = 24;   // how much of the next card is visible below
  const CARD_HEIGHT =
    windowHeight - insets.top - TAB_BAR_HEIGHT - FEED_HEADER_HEIGHT - NEXT_CARD_PEEK;

  // ── Queries ───────────────────────────────────────────────────────

  const {
    data: activityData,
    fetchNextPage: fetchNextActivity,
    hasNextPage: hasNextActivity,
    isFetchingNextPage: fetchingNextActivity,
    isLoading: activityLoading,
    isRefetching: activityRefetching,
    refetch: refetchActivity,
  } = useInfiniteQuery({
    queryKey: queryKeys.activity.my,
    queryFn: ({ pageParam = 1 }) => getActivityFeed(pageParam as number, 20),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasNext ? last.page + 1 : undefined),
  });

  const {
    data: recData,
    fetchNextPage: fetchNextRecs,
    hasNextPage: hasNextRecs,
    isFetchingNextPage: fetchingNextRecs,
    isLoading: recsLoading,
    isRefetching: recsRefetching,
    refetch: refetchRecs,
  } = useInfiniteQuery({
    queryKey: queryKeys.recommendations.all,
    queryFn: ({ pageParam = 1 }) => getRecommendations(pageParam as number, 20),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page < last.totalPages ? last.page + 1 : undefined,
  });

  // ── Mutations ─────────────────────────────────────────────────────

  const dismissMutation = useMutation({
    mutationFn: dismissRecommendation,
    onMutate: (id) => setDismissed((prev) => new Set(prev).add(id)),
    onError: (_err, id) =>
      setDismissed((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      }),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: queryKeys.recommendations.all }),
  });

  const generateMutation = useMutation({
    mutationFn: generateRecommendations,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.recommendations.all });
      Toast.show({ type: 'success', text1: '✨ Recommendations generated!' });
    },
    onError: () =>
      Toast.show({ type: 'error', text1: 'Failed to generate recommendations' }),
  });

  // ── Build feed items ──────────────────────────────────────────────

  const activityItems: ActivityItem[] =
    activityData?.pages.flatMap((p) => p.items) ?? [];

  const recItems: Recommendation[] = (
    recData?.pages.flatMap((p) => p.items) ?? []
  ).filter((r) => !dismissed.has(r.id));

  const mergedItems = useMemo<FeedItem[]>(() => {
    const result: FeedItem[] = [];
    let recIdx = 0;
    activityItems.forEach((item, i) => {
      result.push({ _type: 'activity', id: `a-${item.id}`, data: item });
      if ((i + 1) % REC_INTERVAL === 0 && recIdx < recItems.length) {
        const rec = recItems[recIdx++];
        result.push({ _type: 'rec', id: `r-${rec.id}`, data: rec });
      }
    });
    while (recIdx < recItems.length) {
      const rec = recItems[recIdx++];
      result.push({ _type: 'rec', id: `r-${rec.id}`, data: rec });
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityData, recData, dismissed]);

  const visibleItems: FeedItem[] =
    activeTab === 'all'
      ? mergedItems
      : activeTab === 'activity'
      ? activityItems.map((d) => ({ _type: 'activity', id: `a-${d.id}`, data: d }))
      : recItems.map((d) => ({ _type: 'rec', id: `r-${d.id}`, data: d }));

  // ── Callbacks ─────────────────────────────────────────────────────

  const handleEndReached = useCallback(() => {
    if (activeTab !== 'foryou' && hasNextActivity && !fetchingNextActivity) {
      void fetchNextActivity();
    }
    if (activeTab === 'foryou' && hasNextRecs && !fetchingNextRecs) {
      void fetchNextRecs();
    }
  }, [
    activeTab, hasNextActivity, fetchingNextActivity, fetchNextActivity,
    hasNextRecs, fetchingNextRecs, fetchNextRecs,
  ]);

  const handleRefresh = useCallback(() => {
    void refetchActivity();
    void refetchRecs();
  }, [refetchActivity, refetchRecs]);

  const isLoading = activityLoading || (activeTab === 'foryou' && recsLoading)
    || (activeTab === 'all' && recsLoading);

  const isRefreshing =
    (activeTab !== 'foryou' && activityRefetching && !activityLoading) ||
    (activeTab === 'foryou' && recsRefetching && !recsLoading);

  // ── Render helpers ────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item }: { item: FeedItem }) => {
      if (item._type === 'activity') {
        const badge =
          activeTab === 'all'
            ? item.data.user.id === currentUser?.id
              ? ('you' as const)
              : ('friend' as const)
            : undefined;
        return (
          <ActivityFeedCard
            item={item.data}
            onGamePress={(slug) => router.push(`/game/${slug}`)}
            onUserPress={(username) => router.push(`/user/${username}` as never)}
            cardHeight={CARD_HEIGHT}
            badge={badge}
          />
        );
      }
      return (
        <RecFeedCard
          recommendation={item.data}
          onPress={() => router.push(`/game/${item.data.game.slug}`)}
          onDismiss={() => dismissMutation.mutate(item.data.id)}
          cardHeight={CARD_HEIGHT}
        />
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dismissMutation, CARD_HEIGHT, activeTab, currentUser],
  );

  const renderFooter = useCallback(() => {
    const loading =
      (activeTab !== 'foryou' && fetchingNextActivity) ||
      (activeTab === 'foryou' && fetchingNextRecs);
    return loading ? (
      <ActivityIndicator style={{ marginVertical: 20 }} color={COLORS.accent} />
    ) : null;
  }, [activeTab, fetchingNextActivity, fetchingNextRecs]);

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    if (activeTab === 'foryou') {
      return (
        <EmptyState
          icon="sparkles-outline"
          title="No recommendations yet"
          subtitle="Generate personalised picks based on your library."
          action={{
            label: generateMutation.isPending ? 'Generating…' : 'Generate Recommendations',
            onPress: () => generateMutation.mutate(),
          }}
        />
      );
    }
    if (activeTab === 'all') {
      if (activityItems.length > 0 || recItems.length > 0) return null;
      return (
        <EmptyState
          icon="people-outline"
          title="Nothing here yet"
          subtitle="Add friends to see their activity, or generate recommendations in the For You tab."
        />
      );
    }
    return (
      <EmptyState
        icon="people-outline"
        title="No activity yet"
        subtitle="Add friends to see their updates here"
      />
    );
  }, [isLoading, activeTab, generateMutation, activityItems.length, recItems.length]);

  // ── Skeleton ──────────────────────────────────────────────────────

  const renderSkeleton = () => (
    <View className="mx-4 gap-4 mt-2">
      {[0, 1].map((i) => (
        <View
          key={i}
          style={{ height: CARD_HEIGHT, borderRadius: 16, overflow: 'hidden' }}
          className="bg-card"
        >
          <View style={{ flex: 0.52, backgroundColor: COLORS.border }} />
          <View style={{ flex: 0.48, padding: 16, gap: 10 }}>
            <View style={{ height: 20, borderRadius: 8, width: '75%', backgroundColor: COLORS.border }} />
            <View style={{ height: 14, borderRadius: 8, width: '45%', backgroundColor: COLORS.border }} />
            <View style={{ height: 12, borderRadius: 8, width: '60%', backgroundColor: COLORS.border }} />
          </View>
        </View>
      ))}
    </View>
  );

  // ── Main render ───────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* ── Header ── */}
      <View className="px-4 pt-1 pb-3 flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-[#f1f5f9]">Feed</Text>
        {/* Tab pills */}
        <View className="flex-row gap-1.5">
          {TABS.map(({ key, label, icon }) => (
            <Pressable
              key={key}
              onPress={() => setActiveTab(key)}
              className={`flex-row items-center gap-1.5 px-3 py-2 rounded-full ${
                activeTab === key ? 'bg-accent' : 'bg-card'
              }`}
            >
              <Ionicons
                name={icon}
                size={13}
                color={activeTab === key ? '#fff' : COLORS.textSecondary}
              />
              <Text
                className={`text-xs font-semibold ${
                  activeTab === key ? 'text-white' : 'text-[#94a3b8]'
                }`}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {isLoading ? (
        renderSkeleton()
      ) : (
        <FlatList
          data={visibleItems}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={
            visibleItems.length === 0 ? { flex: 1 } : undefined
          }
          showsVerticalScrollIndicator={false}          ItemSeparatorComponent={() => <View style={{ height: 16 }} />}          snapToInterval={CARD_HEIGHT + 16}
          snapToAlignment="start"
          decelerationRate="fast"
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.accent}
              colors={[COLORS.accent]}
            />
          }
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          extraData={activeTab}
        />
      )}
    </SafeAreaView>
  );
}

