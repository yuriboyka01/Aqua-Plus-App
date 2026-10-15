import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Gradients, Radii, Shadows } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface ActionButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  disabled?: boolean;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export function ActionButton({
  title,
  onPress,
  variant = 'primary',
  icon,
  iconPosition = 'left',
  disabled = false,
  fullWidth = false,
  size = 'md',
  loading = false,
  style,
  textStyle,
}: ActionButtonProps) {
  const theme = useTheme();

  const isGradient = variant === 'primary';

  const renderContent = () => {
    if (loading) {
      const spinnerColor =
        variant === 'primary' || variant === 'danger' || variant === 'secondary'
          ? '#FFFFFF'
          : theme.primary;
      return <ActivityIndicator size="small" color={spinnerColor} />;
    }

    const getTextColor = () => {
      switch (variant) {
        case 'primary':
        case 'secondary':
        case 'danger':
          return '#FFFFFF';
        case 'outline':
        case 'ghost':
          return theme.primary;
        default:
          return '#FFFFFF';
      }
    };

    return (
      <View style={styles.innerRow}>
        {icon && iconPosition === 'left' ? (
          <View style={styles.iconLeft}>{icon}</View>
        ) : null}
        <Text
          style={[
            styles.textBase,
            { color: getTextColor() },
            size === 'sm' && styles.textSm,
            size === 'md' && styles.textMd,
            size === 'lg' && styles.textLg,
            textStyle,
          ]}
        >
          {title}
        </Text>
        {icon && iconPosition === 'right' ? (
          <View style={styles.iconRight}>{icon}</View>
        ) : null}
      </View>
    );
  };

  const getContainerStyle = () => {
    switch (variant) {
      case 'secondary':
        return {
          backgroundColor: theme.secondaryBlue,
          borderColor: 'transparent',
          borderWidth: 0,
          ...Shadows.sm,
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderColor: theme.primary,
          borderWidth: 1.5,
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          borderColor: 'transparent',
          borderWidth: 0,
        };
      case 'danger':
        return {
          backgroundColor: theme.danger,
          borderColor: theme.danger,
          borderWidth: 1,
          ...Shadows.sm,
        };
      case 'primary':
      default:
        return {
          backgroundColor: theme.primary,
          borderColor: 'transparent',
          borderWidth: 0,
          ...Shadows.md,
        };
    }
  };

  const sizeStyle =
    size === 'sm' ? styles.sizeSm : size === 'md' ? styles.sizeMd : styles.sizeLg;

  if (isGradient && !disabled) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled || loading}
        style={({ pressed }) => [
          styles.outerWrapper,
          fullWidth && styles.fullWidth,
          disabled && styles.disabled,
          pressed && !disabled && !loading && styles.pressed,
          style,
        ]}
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || loading }}
      >
        <LinearGradient
          colors={Gradients.buttonPrimary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.base, sizeStyle, styles.gradientShadow]}
        >
          {renderContent()}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        sizeStyle,
        getContainerStyle(),
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        pressed && !disabled && !loading && styles.pressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
    >
      {renderContent()}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outerWrapper: {
    borderRadius: Radii.md,
    overflow: 'hidden',
  },
  base: {
    borderRadius: Radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientShadow: {
    ...Shadows.md,
  },
  innerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  sizeSm: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    minHeight: 34,
  },
  sizeMd: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    minHeight: 46,
  },
  sizeLg: {
    paddingVertical: 14,
    paddingHorizontal: 22,
    minHeight: 52,
  },
  iconLeft: {
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconRight: {
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBase: {
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  textSm: {
    fontSize: 13,
    lineHeight: 18,
  },
  textMd: {
    fontSize: 15,
    lineHeight: 20,
  },
  textLg: {
    fontSize: 16,
    lineHeight: 22,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.45,
  },
});
