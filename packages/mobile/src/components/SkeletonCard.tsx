import { useEffect, useRef } from 'react';
import { View, Animated, Easing } from 'react-native';
import { COLORS } from '@/constants/theme';

interface SkeletonCardProps {
  mode: 'grid' | 'list';
}

export default function SkeletonCard({ mode }: SkeletonCardProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  const animatedStyle = { opacity };

  if (mode === 'list') {
    return (
      <View className="mx-4 mb-3 flex-row rounded-xl bg-[#1e293b] p-3">
        <Animated.View
          style={[{ width: 80, height: 80, borderRadius: 8, backgroundColor: COLORS.border }, animatedStyle]}
        />
        <View className="ml-3 flex-1 justify-center gap-2">
          <Animated.View
            style={[{ height: 14, borderRadius: 4, backgroundColor: COLORS.border, width: '70%' }, animatedStyle]}
          />
          <Animated.View
            style={[{ height: 10, borderRadius: 4, backgroundColor: COLORS.border, width: '50%' }, animatedStyle]}
          />
          <Animated.View
            style={[{ height: 10, borderRadius: 4, backgroundColor: COLORS.border, width: '30%' }, animatedStyle]}
          />
        </View>
      </View>
    );
  }

  return (
    <View className="mb-3 flex-1 rounded-xl bg-[#1e293b] overflow-hidden mx-1.5">
      <Animated.View
        style={[{ aspectRatio: 16 / 9, backgroundColor: COLORS.border }, animatedStyle]}
      />
      <View className="p-2 gap-2">
        <Animated.View
          style={[{ height: 12, borderRadius: 4, backgroundColor: COLORS.border, width: '80%' }, animatedStyle]}
        />
        <Animated.View
          style={[{ height: 10, borderRadius: 4, backgroundColor: COLORS.border, width: '40%' }, animatedStyle]}
        />
      </View>
    </View>
  );
}
