import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
  TextInput,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import type { GameDetail, Library, DefaultLibraryType } from '@gamecase/shared';

import {
  getGameDetail,
  getSimilarGames,
  getGameLibraryStatus,
  addGameToLibrary,
  type GameLibraryStatusItem,
} from '@/api/games';
import client from '@/api/client';
import type { ApiResponse } from '@gamecase/shared';
import { queryKeys } from '@/constants/queryKeys';
import { COLORS } from '@/constants/theme';
import RatingStars from '@/components/RatingStars';
import GameCard from '@/components/GameCard';
import StatusBadge from '@/components/StatusBadge';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = 280;

// ── Default library type labels ─────────────────────
const LIBRARY_TYPE_LABELS: Record<DefaultLibraryType, string> = {
  currently_playing: 'Currently Playing',
  played: 'Played',
  want_to_play: 'Want to Play',
  backlog: 'Backlog',
};

// ── Component ───────────────────────────────────────

export default function GameDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const queryClient = useQueryClient();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);

  // ── Game detail query ─────────────────────────────

  const {
    data: game,
    isLoading,
    isError,
  } = useQuery({
    queryKey: queryKeys.games.detail(slug),
    queryFn: () => getGameDetail(slug),
    enabled: !!slug,
  });

  // ── Similar games query ───────────────────────────

  const { data: similarGames } = useQuery({
    queryKey: [...queryKeys.games.detail(slug), 'similar'],
    queryFn: () => getSimilarGames(slug),
    enabled: !!slug,
  });

  // ── Library status query ──────────────────────────

  const { data: libraryStatus } = useQuery({
    queryKey: queryKeys.libraries.gameStatus(game?.id ?? ''),
    queryFn: () => getGameLibraryStatus(game!.id),
    enabled: !!game?.id,
  });

  const isInLibrary = (libraryStatus?.length ?? 0) > 0;

  // ── Loading / Error states ────────────────────────

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#0f172a]">
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  if (isError || !game) {
    return (
      <View className="flex-1 items-center justify-center bg-[#0f172a]">
        <Ionicons name="alert-circle-outline" size={48} color={COLORS.danger} />
        <Text className="mt-4 text-base text-[#94a3b8]">
          Failed to load game details
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="mt-4 rounded-lg bg-[#1e293b] px-6 py-3"
        >
          <Text className="text-sm font-semibold text-[#f1f5f9]">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const releaseYear = game.releaseDate
    ? new Date(game.releaseDate).getFullYear()
    : null;

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Hero Image */}
        <View style={{ height: HERO_HEIGHT, width: SCREEN_WIDTH }}>
          <Image
            source={{ uri: game.backgroundImage ?? undefined }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={300}
          />
          <LinearGradient
            colors={['transparent', 'rgba(15,23,42,0.8)', '#0f172a']}
            locations={[0.3, 0.7, 1]}
            style={StyleSheet.absoluteFill}
          />

          {/* Back Button */}
          <SafeAreaView edges={['top']} className="absolute top-0 left-0 right-0">
            <Pressable
              onPress={() => router.back()}
              className="ml-4 mt-2 h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            >
              <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
            </Pressable>
          </SafeAreaView>

          {/* Cover Art Thumbnail */}
          {game.coverImage && (
            <View className="absolute bottom-[-30] left-4">
              <Image
                source={{ uri: game.coverImage }}
                style={{
                  width: 80,
                  height: 110,
                  borderRadius: 8,
                  borderWidth: 2,
                  borderColor: COLORS.border,
                }}
                contentFit="cover"
                transition={200}
              />
            </View>
          )}
        </View>

        {/* Game Info */}
        <View className="px-4 pt-10">
          {/* Title & Metadata Row */}
          <Text className="text-2xl font-bold text-[#f1f5f9]">
            {game.title}
          </Text>

          <View className="mt-1 flex-row items-center flex-wrap gap-2">
            {releaseYear && (
              <Text className="text-sm text-[#94a3b8]">{releaseYear}</Text>
            )}
            {game.playtime != null && game.playtime > 0 && (
              <Text className="text-sm text-[#64748b]">
                • {game.playtime}h avg
              </Text>
            )}
          </View>

          {/* Rating */}
          {game.rating != null && (
            <View className="mt-3 flex-row items-center gap-2">
              <RatingStars rating={game.rating} size={18} />
              <Text className="text-sm font-semibold text-[#f59e0b]">
                {game.rating.toFixed(1)}
              </Text>
              {game.ratingCount != null && (
                <Text className="text-xs text-[#64748b]">
                  ({game.ratingCount.toLocaleString()} ratings)
                </Text>
              )}
            </View>
          )}

          {/* Metacritic */}
          {game.metacritic != null && (
            <View className="mt-2 flex-row items-center gap-2">
              <View className="rounded border border-success px-1.5 py-0.5">
                <Text className="text-xs font-bold text-success">
                  {game.metacritic}
                </Text>
              </View>
              <Text className="text-xs text-[#94a3b8]">Metacritic</Text>
            </View>
          )}

          {/* Platform Chips */}
          {game.platforms.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mt-4"
              contentContainerStyle={{ gap: 6 }}
            >
              {game.platforms.map((p) => (
                <View
                  key={p.id}
                  className="rounded-full bg-border px-3 py-1.5">
                  <Text className="text-xs text-[#94a3b8]">{p.name}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Genre Chips */}
          {game.genres.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mt-3"
              contentContainerStyle={{ gap: 6 }}
            >
              {game.genres.map((g) => (
                <View
                  key={g.id}
                  className="rounded-full bg-accent/20 px-3 py-1.5"
                >
                  <Text className="text-xs text-accent-light">{g.name}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Add to Library / In Library Button */}
          <Pressable
            onPress={() => setShowAddModal(true)}
            className={`mt-5 flex-row items-center justify-center rounded-xl py-3.5 ${
              isInLibrary ? 'bg-card border border-accent' : 'bg-accent'
            }`}
          >
            <Ionicons
              name={isInLibrary ? 'checkmark-circle' : 'add-circle'}
              size={20}
              color={isInLibrary ? COLORS.accentLight : COLORS.textPrimary}
            />
            <Text
              className={`ml-2 text-base font-semibold ${
                isInLibrary ? 'text-accent-light' : 'text-[#f1f5f9]'
              }`}
            >
              {isInLibrary ? 'In Library' : 'Add to Library'}
            </Text>
          </Pressable>

          {/* Library status badges */}
          {isInLibrary && libraryStatus && (
            <View className="mt-2 flex-row flex-wrap gap-2">
              {libraryStatus.map((s) => (
                <View key={s.itemId} className="flex-row items-center gap-1.5">
                  {s.defaultType ? (
                    <StatusBadge status={s.defaultType} />
                  ) : (
                    <View className="rounded-full bg-border px-3 py-1">
                      <Text className="text-xs text-[#94a3b8]">
                        {s.libraryName}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Description */}
          {game.description && (
            <View className="mt-5">
              <Text className="text-sm font-semibold text-[#f1f5f9] mb-2">
                About
              </Text>
              <Text
                className="text-sm leading-5 text-[#94a3b8]"
                numberOfLines={showFullDescription ? undefined : 4}
              >
                {game.description.replace(/<[^>]*>/g, '')}
              </Text>
              {game.description.length > 200 && (
                <Pressable
                  onPress={() => setShowFullDescription((p) => !p)}
                  className="mt-1"
                >
                  <Text className="text-sm font-semibold text-accent-light">
                    {showFullDescription ? 'Show less' : 'Show more'}
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Screenshots */}
          {game.screenshots.length > 0 && (
            <View className="mt-6">
              <Text className="text-sm font-semibold text-[#f1f5f9] mb-3">
                Screenshots
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10 }}
              >
                {game.screenshots.map((url, idx) => (
                  <Image
                    key={idx}
                    source={{ uri: url }}
                    style={{ width: 260, height: 146, borderRadius: 10 }}
                    contentFit="cover"
                    transition={200}
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {/* Similar Games */}
          {similarGames && similarGames.length > 0 && (
            <View className="mt-6 mb-8">
              <Text className="text-sm font-semibold text-[#f1f5f9] mb-3">
                Similar Games
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10 }}
              >
                {similarGames.map((g) => (
                  <View key={g.id} style={{ width: 160 }}>
                    <GameCard game={g} mode="grid" />
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Bottom spacer */}
          <View className="h-10" />
        </View>
      </ScrollView>

      {/* Add to Library Modal */}
      <AddToLibraryModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        gameId={game.id}
        existingStatus={libraryStatus ?? []}
      />
    </View>
  );
}

// ── Add to Library Modal ────────────────────────────

interface AddToLibraryModalProps {
  visible: boolean;
  onClose: () => void;
  gameId: string;
  existingStatus: GameLibraryStatusItem[];
}

function AddToLibraryModal({
  visible,
  onClose,
  gameId,
  existingStatus,
}: AddToLibraryModalProps) {
  const queryClient = useQueryClient();

  // Fetch user's libraries
  const { data: libraries } = useQuery({
    queryKey: queryKeys.libraries.all,
    queryFn: async () => {
      const { data } = await client.get<ApiResponse<Library[]>>('/libraries');
      return data.data;
    },
    enabled: visible,
  });

  // Default libraries sorted by type
  const defaultLibraries = libraries?.filter((l) => l.isDefault) ?? [];
  const customLibraries = libraries?.filter((l) => !l.isDefault) ?? [];

  const [selectedLibraryId, setSelectedLibraryId] = useState<string | null>(null);
  const [userRating, setUserRating] = useState(0);
  const [notes, setNotes] = useState('');

  // Pre-select first default library that doesn't already contain this game
  const existingLibraryIds = new Set(existingStatus.map((s) => s.libraryId));

  // Mutation
  const mutation = useMutation({
    mutationFn: () => {
      if (!selectedLibraryId) throw new Error('No library selected');
      return addGameToLibrary(selectedLibraryId, gameId, {
        userRating: userRating > 0 ? userRating : undefined,
        notes: notes.trim() || undefined,
      });
    },
    onSuccess: () => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      queryClient.invalidateQueries({ queryKey: queryKeys.libraries.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.libraries.gameStatus(gameId),
      });
      setSelectedLibraryId(null);
      setUserRating(0);
      setNotes('');
      onClose();
    },
  });

  const handleSave = () => {
    if (!selectedLibraryId) return;
    mutation.mutate();
  };

  const allLibraries = [...defaultLibraries, ...customLibraries];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end">
        <Pressable className="flex-1" onPress={onClose} />
        <View
          className="rounded-t-3xl bg-card"
          style={{ paddingBottom: 40, maxHeight: '80%' }}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
              <Text className="text-lg font-bold text-[#f1f5f9]">
                Add to Library
              </Text>
              <Pressable onPress={onClose} hitSlop={12}>
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </Pressable>
            </View>

            {/* Library Selection */}
            <View className="px-5 mb-4">
              <Text className="text-sm font-semibold text-[#94a3b8] mb-2">
                Select Library
              </Text>
              {allLibraries.map((lib) => {
                const alreadyAdded = existingLibraryIds.has(lib.id);
                const isSelected = selectedLibraryId === lib.id;
                return (
                  <Pressable
                    key={lib.id}
                    onPress={() => {
                      if (!alreadyAdded) setSelectedLibraryId(lib.id);
                    }}
                    className={`mb-2 flex-row items-center rounded-lg px-4 py-3 ${
                      alreadyAdded
                        ? 'bg-border opacity-50'
                        : isSelected
                          ? 'bg-accent'
                          : 'bg-border'
                    }`}
                  >
                    <Ionicons
                      name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={
                        alreadyAdded
                          ? COLORS.textMuted
                          : isSelected
                            ? COLORS.textPrimary
                            : COLORS.textSecondary
                      }
                    />
                    <Text
                      className={`ml-3 text-sm font-medium ${
                        isSelected ? 'text-[#f1f5f9]' : 'text-[#94a3b8]'
                      }`}
                    >
                      {lib.name}
                      {alreadyAdded ? ' (already added)' : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Rating Slider */}
            <View className="px-5 mb-4">
              <Text className="text-sm font-semibold text-[#94a3b8] mb-2">
                Rating: {userRating > 0 ? `${userRating.toFixed(1)} / 5` : 'None'}
              </Text>
              <Slider
                style={{ width: '100%', height: 40 }}
                minimumValue={0}
                maximumValue={5}
                step={0.5}
                value={userRating}
                onValueChange={setUserRating}
                minimumTrackTintColor={COLORS.accent}
                maximumTrackTintColor={COLORS.border}
                thumbTintColor={COLORS.accentLight}
              />
            </View>

            {/* Notes */}
            <View className="px-5 mb-5">
              <Text className="text-sm font-semibold text-[#94a3b8] mb-2">
                Notes (optional)
              </Text>
              <TextInput
                className="rounded-lg bg-border p-3 text-sm text-[#f1f5f9] min-h-[80]"
                placeholder="Add your notes..."
                placeholderTextColor={COLORS.textMuted}
                value={notes}
                onChangeText={setNotes}
                multiline
                textAlignVertical="top"
              />
            </View>

            {/* Action Buttons */}
            <View className="px-5 flex-row gap-3">
              <Pressable
                onPress={onClose}
                className="flex-1 items-center rounded-xl bg-border py-3.5"
              >
                <Text className="text-sm font-semibold text-[#94a3b8]">
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={!selectedLibraryId || mutation.isPending}
                className={`flex-1 items-center rounded-xl py-3.5 ${
                  selectedLibraryId ? 'bg-accent' : 'bg-accent/40'
                }`}
              >
                {mutation.isPending ? (
                  <ActivityIndicator size="small" color={COLORS.textPrimary} />
                ) : (
                  <Text className="text-sm font-semibold text-[#f1f5f9]">
                    Save
                  </Text>
                )}
              </Pressable>
            </View>

            {/* Error message */}
            {mutation.isError && (
              <Text className="mt-2 px-5 text-xs text-danger">
                Failed to add game. Please try again.
              </Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
