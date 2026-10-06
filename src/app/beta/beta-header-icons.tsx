'use client';

import Link from 'next/link';

import { NotificationBell } from '@/features/notifications/components/notification-bell';

type BetaHeaderIconsProps = {
  accountId: string;
};

export function BetaHeaderIcons({ accountId }: BetaHeaderIconsProps) {
  return (
    <div className="betaHeaderIconGroup">
      <NotificationBell recipientId={accountId} />

      <Link
        className="betaHeaderIconButton"
        href="/beta/settings/signature"
        aria-label="Signature settings"
        title="Signature settings"
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
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.04 1.56V20.5h-3v-.28a1.7 1.7 0 0 0-1.04-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 7 15a1.7 1.7 0 0 0-1.56-1.04H5.2v-3h.24A1.7 1.7 0 0 0 7 9.92a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.12-2.12.06.06A1.7 1.7 0 0 0 10.66 6a1.7 1.7 0 0 0 1.04-1.56V4.2h3v.24A1.7 1.7 0 0 0 15.74 6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.12 2.12-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.04h.24v3h-.24A1.7 1.7 0 0 0 19.4 15Z" />
        </svg>
      </Link>

      <span className="betaHeaderDivider" aria-hidden="true" />
    </div>
  );
}