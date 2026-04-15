import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { defaultTheme } from '../theme/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'text';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  textStyle,
}) => {
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const isText = variant === 'text';

  const getContainerStyle = () => {
    if (isPrimary) return styles.primaryContainer;
    if (isSecondary) return styles.secondaryContainer;
    return styles.textContainer;
  };

  const getTextStyle = () => {
    if (isPrimary) return styles.primaryText;
    if (isSecondary) return styles.secondaryText;
    return styles.textBtnText;
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.baseContainer,
        getContainerStyle(),
        (disabled || loading) && !isText && styles.disabledContainer,
        (disabled || loading) && isText && styles.disabledTextContainer,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator
          color={isPrimary ? '#ffffff' : defaultTheme.colors.primary}
          size="small"
        />
      ) : (
        <Text style={[styles.baseText, getTextStyle(), textStyle]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  baseContainer: {
    height: 52,
    borderRadius: defaultTheme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  primaryContainer: {
    backgroundColor: defaultTheme.colors.primary,
  },
  secondaryContainer: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: defaultTheme.colors.primary,
  },
  textContainer: {
    backgroundColor: 'transparent',
    height: 'auto',
    paddingVertical: defaultTheme.spacing.sm,
  },
  disabledContainer: {
    opacity: 0.6,
  },
  disabledTextContainer: {
    opacity: 0.5,
  },
  baseText: {
    fontSize: 16,
    fontWeight: '700',
  },
  primaryText: {
    color: '#ffffff',
  },
  secondaryText: {
    color: defaultTheme.colors.primary,
  },
  textBtnText: {
    color: defaultTheme.colors.primary,
    fontSize: 14,
  },
});
