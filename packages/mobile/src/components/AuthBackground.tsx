import { useEffect, useRef } from 'react';
import { View, Animated, Easing, Dimensions, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

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

const { width: W, height: H } = Dimensions.get('window');
const N_COLS = 4;
const N_IMAGES = 8;
const OVERFLOW = 0.12;
const MOSAIC_W = W * (1 + OVERFLOW * 2);
const MOSAIC_H = H * (1 + OVERFLOW * 2);
const COL_GAP = 6;
const COL_W = Math.floor((MOSAIC_W - COL_GAP * (N_COLS - 1)) / N_COLS);
const TILE_H = Math.floor(COL_W * (4 / 3));
const TILE_GAP = 6;
const HALF_H = N_IMAGES * (TILE_H + TILE_GAP);

function buildCol(offset: number): string[] {
  return Array.from({ length: N_IMAGES }, (_, j) => COVERS[(offset + j * 2) % COVERS.length]);
}

const COLUMN_CONFIGS: { images: string[]; direction: 'up' | 'down'; duration: number }[] =
  Array.from({ length: N_COLS }, (_, i) => ({
    images: buildCol(i),
    direction: (i % 2 === 0 ? 'up' : 'down') as 'up' | 'down',
    duration: (80 + i * 6) * 1000,
  }));

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

  const tiles = [...images, ...images];

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
              backgroundColor: '#1e293b',
            }}
            contentFit="cover"
          />
        ))}
      </Animated.View>
    </View>
  );
}

/**
 * Full-screen animated game-cover mosaic with a dark gradient overlay.
 * Render with `StyleSheet.absoluteFill` (or `pointerEvents="none"`) behind
 * the auth form content.
 */
export default function AuthBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Angled mosaic — -4° rotation with overflow to match web homepage */}
      <View style={{
        position: 'absolute',
        top: -H * OVERFLOW,
        left: -W * OVERFLOW,
        width: MOSAIC_W,
        height: MOSAIC_H,
        flexDirection: 'row',
        gap: COL_GAP,
        transform: [{ rotate: '-4deg' }],
      }}>
        {COLUMN_CONFIGS.map((cfg, i) => (
          <ScrollingColumn key={i} {...cfg} />
        ))}
      </View>

      {/* Darker, more uniform overlay so form elements stand out clearly */}
      <LinearGradient
        style={StyleSheet.absoluteFill}
        colors={[
          'rgba(8,6,18,0.97)',
          'rgba(8,6,18,0.78)',
          'rgba(8,6,18,0.82)',
          'rgba(8,6,18,0.97)',
        ]}
        locations={[0, 0.25, 0.75, 1]}
      />
    </View>
  );
}
