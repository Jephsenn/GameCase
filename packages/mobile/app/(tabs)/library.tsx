import { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';

import { getLibraries, getUserStats, deleteLibrary, updateLibrary, type Library } from '@/api/library';
import { queryKeys } from '@/constants/queryKeys';
import { COLORS } from '@/constants/theme';
import { useAuthStore } from '@/store/auth.store';
import LibraryCard from '@/components/LibraryCard';
import StatCard from '@/components/StatCard';
import EmptyState from '@/components/EmptyState';
import SkeletonCard from '@/components/SkeletonCard';

// ── Skeleton strip while stats load ─────────────────

function StatsStrip() {
  return (
    <View className="flex-row gap-3 px-4 pb-4">
      {[0, 1, 2].map((i) => (
        <View key={i} className="flex-1 rounded-xl bg-card h-24" />
      ))}
    </View>
  );
}

// ── Rename Modal ─────────────────────────────────────

interface RenameModalProps {
  library: Library | null;
  onClose: () => void;
  onSuccess: () => void;
}

function RenameModal({ library, onClose, onSuccess }: RenameModalProps) {
  const qc = useQueryClient();
  const [name, setName] = useState(library?.name ?? '');

  const renameMutation = useMutation({
    mutationFn: () => updateLibrary(library!.id, { name: name.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.libraries.all });
      onSuccess();
    },
  });

  const canSubmit = name.trim().length > 0 && name.trim() !== library?.name && !renameMutation.isPending;

  return (
    <Modal
      visible={!!library}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="mx-6 w-full max-w-sm rounded-2xl bg-card p-5"
        >
          <Text className="mb-4 text-lg font-bold text-[#f1f5f9]">Rename Library</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Library name"
            placeholderTextColor={COLORS.textMuted}
            maxLength={100}
            autoFocus
            className="mb-1 rounded-xl bg-border px-4 py-3 text-[#f1f5f9]"
          />
          {renameMutation.isError && (
            <Text className="mb-2 text-xs text-[#ef4444]">Failed to rename. Try again.</Text>
          )}
          <View className="mt-3 flex-row gap-3">
            <Pressable
              onPress={onClose}
              className="flex-1 items-center rounded-xl border border-border py-3 active:opacity-70"
            >
              <Text className="text-sm font-semibold text-[#94a3b8]">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => renameMutation.mutate()}
              disabled={!canSubmit}
              className={`flex-1 items-center rounded-xl py-3 ${canSubmit ? 'bg-accent' : 'bg-accent/40'}`}
            >
              {renameMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className={`text-sm font-semibold ${canSubmit ? 'text-white' : 'text-[#94a3b8]'}`}>Save</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Main Component ───────────────────────────────────

export default function LibraryScreen() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isPro = user?.plan === 'pro';
  const [refreshing, setRefreshing] = useState(false);
  const [renamingLibrary, setRenamingLibrary] = useState<Library | null>(null);

  const {
    data: libraries,
    isLoading: libsLoading,
    isError: libsError,
    refetch: refetchLibs,
  } = useQuery({
    queryKey: queryKeys.libraries.all,
    queryFn: getLibraries,
  });

  // Only fetch stats for Pro users — the backend returns 403 for free accounts,
  // which would cause a loading flash followed by the strip disappearing.
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['users', 'stats'],
    queryFn: getUserStats,
    enabled: isPro,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteLibrary,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.libraries.all });
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.libraries.all }),
      qc.invalidateQueries({ queryKey: ['users', 'stats'] }),
    ]);
    setRefreshing(false);
  }, [qc]);

  const handleDelete = useCallback(
    (library: Library) => {
      Alert.alert(
        'Delete Library',
        `Are you sure you want to delete "${library.name}"? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => deleteMutation.mutate(library.id),
          },
        ],
      );
    },
    [deleteMutation],
  );

  const renderItem = useCallback(
    ({ item }: { item: Library }) => (
      <LibraryCard
        library={item}
        onPress={() => router.push(`/library/${item.slug}` as never)}
        onEdit={() => setRenamingLibrary(item)}
        onDelete={() => handleDelete(item)}
      />
    ),
    [handleDelete],
  );

  const listHeader = (
    <>
      {/* Stats strip */}
      {statsLoading ? (
        <StatsStrip />
      ) : stats ? (
        <View className="flex-row gap-3 px-4 pb-4">
          <StatCard
            label="Games Tracked"
            value={stats.totalGamesTracked}
            icon="game-controller"
            color={COLORS.success}
          />
          <StatCard
            label="Libraries"
            value={stats.totalLibraries}
            icon="folder-open"
            color={COLORS.accent}
          />
          <StatCard
            label="Avg Rating"
            value={stats.averageRating != null ? stats.averageRating.toFixed(1) : '—'}
            icon="star"
            color={COLORS.warning}
          />
        </View>
      ) : null}
    </>
  );

  const isLoading = libsLoading;

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pb-3 pt-2">
        <Text className="text-2xl font-bold text-[#f1f5f9]">My Libraries</Text>
        <Pressable
          onPress={() => router.push('/library/new' as never)}
          className="h-9 w-9 items-center justify-center rounded-full bg-card active:opacity-70"
        >
          <Ionicons name="add" size={22} color={COLORS.textPrimary} />
        </Pressable>
      </View>

      {isLoading ? (
        <>
          {listHeader}
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} mode="list" />
          ))}
        </>
      ) : libsError ? (
        <View className="mx-4 mt-6 rounded-xl bg-card p-6 items-center">
          <Ionicons name="cloud-offline-outline" size={48} color={COLORS.danger} />
          <Text className="mt-3 text-base font-semibold text-[#f1f5f9]">
            Couldn&apos;t load libraries
          </Text>
          <Text className="mt-1 text-sm text-[#94a3b8] text-center">
            Check your connection and try again.
          </Text>
          <Pressable
            onPress={() => void refetchLibs()}
            className="mt-4 rounded-lg bg-accent px-6 py-2.5 active:opacity-70"
          >
            <Text className="text-sm font-semibold text-white">Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList<Library>
          data={libraries ?? []}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          contentContainerStyle={{ paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.accent}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="library-outline"
              title="No libraries yet"
              subtitle="Tap + to create your first library"
              action={{ label: 'Create Library', onPress: () => router.push('/library/new' as never) }}
            />
          }
        />
      )}

      {deleteMutation.isPending && (
        <View
          style={{
            position: 'absolute',
            inset: 0,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.4)',
          }}
        >
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      )}

      <RenameModal
        library={renamingLibrary}
        onClose={() => setRenamingLibrary(null)}
        onSuccess={() => setRenamingLibrary(null)}
      />
    </SafeAreaView>
  );
}
