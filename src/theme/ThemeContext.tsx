import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeMode, ThemeTokens, tokensByMode } from './tokens';

const STORAGE_KEY = '@bbm:themeMode';

type ThemeContextValue = {
    mode: ThemeMode;
    tokens: ThemeTokens;
    setMode: (m: ThemeMode) => void;
    toggle: () => void;
    isHydrated: boolean;
};

const ThemeContext = createContext<ThemeContextValue>({
    mode: 'dark',
    tokens: tokensByMode.dark,
    setMode: () => {},
    toggle: () => {},
    isHydrated: false,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [mode, setModeState] = useState<ThemeMode>('dark');
    const [isHydrated, setIsHydrated] = useState(false);

    // Cargar preferencia persistida una sola vez al mount. Default = dark.
    useEffect(() => {
        AsyncStorage.getItem(STORAGE_KEY)
            .then((stored) => {
                if (stored === 'light' || stored === 'dark') setModeState(stored);
            })
            .catch(() => {})
            .finally(() => setIsHydrated(true));
    }, []);

    const setMode = (m: ThemeMode) => {
        setModeState(m);
        AsyncStorage.setItem(STORAGE_KEY, m).catch(() => {});
    };

    const toggle = () => setMode(mode === 'dark' ? 'light' : 'dark');

    const value = useMemo<ThemeContextValue>(
        () => ({ mode, tokens: tokensByMode[mode], setMode, toggle, isHydrated }),
        [mode, isHydrated]
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => useContext(ThemeContext);
