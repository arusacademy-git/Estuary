'use client';

import {
  type FocusEvent,
  type InputHTMLAttributes,
  useState,
} from 'react';

import { parsePaymentAmountInput } from './utils/payment-amount';

type PaymentAmountInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'inputMode' | 'onChange' | 'type' | 'value'
> & {
  onValueChange: (value: number) => void;
  value: number;
};

type PaymentAmountDraftInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'inputMode' | 'onChange' | 'type' | 'value'
> & {
  onValueChange: (value: string) => void;
  value: string;
};

function displayValue(value: number) {
  return value > 0 ? String(value) : '';
}

export function PaymentAmountInput({
  onBlur,
  onFocus,
  onValueChange,
  placeholder = '0.00',
  value,
  ...inputProps
}: PaymentAmountInputProps) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(() => displayValue(value));

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    setFocused(false);
    const parsed = Math.round((parsePaymentAmountInput(draft) + Number.EPSILON) * 100) / 100;
    setDraft(parsed > 0 ? parsed.toFixed(2) : '');
    onValueChange(parsed);
    onBlur?.(event);
  }

  function handleFocus(event: FocusEvent<HTMLInputElement>) {
    setDraft(displayValue(value));
    setFocused(true);
    onFocus?.(event);
  }

  return (
    <input
      {...inputProps}
      inputMode="decimal"
      onBlur={handleBlur}
      onChange={(event) => {
        const next = event.target.value.replace(/,/g, '');
        if (!/^\d*(?:\.\d{0,2})?$/.test(next)) return;
        setDraft(next);
        onValueChange(parsePaymentAmountInput(next));
      }}
      onFocus={handleFocus}
      placeholder={placeholder}
      type="text"
      value={focused ? draft : displayValue(value)}
    />
  );
}

export function PaymentAmountDraftInput({
  onBlur,
  onValueChange,
  placeholder = '0.00',
  value,
  ...inputProps
}: PaymentAmountDraftInputProps) {
  return (
    <input
      {...inputProps}
      inputMode="decimal"
      onBlur={(event) => {
        const parsed = Math.round((parsePaymentAmountInput(value) + Number.EPSILON) * 100) / 100;
        onValueChange(value.trim() ? parsed.toFixed(2) : '');
        onBlur?.(event);
      }}
      onChange={(event) => {
        const next = event.target.value.replace(/,/g, '');
        if (/^\d*(?:\.\d{0,2})?$/.test(next)) onValueChange(next);
      }}
      placeholder={placeholder}
      type="text"
      value={value}
    />
  );
}
