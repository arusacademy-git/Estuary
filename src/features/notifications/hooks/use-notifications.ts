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

  const refresh = useCallback(() => {
    if (!recipientId) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }

    setNotifications(
      getNotificationsForRecipient(
        recipientId,
      ),
    );

    setIsLoading(false);
  }, [recipientId]);

  useEffect(() => {
    const initialRefreshId = window.setTimeout(
      refresh,
      0,
    );
    const unsubscribe =
      subscribeToNotifications(refresh);

    return () => {
      window.clearTimeout(initialRefreshId);
      unsubscribe();
    };
  }, [refresh]);

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
    },
    [recipientId],
  );

  const markAllAsRead = useCallback(() => {
    if (!recipientId) {
      return;
    }

    markAllNotificationsAsRead(recipientId);
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
