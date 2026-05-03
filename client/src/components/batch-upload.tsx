import { useState, useRef, ChangeEvent, DragEvent } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Upload, X, Video, CheckCircle2, Loader2, AlertCircle, Film, AlertTriangle, Zap, Clock, FileVideo } from "lucide-react";
import { Label } from "@/components/ui/label";
import { queryClient } from "@/lib/queryClient";
import type { Project } from "@shared/schema";
import { nanoid } from "nanoid";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const LARGE_FILE_THRESHOLD_MB = 500; // Show warning for files > 500MB
const DEFAULT_FILE_LIMIT = 10; // Default max files per batch
const EXTENDED_FILE_LIMIT = 20; // Extended limit with time credits

interface BatchUploadProps {
  onBatchCreated: (batchId: string, projects: Project[]) => void;
  enableCompilationMode?: boolean;
}

interface FileWithPreview {
  id: string;
  file: File;
  preview: string;
  status: "pending" | "uploading" | "complete" | "error";
  progress: number;
  project?: Project;
  error?: string;
}

const CHUNK_SIZE = 25 * 1024 * 1024; // 25MB chunks (matches server)
const MAX_CONCURRENT_CHUNKS = 4; // 4 parallel chunks per file
const MAX_CONCURRENT_FILES = 2; // 2 files uploading at once

