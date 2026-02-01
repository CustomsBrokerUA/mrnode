'use server';

import { auth } from '@/auth';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

const ADMIN_EMAIL = 'andrii@brokerua.com';

export async function listUsersWithCompanies(params?: {
  query?: string;
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
  const pageSizeRaw = params?.pageSize ?? 50;
  const pageSize = Math.min(Math.max(Number(pageSizeRaw) || 50, 1), 200);
  const pageRaw = params?.page ?? 1;
  const page = Math.max(Number(pageRaw) || 1, 1);
  const skip = (page - 1) * pageSize;

  const where = query
    ? {
        OR: [
          { email: { contains: query, mode: 'insensitive' as const } },
          { fullName: { contains: query, mode: 'insensitive' as const } },
        ],
      }
    : {};

  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      select: {
        id: true,
        email: true,
        fullName: true,
        activeCompanyId: true,
        createdAt: true,
        companies: {
          where: {
            company: { deletedAt: null },
          },
          orderBy: { createdAt: 'asc' },
          select: {
            role: true,
            isActive: true,
            companyId: true,
            company: {
              select: {
                id: true,
                name: true,
                edrpou: true,
              },
            },
          },
        },
      },
    }),
  ]);

  return {
    success: true,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      activeCompanyId: u.activeCompanyId,
      createdAt: u.createdAt,
      companies: u.companies.map((uc) => ({
        role: uc.role,
        isActive: uc.isActive,
        companyId: uc.companyId,
        company: uc.company,
      })),
    })),
  };
}

export async function adminSetUserCompanyAccess(params: {
  userId: string;
  companyId: string;
  isActive: boolean;
}) {
  const session = await auth();

  if (!session?.user?.email) {
    return { error: 'Неавторизований доступ' };
  }

  if (session.user.email !== ADMIN_EMAIL) {
    return { error: 'Forbidden' };
  }

  const userId = (params.userId || '').trim();
  const companyId = (params.companyId || '').trim();
  const isActive = Boolean(params.isActive);

  if (!userId || !companyId) {
    return { error: 'userId та companyId є обовʼязковими' };
  }

  let adminUserId = session.user.id;
  if (!adminUserId) {
    const adminUser = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    adminUserId = adminUser?.id;
  }

  const [targetUser, targetCompany] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, activeCompanyId: true },
    }),
    db.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, edrpou: true, deletedAt: true },
    }),
  ]);

  if (!targetUser) return { error: 'Користувача не знайдено' };
  if (!targetCompany || targetCompany.deletedAt) return { error: 'Компанію не знайдено або вона видалена' };

  const existing = await db.userCompany.findUnique({
    where: { userId_companyId: { userId, companyId } },
    select: { id: true, isActive: true, role: true },
  });

  if (!isActive) {
    if (!existing) {
      return { error: 'Звʼязок user-company не знайдено' };
    }

    if (existing.role === 'OWNER') {
      const otherOwnersCount = await db.userCompany.count({
        where: {
          companyId,
          isActive: true,
          role: 'OWNER',
          userId: { not: userId },
        },
      });

      if (otherOwnersCount === 0) {
        return { error: 'Не можна деактивувати доступ: користувач є єдиним OWNER цієї компанії' };
      }
    }
  }

  await db.$transaction(async (tx) => {
    if (existing) {
      await tx.userCompany.update({
        where: { id: existing.id },
        data: { isActive },
      });
    } else {
      if (!isActive) {
        throw new Error('Cannot create inactive link');
      }

      await tx.userCompany.create({
        data: {
          userId,
          companyId,
          role: 'MEMBER',
          isActive: true,
        },
      });
    }

    if (!isActive && targetUser.activeCompanyId === companyId) {
      const fallback = await tx.userCompany.findFirst({
        where: { userId, isActive: true, company: { deletedAt: null } },
        orderBy: { createdAt: 'asc' },
        select: { companyId: true },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          activeCompanyId: fallback?.companyId ?? null,
          companyId: fallback?.companyId ?? null,
        },
      });
    }

    await (tx as any).operationLog.create({
      data: {
        operation: 'ADMIN_SET_USER_COMPANY_ACCESS',
        status: 'success',
        userId: adminUserId || null,
        details: `${isActive ? 'Enabled' : 'Disabled'} access userId=${userId} email=${targetUser.email} companyId=${companyId} edrpou=${targetCompany.edrpou}`,
        meta: {
          targetUserId: userId,
          targetUserEmail: targetUser.email,
          companyId,
          companyEdrpou: targetCompany.edrpou,
          isActive,
        },
        finishedAt: new Date(),
      },
    });
  });

  revalidatePath('/dashboard/admin');
  return { success: true };
}

