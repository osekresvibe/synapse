import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ThumbsUp, ThumbsDown, Star, Send, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface VideoRatingProps {
  projectId: string;
  videoId: string;
  videoCategory?: string | null;
  onRatingSubmitted?: () => void;
  compact?: boolean;
}

export function VideoRating({
  projectId,
  videoId,
  videoCategory,
  onRatingSubmitted,
  compact = false,
}: VideoRatingProps) {
  const { toast } = useToast();
  const [rating, setRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const handleQuickRating = async (isPositive: boolean) => {
    setIsSubmitting(true);
    try {
      await apiRequest("POST", "/api/feedback/rate", {
        projectId,
        generatedVideoId: videoId,
        rating: isPositive ? 5 : 2,
        videoCategory,
        feedbackText: isPositive ? "Quick positive feedback" : "Quick negative feedback",
      });
      
      toast({
        title: isPositive ? "Thanks for the feedback!" : "We'll do better",
        description: isPositive 
          ? "This helps improve future edits" 
          : "Your feedback helps us learn",
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/feedback/metrics"] });
      setHasSubmitted(true);
      onRatingSubmitted?.();
    } catch (error: any) {
      console.error("Rating error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDetailedRating = async () => {
    if (rating === null) return;
    
    setIsSubmitting(true);
    try {
      await apiRequest("POST", "/api/feedback/rate", {
        projectId,
        generatedVideoId: videoId,
        rating,
        videoCategory,
        feedbackText: feedback || undefined,
      });
      
      toast({
        title: "Feedback submitted!",
        description: "Thanks for helping improve our editing",
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/feedback/metrics"] });
      setHasSubmitted(true);
      onRatingSubmitted?.();
    } catch (error: any) {
      console.error("Rating error:", error);
      toast({
        title: "Failed to submit",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (hasSubmitted) {
    return (
      <div 
        className="flex items-center gap-2 text-sm text-muted-foreground"
        data-testid="rating-submitted"
      >
        <ThumbsUp className="h-4 w-4" />
        <span>Thanks for your feedback!</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2" data-testid="video-rating-compact">
        <span className="text-xs text-muted-foreground">Rate this edit:</span>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => handleQuickRating(true)}
          disabled={isSubmitting}
          data-testid="button-thumbs-up"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ThumbsUp className="h-4 w-4" />
          )}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => handleQuickRating(false)}
          disabled={isSubmitting}
          data-testid="button-thumbs-down"
        >
          <ThumbsDown className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div 
      className="space-y-3 p-4 border rounded-lg bg-muted/30"
      data-testid="video-rating"
    >
      <div className="text-sm font-medium">How was this edit?</div>
      
      <div className="flex items-center gap-1" data-testid="star-rating">
        {[1, 2, 3, 4, 5].map((star) => (
          <Button
            key={star}
            size="icon"
            variant="ghost"
            className={`h-8 w-8 ${rating && rating >= star ? "text-yellow-500" : "text-muted-foreground"}`}
            onClick={() => setRating(star)}
            disabled={isSubmitting}
            data-testid={`button-star-${star}`}
          >
            <Star 
              className="h-5 w-5" 
              fill={rating && rating >= star ? "currentColor" : "none"} 
            />
          </Button>
        ))}
        {rating && (
          <span className="ml-2 text-sm text-muted-foreground">
            {rating === 5 && "Amazing!"}
            {rating === 4 && "Great"}
            {rating === 3 && "Okay"}
            {rating === 2 && "Needs work"}
            {rating === 1 && "Not good"}
          </span>
        )}
      </div>

      <Textarea
        placeholder="Optional: Tell us what could be better..."
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        className="min-h-[60px] text-sm"
        disabled={isSubmitting}
        data-testid="input-feedback-text"
      />

      <Button
        onClick={handleDetailedRating}
        disabled={rating === null || isSubmitting}
        className="w-full"
        data-testid="button-submit-rating"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />
            Submit Feedback
          </>
        )}
      </Button>
    </div>
  );
}
