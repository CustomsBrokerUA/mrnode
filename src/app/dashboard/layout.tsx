import { getUserProfile } from "@/actions/user";
import DashboardLayoutClient from "./layout-client";
import { SyncStatusProvider } from "@/contexts/sync-status-context";

let lastExchangeRatesSyncDayKey: string | null = null;

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const userProfile = await getUserProfile();

    if (userProfile) {
        const now = new Date();
        const dayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        if (lastExchangeRatesSyncDayKey !== dayKey) {
            lastExchangeRatesSyncDayKey = dayKey;
            try {
                const { syncMissingExchangeRates } = await import('@/lib/exchange-rate-sync');
                void syncMissingExchangeRates().catch((e) => {
                    console.error('Background exchange rates sync failed:', e);
                });
            } catch (e) {
                console.error('Could not start background exchange rates sync:', e);
            }
        }
    }

    return (
        <SyncStatusProvider>
            <DashboardLayoutClient userProfile={userProfile}>{children}</DashboardLayoutClient>
        </SyncStatusProvider>
    );
}
