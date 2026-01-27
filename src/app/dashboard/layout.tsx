import { getUserProfile } from "@/actions/user";
import DashboardLayoutClient from "./layout-client";
import { SyncStatusProvider } from "@/contexts/sync-status-context";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const userProfile = await getUserProfile();

    return (
        <SyncStatusProvider>
            <DashboardLayoutClient userProfile={userProfile}>{children}</DashboardLayoutClient>
        </SyncStatusProvider>
    );
}
