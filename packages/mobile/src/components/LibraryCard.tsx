import { View, Text, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Library } from '@/api/library';
import { COLORS } from '@/constants/theme';

interface LibraryCardProps {
  library: Library;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const DEFAULT_TYPE_ICON: Record<
  NonNullable<Library['defaultType']>,
  { name: keyof typeof Ionicons.glyphMap; color: string }
> = {
  played: { name: 'game-controller', color: COLORS.success },
  want_to_play: { name: 'bookmark', color: COLORS.accent },
  backlog: { name: 'list', color: COLORS.warning },
  currently_playing: { name: 'play-circle', color: COLORS.accentLight },
};

export default function LibraryCard({ library, onPress, onEdit, onDelete }: LibraryCardProps) {
  const handleLongPress = () => {
    const buttons: { text: string; onPress?: () => void; style?: 'destructive' | 'cancel' }[] = [
      { text: 'Edit Name', onPress: onEdit },
    ];

    if (!library.isDefault) {
      buttons.push({ text: 'Delete', style: 'destructive', onPress: onDelete });
    }

    buttons.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert(library.name, undefined, buttons);
  };

  const defaultIcon =
    library.isDefault && library.defaultType
      ? DEFAULT_TYPE_ICON[library.defaultType]
      : null;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={handleLongPress}
      className="mx-4 mb-3 flex-row items-center rounded-xl bg-card p-4 active:opacity-70"
    >
      {/* Left: default type icon or library icon */}
      <View className="mr-3 h-10 w-10 items-center justify-center rounded-lg bg-background">
        {defaultIcon ? (
          <Ionicons name={defaultIcon.name} size={22} color={defaultIcon.color} />
        ) : (
          <Ionicons name="folder-open" size={22} color={COLORS.textMuted} />
        )}
      </View>

      {/* Center: name + description */}
      <View className="flex-1">
        <Text className="text-base font-semibold text-[#f1f5f9]" numberOfLines={1}>
          {library.name}
        </Text>
        {library.description ? (
          <Text className="mt-0.5 text-xs text-[#94a3b8]" numberOfLines={1}>
            {library.description}
          </Text>
        ) : null}
      </View>

      {/* Right: item count + visibility */}
      <View className="ml-2 flex-row items-center gap-2">
          <View className="rounded-full bg-border px-2.5 py-1">
          <Text className="text-xs font-semibold text-[#94a3b8]">{library.itemCount}</Text>
        </View>
        <Ionicons
          name={library.visibility === 'public' ? 'globe-outline' : 'lock-closed-outline'}
          size={15}
          color={COLORS.textMuted}
        />
      </View>
    </Pressable>
  );
}
