import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Edit3, LayoutDashboard, BarChart2, MessageCircle, ShieldAlert } from 'lucide-react-native';

import CaptureScreen from '../screens/CaptureScreen';
import DashboardScreen from '../screens/DashboardScreen';
import WeeklyReportScreen from '../screens/WeeklyReportScreen';
import ChatHubScreen from '../screens/ChatHubScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();

const ACTIVE = '#818cf8';
const INACTIVE = '#334155';
const BG = '#0a0f1e';
const BORDER = 'rgba(255,255,255,0.06)';

export default function MainTabNavigator() {
    return (
        <Tab.Navigator
            initialRouteName="Captura"
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: BG,
                    borderTopColor: BORDER,
                    borderTopWidth: 1,
                    height: 72,
                    paddingBottom: 12,
                    paddingTop: 8,
                },
                tabBarActiveTintColor: ACTIVE,
                tabBarInactiveTintColor: INACTIVE,
                tabBarLabelStyle: {
                    fontSize: 10,
                    fontWeight: '600',
                    letterSpacing: 0.5,
                    marginTop: 2,
                },
            }}
        >
            <Tab.Screen
                name="Captura"
                component={CaptureScreen}
                options={{
                    tabBarLabel: 'Captura',
                    tabBarIcon: ({ color }) => <Edit3 size={20} color={color} strokeWidth={2} />,
                }}
            />
            <Tab.Screen
                name="Dashboard"
                component={DashboardScreen}
                options={{
                    tabBarLabel: 'Dashboard',
                    tabBarIcon: ({ color }) => <LayoutDashboard size={20} color={color} strokeWidth={2} />,
                }}
            />
            <Tab.Screen
                name="Reporte"
                component={WeeklyReportScreen as any}
                options={{
                    tabBarLabel: 'Reporte',
                    tabBarIcon: ({ color }) => <BarChart2 size={20} color={color} strokeWidth={2} />,
                }}
            />
            <Tab.Screen
                name="Chats"
                component={ChatHubScreen}
                options={{
                    tabBarLabel: 'Chats',
                    tabBarIcon: ({ color }) => <MessageCircle size={20} color={color} strokeWidth={2} />,
                }}
            />
            <Tab.Screen
                name="Intervencion"
                component={SettingsScreen as any}
                initialParams={{ initialViewMode: 'biases' }}
                options={{
                    tabBarLabel: 'Intervención',
                    tabBarIcon: ({ color }) => <ShieldAlert size={20} color={color} strokeWidth={2} />,
                }}
            />
        </Tab.Navigator>
    );
}
