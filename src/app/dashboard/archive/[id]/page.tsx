import { getDeclarationById } from "@/actions/analytics";
import { notFound } from "next/navigation";
import DeclarationDetailsClient from "./page-client";

export const dynamic = 'force-dynamic';

export default async function DeclarationDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    console.log("🔍 Loading Declaration Details for ID:", id);
    const declaration = await getDeclarationById(id);

    if (!declaration) {
        notFound();
    }

    return (
        <>
            <div className="hidden">{new Date().toISOString()}</div>
            <DeclarationDetailsClient key={id} declaration={declaration} />
        </>
    );
}
