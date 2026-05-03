import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Sparkles,
  Zap,
  Film,
  Gamepad2,
  Music,
  Mic,
  ChefHat,
  Laugh,
  GraduationCap,
  Megaphone,
  Check,
  ExternalLink,
} from "lucide-react";

interface BrandReference {
  id: string;
  brand: string;
  category: string;
  subcategory?: string;
  description: string;
  editingStyle: {
    pacing: string;
    cutTempo: number;
    transitionTypes: string[];
    colorGrading: string;
    hookDuration: number;
    energyCurve: number[];
  };
  signatureElements: string[];
  youtubeChannelId?: string;
  tikTokHandle?: string;
}

interface BrandReferencePickerProps {
  projectId: string;
  currentCategory?: string;
  onStyleApplied?: (brand: string) => void;
}

const CATEGORY_ICONS: Record<string, typeof Zap> = {
  action: Zap,
  gaming: Gamepad2,
  cooking: ChefHat,
  educational: GraduationCap,
  music_video: Music,
  comedy: Laugh,
  podcast: Mic,
  talking_head: Mic,
  marketing: Megaphone,
  trailer: Film,
};

const CATEGORY_LABELS: Record<string, string> = {
  action: "Action & Sports",
  gaming: "Gaming",
  cooking: "Cooking & Food",
  educational: "Educational",
  music_video: "Music Video",
  comedy: "Comedy",
  podcast: "Podcast",
  talking_head: "Talking Head",
  marketing: "Marketing",
  trailer: "Trailers",
};

export function BrandReferencePicker({
  projectId,
  currentCategory,
  onStyleApplied,
}: BrandReferencePickerProps) {
  const [open, setOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(currentCategory || "action");
  const { toast } = useToast();

  const { data: brandData, isLoading } = useQuery<{
    references: BrandReference[];
    categories: string[];
  }>({
    queryKey: ["/api/brand-references"],
    enabled: open,
  });

  const applyStyleMutation = useMutation({
    mutationFn: async (referenceId: string) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/apply-brand-style`, { referenceId });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: `${data.appliedStyle?.brand} Style Applied`,
        description: data.message || `${data.appliedStyle?.brand} editing style has been applied`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "videos"] });
      onStyleApplied?.(data.appliedStyle?.brand);
      setOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to apply style",
        variant: "destructive",
      });
    },
  });

  const filteredReferences = brandData?.references.filter(
    (ref) => ref.category === selectedCategory
  ) || [];

  const CategoryIcon = CATEGORY_ICONS[selectedCategory] || Film;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-brand-reference">
          <Sparkles className="h-4 w-4 mr-2" />
          Brand Styles
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Brand Reference Library
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Apply editing styles from top brands. These are curated patterns extracted from professional content.
        </p>

        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList className="flex flex-wrap h-auto gap-1">
            {brandData?.categories.map((cat) => {
              const Icon = CATEGORY_ICONS[cat] || Film;
              return (
                <TabsTrigger
                  key={cat}
                  value={cat}
                  className="flex items-center gap-1 text-xs"
                  data-testid={`tab-category-${cat}`}
                >
                  <Icon className="h-3 w-3" />
                  {CATEGORY_LABELS[cat] || cat}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <ScrollArea className="h-[400px] mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-pulse text-muted-foreground">Loading brand references...</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-4">
                {filteredReferences.map((ref) => (
                  <Card
                    key={ref.id}
                    className="hover-elevate cursor-pointer"
                    onClick={() => applyStyleMutation.mutate(ref.id)}
                    data-testid={`card-brand-${ref.id}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <CategoryIcon className="h-4 w-4 text-primary" />
                          {ref.brand}
                        </CardTitle>
                        <Badge variant="secondary" className="text-xs">
                          {ref.subcategory?.replace(/_/g, " ") || ref.category}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {ref.description}
                      </p>

                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-xs">
                          {ref.editingStyle.pacing} pacing
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {ref.editingStyle.colorGrading}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {ref.editingStyle.cutTempo}ms cuts
                        </Badge>
                      </div>

                      <div className="text-xs text-muted-foreground">
                        <strong>Signature:</strong>{" "}
                        {ref.signatureElements.slice(0, 2).join(", ")}
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <div className="flex gap-2">
                          {ref.youtubeChannelId && (
                            <a
                              href={`https://youtube.com/channel/${ref.youtubeChannelId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                              YouTube
                            </a>
                          )}
                          {ref.tikTokHandle && (
                            <a
                              href={`https://tiktok.com/${ref.tikTokHandle}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                              TikTok
                            </a>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={applyStyleMutation.isPending}
                          data-testid={`button-apply-${ref.id}`}
                        >
                          {applyStyleMutation.isPending ? (
                            "Applying..."
                          ) : (
                            <>
                              <Check className="h-3 w-3 mr-1" />
                              Apply
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {filteredReferences.length === 0 && (
                  <div className="col-span-2 text-center py-8 text-muted-foreground">
                    No brand references found for this category
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
