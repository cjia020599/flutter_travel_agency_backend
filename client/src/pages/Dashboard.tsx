import { Map, CarFront, MapPin, TrendingUp } from "lucide-react";
import { useTours } from "@/hooks/use-tours";
import { useCars } from "@/hooks/use-cars";
import { useLocations } from "@/hooks/use-locations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data: tours, isLoading: loadingTours } = useTours();
  const { data: cars, isLoading: loadingCars } = useCars();
  const { data: locations, isLoading: loadingLocations } = useLocations();

  const stats = [
    { title: "Total Tours", value: tours?.length || 0, icon: Map, isLoading: loadingTours },
    { title: "Total Cars", value: cars?.length || 0, icon: CarFront, isLoading: loadingCars },
    { title: "Destinations", value: locations?.length || 0, icon: MapPin, isLoading: loadingLocations },
    { title: "Active Bookings", value: 124, icon: TrendingUp, isLoading: false }, // Mock data for dashboard
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-display font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground mt-1">Welcome back to the LuminaTravel admin dashboard.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <Card key={i} className="border-border/50 shadow-sm hover:shadow-md clean-transition">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className="size-8 rounded-full bg-primary/5 flex items-center justify-center">
                <stat.icon className="size-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              {stat.isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-3xl font-display font-bold">{stat.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Visual aesthetic filler for empty state */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-1 lg:col-span-2 border-border/50 shadow-sm min-h-[300px] flex items-center justify-center bg-gradient-to-br from-background to-secondary/50">
           <div className="text-center">
             <div className="size-16 rounded-full bg-background shadow-sm border border-border/50 flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="size-6 text-muted-foreground" />
             </div>
             <h3 className="font-display font-semibold text-lg">Activity Chart</h3>
             <p className="text-sm text-muted-foreground mt-1 max-w-sm">Connect your analytics integration to view booking trends over time.</p>
           </div>
        </Card>
        
        <Card className="border-border/50 shadow-sm p-6">
          <h3 className="font-display font-semibold text-lg mb-4">Recent Activity</h3>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4 items-start">
                <div className="size-2 rounded-full bg-primary mt-2" />
                <div>
                  <p className="text-sm font-medium text-foreground">New booking received</p>
                  <p className="text-xs text-muted-foreground">2 hours ago</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
