'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type {
  CreateNotificationInput,
  NotificationRecord,
} from '@/domain/notifications/types';

import {
  createLocalNotification,
  deleteNotification,
  getNotificationsForRecipient,
  getSharedNotificationsForRecipient,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  subscribeToNotifications,
} from '@/data/notifications/local-notification-store';

export function useNotifications(
  recipientId?: string,
) {
  const [
    notifications,
    setNotifications,
  ] = useState<NotificationRecord[]>([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const refresh = useCallback(async () => {
    if (!recipientId) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }

    const local = getNotificationsForRecipient(recipientId);
    try {
      const shared = await getSharedNotificationsForRecipient(recipientId);
      const merged = new Map(local.map((item) => [item.id, item]));
      for (const item of shared) merged.set(item.id, item);
      setNotifications([...merged.values()].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ));
    } catch (error) {
      console.error('Shared notifications could not be loaded.', error);
      setNotifications(local);
    } finally {
      setIsLoading(false);
    }
  }, [recipientId]);

  useEffect(() => {
    let cancelled = false;

    // Initial load runs inside a callback, not directly in the effect body
    Promise.resolve().then(() => {
      if (!cancelled) {
        setNotifications(recipientId ? getNotificationsForRecipient(recipientId) : []);
        setIsLoading(Boolean(recipientId));
        void refresh();
      }
    });

    // Later updates come from the store, which is also a callback
    const unsubscribe = subscribeToNotifications(() => { void refresh(); });
    const interval = window.setInterval(() => { void refresh(); }, 15_000);

    return () => {
      cancelled = true;
      unsubscribe();
      window.clearInterval(interval);
    };
  }, [recipientId, refresh]);

  const unreadCount = useMemo(() => {
    return notifications.filter(
      (notification) => !notification.readAt,
    ).length;
  }, [notifications]);

  const createNotification = useCallback(
    (input: CreateNotificationInput) => {
      return createLocalNotification(input);
    },
    [],
  );

  const markAsRead = useCallback(
    (notificationId: string) => {
      if (!recipientId) {
        return;
      }

      markNotificationAsRead(
        notificationId,
        recipientId,
      );
      setNotifications((items) => items.map((item) => item.id === notificationId
        ? { ...item, readAt: item.readAt ?? new Date().toISOString() }
        : item));
    },
    [recipientId],
  );

  const markAllAsRead = useCallback(() => {
    if (!recipientId) {
      return;
    }

    markAllNotificationsAsRead(recipientId);
    setNotifications((items) => items.map((item) => item.readAt
      ? item : { ...item, readAt: new Date().toISOString() }));
  }, [recipientId]);

  const removeNotification = useCallback(
    (notificationId: string) => {
      if (!recipientId) {
        return;
      }

      deleteNotification(
        notificationId,
        recipientId,
      );
      setNotifications((items) => items.filter((item) => item.id !== notificationId));
    },
    [recipientId],
  );

  return {
    notifications,
    unreadCount,
    isLoading,
    refresh,
    createNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
  };
}
