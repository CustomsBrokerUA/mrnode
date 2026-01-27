import { Suspense } from "react";
import { getDeclarations } from "@/actions/declarations";
import { auth } from "@/auth";
import ArchivePageClient from "./page-client";
import ArchiveLoading from "./loading";

export const dynamic = 'force-dynamic';

async function ArchiveContent() {
    const session = await auth();
    const activeCompanyId = session?.user?.activeCompanyId || '';
    const declarations = await getDeclarations();
    return <ArchivePageClient declarations={declarations} activeCompanyId={activeCompanyId} />;
}

export default async function ArchivePage() {
    return (
        <Suspense fallback={<ArchiveLoading />}>
            <ArchiveContent />
        </Suspense>
    );
}
