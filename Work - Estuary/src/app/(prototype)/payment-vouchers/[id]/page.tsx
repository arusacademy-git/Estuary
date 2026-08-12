import { SubmissionDetailScreen } from '@/app/_components/prototype-screens';

export default async function SubmissionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <SubmissionDetailScreen submissionId={id} />;
}
