
import { useState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Sparkles, Coins } from "lucide-react";

interface TrialBannerProps {
  daysRemaining: number;
  creditsRemaining?: number;
  onUpgrade: () => void;
  onBuyCredits?: () => void;
}

export function TrialBanner({ daysRemaining, creditsRemaining = 0, onUpgrade, onBuyCredits }: TrialBannerProps) {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible || daysRemaining <= 0) return null;

  const urgencyColor = daysRemaining <= 7 ? 'destructive' : daysRemaining <= 14 ? 'default' : 'default';
  const lowCredits = creditsRemaining < 50;

  return (
    <Alert variant={urgencyColor} className="mb-6">
      <Clock className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4 flex-wrap">
          <span>
            <strong>{daysRemaining} days left</strong> in your free trial. 
            {daysRemaining <= 7 && " Upgrade now to keep your projects!"}
          </span>
          {creditsRemaining !== undefined && (
            <Badge variant={lowCredits ? "destructive" : "secondary"} className="gap-1">
              <Coins className="h-3 w-3" />
              {creditsRemaining} credits
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          {onBuyCredits && lowCredits && (
            <Button size="sm" variant="outline" onClick={onBuyCredits}>
              <Coins className="h-4 w-4 mr-2" />
              Buy Credits
            </Button>
          )}
          <Button size="sm" onClick={onUpgrade}>
            <Sparkles className="h-4 w-4 mr-2" />
            Upgrade Now
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setIsVisible(false)}>
            Dismiss
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
