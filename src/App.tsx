import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationDefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  MD3DarkTheme,
  MD3LightTheme,
  Text,
  adaptNavigationTheme,
} from 'react-native-paper';

import type { Store } from './domain/store';
import { InsightsScreen } from './screens/Insights';
import { SettingsScreen } from './screens/Settings';
import { TodayScreen } from './screens/Today';
import { openStore } from './storage/openStore';
import { ThemeProvider, useTheme } from './ThemeContext';
import { TrackerProvider } from './TrackerContext';
import type { Theme } from './theme';

/**
 * Paper's MD3 palettes adapted to react-navigation's Theme shape, so the
 * navigator's chrome matches the Material palette everything else uses.
 */
const { LightTheme: NavLightTheme, DarkTheme: NavDarkTheme } = adaptNavigationTheme({
  reactNavigationLight: NavigationDefaultTheme,
  reactNavigationDark: NavigationDarkTheme,
  materialLight: MD3LightTheme,
  materialDark: MD3DarkTheme,
});

export type TabName = 'Today' | 'Insights' | 'Settings';

const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<TabName, keyof typeof MaterialCommunityIcons.glyphMap> = {
  Today: 'calendar-check-outline',
  Insights: 'chart-line',
  Settings: 'cog-outline',
};

/** Screens render with headerShown: false, so nothing else pads the status bar. */
function withTopInset<P extends object>(Screen: React.ComponentType<P>) {
  return function ScreenWithTopInset(props: P) {
    const { theme } = useTheme();
    return (
      <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
        <Screen {...props} />
      </SafeAreaView>
    );
  };
}

const TodayTab = withTopInset(TodayScreen);
const InsightsTab = withTopInset(InsightsScreen);
const SettingsTab = withTopInset(SettingsScreen);

export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}

/** Split from App so it can call useTheme() - the provider has to be an ancestor. */
function AppInner() {
  const { theme } = useTheme();
  const [store, setStore] = useState<Store | null>(null);
  const [failure, setFailure] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    openStore().then(
      (opened) => {
        if (cancelled) {
          // .catch, not void: an unhandled rejection here would be a crash on a fast unmount.
          opened.close().catch(() => {});
          return;
        }
        setStore(opened);
      },
      (err: unknown) => {
        if (!cancelled) setFailure(err as Error);
      },
    );
    return () => { cancelled = true; };
  }, []);

  // Injected once so it is a stable reference.
  const now = useMemo(() => () => new Date(), []);
  const statusBarStyle = theme.dark ? 'light' : 'dark';

  if (failure !== null) {
    return (
      <>
        <StatusBar style={statusBarStyle} />
        <ErrorScreen error={failure} theme={theme} />
      </>
    );
  }
  if (store === null) {
    return (
      <>
        <StatusBar style={statusBarStyle} />
        <View style={[styles.centre, { backgroundColor: theme.colors.background }]}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style={statusBarStyle} />
      <TrackerProvider store={store} now={now}>
        <NavigationContainer theme={theme.dark ? NavDarkTheme : NavLightTheme}>
          <Tabs />
        </NavigationContainer>
      </TrackerProvider>
    </SafeAreaProvider>
  );
}

function Tabs() {
  const { theme } = useTheme();
  return (
    <Tab.Navigator
      // Bottom placement keeps the tabs thumb-reachable on a phone, and unobtrusive in a browser.
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.onSecondaryContainer,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarStyle: { backgroundColor: theme.colors.elevation.level2, borderTopWidth: 0 },
        tabBarLabelStyle: theme.fonts.labelMedium,
        // The tab item reserves only 24x24 for its icon, so the pill needs a bigger reserved box.
        tabBarIconStyle: styles.tabIconSlot,
        tabBarIcon: ({ focused, color, size }) => (
          <View style={[styles.tabIndicator, focused && { backgroundColor: theme.colors.secondaryContainer }]}>
            <MaterialCommunityIcons name={TAB_ICONS[route.name as TabName]} color={color} size={size} />
          </View>
        ),
        tabBarHideOnKeyboard: true,
      })}
    >
      <Tab.Screen name="Today" component={TodayTab} options={{ tabBarButtonTestID: 'tab-Today' }} />
      <Tab.Screen name="Insights" component={InsightsTab} options={{ tabBarButtonTestID: 'tab-Insights' }} />
      <Tab.Screen name="Settings" component={SettingsTab} options={{ tabBarButtonTestID: 'tab-Settings' }} />
    </Tab.Navigator>
  );
}

function ErrorScreen({ error, theme }: { error: Error; theme: Theme }) {
  return (
    <View style={[styles.centre, { backgroundColor: theme.colors.background }]}>
      <Text variant="titleLarge" style={styles.errorTitle}>EqDaily couldn't open its database</Text>
      <Text variant="bodyMedium" style={styles.errorBody}>{error.message}</Text>
      <Text variant="bodyMedium" style={[styles.errorBody, { color: theme.colors.onSurfaceVariant }]}>
        Your answers are still on this device. Restarting the app is usually enough.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorTitle: { marginBottom: 12, textAlign: 'center' },
  errorBody: { textAlign: 'center', marginBottom: 8 },
  tabIconSlot: { width: 64, height: 32 },
  tabIndicator: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
});
