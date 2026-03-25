import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';

import { useAuthStore } from '@/store/auth.store';
import { queryKeys } from '@/constants/queryKeys';
import { COLORS } from '@/constants/theme';
import EmptyState from '@/components/EmptyState';
import {
  getSteamAccount,
  getSteamGames,
  validateSteamId,
  importSteamLibrary,
  unlinkSteamAccount,
  unsyncAllSteamGames,
  removeAllSteamGames,
  type ValidateResult,
} from '@/api/steam';

export default function SteamModal() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const isPro = user?.plan === 'pro';

  const [steamIdInput, setSteamIdInput] = useState('');
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [validated, setValidated] = useState<ValidateResult | null>(null);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    total: number;
  } | null>(null);

  const { data: account, isLoading: accountLoading } = useQuery({
    queryKey: queryKeys.steam.account,
    queryFn: getSteamAccount,
    enabled: isPro,
  });

  const { data: steamGames } = useQuery({
    queryKey: queryKeys.steam.games,
    queryFn: getSteamGames,
    enabled: isPro,
  });

  const handleValidate = async () => {
    if (!steamIdInput.trim()) return;
    setValidating(true);
    setValidated(null);
    try {
      const result = await validateSteamId(steamIdInput.trim());
      setValidated(result);
      if (!result.valid) {
        Toast.show({ type: 'error', text1: 'Steam ID not found' });
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Validation failed' });
    } finally {
      setValidating(false);
    }
  };

  const handleImport = async () => {
    const id = validated?.steamId ?? steamIdInput.trim();
    if (!id) return;
    setImporting(true);
    try {
      const result = await importSteamLibrary(id);
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: queryKeys.libraries.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.steam.account });
      queryClient.invalidateQueries({ queryKey: queryKeys.steam.games });
      Toast.show({
        type: 'success',
        text1: `Imported ${result.imported} games`,
        text2: `Skipped ${result.skipped} duplicates`,
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Import failed';
      Toast.show({ type: 'error', text1: msg });
    } finally {
      setImporting(false);
    }
  };

  const handleUnlink = () => {
    Alert.alert('Unlink Steam Account', 'Remove your Steam account link?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unlink',
        style: 'destructive',
        onPress: async () => {
          setUnlinking(true);
          try {
            await unlinkSteamAccount();
            queryClient.invalidateQueries({ queryKey: queryKeys.steam.account });
            Toast.show({ type: 'success', text1: 'Steam account unlinked' });
          } catch {
            Toast.show({ type: 'error', text1: 'Failed to unlink account' });
          } finally {
            setUnlinking(false);
          }
        },
      },
    ]);
  };

  const handleUnsync = () => {
    Alert.alert(
      'Remove Steam Tags',
      'This will remove Steam tags from all imported games but keep them in your library.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove Tags',
          style: 'destructive',
          onPress: async () => {
            try {
              const { unsynced } = await unsyncAllSteamGames();
              queryClient.invalidateQueries({ queryKey: queryKeys.steam.games });
              Toast.show({ type: 'success', text1: `Unsynced ${unsynced} games` });
            } catch {
              Toast.show({ type: 'error', text1: 'Failed to unsync games' });
            }
          },
        },
      ],
    );
  };

  const handleRemoveAll = () => {
    Alert.alert(
      'Remove All Steam Games',
      'This will permanently remove all Steam-imported games from your library.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove All',
          style: 'destructive',
          onPress: async () => {
            try {
              const { removed } = await removeAllSteamGames();
              queryClient.invalidateQueries({ queryKey: queryKeys.steam.games });
              queryClient.invalidateQueries({ queryKey: queryKeys.libraries.all });
              Toast.show({ type: 'success', text1: `Removed ${removed} games` });
            } catch {
              Toast.show({ type: 'error', text1: 'Failed to remove games' });
            }
          },
        },
      ],
    );
  };

  // Non-Pro gate — show full-screen empty state
  if (!isPro) {
    return (
        <SafeAreaView className="flex-1 bg-background">
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <Text className="text-lg font-bold text-[#f1f5f9]">Steam Import</Text>
          <Pressable onPress={() => router.back()} hitSlop={8} className="active:opacity-60">
            <Ionicons name="close" size={24} color={COLORS.textSecondary} />
          </Pressable>
        </View>
        <EmptyState
          icon="lock-closed-outline"
          title="Requires Pro"
          subtitle="Upgrade to Pro to import your Steam library and track all your games in one place."
          action={{
            label: 'Upgrade to Pro',
            onPress: () => {
              router.back();
              router.push('/billing/upgrade');
            },
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <Text className="text-lg font-bold text-[#f1f5f9]">Steam Import</Text>
        <Pressable onPress={() => router.back()} hitSlop={8} className="active:opacity-60">
          <Ionicons name="close" size={24} color={COLORS.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        {/* ── Pro content ── */}
        {isPro && (
          <>
            {accountLoading ? (
              <ActivityIndicator color={COLORS.accent} style={{ marginTop: 24 }} />
            ) : (
              <>
                {/* Linked account */}
                {account && (
                  <View className="bg-card rounded-xl p-4 mb-4">
                    <Text className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-3">
                      Linked Account
                    </Text>
                    <View className="flex-row items-center mb-4">
                      {account.avatarUrl ? (
                        <Image
                          source={{ uri: account.avatarUrl }}
                          style={{ width: 40, height: 40, borderRadius: 20 }}
                          contentFit="cover"
                        />
                      ) : (
                        <View className="w-10 h-10 rounded-full bg-[#334155] items-center justify-center">
                          <Ionicons name="logo-steam" size={20} color={COLORS.textMuted} />
                        </View>
                      )}
                      <View className="ml-3">
                        <Text className="text-sm font-semibold text-[#f1f5f9]">
                          {account.steamUsername}
                        </Text>
                        <Text className="text-xs text-[#64748b]">{account.steamId}</Text>
                      </View>
                    </View>
                    <Pressable
                      onPress={handleImport}
                      disabled={importing}
                      className="bg-violet-600 rounded-lg py-2.5 items-center mb-2 active:opacity-80"
                    >
                      {importing ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text className="text-sm font-semibold text-white">
                          Re-import Library
                        </Text>
                      )}
                    </Pressable>
                    <Pressable
                      onPress={handleUnlink}
                      disabled={unlinking}
                      className="border border-danger rounded-lg py-2.5 items-center active:opacity-70"
                    >
                      {unlinking ? (
                        <ActivityIndicator size="small" color={COLORS.danger} />
                      ) : (
                        <Text className="text-sm font-semibold text-danger">
                          Unlink Account
                        </Text>
                      )}
                    </Pressable>
                  </View>
                )}

                {/* Import form (when no account linked) */}
                {!account && (
                  <View className="bg-card rounded-xl p-4 mb-4">
                    <Text className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-3">
                      Import Steam Library
                    </Text>
                    <TextInput
                      value={steamIdInput}
                      onChangeText={(v) => {
                        setSteamIdInput(v);
                        setValidated(null);
                        setImportResult(null);
                      }}
                      placeholder="Enter Steam ID or profile URL"
                      placeholderTextColor={COLORS.textMuted}
                      autoCapitalize="none"
                      className="bg-background rounded-xl px-4 py-3 text-[#f1f5f9] text-sm mb-3"
                    />

                    {/* Validated preview */}
                    {validated?.valid && (
                      <View className="flex-row items-center mb-3 bg-background rounded-xl px-3 py-2.5">
                        {validated.avatarUrl ? (
                          <Image
                            source={{ uri: validated.avatarUrl }}
                            style={{ width: 32, height: 32, borderRadius: 16 }}
                            contentFit="cover"
                          />
                        ) : null}
                        <View className="ml-2">
                          <Text className="text-sm font-semibold text-[#22c55e]">
                            ✓ {validated.username ?? validated.steamId}
                          </Text>
                          <Text className="text-xs text-[#64748b]">Valid Steam account</Text>
                        </View>
                      </View>
                    )}

                    {/* Validate button */}
                    <Pressable
                      onPress={handleValidate}
                      disabled={validating || !steamIdInput.trim()}
                      className="border border-accent rounded-lg py-2.5 items-center mb-2 active:opacity-70"
                    >
                      {validating ? (
                        <ActivityIndicator size="small" color={COLORS.accent} />
                      ) : (
                        <Text className="text-sm font-semibold text-accent-light">
                          Validate
                        </Text>
                      )}
                    </Pressable>

                    {/* Import button */}
                    <Pressable
                      onPress={handleImport}
                      disabled={importing || !validated?.valid}
                      className={`rounded-lg py-2.5 items-center active:opacity-80 ${
                        validated?.valid ? 'bg-accent' : 'bg-border'
                      }`}
                    >
                      {importing ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text
                          className={`text-sm font-semibold ${
                            validated?.valid ? 'text-white' : 'text-[#64748b]'
                          }`}
                        >
                          Import Library
                        </Text>
                      )}
                    </Pressable>

                    {/* Import result */}
                    {importResult && (
                      <View className="mt-3 bg-background rounded-xl px-3 py-2.5">
                        <Text className="text-sm text-[#22c55e] font-semibold">
                          ✓ Imported {importResult.imported} games
                        </Text>
                        <Text className="text-xs text-[#64748b] mt-0.5">
                          Skipped {importResult.skipped} duplicates out of{' '}
                          {importResult.total} total
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Steam games section */}
                {steamGames && steamGames.length > 0 && (
                  <View className="bg-card rounded-xl p-4">
                    <View className="flex-row items-center justify-between mb-3">
                      <Text className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">
                        Steam Games
                      </Text>
                      <View className="bg-violet-900 rounded-full px-2.5 py-0.5">
                        <Text className="text-xs text-violet-300 font-semibold">
                          {steamGames.length}
                        </Text>
                      </View>
                    </View>
                    <Pressable
                      onPress={handleUnsync}
                      className="border border-border rounded-lg py-2.5 items-center mb-2 active:opacity-70"
                    >
                      <Text className="text-sm text-[#94a3b8]">Remove Steam Tags</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleRemoveAll}
                      className="border border-danger rounded-lg py-2.5 items-center active:opacity-70"
                    >
                      <Text className="text-sm font-semibold text-danger">
                        Remove All Steam Games
                      </Text>
                    </Pressable>
                  </View>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
