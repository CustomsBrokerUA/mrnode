'use server';

import { auth } from '@/auth';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

const ADMIN_EMAIL = 'andrii@brokerua.com';

type SyncJobStatus = 'processing' | 'completed' | 'cancelled' | 'error';

export async function listSyncJobs(params?: {
  query?: string;
  status?: SyncJobStatus | 'all';
  createdFrom?: string;
  createdTo?: string;
  page?: number;
  pageSize?: number;
}) {
  const session = await auth();

  if (!session?.user?.email) {
    return { error: 'Неавторизований доступ' };
  }

  if (session.user.email !== ADMIN_EMAIL) {
    return { error: 'Forbidden' };
  }

  const query = (params?.query || '').trim();
  const status = (params?.status || 'all') as SyncJobStatus | 'all';

  const pageSizeRaw = params?.pageSize ?? 50;
  const pageSize = Math.min(Math.max(Number(pageSizeRaw) || 50, 1), 200);
  const pageRaw = params?.page ?? 1;
  const page = Math.max(Number(pageRaw) || 1, 1);
  const skip = (page - 1) * pageSize;

  let createdFrom: Date | undefined;
  let createdTo: Date | undefined;

  try {
    if (params?.createdFrom) {
      const d = new Date(params.createdFrom);
      if (!Number.isNaN(d.getTime())) createdFrom = d;
    }
    if (params?.createdTo) {
      const d = new Date(params.createdTo);
      if (!Number.isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        createdTo = d;
      }
    }
  } catch {
    // ignore
  }

  const where: any = {};

  if (status !== 'all') {
    where.status = status;
  }

  if (createdFrom || createdTo) {
    where.createdAt = {
      ...(createdFrom ? { gte: createdFrom } : {}),
      ...(createdTo ? { lte: createdTo } : {}),
    };
  }

  if (query) {
    where.company = {
      OR: [
        { edrpou: { contains: query, mode: 'insensitive' as const } },
        { name: { contains: query, mode: 'insensitive' as const } },
      ],
    };
  }

  const [total, jobs] = await Promise.all([
    db.syncJob.count({ where }),
    db.syncJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      select: {
        id: true,
        status: true,
        companyId: true,
        company: { select: { id: true, name: true, edrpou: true } },
        totalChunks60_1: true,
        completedChunks60_1: true,
        totalGuids: true,
        completed61_1: true,
        dateFrom: true,
        dateTo: true,
        errorMessage: true,
        cancelledAt: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { errors: true } },
      },
    }),
  ]);

  return {
    success: true,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    jobs: jobs.map((j) => ({
      ...j,
      errorsCount: j._count.errors,
    })),
  };
}

export async function getSyncJobErrors(params: { jobId: string }) {
  const session = await auth();

  if (!session?.user?.email) {
    return { error: 'Неавторизований доступ' };
  }

  if (session.user.email !== ADMIN_EMAIL) {
    return { error: 'Forbidden' };
  }

  const jobId = (params.jobId || '').trim();
  if (!jobId) return { error: 'jobId is required' };

  const errors = await db.syncJobError.findMany({
    where: { syncJobId: jobId },
    orderBy: { chunkNumber: 'asc' },
    select: {
      id: true,
      chunkNumber: true,
      dateFrom: true,
      dateTo: true,
      errorMessage: true,
      errorCode: true,
      retryAttempts: true,
      isRetried: true,
      createdAt: true,
    },
  });

  return { success: true, errors };
}

export async function cancelSyncJobById(params: { jobId: string }) {
  const session = await auth();

  if (!session?.user?.email) {
    return { error: 'Неавторизований доступ' };
  }

  if (session.user.email !== ADMIN_EMAIL) {
    return { error: 'Forbidden' };
  }

  const jobId = (params.jobId || '').trim();
  if (!jobId) return { error: 'jobId is required' };

  const job = await db.syncJob.findUnique({
    where: { id: jobId },
    select: { id: true, status: true, companyId: true },
  });

  if (!job) {
    return { error: 'SyncJob не знайдено' };
  }

  if (job.status !== 'processing') {
    return { error: 'Можна скасувати лише job зі статусом processing' };
  }

  await db.$transaction(async (tx) => {
    await tx.syncJob.update({
      where: { id: jobId },
      data: { status: 'cancelled', cancelledAt: new Date() },
    });

    await (tx as any).operationLog.create({
      data: {
        operation: 'ADMIN_CANCEL_SYNC_JOB',
        status: 'success',
        companyId: job.companyId,
        userId: session.user.id || null,
        details: `Cancelled SyncJob id=${jobId}`,
        meta: { jobId },
        finishedAt: new Date(),
      },
    });
  });

  revalidatePath('/dashboard/admin/sync');
  revalidatePath('/dashboard/sync');

  return { success: true };
}
