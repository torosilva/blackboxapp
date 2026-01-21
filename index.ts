import 'react-native-gesture-handler';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

import "./src/styles/global.css";
import { registerRootComponent } from 'expo';
import React from 'react';
import RootNavigator from './src/navigation/RootNavigator';

/**
 * FINAL STABLE ENTRY: Including CSS and Navigator.
 */
function App() {
    console.log('FINAL_BOOT: System fully operational');
    return React.createElement(RootNavigator);
}

registerRootComponent(App);
