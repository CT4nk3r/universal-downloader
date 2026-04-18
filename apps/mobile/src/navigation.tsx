/**
 * Bottom-tab root navigator.
 *
 * J1.10 owns the actual screen implementations — replace the placeholder
 * imports below with the real ones, but keep the route names stable
 * (`Home` | `Queue` | `History` | `Settings`) so deep links survive.
 */
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { AppHeader } from './components/header';
import { HomeScreen } from './screens/home';
import { QueueScreen } from './screens/queue';
import { HistoryScreen } from './screens/history';
import { SettingsScreen } from './screens/settings';

export type RootTabParamList = {
  Home: undefined;
  Queue: undefined;
  History: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

export function RootTabs(): React.JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={{
        headerTitle: () => <AppHeader />,
        headerTitleAlign: 'center',
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Queue" component={QueueScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
