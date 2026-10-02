import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Navbar } from "@/components/navbar";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProjectSchema, type InsertProject, type Project } from "@shared/schema";
import { ExternalLink, FolderKanban, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Projects() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, setLocation]);

  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects/user", user?.id],
    enabled: !!user?.id,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Omit<InsertProject, "userId" | "status">>({
    resolver: zodResolver(insertProjectSchema.omit({ userId: true, status: true })),
    defaultValues: {
      title: "",
      link: "",
      description: "",
      courseId: "1",
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: async (data: Omit<InsertProject, "userId" | "status">) => {
      return apiRequest("POST", "/api/projects", {
        ...data,
        userId: user?.id,
        status: "pending",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects/user", user?.id] });
      toast({
        title: "Project Submitted",
        description: "Your project has been submitted for review.",
      });
      reset();
    },
    onError: (error: any) => {
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit project. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: Omit<InsertProject, "userId" | "status">) => {
    createProjectMutation.mutate(data);
  };

  if (!user) return null;

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "reviewed":
        return {
          label: "Reviewed",
          icon: CheckCircle2,
          variant: "default" as const,
          className: "bg-chart-3 text-white",
        };
      case "needs_revision":
        return {
          label: "Needs Revision",
          icon: AlertCircle,
          variant: "secondary" as const,
          className: "bg-chart-4 text-white",
        };
      case "pending":
      default:
        return {
          label: "Pending Review",
          icon: Clock,
          variant: "secondary" as const,
          className: "bg-chart-1 text-white",
        };
    }
  };

  const formatDate = (dateStr: string | Date) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
            Project Submissions
          </h1>
          <p className="text-lg text-muted-foreground">
            Submit your course projects and track their review status
          </p>
        </div>

        {/* Submission Form */}
        <Card className="border-card-border mb-12 bg-accent/20">
          <CardHeader>
            <CardTitle className="text-2xl">Submit New Project</CardTitle>
            <CardDescription className="text-base">
              Share your project work for review and feedback
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-sm font-medium">
                    Project Title
                  </Label>
                  <Input
                    id="title"
                    placeholder="My Awesome Project"
                    data-testid="input-project-title"
                    {...register("title")}
                    className={errors.title ? "border-destructive" : ""}
                  />
                  {errors.title && (
                    <p className="text-sm text-destructive">{errors.title.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="link" className="text-sm font-medium">
                    Project Link
                  </Label>
                  <Input
                    id="link"
                    type="url"
                    placeholder="https://github.com/username/project"
                    data-testid="input-project-link"
                    {...register("link")}
                    className={errors.link ? "border-destructive" : ""}
                  />
                  {errors.link && (
                    <p className="text-sm text-destructive">{errors.link.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium">
                  Project Description
                </Label>
                <Textarea
                  id="description"
                  placeholder="Describe your project, what you built, and what you learned..."
                  rows={5}
                  data-testid="input-project-description"
                  {...register("description")}
                  className={errors.description ? "border-destructive" : ""}
                />
                {errors.description && (
                  <p className="text-sm text-destructive">{errors.description.message}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={createProjectMutation.isPending}
                data-testid="button-submit-project"
              >
                {createProjectMutation.isPending ? "Submitting..." : "Submit Project"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Project History */}
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-foreground mb-2">
            Your Submitted Projects
          </h2>
          <p className="text-muted-foreground">
            View all your submitted projects and their review status
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-6">
            {[1, 2].map((i) => (
              <Card key={i} className="border-card-border">
                <CardHeader>
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !projects || projects.length === 0 ? (
          <Card className="border-card-border">
            <CardContent className="py-12">
              <div className="text-center">
                <FolderKanban className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  No Projects Yet
                </h3>
                <p className="text-muted-foreground">
                  Submit your first project using the form above
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {projects.map((project) => {
              const statusInfo = getStatusInfo(project.status);
              const StatusIcon = statusInfo.icon;

              return (
                <Card key={project.id} className="border-card-border hover-elevate">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-xl mb-1">{project.title}</CardTitle>
                        <CardDescription className="text-sm">
                          Course Project
                        </CardDescription>
                      </div>
                      <Badge className={statusInfo.className}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {statusInfo.label}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="pb-3">
                    <p className="text-sm text-foreground leading-relaxed mb-4">
                      {project.description}
                    </p>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span>Submitted on {formatDate(project.submittedAt)}</span>
                    </div>
                  </CardContent>

                  <CardFooter className="pt-3">
                    <Button
                      variant="secondary"
                      className="gap-2"
                      asChild
                      data-testid={`button-view-project-${project.id}`}
                    >
                      <a href={project.link} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4" />
                        View Project
                      </a>
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
