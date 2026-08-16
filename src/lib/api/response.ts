export function dataResponse<T>(data: T, init?: ResponseInit): Response {
  return Response.json({ data }, init);
}
