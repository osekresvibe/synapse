import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { VideoInput } from "@/components/youtube-input";
import { ResumableUpload } from "@/components/resumable-upload"; // Single-file uploads for reliability
import { AuthDialog } from "@/components/auth-dialog";
import { auth, signOut, onAuthChange } from "@/lib/firebase";
import type { User } from "firebase/auth";
import { IntentSelector } from "@/components/intent-selector";
import { TriptychPreview } from "@/components/triptych-preview";
import { SmartSlicesTimeline } from "@/components/smart-slices-timeline";
import { ClipPicker } from "@/components/clip-picker";
import { MoodPresets } from "@/components/mood-presets";
import { ReferenceVideoInput } from "@/components/reference-video-input";
import { PacingControls } from "@/components/pacing-controls";
import { VideoPlayer } from "@/components/video-player";
import { ExportControls } from "@/components/export-controls";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Clock,
  Video,
  Sparkles,
  CheckCircle2,
  Upload,
  Settings,
  Scissors,
  GripVertical,
  Wand2,
  Palette,
  Download,
  UserCircle,
  Music,
  X,
  Loader2,
  ArrowLeft,
  FolderOpen,
  Film,
  Zap,
  Globe, // Import Globe icon
} from "lucide-react";
import type {
  Project,
  VideoAnalysisProgress,
  TriptychVideos,
  SmartSlice,
  UserIntent,
  IntentConfig,
} from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { PreviousUploads } from "@/components/previous-uploads";
import { VideoFinalize } from "@/components/video-finalize";
import { FeedbackRefinement } from "@/components/feedback-refinement";
import { StockMediaLibrary } from "@/components/stock-media-library";
import { AudioMixerControls } from "@/components/audio-mixer-controls";
import { SmartRefinement } from "@/components/smart-refinement";
import { TargetedImprovements } from "@/components/targeted-improvements";
import { UserProfile } from "@/components/user-profile";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { TrialBanner } from "@/components/trial-banner";
import { PricingModal } from "@/components/pricing-modal";
import { CompilationWorkspace } from "@/components/compilation-workspace";
import { Input } from "@/components/ui/input";
import { BatchResults } from "@/components/batch-results";
import { ImmersiveProcessing } from "@/components/immersive-processing";
import { FeatureHighlights } from "@/components/feature-highlights";
import { OnboardingTour } from "@/components/onboarding-tour";
import { NotificationCenter } from "@/components/notification-center";

interface VideoPlayerProps {
  videoPath: string;
  title: string;
  subtitle?: string;
}

