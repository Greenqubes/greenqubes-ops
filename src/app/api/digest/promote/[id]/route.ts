// src/app/api/digest/promote/[id]/route.ts

import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { autoPromoteToVault } from '@/lib/digest/autoPromote'

function verifySignature(chatId: string, sig: string): boolean {
  const expected = crypto
    .createHmac('sha256', process.env.CRON_SECRET!)
    .update(chatId)
    .digest('hex')
    .slice(0, 16)
  return expected === sig
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const sig = req.nextUrl.searchParams.get('sig') ?? ''

  if (!sig || !verifySignature(id, sig)) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  try {
    const { path } = await autoPromoteToVault(id)
    return NextResponse.json({ ok: true, path })
  } catch (err) {
    console.error('[promote] vault commit failed:', (err as Error).message)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
