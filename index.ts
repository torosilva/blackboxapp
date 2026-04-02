import 'react-native-gesture-handler';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

import "./global.css";
import { registerRootComponent } from 'expo';
import React from 'react';
import RootNavigator from './src/navigation/RootNavigator';
import { RevenueCatService } from './src/services/RevenueCatService';

/**
 * FINAL STABLE ENTRY: Including CSS and Navigator.
 */
function App() {
    console.log('BOOT: App component rendering');
    
    React.useEffect(() => {
        RevenueCatService.configure();
    }, []);

    return React.createElement(RootNavigator);
}

registerRootComponent(App);
