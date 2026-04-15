import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { defaultTheme } from '../theme/theme';
import { User, IndianRupee, CheckCircle2, Target, Plus, Home, BarChart2, Settings } from 'lucide-react-native';

export const HomeScreen = ({ setIsAuthenticated }: any) => {
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userStr = await AsyncStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          setUserName(user.name || 'User');
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchUser();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Good evening</Text>
              <Text style={styles.dateText}>Wednesday, 15 April</Text>
            </View>
            <TouchableOpacity style={styles.profileIcon} onPress={() => setIsAuthenticated(false)}>
              <User size={24} color={defaultTheme.colors.primaryDark} />
            </TouchableOpacity>
          </View>

          {/* Cards Row */}
          <View style={styles.cardsRow}>
            <View style={styles.card}>
              <View style={styles.iconCircle}>
                <IndianRupee size={16} color={defaultTheme.colors.primaryDark} />
              </View>
              <Text style={styles.cardValue}>₹0</Text>
              <Text style={styles.cardLabel}>Today's Spend</Text>
            </View>
            <View style={styles.card}>
              <View style={[styles.iconCircle, { backgroundColor: defaultTheme.colors.successBackground }]}>
                <CheckCircle2 size={16} color={defaultTheme.colors.success} />
              </View>
              <Text style={styles.cardValue}>0 / 0</Text>
              <Text style={styles.cardLabel}>Logged</Text>
            </View>
          </View>

          {/* Empty State */}
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBox}>
              <Target size={40} color="#9CA3AF" />
            </View>
            <Text style={styles.emptyTitle}>No trackers yet</Text>
            <Text style={styles.emptyDesc}>
              Create your first tracker — like daily milk, newspaper, or groceries — to start logging.
            </Text>
            <TouchableOpacity style={styles.createBtn}>
              <Plus size={20} color="#FFFFFF" strokeWidth={3} style={{ marginRight: 8 }} />
              <Text style={styles.createBtnText}>Create Tracker</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Bottom Navigation Mock */}
        <View style={styles.bottomNav}>
          <TouchableOpacity style={styles.navItem}>
            <Home size={24} color={defaultTheme.colors.primaryDark} />
            <Text style={[styles.navText, styles.navTextActive]}>Home</Text>
            <View style={styles.activeDot} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem}>
            <Target size={24} color="#9CA3AF" />
            <Text style={styles.navText}>Trackers</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem}>
            <BarChart2 size={24} color="#9CA3AF" />
            <Text style={styles.navText}>Summary</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem}>
            <Settings size={24} color="#9CA3AF" />
            <Text style={styles.navText}>Settings</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: defaultTheme.colors.background,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: defaultTheme.spacing.lg,
    paddingTop: defaultTheme.spacing.lg,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: defaultTheme.spacing.xl,
    marginTop: defaultTheme.spacing.sm,
  },
  greeting: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 4,
    fontWeight: '500',
  },
  dateText: {
    fontSize: 24,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
  },
  profileIcon: {
    width: 48,
    height: 48,
    backgroundColor: defaultTheme.colors.primaryLight,
    borderRadius: defaultTheme.borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  card: {
    flex: 1,
    backgroundColor: defaultTheme.colors.card,
    borderRadius: defaultTheme.borderRadius.lg,
    padding: defaultTheme.spacing.lg,
    marginHorizontal: 4, // slight margin between cards
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  iconCircle: {
    width: 32,
    height: 32,
    backgroundColor: defaultTheme.colors.primaryLight,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: defaultTheme.spacing.md,
  },
  cardValue: {
    fontSize: 22,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
    marginBottom: 2,
  },
  cardLabel: {
    fontSize: 13,
    color: defaultTheme.colors.textSecondary,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: defaultTheme.spacing.md,
    marginTop: 20,
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: defaultTheme.spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
    marginBottom: defaultTheme.spacing.sm,
  },
  emptyDesc: {
    fontSize: 15,
    color: defaultTheme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: defaultTheme.spacing.xl,
  },
  createBtn: {
    flexDirection: 'row',
    backgroundColor: defaultTheme.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: defaultTheme.borderRadius.full,
    alignItems: 'center',
  },
  createBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: defaultTheme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: defaultTheme.colors.border,
    paddingBottom: 24, // spacing for newer iPhones home bar/area
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  navText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
    fontWeight: '500',
  },
  navTextActive: {
    color: defaultTheme.colors.primaryDark,
    fontWeight: '600',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: defaultTheme.colors.primaryDark,
    position: 'absolute',
    bottom: -10,
  },
});
