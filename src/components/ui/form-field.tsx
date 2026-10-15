import React, { ReactNode } from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { AlertCircle } from 'lucide-react-native';

import { useTheme } from '@/hooks/use-theme';

export interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function FormField({
  label,
  error,
  required,
  hint,
  children,
  style,
}: FormFieldProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, style]}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: theme.text }]}>
          {label}
        </Text>
        {required && (
          <Text style={[styles.requiredAsterisk, { color: theme.primary }]}>
            {' *'}
          </Text>
        )}
      </View>
      {hint ? (
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          {hint}
        </Text>
      ) : null}
      {children}
      {error ? (
        <View style={styles.errorRow}>
          <AlertCircle size={13} color={theme.danger} strokeWidth={2} style={styles.errorIcon} />
          <Text style={[styles.errorText, { color: theme.danger }]}>
            {error}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  requiredAsterisk: {
    fontSize: 14,
    fontWeight: '700',
  },
  hint: {
    fontSize: 12,
    marginBottom: 6,
    lineHeight: 16,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  errorIcon: {
    marginRight: 4,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
