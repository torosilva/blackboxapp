import React, { createContext, useContext, useState, ReactNode } from 'react';

type TabRoute = 'Home' | 'Settings';

interface TabContextType {
    activeTab: TabRoute;
    setActiveTab: (tab: TabRoute) => void;
}

const TabContext = createContext<TabContextType | undefined>(undefined);

export const TabProvider = ({ children }: { children: ReactNode }) => {
    const [activeTab, setActiveTab] = useState<TabRoute>('Home');

    return (
        <TabContext.Provider value={{ activeTab, setActiveTab }}>
            {children}
        </TabContext.Provider>
    );
};

export const useTabs = () => {
    const context = useContext(TabContext);
    if (!context) {
        throw new Error('useTabs must be used within a TabProvider');
    }
    return context;
};
