
import { Badge } from "@/components/ui/badge";
import { Zap, Clock } from "lucide-react";

interface SpeedIndicatorProps {
  stage: string;
  estimatedTime: number;
  elapsedTime: number;
}

export function SpeedIndicator({ stage, estimatedTime, elapsedTime }: SpeedIndicatorProps) {
  const percentComplete = Math.min((elapsedTime / estimatedTime) * 100, 100);
  const isAheadOfSchedule = elapsedTime < estimatedTime * 0.8;
  
  return (
    <div className="flex items-center gap-2 text-xs">
      <Badge 
        variant={isAheadOfSchedule ? "default" : "secondary"}
        className={isAheadOfSchedule ? "bg-green-600" : ""}
      >
        {isAheadOfSchedule ? (
          <>
            <Zap className="h-3 w-3 mr-1" />
            Fast Mode
          </>
        ) : (
          <>
            <Clock className="h-3 w-3 mr-1" />
            Processing
          </>
        )}
      </Badge>
      <span className="text-muted-foreground">
        {elapsedTime.toFixed(1)}s / ~{estimatedTime.toFixed(0)}s
      </span>
    </div>
  );
}
