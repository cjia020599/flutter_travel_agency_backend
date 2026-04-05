import { useState } from "react";
import { useLocation } from "wouter";
import { Star, Trash2, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRatings, useDeleteRating } from "@/hooks/use-ratings";
import RatingForm from "./RatingForm";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface RatingsListProps {
  moduleType: 'car' | 'tour';
  moduleId: number;
  moduleTitle: string;
}

export default function RatingsList({ moduleType, moduleId, moduleTitle }: RatingsListProps) {
  const [showForm, setShowForm] = useLocation();
  const [editingRating, setEditingRating] = useState(null);
  const { data: ratings = [], isLoading } = useRatings(moduleType, moduleId);
  const deleteRating = useDeleteRating();

  const userId = localStorage.getItem('userId');
  const isOwner = (rating) => rating.userId === parseInt(userId || '0');

  const averageRating = ratings.length > 0 
    ? (ratings.reduce((sum, r) => sum + r.stars, 0) / ratings.length).toFixed(1)
    : 0;

  const handleDelete = (id) => {
    if (confirm('Delete this rating?')) {
      deleteRating.mutate(id);
    }
  };

  if (isLoading) return <div>Loading ratings...</div>;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">{moduleTitle} Reviews</h2>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {Array(5).fill(0).map((_, i) => (
              <Star 
                key={i} 
                className={`size-5 fill-current ${
                  i < Math.floor(averageRating) ? 'text-yellow-400' : 'text-gray-300'
                }`} 
              />
            ))}
          </div>
          <span className="text-lg font-semibold">({averageRating})</span>
          <span className="text-sm text-muted-foreground">{ratings.length} reviews</span>
        </div>
      </div>

      <RatingForm 
        moduleType={moduleType} 
        moduleId={moduleId} 
        onSuccess={() => setEditingRating(null)}
      />

      <div className="space-y-4">
        {ratings.map((rating) => (
          <Card key={rating.id} className="border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="size-10">
                    <AvatarImage src={rating.userAvatar} />
                    <AvatarFallback>{rating.userInitials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="font-semibold">{rating.userName}</h4>
                    <div className="flex items-center gap-1">
                      {Array(5).fill(0).map((_, i) => (
                        <Star 
                          key={i} 
                          className={`size-4 ${
                            i < rating.stars ? 'text-yellow-400 fill-current' : 'text-gray-300'
                          }`} 
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  {isOwner(rating) && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingRating(rating)}
                        className="size-8 p-0"
                      >
                        <Edit3 className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(rating.id)}
                        className="size-8 p-0"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {rating.comment && (
                <p className="text-sm leading-relaxed">{rating.comment}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {ratings.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Star className="size-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No reviews yet</h3>
            <p className="text-muted-foreground mb-6">Be the first to leave a review!</p>
            <RatingForm moduleType={moduleType} moduleId={moduleId} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

