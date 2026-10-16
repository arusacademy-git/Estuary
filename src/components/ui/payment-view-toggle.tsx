'use client';

import styles from './payment-view-toggle.module.css';

export type PaymentViewMode = 'grid' | 'list';

export function PaymentViewToggle({ value, onChange, label = 'Choose records view' }: { value: PaymentViewMode; onChange: (value: PaymentViewMode) => void; label?: string }) {
  return <div aria-label={label} className={styles.toggle} role="group">
    <span>View</span>
    <button aria-pressed={value === 'grid'} data-active={value === 'grid'} onClick={() => onChange('grid')} type="button"><span aria-hidden="true">▦</span> Grid</button>
    <button aria-pressed={value === 'list'} data-active={value === 'list'} onClick={() => onChange('list')} type="button"><span aria-hidden="true">☷</span> List</button>
  </div>;
}
