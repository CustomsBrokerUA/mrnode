import { auth } from "@/auth";
import { redirect } from "next/navigation";
import NewCompanyPageClient from "./page-client";

export default async function NewCompanyPage() {
  const session = await auth();

  if (!session || !session.user) {
    redirect("/login");
  }

  return <NewCompanyPageClient />;
}
