import type {
  CreateNotificationInput,
  NotificationRecord,
} from "@/domain/notifications/types";

const STORAGE_KEY = "estuary-beta-notifications";
const CHANGE_EVENT = "estuary:notifications-changed";

async function sendNotificationChange(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body: object,
) {
  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    });
    if (!response.ok) {
      console.warn(
        `Notifications API returned HTTP ${response.status}; the local change was kept.`,
      );
    }
  } catch (error) {
    console.warn(
      "Notifications API could not be reached; the local change was kept.",
      error,
    );
  }
}

function readNotifications(): NotificationRecord[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as NotificationRecord[]) : [];
  } catch (error) {
    console.warn("Stored notifications could not be read.", error);
    return [];
  }
}

function writeNotifications(
  notifications: NotificationRecord[],
  notify = true,
) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  if (notify) window.dispatchEvent(new Event(CHANGE_EVENT));
}

function newestFirst(notifications: NotificationRecord[]) {
  return [...notifications].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
}

export function getNotificationsForRecipient(recipientId: string) {
  return newestFirst(
    readNotifications().filter(
      (notification) => notification.recipientId === recipientId,
    ),
  );
}

function extractNotifications(payload: unknown): NotificationRecord[] {
  if (Array.isArray(payload)) return payload as NotificationRecord[];
  if (!payload || typeof payload !== "object") return [];

  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.notifications))
    return record.notifications as NotificationRecord[];
  if (Array.isArray(record.data)) return record.data as NotificationRecord[];
  return [];
}

export async function getSharedNotificationsForRecipient(recipientId: string) {
  const localNotifications = getNotificationsForRecipient(recipientId);

  try {
    const response = await fetch(
      `/api/v1/notifications?recipientId=${encodeURIComponent(recipientId)}`,
      { cache: "no-store" },
    );

    if (!response.ok) {
      console.warn(
        `Notifications API returned HTTP ${response.status}; using local notifications.`,
      );
      return localNotifications;
    }

    const remoteNotifications = extractNotifications(await response.json());
    const merged = new Map<string, NotificationRecord>();
    for (const notification of [
      ...localNotifications,
      ...remoteNotifications,
    ]) {
      merged.set(notification.id, notification);
    }

    const recipientNotifications = newestFirst([...merged.values()]).filter(
      (notification) => notification.recipientId === recipientId,
    );
    const otherRecipients = readNotifications().filter(
      (notification) => notification.recipientId !== recipientId,
    );
    writeNotifications([...otherRecipients, ...recipientNotifications], false);
    return recipientNotifications;
  } catch (error) {
    console.warn(
      "Notifications API could not be reached; using local notifications.",
      error,
    );
    return localNotifications;
  }
}

export function createLocalNotification(input: CreateNotificationInput) {
  const notification: NotificationRecord = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  writeNotifications([notification, ...readNotifications()]);
  void sendNotificationChange("/api/v1/notifications", "POST", notification);
  return notification;
}

export function markNotificationAsRead(
  notificationId: string,
  recipientId: string,
) {
  const readAt = new Date().toISOString();
  writeNotifications(
    readNotifications().map((notification) =>
      notification.id === notificationId &&
      notification.recipientId === recipientId
        ? { ...notification, readAt }
        : notification,
    ),
  );
  void sendNotificationChange(
    `/api/v1/notifications/${encodeURIComponent(notificationId)}`,
    "PATCH",
    { recipientId },
  );
}

export function markAllNotificationsAsRead(recipientId: string) {
  const readAt = new Date().toISOString();
  writeNotifications(
    readNotifications().map((notification) =>
      notification.recipientId === recipientId && !notification.readAt
        ? { ...notification, readAt }
        : notification,
    ),
  );
  void sendNotificationChange("/api/v1/notifications", "PATCH", {
    recipientId,
  });
}

export function deleteNotification(
  notificationId: string,
  recipientId: string,
) {
  writeNotifications(
    readNotifications().filter(
      (notification) =>
        notification.id !== notificationId ||
        notification.recipientId !== recipientId,
    ),
  );
  void sendNotificationChange(
    `/api/v1/notifications/${encodeURIComponent(notificationId)}`,
    "DELETE",
    { recipientId },
  );
}

export function subscribeToNotifications(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;

  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) callback();
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener(CHANGE_EVENT, callback);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}
