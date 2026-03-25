import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  Alert,
  Modal,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import Slider from '@react-native-community/slider';

import {
  getLibraryBySlug,
  getLibraries,
  removeFromLibrary,
  moveGameToLibrary,
  updateLibraryItem,
  type LibraryItem,
  type Library,
} from '@/api/library';
import { getPublicLibraryBySlug } from '@/api/users';
import { queryKeys } from '@/constants/queryKeys';
import { COLORS } from '@/constants/theme';
import GameCard from '@/components/GameCard';
import SkeletonCard from '@/components/SkeletonCard';
import EmptyState from '@/components/EmptyState';

// ── Types ────────────────────────────────────────────

type SortBy = 'added' | 'title' | 'rating' | 'release';
type SortOrder = 'asc' | 'desc';
type RatingFilter = 'all' | 'rated' | 'unrated';
type DisplayMode = 'grid' | 'list';

interface Filters {
  sortBy: SortBy;
  sortOrder: SortOrder;
  ratingFilter: RatingFilter;
}

const PAGE_SIZE = 20;

// ── Edit Entry Modal ─────────────────────────────────

interface EditModalProps {
  visible: boolean;
  item: LibraryItem | null;
  onClose: () => void;
  onSave: (data: { userRating: number | null; notes: string; platformsPlayed: string[] }) => void;
  saving: boolean;
}

