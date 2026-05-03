import { useState, useRef, ChangeEvent, DragEvent, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card"; // Import CardContent
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload, X, CheckCircle2, Loader2, AlertCircle, Info, Sparkles } from "lucide-react"; // Import Sparkles
import type { Project } from "@shared/schema";
import { ProcessingOptionSelector } from "./processing-option-selector";
import { useDropzone, type DropzoneOptions } from 'react-dropzone'; // Import useDropzone

interface ResumableUploadProps {
  onUploadComplete: (project: Project) => void;
  onCancel?: () => void;
  onUploadStatusChange?: (isUploading: boolean) => void;
}

interface FileWithStatus {
  file: File;
  preview: string | null; // Preview can be null if not a video or if an error occurs
  status: "pending" | "uploading" | "paused" | "complete" | "error" | "ready";
  progress: number;
  uploadedBytes: number;
  sessionId: string | null;
  completedChunks: number;
  totalChunks: number;
  error?: string;
}

const CHUNK_SIZE = 25 * 1024 * 1024; // 25MB chunks for faster uploads (fewer network requests)
const PARALLEL_UPLOADS = 4; // Number of chunks to upload simultaneously for 2-3x speed boost

const getUploadMessage = (completed: number, total: number): string => {
  const percent = (completed / total) * 100;

  if (percent < 20) {
    const messages = [
      `🚀 Launching chunk ${completed} of ${total}...`,
      `📤 Beaming up ${completed}/${total} pieces...`,
      `🎯 Uploading ${completed}/${total} - we're just getting started!`,
    ];
    return messages[completed % messages.length];
  } else if (percent < 50) {
    const messages = [
      `⚡ Zooming through ${completed}/${total}!`,
      `🔥 On fire! ${completed}/${total} chunks processed`,
      `💨 Flying through chunk ${completed} of ${total}`,
    ];
    return messages[completed % messages.length];
  } else if (percent < 80) {
    const messages = [
      `🎸 Rocking chunk ${completed}/${total}!`,
      `⭐ More than halfway! ${completed}/${total}`,
      `🌟 Crushing it - ${completed}/${total} done`,
    ];
    return messages[completed % messages.length];
  } else {
    const messages = [
      `🏁 Almost there! ${completed}/${total}`,
      `🎉 Final stretch - ${completed}/${total}!`,
      `✨ So close! ${completed}/${total} chunks`,
    ];
    return messages[completed % messages.length];
  }
};

