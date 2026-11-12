import type {
  CreateNotificationInput,
  NotificationRecord,
} from '@/domain/notifications/types';

import {
  isNotificationUnread,
} from '@/domain/notifications/types';
import { createRuntimeId } from '@/lib/ids/runtime-id';

const NOTIFICATION_STORAGE_KEY =
  'estuary-beta-notifications';

const NOTIFICATION_CHANGE_EVENT =
  'estuary:notifications-changed';

async function sendNotificationChange(url: string, method: string, body: object) {
  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    console.error('The in-app notification could not sync across browsers.', error);
  }
}

export async function getSharedNotificationsForRecipient(recipientId: string): Promise<NotificationRecord[]> {
  const response = await fetch(`/api/v1/notifications?recipientId=${encodeURIComponent(recipientId)}`, {
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Notifications could not be loaded (HTTP ${response.status}).`);
  const result = await response.json() as { data?: NotificationRecord[] };
  return result.data ?? [];
}

function canUseLocalStorage() {
  return (
    typeof window !== 'undefined' &&
    typeof window.localStorage !== 'undefined'
  );
}

function createNotificationId() {
  return createRuntimeId();
}

function sortNewestFirst(
  notifications: NotificationRecord[],
) {
  return [...notifications].sort(
    (firstNotification, secondNotification) =>
      new Date(
        secondNotification.createdAt,
      ).getTime() -
      new Date(
        firstNotification.createdAt,
      ).getTime(),
  );
}

function notifyNotificationChange() {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(
      NOTIFICATION_CHANGE_EVENT,
    ),
  );
}

function saveNotifications(
  notifications: NotificationRecord[],
) {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.setItem(
    NOTIFICATION_STORAGE_KEY,
    JSON.stringify(notifications),
  );

  notifyNotificationChange();
}

export function getAllNotifications() {
  if (!canUseLocalStorage()) {
    return [] as NotificationRecord[];
  }

  const storedValue = window.localStorage.getItem(
    NOTIFICATION_STORAGE_KEY,
  );

  if (!storedValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(
      storedValue,
    ) as unknown;

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return sortNewestFirst(
      parsedValue as NotificationRecord[],
    );
  } catch {
    return [];
  }
}

export function getNotificationsForRecipient(
  recipientId: string,
) {
  return getAllNotifications().filter(
    (notification) =>
      notification.recipientId === recipientId,
  );
}

export function getUnreadNotificationsForRecipient(
  recipientId: string,
) {
  return getNotificationsForRecipient(
    recipientId,
  ).filter(isNotificationUnread);
}

export function getUnreadNotificationCount(
  recipientId: string,
) {
  return getUnreadNotificationsForRecipient(
    recipientId,
  ).length;
}

export function createLocalNotification(
  input: CreateNotificationInput,
) {
  const notifications = getAllNotifications();

  const createdNotification: NotificationRecord = {
    ...input,
    id: createNotificationId(),
    createdAt: new Date().toISOString(),
  };

  saveNotifications([
    createdNotification,
    ...notifications,
  ]);

  void sendNotificationChange('/api/v1/notifications', 'POST', createdNotification);

  return createdNotification;
}

export function markNotificationAsRead(
  notificationId: string,
  recipientId: string,
) {
  const notifications = getAllNotifications();

  let updatedNotification:
    | NotificationRecord
    | undefined;

  const updatedNotifications =
    notifications.map((notification) => {
      if (
        notification.id !== notificationId ||
        notification.recipientId !==
          recipientId
      ) {
        return notification;
      }

      if (notification.readAt) {
        updatedNotification = notification;
        return notification;
      }

      const nextNotification = {
        ...notification,
        readAt: new Date().toISOString(),
      };

      updatedNotification = nextNotification;

      return nextNotification;
    });

  saveNotifications(updatedNotifications);

  void sendNotificationChange(`/api/v1/notifications/${encodeURIComponent(notificationId)}`, 'PATCH', { recipientId });

  return updatedNotification;
}

export function markAllNotificationsAsRead(
  recipientId: string,
) {
  const readAt = new Date().toISOString();

  const notifications = getAllNotifications();

  const updatedNotifications =
    notifications.map((notification) => {
      if (
        notification.recipientId !==
          recipientId ||
        notification.readAt
      ) {
        return notification;
      }

      return {
        ...notification,
        readAt,
      };
    });

  saveNotifications(updatedNotifications);

  void sendNotificationChange('/api/v1/notifications', 'PATCH', { recipientId });
}

export function deleteNotification(
  notificationId: string,
  recipientId: string,
) {
  const notifications = getAllNotifications();

  const updatedNotifications =
    notifications.filter(
      (notification) =>
        !(
          notification.id === notificationId &&
          notification.recipientId ===
            recipientId
        ),
    );

  saveNotifications(updatedNotifications);

  void sendNotificationChange(`/api/v1/notifications/${encodeURIComponent(notificationId)}`, 'DELETE', { recipientId });
}

export function clearNotificationsForRecipient(
  recipientId: string,
) {
  const notifications = getAllNotifications();

  const remainingNotifications =
    notifications.filter(
      (notification) =>
        notification.recipientId !== recipientId,
    );

  saveNotifications(remainingNotifications);
}

export function clearAllDummyNotifications() {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.removeItem(
    NOTIFICATION_STORAGE_KEY,
  );

  notifyNotificationChange();
}

export function subscribeToNotifications(
  listener: () => void,
) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  function handleStorageChange(
    event: StorageEvent,
  ) {
    if (
      event.key === NOTIFICATION_STORAGE_KEY
    ) {
      listener();
    }
  }

  window.addEventListener(
    NOTIFICATION_CHANGE_EVENT,
    listener,
  );

  window.addEventListener(
    'storage',
    handleStorageChange,
  );

  return () => {
    window.removeEventListener(
      NOTIFICATION_CHANGE_EVENT,
      listener,
    );

    window.removeEventListener(
      'storage',
      handleStorageChange,
    );
  };
}
