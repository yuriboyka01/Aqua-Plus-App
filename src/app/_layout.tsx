import { Tabs } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, Home, Settings, Users, Wrench } from 'lucide-react-native';

import { Colors, Radii } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

interface TabIconProps {
  name: 'home' | 'customers' | 'services' | 'reminders' | 'settings';
  focused: boolean;
  color: any;
}

function TabIcon({ name, focused, color }: TabIconProps) {
  const iconSize = 20;
  const strokeWidth = focused ? 2.5 : 1.8;

  const renderIcon = () => {
    switch (name) {
      case 'home':
        return <Home size={iconSize} color={color} strokeWidth={strokeWidth} />;
      case 'customers':
        return <Users size={iconSize} color={color} strokeWidth={strokeWidth} />;
      case 'services':
        return <Wrench size={iconSize} color={color} strokeWidth={strokeWidth} />;
      case 'reminders':
        return <Bell size={iconSize} color={color} strokeWidth={strokeWidth} />;
      case 'settings':
        return <Settings size={iconSize} color={color} strokeWidth={strokeWidth} />;
    }
  };

  return (
    <View style={styles.iconContainer}>
      {focused && (
        <View style={styles.activePill} />
      )}
      {renderIcon()}
    </View>
  );
}

export default function RootLayout() {
  const colors = Colors.light;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  const tabHeight = 64 + (Platform.OS === 'android' ? Math.max(insets.bottom, 8) : insets.bottom);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: tabHeight,
          paddingBottom: Platform.OS === 'android' ? Math.max(insets.bottom, 8) : insets.bottom,
          paddingTop: 8,
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.05,
          shadowRadius: 10,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="home" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: 'Customers',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="customers" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: 'Services',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="services" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="reminders"
        options={{
          title: 'Reminders',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="reminders" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="settings" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 38,
    height: 30,
    position: 'relative',
  },
  activePill: {
    position: 'absolute',
    width: 32,
    height: 30,
    backgroundColor: 'rgba(8, 145, 178, 0.12)',
    borderRadius: Radii.full,
  },
});
