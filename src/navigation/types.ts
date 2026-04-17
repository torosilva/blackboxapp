export type RootStackParamList = {
    Login: undefined;
    SignUp: undefined;
    Onboarding: undefined;
    Main: undefined;
    Dashboard: undefined;
    Home: undefined;
    MainTabs: undefined;
    NewEntry: { transcription?: string };
    EntryDetail: { entryId: string };
    WeeklyReport: { reportEndDate?: string };
    Settings: { initialViewMode?: 'hub' | 'pending' | 'completed' | 'biases' };
    ChatHub: undefined;
    Chat: {
        threadId: string;
        category: string;
        title: string;
        isTherapyMode?: boolean;
        initialMessage?: string;
        entryContext?: {
            originalText: string;
            summary: string;
            moodLabel: string;
            sentimentScore: number;
            strategicInsight: string;
            wellnessRecommendation: string;
            actionItems: any[];
        };
    };
    FeedbackHistory: undefined;
    QuickCapture: undefined;
    Terms: { isMandatory?: boolean };
    Privacy: { isMandatory?: boolean };
    Paywall: undefined;
    InvitationCode: undefined;
};
