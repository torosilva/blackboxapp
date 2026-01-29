import 'react-native-gesture-handler';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

import "./src/theme/global.css";
import { registerRootComponent } from 'expo';
import React from 'react';
import RootNavigator from './src/navigation/RootNavigator';

/**
 * FINAL STABLE ENTRY: Including CSS and Navigator.
 */
function App() {
    console.log('BOOT: App component rendering');
    return React.createElement(RootNavigator);
}

registerRootComponent(App);
