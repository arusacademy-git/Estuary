import styles from '../../cash-advance.module.css';

type ParticipantAllowanceProps = {
  enabled: boolean;
  sheetLink: string;
  onEnabledChange: (enabled: boolean) => void;
  onSheetLinkChange: (link: string) => void;
};

export function ParticipantAllowance({ enabled, sheetLink, onEnabledChange, onSheetLinkChange }: ParticipantAllowanceProps) {
  return <section className={styles.receiptSection}>
    <div className={styles.sectionHeading}><div><span>2</span><div><h2>Participant Allowance</h2><p>Provide this appendix only when participant allowances were paid.</p></div></div></div>
    <label className={styles.check}><input checked={enabled} onChange={(event) => { const checked = event.target.checked; onEnabledChange(checked); if (!checked) onSheetLinkChange(''); }} type="checkbox" />This Cash Advance included participant allowances.</label>
    {enabled && <div className={styles.participantUpload}><div className={styles.participantInstructions}><div><strong>Attach the completed Participant Allowance Google Sheet</strong><p>Open the Participant Allowance tab, ensure the recipient signature information is complete, share it as “Anyone with the link can view”, then paste that tab link below.</p></div></div><label className={styles.field}><span>Participant Allowance Google Sheets link</span><input type="url" value={sheetLink} onChange={(event) => onSheetLinkChange(event.target.value)} placeholder="https://docs.google.com/spreadsheets/d/.../edit?gid=..." /></label>{sheetLink && <a className={styles.secondary} href={sheetLink} rel="noreferrer" target="_blank">Open Participant Allowance sheet ↗</a>}</div>}
  </section>;
}
