import React, { useState } from 'react';
import {
  Platform,
  StyleProp,
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
  ViewStyle,
} from 'react-native';

import { Radii } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { FormField } from './form-field';

export interface TextInputFieldProps extends TextInputProps {
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
  containerStyle?: StyleProp<ViewStyle>;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function TextInputField({
  label,
  error,
  required,
  hint,
  containerStyle,
  leftIcon,
  rightIcon,
  style,
  onFocus,
  onBlur,
  multiline,
  numberOfLines,
  ...textInputProps
}: TextInputFieldProps) {
  const theme = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const getBorderColor = () => {
    if (error) return theme.danger;
    if (isFocused) return theme.primary;
    return theme.border;
  };

  return (
    <FormField
      label={label}
      error={error}
      required={required}
      hint={hint}
      style={containerStyle}
    >
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: '#FFFFFF',
            borderColor: getBorderColor(),
          },
          isFocused && styles.inputFocused,
          multiline && styles.inputMultiline,
        ]}
      >
        {leftIcon ? <View style={styles.leftIconContainer}>{leftIcon}</View> : null}
        <TextInput
          style={[
            styles.input,
            { color: theme.text },
            multiline && numberOfLines
              ? { height: 22 * numberOfLines, textAlignVertical: 'top' }
              : undefined,
            style,
          ]}
          placeholderTextColor={theme.textTertiary ?? '#64748B'}
          underlineColorAndroid="transparent"
          multiline={multiline}
          numberOfLines={numberOfLines}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          {...textInputProps}
        />
        {rightIcon ? (
          <View style={styles.rightIconContainer}>{rightIcon}</View>
        ) : null}
      </View>
    </FormField>
  );
}

const styles = StyleSheet.create({
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: Radii.md,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  inputFocused: {
    borderWidth: 1.5,
  },
  inputMultiline: {
    alignItems: 'flex-start',
    paddingVertical: 12,
    minHeight: 90,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    paddingHorizontal: 0,
  },
  leftIconContainer: {
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightIconContainer: {
    marginLeft: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
