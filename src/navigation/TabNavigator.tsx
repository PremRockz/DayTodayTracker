import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Target, NotebookText, Settings as SettingsIcon } from 'lucide-react-native';
import { HomeScreen } from '../screens/home/HomeScreen';
import { TrackersScreen } from '../screens/trackers/TrackersScreen';
import { NotesScreen } from '../screens/notes/NotesScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { defaultTheme } from '../theme/theme';

const Tab = createBottomTabNavigator();

const TabIcon = ({ name, color, size }: { name: string; color: string; size: number }) => {
  let IconComponent;

  if (name === 'Home') {
    IconComponent = Home;
  } else if (name === 'Trackers') {
    IconComponent = Target;
  } else if (name === 'Notes') {
    IconComponent = NotebookText;
  } else if (name === 'Settings') {
    IconComponent = SettingsIcon;
  }

  if (!IconComponent) return null;
  return <IconComponent size={size} color={color} />;
};

export const TabNavigator = ({ setIsAuthenticated }: any) => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => <TabIcon name={route.name} color={color} size={size} />,
        tabBarActiveTintColor: defaultTheme.colors.primaryDark,
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: defaultTheme.colors.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Trackers" component={TrackersScreen} />
      <Tab.Screen name="Notes" component={NotesScreen} />
      <Tab.Screen name="Settings">
        {(props) => <SettingsScreen {...props} setIsAuthenticated={setIsAuthenticated} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

