import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Settings, LogOut, User } from 'lucide-react-native';
import { defaultTheme } from '../../theme/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SettingsScreen = ({ setIsAuthenticated }: any) => {
  const handleLogout = async () => {
    try {
      await AsyncStorage.setItem('isAuthenticated', 'false');
      setIsAuthenticated(false);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBg} />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Settings</Text>
          </View>

          <View style={styles.section}>
            <TouchableOpacity style={styles.menuItem}>
              <View style={styles.menuIconBox}>
                <User size={20} color={defaultTheme.colors.primaryDark} />
              </View>
              <Text style={styles.menuText}>Profile Details</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem}>
              <View style={[styles.menuIconBox, { backgroundColor: defaultTheme.colors.secondaryLight }]}>
                <Settings size={20} color={defaultTheme.colors.secondary} />
              </View>
              <Text style={styles.menuText}>Preferences</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <View style={[styles.menuIconBox, { backgroundColor: '#FEE2E2' }]}>
                <LogOut size={20} color={defaultTheme.colors.error} />
              </View>
              <Text style={[styles.menuText, { color: defaultTheme.colors.error }]}>Log Out</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: defaultTheme.colors.background,
  },
  topBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 180,
    backgroundColor: defaultTheme.colors.headerBackground,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: defaultTheme.spacing.lg,
    paddingTop: defaultTheme.spacing.lg,
  },
  header: {
    marginBottom: defaultTheme.spacing.xl,
    marginTop: defaultTheme.spacing.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  section: {
    backgroundColor: defaultTheme.colors.card,
    borderRadius: defaultTheme.borderRadius.lg,
    padding: defaultTheme.spacing.md,
    marginTop: defaultTheme.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: defaultTheme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: defaultTheme.colors.border,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: defaultTheme.spacing.md,
  },
  menuIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: defaultTheme.colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: defaultTheme.spacing.md,
  },
  menuText: {
    fontSize: 16,
    fontWeight: '600',
    color: defaultTheme.colors.textPrimary,
  },
});

