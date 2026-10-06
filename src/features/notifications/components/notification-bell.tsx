'use client';

import type { Route } from 'next';

import { useEffect, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import type { NotificationRecord } from '@/domain/notifications/types';

import { useNotifications } from '../hooks/use-notifications';

import styles from './notification-bell.module.css';

type NotificationBellProps = {
  recipientId: string;
};

function formatRelativeTime(createdAt: string) {
  const createdTime = new Date(createdAt).getTime();
  const difference = Date.now() - createdTime;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (difference < minute) {
    return 'Just now';
  }

  if (difference < hour) {
    const minutes = Math.floor(difference / minute);
    return `${minutes} min ago`;
  }

  if (difference < day) {
    const hours = Math.floor(difference / hour);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }

  const days = Math.floor(difference / day);

  if (days <= 7) {
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  }

  return new Intl.DateTimeFormat('en-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(createdAt));
}

function getNotificationCode(notification: NotificationRecord) {
  switch (notification.entityType) {
    case 'PAYMENT_VOUCHER':
      return 'PV';

    case 'INVOICE_PAYMENT':
      return 'IV';

    case 'TRAVEL_ALLOWANCE':
      return 'TA';

    case 'CASH_ADVANCE':
      return 'CA';

    case 'EXPENSE_CLAIM':
      return 'CL';

    case 'PETTY_CASH':
      return 'PC';

    default:
      return '•';
  }
}

export function NotificationBell({ recipientId }: NotificationBellProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
  } = useNotifications(recipientId);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  function openNotification(notification: NotificationRecord) {
    markAsRead(notification.id);
    setIsOpen(false);
    router.push(notification.href as Route);
  }

  return (
    <div className={styles.notificationContainer} ref={containerRef}>
      <button
        className={styles.bellButton}
        type="button"
        aria-label={`Notifications, ${unreadCount} unread`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        title="Notifications"
        onClick={() => setIsOpen((current) => !current)}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width="19"
          height="19"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>

        {unreadCount > 0 && (
          <span className={styles.unreadBadge} aria-hidden="true">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <section
          className={styles.notificationDropdown}
          aria-label="Notifications"
        >
          <header className={styles.notificationHeader}>
            <div>
              <h2>Notifications</h2>
              <p>
                {unreadCount > 0
                  ? `${unreadCount} unread`
                  : 'You are up to date'}
              </p>
            </div>

            {unreadCount > 0 && (
              <button type="button" onClick={markAllAsRead}>
                Mark all as read
              </button>
            )}
          </header>

          <div className={styles.notificationContent}>
            {isLoading ? (
              <div className={styles.notificationEmpty}>
                Loading notifications…
              </div>
            ) : notifications.length === 0 ? (
              <div className={styles.notificationEmpty}>
                <span aria-hidden="true">✓</span>
                <strong>No notifications yet</strong>
                <p>Updates requiring your attention will appear here.</p>
              </div>
            ) : (
              <ul className={styles.notificationList}>
                {notifications.slice(0, 8).map((notification) => (
                  <li key={notification.id}>
                    <button
                      className={
                        notification.readAt
                          ? styles.notificationItem
                          : `${styles.notificationItem} ${styles.notificationUnread}`
                      }
                      type="button"
                      onClick={() => openNotification(notification)}
                    >
                      <span
                        className={styles.notificationIcon}
                        aria-hidden="true"
                      >
                        {getNotificationCode(notification)}
                      </span>

                      <span className={styles.notificationBody}>
                        <strong>{notification.title}</strong>
                        <span>{notification.message}</span>
                        <small>{formatRelativeTime(notification.createdAt)}</small>
                      </span>

                      {!notification.readAt && (
                        <span
                          className={styles.unreadDot}
                          aria-label="Unread"
                        />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
