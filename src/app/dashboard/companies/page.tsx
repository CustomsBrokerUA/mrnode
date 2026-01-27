import { auth } from "@/auth";
import { redirect } from "next/navigation";
import CompaniesPageClient from "./page-client";

export default async function CompaniesPage() {
  const session = await auth();

  if (!session || !session.user) {
    redirect("/login");
  }

  return <CompaniesPageClient />;
}
