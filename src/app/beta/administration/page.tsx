'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { betaAccounts, readBetaSession } from '@/lib/auth/beta-accounts';
import { canAccessAdministration, createDefaultAdminSettings, readAdminSettings, saveAdminSettings, type AdminAccountingCode, type AdminEmployee, type AdminProgramme, type AdminSettings } from '@/features/administration/admin-settings';
import styles from './administration.module.css';

type Section = 'programmes' | 'accounting' | 'employees' | 'claims';
type Modal = { kind: 'programme'; item: AdminProgramme } | { kind: 'account'; item: AdminAccountingCode } | { kind: 'employee'; item: AdminEmployee } | { kind: 'claims' };
const blankProgramme = (): AdminProgramme => ({ id: '', code: '', name: '', managerId: '', active: true });
const blankAccount = (): AdminAccountingCode => ({ id: '', code: '', name: '', description: '', active: true });
const blankEmployee = (): AdminEmployee => ({ id: '', name: '', email: '', role: 'staff', programmeId: '', joinedAt: new Date().toISOString().slice(0, 10), active: true });
const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const PAGE_SIZE = 10;

export default function AdministrationPage() {
  const [checked, setChecked] = useState(false), [allowed, setAllowed] = useState(false);
  const [settings, setSettings] = useState<AdminSettings>(createDefaultAdminSettings);
  const [section, setSection] = useState<Section>('programmes'), [modal, setModal] = useState<Modal | null>(null);
  const [query, setQuery] = useState(''), [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all'), [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1), [message, setMessage] = useState('');
  const managers = useMemo(() => betaAccounts.filter((item) => item.role === 'manager'), []);
  useEffect(() => { let active = true; queueMicrotask(() => { if (!active) return; const access = canAccessAdministration(readBetaSession()); setAllowed(access); if (access) setSettings(readAdminSettings()); setChecked(true); }); return () => { active = false; }; }, []);
  const commit = (next: AdminSettings, text: string) => { if (!canAccessAdministration(readBetaSession())) return; setSettings(next); saveAdminSettings(next); setMessage(text); setModal(null); };
  const matches = <T extends { active: boolean }>(items: T[], text: (item: T) => string) => items.filter((item) => (status === 'all' || item.active === (status === 'active')) && (!query.trim() || text(item).toLowerCase().includes(query.trim().toLowerCase())));
  const slice = <T,>(items: T[]) => items.slice((Math.min(page, Math.max(1, Math.ceil(items.length / PAGE_SIZE))) - 1) * PAGE_SIZE, Math.min(page, Math.max(1, Math.ceil(items.length / PAGE_SIZE))) * PAGE_SIZE);
  function remove(kind: 'programme' | 'account' | 'employee', id: string, label: string) { if (!window.confirm(`Delete ${label}? Existing records retain saved information.`)) return; if (kind === 'programme') commit({ ...settings, programmes: settings.programmes.filter((x) => x.id !== id) }, 'Programme deleted.'); if (kind === 'account') commit({ ...settings, accountingCodes: settings.accountingCodes.filter((x) => x.id !== id) }, 'Accounting code deleted.'); if (kind === 'employee') commit({ ...settings, employees: settings.employees.filter((x) => x.id !== id) }, 'Employee deleted.'); }
  if (!checked) return <main className={styles.state}><h1>Loading settings…</h1><p>Checking your access permission.</p></main>;
  if (!allowed) return <main className={styles.state}><h1>Administrator access required</h1><p>Only administrators can open Settings.</p><Link href="/beta/dashboard">Back to dashboard</Link></main>;

  const programmes = matches(settings.programmes.filter((x) => filter === 'all' || (filter === 'unassigned' ? !x.managerId : x.managerId === filter)), (x) => `${x.code} ${x.name}`);
  const accounts = matches(settings.accountingCodes, (x) => `${x.code} ${x.name} ${x.description}`);
  const employees = matches(settings.employees.filter((x) => filter === 'all' || x.role === filter), (x) => `${x.name} ${x.email} ${x.role}`);
  return <main className={styles.page}>
    <header className={styles.header}><div><p>Restricted workspace</p><h1>Settings</h1><span>Maintain programme ownership, employees, claim entitlements and accounting reference data.</span></div><aside><strong>Administrator access</strong><small>Available to assigned administrator accounts.</small></aside></header>
    <section className={styles.notice}><strong>Beta settings preview</strong><span>Changes here are saved in this browser only. Shared organization settings will be connected to the database later.</span></section>
    <div className={styles.tabs} role="tablist">{([['programmes', 'Programmes & managers'], ['accounting', 'Accounting codes'], ['employees', 'Employees'], ['claims', 'Claim entitlements']] as const).map(([key, label]) => <button aria-selected={section === key} data-active={section === key} key={key} onClick={() => { setSection(key); setFilter('all'); setMessage(''); }} role="tab" type="button">{label}</button>)}</div>
    {message && <div className={styles.feedback} role="status">{message}</div>}
    {section === 'programmes' && <Directory title="Programme directory" count={programmes.length} noun="programmes" action="+ Add programme" add={() => setModal({ kind: 'programme', item: blankProgramme() })} query={query} setQuery={setQuery} placeholder="Search code or programme" status={status} setStatus={setStatus} filter={<select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">Manager: All</option><option value="unassigned">Unassigned</option>{managers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>} page={page} setPage={setPage}><Table headers={['Code', 'Programme', 'Manager', 'Status', 'Actions']}>{slice(programmes).map((x) => <tr key={x.id}><td><strong>{x.code}</strong></td><td>{x.name}</td><td>{managers.find((m) => m.id === x.managerId)?.name ?? <span className={styles.muted}>Unassigned</span>}</td><Status active={x.active} /><Actions edit={() => setModal({ kind: 'programme', item: x })} remove={() => remove('programme', x.id, `programme ${x.code}`)} /></tr>)}</Table></Directory>}
    {section === 'accounting' && <Directory title="Accounting code directory" count={accounts.length} noun="accounting codes" action="+ Add accounting code" add={() => setModal({ kind: 'account', item: blankAccount() })} query={query} setQuery={setQuery} placeholder="Search code or account" status={status} setStatus={setStatus} page={page} setPage={setPage}><Table headers={['Code', 'Account', 'Description', 'Status', 'Actions']}>{slice(accounts).map((x) => <tr key={x.id}><td><strong>{x.code}</strong></td><td>{x.name}</td><td>{x.description || '—'}</td><Status active={x.active} /><Actions edit={() => setModal({ kind: 'account', item: x })} remove={() => remove('account', x.id, `accounting code ${x.code}`)} /></tr>)}</Table></Directory>}
    {section === 'employees' && <Directory title="Employee directory" count={employees.length} noun="employees" action="+ Add employee" add={() => setModal({ kind: 'employee', item: blankEmployee() })} query={query} setQuery={setQuery} placeholder="Search name or email" status={status} setStatus={setStatus} filter={<select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">Role: All</option><option value="staff">Staff</option><option value="manager">Manager</option><option value="director">Director</option><option value="finance">Finance</option></select>} page={page} setPage={setPage}><Table headers={['Employee', 'Email', 'Role', 'Programme', 'Status', 'Joined', 'Actions']}>{slice(employees).map((x) => <tr key={x.id}><td><strong>{x.name}</strong></td><td>{x.email}</td><td>{x.role}</td><td>{settings.programmes.find((p) => p.id === x.programmeId)?.code ?? '—'}</td><Status active={x.active} /><td>{x.joinedAt}</td><Actions edit={() => setModal({ kind: 'employee', item: x })} remove={() => remove('employee', x.id, x.name)} /></tr>)}</Table></Directory>}
    {section === 'claims' && <Claims settings={settings} edit={() => setModal({ kind: 'claims' })} />}
    {modal && <ModalOverlay modal={modal} managers={managers} settings={settings} close={() => setModal(null)} save={commit} />}
  </main>;
}

function Directory({ title, count, noun, action, add, query, setQuery, placeholder, status, setStatus, filter, page, setPage, children }: { title: string; count: number; noun: string; action: string; add: () => void; query: string; setQuery: (v: string) => void; placeholder: string; status: 'all' | 'active' | 'inactive'; setStatus: (v: 'all' | 'active' | 'inactive') => void; filter?: ReactNode; page: number; setPage: (v: number) => void; children: ReactNode }) { const pages = Math.max(1, Math.ceil(count / PAGE_SIZE)), safe = Math.min(page, pages), first = count ? (safe - 1) * PAGE_SIZE + 1 : 0, last = Math.min(safe * PAGE_SIZE, count); return <section className={styles.directory}><div className={styles.directoryTitle}><div><p>{title}</p><h2>{count} {noun}</h2></div><button onClick={add} type="button">{action}</button></div><div className={styles.filters}><input aria-label="Search" onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} type="search" value={query} /><select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}><option value="all">Status: All</option><option value="active">Active</option><option value="inactive">Inactive</option></select>{filter}<button className={styles.clear} onClick={() => { setQuery(''); setStatus('all'); }} type="button">Clear filters</button></div>{children}<footer className={styles.pagination}><span>Showing {first}–{last} of {count}</span><div><button disabled={safe === 1} onClick={() => setPage(safe - 1)} type="button">‹ Prev</button><button disabled={safe === pages} onClick={() => setPage(safe + 1)} type="button">Next ›</button></div></footer></section>; }
function Table({ headers, children }: { headers: string[]; children: ReactNode }) { return <div className={styles.tableWrap}><table><thead><tr>{headers.map((x) => <th key={x}>{x}</th>)}</tr></thead><tbody>{children}</tbody></table></div>; }
function Status({ active }: { active: boolean }) { return <td><span className={styles.status} data-active={active}>{active ? 'Active' : 'Inactive'}</span></td>; }
function Actions({ edit, remove }: { edit: () => void; remove: () => void }) { return <td><div className={styles.rowActions}><button onClick={edit} type="button">Edit</button><button className={styles.danger} onClick={remove} type="button">Delete</button></div></td>; }

function Claims({ settings, edit }: { settings: AdminSettings; edit: () => void }) {
  const year = new Date().getFullYear();
  const employees = settings.employees.filter((item) => item.active);
  const policy = settings.claimPolicy;
  return <section className={styles.directory}>
    <div className={styles.directoryTitle}><div><p>Claim entitlements</p><h2>Claim policy preview</h2></div><button onClick={edit} type="button">Edit claim policy</button></div>
    <div className={styles.policyCards}>
      <article><span>Medical claim</span><strong>RM {policy.medicalAnnualLimit.toFixed(2)}</strong><small>Per employee, per year</small></article>
      <article><span>PD claim</span><strong>RM {policy.pdAnnualLimit.toFixed(2)}</strong><small>Per employee, per year</small></article>
      <article><span>Proration</span><strong>{policy.prorateByEmploymentDate ? 'Enabled' : 'Disabled'}</strong><small>Medical and PD, based on joining month</small></article>
      <article><span>Internet / Commute</span><strong>RM {policy.internetCommuteLimit.toFixed(2)}</strong><small>Per claim</small></article>
      <article><span>Tech standard</span><strong>RM {policy.techStandardLimit.toFixed(2)}</strong><small>Standard claim limit</small></article>
      <article><span>Tech extended</span><strong>RM {policy.techExtendedLimit.toFixed(2)}</strong><small>Locks Tech claims for {policy.techExtendedLockYears} years after use</small></article>
    </div>
    <div className={styles.claimExplanation}><strong>Employee-based proration</strong><p>A new employee receives the eligible months remaining in {year}, including the joining month. Joining in July provides 6/12 of each annual Medical and PD allowance.</p></div>
    <Table headers={['Employee', 'Joined', 'Medical entitlement', 'PD entitlement']}>{employees.map((item) => { const factor = policy.prorateByEmploymentDate ? prorata(item.joinedAt, year) : 1; return <tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.joinedAt}</td><td>RM {(policy.medicalAnnualLimit * factor).toFixed(2)}</td><td>RM {(policy.pdAnnualLimit * factor).toFixed(2)}</td></tr>; })}</Table>
    <footer className={styles.pagination}><span>Showing {employees.length ? 1 : 0}–{employees.length} of {employees.length}</span></footer>
  </section>;
}
function prorata(joined: string, year: number) { const date = new Date(`${joined}T00:00:00`); if (!joined || date.getFullYear() < year) return 1; if (date.getFullYear() > year) return 0; return (12 - date.getMonth()) / 12; }

function ModalOverlay({ modal, managers, settings, close, save }: { modal: Modal; managers: typeof betaAccounts; settings: AdminSettings; close: () => void; save: (next: AdminSettings, text: string) => void }) {
  const [programme, setProgramme] = useState(modal.kind === 'programme' ? modal.item : blankProgramme()), [account, setAccount] = useState(modal.kind === 'account' ? modal.item : blankAccount()), [employee, setEmployee] = useState(modal.kind === 'employee' ? modal.item : blankEmployee());
  const [medical, setMedical] = useState(String(settings.claimPolicy.medicalAnnualLimit)), [pd, setPd] = useState(String(settings.claimPolicy.pdAnnualLimit)), [prorate, setProrate] = useState(settings.claimPolicy.prorateByEmploymentDate);
  const [internetCommute, setInternetCommute] = useState(String(settings.claimPolicy.internetCommuteLimit));
  const [techStandard, setTechStandard] = useState(String(settings.claimPolicy.techStandardLimit));
  const [techExtended, setTechExtended] = useState(String(settings.claimPolicy.techExtendedLimit));
  const [techLockYears, setTechLockYears] = useState(String(settings.claimPolicy.techExtendedLockYears));
  const [policyError, setPolicyError] = useState('');
  const submit = () => {
    if (modal.kind === 'programme') { const item = { ...programme, id: programme.id || makeId('programme'), code: programme.code.trim().toUpperCase(), name: programme.name.trim() }; if (!item.code || !item.name) return; save({ ...settings, programmes: programme.id ? settings.programmes.map((x) => x.id === item.id ? item : x) : [...settings.programmes, item] }, 'Programme saved.'); }
    if (modal.kind === 'account') { const item = { ...account, id: account.id || makeId('account'), code: account.code.trim().toUpperCase(), name: account.name.trim() }; if (!item.code || !item.name) return; save({ ...settings, accountingCodes: account.id ? settings.accountingCodes.map((x) => x.id === item.id ? item : x) : [...settings.accountingCodes, item] }, 'Accounting code saved.'); }
    if (modal.kind === 'employee') { const item = { ...employee, id: employee.id || makeId('employee'), name: employee.name.trim(), email: employee.email.trim().toLowerCase() }; if (!item.name || !item.email || !item.joinedAt) return; save({ ...settings, employees: employee.id ? settings.employees.map((x) => x.id === item.id ? item : x) : [...settings.employees, item] }, 'Employee saved.'); }
    if (modal.kind === 'claims') {
      const amounts = [medical, pd, internetCommute, techStandard, techExtended].map(Number);
      const years = Number(techLockYears);
      if (amounts.some((value) => !Number.isFinite(value) || value < 0) || !Number.isInteger(years) || years < 0) {
        setPolicyError('Enter non-negative amounts and a whole number of lock years.');
        return;
      }
      if (amounts[4] < amounts[3]) {
        setPolicyError('The extended Tech limit must be at least the standard limit.');
        return;
      }
      save({ ...settings, claimPolicy: { medicalAnnualLimit: amounts[0], pdAnnualLimit: amounts[1], prorateByEmploymentDate: prorate, internetCommuteLimit: amounts[2], techStandardLimit: amounts[3], techExtendedLimit: amounts[4], techExtendedLockYears: years } }, 'Claim policy preview saved in this browser.');
    }
  };
  const title = modal.kind === 'programme' ? `${programme.id ? 'Edit' : 'Add'} programme` : modal.kind === 'account' ? `${account.id ? 'Edit' : 'Add'} accounting code` : modal.kind === 'employee' ? `${employee.id ? 'Edit' : 'Add'} employee` : 'Edit claim entitlements';
  return <div className={styles.backdrop} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }} role="presentation"><section aria-modal="true" className={styles.modal} role="dialog"><header><div><p>Administration</p><h2>{title}</h2></div><button aria-label="Close" onClick={close} type="button">×</button></header><div className={styles.modalBody}>
    {modal.kind === 'programme' && <><Field label="Programme code *"><input value={programme.code} onChange={(e) => setProgramme({ ...programme, code: e.target.value })} /></Field><Field label="Programme name *"><input value={programme.name} onChange={(e) => setProgramme({ ...programme, name: e.target.value })} /></Field><Field label="Assigned manager"><select value={programme.managerId} onChange={(e) => setProgramme({ ...programme, managerId: e.target.value })}><option value="">Unassigned</option>{managers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field><Check checked={programme.active} set={(active) => setProgramme({ ...programme, active })}>Programme is active</Check></>}
    {modal.kind === 'account' && <><Field label="Accounting code *"><input value={account.code} onChange={(e) => setAccount({ ...account, code: e.target.value })} /></Field><Field label="Account name *"><input value={account.name} onChange={(e) => setAccount({ ...account, name: e.target.value })} /></Field><Field label="Description"><textarea rows={3} value={account.description} onChange={(e) => setAccount({ ...account, description: e.target.value })} /></Field><Check checked={account.active} set={(active) => setAccount({ ...account, active })}>Accounting code is active</Check></>}
    {modal.kind === 'employee' && <><Field label="Employee name *"><input value={employee.name} onChange={(e) => setEmployee({ ...employee, name: e.target.value })} /></Field><Field label="Email *"><input type="email" value={employee.email} onChange={(e) => setEmployee({ ...employee, email: e.target.value })} /></Field><div className={styles.twoFields}><Field label="Role"><select value={employee.role} onChange={(e) => setEmployee({ ...employee, role: e.target.value as AdminEmployee['role'] })}><option value="staff">Staff</option><option value="manager">Manager</option><option value="director">Director</option><option value="finance">Finance</option></select></Field><Field label="Joined date *"><input type="date" value={employee.joinedAt} onChange={(e) => setEmployee({ ...employee, joinedAt: e.target.value })} /></Field></div><Field label="Programme"><select value={employee.programmeId} onChange={(e) => setEmployee({ ...employee, programmeId: e.target.value })}><option value="">Unassigned</option>{settings.programmes.filter((x) => x.active).map((x) => <option key={x.id} value={x.id}>{x.code}</option>)}</select></Field><Check checked={employee.active} set={(active) => setEmployee({ ...employee, active })}>Employee is active</Check></>}
    {modal.kind === 'claims' && <>
      <Field label="Medical annual limit (RM)"><input inputMode="decimal" value={medical} onChange={(e) => setMedical(e.target.value)} /></Field>
      <Field label="PD annual limit (RM)"><input inputMode="decimal" value={pd} onChange={(e) => setPd(e.target.value)} /></Field>
      <Check checked={prorate} set={setProrate}>Prorate Medical and PD using the employee joining month</Check>
      <Field label="Internet / Commute limit per claim (RM)"><input inputMode="decimal" value={internetCommute} onChange={(e) => setInternetCommute(e.target.value)} /></Field>
      <Field label="Tech standard limit (RM)"><input inputMode="decimal" value={techStandard} onChange={(e) => setTechStandard(e.target.value)} /></Field>
      <Field label="Tech extended limit (RM)"><input inputMode="decimal" value={techExtended} onChange={(e) => setTechExtended(e.target.value)} /></Field>
      <Field label="Extended Tech lock (years)"><input inputMode="numeric" value={techLockYears} onChange={(e) => setTechLockYears(e.target.value)} /></Field>
      {policyError && <p className={styles.policyError} role="alert">{policyError}</p>}
      <div className={styles.modalNote}>Preview only. These values are saved in this browser and do not change claim validation yet.</div>
    </>}
  </div><footer><button className={styles.cancel} onClick={close} type="button">Cancel</button><button onClick={submit} type="button">Save changes</button></footer></section></div>;
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className={styles.field}><span>{label}</span>{children}</label>; }
function Check({ checked, set, children }: { checked: boolean; set: (value: boolean) => void; children: ReactNode }) { return <label className={styles.check}><input checked={checked} onChange={(e) => set(e.target.checked)} type="checkbox" /><span>{children}</span></label>; }
