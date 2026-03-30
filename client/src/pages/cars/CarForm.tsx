import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Save, Loader2, CarFront } from "lucide-react";
import { useCar, useCreateCar, useUpdateCar } from "@/hooks/use-cars";
import { api } from "@shared/routes";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

const formSchema = api.cars.create.input;
type CarFormValues = z.infer<typeof formSchema>;

export default function CarForm() {
  const [_, navigate] = useLocation();
  const { id } = useParams<{ id?: string }>();
  const isEditing = !!id;
  const carId = id ? parseInt(id, 10) : undefined;
  
  const { data: car, isLoading: isLoadingCar } = useCar(carId);
  const createCar = useCreateCar();
  const updateCar = useUpdateCar();

  const form = useForm<CarFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      slug: "",
      status: "draft",
      isFeatured: false,
      gearShift: "auto",
      price: "",
      salePrice: "",
    }
  });

  useEffect(() => {
    if (car && isEditing) {
      form.reset({
        title: car.title,
        slug: car.slug,
        content: car.content ?? "",
        videoUrl: car.videoUrl,
        imageUrl: car.imageUrl ?? undefined,
        status: car.status,
        isFeatured: car.isFeatured ?? false,
        authorId: car.authorId ?? undefined,
        passenger: car.passenger ?? undefined,
        gearShift: car.gearShift ?? undefined,
        baggage: car.baggage ?? undefined,
        door: car.door ?? undefined,
        inventoryCount: car.inventoryCount ?? undefined,
        minDayStay: car.minDayStay ?? undefined,
        minDayBeforeBooking: car.minDayBeforeBooking ?? undefined,
        mapLat: car.mapLat?.toString() || undefined,
        mapLng: car.mapLng?.toString() || undefined,
        mapZoom: car.mapZoom ?? undefined,
        realAddress: car.realAddress ?? undefined,
        price: car.price?.toString() || "",
        salePrice: car.salePrice?.toString() || "",
        extraPrices: car.extraPrices as any,
        serviceFees: car.serviceFees as any,
        fixedDates: car.fixedDates ?? undefined,
        openHours: car.openHours as any,
        locationId: car.locationId ?? undefined,
      });
    }
  }, [car, isEditing, form]);

  const onSubmit = (data: CarFormValues) => {
    if (isEditing && carId) {
      updateCar.mutate({ id: carId, ...data }, {
        onSuccess: () => navigate("/cars")
      });
    } else {
      createCar.mutate(data, {
        onSuccess: () => navigate("/cars")
      });
    }
  };

  const isPending = createCar.isPending || updateCar.isPending;

  if (isEditing && isLoadingCar) {
    return <div className="p-12 flex justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="sticky top-16 -mx-4 md:-mx-8 px-4 md:px-8 py-4 bg-background/80 backdrop-blur-xl z-20 border-b border-border/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/cars")} className="rounded-xl">
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight">
              {isEditing ? "Edit Vehicle" : "Add New Vehicle"}
            </h1>
          </div>
        </div>
        <Button 
          onClick={form.handleSubmit(onSubmit)} 
          disabled={isPending}
          className="rounded-xl bg-primary text-primary-foreground font-semibold px-6 shadow-lg shadow-primary/20 hover:shadow-xl hover:-translate-y-0.5 clean-transition"
        >
          {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
          <Save className="mr-2 size-4" />
          Save Changes
        </Button>
      </div>

      <Form {...form}>
        <form className="max-w-4xl space-y-8" onSubmit={form.handleSubmit(onSubmit)}>
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="bg-secondary/50 p-1 rounded-xl mb-6 inline-flex w-full sm:w-auto overflow-x-auto">
              <TabsTrigger value="basic" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-4">Basic Info</TabsTrigger>
              <TabsTrigger value="specs" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-4">Specifications</TabsTrigger>
              <TabsTrigger value="pricing" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-4">Pricing</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-6 outline-none">
              <Card className="border-border/50 shadow-sm rounded-2xl overflow-hidden">
                <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground/80">Vehicle Title</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Tesla Model 3" className="rounded-xl bg-secondary/30 focus-visible:bg-background" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="slug"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground/80">URL Slug</FormLabel>
                          <FormControl>
                            <Input placeholder="tesla-model-3" className="rounded-xl bg-secondary/30 focus-visible:bg-background" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/50">
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground/80">Status</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="rounded-xl bg-secondary/30 focus:bg-background">
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="rounded-xl">
                              <SelectItem value="draft">Draft</SelectItem>
                              <SelectItem value="publish">Published</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="isFeatured"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-xl border border-border/50 p-4 bg-secondary/10">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base text-foreground/90">Featured Vehicle</FormLabel>
                            <FormDescription>
                              Promote this car in search results
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value || false} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="specs" className="space-y-6 outline-none">
              <Card className="border-border/50 shadow-sm rounded-2xl overflow-hidden">
                <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                    <FormField
                      control={form.control}
                      name="passenger"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground/80">Seats</FormLabel>
                          <FormControl>
                            <Input type="number" className="rounded-xl bg-secondary/30 focus-visible:bg-background" {...field} value={field.value || ""} onChange={e => field.onChange(parseInt(e.target.value))} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="door"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground/80">Doors</FormLabel>
                          <FormControl>
                            <Input type="number" className="rounded-xl bg-secondary/30 focus-visible:bg-background" {...field} value={field.value || ""} onChange={e => field.onChange(parseInt(e.target.value))} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="baggage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground/80">Baggage Capacity</FormLabel>
                          <FormControl>
                            <Input type="number" className="rounded-xl bg-secondary/30 focus-visible:bg-background" {...field} value={field.value || ""} onChange={e => field.onChange(parseInt(e.target.value))} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="gearShift"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground/80">Transmission</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value || "auto"}>
                            <FormControl>
                              <SelectTrigger className="rounded-xl bg-secondary/30 focus:bg-background">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="rounded-xl">
                              <SelectItem value="auto">Automatic</SelectItem>
                              <SelectItem value="manual">Manual</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pricing" className="space-y-6 outline-none">
              <Card className="border-border/50 shadow-sm rounded-2xl overflow-hidden">
                <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground/80">Daily Rate ($)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="45.00" className="rounded-xl bg-secondary/30 focus-visible:bg-background text-lg font-medium" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="salePrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground/80">Discount Rate ($)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="39.99" className="rounded-xl bg-secondary/30 focus-visible:bg-background text-lg font-medium text-green-600" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </form>
      </Form>
    </div>
  );
}