function EditModal({ visible, item, onClose, onSave, saving }: EditModalProps) {
  const [rating, setRating] = useState<number>(item?.userRating ?? 0);
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [platforms, setPlatforms] = useState<string>(
    (item?.platformsPlayed ?? []).join(', '),
  );

  // Sync when item changes
  const prevItem = useRef<string | null>(null);
  if (item && item.id !== prevItem.current) {
    prevItem.current = item.id;
    setRating(item.userRating ?? 0);
    setNotes(item.notes ?? '');
    setPlatforms((item.platformsPlayed ?? []).join(', '));
  }

  const handleSave = () => {
    const parsedPlatforms = platforms
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    onSave({
      userRating: rating > 0 ? rating : null,
      notes: notes.trim(),
      platformsPlayed: parsedPlatforms,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <SafeAreaView className="flex-1 bg-[#0f172a]" edges={['top']}>
          <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
            {/* Header */}
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-xl font-bold text-[#f1f5f9]">Edit Entry</Text>
              <Pressable onPress={onClose} className="active:opacity-70">
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </Pressable>
            </View>

            {item && (
              <Text className="text-base font-semibold text-[#94a3b8] mb-6" numberOfLines={1}>
                {item.game.title}
              </Text>
            )}

            {/* Rating */}
            <Text className="text-sm font-semibold text-[#f1f5f9] mb-1">
              Your Rating: {rating > 0 ? `${rating.toFixed(1)} / 5` : 'Not rated'}
            </Text>
            <Slider
              minimumValue={0}
              maximumValue={5}
              step={0.5}
              value={rating}
              onValueChange={setRating}
              minimumTrackTintColor={COLORS.accent}
              maximumTrackTintColor={COLORS.border}
              thumbTintColor={COLORS.accent}
              style={{ marginBottom: 20 }}
            />

            {/* Notes */}
            <Text className="text-sm font-semibold text-[#f1f5f9] mb-2">Notes</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Add your thoughts..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={4}
              className="rounded-xl bg-[#1e293b] p-3 text-[#f1f5f9] mb-4"
              style={{ minHeight: 80, textAlignVertical: 'top' }}
            />

            {/* Platforms */}
            <Text className="text-sm font-semibold text-[#f1f5f9] mb-2">
              Platforms Played (comma-separated)
            </Text>
            <TextInput
              value={platforms}
              onChangeText={setPlatforms}
              placeholder="e.g. PC, PS5"
              placeholderTextColor={COLORS.textMuted}
              className="rounded-xl bg-[#1e293b] p-3 text-[#f1f5f9] mb-6"
            />

            {/* Save */}
            <Pressable
              onPress={handleSave}
              disabled={saving}
              className="rounded-xl bg-violet-600 py-3.5 items-center active:opacity-70"
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-base font-semibold text-white">Save Changes</Text>
              )}
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Move Library Modal ───────────────────────────────

interface MoveModalProps {
  visible: boolean;
  libraries: Library[];
  currentLibraryId: string;
  onClose: () => void;
  onMove: (targetLibraryId: string) => void;
  moving: boolean;
}

function MoveModal({
  visible,
  libraries,
  currentLibraryId,
  onClose,
  onMove,
  moving,
}: MoveModalProps) {
  const others = libraries.filter((l) => l.id !== currentLibraryId);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-[#0f172a]">
        <View className="flex-row items-center justify-between px-5 py-4">
          <Text className="text-xl font-bold text-[#f1f5f9]">Move to Library</Text>
          <Pressable onPress={onClose} className="active:opacity-70">
            <Ionicons name="close" size={24} color={COLORS.textSecondary} />
          </Pressable>
        </View>

        {moving ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={COLORS.accent} />
          </View>
        ) : others.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-[#94a3b8] text-center">No other libraries to move to.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {others.map((lib) => (
              <TouchableOpacity
                key={lib.id}
                onPress={() => onMove(lib.id)}
                className="mb-3 flex-row items-center rounded-xl bg-card p-4 active:opacity-70"
              >
                <Ionicons name="folder-open" size={20} color={COLORS.textMuted} style={{ marginRight: 12 }} />
                <View className="flex-1">
                  <Text className="text-base font-semibold text-[#f1f5f9]">{lib.name}</Text>
                  <Text className="text-xs text-[#64748b]">{lib.itemCount} games</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ── Filter Modal ─────────────────────────────────────

interface FilterModalProps {
  visible: boolean;
  filters: Filters;
  onChange: (f: Filters) => void;
  onClose: () => void;
}

function FilterModal({ visible, filters, onChange, onClose }: FilterModalProps) {
  const [local, setLocal] = useState<Filters>(filters);

  const apply = () => {
    onChange(local);
    onClose();
  };

  const SORT_OPTIONS: { value: SortBy; label: string }[] = [
    { value: 'added', label: 'Added Date' },
    { value: 'title', label: 'Title' },
    { value: 'rating', label: 'Rating' },
    { value: 'release', label: 'Release Date' },
  ];

  const ORDER_OPTIONS: { value: SortOrder; label: string }[] = [
    { value: 'desc', label: 'Descending' },
    { value: 'asc', label: 'Ascending' },
  ];

  const RATING_OPTIONS: { value: RatingFilter; label: string }[] = [
    { value: 'all', label: 'All Games' },
    { value: 'rated', label: 'Rated Only' },
    { value: 'unrated', label: 'Unrated Only' },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-row items-center justify-between px-5 py-4">
          <Text className="text-xl font-bold text-[#f1f5f9]">Filters</Text>
          <Pressable onPress={onClose} className="active:opacity-70">
            <Ionicons name="close" size={24} color={COLORS.textSecondary} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20 }}>
          {/* Sort By */}
          <Text className="text-sm font-semibold text-[#94a3b8] mb-2 uppercase tracking-widest">
            Sort By
          </Text>
          <View className="flex-row flex-wrap gap-2 mb-5">
            {SORT_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => setLocal((p) => ({ ...p, sortBy: opt.value }))}
                className={`rounded-full px-4 py-2 ${local.sortBy === opt.value ? 'bg-violet-600' : 'bg-[#1e293b]'}`}
              >
                <Text
                  className={`text-sm font-medium ${local.sortBy === opt.value ? 'text-white' : 'text-[#94a3b8]'}`}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Sort Order */}
          <Text className="text-sm font-semibold text-[#94a3b8] mb-2 uppercase tracking-widest">
            Order
          </Text>
          <View className="flex-row gap-2 mb-5">
            {ORDER_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => setLocal((p) => ({ ...p, sortOrder: opt.value }))}
                className={`flex-1 rounded-full py-2 items-center ${local.sortOrder === opt.value ? 'bg-violet-600' : 'bg-[#1e293b]'}`}
              >
                <Text
                  className={`text-sm font-medium ${local.sortOrder === opt.value ? 'text-white' : 'text-[#94a3b8]'}`}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Rating Filter */}
          <Text className="text-sm font-semibold text-[#94a3b8] mb-2 uppercase tracking-widest">
            Games
          </Text>
          <View className="flex-row flex-wrap gap-2 mb-8">
            {RATING_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => setLocal((p) => ({ ...p, ratingFilter: opt.value }))}
                className={`rounded-full px-4 py-2 ${local.ratingFilter === opt.value ? 'bg-violet-600' : 'bg-[#1e293b]'}`}
              >
                <Text
                  className={`text-sm font-medium ${local.ratingFilter === opt.value ? 'text-white' : 'text-[#94a3b8]'}`}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={apply}
            className="rounded-xl bg-violet-600 py-3.5 items-center active:opacity-70"
          >
            <Text className="text-base font-semibold text-white">Apply Filters</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Main Screen ──────────────────────────────────────

export default function LibraryDetailScreen() {
  const { slug, username } = useLocalSearchParams<{ slug: string; username?: string }>();
  const isReadonly = !!username;
  const qc = useQueryClient();

  // Search state (debounced)
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // UI state
  const [displayMode, setDisplayMode] = useState<DisplayMode>('list');
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    sortBy: 'added',
    sortOrder: 'desc',
    ratingFilter: 'all',
  });

  // Modals
  const [editItem, setEditItem] = useState<LibraryItem | null>(null);
  const [moveItem, setMoveItem] = useState<LibraryItem | null>(null);

  // ── Debounce search ──────────────────────────────
  const handleSearchChange = (text: string) => {
    setSearchText(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(text.trim()), 400);
  };

  // ── Queries ──────────────────────────────────────
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useInfiniteQuery({
    queryKey: [
      isReadonly ? 'public-library' : 'library',
      username ?? 'me',
      slug,
      debouncedSearch,
      filters,
    ],
    queryFn: ({ pageParam = 1 }) =>
      isReadonly
        ? getPublicLibraryBySlug(username!, slug, {
            page: pageParam as number,
            pageSize: PAGE_SIZE,
            search: debouncedSearch || undefined,
            sortBy: filters.sortBy,
            sortOrder: filters.sortOrder,
            ratingFilter: filters.ratingFilter === 'all' ? undefined : filters.ratingFilter,
          })
        : getLibraryBySlug(slug, {
            page: pageParam as number,
            pageSize: PAGE_SIZE,
            search: debouncedSearch || undefined,
            sortBy: filters.sortBy,
            sortOrder: filters.sortOrder,
            ratingFilter: filters.ratingFilter === 'all' ? undefined : filters.ratingFilter,
          }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page < last.totalPages ? last.page + 1 : undefined,
  });

  const { data: allLibraries } = useQuery({
    queryKey: queryKeys.libraries.all,
    queryFn: getLibraries,
    enabled: !isReadonly,
  });

  const library = data?.pages[0]?.library;
  const items = data?.pages.flatMap((p) => p.items) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  // ── Mutations ────────────────────────────────────
  const removeMutation = useMutation({
    mutationFn: removeFromLibrary,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.libraries.detail(slug) });
      qc.invalidateQueries({ queryKey: queryKeys.libraries.all });
    },
  });

  const moveMutation = useMutation({
    mutationFn: ({ itemId, targetId }: { itemId: string; targetId: string }) =>
      moveGameToLibrary(itemId, targetId),
    onSuccess: () => {
      setMoveItem(null);
      qc.invalidateQueries({ queryKey: queryKeys.libraries.detail(slug) });
      qc.invalidateQueries({ queryKey: queryKeys.libraries.all });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      itemId,
      payload,
    }: {
      itemId: string;
      payload: { userRating: number | null; notes: string; platformsPlayed: string[] };
    }) =>
      updateLibraryItem(itemId, {
        userRating: payload.userRating,
        notes: payload.notes,
        platformsPlayed: payload.platformsPlayed,
      }),
    onSuccess: () => {
      setEditItem(null);
      qc.invalidateQueries({ queryKey: queryKeys.libraries.detail(slug) });
    },
  });

  // ── Item actions ─────────────────────────────────
  const handleLongPress = (item: LibraryItem) => {
    if (isReadonly) return;
    Alert.alert(item.game.title, undefined, [
      { text: 'Edit Entry', onPress: () => setEditItem(item) },
      { text: 'Move to Library', onPress: () => setMoveItem(item) },
      {
        text: 'Remove from Library',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Remove Game', `Remove "${item.game.title}" from this library?`, [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Remove',
              style: 'destructive',
              onPress: () => removeMutation.mutate(item.id),
            },
          ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // ── Render item ──────────────────────────────────
  const renderItem = useCallback(
    ({ item }: { item: LibraryItem }) => {
      if (!item?.game) return null;
      return (
        <GameCard
          game={item.game}
          mode={displayMode}
          onPress={() => router.push(`/game/${item.game.slug}` as never)}
          onLongPress={isReadonly ? undefined : () => handleLongPress(item)}
        />
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [displayMode, isReadonly],
  );

  const numColumns = displayMode === 'grid' ? 2 : 1;

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 gap-3">
        <Pressable
          onPress={() => router.back()}
          className="h-9 w-9 items-center justify-center rounded-full bg-card active:opacity-70"
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
        </Pressable>
        <View className="flex-1">
          {isLoading ? (
            <View className="h-5 w-40 rounded bg-border" />
          ) : (
            <Text className="text-lg font-bold text-[#f1f5f9]" numberOfLines={1}>
              {library?.name ?? 'Library'}
            </Text>
          )}
          <Text className="text-xs text-[#64748b]">{total} games</Text>
        </View>
        {/* View mode toggle */}
        <Pressable
          onPress={() => setDisplayMode((m) => (m === 'grid' ? 'list' : 'grid'))}
          className="h-9 w-9 items-center justify-center rounded-full bg-card active:opacity-70"
        >
          <Ionicons
            name={displayMode === 'grid' ? 'list' : 'grid'}
            size={18}
            color={COLORS.textSecondary}
          />
        </Pressable>
      </View>

      {/* Search + Filter row */}
      <View className="flex-row items-center mx-4 mb-3 gap-2">
          <View className="flex-1 flex-row items-center rounded-xl bg-card px-3" style={{ height: 48, overflow: 'hidden' }}>
          <Ionicons name="search" size={16} color={COLORS.textMuted} />
          <TextInput
            value={searchText}
            onChangeText={handleSearchChange}
            placeholder="Search games..."
            placeholderTextColor={COLORS.textMuted}
            className="ml-2 flex-1"
            style={{ height: 48, fontSize: 14, color: '#f1f5f9', includeFontPadding: false, textAlignVertical: 'center' }}
            returnKeyType="search"
          />
          {searchText.length > 0 && (
            <Pressable onPress={() => { setSearchText(''); setDebouncedSearch(''); }}>
              <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
            </Pressable>
          )}
        </View>
        <Pressable
          onPress={() => setShowFilter(true)}
          className="h-12 w-12 items-center justify-center rounded-xl bg-card active:opacity-70">
          <Ionicons name="options" size={18} color={COLORS.textSecondary} />
        </Pressable>
      </View>

      {/* List */}
      {isLoading ? (
        <View className="flex-1">
          {[0, 1, 2, 4].map((i) => (
            <SkeletonCard key={i} mode="list" />
          ))}
        </View>
      ) : (
        <FlatList<LibraryItem>
          key={numColumns}
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          numColumns={numColumns}
          contentContainerStyle={{ paddingBottom: 32 }}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={0.3}
          onRefresh={refetch}
          refreshing={false}
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator color={COLORS.accent} style={{ margin: 16 }} />
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="game-controller-outline"
              title="No games found"
              subtitle={
                debouncedSearch
                  ? 'Try a different search term or clear filters.'
                  : isReadonly
                  ? 'This library is empty.'
                  : 'Add games to this library from the Games tab.'
              }
            />
          }
        />
      )}

      {/* Filter Modal */}
      <FilterModal
        visible={showFilter}
        filters={filters}
        onChange={setFilters}
        onClose={() => setShowFilter(false)}
      />

      {/* Edit Entry Modal */}
      <EditModal
        visible={editItem !== null}
        item={editItem}
        onClose={() => setEditItem(null)}
        saving={updateMutation.isPending}
        onSave={(payload) => {
          if (editItem) {
            updateMutation.mutate({ itemId: editItem.id, payload });
          }
        }}
      />

      {/* Move to Library Modal */}
      <MoveModal
        visible={moveItem !== null}
        libraries={allLibraries ?? []}
        currentLibraryId={library?.id ?? ''}
        onClose={() => setMoveItem(null)}
        moving={moveMutation.isPending}
        onMove={(targetId) => {
          if (moveItem) {
            moveMutation.mutate({ itemId: moveItem.id, targetId });
          }
        }}
      />
    </SafeAreaView>
  );
}
