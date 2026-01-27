import { getInvitationByToken } from "@/actions/companies";
import { InviteClient } from "./invite-client";
import { notFound } from "next/navigation";

type PageProps = {
    params: Promise<{ token: string }>;
};

export default async function InvitePage({ params }: PageProps) {
    const { token } = await params;

    const result = await getInvitationByToken(token);

    if (result.error && result.error === "Запрошення не знайдено") {
        notFound();
    }

    // Cast invitation to the expected type if needed or rely on implicit compat
    const invitationData = result.success ? result.invitation : null;

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8">
            <div className="w-full max-w-md space-y-8">
                <InviteClient
                    initialData={invitationData}
                    error={result.error}
                    token={token}
                />
            </div>
        </div>
    );
}
