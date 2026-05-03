
import { useState, useEffect } from "react";
import { Bell, Download, FileVideo, Clock, CheckCircle2, XCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export interface Notification {
  id: string;
  type: "success" | "error" | "info" | "processing";
  title: string;
  description: string;
  timestamp: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  metadata?: {
    projectId?: string;
    videoPath?: string;
    [key: string]: any;
  };
  read: boolean;
}

const STORAGE_KEY = "replit-notifications";
const MAX_NOTIFICATIONS = 50;

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Load notifications from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setNotifications(parsed);
        updateUnreadCount(parsed);
      }
    } catch (err) {
      console.error("[NotificationCenter] Failed to load notifications:", err);
    }
  }, []);

  // Update unread count
  const updateUnreadCount = (notifs: Notification[]) => {
    const unread = notifs.filter(n => !n.read).length;
    setUnreadCount(unread);
  };

  // Save notifications to localStorage
  const saveNotifications = (notifs: Notification[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifs));
      updateUnreadCount(notifs);
    } catch (err) {
      console.error("[NotificationCenter] Failed to save notifications:", err);
    }
  };

  // Add notification (called from outside)
  const addNotification = (notification: Omit<Notification, "id" | "timestamp" | "read">) => {
    const newNotif: Notification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      read: false,
    };

    setNotifications(prev => {
      const updated = [newNotif, ...prev].slice(0, MAX_NOTIFICATIONS);
      saveNotifications(updated);
      return updated;
    });

    // Play notification sound
    try {
      const audio = new Audio("/notification.mp3");
      audio.volume = 0.3;
      audio.play().catch(() => {}); // Ignore errors if sound fails
    } catch (err) {
      // Ignore audio errors
    }
  };

  // Mark as read
  const markAsRead = (id: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, read: true } : n);
      saveNotifications(updated);
      return updated;
    });
  };

  // Mark all as read
  const markAllAsRead = () => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      saveNotifications(updated);
      return updated;
    });
  };

  // Clear all notifications
  const clearAll = () => {
    setNotifications([]);
    localStorage.removeItem(STORAGE_KEY);
    setUnreadCount(0);
  };

  // Expose addNotification globally for easy access
  useEffect(() => {
    (window as any).addNotification = addNotification;
    return () => {
      delete (window as any).addNotification;
    };
  }, []);

  const getIcon = (type: Notification["type"]) => {
    switch (type) {
      case "success":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "error":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "processing":
        return <Clock className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span>Notifications</span>
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={markAllAsRead}>
                  Mark all read
                </Button>
              )}
              {notifications.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearAll}>
                  Clear all
                </Button>
              )}
            </div>
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-4">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Bell className="h-12 w-12 mb-4 opacity-50" />
              <p>No notifications yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={cn(
                    "p-4 rounded-lg border cursor-pointer transition-colors",
                    notif.read ? "bg-background" : "bg-accent/50",
                    "hover:bg-accent"
                  )}
                  onClick={() => {
                    markAsRead(notif.id);
                    if (notif.action) {
                      notif.action.onClick();
                      setIsOpen(false);
                    }
                  }}
                >
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 mt-1">{getIcon(notif.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-semibold text-sm">{notif.title}</h4>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {formatTime(notif.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {notif.description}
                      </p>
                      {notif.metadata?.videoPath && (
                        <div className="mt-2 flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              const link = document.createElement("a");
                              link.href = notif.metadata!.videoPath!;
                              link.download = notif.metadata!.videoPath!.split("/").pop() || "video.mp4";
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </Button>
                          {notif.metadata?.projectId && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.location.href = `/editor/${notif.metadata!.projectId}`;
                              }}
                            >
                              <FileVideo className="h-3 w-3 mr-1" />
                              View Project
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
