import { financeSidebarCounts } from '@/data/dashboard/finance-sidebar-counts';
import { dataResponse } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const userId = query.get('userId');
  if (query.get('role') !== 'finance' || !userId) {
    return Response.json({ error: 'INVALID_SCOPE', message: 'A Finance user is required.' }, { status: 400 });
  }

  try {
    return dataResponse(await financeSidebarCounts(userId));
  } catch (error) {
    console.error('Finance sidebar counts could not be loaded.', error);
    return Response.json({ error: 'FINANCE_ACTION_COUNTS_ERROR', message: 'Finance sidebar counts could not be loaded.' }, { status: 500 });
  }
}
