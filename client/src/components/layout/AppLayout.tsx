import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  Map, CarFront, MapPin, Tags, LayoutDashboard,
  User, Shield, LogOut, ChevronDown,
} from "lucide-react";
import {
  SidebarProvider, Sidebar, SidebarContent, SidebarGroup,
  SidebarGroupContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarTrigger, SidebarHeader,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useProfile, useLogout } from "@/hooks/use-auth";

const NAV_ITEMS = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Tours", url: "/tours", icon: Map },
  { title: "Cars", url: "/cars", icon: CarFront },
  { title: "Locations", url: "/locations", icon: MapPin },
  { title: "Attributes", url: "/attributes", icon: Tags },
];

const ADMIN_ITEMS = [
  { title: "Roles", url: "/admin/roles", icon: Shield },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { data: profile } = useProfile();
  const logout = useLogout();

  const initials =
    profile
      ? `${profile.firstName?.[0] ?? ""}${profile.lastName?.[0] ?? ""}`.toUpperCase() ||
        profile.username?.[0]?.toUpperCase() ||
        "?"
      : "?";

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-secondary/30">
        <Sidebar className="border-r border-border/50 bg-background">
          <SidebarHeader className="h-16 flex items-center px-6 border-b border-border/50">
            <div className="flex items-center gap-2 font-bold text-lg tracking-tight">
              <div className="size-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
                <Map className="size-4" />
              </div>
              LuminaTravel
            </div>
          </SidebarHeader>
          <SidebarContent className="py-4">
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {NAV_ITEMS.map((item) => {
                    const isActive =
                      location === item.url ||
                      (item.url !== "/" && location.startsWith(item.url));
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          className={`mx-3 my-0.5 px-3 py-2.5 rounded-xl ${
                            isActive
                              ? "bg-primary text-primary-foreground font-medium"
                              : "text-muted-foreground"
                          }`}
                        >
                          <Link href={item.url} className="flex items-center gap-3">
                            <item.icon className="size-4" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {profile?.roleCode === "administrator" && (
              <SidebarGroup className="mt-4">
                <p className="px-6 pb-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Admin
                </p>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {ADMIN_ITEMS.map((item) => {
                      const isActive = location === item.url || location.startsWith(item.url);
                      return (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton
                            asChild
                            isActive={isActive}
                            className={`mx-3 my-0.5 px-3 py-2.5 rounded-xl ${
                              isActive
                                ? "bg-primary text-primary-foreground font-medium"
                                : "text-muted-foreground"
                            }`}
                          >
                            <Link href={item.url} className="flex items-center gap-3">
                              <item.icon className="size-4" />
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 flex items-center px-4 md:px-8 border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-10">
            <SidebarTrigger className="mr-4 md:hidden" />
            <div className="flex-1" />
            {profile ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center gap-2 px-2"
                    data-testid="button-user-menu"
                  >
                    <Avatar className="size-8">
                      <AvatarImage src={profile.avatar ?? undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden sm:flex flex-col items-start text-left">
                      <span className="text-sm font-medium leading-none">
                        {profile.firstName && profile.lastName
                          ? `${profile.firstName} ${profile.lastName}`
                          : profile.username}
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1 py-0 mt-0.5 capitalize">
                        {profile.roleName}
                      </Badge>
                    </div>
                    <ChevronDown className="size-3 text-muted-foreground hidden sm:block" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{profile.username}</p>
                      <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="flex items-center gap-2 cursor-pointer">
                      <User className="size-4" />
                      My Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive gap-2"
                    onClick={logout}
                    data-testid="button-logout"
                  >
                    <LogOut className="size-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href="/login">
                <Button size="sm" data-testid="button-sign-in">Sign in</Button>
              </Link>
            )}
          </header>

          <main className="flex-1 overflow-auto p-4 md:p-8">
            <div className="max-w-6xl mx-auto w-full">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
