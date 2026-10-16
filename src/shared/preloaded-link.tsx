'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';

type PreloadedLinkProps = {
  children: ReactNode;
  className: string;
  href: string;
};

export function PreloadedLink({
  children,
  className,
  href,
}: PreloadedLinkProps) {
  const router = useRouter();

  useEffect(() => {
    router.prefetch(href);
  }, [href, router]);

  return (
    <Link
      className={className}
      href={href}
      onFocus={() => router.prefetch(href)}
      onMouseEnter={() => router.prefetch(href)}
      prefetch
    >
      {children}
    </Link>
  );
}
