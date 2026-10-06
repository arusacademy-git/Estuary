import BetaShell from './beta-shell';

export default function BetaLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <BetaShell>{children}</BetaShell>;
}