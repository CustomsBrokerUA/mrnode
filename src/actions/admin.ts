'use server';

import { auth } from '@/auth';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

const ADMIN_EMAIL = 'andrii@brokerua.com';

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
