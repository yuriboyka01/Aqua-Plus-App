import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Gradients, Radii, Shadows } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface CardProps extends ViewProps {
  variant?: 'default' | 'elevated' | 'outlined' | 'glass' | 'gradient' | 'hero';
  tinted?: boolean;
}

export function Card({
  style,
  variant = 'default',
  tinted = false,
  children,
  ...props
}: CardProps) {
  const theme = useTheme();

  if (variant === 'hero') {
    return (
      <LinearGradient
        colors={Gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.base, styles.heroCard, style]}
        {...props}
      >
        {children}
      </LinearGradient>
    );
  }

  if (variant === 'gradient') {
    return (
      <LinearGradient
        colors={tinted ? Gradients.cardAquaTint : Gradients.cardHighlight}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.base,
          styles.defaultVariant,
          { borderColor: theme.border },
          style,
        ]}
        {...props}
      >
        {children}
      </LinearGradient>
    );
  }

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor:
            variant === 'glass'
              ? 'rgba(255, 255, 255, 0.88)'
              : theme.cardBackground,
          borderColor:
            variant === 'glass'
              ? 'rgba(6, 182, 212, 0.28)'
              : theme.border,
        },
        variant === 'default' && styles.defaultVariant,
        variant === 'elevated' && styles.elevatedVariant,
        variant === 'outlined' && styles.outlinedVariant,
        variant === 'glass' && styles.glassVariant,
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radii.lg,
    padding: 16,
    overflow: 'hidden',
  },
  defaultVariant: {
    borderWidth: 1,
    ...Shadows.md,
  },
  elevatedVariant: {
    borderWidth: 1,
    ...Shadows.lg,
  },
  outlinedVariant: {
    borderWidth: 1.5,
    elevation: 0,
    shadowOpacity: 0,
  },
  glassVariant: {
    borderWidth: 1,
    ...Shadows.md,
  },
  heroCard: {
    ...Shadows.hero,
  },
});
