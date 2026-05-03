
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Info, Zap, Calendar, CheckCircle } from "lucide-react";

interface ProcessingCreditPreviewProps {
  fileSizeGB: number;
  videoDurationMinutes: number;
  operation: 'compression' | 'conversion' | 'both';
  quality?: 'low' | 'medium' | 'high';
  fromFormat?: string;
  toFormat?: string;
  currentRenewalDate: Date;
  onAccept: () => void;
  onCancel: () => void;
}

export function ProcessingCreditPreview({
  fileSizeGB,
  videoDurationMinutes,
  operation,
  quality = 'medium',
  fromFormat,
  toFormat,
  currentRenewalDate,
  onAccept,
  onCancel
}: ProcessingCreditPreviewProps) {
  // Mock calculation - in real app, call API endpoint
  const calculateCost = () => {
    if (operation === 'compression') {
      const baseCost = fileSizeGB * 15;
      const multipliers = { low: 0.5, medium: 1.0, high: 1.5 };
      return Math.ceil(baseCost * multipliers[quality]);
    } else if (operation === 'conversion') {
      return Math.ceil(videoDurationMinutes * 0.5);
    } else {
      return Math.ceil((fileSizeGB * 15 + videoDurationMinutes * 0.5) * 1.3);
    }
  };

  const minutesCost = calculateCost();
  const newRenewalDate = new Date(currentRenewalDate);
  newRenewalDate.setMinutes(newRenewalDate.getMinutes() - minutesCost);

  const daysReduced = Math.floor(minutesCost / 1440);
  const hoursReduced = Math.floor((minutesCost % 1440) / 60);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Zap className="h-5 w-5 text-yellow-500" />
        <h3 className="font-semibold">Processing Credit Cost</h3>
      </div>

      <Alert className="border-blue-200 bg-blue-50">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-900">
          This operation will consume processing credits from your subscription period.
        </AlertDescription>
      </Alert>

      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">File Size:</span>
          <span className="font-medium">{fileSizeGB.toFixed(2)} GB</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Video Duration:</span>
          <span className="font-medium">{videoDurationMinutes.toFixed(1)} minutes</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Operation:</span>
          <Badge variant="secondary" className="capitalize">{operation}</Badge>
        </div>
        {quality && operation !== 'conversion' && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Quality:</span>
            <Badge variant="outline" className="capitalize">{quality}</Badge>
          </div>
        )}
      </div>

      <div className="border-t pt-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="font-medium">Time Cost:</span>
          <div className="text-right">
            <div className="font-bold text-lg">
              {daysReduced > 0 && `${daysReduced}d `}
              {hoursReduced > 0 && `${hoursReduced}h `}
              {minutesCost % 60 > 0 && `${minutesCost % 60}m`}
            </div>
            <div className="text-xs text-muted-foreground">{minutesCost} minutes</div>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            Current Renewal:
          </span>
          <span className="font-medium">{formatDate(currentRenewalDate)}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            New Renewal:
          </span>
          <span className="font-bold text-primary">{formatDate(newRenewalDate)}</span>
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <Button onClick={onCancel} variant="outline" className="flex-1">
          Cancel
        </Button>
        <Button onClick={onAccept} className="flex-1">
          <CheckCircle className="h-4 w-4 mr-2" />
          Accept & Process
        </Button>
      </div>
    </Card>
  );
}
