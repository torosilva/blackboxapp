export type RootStackParamList = {
    Login: undefined;
    SignUp: undefined;
    Onboarding: undefined;
    Dashboard: undefined;
    Home: undefined;
    MainTabs: undefined;
    NewEntry: { transcription?: string };
    EntryDetail: { entryId: string };
    WeeklyReport: { reportEndDate?: string };
    Settings: { initialViewMode?: 'hub' | 'pending' | 'completed' | 'biases' };
    ChatHub: undefined;
    Chat: { threadId: string; category: string; title: string };
    FeedbackHistory: undefined;
    QuickCapture: undefined;
    Terms: { isMandatory?: boolean };
    Privacy: { isMandatory?: boolean };
};
