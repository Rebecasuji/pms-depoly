import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, CheckCircle2, Clock, AlertCircle, ListChecks, Tag, ChevronDown, ChevronUp } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface KeyStep {
  id: string;
  projectId: string;
  parentKeyStepId?: string | null;
  header: string;
  title: string;
  description: string;
  requirements: string;
  phase: number;
  status: "pending" | "in-progress" | "completed";
  startDate: string;
  endDate: string;
}

export default function KeyStepsFullPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [keySteps, setKeySteps] = useState<KeyStep[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [nestedSteps, setNestedSteps] = useState<Record<string, KeyStep[]>>({});

  // Load projects
  useEffect(() => {
    const savedProjectId = localStorage.getItem("selectedProjectId");

    apiFetch("/api/projects")
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load projects");
        return r.json();
      })
      .then(data => {
        setProjects(data);
        const idToUse = savedProjectId || (data.length > 0 ? data[0].id : "");
        setSelectedProjectId(idToUse);
      })
      .catch(err => {
        console.error("Projects load error:", err);
        toast({ variant: "destructive", title: "Error", description: "Failed to load projects" });
      });
  }, [toast]);

  // Load keysteps when project changes
  useEffect(() => { 
    if (!selectedProjectId) return;
    localStorage.setItem("selectedProjectId", selectedProjectId);
    
    apiFetch(`/api/projects/${selectedProjectId}/key-steps`)
      .then(r => r.json())
      .then(data => {
        const rootSteps = Array.isArray(data) ? data.filter(ks => !ks.parentKeyStepId) : [];
        setKeySteps(rootSteps);
      })
      .catch(err => {
        console.error("Failed to load key steps:", err);
        setKeySteps([]);
      });
  }, [selectedProjectId]);

  const getProjectName = (id: string) => projects.find((p: any) => p.id === id)?.title || "Unknown Project";

  // Load nested steps
  const loadNestedSteps = async (parentId: string) => {
    if (nestedSteps[parentId]) return;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await apiFetch(`/api/key-steps/${parentId}/children`, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.error("Failed to fetch children:", response.statusText);
        setNestedSteps(prev => ({ ...prev, [parentId]: [] }));
        return;
      }
      
      const data = await response.json();
      setNestedSteps(prev => ({
        ...prev,
        [parentId]: Array.isArray(data) ? data : [],
      }));
    } catch (err) {
      console.error("Error loading nested steps:", err);
      setNestedSteps(prev => ({ ...prev, [parentId]: [] }));
    }
  };

  const toggleExpand = (id: string) => {
    if (expandedStepId === id) {
      setExpandedStepId(null);
    } else {
      setExpandedStepId(id);
      loadNestedSteps(id);
    }
  };

  const openEditPage = (step: KeyStep) => {
    setLocation(`/add-key-step?projectId=${step.projectId}&keyStepId=${step.id}`);
  };

  const handleDeleteStep = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}"?`)) return;

    try {
      const response = await apiFetch(`/api/key-steps/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete");

      toast({ title: "Deleted", description: "Key step deleted successfully" });
      
      if (selectedProjectId) {
        apiFetch(`/api/projects/${selectedProjectId}/key-steps`)
          .then(r => r.json())
          .then(data => {
            const rootSteps = Array.isArray(data) ? data.filter(ks => !ks.parentKeyStepId) : [];
            setKeySteps(rootSteps);
          });
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete key step" });
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === "completed") return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    if (status === "in-progress") return <Clock className="h-5 w-5 text-blue-500" />;
    return <AlertCircle className="h-5 w-5 text-amber-500" />;
  };

  const getStatusColor = (status: string) => {
    if (status === "completed") return "bg-green-100 text-green-800";
    if (status === "in-progress") return "bg-blue-100 text-blue-800";
    return "bg-amber-100 text-amber-800";
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold">Key Steps & Milestones</h1>
            <p className="text-muted-foreground mt-1">Manage project phases and milestones effectively.</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col md:flex-row items-center gap-4 mb-8 bg-white p-4 rounded-lg border">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground mb-2">Project</p>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[300px] overflow-y-auto">
                {projects.length > 0 ? (
                  projects.map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>
                  ))
                ) : (
                  <div className="p-2 text-xs text-muted-foreground">No projects available</div>
                )}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={() => setLocation(`/add-key-step?projectId=${selectedProjectId}`)} className="w-full md:w-auto">
            <Plus className="mr-2 h-4 w-4" /> New Key Step
          </Button>
        </div>

        {/* Key Steps List */}
        <div className="space-y-4">
          {keySteps.length > 0 ? (
            keySteps.map((step) => (
              <div key={step.id}>
                <Card 
                  className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-primary"
                  onClick={() => {
                    // Navigate directly to Tasks for this key step
                    localStorage.setItem("selectedProjectId", String(step.projectId));
                    localStorage.setItem("selectedKeyStepId", String(step.id));
                    setLocation('/tasks');
                  }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        {getStatusIcon(step.status)}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <CardTitle className="text-lg">{step.title}</CardTitle>
                            <Badge variant="outline" className="text-xs">Phase {step.phase}</Badge>
                          </div>
                          {step.header && <p className="text-sm text-muted-foreground">{step.header}</p>}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openEditPage(step); }}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteStep(step.id, step.title); }}><Trash2 className="h-4 w-4" /></Button>
                        <div className="ml-2">{expandedStepId === step.id ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}</div>
                      </div>
                    </div>
                  </CardHeader>

                  {expandedStepId === step.id && (
                    <CardContent className="border-t pt-4">
                      <div className="space-y-3 mb-4">
                        {step.description && <div><strong className="text-sm">Description:</strong> <p className="text-sm text-muted-foreground">{step.description}</p></div>}
                        {step.requirements && <div><strong className="text-sm">Requirements:</strong> <p className="text-sm text-muted-foreground">{step.requirements}</p></div>}
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>Starts: {step.startDate}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Ends: {step.endDate}</span>
                        </div>
                        <div>
                          <Badge variant="outline" className={`${getStatusColor(step.status)} capitalize text-xs`}>{step.status.replace("-", " ")}</Badge>
                        </div>
                      </div>

                      {/* Sub-Milestones */}
                      <div className="pt-4 border-t">
                        <div className="mb-3 flex justify-between items-center">
                          <h4 className="font-semibold text-sm">Sub-Milestones ({(nestedSteps[step.id] || []).length})</h4>
                        </div>

                        {(nestedSteps[step.id] || []).length > 0 ? (
                          <div className="space-y-2 mb-3">
                            {(nestedSteps[step.id] || []).map((nested: KeyStep) => (
                              <div key={nested.id} className="p-3 bg-background rounded border border-muted/50 text-sm">
                                <div className="flex items-start justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">{nested.title}</Badge>
                                  </div>
                                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditPage(nested)}><Edit className="h-3 w-3" /></Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDeleteStep(nested.id, nested.title)}><Trash2 className="h-3 w-3" /></Button>
                                  </div>
                                </div>
                                <p className="text-xs text-muted-foreground">{nested.description}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground mb-3">No sub-milestones yet</p>
                        )}

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLocation(`/add-sub-milestone?parentId=${step.id}&projectId=${selectedProjectId}`);
                          }}
                          className="w-full"
                        >
                          <Plus className="h-3 w-3 mr-1" /> Add Sub-Milestone
                        </Button>
                      </div>
                    </CardContent>
                  )}
                </Card>
              </div>
            ))
          ) : (
            <div className="text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">No steps found for this project. Click "New Key Step" to add one.</div>
          )}
        </div>
      </div>
    </div>
  );
}
