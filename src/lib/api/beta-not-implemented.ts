import { NextResponse } from 'next/server';

export function betaNotImplemented(action: string) {
  return NextResponse.json(
    {
      error: 'BETA_NOT_IMPLEMENTED',
      message: `${action} is scaffolded but not connected to the database yet.`,
    },
    { status: 501 }
  );
}
