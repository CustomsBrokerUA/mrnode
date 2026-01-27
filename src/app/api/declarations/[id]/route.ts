import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await ctx.params;

  const { getActiveCompanyWithAccess } = await import('@/lib/company-access');
  const access = await getActiveCompanyWithAccess();

  if (!access.success || !access.companyId) {
    return NextResponse.json({ error: 'No active company' }, { status: 403 });
  }

  const declaration = await db.declaration.findFirst({
    where: {
      id,
      companyId: access.companyId
    },
    select: {
      id: true,
      xmlData: true
    }
  });

  if (!declaration) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ id: declaration.id, xmlData: declaration.xmlData });
}
