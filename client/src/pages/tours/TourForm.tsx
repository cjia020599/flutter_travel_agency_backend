import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Save, Loader2, Map } from "lucide-react";
import { useTour, useCreateTour, useUpdateTour } from "@/hooks/use-tours";
import { api } from "@shared/routes";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

const formSchema = api.tours.create.input;
type TourFormValues = z.infer<typeof formSchema>;

export default function TourForm() {
  const [_, navigate] = useLocation();
  const { id } = useParams<{ id?: string }>();
  const isEditing = !!id;
  const tourId = id ? parseInt(id, 10) : undefined;
  
  const { data: tour, isLoading: isLoadingTour } = useTour(tourId);
  const createTour = useCreateTour();
  const updateTour = useUpdateTour();

  const form = useForm<TourFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      slug: "",
      content: "",
      status: "draft",
      isFeatured: false,
      duration: 0,
      price: "",
      salePrice: "",
      // Minimal approach for dynamic arrays: textareas mapped to array via component logic or pre/post processing
    }
  });

  useEffect(() => {
    if (tour && isEditing) {
      form.reset({
        title: tour.title,
        slug: tour.slug,
        content: tour.content ?? "",
        categoryId: tour.categoryId ?? undefined,
        videoUrl: tour.videoUrl,
        imageUrl: tour.imageUrl ?? undefined,
        status: tour.status,
        isFeatured: tour.isFeatured ?? false,
        authorId: tour.authorId ?? undefined,
        duration: tour.duration ?? undefined,
        minPeople: tour.minPeople ?? undefined,
        maxPeople: tour.maxPeople ?? undefined,
        minDayBeforeBooking: tour.minDayBeforeBooking ?? undefined,
        itinerary: tour.itinerary as any,
        faqs: tour.faqs as any,
        include: tour.include as any,
        exclude: tour.exclude as any,
        surroundings: tour.surroundings as any,
        mapLat: tour.mapLat?.toString() || undefined,
        mapLng: tour.mapLng?.toString() || undefined,
        mapZoom: tour.mapZoom ?? undefined,
        realAddress: tour.realAddress ?? undefined,
        price: tour.price?.toString() || "",
        salePrice: tour.salePrice?.toString() || "",
        extraPrices: tour.extraPrices as any,
        serviceFees: tour.serviceFees as any,
        personTypes: tour.personTypes as any,
        discountByPeople: tour.discountByPeople as any,
        fixedDates: tour.fixedDates ?? undefined,
        openHours: tour.openHours as any,
        locationId: tour.locationId ?? undefined,
      });
    }
  }, [tour, isEditing, form]);

  const onSubmit = (data: TourFormValues) => {
    if (isEditing && tourId) {
      updateTour.mutate({ id: tourId, ...data }, {
        onSuccess: () => navigate("/tours")
      });
    } else {
      createTour.mutate(data, {
        onSuccess: () => navigate("/tours")
      });
    }
  };

  const isPending = createTour.isPending || updateTour.isPending;

  if (isEditing && isLoadingTour) {
    return <div className="p-12 flex justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="sticky top-16 -mx-4 md:-mx-8 px-4 md:px-8 py-4 bg-background/80 backdrop-blur-xl z-20 border-b border-border/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/tours")} className="rounded-xl">
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight">
              {isEditing ? "Edit Tour" : "Create New Tour"}
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
              <TabsTrigger value="logistics" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-4">Logistics</TabsTrigger>
              <TabsTrigger value="pricing" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-4">Pricing</TabsTrigger>
              <TabsTrigger value="details" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-4">Content Details</TabsTrigger>
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
                          <FormLabel className="text-foreground/80">Tour Title</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Grand Canyon Adventure" className="rounded-xl bg-secondary/30 focus-visible:bg-background" {...field} />
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
                            <Input placeholder="grand-canyon-adventure" className="rounded-xl bg-secondary/30 focus-visible:bg-background" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground/80">Description</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Describe the experience..." className="min-h-[150px] rounded-xl bg-secondary/30 focus-visible:bg-background" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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
                            <FormLabel className="text-base text-foreground/90">Featured Tour</FormLabel>
                            <FormDescription>
                              Highlight this tour on the homepage
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

            <TabsContent value="logistics" className="space-y-6 outline-none">
              <Card className="border-border/50 shadow-sm rounded-2xl overflow-hidden">
                <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormField
                      control={form.control}
                      name="duration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground/80">Duration (Hours)</FormLabel>
                          <FormControl>
                            <Input type="number" className="rounded-xl bg-secondary/30 focus-visible:bg-background" {...field} value={field.value || ""} onChange={e => field.onChange(parseInt(e.target.value))} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="minPeople"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground/80">Min People</FormLabel>
                          <FormControl>
                            <Input type="number" className="rounded-xl bg-secondary/30 focus-visible:bg-background" {...field} value={field.value || ""} onChange={e => field.onChange(parseInt(e.target.value))} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="maxPeople"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground/80">Max People</FormLabel>
                          <FormControl>
                            <Input type="number" className="rounded-xl bg-secondary/30 focus-visible:bg-background" {...field} value={field.value || ""} onChange={e => field.onChange(parseInt(e.target.value))} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="pt-6 border-t border-border/50">
                    <h3 className="font-display font-medium text-lg mb-4 flex items-center gap-2">
                      <Map className="size-5 text-muted-foreground" />
                      Location Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="realAddress"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel className="text-foreground/80">Full Address</FormLabel>
                            <FormControl>
                              <Input placeholder="123 Main St..." className="rounded-xl bg-secondary/30 focus-visible:bg-background" {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="mapLat"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-foreground/80">Latitude</FormLabel>
                            <FormControl>
                              <Input placeholder="34.0522" className="rounded-xl bg-secondary/30 focus-visible:bg-background" {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="mapLng"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-foreground/80">Longitude</FormLabel>
                            <FormControl>
                              <Input placeholder="-118.2437" className="rounded-xl bg-secondary/30 focus-visible:bg-background" {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
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
                          <FormLabel className="text-foreground/80">Regular Price ($)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="99.99" className="rounded-xl bg-secondary/30 focus-visible:bg-background text-lg font-medium" {...field} value={field.value || ""} />
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
                          <FormLabel className="text-foreground/80">Sale Price ($)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="79.99" className="rounded-xl bg-secondary/30 focus-visible:bg-background text-lg font-medium text-green-600" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormDescription>Leave empty if no sale</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="details" className="space-y-6 outline-none">
               <Card className="border-border/50 shadow-sm rounded-2xl overflow-hidden bg-gradient-to-b from-card to-secondary/20">
                <CardContent className="p-8 text-center text-muted-foreground">
                  <div className="size-16 bg-background border border-border/50 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-sm">
                    <Map className="size-6 text-muted-foreground/70" />
                  </div>
                  <h3 className="font-display font-medium text-foreground text-lg">Rich Content Generation</h3>
                  <p className="max-w-md mx-auto mt-2 text-sm">
                    Connect an AI integration or rich text editor to build dynamic itineraries, FAQs, and include/exclude lists here.
                  </p>
                  <Button variant="outline" className="mt-6 rounded-xl border-border/50" disabled>
                    Configure Advanced Editor
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </form>
      </Form>
    </div>
  );
}
