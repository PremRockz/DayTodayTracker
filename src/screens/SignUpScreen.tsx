import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { defaultTheme } from '../theme/theme';

export const SignUpScreen = ({ setIsAuthenticated }: any) => {
  const navigation = useNavigation<any>();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [gender, setGender] = useState('Male');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ name: '', email: '', password: '', confirmPassword: '' });

  const validate = () => {
    let isValid = true;
    const newErrors = { name: '', email: '', password: '', confirmPassword: '' };

    if (!name.trim() || name.length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
      isValid = false;
    }

    if (!email) {
      newErrors.email = 'Email is required';
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email';
      isValid = false;
    }

    if (!password) {
      newErrors.password = 'Password is required';
      isValid = false;
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
      isValid = false;
    } else if (!/\d/.test(password)) {
      newErrors.password = 'Password must contain at least 1 number';
      isValid = false;
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
      isValid = false;
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSignUp = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      await new Promise<void>(resolve => setTimeout(resolve, 800));
      
      const user = { name, email, password, gender };
      await AsyncStorage.setItem('user', JSON.stringify(user));
      await AsyncStorage.setItem('isAuthenticated', 'true');
      
      // Navigate or automatically log in
      setIsAuthenticated(true);
    } catch (e) {
      Alert.alert('Error', 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Sign up to get started</Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Full Name"
            placeholder="Enter your full name"
            value={name}
            onChangeText={(text) => {
              setName(text);
              setErrors({ ...errors, name: '' });
            }}
            error={errors.name}
          />

          <View style={styles.genderContainer}>
            <Text style={styles.genderLabel}>Gender</Text>
            <View style={styles.genderRow}>
              {['Male', 'Female', 'Other'].map(g => (
                <TouchableOpacity 
                  key={g} 
                  style={[styles.genderBtn, gender === g && styles.genderBtnActive]}
                  onPress={() => setGender(g)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.genderText, gender === g && styles.genderTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Input
            label="Email Address"
            placeholder="Enter your email"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setErrors({ ...errors, email: '' });
            }}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Input
            label="Password"
            placeholder="Create a password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setErrors({ ...errors, password: '' });
            }}
            error={errors.password}
            secureTextEntry
          />

          <Input
            label="Confirm Password"
            placeholder="Confirm your password"
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              setErrors({ ...errors, confirmPassword: '' });
            }}
            error={errors.confirmPassword}
            secureTextEntry
          />

          <Button 
            title="Sign Up" 
            onPress={handleSignUp} 
            loading={loading} 
            style={styles.signUpBtn}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Button 
            title="Sign In" 
            variant="text" 
            onPress={() => navigation.navigate('SignIn')} 
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: defaultTheme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: defaultTheme.spacing.lg,
    justifyContent: 'center',
  },
  header: {
    marginBottom: defaultTheme.spacing.xl,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: defaultTheme.colors.textPrimary,
    marginBottom: defaultTheme.spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    color: defaultTheme.colors.textSecondary,
  },
  form: {
    marginBottom: defaultTheme.spacing.xl,
  },
  genderContainer: {
    marginBottom: defaultTheme.spacing.md,
  },
  genderLabel: {
    color: defaultTheme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: defaultTheme.spacing.sm,
  },
  genderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  genderBtn: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: defaultTheme.colors.border,
    borderRadius: defaultTheme.borderRadius.md,
    alignItems: 'center',
    marginHorizontal: 4,
    backgroundColor: defaultTheme.colors.inputBg,
  },
  genderBtnActive: {
    borderColor: defaultTheme.colors.primary,
  },
  genderText: {
    color: defaultTheme.colors.textSecondary,
    fontSize: 14,
  },
  genderTextActive: {
    color: defaultTheme.colors.primary,
    fontWeight: '600',
  },
  signUpBtn: {
    marginTop: defaultTheme.spacing.md,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    color: defaultTheme.colors.textSecondary,
    fontSize: 14,
  },
});
