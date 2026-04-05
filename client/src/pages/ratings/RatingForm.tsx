import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Star, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useCreateRating, useUpdateRating, useUserRating } from "@/hooks/use-ratings";
import { createRatingInputSchema } from "@shared/schema";
import { useEffect } from "react";

interface RatingFormProps {
  moduleType: 'car' | 'tour';
  moduleId: number;
  onSuccess?: () => void;
}

export default function RatingForm({ moduleType, moduleId, onSuccess }: RatingFormProps) {
  const createRating = useCreateRating();
  const updateRating = useUpdateRating();
  const { data: existingRating } = useUserRating(moduleType, moduleId);

  const form = useForm({
    resolver: zodResolver(createRatingInputSchema),
    defaultValues: {
      stars: 5,
      comment: "",
      moduleType,
      moduleId,
    },
  });

  useEffect(() => {
    if (existingRating) {
      form.reset({
        stars: existingRating.stars,
        comment: existingRating.comment || "",
        moduleType,
        moduleId,
      });
    }
  }, [existingRating]);

  const onSubmit = (data) => {
    if (existingRating) {
      updateRating.mutate({ 
        id: existingRating.id,
        stars: data.stars,
        comment: data.comment || undefined 
      }, { 
        onSuccess: onSuccess 
      });
    } else {
      createRating.mutate(data, { 
        onSuccess: onSuccess 
      });
    }
  };

  const isPending = createRating.isPending || updateRating.isPending;
  const isEditing = !!existingRating;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="flex items-center gap-2">
          <FormField
            control={form.control}
            name="stars"
            render={({ field }) => (
              <FormItem className="flex items-center gap-1">
                {[1,2,3,4,5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => field.onChange(star)}
                    className={`p-1 rounded transition-colors ${
                      field.value >= star 
                        ? 'text-yellow-400 fill-yellow-400' 
                        : 'text-gray-300'
                    } hover:text-yellow-400`}
                  >
                    <Star className="size-6" />
                  </button>
                ))}
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="comment"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Your Review (Optional)</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Share your experience..." 
                  className="min-h-[100px] rounded-xl"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button 
          type="submit" 
          disabled={isPending}
          className="w-full rounded-xl"
        >
          {isPending ? (
            <>Submitting...</>
          ) : isEditing ? (
            <>
              <Send className="mr-2 size-4" />
              Update Review
            </>
          ) : (
            <>
              <Send className="mr-2 size-4" />
              Submit Review
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}

