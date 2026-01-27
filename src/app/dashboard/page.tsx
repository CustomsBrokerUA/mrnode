import { Suspense } from "react";
import { getDashboardAnalytics } from "@/actions/analytics";
import { auth } from "@/auth";
import DashboardPageClient from "./page-client";
import DashboardLoading from "./loading";
import { db } from "@/lib/db";

export const dynamic = 'force-dynamic';

async function DashboardContent() {
    const session = await auth();

    // Більш надійний спосіб отримання activeCompanyId
    let activeCompanyId = session?.user?.activeCompanyId || '';

    if (!activeCompanyId && session?.user?.id) {
        const dbUser = await db.user.findUnique({
            where: { id: session.user.id },
            select: { activeCompanyId: true }
        });
        activeCompanyId = dbUser?.activeCompanyId || '';
    }

    // Якщо все ще порожньо, спробуємо отримати ID активної компанії через lib (fallback на першу доступну)
    if (!activeCompanyId) {
        const { getActiveCompanyWithAccess } = await import("@/lib/company-access");
        const access = await getActiveCompanyWithAccess();
        if (access.success && access.companyId) {
            activeCompanyId = access.companyId;
        }
    }

    const analytics = await getDashboardAnalytics();
    return <DashboardPageClient analytics={analytics} activeCompanyId={activeCompanyId} />;
}

export default async function DashboardPage() {
    return (
        <Suspense fallback={<DashboardLoading />}>
            <DashboardContent />
        </Suspense>
    );
}
