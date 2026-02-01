import { auth } from '@/auth';
import { notFound } from 'next/navigation';
import AdminPageClient from './page-client';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await auth();

  if (!session?.user?.email || session.user.email !== 'andrii@brokerua.com') {
    notFound();
  }

  return <AdminPageClient />;
}
