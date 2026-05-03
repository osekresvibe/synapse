
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, TrendingUp, Info } from "lucide-react";
import { PRICING_TIERS, OVERAGE_PRICING } from "@shared/pricing";

interface UsageTrackerProps {
  subscription: {
    tier: string;
    usage: {
      videosThisMonth: number;
      aiGenerationsThisMonth: number;
      projectsSaved: number;
      storageUsedMB: number;
    };
    overages?: {
      videosThisMonth: number;
      aiGenerationsThisMonth: number;
      storageGB: number;
      projectSlots: number;
    };
    overageCharges?: number;
  };
}

export function UsageTracker({ subscription }: UsageTrackerProps) {
  const tier = PRICING_TIERS[subscription.tier as keyof typeof PRICING_TIERS];
  const limits = tier.limits;

  const getUsagePercent = (used: number, limit: number) => {
    if (limit === -1) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  const getUsageColor = (percent: number) => {
    if (percent >= 90) return "text-destructive";
    if (percent >= 75) return "text-yellow-600";
    return "text-primary";
  };

  const hasOverages = subscription.overages && (
    subscription.overages.videosThisMonth > 0 ||
    subscription.overages.aiGenerationsThisMonth > 0 ||
    subscription.overages.storageGB > 0 ||
    subscription.overages.projectSlots > 0
  );

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Usage This Month</h3>
        {hasOverages && (
          <Badge variant="secondary" className="bg-blue-100 text-blue-700">
            <TrendingUp className="h-3 w-3 mr-1" />
            Pay-as-you-go active
          </Badge>
        )}
      </div>

      {/* Videos */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Videos Generated</span>
          <span className={getUsageColor(getUsagePercent(subscription.usage.videosThisMonth, limits.monthlyVideos))}>
            {subscription.usage.videosThisMonth} / {limits.monthlyVideos === -1 ? '∞' : limits.monthlyVideos}
          </span>
        </div>
        {limits.monthlyVideos !== -1 && (
          <Progress value={getUsagePercent(subscription.usage.videosThisMonth, limits.monthlyVideos)} />
        )}
        {subscription.overages && subscription.overages.videosThisMonth > 0 && (
          <p className="text-xs text-muted-foreground">
            +{subscription.overages.videosThisMonth} overage videos at ${OVERAGE_PRICING.videoGeneration}/each
          </p>
        )}
      </div>

      {/* AI Generations */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">AI Generations</span>
          <span className={getUsageColor(getUsagePercent(subscription.usage.aiGenerationsThisMonth, limits.aiGenerations))}>
            {subscription.usage.aiGenerationsThisMonth} / {limits.aiGenerations === -1 ? '∞' : limits.aiGenerations}
          </span>
        </div>
        {limits.aiGenerations !== -1 && (
          <Progress value={getUsagePercent(subscription.usage.aiGenerationsThisMonth, limits.aiGenerations)} />
        )}
        {subscription.overages && subscription.overages.aiGenerationsThisMonth > 0 && (
          <p className="text-xs text-muted-foreground">
            +{subscription.overages.aiGenerationsThisMonth} overage AI generations at ${OVERAGE_PRICING.aiGeneration}/each
          </p>
        )}
      </div>

      {/* Storage */}
      {limits.storageGB && limits.storageGB !== -1 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Storage Used</span>
            <span className={getUsageColor(getUsagePercent(subscription.usage.storageUsedMB / 1024, limits.storageGB))}>
              {(subscription.usage.storageUsedMB / 1024).toFixed(2)} / {limits.storageGB} GB
            </span>
          </div>
          <Progress value={getUsagePercent(subscription.usage.storageUsedMB / 1024, limits.storageGB)} />
          {subscription.overages && subscription.overages.storageGB > 0 && (
            <p className="text-xs text-muted-foreground">
              +{subscription.overages.storageGB.toFixed(2)}GB overage storage at ${OVERAGE_PRICING.storage}/GB
            </p>
          )}
        </div>
      )}

      {/* Projects */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Projects Saved</span>
          <span className={getUsageColor(getUsagePercent(subscription.usage.projectsSaved, limits.projectSaves))}>
            {subscription.usage.projectsSaved} / {limits.projectSaves === -1 ? '∞' : limits.projectSaves}
          </span>
        </div>
        {limits.projectSaves !== -1 && (
          <Progress value={getUsagePercent(subscription.usage.projectsSaved, limits.projectSaves)} />
        )}
        {subscription.overages && subscription.overages.projectSlots > 0 && (
          <p className="text-xs text-muted-foreground">
            +{subscription.overages.projectSlots} overage project slots at ${OVERAGE_PRICING.projectSave}/each
          </p>
        )}
      </div>

      {/* Overage Alert */}
      {subscription.overageCharges && subscription.overageCharges > 0 && (
        <Alert className="border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-900">
            <strong>Additional usage charges:</strong> ${subscription.overageCharges.toFixed(2)} this month
            <br />
            <span className="text-xs">You'll be billed for overages at the end of your billing cycle.</span>
          </AlertDescription>
        </Alert>
      )}

      {/* Warning when approaching limits */}
      {!hasOverages && (
        <>
          {getUsagePercent(subscription.usage.videosThisMonth, limits.monthlyVideos) >= 90 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                You're approaching your video limit. Additional videos will be charged at ${OVERAGE_PRICING.videoGeneration}/video.
              </AlertDescription>
            </Alert>
          )}
        </>
      )}
    </Card>
  );
}
