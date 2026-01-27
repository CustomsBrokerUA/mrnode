import { getActiveCompanyFullAccess } from "@/lib/company-access";
import BackfillPageClient from "./page-client";

export const dynamic = 'force-dynamic';

export default async function BackfillPage() {
  const access = await getActiveCompanyFullAccess();

  if (!access.success || !access.companyId) {
    return (
      <div className="p-6">
        <div className="text-sm text-slate-600">{access.error || "Неавторизований доступ"}</div>
      </div>
    );
  }

  if (access.role !== 'OWNER' && access.role !== 'MEMBER') {
    return (
      <div className="p-6">
        <div className="text-sm text-slate-600">Недостатньо прав</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <BackfillPageClient companyId={access.companyId} />
    </div>
  );
}
