
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Sparkles,
  FileText,
  Search,
  TrendingUp,
  Copy,
  Download,
  Zap,
  BarChart3,
  Share2,
  Edit3
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ContentStudio() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // AEO Content
  const [aeoTopic, setAeoTopic] = useState("");
  const [aeoKeywords, setAeoKeywords] = useState("");
  const [aeoResult, setAeoResult] = useState<any>(null);
  
  // Blog Post
  const [blogTopic, setBlogTopic] = useState("");
  const [blogKeywords, setBlogKeywords] = useState("");
  const [blogTone, setBlogTone] = useState("professional");
  const [blogLength, setBlogLength] = useState("medium");
  const [blogResult, setBlogResult] = useState<any>(null);
  
  // LLM Optimization
  const [llmContent, setLlmContent] = useState("");
  const [llmTopic, setLlmTopic] = useState("");
  const [llmResult, setLlmResult] = useState<any>(null);
  
  // Content Analysis
  const [analyzeContent, setAnalyzeContent] = useState("");
  const [analyzeKeywords, setAnalyzeKeywords] = useState("");
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  const generateAEOContent = async () => {
    if (!aeoTopic.trim()) {
      toast({ title: "Error", description: "Please enter a topic", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const result = await apiRequest("POST", "/api/content-studio/aeo-content", {
        topic: aeoTopic,
        keywords: aeoKeywords.split(",").map(k => k.trim()).filter(Boolean),
      });
      setAeoResult(result);
      toast({ title: "Success", description: "AEO content generated!" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate content", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const generateBlogPost = async () => {
    if (!blogTopic.trim()) {
      toast({ title: "Error", description: "Please enter a topic", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const result = await apiRequest("POST", "/api/content-studio/blog-post", {
        topic: blogTopic,
        keywords: blogKeywords.split(",").map(k => k.trim()).filter(Boolean),
        tone: blogTone,
        length: blogLength,
      });
      setBlogResult(result);
      toast({ title: "Success", description: "Blog post generated!" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate blog post", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const optimizeForLLM = async () => {
    if (!llmContent.trim() || !llmTopic.trim()) {
      toast({ title: "Error", description: "Please provide content and topic", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const result = await apiRequest("POST", "/api/content-studio/llm-optimize", {
        content: llmContent,
        topic: llmTopic,
      });
      setLlmResult(result);
      toast({ title: "Success", description: "Content optimized for LLM search!" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to optimize content", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const analyzeContentQuality = async () => {
    if (!analyzeContent.trim()) {
      toast({ title: "Error", description: "Please provide content to analyze", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const result = await apiRequest("POST", "/api/content-studio/analyze", {
        content: analyzeContent,
        targetKeywords: analyzeKeywords.split(",").map(k => k.trim()).filter(Boolean),
      });
      setAnalysisResult(result);
      toast({ title: "Success", description: "Content analyzed!" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to analyze content", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: "Content copied to clipboard" });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Content Studio</h1>
              <p className="text-sm text-muted-foreground">AEO, LLM Search & Blog Generation</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12">
        <Tabs defaultValue="aeo" className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full max-w-2xl">
            <TabsTrigger value="aeo">
              <Search className="mr-2 h-4 w-4" />
              AEO Content
            </TabsTrigger>
            <TabsTrigger value="blog">
              <FileText className="mr-2 h-4 w-4" />
              Blog Post
            </TabsTrigger>
            <TabsTrigger value="llm">
              <Zap className="mr-2 h-4 w-4" />
              LLM Optimize
            </TabsTrigger>
            <TabsTrigger value="analyze">
              <BarChart3 className="mr-2 h-4 w-4" />
              Analyze
            </TabsTrigger>
          </TabsList>

          {/* AEO Content Generation */}
          <TabsContent value="aeo" className="space-y-6">
            <Card className="p-6">
              <div className="space-y-4">
                <div>
                  <Label>Topic</Label>
                  <Input
                    placeholder="e.g., How to optimize videos for AI search engines"
                    value={aeoTopic}
                    onChange={(e) => setAeoTopic(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Keywords (comma-separated)</Label>
                  <Input
                    placeholder="AI search, video optimization, answer engines"
                    value={aeoKeywords}
                    onChange={(e) => setAeoKeywords(e.target.value)}
                  />
                </div>
                <Button onClick={generateAEOContent} disabled={loading} className="w-full">
                  <Sparkles className="mr-2 h-4 w-4" />
                  {loading ? "Generating..." : "Generate AEO Content"}
                </Button>
              </div>
            </Card>

            {aeoResult && (
              <Card className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Generated AEO Content</h3>
                  <Button variant="outline" size="sm" onClick={() => copyToClipboard(JSON.stringify(aeoResult, null, 2))}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy All
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Direct Answer</Label>
                    <p className="mt-2 p-3 bg-muted rounded-lg">{aeoResult.directAnswer}</p>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Key Points</Label>
                    <ul className="mt-2 space-y-1">
                      {aeoResult.keyPoints?.map((point: string, i: number) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-primary">•</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">FAQ Suggestions</Label>
                    <div className="mt-2 space-y-3">
                      {aeoResult.faqSuggestions?.map((faq: any, i: number) => (
                        <div key={i} className="p-3 bg-muted rounded-lg">
                          <p className="font-medium">{faq.question}</p>
                          <p className="text-sm text-muted-foreground mt-1">{faq.answer}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">LLM Search Optimized</Label>
                    <p className="mt-2 p-3 bg-muted rounded-lg">{aeoResult.llmSearchOptimized}</p>
                  </div>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* Blog Post Generation */}
          <TabsContent value="blog" className="space-y-6">
            <Card className="p-6">
              <div className="space-y-4">
                <div>
                  <Label>Topic</Label>
                  <Input
                    placeholder="e.g., Complete Guide to AI Video Editing"
                    value={blogTopic}
                    onChange={(e) => setBlogTopic(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Keywords (comma-separated)</Label>
                  <Input
                    placeholder="AI video editing, automation, content creation"
                    value={blogKeywords}
                    onChange={(e) => setBlogKeywords(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Tone</Label>
                    <Select value={blogTone} onValueChange={setBlogTone}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="casual">Casual</SelectItem>
                        <SelectItem value="educational">Educational</SelectItem>
                        <SelectItem value="persuasive">Persuasive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Length</Label>
                    <Select value={blogLength} onValueChange={setBlogLength}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="short">Short (800-1200 words)</SelectItem>
                        <SelectItem value="medium">Medium (1500-2000 words)</SelectItem>
                        <SelectItem value="long">Long (2500-3500 words)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={generateBlogPost} disabled={loading} className="w-full">
                  <FileText className="mr-2 h-4 w-4" />
                  {loading ? "Generating..." : "Generate Blog Post"}
                </Button>
              </div>
            </Card>

            {blogResult && (
              <Card className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{blogResult.title}</h3>
                    <div className="flex gap-2 mt-2">
                      <Badge>SEO Score: {blogResult.seoScore}</Badge>
                      <Badge variant="secondary">{blogResult.readingTime} min read</Badge>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => copyToClipboard(blogResult.content)}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy
                  </Button>
                </div>

                <div className="p-3 bg-muted rounded-lg">
                  <Label className="text-xs font-medium">Meta Description</Label>
                  <p className="text-sm mt-1">{blogResult.metaDescription}</p>
                </div>

                <div>
                  <Label className="text-sm font-medium">Content Preview</Label>
                  <div className="mt-2 p-4 bg-muted rounded-lg prose prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap font-sans">{blogResult.content?.substring(0, 500)}...</pre>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Keywords</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {blogResult.keywords?.map((keyword: string, i: number) => (
                      <Badge key={i} variant="outline">{keyword}</Badge>
                    ))}
                  </div>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* LLM Optimization */}
          <TabsContent value="llm" className="space-y-6">
            <Card className="p-6">
              <div className="space-y-4">
                <div>
                  <Label>Topic</Label>
                  <Input
                    placeholder="e.g., AI Video Editing Benefits"
                    value={llmTopic}
                    onChange={(e) => setLlmTopic(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Original Content</Label>
                  <Textarea
                    placeholder="Paste your existing content here to optimize it for LLM search engines..."
                    value={llmContent}
                    onChange={(e) => setLlmContent(e.target.value)}
                    rows={8}
                  />
                </div>
                <Button onClick={optimizeForLLM} disabled={loading} className="w-full">
                  <Zap className="mr-2 h-4 w-4" />
                  {loading ? "Optimizing..." : "Optimize for LLM Search"}
                </Button>
              </div>
            </Card>

            {llmResult && (
              <Card className="p-6 space-y-4">
                <h3 className="text-lg font-semibold">Optimized Content</h3>

                <div>
                  <Label className="text-sm font-medium">Improvements Made</Label>
                  <ul className="mt-2 space-y-1">
                    {llmResult.improvements?.map((improvement: string, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <TrendingUp className="h-4 w-4 text-green-500 mt-0.5" />
                        <span className="text-sm">{improvement}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <Label className="text-sm font-medium">Semantic Keywords Added</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {llmResult.semanticKeywords?.map((keyword: string, i: number) => (
                      <Badge key={i} variant="secondary">{keyword}</Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Optimized Content</Label>
                  <div className="mt-2 p-4 bg-muted rounded-lg">
                    <pre className="whitespace-pre-wrap font-sans text-sm">{llmResult.optimizedContent}</pre>
                  </div>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => copyToClipboard(llmResult.optimizedContent)}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Optimized Content
                  </Button>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* Content Analysis */}
          <TabsContent value="analyze" className="space-y-6">
            <Card className="p-6">
              <div className="space-y-4">
                <div>
                  <Label>Content to Analyze</Label>
                  <Textarea
                    placeholder="Paste your content here to analyze SEO and AEO quality..."
                    value={analyzeContent}
                    onChange={(e) => setAnalyzeContent(e.target.value)}
                    rows={8}
                  />
                </div>
                <div>
                  <Label>Target Keywords (optional, comma-separated)</Label>
                  <Input
                    placeholder="keyword1, keyword2, keyword3"
                    value={analyzeKeywords}
                    onChange={(e) => setAnalyzeKeywords(e.target.value)}
                  />
                </div>
                <Button onClick={analyzeContentQuality} disabled={loading} className="w-full">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  {loading ? "Analyzing..." : "Analyze Content"}
                </Button>
              </div>
            </Card>

            {analysisResult && (
              <Card className="p-6 space-y-4">
                <h3 className="text-lg font-semibold">Content Analysis Results</h3>

                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div className="text-3xl font-bold text-primary">{analysisResult.seoScore}</div>
                    <div className="text-sm text-muted-foreground">SEO Score</div>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div className="text-3xl font-bold text-blue-600">{analysisResult.aeoScore}</div>
                    <div className="text-sm text-muted-foreground">AEO Score</div>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div className="text-3xl font-bold text-green-600">{analysisResult.readability}</div>
                    <div className="text-sm text-muted-foreground">Readability</div>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Suggestions for Improvement</Label>
                  <ul className="mt-2 space-y-2">
                    {analysisResult.suggestions?.map((suggestion: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 p-2 bg-muted rounded">
                        <Edit3 className="h-4 w-4 text-primary mt-0.5" />
                        <span className="text-sm">{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <Label className="text-sm font-medium">Missing Elements</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {analysisResult.missingElements?.map((element: string, i: number) => (
                      <Badge key={i} variant="destructive">{element}</Badge>
                    ))}
                  </div>
                </div>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
