import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Clock, Play, Trash2, Video, FileVideo, Images, Film, Sparkles, RefreshCw, Copy, AlertTriangle, Info, Zap, Archive, CheckCircle2, Layers, X } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DEFAULT_PROJECT_LIMIT = 20;
const EXTENDED_PROJECT_LIMIT = 40;

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

interface PreviousUpload {
  id: string;
  name: string;
  sourceVideoPath: string | null;
  thumbnailPath: string | null;
  duration: number | null;
  createdAt: string;
  projectType?: string;
  userIntent?: string;
  status?: string;
  isLegacy?: boolean; // True if project was created before recent updates
}

interface PreviousUploadsProps {
  onSelect: (projectId: string) => Promise<void> | void;
  onCreateCompilation?: (projectIds: string[]) => Promise<void> | void;
}

export function PreviousUploads({ onSelect, onCreateCompilation }: PreviousUploadsProps) {
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [showProjectLimitWarning, setShowProjectLimitWarning] = useState(false);
  const [hasExtendedLimit, setHasExtendedLimit] = useState(false);
  const [hasSeenLimitWarning, setHasSeenLimitWarning] = useState(false);
  const currentProjectLimit = hasExtendedLimit ? EXTENDED_PROJECT_LIMIT : DEFAULT_PROJECT_LIMIT;
  
  // Multi-select state for compilation projects
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());

  const toggleProjectSelection = useCallback((projectId: string) => {
    setSelectedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        if (newSet.size < 10) { // Max 10 videos in a compilation
          newSet.add(projectId);
        } else {
          toast({
            title: "Maximum Selection Reached",
            description: "You can select up to 10 videos for a compilation.",
            variant: "destructive",
          });
        }
      }
      return newSet;
    });
  }, [toast]);

  const clearSelection = useCallback(() => {
    setSelectedProjects(new Set());
    setIsMultiSelectMode(false);
  }, []);

  const { data: uploads, isLoading } = useQuery<PreviousUpload[]>({
    queryKey: ["/api/projects/previous-uploads"],
    // Uses default queryFn from queryClient which automatically fetches from queryKey URL
  });

  // Show warning when approaching or exceeding limit (only once per session)
  useEffect(() => {
    if (uploads && uploads.length >= DEFAULT_PROJECT_LIMIT && !hasExtendedLimit && !hasSeenLimitWarning) {
      setShowProjectLimitWarning(true);
      setHasSeenLimitWarning(true);
    }
  }, [uploads, hasExtendedLimit, hasSeenLimitWarning]);

  const deleteMutation = useMutation({
    mutationFn: async (projectId: string) => {
      await apiRequest("DELETE", `/api/projects/${projectId}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Project deleted successfully",
      });
      // Invalidate and refetch previous uploads
      queryClient.invalidateQueries({ queryKey: ["/api/projects/previous-uploads"] });
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete project",
        variant: "destructive",
      });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const response = await apiRequest("POST", `/api/projects/${projectId}/duplicate`);
      return response;
    },
    onSuccess: (data: any) => {
      toast({
        title: "✅ Project Duplicated",
        description: `"${data.duplicateProject.name}" is ready to edit`,
      });
      // Invalidate and refetch previous uploads
      queryClient.invalidateQueries({ queryKey: ["/api/projects/previous-uploads"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to duplicate project",
        variant: "destructive",
      });
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const response = await apiRequest("POST", `/api/projects/${projectId}/retry`);
      return response;
    },
    onSuccess: (data: any) => {
      toast({
        title: "✅ Project Reset",
        description: `Project has been reset (cleared ${data.deletedSlices || 0} slices, ${data.deletedVideos || 0} videos). Click "Continue Editing" to start fresh.`,
      });
      // Refresh the list to show updated status
      queryClient.invalidateQueries({ queryKey: ["/api/projects/previous-uploads"] });
      // Do NOT auto-navigate - let user click Continue Editing after seeing the reset
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reset project",
        variant: "destructive",
      });
    },
  });

  const handleDeleteClick = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    setProjectToDelete(projectId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (projectToDelete) {
      deleteMutation.mutate(projectToDelete);
    }
  };

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/projects/previous-uploads"] });
    toast({
      title: "Refreshing...",
      description: "Project list updated",
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 border border-border/30 rounded-lg bg-card/50 backdrop-blur-sm">
        <p className="text-sm text-muted-foreground">Loading project history...</p>
      </div>
    );
  }

  if (!uploads || uploads.length === 0) {
    return (
      <div className="p-6 border border-border/30 rounded-lg bg-card/50 backdrop-blur-sm text-center">
        <p className="text-sm text-muted-foreground">No previous projects yet</p>
      </div>
    );
  }

  // Categorize projects
  const videoProjects = uploads.filter(u => !u.projectType || u.projectType === "video");
  const aiVideoProjects = uploads.filter(u => u.projectType === "ai-video");
  const carouselProjects = uploads.filter(u => u.projectType === "carousel");

  // Track thumbnail load errors per project
  const [thumbnailErrors, setThumbnailErrors] = useState<Set<string>>(new Set());
  
  const handleThumbnailError = (projectId: string) => {
    setThumbnailErrors(prev => new Set([...prev, projectId]));
  };

  const renderProjectCard = (upload: PreviousUpload) => {
    // Check if we have a valid thumbnail (and it hasn't errored)
    const hasThumbnail = upload.thumbnailPath && 
      !upload.thumbnailPath.includes("undefined") && 
      !thumbnailErrors.has(upload.id);
    
    const getIcon = () => {
      // Show processing indicator if still analyzing
      if (upload.status === "analyzing" || upload.status === "processing") {
        return <div className="h-16 w-16 flex items-center justify-center"><div className="h-8 w-8 border-2 border-primary border-t-primary/30 rounded-full animate-spin" /></div>;
      }
      if (upload.projectType === "ai-video") return <Sparkles className="h-16 w-16 text-primary/60 group-hover:text-primary/80 transition-colors" />;
      if (upload.projectType === "carousel") return <Images className="h-16 w-16 text-primary/60 group-hover:text-primary/80 transition-colors" />;
      return <Play className="h-16 w-16 text-primary/60 group-hover:text-primary/80 transition-colors" />;
    };

    const getGradient = () => {
      if (upload.status === "analyzing" || upload.status === "processing") return "from-purple-500/20 to-blue-500/5";
      if (upload.projectType === "ai-video") return "from-purple-500/20 to-pink-500/5";
      if (upload.projectType === "carousel") return "from-blue-500/20 to-cyan-500/5";
      return "from-purple-500/10 to-blue-500/5";
    };

    const getBadgeInfo = () => {
      if (upload.status === "analyzing" || upload.status === "processing") {
        return { label: "Processing...", variant: "secondary" as const, icon: <RefreshCw className="h-3 w-3 animate-spin" />, isStuck: true };
      }
      if (upload.status === "pending" && upload.sourceVideoPath) {
        return { label: "Ready to Edit", variant: "outline" as const, icon: <Film className="h-3 w-3" />, isStuck: false };
      }
      if (upload.projectType === "ai-video") {
        return { label: "AI Generated", variant: "default" as const, icon: <Sparkles className="h-3 w-3" />, isStuck: false };
      }
      if (upload.projectType === "carousel") {
        return { label: "Carousel Video", variant: "secondary" as const, icon: <Images className="h-3 w-3" />, isStuck: false };
      }
      if (upload.status === "ready" && upload.userIntent) {
        return { label: "Edited Video", variant: "outline" as const, icon: <Film className="h-3 w-3" />, isStuck: false };
      }
      return { label: "Original Upload", variant: "outline" as const, icon: <FileVideo className="h-3 w-3" />, isStuck: false };
    };

    const badgeInfo = getBadgeInfo();
    const isSelected = selectedProjects.has(upload.id);
    const canBeSelected = upload.sourceVideoPath && upload.projectType !== "carousel" && upload.projectType !== "ai-video";

    return (
      <div
        key={upload.id}
        className={`overflow-hidden rounded-xl border border-border/30 bg-card/50 hover:border-border/50 cursor-pointer transition-all group ${
          isMultiSelectMode && isSelected ? 'ring-2 ring-purple-500 ring-offset-2 ring-offset-background' : ''
        }`}
        onClick={async () => {
          if (isMultiSelectMode && canBeSelected) {
            toggleProjectSelection(upload.id);
          } else if (!isMultiSelectMode) {
            await onSelect(upload.id);
          }
        }}
        data-testid={`card-previous-upload-${upload.id}`}
      >
        <div className="aspect-video bg-card/80 flex items-center justify-center relative overflow-hidden border-b border-border/20">
          {/* Show thumbnail if available, otherwise show dark placeholder */}
          {hasThumbnail ? (
            <img 
              src={upload.thumbnailPath!} 
              alt={upload.name}
              className="w-full h-full object-cover"
              onError={() => handleThumbnailError(upload.id)}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-card to-muted/20" />
          )}
          {/* Duration badge */}
          {upload.duration && (
            <div className="absolute bottom-2 right-2">
              <span className="text-xs bg-black/70 text-white px-2 py-1 rounded">
                {Math.floor(upload.duration / 60)}:{String(upload.duration % 60).padStart(2, '0')}
              </span>
            </div>
          )}
          {/* Multi-select checkbox overlay */}
          {isMultiSelectMode && canBeSelected && (
            <div className={`absolute inset-0 flex items-center justify-center transition-all ${
              isSelected ? 'bg-purple-500/30' : 'bg-black/10 group-hover:bg-black/20'
            }`}>
              <div className={`h-10 w-10 rounded-full flex items-center justify-center transition-all ${
                isSelected ? 'bg-purple-500 text-white' : 'bg-background/80 border-2 border-muted-foreground/50'
              }`}>
                {isSelected && <CheckCircle2 className="h-6 w-6" />}
              </div>
            </div>
          )}
          {/* Non-selectable overlay in multi-select mode */}
          {isMultiSelectMode && !canBeSelected && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <span className="text-xs text-white bg-black/60 px-2 py-1 rounded">Not available</span>
            </div>
          )}
        </div>
        <div className="p-4 space-y-2">
          <h3 className="font-medium text-foreground line-clamp-1" title={upload.name}>
            {upload.name}
          </h3>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Edited {formatRelativeTime(upload.createdAt)}
            </span>
            <Badge variant="outline" className="text-cyan-400 border-cyan-400/30 text-[10px]">
              {upload.userIntent?.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Hype Reel'}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Retry button for stuck processing projects */}
            {(upload.status === "analyzing" || upload.status === "processing") ? (
              <Button
                size="sm"
                className="flex-1"
                variant="outline"
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  retryMutation.mutate(upload.id);
                }}
                disabled={retryMutation.isPending}
                data-testid={`button-retry-${upload.id}`}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                {retryMutation.isPending ? "Resetting..." : "Retry"}
              </Button>
            ) : (
              <Button
                size="sm"
                className="flex-1"
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log("[PreviousUploads] Continue Editing clicked for project:", upload.id);
                  try {
                    await onSelect(upload.id);
                    console.log("[PreviousUploads] Successfully called onSelect for:", upload.id);
                  } catch (error) {
                    console.error("[PreviousUploads] Failed to load project:", error);
                  }
                }}
                disabled={!upload.sourceVideoPath}
                data-testid={`button-continue-editing-${upload.id}`}
              >
                {upload.sourceVideoPath ? "Continue Editing" : "Incomplete"}
              </Button>
            )}
            <Button
              size="sm"
              variant={upload.isLegacy ? "default" : "outline"}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                duplicateMutation.mutate(upload.id);
              }}
              disabled={duplicateMutation.isPending || !upload.sourceVideoPath}
              title={upload.isLegacy 
                ? "Reprocess with latest features and updates" 
                : (upload.sourceVideoPath ? "Create a copy of this project with the same video" : "Video not fully uploaded")}
              data-testid={`button-duplicate-${upload.id}`}
            >
              {upload.isLegacy ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Update
                </>
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={(e) => handleDeleteClick(e, upload.id)}
              disabled={deleteMutation.isPending}
              data-testid={`button-delete-${upload.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold">Project History</h2>
          <p className="text-muted-foreground">
            Organized by project type for easy access
          </p>
        </div>
        <div className="flex justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            data-testid="button-refresh-projects"
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button
            size="sm"
            variant={isMultiSelectMode ? "default" : "outline"}
            onClick={() => {
              if (isMultiSelectMode) {
                clearSelection();
              } else {
                setIsMultiSelectMode(true);
              }
            }}
            data-testid="button-toggle-multiselect"
            className="gap-2"
          >
            <Layers className="h-4 w-4" />
            {isMultiSelectMode ? "Cancel Selection" : "Combine Videos"}
          </Button>
        </div>
      </div>

      {/* Multi-select selection tray */}
      {isMultiSelectMode && (
        <div className="sticky top-0 z-50 p-4 rounded-lg border bg-card shadow-lg">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Layers className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold">
                  {selectedProjects.size === 0 
                    ? "Select videos to combine" 
                    : `${selectedProjects.size} video${selectedProjects.size > 1 ? 's' : ''} selected`
                  }
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedProjects.size === 0 
                    ? "Click on video projects to select them (max 10)"
                    : (() => {
                        const totalDuration = uploads
                          ?.filter(u => selectedProjects.has(u.id))
                          .reduce((sum, u) => sum + (u.duration || 0), 0) || 0;
                        const mins = Math.floor(totalDuration / 60);
                        const secs = totalDuration % 60;
                        return `Total duration: ${mins > 0 ? `${mins}m ` : ''}${secs}s`;
                      })()
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedProjects.size > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedProjects(new Set())}
                  data-testid="button-clear-selection"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
              <Button
                size="sm"
                disabled={selectedProjects.size < 2}
                onClick={async () => {
                  if (onCreateCompilation && selectedProjects.size >= 2) {
                    await onCreateCompilation(Array.from(selectedProjects));
                    clearSelection();
                  } else if (selectedProjects.size < 2) {
                    toast({
                      title: "Select More Videos",
                      description: "You need at least 2 videos to create a compilation.",
                    });
                  }
                }}
                data-testid="button-create-compilation"
                className="gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Create Compilation ({selectedProjects.size}/10)
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Legacy projects notice */}
      {uploads.some(u => u.isLegacy) && (
        <div className="p-4 rounded-lg border bg-yellow-500/10 border-yellow-500/30 flex items-start gap-3">
          <Info className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-yellow-600 dark:text-yellow-400">
              Some Projects Are From an Older Version
            </p>
            <p className="text-sm text-muted-foreground">
              Projects marked "Older Version" were created before recent updates. They may not have all the latest features like thumbnails or AI improvements. 
              You can still use them, or use the duplicate button to create a fresh copy with new processing.
            </p>
          </div>
        </div>
      )}

      {/* Storage limit notice */}
      {uploads.length >= 18 && (
        <div className={`p-4 rounded-lg border flex items-start gap-3 ${
          uploads.length >= 20 
            ? 'bg-destructive/10 border-destructive/30' 
            : 'bg-yellow-500/10 border-yellow-500/30'
        }`}>
          {uploads.length >= 20 ? (
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          ) : (
            <Info className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          )}
          <div className="space-y-1">
            <p className={`font-medium ${uploads.length >= 20 ? 'text-destructive' : 'text-yellow-600 dark:text-yellow-400'}`}>
              {uploads.length >= 20 
                ? 'Storage Limit Reached' 
                : `Almost at Storage Limit (${uploads.length}/20)`
              }
            </p>
            <p className="text-sm text-muted-foreground">
              {uploads.length >= 20 
                ? 'You have reached the maximum of 20 projects. Delete older projects to make room for new uploads.'
                : 'You are approaching the 20 project limit. Consider deleting old projects to free up space.'
              }
            </p>
          </div>
        </div>
      )}

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">
            All ({uploads.length}/20)
          </TabsTrigger>
          <TabsTrigger value="videos">
            <FileVideo className="h-4 w-4 mr-2" />
            Videos ({videoProjects.length})
          </TabsTrigger>
          <TabsTrigger value="ai-videos">
            <Sparkles className="h-4 w-4 mr-2" />
            AI Videos ({aiVideoProjects.length})
          </TabsTrigger>
          <TabsTrigger value="carousels">
            <Images className="h-4 w-4 mr-2" />
            Carousels ({carouselProjects.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {uploads.map(renderProjectCard)}
          </div>
        </TabsContent>

        <TabsContent value="videos" className="mt-6">
          {videoProjects.length === 0 ? (
            <div className="p-6 border rounded-lg bg-card text-center">
              <FileVideo className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No manually edited videos yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {videoProjects.map(renderProjectCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="ai-videos" className="mt-6">
          {aiVideoProjects.length === 0 ? (
            <div className="p-6 border rounded-lg bg-card text-center">
              <Sparkles className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No AI-generated videos yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {aiVideoProjects.map(renderProjectCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="carousels" className="mt-6">
          {carouselProjects.length === 0 ? (
            <div className="p-6 border rounded-lg bg-card text-center">
              <Images className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No carousel videos yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {carouselProjects.map(renderProjectCard)}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this project? This will permanently remove the project and all its generated videos from your storage. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Project Limit Warning Dialog with Time Credits */}
      <Dialog open={showProjectLimitWarning} onOpenChange={setShowProjectLimitWarning}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5 text-amber-500" />
              Project Storage Limit
            </DialogTitle>
            <DialogDescription>
              You have {uploads?.length || 0} projects, reaching the {DEFAULT_PROJECT_LIMIT}-project limit.
              Extend your storage using <strong>time credits</strong> instead of payment.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 my-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Current limit</span>
                <Badge variant="secondary">{DEFAULT_PROJECT_LIMIT} projects</Badge>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Your projects</span>
                <Badge variant="outline" className={uploads && uploads.length >= DEFAULT_PROJECT_LIMIT ? "text-amber-600 border-amber-300" : ""}>
                  {uploads?.length || 0} projects
                </Badge>
              </div>
              <Separator className="my-3" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Extended limit</span>
                <Badge className="bg-indigo-600">{EXTENDED_PROJECT_LIMIT} projects</Badge>
              </div>
            </div>

            {/* Options section */}
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Choose how to proceed:</p>
              <div className="flex items-start gap-3 p-3 border rounded-lg">
                <Trash2 className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Delete old projects</p>
                  <p className="text-xs text-muted-foreground">Free up space by removing projects you no longer need</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 border rounded-lg border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30">
                <Zap className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-indigo-900 dark:text-indigo-100">Use time credits</p>
                  <p className="text-xs text-indigo-700 dark:text-indigo-300">
                    Extend to {EXTENDED_PROJECT_LIMIT} projects. May adjust your renewal by 1-2 days. <strong>No payment required.</strong>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowProjectLimitWarning(false);
              }}
              className="flex flex-col h-auto py-3"
              data-testid="button-manage-projects"
            >
              <Trash2 className="h-5 w-5 mb-1" />
              <span className="text-sm font-medium">Manage Projects</span>
              <span className="text-xs text-muted-foreground">Delete some</span>
            </Button>
            <Button 
              onClick={() => {
                setHasExtendedLimit(true);
                setShowProjectLimitWarning(false);
                toast({
                  title: "Storage Extended",
                  description: `You can now keep up to ${EXTENDED_PROJECT_LIMIT} projects using time credits`,
                });
              }}
              className="flex flex-col h-auto py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
              data-testid="button-extend-storage"
            >
              <Zap className="h-5 w-5 mb-1" />
              <span className="text-sm font-medium">Extend Storage</span>
              <span className="text-xs opacity-80">Use time credits</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}