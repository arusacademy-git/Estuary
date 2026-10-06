import type {
  CreateNotificationInput,
  NotificationRecord,
} from '@/domain/notifications/types';

import {
  isNotificationUnread,
} from '@/domain/notifications/types';

const NOTIFICATION_STORAGE_KEY =
  'estuary-beta-notifications';

const NOTIFICATION_CHANGE_EVENT =
  'estuary:notifications-changed';

function canUseLocalStorage() {
  return (
    typeof window !== 'undefined' &&
    typeof window.localStorage !== 'undefined'
  );
}

function createNotificationId() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }

  return `notification-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
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