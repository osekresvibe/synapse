import { useEffect, useState } from "react";
import { WifiOff, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ConnectionMonitor() {
  const [showReconnectPrompt, setShowReconnectPrompt] = useState(false);
  const [disconnectedTime, setDisconnectedTime] = useState<number | null>(null);

  useEffect(() => {
    // Only show reconnect prompt after sustained disconnection (30+ seconds)
    // This prevents interrupting short blips and uploads
    let disconnectTimeout: NodeJS.Timeout | null = null;

    const handleOffline = () => {
      setDisconnectedTime(Date.now());
      // Wait 30 seconds before showing the prompt
      disconnectTimeout = setTimeout(() => {
        setShowReconnectPrompt(true);
      }, 30000);
    };

    const handleOnline = () => {
      if (disconnectTimeout) {
        clearTimeout(disconnectTimeout);
      }
      setShowReconnectPrompt(false);
      setDisconnectedTime(null);
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      if (disconnectTimeout) clearTimeout(disconnectTimeout);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (!showReconnectPrompt) {
    return null;
  }

  return (
    <div
      data-testid="connection-banner"
      className="fixed top-0 left-0 right-0 bg-destructive/90 text-destructive-foreground backdrop-blur-sm z-50"
    >
      <div className="flex items-center justify-between gap-4 px-4 py-3 max-w-screen-xl mx-auto">
        <div className="flex items-center gap-3">
          <WifiOff className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-sm">Connection Lost</p>
            <p className="text-xs opacity-90">
              Long connection loss detected. You can refresh to reconnect.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => window.location.reload()}
          className="flex-shrink-0 gap-2"
          data-testid="button-reconnect"
        >
          <RotateCcw className="w-4 h-4" />
          Refresh
        </Button>
      </div>
    </div>
  );
}
