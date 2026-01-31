import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (session.user.email !== 'test@gmail.com') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      email: true,
      fullName: true,
      companyId: true,
      activeCompanyId: true,
      companies: {
        where: { isActive: true },
        select: {
          isActive: true,
          role: true,
          createdAt: true,
          companyId: true,
          company: {
            select: {
              id: true,
              name: true,
              edrpou: true,
              isActive: true,
              deletedAt: true,
              _count: {
                select: {
                  declarations: true,
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const activeCompany = user.activeCompanyId
    ? await db.company.findUnique({
        where: { id: user.activeCompanyId },
        select: { id: true, name: true, edrpou: true, isActive: true, deletedAt: true }
      })
    : null;

  return NextResponse.json({
    now: new Date().toISOString(),
    user,
    activeCompany
  });
}
