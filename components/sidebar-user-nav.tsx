"use client";

import {
  Activity,
  Calendar,
  ChevronUp,
  Link,
  LogIn,
  LogOut,
  Moon,
  Sun,
  User as UserIcon,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { User } from "next-auth";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { guestRegex } from "@/lib/constants";

export function SidebarUserNav({ user }: { user: User }) {
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();

  const isGuest = guestRegex.test(user?.email ?? "");
  const displayName = isGuest
    ? "Guest"
    : user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.firstName || user?.lastName || user?.email || "";

  const handleAuthAction = () => {
    if (isGuest) {
      router.push("/login");
      return;
    }

    signOut({ redirectTo: "/" });
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              className="h-10 bg-background data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              data-testid="user-nav-button"
            >
              <Image
                alt={user.email ?? "User Avatar"}
                className="rounded-full"
                height={24}
                src={`https://avatar.vercel.sh/${user.email}`}
                width={24}
              />
              <span
                className="truncate font-medium text-sm"
                data-testid="user-email"
              >
                {displayName}
              </span>
              <ChevronUp className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-popper-anchor-width)"
            data-testid="user-nav-menu"
            side="top"
          >
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={() => router.push("/settings/profile")}
            >
              <UserIcon className="mr-2 size-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={() => router.push("/settings/connections")}
            >
              <Link className="mr-2 size-4" />
              App
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={() => router.push("/settings/events")}
            >
              <Calendar className="mr-2 size-4" />
              Events
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={() => router.push("/settings/agents")}
            >
              <Activity className="mr-2 size-4" />
              Agent activity
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              data-testid="user-nav-item-theme"
              onSelect={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
            >
              {resolvedTheme === "light" ? (
                <Moon className="mr-2 size-4" />
              ) : (
                <Sun className="mr-2 size-4" />
              )}
              {`Toggle ${resolvedTheme === "light" ? "dark" : "light"} mode`}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild data-testid="user-nav-item-auth">
              <button
                className="flex w-full cursor-pointer flex-row items-center"
                onClick={handleAuthAction}
                type="button"
              >
                {isGuest ? (
                  <LogIn className="mr-2 size-4" />
                ) : (
                  <LogOut className="mr-2 size-4" />
                )}
                {isGuest ? "Login to your account" : "Sign out"}
              </button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