export async function adminSetUserActiveCompany(params: { userId: string; companyId: string }) {
  const session = await auth();

  if (!session?.user?.email) {
    return { error: 'Неавторизований доступ' };
  }

  if (session.user.email !== ADMIN_EMAIL) {
    return { error: 'Forbidden' };
  }

  const userId = (params.userId || '').trim();
  const companyId = (params.companyId || '').trim();

  if (!userId || !companyId) {
    return { error: 'userId та companyId є обовʼязковими' };
  }

  let adminUserId = session.user.id;
  if (!adminUserId) {
    const adminUser = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    adminUserId = adminUser?.id;
  }

  const [targetUser, uc, targetCompany] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { id: true, email: true } }),
    db.userCompany.findUnique({
      where: { userId_companyId: { userId, companyId } },
      select: { id: true, isActive: true },
    }),
    db.company.findUnique({ where: { id: companyId }, select: { id: true, edrpou: true, deletedAt: true } }),
  ]);

  if (!targetUser) return { error: 'Користувача не знайдено' };
  if (!targetCompany || targetCompany.deletedAt) return { error: 'Компанію не знайдено або вона видалена' };
  if (!uc || !uc.isActive) return { error: 'Немає активного доступу користувача до цієї компанії' };

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { activeCompanyId: companyId, companyId },
    });

    await (tx as any).operationLog.create({
      data: {
        operation: 'ADMIN_SET_USER_ACTIVE_COMPANY',
        status: 'success',
        userId: adminUserId || null,
        details: `Set active company userId=${userId} email=${targetUser.email} companyId=${companyId} edrpou=${targetCompany.edrpou}`,
        meta: { targetUserId: userId, targetUserEmail: targetUser.email, companyId, companyEdrpou: targetCompany.edrpou },
        finishedAt: new Date(),
      },
    });
  });

  revalidatePath('/dashboard/admin');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function attachCompanyToUser(params: {
  userEmail: string;
  companyEdrpou: string;
}) {
  const session = await auth();

  if (!session?.user?.email) {
    return { error: 'Неавторизований доступ' };
  }

  if (session.user.email !== ADMIN_EMAIL) {
    return { error: 'Forbidden' };
  }

  const userEmail = (params.userEmail || '').trim().toLowerCase();
  const companyEdrpou = (params.companyEdrpou || '').trim();

  if (!userEmail || !companyEdrpou) {
    return { error: 'Email та ЄДРПОУ є обовʼязковими' };
  }

  const user = await db.user.findUnique({
    where: { email: userEmail },
    select: { id: true, email: true, activeCompanyId: true },
  });

  if (!user) {
    return { error: 'Користувача не знайдено' };
  }

  const company = await db.company.findUnique({
    where: { edrpou: companyEdrpou },
    select: { id: true, name: true, edrpou: true, deletedAt: true },
  });

  if (!company || company.deletedAt) {
    return { error: 'Компанію не знайдено або вона видалена' };
  }

  await db.userCompany.upsert({
    where: {
      userId_companyId: {
        userId: user.id,
        companyId: company.id,
      },
    },
    update: {
      isActive: true,
    },
    create: {
      userId: user.id,
      companyId: company.id,
      role: 'MEMBER',
      isActive: true,
    },
  });

  await db.user.update({
    where: { id: user.id },
    data: {
      activeCompanyId: company.id,
      companyId: company.id,
    },
  });

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/companies');
  revalidatePath('/dashboard/admin');

  return {
    success: true,
    userEmail: user.email,
    company: {
      id: company.id,
      name: company.name,
      edrpou: company.edrpou,
    },
  };
}

export async function adminDeleteUser(params: { userId: string }) {
  const session = await auth();

  if (!session?.user?.email) {
    return { error: 'Неавторизований доступ' };
  }

  if (session.user.email !== ADMIN_EMAIL) {
    return { error: 'Forbidden' };
  }

  const userId = (params.userId || '').trim();
  if (!userId) return { error: 'userId is required' };

  let adminUserId = session.user.id;
  if (!adminUserId) {
    const adminUser = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    adminUserId = adminUser?.id;
  }

  if (adminUserId && adminUserId === userId) {
    return { error: 'Не можна видалити самого себе' };
  }

  const targetUser = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });

  if (!targetUser) {
    return { error: 'Користувача не знайдено' };
  }

  if (targetUser.email === 'test@gmail.com') {
    return { error: 'Демонстраційний акаунт не можна видалити' };
  }

  const ownedCompanies = await db.userCompany.findMany({
    where: { userId, isActive: true, role: 'OWNER' },
    select: { companyId: true },
  });

  for (const owned of ownedCompanies) {
    const otherOwnersCount = await db.userCompany.count({
      where: {
        companyId: owned.companyId,
        isActive: true,
        role: 'OWNER',
        userId: { not: userId },
      },
    });

    if (otherOwnersCount === 0) {
      return {
        error:
          'Неможливо видалити користувача: він є єдиним OWNER хоча б однієї компанії. Спочатку признач OWNER іншому користувачу або видали компанію.',
      };
    }
  }

  await db.$transaction(async (tx) => {
    await tx.user.delete({ where: { id: userId } });

    await (tx as any).operationLog.create({
      data: {
        operation: 'ADMIN_DELETE_USER',
        status: 'success',
        userId: adminUserId || null,
        details: `Deleted user id=${userId} email=${targetUser.email}`,
        meta: { deletedUserId: userId, deletedUserEmail: targetUser.email },
        finishedAt: new Date(),
      },
    });
  });

  revalidatePath('/dashboard/admin');
  return { success: true };
}
