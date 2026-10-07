'use client';

import { useEffect, useMemo, useState } from 'react';

import { fetchPettyCashLedger } from '@/data/payment-requests/petty-cash/api';
import type { PettyCashLedgerSummary, PettyCashLocation } from '@/domain/payment-requests/petty-cash/types';

import styles from '../petty-cash.module.css';

const currentMonth = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 7);
const money = (value: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(value);
function date(value: string) { const parsed = new Date(value.length === 10 ? `${value}T12:00:00` : value); return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-MY'); }
function displayNote(note: string, name: string, requestNumber?: string) { const legacy = requestNumber ? `${requestNumber} · ${name}` : ''; return !note.trim() || note.trim() === legacy ? '—' : note; }
function locationLabel(location: PettyCashLocation) { return location === 'PENANG' ? 'Penang' : 'Kuala Lumpur'; }

function PettyCashUsageChart({
  summaries,
  month,
  location,
  loading,
  error,
  onMonthChange,
  onLocationChange,
}: {
  summaries: PettyCashLedgerSummary[];
  month: string;
  location: PettyCashLocation | '';
  loading: boolean;
  error: string;
  onMonthChange: (value: string) => void;
  onLocationChange: (value: PettyCashLocation | '') => void;
}) {
  const chartMaximum = Math.max(
    ...summaries.flatMap((summary) => [
      summary.moneyIn,
      summary.moneyOut,
      Math.max(summary.balance, 0),
    ]),
    1,
  );

  return <section className={styles.ledgerChart} aria-labelledby="petty-cash-usage-title">
    <div className={styles.ledgerChartHeader}>
      <div><h3 id="petty-cash-usage-title">Monthly fund usage</h3><p>Compare funds brought forward and added this month with the amount spent and still available.</p></div>
      <div className={styles.ledgerChartFilters}><label><span>Location</span><select value={location} onChange={(event) => onLocationChange(event.target.value as PettyCashLocation | '')}><option value="">All locations</option><option value="PENANG">Penang</option><option value="KUALA_LUMPUR">Kuala Lumpur</option></select></label><label><span>Month</span><input type="month" value={month} onChange={(event) => onMonthChange(event.target.value)} /></label></div>
    </div>
    <div className={styles.ledgerChartLegend} aria-label="Chart legend"><span data-tone="allocation">Funds in</span><span data-tone="spent">Spent</span><span data-tone="available">Available</span></div>
    {loading ? <div className={styles.ledgerChartEmpty}>Loading the selected monthly fund usage…</div> : error ? <div className={styles.ledgerChartEmpty}>{error}</div> : summaries.length === 0 ? <div className={styles.ledgerChartEmpty}>The graph will appear when the selected month has Petty Cash activity.</div> : <div className={styles.ledgerChartRows}>
      {summaries.map((summary) => {
        const utilization = summary.moneyIn > 0 ? Math.round((summary.moneyOut / summary.moneyIn) * 100) : 0;
        const bars = [
          { key: 'allocation', label: 'Funds in', value: summary.moneyIn },
          { key: 'spent', label: 'Spent', value: summary.moneyOut },
          { key: 'available', label: 'Available', value: Math.max(summary.balance, 0) },
        ];

        return <article className={styles.ledgerChartRow} key={summary.location}>
          <div className={styles.ledgerChartBars} role="img" aria-label={`${locationLabel(summary.location)}: ${money(summary.moneyIn)} allocation, ${money(summary.moneyOut)} spent and ${money(summary.balance)} available`}>
            {bars.map((bar) => <div className={styles.ledgerChartColumn} key={bar.key}>
              <strong>{money(bar.value)}</strong>
              <div className={styles.ledgerChartColumnTrack}><span data-tone={bar.key} style={{ height: `${(bar.value / chartMaximum) * 100}%` }} title={`${bar.label}: ${money(bar.value)}`} /></div>
              <small>{bar.label}</small>
            </div>)}
          </div>
          <div className={styles.ledgerChartLocation}><strong>{locationLabel(summary.location)}</strong><span>Opening {money(summary.openingBalance)} · {utilization}% of funds used</span></div>
        </article>;
      })}
    </div>}
  </section>;
}

export function PettyCashOverview({ role }: { role: 'director' | 'finance' }) {
  const [month, setMonth] = useState(currentMonth());
  const [location, setLocation] = useState<PettyCashLocation | ''>('');
  const [search, setSearch] = useState('');
  const [summaries, setSummaries] = useState<PettyCashLedgerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true); setError('');
    fetchPettyCashLedger({ organizationId: 'beta-arus-org', month, location: location || undefined })
      .then(setSummaries)
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Ledger could not be loaded.'))
      .finally(() => setLoading(false));
  }, [location, month]);

  const totals = useMemo(() => summaries.reduce((value, summary) => ({ moneyIn: value.moneyIn + summary.moneyIn, moneyOut: value.moneyOut + summary.moneyOut, balance: value.balance + summary.balance }), { moneyIn: 0, moneyOut: 0, balance: 0 }), [summaries]);
  const transactions = useMemo(() => {
    const term = search.trim().toLowerCase();
    return summaries.flatMap((summary) => summary.transactions)
      .filter((item) => !term || [item.name, item.notes, item.requestNumber ?? '', item.location].some((value) => value.toLowerCase().includes(term)))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }, [search, summaries]);

  return <main className={styles.managerPage}>
    <header className={styles.managerHeader}><div><p className={styles.eyebrow}>Petty Cash · Overview</p><h1>Monthly fund overview</h1><p>Monitor Penang and Kuala Lumpur allocations, payments and available balances.</p></div><div className={styles.managerAccountCard}><span>Viewing as</span><strong>{role === 'finance' ? 'Finance' : 'Director'}</strong><small>{role === 'finance' ? 'Payment and ledger access' : 'Read-only ledger access'}</small></div></header>

    <section className={styles.managerSummary}><article><span>Total money in</span><strong className={styles.moneyIn}>{money(totals.moneyIn)}</strong><small>Opening balance plus monthly allocation</small></article><article><span>Total money out</span><strong className={styles.moneyOut}>{money(totals.moneyOut)}</strong><small>Paid Petty Cash requests</small></article><article><span>Available balance</span><strong>{money(totals.balance)}</strong><small>Across the selected locations</small></article></section>

    <PettyCashUsageChart summaries={summaries} month={month} location={location} loading={loading} error={error} onMonthChange={setMonth} onLocationChange={setLocation} />

    <section className={styles.managerQueuePanel}>
      <div className={styles.managerQueueHeader}><div><h2>Petty Cash ledger</h2><p>Every monthly allocation and paid request is shown in this table.</p></div><label className={styles.managerSearch}><span>Search</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, reference or notes" /></label></div>
      {error && <div className={styles.error}>{error}</div>}
      {loading ? <div className={styles.managerEmpty}><h2>Loading ledger</h2><p>Reading the selected monthly transactions…</p></div> : transactions.length === 0 ? <div className={styles.managerEmpty}><h2>No ledger transactions found</h2><p>No money-in or money-out entries match these filters.</p></div> : <div className={styles.managerTableWrapper}><table><thead><tr><th>Date</th><th>Name</th><th>Location</th><th>Money In</th><th>Money Out</th><th>Balance</th><th>Proof</th><th>Notes</th></tr></thead><tbody>{transactions.map((item) => <tr key={item.id}><td>{date(item.date)}</td><td><strong>{item.name}</strong></td><td>{item.location === 'PENANG' ? 'Penang' : 'Kuala Lumpur'}</td><td className={styles.moneyIn}>{item.moneyIn ? money(item.moneyIn) : '—'}</td><td className={item.moneyOut ? styles.moneyOut : undefined}>{item.moneyOut ? money(item.moneyOut) : '—'}</td><td className={styles.managerAmount}>{money(item.balance)}</td><td>{item.proofLink ? <a className={styles.proofLink} href={item.proofLink} rel="noreferrer" target="_blank">Open proof ↗</a> : '—'}</td><td>{displayNote(item.notes, item.name, item.requestNumber)}</td></tr>)}</tbody></table></div>}
      <div className={styles.ledgerOverviewFooter}><span>{transactions.length} transaction{transactions.length === 1 ? '' : 's'}</span><strong>Selected balance: {money(totals.balance)}</strong></div>
    </section>
  </main>;
}