export function ResumableUpload({ onUploadComplete, onCancel, onUploadStatusChange }: ResumableUploadProps) {
  const { toast } = useToast();
  const [fileState, setFileState] = useState<FileWithStatus | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [showProcessingOffer, setShowProcessingOffer] = useState(false);
  const [processingChoice, setProcessingChoice] = useState<{
    operation: 'original' | 'compress' | 'convert' | 'both';
    quality?: 'low' | 'medium' | 'high';
    targetFormat?: string;
  } | null>(null);

  // Notify parent when upload status changes
  useEffect(() => {
    if (onUploadStatusChange) {
      onUploadStatusChange(fileState?.status === "uploading");
    }
  }, [fileState?.status, onUploadStatusChange]);

  // Warn user before leaving during upload
  useEffect(() => {
    if (!fileState || fileState.status !== "uploading") return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
      return "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [fileState?.status]);

  // Save session to localStorage for recovery
  useEffect(() => {
    if (fileState?.sessionId && fileState.status === "uploading") {
      localStorage.setItem(
        "resumable_upload_session",
        JSON.stringify({
          sessionId: fileState.sessionId,
          fileName: fileState.file.name,
          fileSize: fileState.file.size,
          totalChunks: fileState.totalChunks,
          completedChunks: fileState.completedChunks,
          timestamp: Date.now(),
        })
      );
    } else {
      localStorage.removeItem("resumable_upload_session");
    }
  }, [fileState?.sessionId, fileState?.status, fileState?.completedChunks]);

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles || newFiles.length === 0) return;

    const file = newFiles[0];

    if (!file.type.startsWith("video/")) {
      toast({
        title: "Invalid File",
        description: "Please select a video file",
        variant: "destructive",
      });
      return;
    }

    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    const fileSizeMB = file.size / (1024 * 1024);
    const isLarge = fileSizeMB > 100; // Show processing options for files > 100MB
    const fileFormat = file.name.split('.').pop()?.toLowerCase();
    const isNonOptimalFormat = fileFormat && !['mp4', 'webm'].includes(fileFormat);

    setFileState({
      file,
      preview: URL.createObjectURL(file),
      status: "ready",
      progress: 0,
      uploadedBytes: 0,
      sessionId: null,
      completedChunks: 0,
      totalChunks,
    });

    // Show processing options if file is large OR in non-optimal format
    if (isLarge || isNonOptimalFormat) {
      setShowProcessingOffer(true);
    } else {
      // Auto-select original for small, optimal files
      setProcessingChoice({ operation: 'original' });
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const onDrop = (acceptedFiles: File[]) => {
    handleFiles(acceptedFiles as unknown as FileList);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  const initiateUpload = useMutation({
    mutationFn: async (file: File) => {
      const response = await fetch("/api/upload/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          processingConfig: processingChoice,
        }),
      });
      if (!response.ok) throw new Error("Failed to initiate upload");
      const data = await response.json();
      return data.sessionId;
    },
  });

  const uploadChunk = async (
    sessionId: string,
    chunkIndex: number,
    chunkData: Blob,
    signal: AbortSignal
  ): Promise<boolean> => {
    const formData = new FormData();
    formData.append("sessionId", sessionId);
    formData.append("chunkIndex", chunkIndex.toString());
    formData.append("chunk", chunkData);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(true);
        } else {
          reject(new Error(`Chunk upload failed: ${xhr.statusText}`));
        }
      });

      xhr.addEventListener("error", () => {
        reject(new Error("Chunk upload failed"));
      });

      xhr.addEventListener("abort", () => {
        reject(new Error("Upload aborted"));
      });

      signal.addEventListener("abort", () => {
        xhr.abort();
      });

      xhr.open("POST", "/api/upload/chunk");
      xhr.send(formData);
    });
  };

  const finalizeUpload = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await fetch("/api/upload/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!response.ok) throw new Error("Failed to finalize upload");
      const data = await response.json();
      return { project: data.project, compression: data.compression };
    },
  });

  const isUploading = fileState?.status === "uploading";

  const dropzone = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.mov', '.avi', '.mkv', '.webm']
    },
    multiple: false,
    disabled: isUploading
  });

  const { getRootProps, getInputProps, isDragActive } = dropzone;

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!fileState) throw new Error("No file selected");
      if (!processingChoice) throw new Error("Processing choice not made");

      abortControllerRef.current = new AbortController();

      try {
        // Step 1: Initiate upload session
        setFileState((prev) =>
          prev ? { ...prev, status: "uploading" as const } : null
        );

        const sessionId = await initiateUpload.mutateAsync(fileState.file);

        setFileState((prev) =>
          prev ? { ...prev, sessionId } : null
        );

        // Step 2: Upload chunks in parallel batches for 2-3x speed boost
        let completedCount = 0;
        const totalChunks = fileState.totalChunks;

        // Process chunks in parallel batches
        for (let batchStart = 0; batchStart < totalChunks; batchStart += PARALLEL_UPLOADS) {
          const batchEnd = Math.min(batchStart + PARALLEL_UPLOADS, totalChunks);
          const batchPromises: Promise<void>[] = [];

          // Create parallel upload promises for this batch
          for (let i = batchStart; i < batchEnd; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, fileState.file.size);
            const chunkData = fileState.file.slice(start, end);

            // Create upload promise with retry logic
            const uploadPromise = (async () => {
              let retries = 3;
              let uploaded = false;

              while (retries > 0 && !uploaded) {
                try {
                  await uploadChunk(
                    sessionId,
                    i,
                    chunkData,
                    abortControllerRef.current!.signal
                  );
                  uploaded = true;
                } catch (error) {
                  retries--;
                  if (retries === 0) throw error;
                  await new Promise((resolve) => setTimeout(resolve, 1000));
                }
              }
            })();

            batchPromises.push(uploadPromise);
          }

          // Wait for all chunks in this batch to complete
          await Promise.all(batchPromises);

          // Update progress after batch completes
          completedCount = batchEnd;
          const uploadedBytes = Math.min(completedCount * CHUNK_SIZE, fileState.file.size);
          const progress = Math.round((completedCount / totalChunks) * 100);

          setFileState((prev) =>
            prev
              ? {
                  ...prev,
                  uploadedBytes,
                  completedChunks: completedCount,
                  progress: Math.min(progress, 95), // Cap progress at 95% before finalize
                }
              : null
          );
        }

        // Step 3: Finalize upload (may include compression)
        setFileState((prev) =>
          prev
            ? {
                ...prev,
                progress: 96,
              }
            : null
        );

        const result = await finalizeUpload.mutateAsync(sessionId);

        setFileState((prev) =>
          prev
            ? {
                ...prev,
                status: "complete" as const,
                progress: 100,
              }
            : null
        );

        return result;
      } catch (error: any) {
        if (error.message !== "Upload aborted") {
          setFileState((prev) =>
            prev
              ? {
                  ...prev,
                  status: "error" as const,
                  error: error.message,
                }
              : null
          );
          throw error;
        }
      }
    },
    onSuccess: (result) => {
      const { project, compression } = result as { 
        project: any; 
        compression?: { applied: boolean; savingsPercent?: number; error?: string } 
      };

      let description = `${fileState?.file.name} uploaded successfully!`;
      if (compression?.applied && compression.savingsPercent) {
        description += ` Compressed by ${compression.savingsPercent.toFixed(1)}%`;
      }

      toast({
        title: "Upload Complete",
        description,
      });

      setTimeout(() => {
        onUploadComplete(project);
      }, 1000);
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload video",
        variant: "destructive",
      });
    },
  });

  const handleUpload = () => {
    if (!processingChoice) {
      toast({
        title: "Please make a choice",
        description: "Please select a processing option before uploading.",
      });
      setShowProcessingOffer(true);
      return;
    }
    uploadMutation.mutate();
  };

  const handlePause = () => {
    abortControllerRef.current?.abort();
    setFileState((prev) =>
      prev ? { ...prev, status: "paused" as const } : null
    );
  };

  const handleResume = () => {
    if (!fileState) return;
    // Resetting abort controller for the new upload attempt
    abortControllerRef.current = new AbortController();
    uploadMutation.mutate();
  };

  const handleCancel = () => {
    abortControllerRef.current?.abort();
    if (fileState?.preview) {
      URL.revokeObjectURL(fileState.preview);
    }
    setFileState(null);
    setShowProcessingOffer(false);
    setProcessingChoice(null);
    if (onCancel) onCancel();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="space-y-4">
      {!fileState ? (
        <div
          {...getRootProps()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
            isDragActive
              ? "border-purple-500 bg-purple-500/5"
              : "border-border/40 hover:border-border/60"
          }`}
          onClick={() => fileInputRef.current?.click()}
          data-testid="dropzone-resumable-upload"
        >
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 rounded-2xl border border-border/30 bg-card/50">
              <Upload className="w-8 h-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-foreground">Drag and drop your video here</h3>
              <p className="text-sm text-muted-foreground">
                or click to select a file (resumable uploads supported)
              </p>
            </div>
            <Button
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="border-border/50 hover:bg-card"
              data-testid="button-select-file"
            >
              Select Video
            </Button>
          </div>
          <input {...getInputProps()} ref={fileInputRef} className="hidden" data-testid="input-file" />
        </div>
      ) : (
        <Card className="border-2 border-purple-500/20 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
          <CardContent className="pt-6">
            <div
              {...getRootProps()}
              className={`relative flex flex-col items-center justify-center p-12 rounded-xl transition-all cursor-pointer ${
                isDragActive
                  ? "border-2 border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20"
                  : "border-2 border-dashed border-purple-500/30 hover:border-purple-500/50 hover:bg-purple-500/5"
              }`}
            >
              {!isUploading && (
                <>
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center mb-6 shadow-lg shadow-purple-500/30">
                    <Upload className="h-10 w-10 text-white" />
                  </div>
                  <p className="text-xl font-semibold mb-2 text-white">
                    Drop your video here or click to browse
                  </p>
                  <p className="text-sm text-gray-400 mb-6">
                    Supports MP4, MOV, AVI up to 2GB
                  </p>
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-0 shadow-lg shadow-purple-500/30"
                  >
                    <Sparkles className="mr-2 h-5 w-5" />
                    Start New Project
                  </Button>
                </>
              )}
            </div>
          </CardContent>

          {showProcessingOffer && fileState && (
            <ProcessingOptionSelector
              file={fileState.file}
              onSelect={(choice) => {
                setProcessingChoice(choice);
                setShowProcessingOffer(false);
              }}
              onCancel={() => {
                setProcessingChoice({ operation: 'original' });
                setShowProcessingOffer(false);
              }}
            />
          )}

          <div className="flex items-start justify-between gap-4 p-6 border-t border-purple-500/20">
            <div className="flex items-start gap-4 flex-1">
              {fileState.preview && (
                <video
                  src={fileState.preview}
                  className="w-20 h-20 rounded object-cover bg-muted"
                  controls
                />
              )}
              <div className="flex-1">
                <h3 className="font-semibold truncate text-white">{fileState.file.name}</h3>
                <p className="text-sm text-gray-400">
                  {formatFileSize(fileState.file.size)}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  {fileState.status === "ready" && (
                    <Badge variant="outline" className="text-purple-300 border-purple-300">Ready to upload</Badge>
                  )}
                  {fileState.status === "uploading" && (
                    <Badge variant="default" className="gap-1 bg-purple-600 hover:bg-purple-700">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Uploading
                    </Badge>
                  )}
                  {fileState.status === "paused" && (
                    <Badge variant="secondary">Paused</Badge>
                  )}
                  {fileState.status === "complete" && (
                    <Badge variant="default" className="gap-1 bg-green-600 hover:bg-green-700">
                      <CheckCircle2 className="w-3 h-3" />
                      Complete
                    </Badge>
                  )}
                  {fileState.status === "error" && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Error
                    </Badge>
                  )}
                  {fileState.status === "uploading" && (
                    <span className="text-xs text-gray-400">
                      {getUploadMessage(fileState.completedChunks, fileState.totalChunks)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {fileState.status !== "complete" && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCancel}
                disabled={uploadMutation.isPending || fileState.status === "uploading"}
                data-testid="button-remove-file"
                className="text-gray-400 hover:text-red-500"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          <div className="space-y-2 p-6 border-t border-purple-500/20">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Progress</span>
              <span className="font-medium text-white">{fileState.progress}%</span>
            </div>
            <Progress value={fileState.progress} className="h-2 bg-gray-700 [&>div]:bg-purple-500"/>
            {fileState.status === "uploading" && (
              <p className="text-xs text-gray-400">
                {formatFileSize(fileState.uploadedBytes)} /{" "}
                {formatFileSize(fileState.file.size)}
              </p>
            )}
          </div>


          {fileState.error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded mx-6 mb-6">
              {fileState.error}
            </div>
          )}

          <div className="flex gap-2 p-6 border-t border-purple-500/20">
            {fileState.status === "ready" && (
              <Button
                onClick={handleUpload}
                disabled={uploadMutation.isPending || !processingChoice}
                className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                data-testid="button-start-upload"
              >
                {uploadMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  "Start Upload"
                )}
              </Button>
            )}

            {fileState.status === "uploading" && (
              <Button
                variant="outline"
                onClick={handlePause}
                disabled={uploadMutation.isPending}
                className="flex-1 border-purple-500/30 text-purple-300 hover:bg-purple-500/5"
                data-testid="button-pause-upload"
              >
                Pause
              </Button>
            )}

            {fileState.status === "paused" && (
              <Button
                onClick={handleResume}
                disabled={uploadMutation.isPending}
                className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                data-testid="button-resume-upload"
              >
                Resume
              </Button>
            )}

            {fileState.status === "error" && (
              <Button
                onClick={handleResume} // Use handleResume for retry logic
                className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                data-testid="button-retry-upload"
              >
                Retry
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}