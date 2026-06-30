import { auth } from "@/auth";
import { redirect } from "next/navigation";
import DashboardClient from "../components/DashboardClient";

export default async function DashboardPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return <DashboardClient session={session} />;
}

export const dynamic = "force-dynamic";