export function BatchUpload({ onBatchCreated, enableCompilationMode = false }: BatchUploadProps) {
  const { toast } = useToast();
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [batchId] = useState(() => nanoid());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const [compilationMode, setCompilationMode] = useState(enableCompilationMode);
  const [compilationClips, setCompilationClips] = useState<Array<{id: string; videoId: string; sliceId: string; order: number}>>([]);
  const [showLargeFileWarning, setShowLargeFileWarning] = useState(false);
  const [largeFiles, setLargeFiles] = useState<File[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [showFileLimitWarning, setShowFileLimitWarning] = useState(false);
  const [excessFiles, setExcessFiles] = useState<File[]>([]);
  const [hasExtendedLimit, setHasExtendedLimit] = useState(false);
  const currentFileLimit = hasExtendedLimit ? EXTENDED_FILE_LIMIT : DEFAULT_FILE_LIMIT;

  const addFilesToQueue = (videoFiles: File[], skipLimitCheck = false) => {
    // When skipLimitCheck is true (after user extended the limit), use extended limit
    const effectiveLimit = skipLimitCheck ? EXTENDED_FILE_LIMIT : currentFileLimit;
    const availableSlots = effectiveLimit - files.length;
    
    // Check if adding files would exceed the limit
    if (!skipLimitCheck && videoFiles.length > availableSlots && !hasExtendedLimit) {
      const filesWithinLimit = videoFiles.slice(0, availableSlots);
      const excess = videoFiles.slice(availableSlots);
      
      if (excess.length > 0) {
        setExcessFiles(excess);
        setShowFileLimitWarning(true);
        
        // Add the files that fit
        if (filesWithinLimit.length > 0) {
          const fileObjects = filesWithinLimit.map(file => ({
            id: nanoid(),
            file,
            preview: URL.createObjectURL(file),
            status: "pending" as const,
            progress: 0,
          }));
          setFiles(prev => [...prev, ...fileObjects]);
        }
        return;
      }
    }
    
    const fileObjects = videoFiles.slice(0, effectiveLimit).map(file => ({
      id: nanoid(),
      file,
      preview: URL.createObjectURL(file),
      status: "pending" as const,
      progress: 0,
    }));

    setFiles(prev => [...prev, ...fileObjects].slice(0, effectiveLimit));
  };

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;

    const videoFiles = Array.from(newFiles).filter(file => 
      file.type.startsWith('video/')
    );

    if (videoFiles.length === 0) {
      toast({
        title: "No Video Files",
        description: "Please select video files only",
        variant: "destructive",
      });
      return;
    }

    // Check for large files
    const large = videoFiles.filter(f => f.size > LARGE_FILE_THRESHOLD_MB * 1024 * 1024);
    const normal = videoFiles.filter(f => f.size <= LARGE_FILE_THRESHOLD_MB * 1024 * 1024);

    if (large.length > 0) {
      setLargeFiles(large);
      setPendingFiles(normal);
      setShowLargeFileWarning(true);
    } else {
      addFilesToQueue(videoFiles);
    }
  };

  const handleLargeFileConfirm = () => {
    // User confirmed - add all files including large ones
    const allFiles = [...pendingFiles, ...largeFiles];
    addFilesToQueue(allFiles);
    setShowLargeFileWarning(false);
    setLargeFiles([]);
    setPendingFiles([]);
    
    toast({
      title: "Large Files Added",
      description: `${largeFiles.length} large file(s) queued. Upload may take longer.`,
    });
  };

  const handleLargeFileCancel = () => {
    // User cancelled - only add normal sized files
    if (pendingFiles.length > 0) {
      addFilesToQueue(pendingFiles);
    }
    setShowLargeFileWarning(false);
    setLargeFiles([]);
    setPendingFiles([]);
    
    if (pendingFiles.length > 0) {
      toast({
        title: "Smaller Files Added",
        description: `${largeFiles.length} large file(s) skipped. Consider compressing them first.`,
      });
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  const removeFile = (fileId: string) => {
    const controller = abortControllersRef.current.get(fileId);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(fileId);
    }

    setFiles(prev => {
      const file = prev.find(f => f.id === fileId);
      if (file) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter(f => f.id !== fileId);
    });
  };

  const uploadChunk = async (
    sessionId: string,
    chunk: Blob,
    chunkIndex: number,
    signal: AbortSignal
  ): Promise<boolean> => {
    const formData = new FormData();
    formData.append("chunk", chunk);
    formData.append("sessionId", sessionId);
    formData.append("chunkIndex", String(chunkIndex));

    const response = await fetch("/api/upload/chunk", {
      method: "POST",
      body: formData,
      signal,
    });

    if (!response.ok) {
      throw new Error(`Chunk ${chunkIndex} upload failed`);
    }

    return true;
  };

  const uploadFileWithChunks = async (
    fileItem: FileWithPreview,
    batchIndex: number
  ): Promise<Project | null> => {
    const controller = new AbortController();
    abortControllersRef.current.set(fileItem.id, controller);

    const file = fileItem.file;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    let uploadedChunks = 0;

    try {
      // Step 1: Initialize upload session
      const initResponse = await fetch("/api/upload/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          totalChunks,
          batchId,
          batchIndex,
        }),
        signal: controller.signal,
      });

      if (!initResponse.ok) {
        throw new Error("Failed to initialize upload");
      }

      const { sessionId } = await initResponse.json();

      // Step 2: Upload chunks in parallel
      const chunkPromises: Promise<void>[] = [];
      let activeUploads = 0;
      let currentChunk = 0;

      const uploadNextChunk = async (): Promise<void> => {
        while (currentChunk < totalChunks && activeUploads < MAX_CONCURRENT_CHUNKS) {
          const chunkIndex = currentChunk;
          currentChunk++;
          activeUploads++;

          const start = chunkIndex * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);

          try {
            await uploadChunk(sessionId, chunk, chunkIndex, controller.signal);
            uploadedChunks++;

            const progress = Math.round((uploadedChunks / totalChunks) * 95);
            setFiles(prev => prev.map(f => 
              f.id === fileItem.id 
                ? { ...f, status: "uploading" as const, progress }
                : f
            ));
          } catch (error) {
            throw error;
          } finally {
            activeUploads--;
          }

          await uploadNextChunk();
        }
      };

      // Start parallel chunk uploads
      const parallelStarts = Math.min(MAX_CONCURRENT_CHUNKS, totalChunks);
      for (let i = 0; i < parallelStarts; i++) {
        chunkPromises.push(uploadNextChunk());
      }

      await Promise.all(chunkPromises);

      // Step 3: Complete the upload
      const completeResponse = await fetch("/api/upload/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
        signal: controller.signal,
      });

      if (!completeResponse.ok) {
        throw new Error("Failed to complete upload");
      }

      const { project } = await completeResponse.json();

      setFiles(prev => prev.map(f => 
        f.id === fileItem.id 
          ? { ...f, status: "complete" as const, progress: 100, project }
          : f
      ));

      abortControllersRef.current.delete(fileItem.id);
      return project;

    } catch (error: any) {
      abortControllersRef.current.delete(fileItem.id);

      const errorMsg = error.name === 'AbortError' 
        ? "Upload cancelled" 
        : error.message || "Upload failed";

      setFiles(prev => prev.map(f => 
        f.id === fileItem.id 
          ? { ...f, status: "error" as const, error: errorMsg }
          : f
      ));

      return null;
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast({
        title: "No Files Selected",
        description: "Please add at least one video file",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    const pendingFiles = files.filter(f => f.status === "pending");
    const completedProjects: Project[] = [];

    // Upload files with limited concurrency
    let fileIndex = 0;
    const uploadPromises: Promise<void>[] = [];

    const processNextFile = async (): Promise<void> => {
      while (fileIndex < pendingFiles.length) {
        const currentIndex = fileIndex;
        const fileItem = pendingFiles[currentIndex];
        fileIndex++;

        setFiles(prev => prev.map(f => 
          f.id === fileItem.id 
            ? { ...f, status: "uploading" as const, progress: 0 }
            : f
        ));

        const project = await uploadFileWithChunks(fileItem, currentIndex);
        if (project) {
          completedProjects.push(project);
        }
      }
    };

    // Start concurrent file uploads
    const concurrentStarts = Math.min(MAX_CONCURRENT_FILES, pendingFiles.length);
    for (let i = 0; i < concurrentStarts; i++) {
      uploadPromises.push(processNextFile());
    }

    await Promise.all(uploadPromises);

    setIsUploading(false);

    const successCount = files.filter(f => f.status === "complete").length;
    const failedCount = files.filter(f => f.status === "error").length;

    if (successCount > 0) {
      queryClient.invalidateQueries({ queryKey: ['/api/projects/previous-uploads'] });

      toast({
        title: successCount === files.length ? "Batch Upload Complete" : "Batch Upload Partially Complete",
        description: failedCount > 0 
          ? `${successCount} of ${files.length} videos uploaded. ${failedCount} failed.`
          : `${successCount} videos uploaded successfully! ${compilationMode ? 'Ready for compilation.' : ''}`,
      });

      const successfulProjects = files
        .filter(f => f.status === "complete" && f.project)
        .map(f => f.project!);

      if (!compilationMode) {
        setTimeout(() => {
          onBatchCreated(batchId, successfulProjects);
        }, 1000);
      } else {
        // In compilation mode, keep files visible for clip selection
        toast({
          title: "🎬 Compilation Mode Active",
          description: "Process videos to generate clips, then drag them to create your compilation.",
        });
      }
    } else if (failedCount > 0) {
      toast({
        title: "Upload Failed",
        description: `All ${failedCount} uploads failed. Please try again.`,
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " GB";
  };

  const pendingCount = files.filter(f => f.status === "pending").length;
  const uploadingCount = files.filter(f => f.status === "uploading").length;
  const completeCount = files.filter(f => f.status === "complete").length;
  const errorCount = files.filter(f => f.status === "error").length;

  const cancelAllUploads = () => {
    // Cancel all active uploads
    abortControllersRef.current.forEach((controller) => {
      controller.abort();
    });
    abortControllersRef.current.clear();

    // Reset uploading files to pending or remove them
    setFiles(prev => prev.filter(f => f.status !== "uploading").map(f => 
      f.status === "uploading" ? { ...f, status: "error" as const, error: "Cancelled" } : f
    ));
    setIsUploading(false);
  };

  return (
    <div className="space-y-6">
      {/* Compilation Mode Toggle */}
      <Card className="p-4 bg-gradient-to-r from-primary/5 to-accent/5">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Film className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Multi-Video Compilation</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Upload multiple videos, generate clips, and combine them into one continuous video
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="compilation-mode">Compilation Mode</Label>
            <Button
              variant={compilationMode ? "default" : "outline"}
              size="sm"
              onClick={() => setCompilationMode(!compilationMode)}
              data-testid="toggle-compilation-mode"
            >
              {compilationMode ? "ON" : "OFF"}
            </Button>
          </div>
        </div>
      </Card>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
          transition-colors duration-200
          ${isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}
        `}
        data-testid="batch-upload-dropzone"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
          data-testid="batch-upload-input"
        />
        <Upload className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-xl font-semibold mb-2">
          {isDragActive ? "Drop your videos here" : "Drag & drop videos"}
        </h3>
        <p className="text-muted-foreground mb-4">
          {isUploading 
            ? "Add more videos while uploading (max 10 total)"
            : "or click to select files (max 10 videos, 700MB each)"
          }
        </p>
        <Badge variant="secondary">
          {isUploading ? "Upload in progress - add more anytime" : "Fast parallel uploads with chunking"}
        </Badge>
      </div>

      {files.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">
                Selected Files ({files.length})
              </h3>
              {isUploading && (
                <Badge variant="secondary" className="text-xs">
                  {uploadingCount} uploading • {completeCount} done
                  {errorCount > 0 && ` • ${errorCount} failed`}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isUploading && (
                <Button
                  variant="outline"
                  onClick={cancelAllUploads}
                  data-testid="button-cancel-all-uploads"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel All
                </Button>
              )}
              <Button
                onClick={handleUpload}
                disabled={isUploading && pendingCount === 0}
                data-testid="button-start-batch-upload"
              >
                {isUploading ? (
                  pendingCount > 0 ? (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Add {pendingCount} More
                    </>
                  ) : (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading {uploadingCount} of {files.length}...
                    </>
                  )
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload {pendingCount} Video{pendingCount > 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="grid gap-3">
            {files.map((fileItem) => (
              <Card key={fileItem.id} className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-16 h-16 bg-muted rounded flex items-center justify-center">
                    {fileItem.status === "complete" ? (
                      <CheckCircle2 className="w-8 h-8 text-green-500" />
                    ) : fileItem.status === "error" ? (
                      <AlertCircle className="w-8 h-8 text-destructive" />
                    ) : fileItem.status === "uploading" ? (
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    ) : (
                      <Video className="w-8 h-8 text-muted-foreground" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <p className="font-medium truncate" title={fileItem.file.name}>
                        {fileItem.file.name}
                      </p>
                      {(fileItem.status === "pending" || fileItem.status === "error" || fileItem.status === "uploading") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(fileItem.id);
                          }}
                          data-testid={`button-remove-file-${fileItem.id}`}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(fileItem.file.size)}
                      {fileItem.status === "uploading" && ` • ${fileItem.progress}%`}
                      {fileItem.status === "complete" && " • Complete"}
                      {fileItem.status === "error" && (
                        <span className="text-destructive"> • {fileItem.error || "Failed"}</span>
                      )}
                    </p>
                    {fileItem.status === "uploading" && (
                      <Progress value={fileItem.progress} className="mt-2" />
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Large File / Optimization Dialog with Time Credits */}
      <Dialog open={showLargeFileWarning} onOpenChange={setShowLargeFileWarning}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              Optimize Your Files
            </DialogTitle>
            <DialogDescription>
              We can optimize {largeFiles.length} file{largeFiles.length > 1 ? 's' : ''} for faster editing. 
              This uses <strong>time credits</strong> instead of payment.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 my-4 max-h-[200px] overflow-y-auto">
            {largeFiles.map((file, idx) => {
              const sizeGB = file.size / (1024 * 1024 * 1024);
              const timeCostMinutes = Math.ceil(sizeGB * 15); // 15 min per GB
              const format = file.name.split('.').pop()?.toLowerCase() || '';
              const needsConvert = !['mp4', 'webm'].includes(format);
              
              return (
                <div key={idx} className="p-3 bg-muted rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <Video className="h-5 w-5 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium truncate" title={file.name}>{file.name}</span>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {sizeGB.toFixed(2)}GB
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Compress: ~{timeCostMinutes}min time credit</span>
                    {needsConvert && <span className="text-amber-600">+ Convert to MP4</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Time Credit Explanation */}
          <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 rounded-lg border border-indigo-200 dark:border-indigo-800">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-indigo-900 dark:text-indigo-100">
                  What are Time Credits?
                </p>
                <p className="text-xs text-indigo-700 dark:text-indigo-300">
                  Instead of paying, optimization uses time credits. This may adjust your account renewal by a few hours or days based on usage. 
                  <strong> No payment required - just processing time.</strong>
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <Button 
              variant="outline" 
              onClick={handleLargeFileConfirm}
              className="flex flex-col h-auto py-3"
              data-testid="button-upload-original"
            >
              <FileVideo className="h-5 w-5 mb-1" />
              <span className="text-sm font-medium">Upload Original</span>
              <span className="text-xs text-muted-foreground">No optimization</span>
            </Button>
            <Button 
              onClick={() => {
                // Add files with optimization flag
                const allFiles = [...pendingFiles, ...largeFiles];
                const fileObjects = allFiles.slice(0, currentFileLimit).map(file => ({
                  id: nanoid(),
                  file,
                  preview: URL.createObjectURL(file),
                  status: "pending" as const,
                  progress: 0,
                  needsOptimization: file.size > LARGE_FILE_THRESHOLD_MB * 1024 * 1024,
                }));
                setFiles(prev => [...prev, ...fileObjects].slice(0, currentFileLimit));
                setShowLargeFileWarning(false);
                setLargeFiles([]);
                setPendingFiles([]);
                toast({
                  title: "Files Queued for Optimization",
                  description: "Large files will be compressed using time credits",
                });
              }}
              className="flex flex-col h-auto py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
              data-testid="button-optimize-upload"
            >
              <Zap className="h-5 w-5 mb-1" />
              <span className="text-sm font-medium">Optimize & Upload</span>
              <span className="text-xs opacity-80">Use time credits</span>
            </Button>
          </div>
          
          <p className="text-xs text-center text-muted-foreground mt-2">
            By choosing optimize, you agree to use time credits for processing
          </p>
        </DialogContent>
      </Dialog>

      {/* File Limit Warning Dialog with Time Credits */}
      <Dialog open={showFileLimitWarning} onOpenChange={setShowFileLimitWarning}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Film className="h-5 w-5 text-amber-500" />
              Batch Limit Reached
            </DialogTitle>
            <DialogDescription>
              You're trying to add {excessFiles.length} more file{excessFiles.length > 1 ? 's' : ''} beyond the {DEFAULT_FILE_LIMIT}-file limit.
              Extend your limit using <strong>time credits</strong> instead of payment.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 my-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Current limit</span>
                <Badge variant="secondary">{DEFAULT_FILE_LIMIT} files</Badge>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Files waiting</span>
                <Badge variant="outline" className="text-amber-600 border-amber-300">+{excessFiles.length} files</Badge>
              </div>
              <Separator className="my-3" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Extended limit</span>
                <Badge className="bg-indigo-600">{EXTENDED_FILE_LIMIT} files</Badge>
              </div>
            </div>

            {/* Files preview */}
            <div className="max-h-[120px] overflow-y-auto space-y-2">
              {excessFiles.slice(0, 5).map((file, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Video className="h-4 w-4" />
                  <span className="truncate">{file.name}</span>
                  <span className="text-xs shrink-0">({(file.size / (1024 * 1024)).toFixed(1)}MB)</span>
                </div>
              ))}
              {excessFiles.length > 5 && (
                <p className="text-xs text-muted-foreground">...and {excessFiles.length - 5} more files</p>
              )}
            </div>
          </div>

          {/* Time Credit Explanation */}
          <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 rounded-lg border border-indigo-200 dark:border-indigo-800">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-indigo-900 dark:text-indigo-100">
                  Extend with Time Credits
                </p>
                <p className="text-xs text-indigo-700 dark:text-indigo-300">
                  Processing extra files uses ~5 minutes of time credits per file. This may adjust your renewal date by a few hours.
                  <strong> No payment required.</strong>
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowFileLimitWarning(false);
                setExcessFiles([]);
                toast({
                  title: "Extra Files Skipped",
                  description: `${excessFiles.length} file(s) were not added. Limit is ${DEFAULT_FILE_LIMIT} files.`,
                });
              }}
              className="flex flex-col h-auto py-3"
              data-testid="button-skip-excess-files"
            >
              <X className="h-5 w-5 mb-1" />
              <span className="text-sm font-medium">Keep Limit</span>
              <span className="text-xs text-muted-foreground">Skip extra files</span>
            </Button>
            <Button 
              onClick={() => {
                setHasExtendedLimit(true);
                addFilesToQueue(excessFiles, true);
                setShowFileLimitWarning(false);
                setExcessFiles([]);
                toast({
                  title: "Limit Extended",
                  description: `You can now upload up to ${EXTENDED_FILE_LIMIT} files using time credits`,
                });
              }}
              className="flex flex-col h-auto py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
              data-testid="button-extend-limit"
            >
              <Zap className="h-5 w-5 mb-1" />
              <span className="text-sm font-medium">Extend Limit</span>
              <span className="text-xs opacity-80">Use time credits</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}