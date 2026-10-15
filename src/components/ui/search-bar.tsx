import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { Search, X } from 'lucide-react-native';

import { Radii } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
  onClear?: () => void;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search customers, models...',
  style,
  onClear,
  autoCapitalize = 'none',
}: SearchBarProps) {
  const theme = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const handleClear = () => {
    onChangeText('');
    onClear?.();
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: '#FFFFFF',
          borderColor: isFocused ? theme.primary : theme.border,
        },
        isFocused && styles.focused,
        style,
      ]}
    >
      <Search
        size={18}
        color={isFocused ? theme.primary : theme.textSecondary}
        strokeWidth={2}
        style={styles.searchIcon}
      />
      <TextInput
        style={[styles.input, { color: theme.text }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textTertiary ?? '#64748B'}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        returnKeyType="search"
        underlineColorAndroid="transparent"
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
      {value.length > 0 && (
        <Pressable
          onPress={handleClear}
          hitSlop={8}
          style={styles.clearButton}
          accessibilityLabel="Clear search"
          accessibilityRole="button"
        >
          <View
            style={[
              styles.clearCircle,
              { backgroundColor: theme.backgroundElement },
            ]}
          >
            <X size={12} color={theme.textSecondary} strokeWidth={2.5} />
          </View>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radii.md,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    minHeight: 46,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  focused: {
    borderWidth: 1.5,
  },
  searchIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    paddingHorizontal: 0,
  },
  clearButton: {
    padding: 4,
    marginLeft: 6,
  },
  clearCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
