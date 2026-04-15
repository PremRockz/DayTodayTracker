import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { defaultTheme } from '../theme/theme';

export const SignInScreen = ({ setIsAuthenticated }: any) => {
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({ email: '', password: '', general: '' });
  const [loading, setLoading] = useState(false);
  const [userGender, setUserGender] = useState('');

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userStr = await AsyncStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          if (user.email) setEmail(user.email);
          if (user.password) setPassword(user.password);
          if (user.gender) setUserGender(user.gender);
        }
      } catch (e) {
        console.error('Failed to prefill user data', e);
      }
    };
    fetchUserData();
  }, []);

  const validate = () => {
    let isValid = true;
    const newErrors = { email: '', password: '', general: '' };

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
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSignIn = async () => {
    if (!validate()) return;
    
    setLoading(true);
    try {
      // Simulate API Call
      await new Promise<void>(resolve => setTimeout(resolve, 800));
      
      const userStr = await AsyncStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;

      if (!user || user.email !== email) {
        // User does not exist or email does not match, redirect to sign up directly
        navigation.navigate('SignUp');
      } else if (user.password !== password) {
        // User exists but password is wrong
        setErrors({ ...errors, password: 'Wrong password', general: '' });
      } else {
        // Assume success, set authenticated state
        await AsyncStorage.setItem('isAuthenticated', 'true');
        setIsAuthenticated(true);
      }
    } catch (e) {
      setErrors({ ...errors, general: 'Something went wrong' });
    } finally {
      setLoading(false);
    }
  };

  const getAvatarUri = () => {
    if (userGender === 'Female') return 'https://avatar.iran.liara.run/public/girl';
    if (userGender === 'Male') return 'https://avatar.iran.liara.run/public/boy';
    return 'https://avatar.iran.liara.run/public';
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          {userGender ? (
            <View style={styles.avatarContainer}>
              <Image source={{ uri: getAvatarUri() }} style={styles.avatar} />
            </View>
          ) : null}
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>
        </View>

        <View style={styles.form}>
          {errors.general ? <Text style={styles.errorGeneral}>{errors.general}</Text> : null}

          <Input
            label="Email Address"
            placeholder="Enter your email"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setErrors({ ...errors, email: '', general: '' });
            }}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Input
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setErrors({ ...errors, password: '', general: '' });
            }}
            error={errors.password}
            secureTextEntry
          />

          <Button 
            title="Sign In" 
            onPress={handleSignIn} 
            loading={loading} 
            style={styles.signInBtn}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Button 
            title="Sign Up" 
            variant="text" 
            onPress={() => navigation.navigate('SignUp')} 
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
    alignItems: 'center',
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: defaultTheme.colors.inputBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: defaultTheme.spacing.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: defaultTheme.colors.primary,
  },
  avatar: {
    width: 100,
    height: 100,
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
  signInBtn: {
    marginTop: defaultTheme.spacing.md,
  },
  errorGeneral: {
    color: defaultTheme.colors.error,
    fontSize: 14,
    marginBottom: defaultTheme.spacing.md,
    textAlign: 'center',
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
