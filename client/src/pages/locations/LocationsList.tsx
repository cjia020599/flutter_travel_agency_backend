import { MapPin } from "lucide-react";
import { useLocations } from "@/hooks/use-locations";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function LocationsList() {
  const { data: locations, isLoading } = useLocations();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-display font-bold tracking-tight">Locations</h1>
        <p className="text-muted-foreground mt-1">Manage geographic destinations.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array(6).fill(0).map((_, i) => (
            <Card key={i} className="p-6 border-border/50 flex flex-col gap-2">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
            </Card>
          ))
        ) : locations?.length === 0 ? (
          <div className="col-span-full">
            <Card className="p-12 text-center border-dashed border-2 border-border flex flex-col items-center justify-center">
              <div className="size-12 rounded-full bg-secondary flex items-center justify-center mb-4">
                <MapPin className="size-6 text-muted-foreground" />
              </div>
              <h3 className="font-display font-semibold text-lg">No locations</h3>
              <p className="text-muted-foreground text-sm max-w-sm mt-1">Add locations via the API or connect your database.</p>
            </Card>
          </div>
        ) : (
          locations?.map((loc) => (
            <Card key={loc.id} className="p-6 border-border/50 hover:shadow-md clean-transition group cursor-pointer">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-display font-semibold text-lg">{loc.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1 font-mono">{loc.slug}</p>
                </div>
                <div className="size-8 rounded-full bg-primary/5 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground clean-transition">
                  <MapPin className="size-4 text-primary group-hover:text-primary-foreground" />
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
