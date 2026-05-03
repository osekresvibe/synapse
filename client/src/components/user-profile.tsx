
import { useState, useEffect } from "react";
import { User, updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User as UserIcon, Mail, Calendar, Save } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

interface UserProfileProps {
  user: User;
  onClose?: () => void;
}

export function UserProfile({ user, onClose }: UserProfileProps) {
  const [displayName, setDisplayName] = useState(user.displayName || "");
  const [photoURL, setPhotoURL] = useState(user.photoURL || "");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setDisplayName(user.displayName || "");
    setPhotoURL(user.photoURL || "");
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await updateProfile(user, {
        displayName: displayName || null,
        photoURL: photoURL || null,
      });

      toast({
        title: "✅ Profile Updated",
        description: "Your profile has been updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "❌ Update Failed",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getInitials = () => {
    if (displayName) {
      return displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return user.email?.[0].toUpperCase() || "U";
  };

  const formatDate = (timestamp: string | null) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>User Profile</CardTitle>
            <CardDescription>Manage your account information</CardDescription>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Profile Avatar */}
        <div className="flex items-center space-x-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src={photoURL} alt={displayName || "User"} />
            <AvatarFallback className="text-2xl">{getInitials()}</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="text-lg font-semibold">{displayName || "Anonymous User"}</h3>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <Separator />

        {/* Account Information */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <UserIcon className="h-4 w-4" />
            Account Information
          </h4>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4" />
                  {user.email}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Email Verified</Label>
                <div className="text-sm">
                  {user.emailVerified ? (
                    <span className="text-green-600">✓ Verified</span>
                  ) : (
                    <span className="text-amber-600">⚠ Not Verified</span>
                  )}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Account Created</Label>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4" />
                  {formatDate(user.metadata.creationTime || null)}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Last Sign In</Label>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4" />
                  {formatDate(user.metadata.lastSignInTime || null)}
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">User ID</Label>
              <div className="text-xs font-mono bg-muted p-2 rounded">{user.uid}</div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Edit Profile Form */}
        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <h4 className="text-sm font-semibold">Edit Profile</h4>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                placeholder="Enter your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="photoURL">Photo URL</Label>
              <Input
                id="photoURL"
                type="url"
                placeholder="https://example.com/photo.jpg"
                value={photoURL}
                onChange={(e) => setPhotoURL(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Enter a URL to your profile picture
              </p>
            </div>
          </div>
          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
