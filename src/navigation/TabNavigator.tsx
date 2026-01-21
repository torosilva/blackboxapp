import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import HomeScreen from '../screens/HomeScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { Home, Settings } from 'lucide-react-native';
import { TabProvider, useTabs } from '../context/TabContext';

const TabNavigatorContent = () => {
    const { activeTab, setActiveTab } = useTabs();

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                {activeTab === 'Home' ? <HomeScreen /> : <SettingsScreen />}
            </View>

            {/* Custom Bottom Tab Bar */}
            <View style={styles.tabBar}>
                <TouchableOpacity
                    onPress={() => setActiveTab('Home')}
                    style={[styles.tabItem, { opacity: activeTab === 'Home' ? 1 : 0.5 }]}
                >
                    <Home color={activeTab === 'Home' ? '#818cf8' : '#64748b'} size={24} />
                    <Text style={[styles.tabLabel, { color: activeTab === 'Home' ? '#818cf8' : '#64748b' }]}>Inicio</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setActiveTab('Settings')}
                    style={[styles.tabItem, { opacity: activeTab === 'Settings' ? 1 : 0.5 }]}
                >
                    <Settings color={activeTab === 'Settings' ? '#818cf8' : '#64748b'} size={24} />
                    <Text style={[styles.tabLabel, { color: activeTab === 'Settings' ? '#818cf8' : '#64748b' }]}>Ajustes</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const TabNavigator = () => {
    return <TabNavigatorContent />;
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#020617',
    },
    content: {
        flex: 1,
    },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: '#0f172a',
        borderTopWidth: 1,
        borderTopColor: '#1e293b',
        height: 70,
        paddingBottom: 20,
        paddingTop: 10,
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    tabItem: {
        alignItems: 'center',
    },
    tabLabel: {
        fontSize: 10,
        marginTop: 4,
        fontWeight: '500',
    },
});

export default TabNavigator;
