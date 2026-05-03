
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Download,
  Image as ImageIcon,
  Video as VideoIcon,
  Loader2,
  Play,
  TrendingUp,
} from "lucide-react";

interface StockMediaLibraryProps {
  onMediaSelect?: (url: string, type: "video" | "photo") => void;
}

interface StockMediaLibraryProps {
  onMediaSelect?: (url: string, type: "video" | "photo") => void;
  projectId?: string;
  autoSearchQuery?: string;
}

export function StockMediaLibrary({ onMediaSelect, projectId, autoSearchQuery }: StockMediaLibraryProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState(autoSearchQuery || "");
  const [activeTab, setActiveTab] = useState<"videos" | "photos">("videos");
  const [currentPage, setCurrentPage] = useState(1);

  // Auto-trigger search if autoSearchQuery is provided
  useEffect(() => {
    if (autoSearchQuery && autoSearchQuery !== searchQuery) {
      setSearchQuery(autoSearchQuery);
    }
  }, [autoSearchQuery]);

  // Search videos
  const { data: videoResults, isLoading: videosLoading } = useQuery({
    queryKey: ["/api/pexels/videos/search", searchQuery, currentPage],
    queryFn: async () => {
      if (!searchQuery) return null;
      const response = await fetch(
        `/api/pexels/videos/search?query=${encodeURIComponent(searchQuery)}&page=${currentPage}&perPage=12`
      );
      if (!response.ok) throw new Error("Failed to search videos");
      return response.json();
    },
    enabled: !!searchQuery && activeTab === "videos",
  });

  // Search photos
  const { data: photoResults, isLoading: photosLoading } = useQuery({
    queryKey: ["/api/pexels/photos/search", searchQuery, currentPage],
    queryFn: async () => {
      if (!searchQuery) return null;
      const response = await fetch(
        `/api/pexels/photos/search?query=${encodeURIComponent(searchQuery)}&page=${currentPage}&perPage=12`
      );
      if (!response.ok) throw new Error("Failed to search photos");
      return response.json();
    },
    enabled: !!searchQuery && activeTab === "photos",
  });

  // Popular videos (default view)
  const { data: popularVideos, isLoading: popularLoading } = useQuery({
    queryKey: ["/api/pexels/videos/popular", currentPage],
    queryFn: async () => {
      const response = await fetch(`/api/pexels/videos/popular?page=${currentPage}&perPage=12`);
      if (!response.ok) throw new Error("Failed to fetch popular videos");
      return response.json();
    },
    enabled: !searchQuery && activeTab === "videos",
  });

  // Download mutation
  const downloadMutation = useMutation({
    mutationFn: async ({ url, type }: { url: string; type: "video" | "photo" }) => {
      const response = await fetch("/api/pexels/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, type }),
      });
      if (!response.ok) throw new Error("Download failed");
      return response.json();
    },
    onSuccess: (data, variables) => {
      toast({
        title: "✅ Downloaded",
        description: `Stock ${variables.type} added to your project`,
      });
      if (onMediaSelect) {
        onMediaSelect(data.localPath, variables.type);
      }
    },
    onError: () => {
      toast({
        title: "❌ Download Failed",
        description: "Could not download media. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
  };

  const handleDownload = (url: string, type: "video" | "photo") => {
    downloadMutation.mutate({ url, type });
  };

  const videos = searchQuery ? videoResults?.videos : popularVideos?.videos;
  const photos = photoResults?.photos;
  const isLoading = videosLoading || photosLoading || popularLoading;

  return (
    <div className="space-y-3">
      <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg mb-3">
        <div className="flex items-start gap-2">
          <Lightbulb className="h-3 w-3 mt-0.5 text-blue-500 shrink-0" />
          <p className="text-xs text-blue-600 dark:text-blue-400">
            <strong>Post-Production Enhancement:</strong> Stock media is added during editing, not during initial video generation.
          </p>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs text-muted-foreground">Powered by Pexels</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search for videos or photos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button type="submit" disabled={!searchQuery}>
          Search
        </Button>
      </form>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "videos" | "photos")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="videos" className="gap-1 text-xs">
            <VideoIcon className="h-3 w-3" />
            Videos
          </TabsTrigger>
          <TabsTrigger value="photos" className="gap-1 text-xs">
            <ImageIcon className="h-3 w-3" />
            Photos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="videos" className="mt-4">
          {!searchQuery && (
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Popular Videos</span>
            </div>
          )}
          
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : videos && videos.length > 0 ? (
            <ScrollArea className="h-[300px]">
              <div className="grid grid-cols-1 gap-2">
                {videos.map((video: any) => (
                  <div key={video.id} className="relative group">
                    <div className="aspect-[9/16] rounded-lg overflow-hidden bg-muted">
                      <img
                        src={video.image}
                        alt="Video thumbnail"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play className="h-8 w-8 text-white" />
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity gap-1"
                      onClick={() => {
                        const hdFile = video.video_files.find((f: any) => f.quality === "hd");
                        const fileUrl = hdFile?.link || video.video_files[0]?.link;
                        if (fileUrl) handleDownload(fileUrl, "video");
                      }}
                      disabled={downloadMutation.isPending}
                    >
                      {downloadMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Download className="h-3 w-3" />
                      )}
                      Use
                    </Button>
                    <Badge variant="secondary" className="absolute top-2 left-2 text-xs">
                      {video.duration}s
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              {searchQuery ? "No videos found" : "Search for videos to get started"}
            </div>
          )}
        </TabsContent>

        <TabsContent value="photos" className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : photos && photos.length > 0 ? (
            <ScrollArea className="h-[300px]">
              <div className="grid grid-cols-2 gap-2">
                {photos.map((photo: any) => (
                  <div key={photo.id} className="relative group">
                    <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                      <img
                        src={photo.src.medium}
                        alt={photo.photographer}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <Button
                      size="sm"
                      className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity gap-1"
                      onClick={() => handleDownload(photo.src.large, "photo")}
                      disabled={downloadMutation.isPending}
                    >
                      {downloadMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Download className="h-3 w-3" />
                      )}
                      Use
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              {searchQuery ? "No photos found" : "Search for photos to get started"}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {searchQuery && (videos?.length > 0 || photos?.length > 0) && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {currentPage}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
