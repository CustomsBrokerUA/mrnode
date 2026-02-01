'use server';

import { db } from "@/lib/db";

type LockAcquireResult =
  | { ok: true }
  | { ok: false; reason: "locked" | "error"; error?: string };

export async function acquireOperationLock(params: {
  scopeKey: string;
  operation: string;
  companyId?: string | null;
  userId?: string | null;
  ttlMs: number;
}): Promise<LockAcquireResult> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + params.ttlMs);

  try {
    await db.$transaction(async (tx) => {
      await (tx as any).operationLock.deleteMany({
        where: {
          scopeKey: params.scopeKey,
          expiresAt: { lt: now },
        },
      });

      await (tx as any).operationLock.create({
        data: {
          scopeKey: params.scopeKey,
          operation: params.operation,
          companyId: params.companyId ?? null,
          userId: params.userId ?? null,
          expiresAt,
        },
      });
    });

    return { ok: true };
  } catch (e: any) {
    // Prisma unique constraint violation => lock already exists and not expired
    if (e?.code === "P2002") {
      return { ok: false, reason: "locked" };
    }

    return { ok: false, reason: "error", error: e?.message || "Lock error" };
  }
}

export async function releaseOperationLock(scopeKey: string): Promise<void> {
  await (db as any).operationLock.deleteMany({ where: { scopeKey } });
}

export async function startOperationLog(params: {
  operation: string;
  companyId?: string | null;
  userId?: string | null;
  meta?: any;
}): Promise<{ id: string }> {
  const row = await (db as any).operationLog.create({
    data: {
      operation: params.operation,
      status: "started",
      companyId: params.companyId ?? null,
      userId: params.userId ?? null,
      meta: params.meta ?? null,
      startedAt: new Date(),
    },
    select: { id: true },
  });

  return row;
}

export async function finishOperationLog(params: {
  id: string;
  status: "success" | "error" | "blocked";
  details?: string | null;
  meta?: any;
}): Promise<void> {
  const existing = await (db as any).operationLog.findUnique({
    where: { id: params.id },
    select: { startedAt: true },
  });

  const finishedAt = new Date();
  const durationMs = existing?.startedAt ? finishedAt.getTime() - existing.startedAt.getTime() : null;

  await (db as any).operationLog.update({
    where: { id: params.id },
    data: {
      status: params.status,
      details: params.details ?? null,
      meta: params.meta ?? undefined,
      finishedAt,
      durationMs: durationMs ?? undefined,
    },
  });
}
