import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

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
    }
};
