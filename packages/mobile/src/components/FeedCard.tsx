import { useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ActivityItem } from '@/api/activity';
import type { Recommendation } from '@/api/recommendations';
import { getGameLibraryStatus, addGameToLibrary } from '@/api/games';
import { getLibraries, type Library } from '@/api/library';
import { relativeTime } from '@/lib/time';
import { COLORS } from '@/constants/theme';
import { queryKeys } from '@/constants/queryKeys';
import RatingStars from './RatingStars';
import StatusBadge from './StatusBadge';
import type { DefaultLibraryType } from '@gamecase/shared';

// ─── Activity action meta ──────────────────────────────────────────────────────

type ActionMeta = {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  verb: string;
  detail?: string;
};

function getActionMeta(item: ActivityItem): ActionMeta {
  const newRating =
    item.metadata && typeof item.metadata['newRating'] === 'number'
      ? (item.metadata['newRating'] as number)
      : null;

  switch (item.type) {
    case 'game_added':
      return { icon: 'add-circle', color: COLORS.accentLight, verb: 'Added to library' };
    case 'game_completed':
      return { icon: 'checkmark-circle', color: COLORS.success, verb: 'Completed' };
    case 'game_rated':
      return {
        icon: 'star',
        color: COLORS.warning,
        verb: 'Rated',
        detail: newRating !== null ? `${newRating} / 5` : undefined,
      };
    case 'game_noted': {
      const noteText =
        item.metadata && typeof item.metadata['notes'] === 'string'
          ? (item.metadata['notes'] as string)
          : null;
      return {
        icon: 'create',
        color: COLORS.accentLight,
        verb: 'Added a note',
        detail: noteText
          ? `"${noteText.length > 50 ? noteText.slice(0, 50) + '…' : noteText}"`
          : undefined,
      };
    }
    case 'friend_added':
      return { icon: 'people', color: COLORS.accent, verb: 'Made a new friend' };
    case 'library_created':
      return {
        icon: 'folder-open',
        color: COLORS.accentLight,
        verb: 'Created library',
        detail: item.library?.name,
      };
    default:
      return { icon: 'ellipsis-horizontal-circle', color: COLORS.textMuted, verb: 'Activity' };
  }
}

// ─── Shared cover image ────────────────────────────────────────────────────────

interface CoverProps {
  uri: string | null;
  height?: number;
}

function CoverImage({ uri, height }: CoverProps) {
  return (
    <View style={height != null ? { height, width: '100%', backgroundColor: COLORS.border } : { flex: 1, width: '100%', backgroundColor: COLORS.border }}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          transition={300}
          placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
        />
      ) : (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: COLORS.card,
          }}
        >
          <Ionicons name="game-controller-outline" size={48} color={COLORS.border} />
        </View>
      )}
      {/* Gradient scrim so text over image is always readable */}
      <LinearGradient
        colors={['transparent', 'rgba(15,23,42,0.5)', 'rgba(15,23,42,0.93)']}
        locations={[0.3, 0.65, 1]}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: height != null ? height * 0.65 : '65%' }}
      />
    </View>
  );
}

// ─── Activity feed card ────────────────────────────────────────────────────────

interface ActivityFeedCardProps {
  item: ActivityItem;
  onGamePress: (slug: string) => void;
  onUserPress: (username: string) => void;
  cardHeight: number;
  badge?: 'you' | 'friend';
}

