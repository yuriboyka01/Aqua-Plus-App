import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Gradients, Radii, Shadows } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  accentColor?: string;
  gradientColors?: readonly [string, string, ...string[]];
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

export function StatCard({
  title,
  value,
  icon,
  accentColor,
  gradientColors,
  subtitle,
  style,
  onPress,
}: StatCardProps) {
  const theme = useTheme();
  const color = accentColor ?? theme.primary;
  const bgGradients = gradientColors ?? Gradients.statCyan;

  const content = (
    <View style={[styles.card, { borderColor: theme.border }, style]}>
      <LinearGradient
        colors={bgGradients}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientOverlay}
      />
      <View style={styles.topRow}>
        <View style={[styles.iconContainer, { backgroundColor: `${color}15`, borderColor: `${color}30` }]}>
          {icon}
        </View>
        {subtitle ? (
          <View style={[styles.subtitleBadge, { backgroundColor: `${color}12` }]}>
            <Text style={[styles.subtitleText, { color }]}>{subtitle}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.bottomSection}>
        <Text style={[styles.value, { color: theme.text }]}>{value}</Text>
        <Text style={[styles.title, { color: theme.textSecondary }]} numberOfLines={1}>
          {title}
        </Text>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.pressable,
          pressed && styles.pressed,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  pressable: {
    flex: 1,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  card: {
    flex: 1,
    padding: 14,
    borderRadius: Radii.lg,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    minHeight: 114,
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
    ...Shadows.md,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFill,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: Radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitleBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radii.full,
  },
  subtitleText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  bottomSection: {
    marginTop: 'auto',
  },
  value: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 30,
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: -0.1,
  },
});
