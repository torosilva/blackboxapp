export type RootStackParamList = {
    Login: undefined;
    SignUp: undefined;
    Onboarding: undefined;
    Home: undefined;
    MainTabs: undefined;
    NewEntry: { transcription?: string };
    EntryDetail: { entryId: string };
    WeeklyReport: { reportEndDate?: string };
    Settings: { initialViewMode?: 'hub' | 'pending' | 'completed' | 'biases' };
    Chat: undefined;
    Terms: { isMandatory?: boolean };
    Privacy: { isMandatory?: boolean };
};
