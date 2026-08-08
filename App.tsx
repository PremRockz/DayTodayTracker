import React, { useEffect, useState } from 'react';
import { StatusBar, useColorScheme, View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Screens
import { SignInScreen } from './src/screens/auth/SignInScreen';

// Navigation
import { TabNavigator } from './src/navigation/TabNavigator';
import { CreateTrackerScreen } from './src/screens/trackers/CreateTrackerScreen';
import { TrackerDetailsScreen } from './src/screens/trackers/TrackerDetailsScreen';
import { TrackerHistoryScreen } from './src/screens/trackers/TrackerHistoryScreen';
import { CycleDetailsScreen } from './src/screens/trackers/CycleDetailsScreen';
import { PendingActionsScreen } from './src/screens/home/PendingActionsScreen';
import { CreateNoteScreen } from './src/screens/notes/CreateNoteScreen';
import { NoteDetailScreen } from './src/screens/notes/NoteDetailScreen';

// Theme
import { defaultTheme } from './src/theme/theme';

const Stack = createNativeStackNavigator();

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Check initial auth state
    const checkAuth = async () => {
      try {
        const authStatus = await AsyncStorage.getItem('isAuthenticated');
        if (authStatus === 'true') {
          setIsAuthenticated(true);
        }
      } catch (e) {
        console.error('Failed to load auth status', e);
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={defaultTheme.colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={defaultTheme.colors.background}
      />
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {isAuthenticated ? (
            // App Stack (Authenticated)
            <>
              <Stack.Screen name="MainTabs">
                {(props) => <TabNavigator {...props} setIsAuthenticated={setIsAuthenticated} />}
              </Stack.Screen>
              <Stack.Screen name="CreateTracker" component={CreateTrackerScreen} />
              <Stack.Screen name="TrackerDetails" component={TrackerDetailsScreen} />
              <Stack.Screen name="TrackerHistory" component={TrackerHistoryScreen} />
              <Stack.Screen name="CycleDetails" component={CycleDetailsScreen} />
              <Stack.Screen name="PendingActions" component={PendingActionsScreen} />
              <Stack.Screen name="CreateNote" component={CreateNoteScreen} />
              <Stack.Screen name="NoteDetails" component={NoteDetailScreen} />
            </>
          ) : (
            // Auth Stack
            <>
              <Stack.Screen name="SignIn">
                {(props) => <SignInScreen {...props} setIsAuthenticated={setIsAuthenticated} />}
              </Stack.Screen>
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: defaultTheme.colors.background,
  },
});

export default App;
