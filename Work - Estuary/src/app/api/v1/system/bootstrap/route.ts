import { getBootstrapOverview } from '@/domain/bootstrap/get-bootstrap-overview';
import { dataResponse } from '@/lib/api/response';

export async function GET(): Promise<Response> {
  return dataResponse(getBootstrapOverview());
}
