'use server';

import { auth } from '@/auth';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

const ADMIN_EMAIL = 'andrii@brokerua.com';

type CompanyRole = 'OWNER' | 'MEMBER' | 'VIEWER';

export async function listCompanyAnomalies(params?: {
  query?: string;
  includeDeleted?: boolean;
  onlyNoUsers?: boolean;
  onlyNoOwner?: boolean;
  onlyMultiOwner?: boolean;
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
  const includeDeleted = Boolean(params?.includeDeleted);
  const onlyNoUsers = Boolean(params?.onlyNoUsers);
  const onlyNoOwner = Boolean(params?.onlyNoOwner);
  const onlyMultiOwner = Boolean(params?.onlyMultiOwner);

  const pageSizeRaw = params?.pageSize ?? 50;
  const pageSize = Math.min(Math.max(Number(pageSizeRaw) || 50, 1), 200);
  const pageRaw = params?.page ?? 1;
  const page = Math.max(Number(pageRaw) || 1, 1);
  const skip = (page - 1) * pageSize;

  const companyBaseWhere: any = {
    ...(includeDeleted ? {} : { deletedAt: null }),
    ...(query
      ? {
          OR: [
            { edrpou: { contains: query, mode: 'insensitive' as const } },
            { name: { contains: query, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  let multiOwnerCompanyIds: string[] = [];
  if (onlyMultiOwner) {
    const candidateCompanyIds = (
      await db.company.findMany({
        where: companyBaseWhere,
        select: { id: true },
        take: 5000,
      })
    ).map((c) => c.id);

    if (candidateCompanyIds.length) {
      const grouped = await db.userCompany.groupBy({
        by: ['companyId'],
        where: {
          companyId: { in: candidateCompanyIds },
          isActive: true,
          role: 'OWNER',
        },
        _count: { companyId: true },
        having: {
          companyId: { _count: { gt: 1 } },
        },
      });
      multiOwnerCompanyIds = grouped.map((g: any) => g.companyId);
    }

    if (multiOwnerCompanyIds.length === 0) {
      return {
        success: true,
        page,
        pageSize,
        total: 0,
        totalPages: 1,
        companies: [],
      };
    }
  }

  const whereOr: any[] = [];
  if (!onlyNoUsers && !onlyNoOwner && !onlyMultiOwner) {
    whereOr.push({});
  }

  if (onlyNoUsers) {
    whereOr.push({ userCompanies: { none: { isActive: true } } });
  }

  if (onlyNoOwner) {
    whereOr.push({ userCompanies: { none: { isActive: true, role: 'OWNER' } } });
  }

  if (onlyMultiOwner) {
    whereOr.push({ id: { in: multiOwnerCompanyIds } });
  }

  const where: any = {
    ...companyBaseWhere,
    ...(whereOr.length ? { OR: whereOr } : {}),
  };

  const [total, companies] = await Promise.all([
    db.company.count({ where }),
    db.company.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      select: {
        id: true,
        name: true,
        edrpou: true,
        isActive: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
        userCompanies: {
          where: { isActive: true },
          select: {
            role: true,
            userId: true,
            user: { select: { id: true, email: true, fullName: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { userCompanies: true } },
      },
    }),
  ]);

  const mapped = companies.map((c) => {
    const owners = c.userCompanies.filter((uc) => uc.role === 'OWNER');
    return {
      ...c,
      activeUsersCount: c._count.userCompanies,
      ownersCount: owners.length,
      owners,
    };
  });

  return {
    success: true,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    companies: mapped,
  };
}

export async function adminAttachUserToCompany(params: {
  companyId: string;
  userEmail: string;
  role: CompanyRole;
  replaceOwner?: boolean;
}) {
  const session = await auth();

  if (!session?.user?.email) {
    return { error: 'Неавторизований доступ' };
  }

  if (session.user.email !== ADMIN_EMAIL) {
    return { error: 'Forbidden' };
  }

  const companyId = (params.companyId || '').trim();
  const userEmail = (params.userEmail || '').trim().toLowerCase();
  const role = params.role;
  const replaceOwner = Boolean(params.replaceOwner);

  if (!companyId || !userEmail || !role) {
    return { error: 'companyId, userEmail, role є обовʼязковими' };
  }

  const [company, user] = await Promise.all([
    db.company.findUnique({ where: { id: companyId }, select: { id: true, deletedAt: true } }),
    db.user.findUnique({ where: { email: userEmail }, select: { id: true, email: true } }),
  ]);

  if (!company || company.deletedAt) {
    return { error: 'Компанію не знайдено або вона видалена' };
  }

  if (!user) {
    return { error: 'Користувача не знайдено' };
  }

  await db.$transaction(async (tx) => {
    if (role === 'OWNER') {
      const existingOwners = await tx.userCompany.findMany({
        where: { companyId, isActive: true, role: 'OWNER' },
        select: { userId: true },
      });

      if (existingOwners.length > 0 && !replaceOwner && !existingOwners.some((o) => o.userId === user.id)) {
        throw new Error('У компанії вже є OWNER. Увімкни replaceOwner щоб замінити.');
      }

      if (replaceOwner) {
        await tx.userCompany.updateMany({
          where: { companyId, isActive: true, role: 'OWNER', userId: { not: user.id } },
          data: { role: 'MEMBER' },
        });
      }
    }

    await tx.userCompany.upsert({
      where: { userId_companyId: { userId: user.id, companyId } },
      update: { isActive: true, role },
      create: { userId: user.id, companyId, isActive: true, role },
    });

    await tx.user.update({
      where: { id: user.id },
      data: { activeCompanyId: companyId, companyId },
    });

    await (tx as any).operationLog.create({
      data: {
        operation: 'ADMIN_ATTACH_USER_TO_COMPANY',
        status: 'success',
        companyId,
        userId: session.user.id || null,
        details: `Attach user ${user.email} to company ${companyId} with role=${role}`,
        meta: { companyId, userEmail: user.email, role, replaceOwner },
        finishedAt: new Date(),
      },
    });
  });

  revalidatePath('/dashboard/admin');
  revalidatePath('/dashboard/admin/companies');

  return { success: true };
}

export async function adminSoftDeleteCompany(params: { companyId: string }) {
  const session = await auth();

  if (!session?.user?.email) {
    return { error: 'Неавторизований доступ' };
  }

  if (session.user.email !== ADMIN_EMAIL) {
    return { error: 'Forbidden' };
  }

  const companyId = (params.companyId || '').trim();
  if (!companyId) return { error: 'companyId is required' };

  const company = await db.company.findUnique({ where: { id: companyId }, select: { id: true, deletedAt: true } });
  if (!company) return { error: 'Компанію не знайдено' };
  if (company.deletedAt) return { error: 'Компанія вже видалена' };

  await db.$transaction(async (tx) => {
    await tx.company.update({
      where: { id: companyId },
      data: { deletedAt: new Date(), isActive: false },
    });

    await (tx as any).operationLog.create({
      data: {
        operation: 'ADMIN_SOFT_DELETE_COMPANY',
        status: 'success',
        companyId,
        userId: session.user.id || null,
        details: `Soft delete company id=${companyId}`,
        meta: { companyId },
        finishedAt: new Date(),
      },
    });
  });

  revalidatePath('/dashboard/admin');
  revalidatePath('/dashboard/admin/companies');

  return { success: true };
}
