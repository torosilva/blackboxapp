import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, LogBox } from 'react-native';

// Expo Go (SDK 53+) removed remote push on Android and emits a red LogBox
// error on import/use. Our notifications are LOCAL and unaffected — silence
// only this known message so it stops alarming the user.
LogBox.ignoreLogs([
    'expo-notifications: Android Push notifications',
    'Android Push notifications (remote notifications)',
    '`expo-notifications` functionality is not fully supported in Expo Go',
]);

// Configure how notifications are handled when the app is foregrounded
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export const NotificationService = {
    /**
     * Request permissions and register for push notifications
     */
    async registerForPushNotificationsAsync() {
        try {
            if (!Device.isDevice) {
                console.log('Must use physical device for Push Notifications');
                return null;
            }

            // In Expo Go (SDK 54+), remote push notifications are not supported
            // and can trigger errors just by asking for permissions in some cases.
            // We'll proceed but carefully.
            
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                console.log('Failed to get notifications permission!');
                return null;
            }

            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('default', {
                    name: 'default',
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#FF231F7C',
                });
            }

            return true;
        } catch (error) {
            console.warn('NOTIFICATION_SERVICE: Error in registration (likely Expo Go limitation):', error);
            return null;
        }
    },

    /**
     * Schedule a daily reminder for 9:00 PM
     */
    async scheduleDailyReminder() {
        const title = "Momento de reflexión 🌙";
        const body = "Ingresa tus pensamientos y que acciones realizaste hoy. Recuerda escribir porque estas agradecidx. \n\nRecuerda que esta practica puede mejorar mucho tu salud mental! puedes grabar solo te lleva 1 min!";

        // Check if it's already scheduled to avoid duplicates
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        const isAlreadyScheduled = scheduled.some(n => n.content.title === title);

        if (isAlreadyScheduled) {
            console.log('Notification Service: Daily reminder already scheduled');
            return;
        }

        await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                sound: true,
                priority: Notifications.AndroidNotificationPriority.HIGH,
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DAILY,
                hour: 21,
                minute: 0,
            },
        });

        console.log('Notification Service: Daily 9PM reminder scheduled');
    },

    /**
     * Schedule an aggressive follow-up for a high-priority task (72h later)
     * Compatible with Expo Go (Local Notification)
     */
    async scheduleStrategicFollowup(taskTitle: string) {
        try {
            const title = "DIAGNÓSTICO DE PROCRASTINACIÓN";
            const body = `Llevas 72 horas con '${taskTitle}' en espera. Estás poniendo en riesgo la ejecución estratégica. ¿Qué te detiene?`;

            await Notifications.scheduleNotificationAsync({
                content: {
                    title,
                    body,
                    sound: true,
                    priority: Notifications.AndroidNotificationPriority.HIGH,
                    data: { type: 'STRATEGIC_FOLLOWUP' }
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                    seconds: 3 * 24 * 60 * 60, // 72 hours
                },
            });

            console.log(`Notification Service: Aggressive follow-up scheduled for: ${taskTitle}`);
        } catch (error) {
            console.warn('NOTIFICATION_SERVICE: Failed to schedule local follow-up', error);
        }
    },

    /**
     * Cancel all notifications
     */
    async cancelAllNotifications() {
        await Notifications.cancelAllScheduledNotificationsAsync();
        console.log('Notification Service: All notifications cancelled');
    },

    /**
     * Schedule all engagement notifications (9AM + 9PM).
     * Safe to call multiple times — checks for duplicates first.
     */
    async scheduleEngagementNotifications() {
        try {
            const scheduled = await Notifications.getAllScheduledNotificationsAsync();
            const titles = scheduled.map(n => n.content.title);

            // 9:00 AM — Morning kick
            const morningTitle = '⚡ BLACKBOX te desafía';
            if (!titles.includes(morningTitle)) {
                await Notifications.scheduleNotificationAsync({
                    content: {
                        title: morningTitle,
                        body: '¿Qué está bloqueando tu progreso hoy? 30 segundos. Eso es todo.',
                        sound: true,
                        priority: Notifications.AndroidNotificationPriority.HIGH,
                        data: { type: 'MORNING_CHALLENGE' },
                    },
                    trigger: {
                        type: Notifications.SchedulableTriggerInputTypes.DAILY,
                        hour: 9,
                        minute: 0,
                    },
                });
                console.log('Notification Service: 9AM challenge notification scheduled');
            }

            // The 9:00 PM reminder is now owned by scheduleSmartDailyReminder
            // (personalized with streak + top loop), called from Home.
        } catch (error) {
            console.warn('NOTIFICATION_SERVICE: Failed to schedule engagement notifications', error);
        }
    },

    /**
     * Personalized 9PM reminder: references the user's streak and oldest
     * open HIGH loop. Re-scheduled on app open with fresh state, replacing
     * any prior evening reminder so there's never a duplicate 9PM.
     */
    async scheduleSmartDailyReminder(opts: { streak: number; hasEntryToday: boolean; topLoopTitle?: string | null }) {
        try {
            const SMART_TITLE = 'BLACKBOX 🌙';
            const scheduled = await Notifications.getAllScheduledNotificationsAsync();
            for (const n of scheduled) {
                const t = n.content.title ?? '';
                if (t === SMART_TITLE || t === 'Momento de reflexión 🌙') {
                    await Notifications.cancelScheduledNotificationAsync(n.identifier);
                }
            }

            let body: string;
            if (opts.topLoopTitle) {
                body = `Tienes "${opts.topLoopTitle}" abierto. ¿Lo cierras hoy o lo registras como avance? 1 min.`;
            } else if (opts.streak >= 2) {
                body = opts.hasEntryToday
                    ? `Racha de ${opts.streak} días 🔥. Mañana sigues.`
                    : `Llevas ${opts.streak} días seguidos 🔥 — no rompas la racha. 1 min basta.`;
            } else {
                body = '¿Qué movió o bloqueó tu día? 1 minuto y queda registrado.';
            }

            await Notifications.scheduleNotificationAsync({
                content: {
                    title: SMART_TITLE,
                    body,
                    sound: true,
                    priority: Notifications.AndroidNotificationPriority.HIGH,
                    data: { type: 'SMART_DAILY' },
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DAILY,
                    hour: 21,
                    minute: 0,
                },
            });
            console.log('Notification Service: smart 9PM reminder scheduled');
        } catch (error) {
            console.warn('NOTIFICATION_SERVICE: scheduleSmartDailyReminder failed', error);
        }
    },

    /**
     * Weekly nudge (Sunday 6PM) that deep-links to the weekly report.
     */
    async scheduleWeeklyReport() {
        try {
            const WEEKLY_TITLE = '📊 Tu reporte semanal está listo';
            const scheduled = await Notifications.getAllScheduledNotificationsAsync();
            if (scheduled.some(n => n.content.title === WEEKLY_TITLE)) return;

            await Notifications.scheduleNotificationAsync({
                content: {
                    title: WEEKLY_TITLE,
                    body: 'Cómo se movió tu semana: patrones, victorias y la directiva para la próxima.',
                    sound: true,
                    priority: Notifications.AndroidNotificationPriority.HIGH,
                    data: { type: 'WEEKLY_REPORT' },
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
                    weekday: 1, // 1 = Sunday
                    hour: 18,
                    minute: 0,
                },
            });
            console.log('Notification Service: weekly report notification scheduled');
        } catch (error) {
            console.warn('NOTIFICATION_SERVICE: scheduleWeeklyReport failed', error);
        }
    },
};
