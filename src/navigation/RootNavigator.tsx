import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { TabProvider } from '../context/TabContext';
import { ActivityIndicator, View, AppState, AppStateStatus, StyleSheet } from 'react-native';
import LockScreen from '../components/LockScreen';
import { LockService } from '../services/LockService';

// Importa tus pantallas
import HomeScreen from '../screens/HomeScreen';
import SettingsScreen from '../screens/SettingsScreen';
import NewEntryScreen from '../screens/NewEntryScreen';
import EntryDetailScreen from '../screens/EntryDetailScreen';
import LoginScreen from '../auth/LoginScreen';
import SignUpScreen from '../auth/SignUpScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import WeeklyReportScreen from '../screens/WeeklyReportScreen';
import ChatScreen from '../screens/ChatScreen';
import TermsScreen from '../screens/TermsScreen';
import PrivacyScreen from '../screens/PrivacyScreen';
import DashboardScreen from '../screens/DashboardScreen';
import ChatHubScreen from '../screens/ChatHubScreen';
import MainTabNavigator from './MainTabNavigator';
import ForgotPasswordScreen from '../auth/ForgotPasswordScreen';
import FeedbackHistoryScreen from '../screens/FeedbackHistoryScreen';
import QuickCaptureScreen from '../screens/QuickCaptureScreen';
import PaywallScreen from '../screens/PaywallScreen';
import InvitationCodeScreen from '../screens/InvitationCodeScreen';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const Stack = createNativeStackNavigator();

// Un componente wrapper para manejar la lógica de sesión
function AppNavigator() {
    const { user, profile, isLoading, signOut } = useAuth();
    // Default to false for stability in Expo Go; can be re-enabled if needed
    const [isLocked, setIsLocked] = React.useState(false);

    // Re-lock app when it goes to background
    const appState = React.useRef(AppState.currentState);
    const backgroundTimestamp = React.useRef<number | null>(null);

    React.useEffect(() => {
        const subscription = AppState.addEventListener('change', nextAppState => {
            console.log(`[NAVIGATOR] AppState Change: ${appState.current} -> ${nextAppState}`);
            
            // 1. Handling Background Transition
            if (nextAppState === 'background') {
                backgroundTimestamp.current = Date.now();
                console.log('[NAVIGATOR] App moved to background at:', backgroundTimestamp.current);
            }

            // 2. Handling Return to Foreground
            if (appState.current.match(/background|inactive/) && nextAppState === 'active') {
                const now = Date.now();
                const diff = backgroundTimestamp.current ? (now - backgroundTimestamp.current) / 1000 : 0;
                
                console.log(`[NAVIGATOR] App returned to active. Time in background: ${diff.toFixed(1)}s`);

                // Only lock if we were away for > 15 seconds
                if (diff > 15) {
                    const isBypass = LockService.isBypassActive();
                    if (!isBypass) {
                        console.log('[NAVIGATOR] Exceeded grace period. LOCKING APP');
                        setIsLocked(true);
                    } else {
                        console.log('[NAVIGATOR] Skipping lock (Bypass Active)');
                    }
                } else {
                    console.log('[NAVIGATOR] Within grace period. Skipping lock.');
                }
                
                // Reset timestamp
                backgroundTimestamp.current = null;
            }
            appState.current = nextAppState;
        });

        return () => {
            subscription.remove();
        };
    }, []);

    if (isLoading) {
        console.log('NAVIGATOR: Still loading auth state...');
        return (
            <View style={{ flex: 1, backgroundColor: '#0B1021', justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#818cf8" />
            </View>
        );
    }
    console.log('NAVIGATOR: Auth Load Complete. User:', user?.id, 'Profile Loaded:', !!profile);

    const Nav = Stack.Navigator as any;

    const mainNavigator = (
        <Nav screenOptions={{ headerShown: false }}>
            {user ? (
                // === RUTAS PRIVADAS (Si está logueado) ===
                <React.Fragment>
                    {/* ── Main shell (tabs) — always first so it's the default route ── */}
                    <Stack.Screen name="Main" component={MainTabNavigator as any} />
                    {/* ── Detail screens pushed on top of tabs ── */}
                    <Stack.Screen name="Dashboard" component={DashboardScreen as any} />
                    <Stack.Screen name="QuickCapture" component={QuickCaptureScreen as any} />
                    <Stack.Screen name="Home" component={HomeScreen as any} />
                    <Stack.Screen name="Settings" component={SettingsScreen as any} />
                    <Stack.Screen
                        name="NewEntry"
                        component={NewEntryScreen as any}
                        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
                    />
                    <Stack.Screen name="EntryDetail" component={EntryDetailScreen as any} />
                    <Stack.Screen name="WeeklyReport" component={WeeklyReportScreen as any} />
                    <Stack.Screen name="ChatHub" component={ChatHubScreen as any} />
                    <Stack.Screen name="Chat" component={ChatScreen as any} />
                    <Stack.Screen name="FeedbackHistory" component={FeedbackHistoryScreen as any} />
                    <Stack.Screen name="Terms" component={TermsScreen as any} />
                    <Stack.Screen name="Privacy" component={PrivacyScreen as any} />
                    <Stack.Screen name="Onboarding" component={OnboardingScreen as any} />
                    <Stack.Screen name="Paywall" component={PaywallScreen as any} />
                    <Stack.Screen name="InvitationCode" component={InvitationCodeScreen as any} />
                </React.Fragment>
            ) : (
                // === RUTAS PÚBLICAS (Si NO está logueado) ===
                <React.Fragment>
                    <Stack.Screen name="Login" component={LoginScreen as any} />
                    <Stack.Screen name="SignUp" component={SignUpScreen as any} />
                    <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen as any} />
                    <Stack.Screen name="Onboarding" component={OnboardingScreen as any} />
                    <Stack.Screen name="Terms" component={TermsScreen as any} />
                    <Stack.Screen name="Privacy" component={PrivacyScreen as any} />
                </React.Fragment>
            )}
        </Nav>
    );

    // Conditional overlays (instead of conditional returns) to preserve state
    return (
        <View style={{ flex: 1 }}>
            {mainNavigator}

            {/* Mandatory Terms Overlay */}
            {user && !profile?.accepted_terms_at && (
                <View style={[StyleSheet.absoluteFill, { zIndex: 9000 }]}>
                    <TermsScreen isMandatory={true} />
                </View>
            )}

            {/* Mandatory Privacy Overlay */}
            {user && profile?.accepted_terms_at && !profile?.accepted_privacy_at && (
                <View style={[StyleSheet.absoluteFill, { zIndex: 9001 }]}>
                    <PrivacyScreen isMandatory={true} />
                </View>
            )}
            
            {/* Biometric Lock Overlay */}
            {user && isLocked && (
                <View style={[StyleSheet.absoluteFill, { zIndex: 9999 }]}>
                    <LockScreen 
                        onUnlock={() => setIsLocked(false)} 
                        onSignOut={() => {
                            setIsLocked(false);
                            signOut();
                        }}
                    />
                </View>
            )}
        </View>
    );
}

export default function RootNavigator() {
    console.log('ROOT_NAVIGATOR: Starting rendering...');
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <AuthProvider>
                    <NavigationContainer>
                        <AppNavigator />
                    </NavigationContainer>
                </AuthProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}
