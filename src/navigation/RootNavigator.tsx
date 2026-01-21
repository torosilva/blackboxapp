import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { TabProvider } from '../context/TabContext';
import { ActivityIndicator, View, AppState, AppStateStatus } from 'react-native';
import LockScreen from '../components/LockScreen';

// Importa tus pantallas
import HomeScreen from '../screens/HomeScreen';
import SettingsScreen from '../screens/SettingsScreen';
import NewEntryScreen from '../screens/NewEntryScreen';
import EntryDetailScreen from '../screens/EntryDetailScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import WeeklyReportScreen from '../screens/WeeklyReportScreen';
import ChatScreen from '../screens/ChatScreen';
import TermsScreen from '../screens/TermsScreen';
import PrivacyScreen from '../screens/PrivacyScreen';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const Stack = createNativeStackNavigator();

// Un componente wrapper para manejar la lógica de sesión
function AppNavigator() {
    const { user, profile, isLoading } = useAuth();
    const [isLocked, setIsLocked] = React.useState(true);

    // Re-lock app when it goes to background
    const appState = React.useRef(AppState.currentState);

    React.useEffect(() => {
        const subscription = AppState.addEventListener('change', nextAppState => {
            if (
                appState.current.match(/active/) &&
                nextAppState.match(/inactive|background/)
            ) {
                // App moved to background, re-lock
                setIsLocked(true);
            }
            appState.current = nextAppState;
        });

        return () => {
            subscription.remove();
        };
    }, []);

    if (isLoading) {
        // Pantalla de carga (Splash) mientras revisa si hay usuario
        return (
            <View style={{ flex: 1, backgroundColor: '#0B1021', justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#818cf8" />
            </View>
        );
    }

    // Show Biometric Lock only if user is logged in and screen is locked
    if (user && isLocked) {
        return <LockScreen onUnlock={() => setIsLocked(false)} />;
    }

    // Force Terms acceptance
    if (user && !profile?.accepted_terms_at) {
        return (
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen
                    name="Terms"
                    component={TermsScreen}
                    initialParams={{ isMandatory: true }}
                />
            </Stack.Navigator>
        );
    }

    // Force Privacy acceptance
    if (user && !profile?.accepted_privacy_at) {
        return (
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen
                    name="Privacy"
                    component={PrivacyScreen}
                    initialParams={{ isMandatory: true }}
                />
            </Stack.Navigator>
        );
    }

    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            {user ? (
                // === RUTAS PRIVADAS (Si está logueado) ===
                <>
                    <Stack.Screen name="Home" component={HomeScreen} />
                    <Stack.Screen name="Settings" component={SettingsScreen} />
                    <Stack.Screen
                        name="NewEntry"
                        component={NewEntryScreen}
                        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
                    />
                    <Stack.Screen name="EntryDetail" component={EntryDetailScreen} />
                    <Stack.Screen name="WeeklyReport" component={WeeklyReportScreen} />
                    <Stack.Screen name="Chat" component={ChatScreen} />
                    <Stack.Screen name="Terms" component={TermsScreen} />
                    <Stack.Screen name="Privacy" component={PrivacyScreen} />
                    <Stack.Screen name="Onboarding" component={OnboardingScreen} />
                </>
            ) : (
                // === RUTAS PÚBLICAS (Si NO está logueado) ===
                <>
                    <Stack.Screen name="Login" component={LoginScreen} />
                    <Stack.Screen name="SignUp" component={SignUpScreen} />
                    <Stack.Screen name="Onboarding" component={OnboardingScreen} />
                </>
            )}
        </Stack.Navigator>
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
