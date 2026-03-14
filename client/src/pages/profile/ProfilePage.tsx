import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, User, MapPin, Save } from "lucide-react";
import { updateProfileSchema, type UpdateProfileInput } from "@shared/schema";
import { useProfile, useUpdateProfile } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useEffect } from "react";

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-sm text-destructive mt-1">{msg}</p>;
}

export default function ProfilePage() {
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();

  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      firstName: "", lastName: "", username: "", phone: "", birthday: "",
      avatar: "", bio: "", addressLine1: "", addressLine2: "",
      city: "", state: "", country: "", zipCode: "",
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        firstName: profile.firstName ?? "",
        lastName: profile.lastName ?? "",
        username: profile.username ?? "",
        phone: profile.phone ?? "",
        birthday: profile.birthday ?? "",
        avatar: profile.avatar ?? "",
        bio: profile.bio ?? "",
        addressLine1: profile.addressLine1 ?? "",
        addressLine2: profile.addressLine2 ?? "",
        city: profile.city ?? "",
        state: profile.state ?? "",
        country: profile.country ?? "",
        zipCode: profile.zipCode ?? "",
      });
    }
  }, [profile, form]);

  const onSubmit = (data: UpdateProfileInput) => updateProfile.mutate(data);
  const err = form.formState.errors;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
          <p className="text-muted-foreground mt-1">Manage your personal information and settings</p>
        </div>
        {profile && (
          <Badge variant="outline" className="text-sm px-3 py-1 capitalize">
            {profile.roleName}
          </Badge>
        )}
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Personal Info */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center gap-2 pb-4">
            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="size-4 text-primary" />
            </div>
            <CardTitle className="text-base">Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" placeholder="John" data-testid="input-first-name" className="mt-1.5" {...form.register("firstName")} />
                <FieldError msg={err.firstName?.message} />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" placeholder="Doe" data-testid="input-last-name" className="mt-1.5" {...form.register("lastName")} />
                <FieldError msg={err.lastName?.message} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="username">Username</Label>
                <Input id="username" placeholder="johndoe" data-testid="input-username" className="mt-1.5" {...form.register("username")} />
                <FieldError msg={err.username?.message} />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" placeholder="+1 555 000 0000" data-testid="input-phone" className="mt-1.5" {...form.register("phone")} />
                <FieldError msg={err.phone?.message} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="birthday">Birthday</Label>
                <Input id="birthday" type="date" data-testid="input-birthday" className="mt-1.5" {...form.register("birthday")} />
                <FieldError msg={err.birthday?.message} />
              </div>
              <div>
                <Label htmlFor="avatar">Avatar URL</Label>
                <Input id="avatar" placeholder="https://..." data-testid="input-avatar" className="mt-1.5" {...form.register("avatar")} />
                <FieldError msg={err.avatar?.message} />
              </div>
            </div>
            <div>
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                placeholder="A short bio about yourself..."
                data-testid="input-bio"
                rows={3}
                className="mt-1.5 resize-none"
                {...form.register("bio")}
              />
              <FieldError msg={err.bio?.message} />
            </div>
          </CardContent>
        </Card>

        {/* Location */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center gap-2 pb-4">
            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center">
              <MapPin className="size-4 text-primary" />
            </div>
            <CardTitle className="text-base">Location</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="addressLine1">Address Line 1</Label>
              <Input id="addressLine1" placeholder="123 Main Street" data-testid="input-address1" className="mt-1.5" {...form.register("addressLine1")} />
            </div>
            <div>
              <Label htmlFor="addressLine2">Address Line 2</Label>
              <Input id="addressLine2" placeholder="Apartment, suite, etc." data-testid="input-address2" className="mt-1.5" {...form.register("addressLine2")} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <Label htmlFor="city">City</Label>
                <Input id="city" placeholder="New York" data-testid="input-city" className="mt-1.5" {...form.register("city")} />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input id="state" placeholder="NY" data-testid="input-state" className="mt-1.5" {...form.register("state")} />
              </div>
              <div>
                <Label htmlFor="zipCode">Zip Code</Label>
                <Input id="zipCode" placeholder="10001" data-testid="input-zip" className="mt-1.5" {...form.register("zipCode")} />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Label htmlFor="country">Country</Label>
                <Input id="country" placeholder="United States" data-testid="input-country" className="mt-1.5" {...form.register("country")} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vendor Info (read-only display) */}
        {profile?.vendorProfile && (
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Vendor Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Business Name</span>
                <span className="font-medium">{profile.vendorProfile.businessName}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Commission Type</span>
                <span className="font-medium capitalize">{profile.vendorProfile.commissionType}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Commission Value</span>
                <span className="font-medium">{profile.vendorProfile.commissionValue}</span>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={updateProfile.isPending} data-testid="button-save-profile">
            {updateProfile.isPending ? (
              <><Loader2 className="size-4 mr-2 animate-spin" /> Saving...</>
            ) : (
              <><Save className="size-4 mr-2" /> Save changes</>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
