import { useQuery } from "@tanstack/react-query";
import { Shield, Loader2 } from "lucide-react";
import { fetchWithAuth } from "@/lib/auth";
import type { Role } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

export default function RolesPage() {
  const { data: roles, isLoading } = useQuery<Role[]>({
    queryKey: ["/api/admin/roles"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/admin/roles");
      if (!res.ok) throw new Error("Failed to fetch roles");
      return res.json();
    },
  });

  const roleBadgeVariant = (code: string) => {
    if (code === "administrator") return "default";
    if (code === "vendor") return "secondary";
    return "outline";
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Roles</h1>
        <p className="text-muted-foreground mt-1">Manage access roles for the platform.</p>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="flex flex-row items-center gap-2 pb-4">
          <Shield className="size-5 text-primary" />
          <CardTitle className="text-base">All Roles</CardTitle>
          {roles && (
            <Badge variant="secondary" className="ml-auto">{roles.length} roles</Badge>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles?.map((role) => (
                  <TableRow key={role.id} data-testid={`row-role-${role.id}`}>
                    <TableCell className="font-mono text-muted-foreground text-sm">{role.id}</TableCell>
                    <TableCell className="font-medium">{role.name}</TableCell>
                    <TableCell>
                      <Badge variant={roleBadgeVariant(role.code)} className="font-mono text-xs">
                        {role.code}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {role.createdAt ? format(new Date(role.createdAt), "MMM d, yyyy") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
