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

  const { getActiveCompanyWithAccess } = await import('@/lib/company-access');
  const access = await getActiveCompanyWithAccess();

  let declarationsCountForActiveCompany: number | null = null;
  let declarationsCountForAllAccessibleCompanies: number | null = null;

  if (access.success && access.companyId) {
    declarationsCountForActiveCompany = await db.declaration.count({
      where: {
        companyId: access.companyId,
      }
    });
  }

  declarationsCountForAllAccessibleCompanies = await db.declaration.count({
    where: {
      company: {
        userCompanies: {
          some: {
            user: {
              email: session.user.email,
            },
            isActive: true,
          }
        },
        deletedAt: null,
      },
    }
  });

  let firstPage: any = null;
  try {
    const { getDeclarationsPaginated } = await import('@/actions/declarations');
    firstPage = await getDeclarationsPaginated(1, 20, {}, null, 'desc', 'list61');
  } catch (e: any) {
    firstPage = { error: e?.message || String(e) };
  }

  return NextResponse.json({
    now: new Date().toISOString(),
    session: {
      email: session.user.email,
      activeCompanyId: (session.user as any).activeCompanyId ?? null,
      companiesCount: Array.isArray((session.user as any).companies) ? (session.user as any).companies.length : null,
    },
    access,
    declarationsCountForActiveCompany,
    declarationsCountForAllAccessibleCompanies,
    firstPageSummary: firstPage
      ? {
          total: (firstPage as any).total ?? null,
          page: (firstPage as any).page ?? null,
          pageSize: (firstPage as any).pageSize ?? null,
          totalPages: (firstPage as any).totalPages ?? null,
          declarationsLength: Array.isArray((firstPage as any).declarations)
            ? (firstPage as any).declarations.length
            : null,
          error: (firstPage as any).error ?? null,
        }
      : null,
  });
}
