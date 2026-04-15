import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  TouchableOpacity,
} from 'react-native';
import { defaultTheme } from '../theme/theme';

interface InputProps extends TextInputProps {
  label: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, secureTextEntry, ...props }) => {
  const [isSecure, setIsSecure] = useState(secureTextEntry);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputContainer, error ? styles.inputError : null]}>
        <TextInput
          style={styles.input}
          placeholderTextColor={defaultTheme.colors.textSecondary}
          secureTextEntry={isSecure}
          {...props}
        />
        {secureTextEntry && (
          <TouchableOpacity
            style={styles.eyeIcon}
            onPress={() => setIsSecure(!isSecure)}
            activeOpacity={0.7}
          >
            <Text style={styles.eyeText}>{isSecure ? '👁️' : '🙈'}</Text>
          </TouchableOpacity>
        )}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: defaultTheme.spacing.md,
  },
  label: {
    color: defaultTheme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: defaultTheme.spacing.sm,
  },
  inputContainer: {
    backgroundColor: defaultTheme.colors.inputBg,
    borderRadius: defaultTheme.borderRadius.md,
    borderWidth: 1,
    borderColor: defaultTheme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: defaultTheme.spacing.md,
    height: 52,
  },
  inputError: {
    borderColor: defaultTheme.colors.error,
    borderWidth: 1.5,
  },
  input: {
    flex: 1,
    color: defaultTheme.colors.textPrimary,
    fontSize: 16,
    height: '100%',
  },
  eyeIcon: {
    padding: defaultTheme.spacing.xs,
    marginLeft: defaultTheme.spacing.sm,
  },
  eyeText: {
    fontSize: 16,
  },
  errorText: {
    color: defaultTheme.colors.error,
    fontSize: 12,
    marginTop: defaultTheme.spacing.xs,
  },
});
