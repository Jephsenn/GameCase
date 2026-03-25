import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  Animated,
  Easing,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

// ── Constants ────────────────────────────────────────────────────────────────

// 12 verified RAWG cover URLs — all confirmed HTTP 200
const COVERS = [
  'https://media.rawg.io/media/games/456/456dea5e1c7e3cd07060c14e96612001.jpg',
  'https://media.rawg.io/media/games/618/618c2031a07bbff6b4f611f10b6bcdbc.jpg',
  'https://media.rawg.io/media/games/562/562553814dd54e001a541e4ee83a591c.jpg',
  'https://media.rawg.io/media/games/f87/f87457e8347484033cb34cde6101d08d.jpg',
  'https://media.rawg.io/media/games/b54/b54598d1d5cc31899f4f0a7e3122a7b0.jpg',
  'https://media.rawg.io/media/games/8cc/8cce7c0e99dcc43d66c8efd42f9d03e3.jpg',
  'https://media.rawg.io/media/games/7cf/7cfc9220b401b7a300e409e539c9afd5.jpg',
  'https://media.rawg.io/media/games/fc1/fc1307a2774506b5bd65d7e8424664a7.jpg',
  'https://media.rawg.io/media/games/9fa/9fa63622543e5d4f6d99aa9d73b043de.jpg',
  'https://media.rawg.io/media/games/c24/c24ec439abf4a2e92f3429dfa83f7f94.jpg',
  'https://media.rawg.io/media/games/26d/26d4437715bee60138dab4a7c8c59c92.jpg',
  'https://media.rawg.io/media/games/4a0/4a0a1316102366260e6f38fd2a9cfdce.jpg',
];

const STATS = [
  { label: 'Games Tracked', value: '500K+' },
  { label: 'Library Entries', value: '1M+' },
  { label: 'Active Users', value: '50K+' },
];

// 4 columns → ~116px wide tiles on a 390px phone (was 7 → ~63px, causing blank tiles)
const N_COLS = 4;
const N_IMAGES = 8; // 8 tiles/col × 4 cols = 32 slots, all unique from 24-cover pool

// Extend beyond screen edges so the -4° rotation has no visible gaps
const { width: W, height: H } = Dimensions.get('window');
const OVERFLOW = 0.12;
const MOSAIC_W = W * (1 + OVERFLOW * 2);
const MOSAIC_H = H * (1 + OVERFLOW * 2);
const COL_GAP = 6;
const COL_W = Math.floor((MOSAIC_W - COL_GAP * (N_COLS - 1)) / N_COLS);
const TILE_H = Math.floor(COL_W * (4 / 3));
const TILE_GAP = 6;
const HALF_H = N_IMAGES * (TILE_H + TILE_GAP);

function buildCol(colIndex: number): string[] {
  return Array.from({ length: N_IMAGES }, (_, j) => COVERS[(colIndex + j * 2) % COVERS.length]);
}

// 4 columns, alternating direction, slow durations matching the web (80 + i*6 s)
const COLUMN_CONFIGS: { images: string[]; direction: 'up' | 'down'; duration: number }[] =
  Array.from({ length: N_COLS }, (_, i) => ({
    images: buildCol(i),
    direction: (i % 2 === 0 ? 'up' : 'down') as 'up' | 'down',
    duration: (80 + i * 6) * 1000,
  }));

// ── Scrolling column ─────────────────────────────────────────────────────────

interface ColProps {
  images: string[];
  direction: 'up' | 'down';
  duration: number;
}

