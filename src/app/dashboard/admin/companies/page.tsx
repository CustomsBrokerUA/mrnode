import { auth } from '@/auth';
import { notFound } from 'next/navigation';
import AdminCompaniesPageClient from './page-client';

export const dynamic = 'force-dynamic';

export default async function AdminCompaniesPage() {
  const session = await auth();

  if (!session?.user?.email || session.user.email !== 'andrii@brokerua.com') {
    notFound();
  }

  return <AdminCompaniesPageClient />;
}
