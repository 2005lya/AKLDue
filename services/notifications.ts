import type { Due } from '@/contexts/dues-context';
import {
    getNextDueDate,
    parseDate,
} from '@/utils/due-dates';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export async function requestNotificationPermission():
    Promise<boolean> {
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(
            'due-reminders',
            {
                name: 'Due reminders',
                importance:
                    Notifications.AndroidImportance.DEFAULT,
            }
        );
    }

    const current =
        await Notifications.getPermissionsAsync();

    if (current.status === 'granted') {
        return true;
    }

    const requested =
        await Notifications.requestPermissionsAsync();

    return requested.status === 'granted';
}

export async function sendTestNotification() {
    const allowed = await requestNotificationPermission();

    if (!allowed) {
        throw new Error('Notification permission was not granted.');
    }

    await Notifications.scheduleNotificationAsync({
        content: {
            title: 'AKLDue',
            body: 'Your due reminders are ready.',
        },
        trigger: null,
    });
}

export async function syncDueNotifications(
  dues: Due[]
): Promise<void> {
  const enabled = await getRemindersEnabled();

  if (!enabled) {
    await Notifications
      .cancelAllScheduledNotificationsAsync();

    return;
  }

  const allowed = await requestNotificationPermission();

  if (!allowed) {
    return;
  }

  const leadDays = await getReminderLeadDays();

  // 后续代码保持不变

    // 每次 Due 变化时重新建立计划，避免旧日期残留。
    await Notifications.cancelAllScheduledNotificationsAsync();

    const now = new Date();

    const reminders = dues
        .map((due) => {
            const nextDueDate = getNextDueDate(due);

            if (nextDueDate === null) {
                return null;
            }

            const dueDate = parseDate(nextDueDate);

            if (dueDate === null) {
                return null;
            }

            const reminderDate = new Date(dueDate);

            reminderDate.setDate(
                reminderDate.getDate() - leadDays
            );
            reminderDate.setHours(9, 0, 0, 0);

            if (reminderDate <= now) {
                return null;
            }

            return {
                due,
                nextDueDate,
                reminderDate,
            };
        })
        .filter(
            (
                reminder
            ): reminder is NonNullable<typeof reminder> =>
                reminder !== null
        )
        .sort(
            (first, second) =>
                first.reminderDate.getTime() -
                second.reminderDate.getTime()
        )
        .slice(0, 60);

    for (const reminder of reminders) {
        await Notifications.scheduleNotificationAsync({
            content: {
                title: reminder.due.title,
                body:
                    `Due in ${leadDays} ` +
                    `${leadDays === 1 ? 'day' : 'days'}: ` +
                    reminder.nextDueDate,
                data: {
                    dueId: reminder.due.id,
                },
            },
            trigger: {
                type:
                    Notifications.SchedulableTriggerInputTypes.DATE,
                date: reminder.reminderDate,
                channelId: 'due-reminders',
            },
        });
    }
}

export type ReminderLeadDays = 1 | 3 | 7;

const REMINDER_LEAD_DAYS_KEY =
    'akldue.reminderLeadDays';

export async function getReminderLeadDays():
    Promise<ReminderLeadDays> {
    const stored = await SecureStore.getItemAsync(
        REMINDER_LEAD_DAYS_KEY
    );

    if (stored === '3') {
        return 3;
    }

    if (stored === '7') {
        return 7;
    }

    return 1;
}

export async function setReminderLeadDays(
    days: ReminderLeadDays
): Promise<void> {
    await SecureStore.setItemAsync(
        REMINDER_LEAD_DAYS_KEY,
        String(days)
    );
}

const REMINDERS_ENABLED_KEY =
  'akldue.remindersEnabled';

export async function getRemindersEnabled():
  Promise<boolean> {
  const stored = await SecureStore.getItemAsync(
    REMINDERS_ENABLED_KEY
  );

  // 新用户默认开启。
  return stored !== 'false';
}

export async function setRemindersEnabled(
  enabled: boolean
): Promise<void> {
  await SecureStore.setItemAsync(
    REMINDERS_ENABLED_KEY,
    String(enabled)
  );
}