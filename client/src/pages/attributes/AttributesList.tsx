import { Tags } from "lucide-react";
import { useAttributes } from "@/hooks/use-attributes";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function AttributesList() {
  const { data: attributes, isLoading } = useAttributes();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-display font-bold tracking-tight">Attributes</h1>
        <p className="text-muted-foreground mt-1">Manage global tags and metadata (amenities, features).</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array(6).fill(0).map((_, i) => (
            <Card key={i} className="p-6 border-border/50 flex flex-col gap-2">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-4 w-1/4" />
            </Card>
          ))
        ) : attributes?.length === 0 ? (
          <div className="col-span-full">
            <Card className="p-12 text-center border-dashed border-2 border-border flex flex-col items-center justify-center">
              <div className="size-12 rounded-full bg-secondary flex items-center justify-center mb-4">
                <Tags className="size-6 text-muted-foreground" />
              </div>
              <h3 className="font-display font-semibold text-lg">No attributes</h3>
              <p className="text-muted-foreground text-sm max-w-sm mt-1">Tags and amenities will appear here once created.</p>
            </Card>
          </div>
        ) : (
          attributes?.map((attr) => (
            <Card key={attr.id} className="p-6 border-border/50 hover:shadow-md clean-transition group">
              <div className="flex flex-col gap-3">
                <h3 className="font-display font-semibold text-lg">{attr.name}</h3>
                <div>
                  <Badge variant="secondary" className="bg-secondary text-secondary-foreground rounded-md">
                    Type: {attr.type}
                  </Badge>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
