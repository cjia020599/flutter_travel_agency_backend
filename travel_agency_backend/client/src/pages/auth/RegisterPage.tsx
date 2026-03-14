import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "wouter";
import { Map, Eye, EyeOff, Loader2 } from "lucide-react";
import { useState } from "react";
import { registerSchema, type RegisterInput } from "@shared/schema";
import { useRegister } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const register = useRegister();

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      username: "",
      email: "",
      password: "",
      role: "customer",
      businessName: "",
    },
  });

  const selectedRole = form.watch("role");
  const onSubmit = (data: RegisterInput) => register.mutate(data);

  const fieldError = (name: keyof RegisterInput) =>
    form.formState.errors[name]?.message;

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary/30 p-4">
      <div className="w-full max-w-lg">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2 font-bold text-xl">
            <div className="size-10 bg-primary rounded-xl flex items-center justify-center text-primary-foreground">
              <Map className="size-5" />
            </div>
            <span>LuminaTravel</span>
          </div>
        </div>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-2xl font-bold tracking-tight">Create account</CardTitle>
            <CardDescription>Fill in the details below to get started</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" placeholder="John" data-testid="input-first-name" {...form.register("firstName")} />
                  {fieldError("firstName") && <p className="text-sm text-destructive">{fieldError("firstName")}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" placeholder="Doe" data-testid="input-last-name" {...form.register("lastName")} />
                  {fieldError("lastName") && <p className="text-sm text-destructive">{fieldError("lastName")}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" placeholder="johndoe" data-testid="input-username" {...form.register("username")} />
                {fieldError("username") && <p className="text-sm text-destructive">{fieldError("username")}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@example.com" data-testid="input-email" {...form.register("email")} />
                {fieldError("email") && <p className="text-sm text-destructive">{fieldError("email")}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min. 6 characters"
                    data-testid="input-password"
                    {...form.register("password")}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {fieldError("password") && <p className="text-sm text-destructive">{fieldError("password")}</p>}
              </div>

              <div className="space-y-2">
                <Label>Account Type</Label>
                <Select
                  value={selectedRole}
                  onValueChange={(v) => form.setValue("role", v as RegisterInput["role"])}
                >
                  <SelectTrigger data-testid="select-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="vendor">Vendor</SelectItem>
                    <SelectItem value="administrator">Administrator</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedRole === "vendor" && (
                <div className="space-y-2">
                  <Label htmlFor="businessName">Business Name</Label>
                  <Input id="businessName" placeholder="Your Company Ltd." data-testid="input-business-name" {...form.register("businessName")} />
                  {fieldError("businessName") && <p className="text-sm text-destructive">{fieldError("businessName")}</p>}
                </div>
              )}

              <Button
                type="submit"
                className="w-full mt-2"
                disabled={register.isPending}
                data-testid="button-register"
              >
                {register.isPending ? (
                  <><Loader2 className="size-4 mr-2 animate-spin" /> Creating account...</>
                ) : "Create account"}
              </Button>
            </form>

            <p className="text-sm text-center text-muted-foreground mt-6">
              Already have an account?{" "}
              <Link href="/login" className="text-foreground font-medium underline underline-offset-4">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
