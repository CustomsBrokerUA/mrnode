import { getUserProfile } from "@/actions/user";
import { getCompanyInfo } from "@/actions/company";
import SettingsPageClient from "./page-client";

export default async function SettingsPage() {
    const userProfile = await getUserProfile();
    const companyInfo = await getCompanyInfo();

    if (!userProfile) {
        return (
            <div className="max-w-4xl mx-auto">
                <div className="text-center py-12">
                    <p className="text-slate-500">Помилка завантаження профілю</p>
                </div>
            </div>
        );
    }

    return <SettingsPageClient userProfile={userProfile} companyInfo={companyInfo} />;
}
