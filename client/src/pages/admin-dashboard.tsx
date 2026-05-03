
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { V2TestingChecklist } from "@/components/v2-testing-checklist";
import { ComprehensiveTestChecklist } from "@/components/comprehensive-test-checklist";
import {
  Users,
  Video,
  TrendingUp,
  Activity,
  Database,
  Trash2,
  Search,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  FileVideo,
  Images,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Star,
  Filter,
  Calendar,
  ClipboardCheck,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

interface AdminStats {
  totalUsers: number;
  totalProjects: number;
  totalVideos: number;
  activeProjects: number;
  storageUsed: number;
  projectsByType: {
    video: number;
    carousel: number;
    aiVideo: number;
  };
}

interface ProjectListItem {
  id: string;
  name: string;
  projectType: string;
  status: string;
  userId?: string;
  userEmail?: string;
  duration?: number;
  createdAt: string;
}

interface FeedbackItem {
  id: number;
  projectId: string;
  generatedVideoId?: number;
  videoCategory: string;
  wasAccepted: boolean;
  rating?: number;
  feedbackText?: string;
  clipRatings?: Record<string, number>;
  createdAt: string;
}

interface FeedbackMetrics {
  totalFeedback: number;
  overallAcceptanceRate: number;
  trend: "improving" | "stable" | "declining";
  byCategory: Record<string, {
    total: number;
    accepted: number;
    acceptanceRate: number;
    avgRating?: number;
  }>;
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [feedbackFilter, setFeedbackFilter] = useState<"all" | "positive" | "negative">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [testingView, setTestingView] = useState<"v2" | "comprehensive">("v2");

  // Fetch admin statistics
  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
  });

  // Fetch all projects
  const { data: projects = [], isLoading: projectsLoading } = useQuery<ProjectListItem[]>({
    queryKey: ["/api/admin/projects"],
  });

  // Fetch feedback metrics
  const { data: feedbackMetrics, isLoading: metricsLoading } = useQuery<FeedbackMetrics>({
    queryKey: ["/api/feedback/metrics"],
  });

  // Fetch all feedback data
  const { data: feedbackExport, isLoading: feedbackLoading } = useQuery<{
    editingFeedback: FeedbackItem[];
    clipFeedback: any[];
    learnedWeights: any[];
  }>({
    queryKey: ["/api/feedback/export"],
  });

  // Delete project mutation
  const deleteMutation = useMutation({
    mutationFn: async (projectId: string) => {
      return apiRequest("DELETE", `/api/projects/${projectId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({
        title: "✅ Project Deleted",
        description: "Project and associated files removed successfully",
      });
      setProjectToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "❌ Delete Failed",
        description: error.message || "Failed to delete project",
        variant: "destructive",
      });
    },
  });

  // Filter projects by search term
  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter feedback
  const allFeedback = feedbackExport?.editingFeedback || [];
  const filteredFeedback = allFeedback.filter(f => {
    if (feedbackFilter === "positive" && !f.wasAccepted) return false;
    if (feedbackFilter === "negative" && f.wasAccepted) return false;
    if (categoryFilter !== "all" && f.videoCategory !== categoryFilter) return false;
    return true;
  });

  // Get unique categories from feedback
  const feedbackCategories = Array.from(new Set(allFeedback.map(f => f.videoCategory)));

  // Export feedback as JSON file
  const handleExportFeedback = () => {
    if (!feedbackExport) return;
    const blob = new Blob([JSON.stringify(feedbackExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `feedback-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: "Exported",
      description: "Feedback data downloaded successfully",
    });
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getProjectTypeIcon = (type: string) => {
    switch (type) {
      case "ai-video": return <Sparkles className="h-4 w-4" />;
      case "carousel": return <Images className="h-4 w-4" />;
      default: return <FileVideo className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ready":
        return <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" />Ready</Badge>;
      case "analyzing":
      case "pending":
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />Processing</Badge>;
      case "error":
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Error</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Activity className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-display font-semibold">Admin Dashboard</h1>
              <p className="text-xs text-muted-foreground">System Management & Analytics</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => window.location.href = '/'}>
            ← Back to App
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <Activity className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="projects" data-testid="tab-projects">
              <Video className="h-4 w-4 mr-2" />
              Projects
            </TabsTrigger>
            <TabsTrigger value="feedback" data-testid="tab-feedback">
              <MessageSquare className="h-4 w-4 mr-2" />
              Feedback
            </TabsTrigger>
            <TabsTrigger value="testing" data-testid="tab-testing">
              <ClipboardCheck className="h-4 w-4 mr-2" />
              Testing
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statsLoading ? "-" : stats?.totalUsers || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
              <Video className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statsLoading ? "-" : stats?.totalProjects || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.activeProjects || 0} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Videos Generated</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statsLoading ? "-" : stats?.totalVideos || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsLoading ? "-" : formatBytes(stats?.storageUsed || 0)}
              </div>
            </CardContent>
          </Card>
        </div>

            {/* Project Type Distribution */}
            {stats && (
              <Card>
                <CardHeader>
                  <CardTitle>Project Distribution</CardTitle>
                  <CardDescription>Breakdown by project type</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <FileVideo className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                      <div className="text-2xl font-bold">{stats.projectsByType?.video || 0}</div>
                      <div className="text-sm text-muted-foreground">Video Edits</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <Sparkles className="h-8 w-8 mx-auto mb-2 text-purple-500" />
                      <div className="text-2xl font-bold">{stats.projectsByType?.aiVideo || 0}</div>
                      <div className="text-sm text-muted-foreground">AI Videos</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <Images className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      <div className="text-2xl font-bold">{stats.projectsByType?.carousel || 0}</div>
                      <div className="text-sm text-muted-foreground">Carousels</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Projects Tab */}
          <TabsContent value="projects" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>All Projects</CardTitle>
                <CardDescription>Manage and monitor all system projects</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, email, or ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                      data-testid="input-search-projects"
                    />
                  </div>
                  <Button variant="outline" size="sm" data-testid="button-export-csv">
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>

                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Project</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projectsLoading ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8">
                            Loading projects...
                          </TableCell>
                        </TableRow>
                      ) : filteredProjects.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            No projects found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredProjects.map((project) => (
                          <TableRow key={project.id} data-testid={`row-project-${project.id}`}>
                            <TableCell className="font-medium">
                              <div className="max-w-xs truncate">{project.name}</div>
                              <div className="text-xs text-muted-foreground font-mono">{project.id}</div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getProjectTypeIcon(project.projectType)}
                                <span className="text-sm capitalize">{project.projectType || 'video'}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">{project.userEmail || 'Anonymous'}</div>
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(project.status)}
                            </TableCell>
                            <TableCell>
                              {project.duration ? `${project.duration}s` : '-'}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {new Date(project.createdAt).toLocaleDateString()}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setProjectToDelete(project.id)}
                                data-testid={`button-delete-${project.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Feedback Tab */}
          <TabsContent value="feedback" className="space-y-6">
            {/* Feedback Metrics Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Feedback</CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-feedback">
                    {metricsLoading ? "-" : feedbackMetrics?.totalFeedback || 0}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Acceptance Rate</CardTitle>
                  <ThumbsUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-acceptance-rate">
                    {metricsLoading ? "-" : `${((feedbackMetrics?.overallAcceptanceRate || 0) * 100).toFixed(0)}%`}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Trend</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold capitalize" data-testid="text-trend">
                    {metricsLoading ? "-" : feedbackMetrics?.trend || "stable"}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Categories</CardTitle>
                  <Filter className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-categories-count">
                    {metricsLoading ? "-" : Object.keys(feedbackMetrics?.byCategory || {}).length}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Feedback List */}
            <Card>
              <CardHeader>
                <CardTitle>User Feedback</CardTitle>
                <CardDescription>Review all feedback from users (private - only visible to admins)</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Filters */}
                <div className="flex items-center gap-4 mb-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Filter:</span>
                    <Select value={feedbackFilter} onValueChange={(v) => setFeedbackFilter(v as any)}>
                      <SelectTrigger className="w-32" data-testid="select-feedback-filter">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="positive">Positive</SelectItem>
                        <SelectItem value="negative">Negative</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Category:</span>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="w-40" data-testid="select-category-filter">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {feedbackCategories.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat.replace(/_/g, ' ')}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex-1" />

                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleExportFeedback}
                    disabled={!feedbackExport}
                    data-testid="button-export-feedback"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export JSON
                  </Button>
                </div>

                {/* Feedback Table */}
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Rating</TableHead>
                        <TableHead>Feedback</TableHead>
                        <TableHead>Project</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {feedbackLoading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            Loading feedback...
                          </TableCell>
                        </TableRow>
                      ) : filteredFeedback.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No feedback found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredFeedback.map((feedback) => (
                          <TableRow key={feedback.id} data-testid={`row-feedback-${feedback.id}`}>
                            <TableCell>
                              <div className="flex items-center gap-2 text-sm">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                {new Date(feedback.createdAt).toLocaleDateString()}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(feedback.createdAt).toLocaleTimeString()}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="capitalize">
                                {feedback.videoCategory.replace(/_/g, ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {feedback.wasAccepted ? (
                                <Badge variant="secondary" className="gap-1 bg-green-500/10 text-green-600 dark:text-green-400">
                                  <ThumbsUp className="h-3 w-3" />
                                  Accepted
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="gap-1 bg-red-500/10 text-red-600 dark:text-red-400">
                                  <ThumbsDown className="h-3 w-3" />
                                  Rejected
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {feedback.rating ? (
                                <div className="flex items-center gap-1">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <Star
                                      key={i}
                                      className={`h-4 w-4 ${i < feedback.rating! ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'}`}
                                    />
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </TableCell>
                            <TableCell className="max-w-xs">
                              {feedback.feedbackText ? (
                                <div className="text-sm truncate" title={feedback.feedbackText}>
                                  "{feedback.feedbackText}"
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm italic">No comment</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="text-xs text-muted-foreground font-mono truncate max-w-24" title={feedback.projectId}>
                                {feedback.projectId.slice(0, 8)}...
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {filteredFeedback.length > 0 && (
                  <div className="text-sm text-muted-foreground mt-4">
                    Showing {filteredFeedback.length} of {allFeedback.length} feedback entries
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Category Breakdown */}
            {feedbackMetrics && Object.keys(feedbackMetrics.byCategory).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Category Performance</CardTitle>
                  <CardDescription>Acceptance rates by video category</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(feedbackMetrics.byCategory).map(([category, data]) => (
                      <div key={category} className="flex items-center gap-4" data-testid={`category-stats-${category}`}>
                        <div className="w-32 text-sm capitalize font-medium">
                          {category.replace(/_/g, ' ')}
                        </div>
                        <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                          <div 
                            className="h-full bg-primary transition-all"
                            style={{ width: `${data.acceptanceRate * 100}%` }}
                          />
                        </div>
                        <div className="w-20 text-sm text-right">
                          {(data.acceptanceRate * 100).toFixed(0)}%
                        </div>
                        <div className="w-24 text-sm text-muted-foreground text-right">
                          {data.accepted}/{data.total}
                        </div>
                        {data.avgRating && (
                          <div className="flex items-center gap-1 w-16">
                            <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                            <span className="text-sm">{data.avgRating.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Testing Tab */}
          <TabsContent value="testing" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Feature Testing Status</CardTitle>
                    <CardDescription>Track testing progress across all platform features</CardDescription>
                  </div>
                  <Tabs value={testingView} onValueChange={(v) => setTestingView(v as any)} className="w-auto">
                    <TabsList>
                      <TabsTrigger value="v2">V2.0 Tests</TabsTrigger>
                      <TabsTrigger value="comprehensive">All Features</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardHeader>
              <CardContent>
                {testingView === "v2" ? (
                  <V2TestingChecklist />
                ) : (
                  <ComprehensiveTestChecklist />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this project? This will permanently remove all associated files and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => projectToDelete && deleteMutation.mutate(projectToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
