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
        if (!Device.isDevice) {
            console.log('Must use physical device for Push Notifications');
            return null;
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            console.log('Failed to get push token for push notification!');
            return null;
        }

        if (Platform.OS === 'android') {
            Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
        }

        return true;
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
     * Cancel today's notification if it hasn't fired yet
     * (Simplification: just cancel all and reschedule for tomorrow if needed, 
     * but usually local reminders are fine to repeat even if entry exists)
     */
    async cancelAllNotifications() {
        await Notifications.cancelAllScheduledNotificationsAsync();
        console.log('Notification Service: All notifications cancelled');
    }
};
