import { cookies } from "next/headers";
import Script from "next/script";
import { Suspense } from "react";
import { auth } from "@/app/(auth)/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { DataStreamProvider } from "@/components/data-stream-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getUserById } from "@/lib/db/queries";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js"
        strategy="afterInteractive"
      />
      <DataStreamProvider>
        <Suspense fallback={<div className="flex h-dvh" />}>
          <SidebarWrapper>{children}</SidebarWrapper>
        </Suspense>
      </DataStreamProvider>
    </>
  );
}

async function SidebarWrapper({ children }: { children: React.ReactNode }) {
  const [session, cookieStore] = await Promise.all([auth(), cookies()]);
  const isCollapsed = cookieStore.get("sidebar_state")?.value !== "true";

  let dbUser;
  if (session?.user?.id) {
    try {
      const users = await getUserById(session.user.id);
      if (users.length > 0) {
        dbUser = {
          ...session.user,
          firstName: users[0].firstName,
          lastName: users[0].lastName,
          email: users[0].email,
        };
      }
    } catch {
      // DB unavailable or schema not migrated — fall back to session user
      dbUser = session.user;
    }
  }

  return (
    <SidebarProvider defaultOpen={!isCollapsed}>
      <AppSidebar user={dbUser || session?.user} />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
