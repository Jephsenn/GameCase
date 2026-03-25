import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { GameListItem, PlatformInfo, GenreInfo } from '@gamecase/shared';

import { searchGames, getPlatforms, getGenres } from '@/api/games';
import { queryKeys } from '@/constants/queryKeys';
import { COLORS } from '@/constants/theme';
import GameCard from '@/components/GameCard';
import SkeletonCard from '@/components/SkeletonCard';

// ── Types ───────────────────────────────────────────

type SortOption = 'rating' | 'releaseDate' | 'title' | 'metacritic' | 'popularity';
type FilterType = 'all' | 'genre' | 'platform' | 'top_rated' | 'recent';
type DisplayMode = 'grid' | 'list';

interface FilterChip {
  key: FilterType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const FILTER_CHIPS: FilterChip[] = [
  { key: 'all', label: 'All', icon: 'apps' },
  { key: 'genre', label: 'By Genre', icon: 'pricetags' },
  { key: 'platform', label: 'By Platform', icon: 'hardware-chip' },
  { key: 'top_rated', label: 'Top Rated', icon: 'star' },
  { key: 'recent', label: 'Recently Released', icon: 'time' },
];

const PAGE_SIZE = 20;

// Pre-compute card width so the skeleton grid matches the real grid layout
// immediately on first render (no layout-pass flash).
// FlatList with numColumns={2} uses contentContainerStyle paddingHorizontal:10
// and each GameCard has mx-1.5 (6px each side).
const SCREEN_W = Dimensions.get('window').width;
const COLUMN_PADDING = 10; // contentContainerStyle paddingHorizontal
const CARD_MARGIN = 6;     // mx-1.5 = 6px
const CARD_W = Math.floor((SCREEN_W - COLUMN_PADDING * 2 - CARD_MARGIN * 2 * 2) / 2);

// ── Component ───────────────────────────────────────

export default function GamesScreen() {
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('grid');
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [showGenreModal, setShowGenreModal] = useState(false);
  const [showPlatformModal, setShowPlatformModal] = useState(false);

  // ── Debounced search ──────────────────────────────

  const handleSearchChange = useCallback(
    (text: string) => {
      setSearchText(text);
      if (debounceTimer) clearTimeout(debounceTimer);
      const timer = setTimeout(() => {
        setDebouncedSearch(text.trim());
      }, 400);
      setDebounceTimer(timer);
    },
    [debounceTimer],
  );

  // ── Build query params based on active filter ─────

  const queryParams = useMemo(() => {
    const isSearching = debouncedSearch.length >= 2;
    const params: {
      query?: string;
      genres?: string[];
      platforms?: string[];
      sortBy?: SortOption;
      sortOrder?: 'asc' | 'desc';
      pageSize?: number;
    } = { pageSize: PAGE_SIZE };

    if (isSearching) {
      params.query = debouncedSearch;
      params.sortBy = 'rating';
      params.sortOrder = 'desc';
      return params;
    }

    switch (activeFilter) {
      case 'genre':
        if (selectedGenre) params.genres = [selectedGenre];
        params.sortBy = 'rating';
        params.sortOrder = 'desc';
        break;
      case 'platform':
        if (selectedPlatform) params.platforms = [selectedPlatform];
        params.sortBy = 'rating';
        params.sortOrder = 'desc';
        break;
      case 'top_rated':
        params.sortBy = 'rating';
        params.sortOrder = 'desc';
        break;
      case 'recent':
        params.sortBy = 'releaseDate';
        params.sortOrder = 'desc';
        break;
      default:
        params.sortBy = 'rating';
        params.sortOrder = 'desc';
    }

    return params;
  }, [debouncedSearch, activeFilter, selectedGenre, selectedPlatform]);

  // ── Infinite query ────────────────────────────────

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useInfiniteQuery({
    queryKey: queryKeys.games.search(queryParams),
    queryFn: ({ pageParam = 1 }) =>
      searchGames({ ...queryParams, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasNext ? lastPage.page + 1 : undefined,
  });

  const games = useMemo(() => {
    const all = data?.pages.flatMap((p) => p.items) ?? [];
    const seen = new Set<string>();
    return all.filter((g) => {
      if (seen.has(g.id)) return false;
      seen.add(g.id);
      return true;
    });
  }, [data]);

  // ── Platforms & Genres for filter modals ───────────

  const { data: platforms } = useQuery({
    queryKey: queryKeys.games.platforms,
    queryFn: getPlatforms,
    staleTime: 1000 * 60 * 60,
  });

  const { data: genres } = useQuery({
    queryKey: queryKeys.games.genres,
    queryFn: getGenres,
    staleTime: 1000 * 60 * 60,
  });

  // ── Filter chip press handler ─────────────────────

  const handleFilterPress = useCallback((filter: FilterType) => {
    setActiveFilter(filter);
    if (filter === 'genre') {
      setShowGenreModal(true);
    } else if (filter === 'platform') {
      setShowPlatformModal(true);
    } else {
      setSelectedGenre(null);
      setSelectedPlatform(null);
    }
  }, []);

  // ── Render helpers ────────────────────────────────

  const renderGameItem = useCallback(
    ({ item }: { item: GameListItem }) => {
      if (displayMode === 'grid') {
        return <GameCard game={item} mode="grid" />;
      }
      return <GameCard game={item} mode="list" />;
    },
    [displayMode],
  );

  const renderFooter = useCallback(() => {
    if (isFetchingNextPage) {
      return (
        <View className="py-6 items-center">
          <ActivityIndicator size="small" color={COLORS.accent} />
        </View>
      );
    }
    return <View className="h-4" />;
  }, [isFetchingNextPage]);

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    return (
      <View className="items-center pt-16">
        <Ionicons name="search-outline" size={48} color={COLORS.textMuted} />
        <Text className="mt-4 text-base text-[#94a3b8]">No games found</Text>
        <Text className="mt-1 text-sm text-[#64748b]">
          Try a different search or filter
        </Text>
      </View>
    );
  }, [isLoading]);

  const renderSkeleton = () => {
    if (displayMode === 'list') {
      return (
        <View>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} mode="list" />
          ))}
        </View>
      );
    }
    // Grid: use explicit pixel width so items never flash to full-width
    // before the flex layout pass resolves percentages.
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: COLUMN_PADDING }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={i} style={{ width: CARD_W + CARD_MARGIN * 2 }}>
            <SkeletonCard mode="grid" />
          </View>
        ))}
      </View>
    );
  };

  // ── Modal for genre/platform selection ────────────

  const renderFilterModal = (
    visible: boolean,
    onClose: () => void,
    title: string,
    items: (PlatformInfo | GenreInfo)[] | undefined,
    selected: string | null,
    onSelect: (slug: string) => void,
  ) => (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end">
        <Pressable
          className="flex-1"
          onPress={onClose}
        />
        <View
          className="rounded-t-3xl bg-card max-h-[70%]"
          style={{ paddingBottom: 40 }}
        >
          <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
            <Text className="text-lg font-bold text-[#f1f5f9]">{title}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={COLORS.textSecondary} />
            </Pressable>
          </View>
          <ScrollView className="px-5" showsVerticalScrollIndicator={false}>
            <Pressable
              className={`mb-2 rounded-lg px-4 py-3 ${
                selected === null ? 'bg-accent' : 'bg-border'
              }`}
              onPress={() => {
                onSelect('');
                onClose();
              }}
            >
              <Text className="text-sm font-medium text-[#f1f5f9]">All</Text>
            </Pressable>
            {items?.map((item) => (
              <Pressable
                key={item.id}
                className={`mb-2 rounded-lg px-4 py-3 ${
                  selected === item.slug ? 'bg-accent' : 'bg-border'
                }`}
                onPress={() => {
                  onSelect(item.slug);
                  onClose();
                }}
              >
                <Text className="text-sm font-medium text-[#f1f5f9]">{item.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // ── Main render ───────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Search Bar */}
      <View style={{ flexGrow: 0, flexShrink: 0, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
          <View className="flex-row items-center rounded-xl bg-card px-3" style={{ height: 48, overflow: 'hidden' }}>
          <Ionicons name="search" size={20} color={COLORS.textMuted} />
          <TextInput
            className="ml-2 flex-1"
            style={{
              height: 48,
              fontSize: 16,
              color: '#f1f5f9',
              includeFontPadding: false,
              textAlignVertical: 'center',
            }}
            placeholder="Search games..."
            placeholderTextColor={COLORS.textMuted}
            value={searchText}
            onChangeText={handleSearchChange}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchText.length > 0 && (
            <Pressable
              onPress={() => {
                setSearchText('');
                setDebouncedSearch('');
              }}
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
            </Pressable>
          )}
          <Pressable
            onPress={() =>
              setDisplayMode((m) => (m === 'grid' ? 'list' : 'grid'))
            }
            className="ml-3"
            hitSlop={8}
          >
            <Ionicons
              name={displayMode === 'grid' ? 'list' : 'grid'}
              size={20}
              color={COLORS.textSecondary}
            />
          </Pressable>
        </View>
      </View>

      {/* Filter Chips */}
      {/* Fixed height prevents the row from collapsing/expanding between
          layout passes while NativeWind resolves percentage/flex classes. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ height: 48, marginBottom: 8, flexGrow: 0, flexShrink: 0 }}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16, alignItems: 'center' }}
      >
        {FILTER_CHIPS.map((chip) => {
          const isActive = activeFilter === chip.key;
          return (
            <Pressable
              key={chip.key}
              onPress={() => handleFilterPress(chip.key)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                borderRadius: 999,
                paddingHorizontal: 16,
                height: 34,
                backgroundColor: isActive ? COLORS.accent : COLORS.card,
              }}
            >
              <Ionicons
                name={chip.icon}
                size={14}
                color={isActive ? COLORS.textPrimary : COLORS.textSecondary}
              />
              <Text
                numberOfLines={1}
                style={{
                  marginLeft: 6,
                  fontSize: 12,
                  fontWeight: '600',
                  color: isActive ? '#f1f5f9' : '#94a3b8',
                }}
              >
                {chip.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Active filter indicator */}
      {(selectedGenre || selectedPlatform) && (
        <View className="px-4 pb-2 flex-row items-center">
          <Text className="text-xs text-[#94a3b8]">
            Filtered by:{' '}
            <Text className="font-semibold text-violet-400">
              {selectedGenre
                ? genres?.find((g) => g.slug === selectedGenre)?.name ?? selectedGenre
                : platforms?.find((p) => p.slug === selectedPlatform)?.name ?? selectedPlatform}
            </Text>
          </Text>
          <Pressable
            onPress={() => {
              setSelectedGenre(null);
              setSelectedPlatform(null);
              setActiveFilter('all');
            }}
            className="ml-2"
            hitSlop={8}
          >
            <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
          </Pressable>
        </View>
      )}

      {/* Game List */}
      <View style={{ flex: 1 }}>
        {isLoading ? (
          renderSkeleton()
        ) : isError ? (
          <View className="mx-4 mt-6 rounded-xl bg-card p-6 items-center">
            <Ionicons name="cloud-offline-outline" size={48} color={COLORS.danger} />
            <Text className="mt-3 text-base font-semibold text-[#f1f5f9]">
              Couldn&apos;t load games
            </Text>
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
        ) : (
          <FlatList
            data={games}
            renderItem={renderGameItem}
            keyExtractor={(item) => item.id}
            numColumns={displayMode === 'grid' ? 2 : 1}
            key={displayMode} // Force re-render when mode changes
            contentContainerStyle={{
              paddingHorizontal: displayMode === 'grid' ? 10 : 0,
              paddingBottom: 20,
            }}
            onEndReached={() => {
              if (hasNextPage && !isFetchingNextPage) {
                fetchNextPage();
              }
            }}
            onEndReachedThreshold={0.5}
            ListFooterComponent={renderFooter}
            ListEmptyComponent={renderEmpty}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Genre Modal */}
      {renderFilterModal(
        showGenreModal,
        () => setShowGenreModal(false),
        'Select Genre',
        genres,
        selectedGenre,
        (slug) => {
          setSelectedGenre(slug || null);
          setSelectedPlatform(null);
        },
      )}

      {/* Platform Modal */}
      {renderFilterModal(
        showPlatformModal,
        () => setShowPlatformModal(false),
        'Select Platform',
        platforms,
        selectedPlatform,
        (slug) => {
          setSelectedPlatform(slug || null);
          setSelectedGenre(null);
        },
      )}
    </SafeAreaView>
  );
}
