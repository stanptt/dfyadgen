// app/api/test/route.ts
import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

export async function GET() {
  await kv.set('test', 'success');
  const value = await kv.get('test');
  return NextResponse.json({ status: value === 'success' ? 'Working!' : 'Failed' });
}