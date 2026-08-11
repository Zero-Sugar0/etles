import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { AgentCalendar } from "@/components/agent-calendar";

export default async function CalendarPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return <AgentCalendar />;
}
