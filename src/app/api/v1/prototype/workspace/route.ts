import { getPrototypeWorkspace } from '@/domain/prototype/get-prototype-workspace';
import { dataResponse } from '@/lib/api/response';

export async function GET(): Promise<Response> {
  return dataResponse(await getPrototypeWorkspace());
}
