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
            isActive: true,
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
