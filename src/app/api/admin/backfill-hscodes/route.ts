import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getActiveCompanyFullAccess } from "@/lib/company-access";
import { updateDeclarationSummary } from "@/lib/declaration-summary";

export async function POST(request: NextRequest) {
  try {
    const access = await getActiveCompanyFullAccess();

    if (!access.success || !access.companyId) {
      return NextResponse.json({ success: false, error: access.error || "Неавторизований доступ" }, { status: 401 });
    }

    if (access.role !== "OWNER" && access.role !== "MEMBER") {
      return NextResponse.json({ success: false, error: "Недостатньо прав" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const batchSizeRaw = searchParams.get("batchSize");
    const cursor = searchParams.get("cursor");

    const batchSize = Math.min(Math.max(parseInt(batchSizeRaw || "100", 10) || 100, 1), 500);

    const declarations = await db.declaration.findMany({
      where: {
        companyId: access.companyId,
        xmlData: { not: null },
      },
      select: {
        id: true,
        xmlData: true,
      },
      orderBy: { id: "asc" },
      take: batchSize,
      ...(cursor
        ? {
            skip: 1,
            cursor: { id: cursor },
          }
        : {}),
    });

    let processed = 0;
    let updated = 0;

    for (const d of declarations) {
      processed++;

      const xmlData = d.xmlData;
      if (!xmlData) continue;

      let has61_1 = false;
      try {
        const trimmed = xmlData.trim();
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
          const parsed = JSON.parse(xmlData);
          has61_1 = !!(parsed && typeof parsed === "object" && parsed.data61_1);
        } else if (trimmed.startsWith("<") || trimmed.startsWith("<?xml")) {
          has61_1 = true;
        }
      } catch {
        has61_1 = false;
      }

      if (!has61_1) continue;

      await updateDeclarationSummary(d.id, xmlData);
      updated++;
    }

    const nextCursor = declarations.length > 0 ? declarations[declarations.length - 1].id : null;
    const done = declarations.length < batchSize;

    return NextResponse.json({
      success: true,
      processed,
      updated,
      nextCursor,
      done,
      batchSize,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Помилка бекфілу",
      },
      { status: 500 }
    );
  }
}
