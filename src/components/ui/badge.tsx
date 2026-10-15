import React from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import { Radii } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface BadgeProps {
  label: string;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'default' | 'aqua' | 'blue';
  size?: 'xs' | 'sm' | 'md';
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export function Badge({
  label,
  variant = 'default',
  size = 'md',
  icon,
  style,
  textStyle,
}: BadgeProps) {
  const theme = useTheme();

  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return {
          backgroundColor: theme.successLight,
          textColor: '#059669',
          borderColor: 'rgba(16, 185, 129, 0.25)',
        };
      case 'warning':
        return {
          backgroundColor: theme.warningLight,
          textColor: '#D97706',
          borderColor: 'rgba(245, 158, 11, 0.3)',
        };
      case 'danger':
        return {
          backgroundColor: theme.dangerLight,
          textColor: '#DC2626',
          borderColor: 'rgba(239, 68, 68, 0.3)',
        };
      case 'aqua':
        return {
          backgroundColor: '#ECFEFF',
          textColor: '#0E7490',
          borderColor: 'rgba(6, 182, 212, 0.35)',
        };
      case 'blue':
        return {
          backgroundColor: '#F0F9FF',
          textColor: '#0369A1',
          borderColor: 'rgba(3, 105, 161, 0.25)',
        };
      case 'info':
        return {
          backgroundColor: '#E0F2FE',
          textColor: '#0369A1',
          borderColor: 'rgba(8, 145, 178, 0.25)',
        };
      case 'default':
      default:
        return {
          backgroundColor: theme.backgroundElement,
          textColor: theme.textSecondary,
          borderColor: theme.border,
        };
    }
  };

  const { backgroundColor, textColor, borderColor } = getVariantStyles();

  return (
    <View
      style={[
        styles.badge,
        size === 'xs' && styles.badgeXs,
        size === 'sm' && styles.badgeSm,
        size === 'md' && styles.badgeMd,
        { backgroundColor, borderColor },
        style,
      ]}
    >
      {icon ? <View style={styles.iconWrapper}>{icon}</View> : null}
      <Text
        style={[
          styles.text,
          size === 'xs' && styles.textXs,
          size === 'sm' && styles.textSm,
          size === 'md' && styles.textMd,
          { color: textColor },
          textStyle,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: Radii.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeXs: {
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeSm: {
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  badgeMd: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  iconWrapper: {
    marginRight: 4,
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  textXs: {
    fontSize: 10,
    lineHeight: 13,
  },
  textSm: {
    fontSize: 11,
    lineHeight: 14,
  },
  textMd: {
    fontSize: 12,
    lineHeight: 16,
  },
});
