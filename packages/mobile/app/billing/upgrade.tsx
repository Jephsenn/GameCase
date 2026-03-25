import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';

import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/store/auth.store';
import { COLORS } from '@/constants/theme';
import { createCheckoutSession, createPortalSession, verifySubscription, getBillingPrice } from '@/api/billing';

const FEATURES = [
  'Unlimited game tracking',
  'Steam library import',
  'Year in Review stats',
  'Priority recommendations',
  'Early access to new features',
] as const;

export default function UpgradeModal() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [upgrading, setUpgrading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const isPro = user?.plan === 'pro';

  const { data: priceInfo } = useQuery({
    queryKey: ['billing', 'price'],
    queryFn: getBillingPrice,
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      const { url } = await createCheckoutSession();
      await WebBrowser.openBrowserAsync(url);

      // After browser closes, verify subscription status
      const { plan } = await verifySubscription();
      if (plan === 'pro' && user) {
        setUser({ ...user, plan: 'pro' });
        Toast.show({ type: 'success', text1: 'Welcome to Pro! 🎉' });
        router.back();
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Upgrade failed — please try again' });
    } finally {
      setUpgrading(false);
    }
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const { url } = await createPortalSession();
      await WebBrowser.openBrowserAsync(url);
    } catch {
      Toast.show({ type: 'error', text1: 'Could not open subscription portal' });
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Close button */}
      <View className="flex-row justify-end px-4 pt-2">
        <Pressable onPress={() => router.back()} hitSlop={8} className="active:opacity-60">
          <Ionicons name="close" size={26} color={COLORS.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
      >
        {/* ── Hero gradient ── */}
        <LinearGradient
          colors={['#7c3aed', '#4f46e5']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 20, padding: 28, marginBottom: 28, alignItems: 'center' }}
        >
          <Ionicons name="game-controller" size={40} color="rgba(255,255,255,0.9)" />
          <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 12 }}>
            GameCase Pro
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 15, marginTop: 4 }}>
            Unlock everything
          </Text>
        </LinearGradient>

        {isPro ? (
          /* ── Already Pro ── */
          <View className="items-center">
            <View className="bg-warning rounded-full p-4 mb-4">
              <Ionicons name="checkmark-circle" size={40} color="#000" />
            </View>
            <Text className="text-xl font-bold text-[#f1f5f9] text-center mb-2">
              You're already on Pro!
            </Text>
            <Text className="text-sm text-[#94a3b8] text-center mb-8">
              Enjoy all the benefits of GameCase Pro.
            </Text>
            <Pressable
              onPress={handleManageSubscription}
              disabled={portalLoading}
              className="w-full bg-card rounded-xl py-4 items-center active:opacity-80"
            >
              {portalLoading ? (
                <ActivityIndicator color={COLORS.accent} />
              ) : (
                <Text className="text-sm font-semibold text-[#f1f5f9]">
                  Manage Subscription
                </Text>
              )}
            </Pressable>
          </View>
        ) : (
          <>
            {/* ── Features list ── */}
            <View className="bg-card rounded-xl p-5 mb-6">
              {FEATURES.map((feature) => (
                <View key={feature} className="flex-row items-center mb-3 last:mb-0">
                  <View className="w-6 h-6 rounded-full bg-violet-900 items-center justify-center mr-3">
                    <Ionicons name="checkmark" size={14} color={COLORS.accentLight} />
                  </View>
                  <Text className="text-sm text-[#f1f5f9] flex-1">{feature}</Text>
                </View>
              ))}
            </View>

            {/* ── Price ── */}
            <View className="items-center mb-8">
              <Text className="text-4xl font-bold text-[#f1f5f9]">
                {priceInfo?.formatted ?? '—'}
              </Text>
              <Text className="text-sm text-[#94a3b8] mt-1">
                per month · cancel anytime
              </Text>
            </View>

            {/* ── Upgrade button ── */}
            <Pressable
              onPress={handleUpgrade}
              disabled={upgrading}
              className="w-full bg-accent rounded-xl py-4 items-center mb-4 active:opacity-80"
            >
              {upgrading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-base font-bold text-white">Upgrade Now</Text>
              )}
            </Pressable>

            {/* Maybe later */}
            <Pressable
              onPress={() => router.back()}
              className="items-center py-2 active:opacity-60"
            >
              <Text className="text-sm text-[#64748b]">Maybe later</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
