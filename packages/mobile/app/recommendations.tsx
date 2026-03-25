import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import Toast from 'react-native-toast-message';

import { queryKeys } from '@/constants/queryKeys';
import { COLORS } from '@/constants/theme';
import {
  getRecommendations,
  getRecommendationStatus,
  generateRecommendations,
  refreshRecommendations,
  dismissRecommendation,
  type Recommendation,
} from '@/api/recommendations';
import RecommendationCard from '@/components/RecommendationCard';
import EmptyState from '@/components/EmptyState';
import SkeletonCard from '@/components/SkeletonCard';

export default function RecommendationsScreen() {
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const { data: status } = useQuery({
    queryKey: ['recommendations', 'status'],
    queryFn: getRecommendationStatus,
  });

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: queryKeys.recommendations.all,
    queryFn: ({ pageParam }) => getRecommendations(pageParam as number, 20),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
  });

  const generateMutation = useMutation({
    mutationFn: generateRecommendations,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recommendations.all });
      queryClient.invalidateQueries({ queryKey: ['recommendations', 'status'] });
      Toast.show({ type: 'success', text1: 'Recommendations generated!' });
    },
    onError: () => {
      Toast.show({ type: 'error', text1: 'Failed to generate recommendations' });
    },
  });

  const handleRefresh = () => {
    Alert.alert(
      'Refresh Recommendations',
      'This will clear all dismissals and generate fresh recommendations. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Refresh',
          onPress: async () => {
            try {
              await refreshRecommendations();
              setDismissed(new Set());
              queryClient.invalidateQueries({ queryKey: queryKeys.recommendations.all });
              queryClient.invalidateQueries({ queryKey: ['recommendations', 'status'] });
              Toast.show({ type: 'success', text1: 'Recommendations refreshed!' });
            } catch {
              Toast.show({ type: 'error', text1: 'Failed to refresh recommendations' });
            }
          },
        },
      ],
    );
  };

  const handleDismiss = async (id: string) => {
    setDismissed((prev) => new Set([...prev, id]));
    try {
      await dismissRecommendation(id);
    } catch {
      setDismissed((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      Toast.show({ type: 'error', text1: 'Could not dismiss recommendation' });
    }
  };

  const allItems: Recommendation[] =
    data?.pages.flatMap((p) => p.items).filter((r) => !dismissed.has(r.id)) ?? [];

  const isEmpty = !isLoading && allItems.length === 0 && (status?.total ?? 0) === 0;

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={8} className="active:opacity-60">
          <Ionicons name="arrow-back" size={24} color={COLORS.textSecondary} />
        </Pressable>
        <Text className="text-lg font-bold text-[#f1f5f9]">For You</Text>
        <Pressable onPress={handleRefresh} hitSlop={8} className="active:opacity-60">
          <Ionicons name="refresh" size={22} color={COLORS.textSecondary} />
        </Pressable>
      </View>

      {/* Content */}
      {isLoading ? (
        <View className="px-4 pt-2">
          {[...Array(5)].map((_, i) => (
            <SkeletonCard key={i} mode="list" />
          ))}
        </View>
      ) : isEmpty ? (
        <EmptyState
          icon="bulb-outline"
          title="No recommendations yet"
          subtitle="Generate personalised game recommendations based on your library."
          action={{
            label: generateMutation.isPending ? 'Generating…' : 'Generate Recommendations',
            onPress: () => generateMutation.mutate(),
          }}
        />
      ) : (
        <FlatList
          data={allItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 }}
          renderItem={({ item }) => (
            <RecommendationCard
              recommendation={item}
              onPress={() => router.push(`/game/${item.game.slug}`)}
              onDismiss={() => handleDismiss(item.id)}
            />
          )}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator color={COLORS.accent} style={{ marginVertical: 16 }} />
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}
