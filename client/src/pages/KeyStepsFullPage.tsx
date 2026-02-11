import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, CheckCircle2, Clock, AlertCircle, ListChecks, Tag, ChevronDown, ChevronUp, Copy } from "lucide-react";
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
    // Multi-select state for keysteps
    const [selectedKeystepIds, setSelectedKeystepIds] = useState<string[]>([]);
    const [quickAddOpen, setQuickAddOpen] = useState(false);
    const [quickKeystepTitle, setQuickKeystepTitle] = useState("");
    const [cloneOpen, setCloneOpen] = useState(false);
    const [cloneKeystep, setCloneKeystep] = useState<KeyStep | null>(null);
    const [cloneTitle, setCloneTitle] = useState("");
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
            <h1 className="text-4xl font-bold">Key Steps</h1>
            <p className="text-muted-foreground mt-1">Manage project phases and key steps effectively.</p>
          </div>
        </div>

        {/* Controls */}

        <div className="flex flex-col md:flex-row items-center gap-4 mb-8 bg-white p-4 rounded-lg border">
          <div className="flex-1 flex items-center gap-2">
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
            {selectedProjectId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedProjectId("")}
                className="h-9 px-2 text-xs"
              >
                Clear
              </Button>
            )}
          </div>

          <Button onClick={() => setLocation(`/add-key-step?projectId=${selectedProjectId}`)} className="w-full md:w-auto">
            <Plus className="mr-2 h-4 w-4" /> New Key Step
          </Button>
        </div>

        {/* Bulk Actions & Quick Add */}
        <div className="flex items-center gap-2 mb-2">
          <Button variant="outline" size="sm" onClick={() => setQuickAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Quick Add Keystep
          </Button>
          {selectedKeystepIds.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => alert(`Bulk action for ${selectedKeystepIds.length} keysteps`)}>
              Bulk Action ({selectedKeystepIds.length})
            </Button>
          )}
        </div>

        {/* Quick Add Modal */}
        {quickAddOpen && (
          <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-30">
            <div className="bg-white rounded-lg p-6 w-96 shadow-lg">
              <h2 className="text-lg font-bold mb-4">Quick Add Keystep</h2>
              <input className="w-full border rounded p-2 mb-4" placeholder="Keystep title" value={quickKeystepTitle} onChange={e => setQuickKeystepTitle(e.target.value)} />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setQuickAddOpen(false)}>Cancel</Button>
                <Button variant="default" size="sm" onClick={async () => {
                  if (!quickKeystepTitle.trim()) return;
                  await apiFetch("/api/key-steps", {
                    method: "POST",
                    body: JSON.stringify({
                      projectId: selectedProjectId,
                      title: quickKeystepTitle.trim(),
                      status: "pending",
                      phase: 1,
                      header: "",
                      description: "",
                      requirements: "",
                      startDate: new Date().toISOString(),
                      endDate: new Date().toISOString(),
                    }),
                  });
                  setQuickKeystepTitle("");
                  setQuickAddOpen(false);
                  // Refresh keysteps
                  apiFetch(`/api/projects/${selectedProjectId}/key-steps`).then(r => r.json()).then(data => {
                    setKeySteps(Array.isArray(data) ? data.filter(ks => !ks.parentKeyStepId) : []);
                  });
                }}>Add</Button>
              </div>
            </div>
          </div>
        )}

        {/* Clone Modal */}
        {cloneOpen && cloneKeystep && (
          <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-30">
            <div className="bg-white rounded-lg p-6 w-96 shadow-lg">
              <h2 className="text-lg font-bold mb-4">Clone Keystep</h2>
              <input className="w-full border rounded p-2 mb-4" placeholder="New keystep title" value={cloneTitle} onChange={e => setCloneTitle(e.target.value)} />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setCloneOpen(false)}>Cancel</Button>
                <Button variant="default" size="sm" onClick={async () => {
                  await apiFetch(`/api/key-steps/${cloneKeystep.id}/clone`, {
                    method: "POST",
                    body: JSON.stringify({ newTitle: cloneTitle || cloneKeystep.title }),
                  });
                  setCloneOpen(false);
                  setCloneTitle("");
                  setCloneKeystep(null);
                  // Refresh keysteps
                  apiFetch(`/api/projects/${selectedProjectId}/key-steps`).then(r => r.json()).then(data => {
                    setKeySteps(Array.isArray(data) ? data.filter(ks => !ks.parentKeyStepId) : []);
                  });
                }}>Clone</Button>
              </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto bg-white rounded-lg border">
          {keySteps.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-2 w-8">
                    <input type="checkbox" checked={selectedKeystepIds.length === keySteps.length} onChange={e => {
                      if (e.target.checked) setSelectedKeystepIds(keySteps.map(k => k.id));
                      else setSelectedKeystepIds([]);
                    }} />
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Phase</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Header</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Requirements</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Start</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">End</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {keySteps.map((step) => (
                  <tr key={step.id} className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-2 py-2 w-8">
                      <input type="checkbox" checked={selectedKeystepIds.includes(step.id)} onChange={e => {
                        if (e.target.checked) setSelectedKeystepIds(prev => [...prev, step.id]);
                        else setSelectedKeystepIds(prev => prev.filter(id => id !== step.id));
                      }} />
                    </td>
                    <td className="px-4 py-2 font-medium flex items-center gap-2" onClick={() => {
                      localStorage.setItem("selectedProjectId", String(step.projectId));
                      localStorage.setItem("selectedKeyStepId", String(step.id));
                      setLocation('/tasks');
                    }}>
                      {getStatusIcon(step.status)}
                      {step.title}
                    </td>
                    <td className="px-4 py-2"><Badge variant="outline" className="text-xs">Phase {step.phase}</Badge></td>
                    <td className="px-4 py-2">{step.header}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground max-w-xs truncate" title={step.description}>{step.description}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground max-w-xs truncate" title={step.requirements}>{step.requirements}</td>
                    <td className="px-4 py-2 text-xs">{step.startDate}</td>
                    <td className="px-4 py-2 text-xs">{step.endDate}</td>
                    <td className="px-4 py-2"><Badge variant="outline" className={`${getStatusColor(step.status)} capitalize text-xs`}>{step.status.replace("-", " ")}</Badge></td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => { e.stopPropagation(); openEditPage(step); }}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={e => { e.stopPropagation(); handleDeleteStep(step.id, step.title); }}><Trash2 className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => { e.stopPropagation(); setCloneOpen(true); setCloneKeystep(step); setCloneTitle(step.title); }}><Copy className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">No steps found for this project. Click "New Key Step" to add one.</div>
          )}
        </div>
      </div>
    </div>
  );
}
