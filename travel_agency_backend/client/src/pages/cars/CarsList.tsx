import { Link } from "wouter";
import { Plus, Search, CarFront, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { useCars, useDeleteCar } from "@/hooks/use-cars";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function CarsList() {
  const { data: cars, isLoading } = useCars();
  const deleteCar = useDeleteCar();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Fleet</h1>
          <p className="text-muted-foreground mt-1">Manage your rental cars and vehicles.</p>
        </div>
        <Link href="/cars/new" className="inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-lg hover:-translate-y-0.5 h-10 px-4 py-2 clean-transition">
          <Plus className="mr-2 size-4" />
          Add Vehicle
        </Link>
      </div>

      <div className="flex items-center gap-4 bg-background p-4 rounded-2xl border border-border/50 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input 
            placeholder="Search fleet..." 
            className="pl-9 bg-secondary/50 border-transparent focus-visible:bg-background rounded-xl"
          />
        </div>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          Array(3).fill(0).map((_, i) => (
            <Card key={i} className="p-4 border-border/50 flex items-center gap-4">
              <Skeleton className="size-16 rounded-xl" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-4 w-1/4" />
              </div>
            </Card>
          ))
        ) : cars?.length === 0 ? (
          <Card className="p-12 text-center border-dashed border-2 border-border flex flex-col items-center justify-center">
            <div className="size-12 rounded-full bg-secondary flex items-center justify-center mb-4">
              <CarFront className="size-6 text-muted-foreground" />
            </div>
            <h3 className="font-display font-semibold text-lg">No vehicles found</h3>
            <p className="text-muted-foreground text-sm max-w-sm mt-1 mb-6">Expand your offerings by adding cars to your fleet.</p>
            <Link href="/cars/new" className="inline-flex items-center justify-center rounded-xl bg-primary text-primary-foreground h-10 px-4 py-2 font-medium hover:bg-primary/90 clean-transition">
              Add Vehicle
            </Link>
          </Card>
        ) : (
          cars?.map((car) => (
            <Card key={car.id} className="p-4 border-border/50 hover:border-border hover:shadow-md clean-transition flex flex-col sm:flex-row items-start sm:items-center gap-4 group">
              <div className="size-16 rounded-xl bg-secondary/80 flex items-center justify-center shrink-0">
                <CarFront className="size-6 text-muted-foreground/50" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-display font-semibold text-lg truncate">{car.title}</h3>
                  {car.isFeatured && (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100 rounded-md px-1.5 py-0">Featured</Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Badge variant="outline" className={car.status === 'publish' ? 'text-green-600 bg-green-50 border-green-200' : 'text-slate-500'}>
                    {car.status}
                  </Badge>
                  {car.price && <span>${car.price} / day</span>}
                  {car.passenger && <span>• {car.passenger} Seats</span>}
                  {car.gearShift && <span className="capitalize">• {car.gearShift}</span>}
                </div>
              </div>
              
              <div className="flex items-center gap-2 mt-4 sm:mt-0 w-full sm:w-auto justify-end">
                <Link href={`/cars/${car.id}`} className="inline-flex items-center justify-center rounded-lg h-9 px-4 text-sm font-medium border border-border/50 bg-background hover:bg-secondary clean-transition">
                  Edit
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40 rounded-xl">
                    <DropdownMenuItem asChild>
                      <Link href={`/cars/${car.id}`} className="cursor-pointer flex items-center">
                        <Edit className="size-4 mr-2" /> Edit Details
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
                      onClick={() => {
                        if(confirm('Are you sure you want to delete this car?')) {
                          deleteCar.mutate(car.id);
                        }
                      }}
                    >
                      <Trash2 className="size-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
