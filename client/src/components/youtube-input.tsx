import { useState, useRef, useEffect } from "react";
import { Upload, Link2, Loader2, FileVideo, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface PreviousUpload {
  id: string;
  name: string;
  sourceVideoPath: string;
  duration: number;
  createdAt: Date;
}

interface VideoInputProps {
  onUrlSubmit: (url: string) => void;
  onFileSubmit: (file: File) => void;
  onPreviousUploadSelect: (upload: PreviousUpload) => void;
  isLoading: boolean;
  onOpenPreviousUploads?: () => void;
  showUploadTab?: boolean; // Hide upload tab when ResumableUpload is used
}

const MAX_FILE_SIZE = 700 * 1024 * 1024; // 700MB

export function VideoInput({ onUrlSubmit, onFileSubmit, onPreviousUploadSelect, isLoading, onOpenPreviousUploads, showUploadTab = false }: VideoInputProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast(); // Initialize toast

  // Fetch previous uploads
  const { data: previousUploads } = useQuery<PreviousUpload[]>({
    queryKey: ["/api/projects/previous-uploads"],
    enabled: !isLoading,
  });

  const validateVideoUrl = (url: string) => {
    // Support Google Drive, Dropbox, direct video URLs
    const urlRegex = /^https?:\/\/.+/;
    return urlRegex.test(url);
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!url.trim()) {
      setError("Please enter a video URL");
      return;
    }

    if (!validateVideoUrl(url)) {
      setError("Please enter a valid URL");
      return;
    }

    onUrlSubmit(url);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("video/")) {
      if (file.size > MAX_FILE_SIZE) {
        setError(`File size exceeds 700MB limit. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB`);
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      setError("");
    } else {
      setError("Please drop a valid video file");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        setError(`File size exceeds 700MB limit. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB`);
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      setError("");
    }
  };

  const handleFile = (file: File) => {
    // Validate file type
    if (!file.type.startsWith("video/")) {
      setError("Please select a video file");
      return;
    }

    // Validate file size (700MB)
    if (file.size > MAX_FILE_SIZE) {
      setError(`Video file too large. Please select a video under 700MB.`);
      return;
    }

    setSelectedFile(file);
  };

  const uploadWithRetry = async (file: File, retries = 3): Promise<any> => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await new Promise((resolve, reject) => {
          const formData = new FormData();
          formData.append("video", file);
          formData.append("name", file.name);

          const xhr = new XMLHttpRequest();

          // Track upload progress
          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
              const percentComplete = Math.round((e.loaded / e.total) * 100);
              setUploadProgress(percentComplete);
              console.log(`[VideoInput] Upload progress: ${percentComplete}% (attempt ${attempt}/${retries})`);
            }
          });

          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const data = JSON.parse(xhr.responseText);
                console.log("[VideoInput] Upload successful, received project:", data);
                resolve(data);
              } catch (error) {
                console.error("[VideoInput] Failed to parse upload response:", error);
                reject(new Error("Invalid response from server"));
              }
            } else {
              console.error(`[VideoInput] Upload failed with status: ${xhr.status}`);
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          });

          xhr.addEventListener("error", () => {
            console.error("[VideoInput] Network error during upload");
            reject(new Error("Network error during upload"));
          });

          xhr.addEventListener("abort", () => {
            console.warn("[VideoInput] Upload cancelled");
            reject(new Error("Upload cancelled"));
          });

          // Set timeout for long uploads (15 minutes)
          xhr.timeout = 15 * 60 * 1000;
          xhr.addEventListener("timeout", () => {
            console.error("[VideoInput] Upload timeout");
            reject(new Error("Upload timeout - file took too long"));
          });

          console.log(`[VideoInput] Starting upload attempt ${attempt}/${retries} for:`, file.name);
          xhr.open("POST", "/api/projects/upload");
          xhr.send(formData);
        });
      } catch (error: any) {
        console.warn(`[VideoInput] Upload attempt ${attempt}/${retries} failed:`, error.message);
        
        if (attempt === retries) {
          // All retries exhausted
          throw error;
        }
        
        // Wait before retrying (exponential backoff: 1s, 2s, 4s)
        const backoffMs = Math.pow(2, attempt - 1) * 1000;
        console.log(`[VideoInput] Retrying in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
  };

  const handleFileSubmit = async () => {
    if (!selectedFile) return;

    setUploadProgress(0);

    try {
      const data = await uploadWithRetry(selectedFile);
      console.log("[VideoInput] Upload successful after retry logic, received project:", data);
      onFileSubmit(data);
      setSelectedFile(null);
      setUploadProgress(0);
    } catch (error: any) {
      console.error("[VideoInput] Upload failed after all retries:", error);
      
      let errorMessage = "Failed to upload video file after multiple attempts";
      
      // Parse error response for better messaging
      if (error.response?.data?.details) {
        errorMessage = error.response.data.details;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Upload Failed",
        description: errorMessage,
        variant: "destructive",
      });
      setSelectedFile(null);
      setUploadProgress(0);
    }
  };

  // When showUploadTab is false, only show shareable link
  if (!showUploadTab) {
    return (
      <Card className="p-8">
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-semibold">Paste a Shareable Link</h2>
            <p className="text-muted-foreground">
              Google Drive, Dropbox, or direct video URL
            </p>
          </div>

          {onOpenPreviousUploads && (
            <div className="flex justify-center mb-4">
              <Button
                variant="outline"
                onClick={onOpenPreviousUploads}
                data-testid="button-open-previous-uploads"
              >
                <Clock className="mr-2 h-4 w-4" />
                View Previous Uploads
              </Button>
            </div>
          )}

          <form onSubmit={handleUrlSubmit} className="space-y-4">
            <div className="relative">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="https://drive.google.com/... or direct video URL"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setError("");
                }}
                className="pl-10 h-12"
                disabled={isLoading}
                data-testid="input-video-url"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive" data-testid="text-url-error">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full h-12"
              disabled={isLoading}
              data-testid="button-submit-url"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Processing Video...
                </>
              ) : (
                "Start Editing"
              )}
            </Button>
          </form>

          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground text-center">
              We'll analyze your footage and create exactly what you request
            </p>
          </div>
        </div>
      </Card>
    );
  }

  // When showUploadTab is true, show both upload and shareable link tabs
  return (
    <Card className="p-8">
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold">Start Your Edit</h2>
          <p className="text-muted-foreground">
            Upload your raw footage or paste a shareable link
          </p>
        </div>

        {onOpenPreviousUploads && (
          <div className="flex justify-center mb-4">
            <Button
              variant="outline"
              onClick={onOpenPreviousUploads}
              data-testid="button-open-previous-uploads"
            >
              <Clock className="mr-2 h-4 w-4" />
              View Previous Uploads
            </Button>
          </div>
        )}

        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">Upload Video</TabsTrigger>
            <TabsTrigger value="link">Shareable Link</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4 mt-4">
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              data-testid="dropzone-video-upload"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className="hidden"
                disabled={isLoading}
              />

              {selectedFile ? (
                <div className="space-y-3">
                  <FileVideo className="h-12 w-12 text-primary mx-auto" />
                  <div>
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  {uploadProgress > 0 ? (
                    <div className="space-y-2">
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground text-center">
                        {uploadProgress}% uploaded
                      </p>
                    </div>
                  ) : (
                    <Button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleFileSubmit();
                      }}
                      disabled={isLoading}
                      className="mt-2"
                      type="button"
                      data-testid="button-upload-video"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        "Start Editing"
                      )}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <Upload className="h-12 w-12 text-muted-foreground mx-auto" />
                  <div>
                    <p className="font-medium">Drop your video here</p>
                    <p className="text-sm text-muted-foreground">
                      or click to browse (up to 700MB)
                    </p>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <p className="text-sm text-destructive text-center" data-testid="text-upload-error">
                {error}
              </p>
            )}
          </TabsContent>

          <TabsContent value="link" className="space-y-4 mt-4">
            <form onSubmit={handleUrlSubmit} className="space-y-4">
              <div className="relative">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="https://drive.google.com/... or direct video URL"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setError("");
                  }}
                  className="pl-10 h-12"
                  disabled={isLoading}
                  data-testid="input-video-url"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive" data-testid="text-url-error">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="w-full h-12"
                disabled={isLoading}
                data-testid="button-submit-url"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processing Video...
                  </>
                ) : (
                  "Start Editing"
                )}
              </Button>
            </form>

            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                <strong>Supported platforms:</strong> Google Drive, Dropbox, direct video URLs
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground text-center">
            We'll analyze your footage and create exactly what you request
          </p>
        </div>
      </div>
    </Card>
  );
}