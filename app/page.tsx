import { auth } from "@/auth";
import DashboardClient from "./components/DashboardClient";

export default async function Home() {
  const session = await auth();
  
  return <DashboardClient session={session} />;
}
export const dynamic = "force-dynamic";