export default function Home() {
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [showIntentSelector, setShowIntentSelector] = useState(false);
  const [selectedVideoType, setSelectedVideoType] = useState<
    "short" | "standard" | "comprehensive"
  >("standard");
  const [selectedClipIndex, setSelectedClipIndex] = useState(0);
  const [showStoryRemix, setShowStoryRemix] = useState(false);
  const [selectedMood, setSelectedMood] = useState<string | undefined>();
  const [analyzedStyle, setAnalyzedStyle] = useState<{
    cutTempo: number;
    colorProfile: string[];
    transitionTypes: string[];
  } | null>(null);

  const [cutTempo, setCutTempo] = useState<number>(1500);
  const [uploadStep, setUploadStep] = useState<"upload" | "intent" | "processing" | "editing" | "complete">("upload");
  const [showPreviousUploads, setShowPreviousUploads] = useState(false);
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null); // State for current batch ID
  const [showBatchResults, setShowBatchResults] = useState(false); // State to show batch results
  const [batchResults, setBatchResults] = useState<{ batchId: string; projects: Project[] } | null>(null); // State to hold batch results
  const [showFinalization, setShowFinalization] = useState(false); // Added state for finalization UI
  const [showProjectHistory, setShowProjectHistory] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [showAdvancedEditing, setShowAdvancedEditing] = useState(false);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState(30); // TODO: Get from backend
  const [isUploadingActive, setIsUploadingActive] = useState(false);
  const [compilationProjects, setCompilationProjects] = useState<Project[]>([]);
  const [showCompilationWorkspace, setShowCompilationWorkspace] = useState(false);
  const [shareableUrl, setShareableUrl] = useState(""); // State for shareable URL input
  const [videoResults, setVideoResults] = useState<any>(null); // State for video results

  // Audio mixer state
  const [audioTracks, setAudioTracks] = useState<any[]>([]);
  const [audioDucking, setAudioDucking] = useState({ enabled: false, threshold: -24, ratio: 50, attack: 0.1, release: 0.5 });
  const [masterVolume, setMasterVolume] = useState(100);

  // Firebase authentication listener
  useEffect(() => {
    const unsubscribe = onAuthChange((currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        console.log("User logged in:", currentUser.email);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast({
        title: "Sign Out Failed",
        description: error,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Signed Out",
        description: "You have been signed out successfully",
      });
    }
  };

  // Apply finalization mutation
  const applyFinalizationMutation = useMutation({
    mutationFn: async ({ videoId, config }: { videoId: string; config: any }) => {
      return apiRequest("POST", `/api/projects/${currentProject?.id}/videos/${videoId}/finalize`, config);
    },
    onSuccess: (data: any) => {
      toast({
        title: "✅ Video Finalized",
        description: "Your video is ready to download with all finishing touches!",
      });
      if (data.downloadUrl) {
        window.open(data.downloadUrl, '_blank');
      }
    },
  });

  // Fetch project progress (for all processing types including AI video generation)
  const { data: progress } = useQuery<VideoAnalysisProgress>({
    queryKey: currentProject ? [`/api/projects/${currentProject.id}/progress`] : [],
    enabled: !!currentProject && currentProject.status !== "ready" && uploadStep === "processing",
    refetchInterval: 1000,
  });

  // Update project status when progress completes (using useEffect to avoid infinite re-renders)
  useEffect(() => {
    // Show vibe application toast when it starts
    if (progress?.stage === "generating" && progress?.message?.includes("Applying")) {
      toast({
        title: "🎨 Applying Color Grading",
        description: progress.message,
      });
    }

    if ((progress?.stage === "complete" || progress?.progress === 100) && currentProject?.status !== "ready" && currentProject) {
      console.log("Progress complete, updating project status to ready");
      setCurrentProject({ ...currentProject, status: "ready" });
      setUploadStep("editing");

      // Play notification sound
      const audio = new Audio('/notification.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {}); // Ignore errors if file doesn't exist

      // Add to notification center
      if ((window as any).addNotification) {
        (window as any).addNotification({
          type: "success",
          title: `✅ ${1} Video Ready!`, // Placeholder, will be updated below
          description: `Your edited video is ready to download!`, // Placeholder
          metadata: {
            projectId: currentProject?.id,
            videoPath: null, // Placeholder
            videoCount: 1, // Placeholder
          },
        });
      }

      // Request browser notification permission if not granted
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }

      // Auto-scroll to video player after a short delay
      setTimeout(() => {
        const videoPlayerSection = document.querySelector('[data-video-player-section]');
        if (videoPlayerSection) {
          videoPlayerSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500);

      // Fetch videos to get direct links
      queryClient.fetchQuery({
        queryKey: ["/api/projects", currentProject.id, "videos"],
      }).then((videosData: any) => {
        const videoCount = videosData?.multipleClips?.length ||
          (videosData?.short || videosData?.standard || videosData?.comprehensive ? 1 : 0);

        // Get the first video path for direct download
        let firstVideoPath = '';
        if (videosData?.multipleClips && videosData.multipleClips.length > 0) {
          firstVideoPath = videosData.multipleClips[0].videoPath;
        } else if (videosData?.standard) {
          firstVideoPath = videosData.standard.videoPath;
        } else if (videosData?.short) {
          firstVideoPath = videosData.short.videoPath;
        } else if (videosData?.comprehensive) {
          firstVideoPath = videosData.comprehensive.videoPath;
        }

        const title = `✅ ${videoCount} Video${videoCount > 1 ? 's' : ''} Ready!`;
        const description = videoCount > 1
          ? `${videoCount} videos generated. Click to download or view all.`
          : "Your edited video is ready to download!";

        // Update notification center with actual data
        if ((window as any).addNotification) {
          (window as any).addNotification({
            type: "success",
            title,
            description: description,
            metadata: {
              projectId: currentProject?.id,
              videoPath: firstVideoPath,
              videoCount: videoCount,
            },
          });
        }

        // Show success toast with download action
        toast({
          title,
          description: (
            <div className="flex flex-col gap-2">
              <p className="text-sm">{description}</p>
              {firstVideoPath && (
                <p className="text-xs text-muted-foreground font-mono bg-muted/50 px-2 py-1 rounded">
                  {firstVideoPath}
                </p>
              )}
            </div>
          ),
          action: (
            <div className="flex gap-2">
              {firstVideoPath && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = firstVideoPath;
                    link.download = firstVideoPath.split('/').pop() || 'video.mp4';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              )}
              {videoCount > 1 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open('/uploads/videos', '_blank')}
                >
                  📁 View All
                </Button>
              )}
            </div>
          ),
        });

        // Show browser notification with click action
        if ('Notification' in window && Notification.permission === 'granted') {
          const notification = new Notification(title, {
            body: description,
            icon: '/icon-192.png',
            tag: 'video-ready', // Prevents duplicate notifications
            requireInteraction: true, // Keeps notification visible until user interacts
          });

          notification.onclick = () => {
            window.focus();
            // Scroll to video section
            const videoSection = document.querySelector('[data-video-player-section]');
            if (videoSection) {
              videoSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            notification.close();
          };
        }
      });
    }
  }, [progress?.stage, currentProject, toast, queryClient]);

  // Fetch triptych videos when ready
  const { data: videos, error: videosError, isLoading: videosLoading } = useQuery<TriptychVideos>({
    queryKey: ["/api/projects", currentProject?.id, "videos"],
    enabled: !!currentProject && currentProject.status === "ready",
  });

  // Debug logging
  if (currentProject?.status === "ready") {
    console.log("Project ready, videos:", videos, "loading:", videosLoading);
    if (videosError) console.error("Videos error:", videosError);
  }

  // Fetch smart slices
  const { data: slices = [] } = useQuery<SmartSlice[]>({
    queryKey: ["/api/projects", currentProject?.id, "slices"],
    enabled: !!currentProject && currentProject.status === "ready",
  });

  // Quality report interface (matches API response)
  interface QualityReport {
    projectId: string;
    projectName: string;
    videoReports: Array<{
      videoId: string;
      videoType: string;
      technicalMetrics: {
        resolution: { width: number; height: number };
        aspectRatio: string;
        duration: number;
        bitrate: number;
        codec: string;
        fileSize: number;
        fps: number;
      };
      qualityScores: {
        overall: number;
        hookScore: number;
        buildupScore: number;
        payoffScore: number;
        closerScore: number;
        uniqueness: number;
        dynamism: number;
        usability: number;
        standalone: number;
      };
      competitiveRank: "S" | "A" | "B" | "C" | "D";
      recommendations: string[];
    }>;
    platformBenchmark: {
      avgOverallScore: number;
      improvementRate: number;
    };
    overallGrade: number;
  }

  // Fetch quality report when project is ready (independent of videos query)
  const { data: qualityReport, isLoading: qualityLoading } = useQuery<QualityReport>({
    queryKey: ["/api/projects", currentProject?.id, "quality-report"],
    enabled: !!currentProject && currentProject.status === "ready",
  });

  // Create project from URL mutation
  const createProjectFromUrlMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await apiRequest("POST", "/api/projects", {
        name: "New Project",
        sourceVideoUrl: url,
        status: "pending",
      });
      return response as unknown as Project;
    },
    onSuccess: (project) => {
      setCurrentProject(project);
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", project.id],
      });
    },
  });

  // Upload progress state
  const [uploadProgress, setUploadProgress] = useState(0);

  // Create project from file upload mutation with progress
  const createProjectFromFileMutation = useMutation({
    mutationFn: async (file: File) => {
      console.log("Mutation starting upload for:", file.name);
      const formData = new FormData();
      formData.append("video", file);
      formData.append("name", file.name);

      // Use XMLHttpRequest for progress tracking
      return new Promise<Project>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Track upload progress
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            setUploadProgress(percentComplete);
            console.log(`Upload progress: ${percentComplete}%`);
          }
        });

        // Handle completion
        xhr.addEventListener("load", () => {
          setUploadProgress(100);
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve(response);
            } catch (error) {
              reject(new Error("Failed to parse response"));
            }
          } else {
            try {
              const errorData = JSON.parse(xhr.responseText);
              const errorText = errorData.error || errorData.details || xhr.statusText;
              console.error("Upload failed:", xhr.status, errorText);
              reject(new Error(`Upload failed: ${errorText}`));
            } catch {
              console.error("Upload failed:", xhr.status, xhr.statusText);
              reject(new Error(`Upload failed: ${xhr.statusText}`));
            }
          }
        });

        // Handle errors
        xhr.addEventListener("error", () => {
          console.error("Upload network error");
          reject(new Error("Network error - please try again"));
        });

        xhr.addEventListener("abort", () => {
          console.error("Upload aborted");
          reject(new Error("Upload was aborted"));
        });

        // Open connection and send
        xhr.open("POST", "/api/projects/upload");
        xhr.send(formData);
      });
    },
    onSuccess: (project) => {
      console.log("onSuccess called with project:", project.id);
      setCurrentProject(project);
      setShowIntentSelector(true); // Show intent selector after upload
      setUploadStep("intent"); // Set upload step to intent
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", project.id],
      });
    },
    onError: (error: Error) => {
      console.error("Upload mutation error:", error.message || error);
      alert(`Upload failed: ${error.message || "Unknown error"}. Please refresh the page and try again.`);
    },
  });

  // Submit batch intent mutation
  const submitBatchIntentMutation = useMutation({
    mutationFn: async (data: {
      batchId: string;
      userIntent: UserIntent;
      intentConfig: IntentConfig;
    }) => {
      return apiRequest("POST", `/api/projects/batch/${data.batchId}/submit-intent`, {
        userIntent: data.userIntent,
        intentConfig: data.intentConfig,
      });
    },
    onSuccess: () => {
      setShowIntentSelector(false);
      setUploadStep("processing");
      toast({
        title: "Batch Processing Started",
        description: "Your videos are being processed in parallel...",
      });
    },
  });

  // Submit user intent and start processing
  const submitIntentMutation = useMutation({
    mutationFn: async ({ userIntent, intentConfig }: { userIntent: UserIntent; intentConfig?: IntentConfig }) => {
      console.log("[submitIntentMutation] Submitting intent:", userIntent);
      console.log("[submitIntentMutation] Config:", JSON.stringify(intentConfig));

      return apiRequest("POST", `/api/projects/${currentProject?.id}/submit-intent`, {
        userIntent,
        intentConfig: intentConfig || {},
      });
    },
    onSuccess: () => {
      setShowIntentSelector(false);
      setUploadStep("processing"); // Set upload step to processing
      // Update project status to trigger progress polling
      if (currentProject) {
        setCurrentProject({ ...currentProject, status: "analyzing" });
        queryClient.invalidateQueries({
          queryKey: [`/api/projects/${currentProject.id}/progress`],
        });
      }
    },
  });

  // Schedule intent for later processing
  const scheduleIntentMutation = useMutation({
    mutationFn: async ({ userIntent, intentConfig }: { userIntent: UserIntent; intentConfig?: IntentConfig }) => {
      console.log("[scheduleIntentMutation] Scheduling for later:", userIntent);
      return apiRequest("POST", `/api/projects/${currentProject?.id}/schedule`, {
        userIntent,
        intentConfig: intentConfig || {},
      });
    },
    onSuccess: () => {
      setShowIntentSelector(false);
      setUploadStep("upload"); // Go back to upload step
      if (currentProject) {
        setCurrentProject({ ...currentProject, status: "scheduled" });
      }
      toast({
        title: "Scheduled for Later",
        description: "Your video is queued for processing. It will be processed in the background and you can check back later for results.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects/previous-uploads"] });
    },
    onError: (error) => {
      toast({
        title: "Scheduling Failed",
        description: error instanceof Error ? error.message : "Failed to schedule processing",
        variant: "destructive",
      });
    },
  });

  // Apply mood mutation
  const applyMoodMutation = useMutation({
    mutationFn: async (mood: string) => {
      return apiRequest("POST", `/api/projects/${currentProject?.id}/apply-mood`, {
        mood,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", currentProject?.id, "videos"],
      });
    },
  });

  // Apply pacing mutation
  const applyPacingMutation = useMutation({
    mutationFn: async (tempo: number) => {
      return apiRequest("POST", `/api/projects/${currentProject?.id}/apply-pacing`, {
        cutTempo: tempo,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", currentProject?.id, "videos"],
      });
    },
  });

  // Analyze reference video mutation
  const analyzeReferenceMutation = useMutation({
    mutationFn: async ({ url, options }: { url: string; options: { mimicEditing: boolean; mimicColorGrading: boolean } }) => {
      const response = await fetch("/api/reference-videos/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, ...options }),
      });

      if (!response.ok) {
        throw new Error("Failed to analyze reference video");
      }

      return response.json();
    },
    onSuccess: (data) => {
      setAnalyzedStyle(data.analyzedStyle);
    },
  });

  // Export video mutation
  const exportVideoMutation = useMutation({
    mutationFn: async ({
      type,
      format,
      quality
    }: {
      type: "short" | "standard" | "comprehensive" | "square";
      format?: string;
      quality?: string;
    }) => {
      const response = await apiRequest(
        "POST",
        `/api/projects/${currentProject?.id}/export`,
        { type, format, quality }
      );
      return response;
    },
  });

  // Export all videos mutation
  const exportAllMutation = useMutation({
    mutationFn: async ({
      format,
      quality
    }: {
      format?: string;
      quality?: string;
    } = {}) => {
      const response = await apiRequest(
        "POST",
        `/api/projects/${currentProject?.id}/export-all`,
        { format, quality }
      );
      return response;
    },
    onSuccess: (data: any) => {
      // Download the ZIP file
      if (data.zipPath) {
        window.open(data.zipPath, '_blank');
      }
    },
  });

  // Apply refinement mutation
  const applyRefinementMutation = useMutation({
    mutationFn: async ({ videoId, feedback }: { videoId: string; feedback: string }) => {
      if (!currentProject?.id) throw new Error("No project ID");
      return apiRequest(
        "POST",
        `/api/projects/${currentProject.id}/apply-refinement`,
        { videoId, feedback }
      );
    },
    onSuccess: (data) => {
      if (currentProject?.id) {
        // Invalidate both videos and slices to ensure fresh data
        queryClient.invalidateQueries({
          queryKey: ["/api/projects", currentProject.id, "videos"],
        });
        queryClient.invalidateQueries({
          queryKey: ["/api/projects", currentProject.id, "slices"],
        });

        // Force re-select the video type to trigger preview update
        const videoType = selectedVideoType || "standard";
        setSelectedVideoType(null);
        setTimeout(() => {
          setSelectedVideoType(videoType);

          // Scroll to video player to show the updated video
          setTimeout(() => {
            const videoSection = document.querySelector('[data-video-player-section]');
            if (videoSection) {
              videoSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 300);
        }, 100);

        toast({
          title: "Video Refined Successfully",
          description: data.newDuration
            ? `Updated to ${Math.round(data.newDuration)}s with ${data.clipCount} clips. Preview above!`
            : "Your refined video is ready to preview and download!",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Refinement Failed",
        description: error.message || "Failed to apply refinement",
        variant: "destructive",
      });
    },
  });

  const handleUrlSubmit = (url: string) => {
    createProjectFromUrlMutation.mutate(url);
  };

  // Mutation for shareable link upload
  const shareableLinkUpload = useMutation({
    mutationFn: async (url: string) => {
      setIsUploadingActive(true); // Indicate upload is active
      const response = await apiRequest("POST", "/api/projects/upload-from-url", { url });
      return response as Project;
    },
    onSuccess: (project) => {
      console.log("Shareable link upload successful:", project.id);
      setCurrentProject(project);
      setUploadStep("intent");
      setShowIntentSelector(true);
      setIsUploadingActive(false); // Indicate upload is finished
      setShareableUrl(""); // Clear the input
    },
    onError: (error: any) => {
      console.error("Shareable link upload failed:", error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload from shareable link. Please try again.",
        variant: "destructive",
      });
      setIsUploadingActive(false); // Indicate upload is finished (with error)
    },
  });

  const handleShareableLinkUpload = () => {
    if (shareableUrl) {
      shareableLinkUpload.mutate(shareableUrl);
    }
  };

  const handleFileSubmit = (fileOrProject: File | any) => {
    // If it's already a project object from the upload endpoint
    if (fileOrProject && typeof fileOrProject === 'object' && 'id' in fileOrProject) {
      console.log("[handleFileSubmit] Project received:", fileOrProject.id);

      setCurrentProject(fileOrProject);
      setUploadStep("intent");
      setShowIntentSelector(true);
      setIsUploadingActive(false); // Upload is complete

      // Extract filename for clearer display
      const videoName = fileOrProject.name || 'Video';
      const fileName = videoName.replace(/\.[^/.]+$/, ''); // Remove file extension

      // Scroll to intent selector immediately
      setTimeout(() => {
        const intentSection = document.querySelector('[data-intent-selector]');
        if (intentSection) {
          intentSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);

      // Show toast notification with clickable action - make it very prominent
      toast({
        title: "✅ Video Uploaded",
        description: (
          <div className="space-y-2">
            <p className="font-semibold text-base">{fileName}</p>
            <p className="text-sm text-muted-foreground">Duration: {fileOrProject.duration}s • Ready for editing</p>
          </div>
        ),
        action: (
          <Button
            size="sm"
            variant="default"
            onClick={() => {
              const intentSection = document.querySelector('[data-intent-selector]');
              if (intentSection) {
                intentSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }}
            data-testid="toast-action-view-project"
          >
            Choose Intent
          </Button>
        ),
      });
    } else {
      // Legacy: if it's still a File, use the mutation
      createProjectFromFileMutation.mutate(fileOrProject);
    }
  };

  // Pure data loader - fetches project and determines next step without side effects
  const handlePreviousUploadSelect = useCallback(async (projectId: string) => {
    try {
      // Invalidate cached data for this project to ensure fresh slices and videos
      await queryClient.invalidateQueries({
        queryKey: ["/api/projects", projectId, "videos"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["/api/projects", projectId, "slices"],
      });

      const project = await queryClient.fetchQuery<Project>({
        queryKey: ["/api/projects", projectId],
        staleTime: 0, // Ensure fresh data
      });

      if (!project) {
        throw new Error("Project not found");
      }

      // Determine next upload step based on project status and intent
      let nextStep: "upload" | "intent" | "processing" | "editing" | "complete";
      let showIntent: boolean;
      const status = project.status;

      // Handle different project states
      if (status === "pending") {
        console.log("[PreviousUploads] Project is pending, showing intent selector");
        setShowIntentSelector(true);
        setUploadStep("intent");
      } else if (status === "completed" || status === "ready") {
        console.log("[PreviousUploads] Project is completed/ready, checking for videos");
        // Don't show intent selector - let the normal flow handle it
        // The UI will automatically show editing interface if videos exist
        setShowIntentSelector(false);
        setUploadStep("complete");
      } else if (status === "analyzing" || status === "processing" || status === "generating") {
        console.log("[PreviousUploads] Project is processing, showing progress");
        setUploadStep("processing");
      } else {
        console.log("[PreviousUploads] Unknown status, showing intent selector");
        setShowIntentSelector(true);
        setUploadStep("intent");
      }

      // Reset advanced editing when switching projects
      setShowAdvancedEditing(false);
      setShowFinalization(false);

      return { project, nextStep: uploadStep, showIntent: showIntentSelector };
    } catch (error) {
      console.error("Error loading project:", error);
      throw error; // Re-throw to be handled by caller
    }
  }, [queryClient]);


  const handleMoodSelect = (mood: string) => {
    setSelectedMood(mood);
    if (currentProject) {
      applyMoodMutation.mutate(mood);
    }
  };

  const handleReferenceAnalyze = (url: string, options: { mimicEditing: boolean; mimicColorGrading: boolean }) => {
    analyzeReferenceMutation.mutate({ url, options });
  };

  const handleExport = (type?: "short" | "standard" | "comprehensive" | "square", format?: string, quality?: string) => {
    // If type is provided, it means this is a direct export from the button, not from finalization.
    if (type) {
      exportVideoMutation.mutate({ type, format, quality });
    } else {
      // If no type, it means we're closing the finalization UI and want to export the original video.
      // This scenario should ideally not happen if the "Download As-Is" button is used correctly.
      // For safety, we can either do nothing or log an error.
      console.warn("handleExport called without type, assuming user wants to close finalization.");
    }
  };

  const handleExportAll = (format?: string, quality?: string) => {
    exportAllMutation.mutate({ format, quality });
  };

  const handleIntentSelect = async (intent: UserIntent, config?: IntentConfig) => {
    try {
      // Merge with existing intentConfig to preserve detected aspect ratio
      const mergedConfig = currentProject ? {
        ...(typeof currentProject.intentConfig === 'object' ? currentProject.intentConfig : {}),
        ...config,
      } : config;

      await submitIntentMutation.mutateAsync({
        userIntent: intent,
        intentConfig: mergedConfig,
      });
      setShowIntentSelector(false);
      setUploadStep("processing"); // Set upload step to processing
      // Update project status to trigger progress polling
      if (currentProject) {
        setCurrentProject({ ...currentProject, status: "analyzing" });
        queryClient.invalidateQueries({
          queryKey: [`/api/projects/${currentProject.id}/progress`],
        });
      }
    } catch (error: any) {
      console.error("Error submitting intent:", error);

      // Check for legacy project error (video file no longer available)
      const errorData = error?.data;
      const errorStatus = error?.status;
      const isLegacyProject = errorData?.isLegacy || errorStatus === 410;

      if (isLegacyProject) {
        toast({
          title: "Video File Missing",
          description: "This video file is no longer available. Please upload a new video to continue.",
          variant: "destructive",
        });
        // Reset to upload state
        setShowIntentSelector(false);
        setUploadStep("upload");
        setCurrentProject(null);
      } else {
        toast({
          title: "Processing Error",
          description: errorData?.message || error?.message || "Failed to start video processing. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  // Handler for video selection, used in TriptychPreview
  const handleVideoSelect = useCallback((type: "short" | "standard" | "comprehensive", index?: number) => {
    setSelectedVideoType(type);
    if (index !== undefined) {
      setSelectedClipIndex(index);
    }
  }, []);

  // Handler for applying finalization (called from VideoFinalize component)
  const handleApplyFinalization = (config: any) => {
    const videoId = videos?.multipleClips && videos.multipleClips.length > 0
      ? videos.multipleClips[selectedClipIndex]?.id
      : videos?.[selectedVideoType]?.id;

    if (videoId && currentProject?.id) {
      applyFinalizationMutation.mutate({ videoId, config });
    } else {
      console.error("Could not apply finalization: Missing videoId, projectId, or selectedVideoType");
      toast({
        title: "Finalization Error",
        description: "Could not apply your final touches. Please try again.",
        variant: "destructive",
      });
    }
  };

  const refetchVideos = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: ["/api/projects", currentProject?.id, "videos"],
    });
  }, [queryClient, currentProject?.id]);

  // Dummy handlers for new batch upload states
  const handleUploadComplete = useCallback((project: Project) => {
    console.log("Single upload complete:", project.id);
    setCurrentProject(project);
    setShowIntentSelector(true);
    setUploadStep("intent");
    setIsUploadingActive(false);
  }, []);

  const isCreating = createProjectFromUrlMutation.isPending || createProjectFromFileMutation.isPending || shareableLinkUpload.isPending;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Onboarding Tour */}
      <OnboardingTour />

      {/* AuthDialog - appears on top of everything when open */}
      <AuthDialog
        open={showAuthDialog}
        onOpenChange={setShowAuthDialog}
        onAuthSuccess={() => {
          setShowAuthDialog(false);
        }}
      />

      {/* Trial Banner */}
      <TrialBanner
        daysRemaining={trialDaysRemaining}
        creditsRemaining={500} // TODO: Get from user subscription
        onUpgrade={() => setShowPricing(true)}
        onBuyCredits={() => setShowPricing(true)}
      />

      {/* Upload Warning Banner - Persistent */}
      {isUploadingActive && (
        <div className="sticky top-0 z-40 bg-amber-50 dark:bg-amber-950 border-b border-amber-200 dark:border-amber-800 py-3 px-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse flex-shrink-0" />
              <div className="text-sm">
                <p className="font-semibold text-amber-900 dark:text-amber-100">Upload in Progress</p>
                <p className="text-xs text-amber-800 dark:text-amber-200">Do not refresh, navigate away, or close this page — your upload will be lost</p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const tabs = document.querySelector('[value="video"]') as HTMLButtonElement;
                tabs?.click();
                tabs?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }}
              data-testid="button-return-to-upload"
              className="flex-shrink-0"
            >
              Return to Upload
            </Button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-purple-500/10 bg-gray-900/80 backdrop-blur-xl supports-[backdrop-filter]:bg-gray-900/60" style={isUploadingActive ? { top: '58px' } : {}}>
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-display font-semibold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">Synapse Edit</h1>
                <Badge className="bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs border-0">v2.0</Badge>
              </div>
              <p className="text-xs text-gray-400">Intent-Driven AI Editor</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Roadmap Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const roadmapSection = document.getElementById('roadmap-section');
                if (roadmapSection) {
                  roadmapSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } else {
                  // If not on upload page, navigate back
                  setCurrentProject(null);
                  setShowIntentSelector(false);
                  setUploadStep("upload");
                  setTimeout(() => {
                    const section = document.getElementById('roadmap-section');
                    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 100);
                }
              }}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Roadmap</span>
            </Button>

            {/* Project History Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowProjectHistory(true)}
              className="gap-2"
              data-testid="button-open-project-history"
            >
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Project History</span>
            </Button>

            {/* Content Studio Link */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = '/content-studio'}
            >
              Content Studio
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = '/admin'}
            >
              Admin
            </Button>

            {user ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowProfileDialog(true)}
                  className="gap-2"
                >
                  <UserCircle className="h-4 w-4" />
                  {user.displayName || user.email}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.location.href = '/'}
                >
                  ← Marketing
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSignOut}
                >
                  Sign Out
                </Button>
              </>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  console.log("Sign In button clicked");
                  setShowAuthDialog(true);
                }}
              >
                Sign In
              </Button>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12">
        {/* Back to Home Button */}
        {currentProject && (
          <div className="max-w-6xl mx-auto mb-6">
            <Button
              variant="ghost"
              onClick={() => {
                setCurrentProject(null);
                setShowIntentSelector(false);
                setSelectedVideoType("standard");
                setUploadStep("upload"); // Reset upload step to upload
              }}
              className="gap-2"
            >
              ← Back to Upload
            </Button>
          </div>
        )}

        {/* Hero Section - Sleek Dark Design */}
        {!currentProject && !showIntentSelector && uploadStep === "upload" && (
          <>
            {/* Hero Banner */}
            <div className="text-center space-y-8 mb-20 pt-12 relative">
              <div className="absolute inset-0 bg-gradient-to-b from-purple-500/5 via-transparent to-transparent -z-10 rounded-3xl" />

              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 backdrop-blur-sm">
                <Sparkles className="h-4 w-4 text-purple-400" />
                <span className="text-sm text-purple-300 font-medium">Intent-Driven AI Video Editor</span>
              </div>

              <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-tight">
                <span className="text-foreground">Editing on</span>
                <br />
                <span className="bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  Autopilot.
                </span>
              </h1>

              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Drag, drop, and describe. Our AI analyzes your footage, understands
                your intent, and crafts the perfect edit in seconds.
              </p>
            </div>

            <div className="max-w-3xl mx-auto space-y-6">
            {/* Single Video Upload - reliable one-at-a-time uploads */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative border border-border/50 rounded-2xl bg-card/50 backdrop-blur-sm p-8 hover:border-purple-500/30 transition-all">
                <ResumableUpload
                  onUploadComplete={(project) => {
                    console.log(`[Upload] Created project: ${project.name}`);
                    queryClient.invalidateQueries({ queryKey: ['/api/projects/previous-uploads'] });
                    setCurrentProject(project);
                    setShowIntentSelector(true);
                  }}
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1 border-t" />
              <span className="text-sm text-muted-foreground">OR</span>
              <div className="flex-1 border-t" />
            </div>

            <VideoInput
              onUrlSubmit={handleUrlSubmit}
              onFileSubmit={handleFileSubmit}
              onPreviousUploadSelect={handlePreviousUploadSelect}
              isLoading={isCreating}
              onOpenPreviousUploads={() => setShowPreviousUploads(true)}
              showUploadTab={false}
            />

            {showPreviousUploads && (
              <PreviousUploads
                onSelect={handlePreviousUploadSelect}
                onCreateCompilation={async (projectIds) => {
                  try {
                    const response = await apiRequest("POST", "/api/projects/compilation", {
                      sourceProjectIds: projectIds,
                    });

                    if (response.project) {
                      setCurrentProject(response.project);
                      setUploadStep("intent");
                      setShowIntentSelector(true);
                      setShowPreviousUploads(false);

                      toast({
                        title: "Compilation Created",
                        description: `Combined ${response.sourceCount} videos. Select your editing intent.`,
                      });
                    }
                  } catch (error) {
                    toast({
                      title: "Failed to Create Compilation",
                      description: error instanceof Error ? error.message : "Could not create compilation.",
                      variant: "destructive",
                    });
                  }
                }}
              />
            )}

            {/* Reference Video Style Mimicry */}
            <div className="border-t pt-6 mt-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">🎨 Reference Video Style (Optional)</h3>
                <p className="text-sm text-muted-foreground">
                  Paste a reference video URL to match its editing style, pacing, and color grading
                </p>
              </div>

              <ReferenceVideoInput
                onAnalyze={handleReferenceAnalyze}
                isAnalyzing={analyzeReferenceMutation.isPending}
                analyzedStyle={analyzedStyle || undefined}
              />
            </div>



            {/* Shareable Link Upload */}
            {shareableUrl && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-blue-500" />
                  <Input
                    value={shareableUrl}
                    onChange={(e) => setShareableUrl(e.target.value)}
                    placeholder="Paste shareable link (Google Drive, Dropbox, etc.)"
                    className="flex-1"
                  />
                  {shareableLinkUpload.isPending ? (
                    <Button
                      variant="destructive"
                      onClick={() => window.location.reload()}
                    >
                      Stop Upload
                    </Button>
                  ) : (
                    <Button
                      onClick={handleShareableLinkUpload}
                      disabled={!shareableUrl}
                    >
                      Upload
                    </Button>
                  )}
                </div>
                {shareableLinkUpload.isPending && (
                  <div className="text-sm text-muted-foreground">
                    Downloading from link... This may take a few minutes for large files.
                  </div>
                )}
              </div>
            )}
            {!shareableUrl && (
              <Button variant="outline" onClick={() => setShareableUrl("https://")}>
                Upload from Shareable Link
              </Button>
            )}
          </div>

          {/* Feature Highlights - 5 Key Features */}
          <FeatureHighlights />
          </>
        )}


        {/* Intent Selection */}
        {currentProject && showIntentSelector && currentProject.duration && (
          <div className="max-w-4xl mx-auto space-y-6" data-intent-selector>
            <IntentSelector
              videoDuration={currentProject.duration || 0}
              onSelect={handleIntentSelect}
              isLoading={submitIntentMutation.isPending}
              projectId={currentProject.id}
              defaultAspectRatio={
                (currentProject.intentConfig &&
                 typeof currentProject.intentConfig === 'object' &&
                 'originalAspectRatio' in currentProject.intentConfig &&
                 (currentProject.intentConfig.originalAspectRatio === "9:16" ||
                  currentProject.intentConfig.originalAspectRatio === "1:1" ||
                  currentProject.intentConfig.originalAspectRatio === "16:9")
                  ? currentProject.intentConfig.originalAspectRatio
                  : null) || "9:16"
              }
            />

            </div>
        )}

        {/* PROCESSING STATE - Immersive vibey experience during video editing */}
        {currentProject && uploadStep === "processing" && (
          <div className="max-w-4xl mx-auto">
            <ImmersiveProcessing
              stage={progress?.stage || "pending"}
              progress={progress?.progress || 0}
              message={progress?.message || "Preparing to analyze your video..."}
              onCancel={() => {
                setCurrentProject(null);
                setShowIntentSelector(false);
                setUploadStep("upload");
              }}
            />
          </div>
        )}

        {/* Editing Interface - This section is now conditionally rendered based on uploadStep */}
        {currentProject && uploadStep === "editing" && videos && currentProject.status === "ready" && (
          <div className="space-y-8">
            {/* SUCCESS HEADER - Sleek "Analysis Complete" style */}
            <section className="max-w-4xl mx-auto">
              <Card className="p-8 bg-card/80 border border-border/50 backdrop-blur-sm">
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                      <Sparkles className="h-6 w-6 text-purple-400" />
                    </div>
                    <div className="text-left">
                      <h2 className="text-xl font-semibold">Analysis Complete</h2>
                      <p className="text-sm text-muted-foreground">
                        AI identified {videos.multipleClips && videos.multipleClips.length > 0
                          ? `${videos.multipleClips.length} highlight moments`
                          : (() => {
                              const count = [videos.short, videos.standard, videos.comprehensive].filter(Boolean).length;
                              return count === 1 ? "your optimized edit" : count > 0 ? `${count} optimized versions` : "your video";
                            })()}
                      </p>
                    </div>
                  </div>

                  {/* Primary Actions */}
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCurrentProject(null);
                        setUploadStep("upload");
                        setShowIntentSelector(false);
                        setShowAdvancedEditing(false);
                        setShowFinalization(false);
                      }}
                      data-testid="button-back-to-uploads"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Link href={`/editor/${currentProject.id}`}>
                      <Button
                        variant="outline"
                        data-testid="button-open-editor"
                      >
                        <Wand2 className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                    </Link>
                    <Button
                      onClick={() => handleExport()}
                      disabled={exportVideoMutation.isPending}
                      data-testid="button-export-video"
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      {exportVideoMutation.isPending ? "Preparing..." : "Generate Edit"}
                    </Button>
                  </div>
                </div>
              </Card>
            </section>

            {/* RAW SOURCE VIDEO - Sleek styling */}
            {currentProject?.sourceVideoPath && (
              <section className="max-w-4xl mx-auto">
                <Card className="p-4 bg-card/50 border border-border/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-muted/30 border border-border/30 flex items-center justify-center">
                        <Film className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <h4 className="font-medium text-sm">Raw Source Video</h4>
                        <p className="text-xs text-muted-foreground">
                          {currentProject.name || "Original upload"} • {currentProject.duration}s
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(currentProject.sourceVideoPath!, '_blank')}
                        data-testid="button-view-raw-video"
                      >
                        <Video className="mr-2 h-4 w-4" />
                        View Raw
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const a = document.createElement('a');
                          a.href = currentProject.sourceVideoPath!;
                          a.download = currentProject.name || 'source-video';
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                        }}
                        data-testid="button-download-raw-video"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download Raw
                      </Button>
                    </div>
                  </div>
                </Card>
              </section>
            )}

            {/* VIEW EDITED VIDEOS - Persistent access to outputs and feedback */}
            <section className="max-w-4xl mx-auto">
              <Card className="p-6 border-accent">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Video className="h-5 w-5 text-primary" />
                        Your Edited Videos
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        All edited outputs from this project
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-xs bg-muted/30 px-3 py-2 rounded-md border border-border/30">
                        <FolderOpen className="h-3 w-3 text-muted-foreground" />
                        <code className="text-muted-foreground">/uploads/videos/</code>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-muted-foreground">Files persist across sessions</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open('/uploads/videos', '_blank')}
                        className="gap-2"
                      >
                        📁 Open Folder
                      </Button>
                    </div>
                  </div>

                  {/* Video List - Sleek design */}
                  <div className="space-y-2">
                    {videos.multipleClips && videos.multipleClips.length > 0 ? (
                      videos.multipleClips.map((clip, idx) => (
                        <div
                          key={clip.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30 hover:border-purple-500/30 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-md bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                              <span className="text-sm font-medium text-purple-400">{idx + 1}</span>
                            </div>
                            <div>
                              <p className="font-medium text-sm">Highlight {idx + 1}</p>
                              <p className="text-xs text-muted-foreground">{clip.duration}s</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedClipIndex(idx);
                                setTimeout(() => {
                                  const videoSection = document.querySelector('[data-video-player-section]');
                                  videoSection?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }, 100);
                              }}
                            >
                              Preview
                            </Button>
                            {/* Download button removed as per user request */}
                          </div>
                        </div>
                      ))
                    ) : (
                      <>
                        {videos.short && (
                          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30 hover:border-purple-500/30 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-md bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                                <Zap className="h-4 w-4 text-purple-400" />
                              </div>
                              <div>
                                <p className="font-medium text-sm">Short Hook</p>
                                <p className="text-xs text-muted-foreground">{videos.short.duration}s</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedVideoType("short");
                                  setTimeout(() => {
                                    const videoSection = document.querySelector('[data-video-player-section]');
                                    if (videoSection) {
                                      videoSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    }
                                  }, 100);
                                }}
                              >
                                Preview
                              </Button>
                              {/* Download button removed as per user request */}
                            </div>
                          </div>
                        )}
                        {videos.standard && (
                          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30 hover:border-purple-500/30 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                                <Video className="h-4 w-4 text-blue-400" />
                              </div>
                              <div>
                                <p className="font-medium text-sm">Standard Edit</p>
                                <p className="text-xs text-muted-foreground">{videos.standard.duration}s</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedVideoType("standard");
                                  setTimeout(() => {
                                    const videoSection = document.querySelector('[data-video-player-section]');
                                    if (videoSection) {
                                      videoSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    }
                                  }, 100);
                                }}
                              >
                                Preview
                              </Button>
                              {/* Download button removed as per user request */}
                            </div>
                          </div>
                        )}
                        {videos.comprehensive && (
                          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30 hover:border-cyan-500/30 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-md bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                                <Sparkles className="h-4 w-4 text-cyan-400" />
                              </div>
                              <div>
                                <p className="font-medium text-sm">Comprehensive Edit</p>
                                <p className="text-xs text-muted-foreground">{videos.comprehensive.duration}s</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedVideoType("comprehensive");
                                  setTimeout(() => {
                                    const videoSection = document.querySelector('[data-video-player-section]');
                                    if (videoSection) {
                                      videoSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    }
                                  }, 100);
                                }}
                              >
                                Preview
                              </Button>
                              {/* Download button removed as per user request */}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Refinement History - if feedback was applied */}
                  {currentProject.feedbackHistory && currentProject.feedbackHistory.length > 0 && (
                    <div className="pt-4 border-t">
                      <h4 className="text-sm font-medium mb-2">Refinement History</h4>
                      <div className="space-y-1.5">
                        {currentProject.feedbackHistory.map((feedback: any, idx: number) => (
                          <div key={idx} className="text-sm p-2 rounded bg-accent/10 border border-accent/20">
                            <span className="text-muted-foreground">#{idx + 1}:</span> {feedback}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </section>

            {/* Quality Score Dashboard - Loading Skeleton */}
            {qualityLoading && (
              <section className="max-w-4xl mx-auto">
                <Card className="p-6 border border-border/50">
                  <div className="space-y-4 animate-pulse">
                    <div className="flex items-center justify-between">
                      <div className="h-6 w-40 bg-muted rounded" />
                      <div className="h-8 w-20 bg-muted rounded" />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="text-center p-3 rounded-lg bg-muted/50">
                          <div className="h-8 w-12 bg-muted rounded mx-auto mb-2" />
                          <div className="h-3 w-16 bg-muted rounded mx-auto" />
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              </section>
            )}

            {/* Quality Score Dashboard - Show AI editing quality */}
            {!qualityLoading && qualityReport && qualityReport.videoReports && qualityReport.videoReports.length > 0 && (
              <section className="max-w-4xl mx-auto">
                <Card className={`p-6 border ${
                  qualityReport.videoReports[0].qualityScores.overall < 70
                    ? "border-destructive/50 bg-destructive/5"
                    : qualityReport.videoReports[0].qualityScores.overall < 80
                    ? "border-yellow-500/50 bg-yellow-500/5"
                    : "border-border/50"
                }`}>
                  <div className="space-y-4">
                    {/* Quality Warning Alert - Based on Editing Principles */}
                    {qualityReport.videoReports[0].qualityScores.overall < 80 && (
                      <div className={`p-3 rounded-lg flex items-start gap-3 ${
                        qualityReport.videoReports[0].qualityScores.overall < 70
                          ? "bg-destructive/10 text-destructive"
                          : "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                      }`}>
                        <Wand2 className="h-5 w-5 mt-0.5 flex-shrink-0" />
                        <div className="space-y-1">
                          <p className="font-medium">
                            {qualityReport.videoReports[0].qualityScores.overall < 70
                              ? "⚡ Viral Formula Not Applied - Weak Hook or Pacing"
                              : "Room for improvement"}
                          </p>
                          <p className="text-sm opacity-90">
                            {qualityReport.videoReports[0].qualityScores.hookScore < 75
                              ? "Weak hook - first 3 seconds need stronger impact. "
                              : ""}
                            {qualityReport.videoReports[0].qualityScores.dynamism < 70
                              ? "Low dynamism - consider faster cuts or more action. "
                              : ""}
                            See targeted fixes below.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        AI Quality Assessment
                      </h3>
                      <Badge
                        variant={qualityReport.videoReports[0].competitiveRank === "S" ? "default" :
                                 qualityReport.videoReports[0].competitiveRank === "A" ? "default" :
                                 qualityReport.videoReports[0].competitiveRank === "B" ? "secondary" : "outline"}
                        className={`text-lg px-3 py-1 ${
                          qualityReport.videoReports[0].competitiveRank === "S" ? "bg-gradient-to-r from-yellow-500 to-amber-500 text-white" :
                          qualityReport.videoReports[0].competitiveRank === "A" ? "bg-primary text-primary-foreground" : ""
                        }`}
                        data-testid="badge-quality-rank"
                      >
                        {qualityReport.videoReports[0].competitiveRank}-Rank
                      </Badge>
                    </div>

                    {/* Score Overview */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <div className="text-2xl font-bold text-primary" data-testid="text-overall-score">
                          {Math.round(qualityReport.videoReports[0].qualityScores.overall)}
                        </div>
                        <div className="text-xs text-muted-foreground">Overall Score</div>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <div className="text-2xl font-bold text-chart-1" data-testid="text-hook-score">
                          {Math.round(qualityReport.videoReports[0].qualityScores.hookScore)}
                        </div>
                        <div className="text-xs text-muted-foreground">Hook (First 3s)</div>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <div className="text-2xl font-bold text-chart-2" data-testid="text-dynamism-score">
                          {Math.round(qualityReport.videoReports[0].qualityScores.dynamism)}
                        </div>
                        <div className="text-xs text-muted-foreground">Arousal/Energy</div>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <div className="text-2xl font-bold text-chart-3" data-testid="text-usability-score">
                          {Math.round(qualityReport.videoReports[0].qualityScores.usability)}
                        </div>
                        <div className="text-xs text-muted-foreground">Usability</div>
                      </div>
                    </div>

                    {/* Narrative Structure Scores */}
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-muted-foreground">Narrative Structure</div>
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="outline" className="gap-1">
                          Hook: {Math.round(qualityReport.videoReports[0].qualityScores.hookScore)}
                        </Badge>
                        <Badge variant="outline" className="gap-1">
                          Buildup: {Math.round(qualityReport.videoReports[0].qualityScores.buildupScore || 0)}
                        </Badge>
                        <Badge variant="outline" className="gap-1">
                          Payoff: {Math.round(qualityReport.videoReports[0].qualityScores.payoffScore || 0)}
                        </Badge>
                        <Badge variant="outline" className="gap-1">
                          Closer: {Math.round(qualityReport.videoReports[0].qualityScores.closerScore || 0)}
                        </Badge>
                      </div>
                    </div>

                    {/* Technical Metrics */}
                    {qualityReport.videoReports[0].technicalMetrics && (
                      <div className="flex gap-2 flex-wrap text-xs text-muted-foreground">
                        {qualityReport.videoReports[0].technicalMetrics.resolution && (
                          <>
                            <span>{qualityReport.videoReports[0].technicalMetrics.resolution.width}x{qualityReport.videoReports[0].technicalMetrics.resolution.height}</span>
                            <span>•</span>
                          </>
                        )}
                        {qualityReport.videoReports[0].technicalMetrics.fps && (
                          <>
                            <span>{qualityReport.videoReports[0].technicalMetrics.fps}fps</span>
                            <span>•</span>
                          </>
                        )}
                        {qualityReport.videoReports[0].technicalMetrics.bitrate && (
                          <>
                            <span>{qualityReport.videoReports[0].technicalMetrics.bitrate.toFixed(1)}Mbps</span>
                            <span>•</span>
                          </>
                        )}
                        {qualityReport.videoReports[0].technicalMetrics.duration && (
                          <span>{qualityReport.videoReports[0].technicalMetrics.duration.toFixed(1)}s</span>
                        )}
                      </div>
                    )}

                    {/* AI Recommendations */}
                    {qualityReport.videoReports[0].recommendations && qualityReport.videoReports[0].recommendations.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-border/50">
                        <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <Wand2 className="h-4 w-4" />
                          AI Recommendations
                        </div>
                        <ul className="space-y-1">
                          {qualityReport.videoReports[0].recommendations.slice(0, 3).map((rec, i) => (
                            <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                              <span className="text-primary">•</span>
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Platform Benchmark */}
                    {qualityReport.platformBenchmark && (
                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
                        <span>Platform average: {qualityReport.platformBenchmark.averageOverall || qualityReport.platformBenchmark.avgOverallScore || 75}/100</span>
                        {qualityReport.platformBenchmark.improvementRate !== null &&
                         qualityReport.platformBenchmark.improvementRate !== undefined &&
                         !isNaN(qualityReport.platformBenchmark.improvementRate) && (
                          <span className={qualityReport.platformBenchmark.improvementRate >= 0 ? "text-green-500" : "text-red-500"}>
                            {qualityReport.platformBenchmark.improvementRate >= 0 ? "+" : ""}{qualityReport.platformBenchmark.improvementRate.toFixed(1)}% vs benchmark
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              </section>
            )}


            {/* Triptych Preview - Only show for traditional 3-video outputs */}
            {!videos.multipleClips && (videos.short || videos.standard || videos.comprehensive) && (
              <section>
                <TriptychPreview
                  videos={videos}
                  onVideoSelect={handleVideoSelect}
                  selectedType={selectedVideoType}
                  projectId={currentProject?.id}
                />
              </section>
            )}

            {/* Multiple Clips Grid - Show for multiple-clips intent (includes integrated player) */}
            {videos.multipleClips && videos.multipleClips.length > 0 && (
              <section>
                <TriptychPreview
                  videos={videos}
                  onVideoSelect={handleVideoSelect}
                  selectedType={selectedVideoType}
                  projectId={currentProject?.id}
                  onImproveClip={async (clipIndex, videoId, feedback, onSuccess) => {
                    if (!videoId || !currentProject?.id) {
                      toast({
                        title: "Error",
                        description: "Cannot improve clip - missing data",
                        variant: "destructive",
                      });
                      return;
                    }

                    console.log("Improve clip requested:", {
                      projectId: currentProject.id,
                      videoId,
                      clipIndex,
                      feedback,
                    });

                    toast({
                      title: "Improving Clip",
                      description: `Regenerating clip ${clipIndex + 1} with AI improvements: ${feedback.slice(0, 2).join(", ")}...`,
                    });

                    try {
                      const response = await fetch(`/api/projects/${currentProject.id}/apply-refinement`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          videoId,
                          feedback,
                        }),
                      });

                      if (response.ok) {
                        // Call success callback to show visual feedback
                        if (onSuccess) onSuccess();

                        // Refresh videos after refinement
                        setTimeout(() => refetchVideos(), 1000);
                      }
                    } catch (error) {
                      console.error("Failed to improve clip:", error);
                    }
                  }}
                />
              </section>
            )}

            {/* Video Player - Only for non-multiple-clips mode */}
            {selectedVideoType && !videos.multipleClips && (
              <section className="max-w-4xl mx-auto" data-video-player-section>
                <VideoPlayer
                  videoPath={videos[selectedVideoType]?.videoPath || ""}
                  title={`${selectedVideoType.charAt(0).toUpperCase() + selectedVideoType.slice(1)} Edit`}
                  subtitle={`AI-Edited from "${currentProject.name}"`}
                />
              </section>
            )}

          </div>
        )}

         {/* Completion State - Displayed after editing is done or project is loaded as 'completed' */}
         {currentProject && uploadStep === "complete" && (
            <div className="max-w-4xl mx-auto text-center py-20">
                <CheckCircle2 className="mx-auto h-24 w-24 text-green-500 animate-bounce" />
                <h1 className="text-4xl font-bold mt-6">Project Completed!</h1>
                <p className="text-lg text-muted-foreground mt-3">
                    Your video has been fully processed and is ready for review.
                </p>
                <div className="mt-8 flex items-center justify-center gap-4">
                    <Link href={`/editor/${currentProject.id}`}>
                        <Button size="lg" variant="default">
                            Review & Download
                        </Button>
                    </Link>
                    <Button
                        size="lg"
                        variant="outline"
                        onClick={() => {
                            setCurrentProject(null);
                            setUploadStep("upload");
                            setShowIntentSelector(false);
                        }}
                    >
                        Start New Project
                    </Button>
                </div>
            </div>
        )}


        {/* Compilation Workspace */}
        {showCompilationWorkspace && compilationProjects.length > 0 && (
          <section className="max-w-7xl mx-auto">
            <CompilationWorkspace
              projects={compilationProjects}
              onExport={(compilationPath) => {
                toast({
                  title: "✅ Compilation Ready",
                  description: "Your multi-video compilation is ready to download!",
                  action: (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => window.open(compilationPath, '_blank')}
                    >
                      Download
                    </Button>
                  ),
                });
              }}
            />
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t mt-24">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-center gap-4">
            <p className="text-sm text-muted-foreground">
              Built with Synapse Edit
            </p>
            <span className="text-muted-foreground">•</span>
            <Link href="/roadmap" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Roadmap
            </Link>
            <span className="text-muted-foreground">•</span>
            <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Admin
            </Link>
          </div>
        </div>
      </footer>

      {/* Pricing Modal */}
      <PricingModal
        isOpen={showPricing}
        onClose={() => setShowPricing(false)}
        currentTier="FREE_TRIAL"
      />

      {/* Previous Uploads Drawer */}
      <Sheet open={showPreviousUploads} onOpenChange={setShowPreviousUploads}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Previous Uploads</SheetTitle>
            <SheetDescription>
              Continue editing your previous projects
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <PreviousUploads
              onSelect={async (projectId) => {
                try {
                  console.log("[PreviousUploads] Loading project:", projectId);

                  // Fetch project data (pure data loader)
                  const { project, nextStep, showIntent } = await handlePreviousUploadSelect(projectId);

                  console.log("[PreviousUploads] Project loaded successfully:", {
                    id: project.id,
                    status: project.status,
                    nextStep,
                    showIntent
                  });

                  // Update UI state only after successful load
                  setCurrentProject(project);
                  setUploadStep(nextStep);
                  setShowIntentSelector(showIntent);
                  setShowPreviousUploads(false);

                  toast({
                    title: "✅ Project Loaded",
                    description: `Now editing: ${project.name}`,
                  });
                } catch (error) {
                  console.error("[PreviousUploads] Error loading project:", error);
                  toast({
                    title: "Failed to Load Project",
                    description: error instanceof Error && error.message === "Project not found"
                      ? "This project could not be found. Please try another one."
                      : "Could not load this project. Please try another one or refresh the page.",
                    variant: "destructive",
                  });
                  // Sheet stays open - user can try another project
                }
              }}
              onCreateCompilation={async (projectIds) => {
                try {
                  console.log("[Compilation] Creating compilation from projects:", projectIds);

                  const response = await apiRequest("POST", "/api/projects/compilation", {
                    sourceProjectIds: projectIds,
                  });

                  console.log("[Compilation] Created:", response);

                  // Load the new compilation project
                  if (response.project) {
                    setCurrentProject(response.project);
                    setUploadStep("intent");
                    setShowIntentSelector(true);
                    setShowPreviousUploads(false);

                    toast({
                      title: "Compilation Created",
                      description: `Combined ${response.sourceCount} videos (${Math.floor(response.totalDuration / 60)}m ${response.totalDuration % 60}s total). Select your editing intent.`,
                    });
                  }
                } catch (error) {
                  console.error("[Compilation] Error:", error);
                  toast({
                    title: "Failed to Create Compilation",
                    description: error instanceof Error ? error.message : "Could not create compilation. Please try again.",
                    variant: "destructive",
                  });
                }
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Batch Results Drawer - New */}
      <Sheet open={showBatchResults} onOpenChange={setShowBatchResults}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Batch Upload Results</SheetTitle>
            <SheetDescription>
              View the status of your batch upload and proceed to intent selection.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            {batchResults && (
              <>
                <BatchResults
                  batchId={batchResults.batchId}
                  projects={batchResults.projects}
                  onContinueEditing={(project) => {
                    setCurrentProject(project);
                    setVideoResults(null); // Clear any previous results
                    setUploadStep("intent");
                    setShowIntentSelector(true);
                    setShowBatchResults(false); // Close the drawer
                    toast({
                      title: "✅ Project Loaded",
                      description: `Now editing: ${project.name}`,
                    });
                  }}
                />

                {/* Compilation Workspace - only show after videos are generated */}
                {batchResults.projects.some(p => p.status === 'ready' || p.status === 'completed') && (
                  <Card className="p-6 border-2 border-purple-200 dark:border-purple-800 mt-6">
                    <div className="space-y-4">
                      <div>
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                          <Film className="h-6 w-6 text-purple-600" />
                          Multi-Video Compilation
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                          Combine clips from multiple videos into one continuous compilation
                        </p>
                      </div>
                      <CompilationWorkspace
                        batchProjects={batchResults.projects.filter(p =>
                          (p.status === 'ready' || p.status === 'completed') && p.sourceVideoPath
                        ).map(p => ({
                          id: p.id,
                          name: p.name,
                          sourceVideoPath: p.sourceVideoPath!,
                          duration: p.duration || 0,
                          status: p.status
                        }))}
                        onExport={(compilationPath) => {
                          toast({
                            title: "✅ Compilation Ready",
                            description: "Your multi-video compilation is ready to download!",
                            action: (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => window.open(compilationPath, '_blank')}
                              >
                                Download
                              </Button>
                            ),
                          });
                        }}
                      />
                    </div>
                  </Card>
                )}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Project History Drawer */}
      <Sheet open={showProjectHistory} onOpenChange={setShowProjectHistory}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Project History</SheetTitle>
            <SheetDescription>
              View and resume your previous video editing projects
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <PreviousUploads
              onSelect={async (projectId) => {
                try {
                  console.log("[ProjectHistory] Loading project:", projectId);

                  // Fetch project data (pure data loader)
                  const { project, nextStep, showIntent } = await handlePreviousUploadSelect(projectId);

                  console.log("[ProjectHistory] Project loaded successfully:", {
                    id: project.id,
                    status: project.status,
                    nextStep,
                    showIntent
                  });

                  // Update UI state only after successful load
                  setCurrentProject(project);
                  setUploadStep(nextStep);
                  setShowIntentSelector(showIntent);
                  setShowProjectHistory(false);

                  toast({
                    title: "✅ Project Loaded",
                    description: `Now editing: ${project.name}`,
                  });
                } catch (error) {
                  console.error("[ProjectHistory] Error loading project:", error);
                  toast({
                    title: "Failed to Load Project",
                    description: error instanceof Error && error.message === "Project not found"
                      ? "This project could not be found. Please try another one."
                      : "Could not load this project. Please try another one or refresh the page.",
                    variant: "destructive",
                  });
                  // Sheet stays open - user can try another project
                }
              }}
              onCreateCompilation={async (projectIds) => {
                try {
                  const response = await apiRequest("POST", "/api/projects/compilation", {
                    sourceProjectIds: projectIds,
                  });

                  if (response.project) {
                    setCurrentProject(response.project);
                    setUploadStep("intent");
                    setShowIntentSelector(true);
                    setShowProjectHistory(false);

                    toast({
                      title: "Compilation Created",
                      description: `Combined ${response.sourceCount} videos. Select your editing intent.`,
                    });
                  }
                } catch (error) {
                  toast({
                    title: "Failed to Create Compilation",
                    description: error instanceof Error ? error.message : "Could not create compilation.",
                    variant: "destructive",
                  });
                }
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Authentication Dialog */}
      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent className="max-w-2xl">
          {user && <UserProfile user={user} onClose={() => setShowProfileDialog(false)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}