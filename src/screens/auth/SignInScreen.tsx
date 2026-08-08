import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path, Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { Target, ShieldCheck, Lock, Zap, RefreshCw, ArrowRight } from 'lucide-react-native';
import { GoogleIcon } from '../../components/GoogleIcon';
import { GoogleDriveIcon } from '../../components/GoogleDriveIcon';
import { signInWithGoogle, describeGoogleSignInError } from '../../services/googleAuth';
import { pullFromDriveIfEmpty } from '../../services/driveSync';
import { defaultTheme } from '../../theme/theme';

const HERO_BACKGROUND = '#071A12';

const HERO_DOTS = [
  { top: 6, left: 60, size: 3 },
  { top: 2, left: 78, size: 4 },
  { top: 18, left: 92, size: 3 },
  { top: 26, left: 68, size: 3 },
  { top: 14, left: 40, size: 3 },
  { top: 34, left: 84, size: 4 },
  { top: 40, left: 52, size: 3 },
  { top: 0, left: 20, size: 3 },
  { top: 22, left: 8, size: 3 },
];

const RING_DOT_ANGLES = [0, 60, 120, 180, 240, 300];

export const SignInScreen = ({ setIsAuthenticated }: any) => {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result.status === 'cancelled') return;

      const { user } = result;
      await AsyncStorage.setItem(
        'user',
        JSON.stringify({ email: user.email, name: user.name, photo: user.photo, authProvider: 'google' }),
      );
      await AsyncStorage.setItem('isAuthenticated', 'true');
      setIsAuthenticated(true);

      try {
        await pullFromDriveIfEmpty();
      } catch (driveError) {
        console.error('Drive restore failed (sign-in still succeeded):', driveError);
      }
    } catch (e) {
      console.error('Google sign-in error:', e);
      setError(describeGoogleSignInError(e));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Svg style={styles.heroGlow} width="100%" height="100%" pointerEvents="none">
            <Defs>
              <RadialGradient id="heroGlow" cx="78%" cy="28%" r="60%">
                <Stop offset="0%" stopColor={defaultTheme.colors.primary} stopOpacity={0.28} />
                <Stop offset="100%" stopColor={defaultTheme.colors.primary} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroGlow)" />
          </Svg>

          <SafeAreaView edges={['top']}>
            <View style={styles.heroInner}>
              <View style={styles.heroDots} pointerEvents="none">
                {HERO_DOTS.map((dot, index) => (
                  <View
                    key={index}
                    style={[
                      styles.heroDot,
                      { top: dot.top, left: dot.left, width: dot.size, height: dot.size, borderRadius: dot.size / 2 },
                    ]}
                  />
                ))}
              </View>

              <View style={styles.heroTop}>
                <View style={styles.heroTextCol}>
                  <View style={styles.brandRing}>
                    <Target size={28} color={defaultTheme.colors.primary} strokeWidth={2} />
                  </View>
                  <Text style={styles.title}>
                    Welcome{'\n'}
                    <Text style={styles.titleAccent}>Back!</Text>
                  </Text>
                  <View style={styles.titleUnderline} />
                  <Text style={styles.subtitle}>Sign in with Google to continue to your trackers</Text>
                </View>

                <View style={styles.illustrationCol}>
                  <View style={styles.illustrationGlowOuter} />
                  <View style={styles.illustrationGlowInner} />
                  <View style={styles.phoneBody}>
                    <View style={styles.phoneCamera} />
                  </View>
                  <View style={styles.driveCard}>
                    <GoogleDriveIcon size={44} />
                  </View>
                  <View style={[styles.badge, styles.badgeShield]}>
                    <ShieldCheck size={16} color="#FFFFFF" strokeWidth={2.5} />
                  </View>
                  <View style={[styles.badge, styles.badgeLock]}>
                    <Lock size={14} color="#FFFFFF" strokeWidth={2.5} />
                  </View>
                  <View style={styles.phoneStandGlow} />
                  <View style={styles.phoneStand} />
                </View>
              </View>
            </View>
          </SafeAreaView>

          <Svg style={styles.wave} width="100%" height={64} viewBox="0 0 400 64" preserveAspectRatio="none">
            <Path
              d="M0,8 C 90,64 180,0 260,30 C 320,52 360,16 400,24 L400,64 L0,64 Z"
              fill={defaultTheme.colors.primary}
            />
          </Svg>
        </View>

        <View style={styles.body}>
          <View style={styles.safeCard}>
            <View style={styles.safeIconWrap}>
              <View style={styles.safeRing} />
              {RING_DOT_ANGLES.map((angle) => (
                <View
                  key={angle}
                  style={[
                    styles.safeRingDot,
                    { transform: [{ rotate: `${angle}deg` }, { translateY: -38 }] },
                  ]}
                />
              ))}
              <View style={styles.safeShield}>
                <ShieldCheck size={28} color="#FFFFFF" strokeWidth={2.5} />
              </View>
            </View>
            <View style={styles.safeTextCol}>
              <Text style={styles.safeTitle}>Your data is safe</Text>
              <Text style={styles.safeSubtitle}>
                All your data is securely stored in your <Text style={styles.safeHighlight}>Google Drive</Text>.
              </Text>
            </View>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Sign in with</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleGoogleSignIn}
            disabled={googleLoading}
            style={[styles.googleBtn, googleLoading && styles.disabledContainer]}
          >
            <View style={styles.googleBtnContent}>
              <GoogleIcon size={20} />
              <Text style={styles.googleBtnText}>Continue with Google</Text>
            </View>
            <View style={styles.googleBtnArrow}>
              {googleLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <ArrowRight size={20} color="#FFFFFF" strokeWidth={2.5} />
              )}
            </View>
          </TouchableOpacity>

          <View style={styles.featuresRow}>
            <View style={styles.featureItem}>
              <View style={styles.featureIconWrap}>
                <ShieldCheck size={20} color={defaultTheme.colors.primary} strokeWidth={2.2} />
              </View>
              <Text style={styles.featureText}>Secure{'\n'}Login</Text>
            </View>
            <View style={styles.featureDivider} />
            <View style={styles.featureItem}>
              <View style={styles.featureIconWrap}>
                <Zap size={20} color={defaultTheme.colors.primary} strokeWidth={2.2} />
              </View>
              <Text style={styles.featureText}>Quick &{'\n'}Easy</Text>
            </View>
            <View style={styles.featureDivider} />
            <View style={styles.featureItem}>
              <View style={styles.featureIconWrap}>
                <RefreshCw size={20} color={defaultTheme.colors.primary} strokeWidth={2.2} />
              </View>
              <Text style={styles.featureText}>Sync Across{'\n'}Devices</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <View style={styles.privacyCard}>
          <View style={styles.privacyIconWrap}>
            <Lock size={20} color="#FFFFFF" strokeWidth={2.5} />
          </View>
          <View style={styles.privacyTextCol}>
            <Text style={styles.privacyTitle}>We respect your privacy</Text>
            <Text style={styles.privacySubtitle}>
              Your data is safe with your Google Drive itself. We don't store your data on our servers.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: defaultTheme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 16,
  },
  footer: {
    backgroundColor: defaultTheme.colors.background,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  hero: {
    backgroundColor: HERO_BACKGROUND,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  heroInner: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 30,
  },
  heroDots: {
    position: 'absolute',
    top: 0,
    right: 20,
    width: 110,
    height: 60,
  },
  heroDot: {
    position: 'absolute',
    backgroundColor: 'rgba(16, 185, 129, 0.55)',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroTextCol: {
    flex: 1.15,
    paddingRight: 10,
  },
  brandRing: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.5)',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 32,
  },
  titleAccent: {
    color: defaultTheme.colors.primary,
  },
  titleUnderline: {
    width: 64,
    height: 3,
    borderRadius: 2,
    backgroundColor: defaultTheme.colors.primary,
    marginTop: 6,
    marginBottom: 14,
  },
  subtitle: {
    fontSize: 13.5,
    color: 'rgba(255, 255, 255, 0.65)',
    lineHeight: 19,
  },
  illustrationCol: {
    width: 140,
    height: 186,
    justifyContent: 'center',
    alignItems: 'center',
  },
  illustrationGlowOuter: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.22)',
  },
  illustrationGlowInner: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: 'rgba(16, 185, 129, 0.10)',
  },
  phoneBody: {
    position: 'absolute',
    width: 104,
    height: 172,
    borderRadius: 26,
    backgroundColor: '#0F2E22',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    transform: [{ rotate: '7deg' }],
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 8,
  },
  phoneCamera: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  driveCard: {
    width: 66,
    height: 66,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: defaultTheme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  phoneStandGlow: {
    position: 'absolute',
    bottom: 4,
    width: 84,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.35)',
  },
  phoneStand: {
    position: 'absolute',
    bottom: 11,
    width: 56,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  badge: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: defaultTheme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: HERO_BACKGROUND,
  },
  badgeShield: {
    top: 20,
    left: 4,
  },
  badgeLock: {
    bottom: 40,
    right: 4,
  },
  wave: {
    marginTop: -2,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 26,
  },
  safeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: defaultTheme.colors.card,
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 4,
  },
  safeIconWrap: {
    width: 76,
    height: 76,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  safeRing: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    borderColor: defaultTheme.colors.border,
    borderStyle: 'dashed',
  },
  safeRingDot: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: defaultTheme.colors.primary,
    top: 35.5,
    left: 35.5,
  },
  safeShield: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: defaultTheme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: defaultTheme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  safeTextCol: {
    flex: 1,
  },
  safeTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: defaultTheme.colors.textPrimary,
    marginBottom: 4,
  },
  safeSubtitle: {
    fontSize: 13,
    color: defaultTheme.colors.textSecondary,
    lineHeight: 18,
  },
  safeHighlight: {
    color: defaultTheme.colors.primary,
    fontWeight: '700',
  },
  errorText: {
    color: defaultTheme.colors.error,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 10,
    fontWeight: '600',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: defaultTheme.colors.border,
  },
  dividerText: {
    marginHorizontal: 10,
    color: defaultTheme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 58,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: defaultTheme.colors.primary,
    backgroundColor: defaultTheme.colors.card,
    paddingLeft: 18,
    marginBottom: 22,
    overflow: 'hidden',
  },
  googleBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  googleBtnText: {
    fontSize: 15.5,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
  },
  googleBtnArrow: {
    width: 58,
    height: '100%',
    backgroundColor: defaultTheme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 14,
  },
  disabledContainer: {
    opacity: 0.6,
  },
  featuresRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  featureItem: {
    flex: 1,
    alignItems: 'center',
  },
  featureIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: defaultTheme.colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: defaultTheme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  featureDivider: {
    width: 1,
    height: 44,
    backgroundColor: defaultTheme.colors.border,
  },
  privacyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: defaultTheme.colors.primaryLight,
    borderRadius: 18,
    padding: 16,
  },
  privacyIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: defaultTheme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  privacyTextCol: {
    flex: 1,
  },
  privacyTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: defaultTheme.colors.primaryDark,
    marginBottom: 4,
  },
  privacySubtitle: {
    fontSize: 12.5,
    color: defaultTheme.colors.textSecondary,
    lineHeight: 17,
  },
});