export function ActivityFeedCard({
  item,
  onGamePress,
  onUserPress,
  cardHeight,
  badge,
}: ActivityFeedCardProps) {
  const { user, game } = item;
  const meta = getActionMeta(item);
  const initials = (user.displayName ?? user.username).charAt(0).toUpperCase();
  const coverUri = game?.backgroundImage ?? game?.coverImage ?? null;

  const newRating =
    item.type === 'game_rated' &&
    item.metadata &&
    typeof item.metadata['newRating'] === 'number'
      ? (item.metadata['newRating'] as number)
      : null;

  const showLibrary =
    item.library != null &&
    (item.type === 'game_added' || item.type === 'game_rated' || item.type === 'game_noted');

  return (
    <Pressable
      onPress={game ? () => onGamePress(game.slug) : undefined}
      style={{ height: cardHeight }}
      className="bg-card rounded-2xl overflow-hidden mx-4 active:opacity-90"
    >
      {/* Hero image — grows to fill whatever space the body content doesn't need */}
      {coverUri ? (
        <CoverImage uri={coverUri} />
      ) : (
        <View style={{ flex: 1, backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="game-controller-outline" size={52} color={COLORS.textMuted} />
        </View>
      )}

      {/* Source badge — only shown in the All tab */}
      {badge != null && (
        <View
          style={{
            position: 'absolute', top: 14, left: 14,
            flexDirection: 'row', alignItems: 'center', gap: 5,
            backgroundColor: badge === 'you' ? 'rgba(16,185,129,0.85)' : 'rgba(59,130,246,0.85)',
            borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
          }}
        >
          <Ionicons name={badge === 'you' ? 'person' : 'people'} size={12} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>
            {badge === 'you' ? 'YOU' : 'FRIEND'}
          </Text>
        </View>
      )}

      {/* Body — auto-sized by its content so the image takes the rest */}
      <View style={{ padding: 14, gap: 6 }}>
        {/* Game title */}
        {game && (
          <Text className="text-base font-bold text-[#f1f5f9] leading-snug" numberOfLines={2}>
            {game.title}
          </Text>
        )}

        {/* Genre chips */}
        {game && game.genres.length > 0 && (
          <View className="flex-row flex-wrap gap-1">
            {game.genres.slice(0, 3).map((g) => (
              <View key={g.id} className="bg-accent/20 rounded-full px-2 py-0.5">
                <Text className="text-[10px] font-semibold text-accent-light">{g.name}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Action badge + stars for ratings */}
        <View className="flex-row flex-wrap items-center gap-2">
          <View
            style={{
              backgroundColor: meta.color + '22',
              borderRadius: 20,
              paddingHorizontal: 10,
              paddingVertical: 5,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              flexShrink: 1,
            }}
          >
            <Ionicons name={meta.icon} size={13} color={meta.color} />
            <Text style={{ color: meta.color, fontSize: 12, fontWeight: '700', flexShrink: 1 }} numberOfLines={2}>
              {meta.verb}
              {meta.detail ? `  ·  ${meta.detail}` : ''}
            </Text>
          </View>
          {newRating !== null && (
            <RatingStars rating={newRating} size={11} />
          )}
        </View>

        {/* Library badge */}
        {showLibrary && item.library && (
          <View className="flex-row items-center gap-2">
            <Ionicons name="folder-outline" size={12} color={COLORS.textMuted} />
            {item.library.isDefault && item.library.defaultType ? (
              <StatusBadge status={item.library.defaultType as DefaultLibraryType} />
            ) : (
              <View className="rounded-full bg-border px-2.5 py-0.5">
                <Text className="text-xs text-[#94a3b8]">{item.library.name}</Text>
              </View>
            )}
          </View>
        )}

        {/* Author row */}
        <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-border">
          <Pressable
            onPress={() => onUserPress(user.username)}
            className="flex-row items-center gap-2 active:opacity-70 flex-1 mr-3"
          >
            {user.avatarUrl ? (
              <Image
                source={{ uri: user.avatarUrl }}
                style={{ width: 28, height: 28, borderRadius: 14 }}
                contentFit="cover"
              />
            ) : (
              <View
                style={{
                  width: 28, height: 28, borderRadius: 14,
                  backgroundColor: COLORS.accent,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{initials}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text className="text-sm font-semibold text-[#f1f5f9]" numberOfLines={1}>
                {user.displayName ?? user.username}
              </Text>
              <Text className="text-xs text-[#64748b]">@{user.username}</Text>
            </View>
          </Pressable>
          <Text className="text-xs text-[#64748b] shrink-0">{relativeTime(item.createdAt)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Quick-add modal ───────────────────────────────────────────────────────────

const LIBRARY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  played: 'checkmark-circle',
  want_to_play: 'bookmark',
  backlog: 'time',
  currently_playing: 'play-circle',
};

interface QuickAddModalProps {
  visible: boolean;
  gameId: string;
  onClose: () => void;
  onAdded: () => void;
}

function QuickAddModal({ visible, gameId, onClose, onAdded }: QuickAddModalProps) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState<string | null>(null);

  const { data: libraries = [] } = useQuery<Library[]>({
    queryKey: queryKeys.libraries.all,
    queryFn: getLibraries,
    enabled: visible,
  });

  const { data: status = [] } = useQuery({
    queryKey: queryKeys.libraries.gameStatus(gameId),
    queryFn: () => getGameLibraryStatus(gameId),
    enabled: visible,
  });

  const addedIds = new Set(status.map((s) => s.libraryId));
  const available = libraries.filter((lib) => !addedIds.has(lib.id));

  async function handleAdd(lib: Library) {
    if (adding) return;
    setAdding(lib.id);
    try {
      await addGameToLibrary(lib.id, gameId);
      await queryClient.invalidateQueries({ queryKey: queryKeys.libraries.gameStatus(gameId) });
      onAdded();
      onClose();
    } catch {
      // silently fail
    } finally {
      setAdding(null);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}
        onPress={onClose}
      >
        <Pressable
          style={{ backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 }}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#f1f5f9' }}>Add to Library</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={COLORS.textMuted} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 320 }}>
            {available.length === 0 ? (
              <Text style={{ fontSize: 13, color: COLORS.textMuted, textAlign: 'center', paddingVertical: 20 }}>
                Game is in all your libraries
              </Text>
            ) : (
              available.map((lib) => {
                const icon: keyof typeof Ionicons.glyphMap =
                  lib.defaultType ? (LIBRARY_ICONS[lib.defaultType] ?? 'folder') : 'folder-outline';
                const isAdding = adding === lib.id;
                return (
                  <Pressable
                    key={lib.id}
                    onPress={() => void handleAdd(lib)}
                    disabled={!!adding}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, opacity: adding && !isAdding ? 0.5 : 1 }}
                  >
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.accent + '22', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name={icon} size={18} color={COLORS.accent} />
                    </View>
                    <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: '#f1f5f9' }}>{lib.name}</Text>
                    <Ionicons
                      name={isAdding ? 'reload-circle-outline' : 'add-circle-outline'}
                      size={20}
                      color={COLORS.accent}
                    />
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Recommendation feed card ──────────────────────────────────────────────────

interface RecFeedCardProps {
  recommendation: Recommendation;
  onPress: () => void;
  onDismiss: () => void;
  cardHeight: number;
}

export function RecFeedCard({ recommendation, onPress, onDismiss, cardHeight }: RecFeedCardProps) {
  const { game, reason } = recommendation;
  const [showAddModal, setShowAddModal] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const { data: libraryStatus, refetch: refetchStatus } = useQuery({
    queryKey: queryKeys.libraries.gameStatus(game.id),
    queryFn: () => getGameLibraryStatus(game.id),
  });

  const isInLibrary = (libraryStatus?.length ?? 0) > 0 || justAdded;
  const releaseYear = game.releaseDate ? new Date(game.releaseDate).getFullYear() : null;

  return (
    <>
      <Pressable
        onPress={onPress}
        style={{ height: cardHeight }}
        className="bg-card rounded-2xl overflow-hidden mx-4 active:opacity-90"
      >
        {/* Hero image — grows to fill whatever space the body content doesn't need */}
        <CoverImage uri={game.backgroundImage ?? game.coverImage ?? null} />

        {/* "For You" pill */}
        <View
          style={{
            position: 'absolute', top: 14, left: 14,
            flexDirection: 'row', alignItems: 'center', gap: 5,
            backgroundColor: 'rgba(124,58,237,0.85)',
            borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
          }}
        >
          <Ionicons name="sparkles" size={12} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>FOR YOU</Text>
        </View>

        {/* Body — auto-sized by its content so the image takes the rest */}
        <View style={{ padding: 14, gap: 6 }}>
          {/* Title */}
          <Text className="text-base font-bold text-[#f1f5f9] leading-snug" numberOfLines={2}>
            {game.title}
          </Text>

          {/* Genre chips */}
          {game.genres?.length > 0 && (
            <View className="flex-row flex-wrap gap-1">
              {game.genres.slice(0, 3).map((g) => (
                <View key={g.id} className="bg-accent/20 rounded-full px-2 py-0.5">
                  <Text className="text-[10px] font-semibold text-accent-light">{g.name}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Metadata: release year, platforms */}
          {(releaseYear != null || game.platforms?.length > 0) && (
            <View className="flex-row flex-wrap items-center gap-3">
              {releaseYear != null && (
                <Text className="text-xs text-[#94a3b8]">{releaseYear}</Text>
              )}
              {game.platforms?.slice(0, 2).map((p) => (
                <Text key={p.id} className="text-xs text-[#64748b]">{p.name}</Text>
              ))}
            </View>
          )}

          {/* Reason */}
          <Text className="text-sm text-[#94a3b8] leading-relaxed" numberOfLines={2}>
            {reason}
          </Text>

          {/* Library status */}
          {isInLibrary && libraryStatus && libraryStatus.length > 0 ? (
            <View className="flex-row flex-wrap items-center gap-2">
              <Ionicons name="checkmark-circle" size={13} color={COLORS.success} />
              {libraryStatus.slice(0, 2).map((s) =>
                s.defaultType ? (
                  <StatusBadge key={s.libraryId} status={s.defaultType} />
                ) : (
                  <View key={s.libraryId} className="rounded-full bg-border px-2.5 py-0.5">
                    <Text className="text-xs text-[#94a3b8]">{s.libraryName}</Text>
                  </View>
                )
              )}
            </View>
          ) : justAdded ? (
            <View className="flex-row items-center gap-2">
              <Ionicons name="checkmark-circle" size={13} color={COLORS.success} />
              <Text className="text-xs text-[#64748b]">Added to library</Text>
            </View>
          ) : null}

          {/* Bottom row: rating + actions */}
          <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-border">
            <View className="flex-row items-center gap-2">
              {game.rating != null && (
                <>
                  <RatingStars rating={game.rating} size={11} />
                  <Text className="text-xs text-[#64748b]">{game.rating.toFixed(1)}</Text>
                </>
              )}
            </View>
            <View className="flex-row items-center gap-2">
              {!isInLibrary && (
                <Pressable
                  onPress={(e) => { e.stopPropagation(); setShowAddModal(true); }}
                  hitSlop={8}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.accent, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }}
                >
                  <Ionicons name="add" size={13} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>Add</Text>
                </Pressable>
              )}
              <Pressable
                onPress={(e) => { e.stopPropagation(); onDismiss(); }}
                hitSlop={10}
                className="active:opacity-60 flex-row items-center gap-1"
              >
                <Ionicons name="close-circle-outline" size={15} color={COLORS.textMuted} />
                <Text className="text-xs text-[#64748b] font-medium">Not interested</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Pressable>

      <QuickAddModal
        visible={showAddModal}
        gameId={game.id}
        onClose={() => setShowAddModal(false)}
        onAdded={() => {
          setJustAdded(true);
          void refetchStatus();
        }}
      />
    </>
  );
}