function ScrollingColumn({ images, direction, duration }: ColProps) {
  const anim = useRef(
    new Animated.Value(direction === 'down' ? -HALF_H : 0),
  ).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(anim, {
        toValue: direction === 'down' ? 0 : -HALF_H,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tiles = [...images, ...images]; // doubled for seamless loop

  return (
    <View style={{ width: COL_W, height: MOSAIC_H, overflow: 'hidden' }}>
      <Animated.View style={{ transform: [{ translateY: anim }] }}>
        {tiles.map((uri, i) => (
          <Image
            key={i}
            source={{ uri }}
            cachePolicy="memory-disk"
            recyclingKey={uri}
            transition={300}
            style={{
              width: COL_W,
              height: TILE_H,
              borderRadius: 8,
              marginBottom: TILE_GAP,
              backgroundColor: '#1e1e2e',
            }}
            contentFit="cover"
          />
        ))}
      </Animated.View>
    </View>
  );
}

// ── Landing screen ───────────────────────────────────────────────────────────

export default function LandingScreen() {
  return (
    <View style={styles.root}>
      {/* Angled mosaic — rotated -4° with overflow to fill gaps, matching web */}
      <View style={styles.mosaicWrapper} pointerEvents="none">
        <View style={styles.mosaicInner}>
          {COLUMN_CONFIGS.map((cfg, i) => (
            <ScrollingColumn key={i} {...cfg} />
          ))}
        </View>
      </View>

      {/* Flat dark overlay — neutral-950/68 */}
      <View style={[StyleSheet.absoluteFill, styles.overlay]} pointerEvents="none" />

      {/* Radial vignette: transparent center, dark edges */}
      <LinearGradient
        style={[StyleSheet.absoluteFill, { height: H * 0.30, top: undefined }]}
        colors={['transparent', 'rgba(10,10,10,0.92)']}
        pointerEvents="none"
      />
      <LinearGradient
        style={[StyleSheet.absoluteFill, { height: H * 0.28, bottom: undefined }]}
        colors={['rgba(10,10,10,0.92)', 'transparent']}
        pointerEvents="none"
      />

      {/* Ambient violet/fuchsia glow */}
      <View style={styles.glowViolet} pointerEvents="none" />
      <View style={styles.glowFuchsia} pointerEvents="none" />

      {/* Hero */}
      <View style={styles.hero}>
        {/* Logo */}
        <View style={styles.logoRow}>
          <LinearGradient
            colors={['#7c3aed', '#a855f7', '#d946ef']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoBox}
          >
            <Text style={styles.logoLetter}>G</Text>
          </LinearGradient>
          <Text style={styles.logoText}>
            Game<Text style={styles.logoTracker}>Tracker</Text>
          </Text>
        </View>

        {/* Headline — matches web exactly */}
        <Text style={styles.headline}>Your games.</Text>
        <Text style={styles.headlineAccent}>All in one place.</Text>

        {/* Subheadline */}
        <Text style={styles.subheadline}>
          Track your games. Build your library.{'\n'}Discover what to play next.
        </Text>

        {/* CTAs — stacked vertically, full width */}
        <View style={styles.ctaCol}>
          <Pressable onPress={() => router.push('/(auth)/register')}>
            {({ pressed }) => (
              <View style={[styles.btnPrimary, pressed && { opacity: 0.75 }]}>
                <Text style={styles.btnPrimaryText}>Get Started</Text>
              </View>
            )}
          </Pressable>
          <Pressable onPress={() => router.push('/(auth)/login')}>
            {({ pressed }) => (
              <View style={[styles.btnSecondary, pressed && { opacity: 0.75 }]}>
                <Text style={styles.btnSecondaryText}>Sign In</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {STATS.map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  mosaicWrapper: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mosaicInner: {
    position: 'absolute',
    top: -H * OVERFLOW,
    left: -W * OVERFLOW,
    width: MOSAIC_W,
    height: MOSAIC_H,
    flexDirection: 'row',
    gap: COL_GAP,
    transform: [{ rotate: '-4deg' }],
  },
  overlay: {
    backgroundColor: 'rgba(10,10,10,0.68)',
  },
  glowViolet: {
    position: 'absolute',
    width: 480,
    height: 480,
    borderRadius: 240,
    backgroundColor: 'rgba(124,58,237,0.11)',
    top: '50%',
    left: '50%',
    marginLeft: -240,
    marginTop: -240,
  },
  glowFuchsia: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(217,70,239,0.09)',
    top: '45%',
    left: '50%',
    marginLeft: -140,
    marginTop: -140,
  },
  hero: {
    zIndex: 10,
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 28,
  },
  logoBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: {
    fontSize: 26,
    fontWeight: '900',
    color: '#ffffff',
  },
  logoText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  logoTracker: {
    color: '#a78bfa', // violet-400 matching web
  },
  headline: {
    fontSize: 46,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: -1.5,
    lineHeight: 50,
  },
  // "All in one place." — fuchsia-400, midpoint of web's violet→fuchsia→pink gradient
  headlineAccent: {
    fontSize: 46,
    fontWeight: '900',
    color: '#e879f9',
    textAlign: 'center',
    letterSpacing: -1.5,
    lineHeight: 52,
    marginBottom: 20,
  },
  subheadline: {
    fontSize: 16,
    color: '#a3a3a3',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    maxWidth: 300,
  },
  ctaCol: {
    flexDirection: 'column',
    gap: 12,
    marginBottom: 32,
    width: W - 48,
  },
  btnPrimary: {
    backgroundColor: '#7c3aed',
    paddingVertical: 17,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  btnSecondary: {
    borderWidth: 1.5,
    borderColor: 'rgba(167,139,250,0.45)',
    backgroundColor: 'rgba(124,58,237,0.18)',
    paddingVertical: 17,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  btnSecondaryText: {
    color: '#c4b5fd',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  statCard: {
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: 'rgba(64,64,64,0.6)',
    backgroundColor: 'rgba(23,23,23,0.5)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  statValue: {
    fontSize: 17,
    fontWeight: '700',
    color: '#a78bfa',
  },
  statLabel: {
    fontSize: 11,
    color: '#737373',
  },
});
