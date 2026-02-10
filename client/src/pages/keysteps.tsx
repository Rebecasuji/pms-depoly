import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, CheckCircle2, Clock, AlertCircle, ListChecks, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { apiFetch } from "@/lib/apiClient";

interface KeyStep {
  id: string;
  projectId: string;
  header: string;
  title: string;
  description: string;
  requirements: string;
  phase: number;
  status: "pending" | "in-progress" | "completed";
  startDate: string;
  endDate: string;
  parentKeyStepId?: string | null; // optional, because not all steps have a parent
}

// FORCE absolute API calls to bypass proxy issues
const API_BASE = "";

export default function KeySteps() {
  const [keySteps, setKeySteps] = useState<KeyStep[]>([]);
  const [childKeySteps, setChildKeySteps] = useState<{ [parentId: string]: KeyStep[] }>({});
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const [openDialog, setOpenDialog] = useState(false);
  const [parentKeyStepForSubmilestone, setParentKeyStepForSubmilestone] = useState<KeyStep | null>(null);
  const [newStep, setNewStep] = useState({
    header: "",
    title: "",
    description: "",
    requirements: "",
    phase: 1, // ✅ number
    status: "pending" as const,
    startDate: "",
    endDate: "",
    projectId: "",
    parentKeyStepId: null as string | null,

  });

  const [editingStep, setEditingStep] = useState<KeyStep | null>(null);

  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [stepToDelete, setStepToDelete] = useState<KeyStep | null>(null);


  // Load projects
  useEffect(() => {
    const savedProjectId = localStorage.getItem("selectedProjectId");

    apiFetch(`/api/projects`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load projects");
        return r.json();
      })
      .then((data) => {
        setProjects(data);
        const idToUse = savedProjectId || (data.length > 0 ? String(data[0].id) : "");
        setSelectedProjectId(idToUse);
        setNewStep((prev) => ({ ...prev, projectId: idToUse }));
      })
      .catch((err) => console.error("Projects load error:", err));
  }, []);

  // Load key steps for selected project
  useEffect(() => {
    if (!selectedProjectId) return;

    let isMounted = true;

    const fetchSteps = async () => {
      try {
        const res = await apiFetch(`/api/projects/${selectedProjectId}/key-steps`);

        if (!res.ok) {
          const text = await res.text();
          console.error("Server returned non-ok status:", res.status, text);
          return;
        }

        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          console.error("Expected JSON but received:", contentType);
          return;
        }

        const data = await res.json();
        if (!isMounted) return;
        setKeySteps(Array.isArray(data) ? data : []);

        // Fetch children for each parent keystep
        if (Array.isArray(data)) {
          data.forEach((step: KeyStep) => {
            if (!step.parentKeyStepId) {
              fetchChildrenForStep(step.id);
            }
          });
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.error("Fetch error:", err);
      }
    };

    fetchSteps();
    return () => {
      isMounted = false;
    };
  }, [selectedProjectId]);

  const getProjectName = (id: string) => projects.find((p: any) => p.id === id)?.title || "Unknown Project";

  // Fetch children for a keystep
  const fetchChildrenForStep = async (parentId: string) => {
    try {
      const res = await apiFetch(`/api/key-steps/${parentId}/children`);
      if (res.ok) {
        const children = await res.json();
        setChildKeySteps((prev) => ({ ...prev, [parentId]: children }));
      }
    } catch (err) {
      console.error("Failed to fetch children for step:", parentId, err);
    }
  };

  // Add new key step
  const handleAddStep = async () => {
    if (!selectedProjectId) {
      alert("Please select a project first.");
      return;
    }

    if (!newStep.title || !newStep.startDate || !newStep.endDate) {
      alert("Please fill in Title, Start Date, and End Date.");
      return;
    }

    try {
      const payload = {
        projectId: selectedProjectId,
        parentKeyStepId: newStep.parentKeyStepId || null,
        header: parentKeyStepForSubmilestone ? null : (newStep.header || null),
        title: newStep.title,
        description: parentKeyStepForSubmilestone ? null : (newStep.description || null),
        requirements: parentKeyStepForSubmilestone ? null : (newStep.requirements || null),
        phase: Number(newStep.phase),
        status: newStep.status.toLowerCase(),
        startDate: newStep.startDate,
        endDate: newStep.endDate,
      };
      
      console.log("🔵 SUBMITTING KEYSTEP:", payload);
      
      const response = await apiFetch(`/api/key-steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("❌ API ERROR:", errText);
        throw new Error(`Server Error (${response.status}): ${errText}`);
      }

      const createdStep = await response.json();
      setKeySteps((prev) => [...prev, createdStep]);

      // If this is a submilestone, fetch children again for the parent
      if (createdStep.parentKeyStepId) {
        fetchChildrenForStep(createdStep.parentKeyStepId);
      }

      // If submilestone mode, reset form and keep dialog open
      if (parentKeyStepForSubmilestone) {
        // Clear completely and reset with parent info
        const resetForm = {
          header: "",
          title: "",
          description: "",
          requirements: "",
          phase: 1,
          status: "pending" as const,
          startDate: parentKeyStepForSubmilestone.startDate || "",
          endDate: parentKeyStepForSubmilestone.endDate || "",
          projectId: selectedProjectId,
          parentKeyStepId: parentKeyStepForSubmilestone.id,
        };
        console.log("🟢 FORM RESET FOR NEXT SUBMILESTONE:", resetForm);
        setNewStep(resetForm);
        // Dialog stays open for adding more submilestones
      } else {
        // Normal keystep mode, close dialog
        setNewStep({
          header: "",
          title: "",
          description: "",
          requirements: "",
          phase: 1,
          status: "pending",
          startDate: "",
          endDate: "",
          projectId: selectedProjectId,
          parentKeyStepId: null,
        });
        setOpenDialog(false);
      }
    } catch (error: any) {
      console.error("Full Error Object:", error);
      alert(`Error: ${error.message}`);
    }
  };

  // Delete step
  const handleDeleteStep = async (id: string) => {
    if (!confirm("Are you sure you want to delete this step?")) return;
    try {
      const response = await apiFetch(`/api/key-steps/${id}`, { method: "DELETE" });
      if (response.ok) {
        setKeySteps((prev) => prev.filter((s) => s.id !== id));
        // Clear children cache for this step
        setChildKeySteps((prev) => {
          const updated = { ...prev };
          delete updated[id];
          return updated;
        });
      }
    } catch (error) {
      console.error("Error deleting step:", error);
    }
  };

  // Edit step
  const handleEditStep = (step: KeyStep) => {
    setEditingStep(step);
    setOpenDialog(true);
  };

  const handleUpdateStep = async () => {
    if (!editingStep) return;

    // Validate required fields
    if (!editingStep.title || !editingStep.phase || !editingStep.startDate || !editingStep.endDate) {
      alert("Please fill in Title, Phase, Start Date, and End Date.");
      return;
    }

    try {
      const url = `${API_BASE}/api/key-steps/${editingStep.id}`;

      // Convert date strings to ISO
      const payload = {
        title: editingStep.title,
        header: editingStep.header || "",
        description: editingStep.description || "",
        requirements: editingStep.requirements || "",
        phase: Number(editingStep.phase),
        status: editingStep.status.toLowerCase(),
        startDate: editingStep.startDate,
        endDate: editingStep.endDate,
        projectId: editingStep.projectId || selectedProjectId,
      };

      const res = await apiFetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text(); // Read raw response

      if (!res.ok) {
        console.error("PUT failed response:", text);
        throw new Error(`Update failed (${res.status}): ${text}`);
      }

      // Parse JSON safely
      let updated;
      try {
        updated = JSON.parse(text);
      } catch {
        console.error("Invalid JSON from server:", text);
        throw new Error("Invalid JSON response from server");
      }

      // Update frontend state
      setKeySteps((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      
      // If this is a submilestone, refresh children for its parent
      if (updated.parentKeyStepId) {
        fetchChildrenForStep(updated.parentKeyStepId);
      }
      
      setOpenDialog(false);
      setEditingStep(null);
    } catch (err: any) {
      console.error("Update error details:", err);
      alert("Failed to update step: " + err.message);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "in-progress":
        return <Clock className="h-5 w-5 text-blue-600" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 border-green-200";
      case "in-progress":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const completedSteps = keySteps.filter((s) => s.status === "completed").length;
  const progressPercent = keySteps.length > 0 ? (completedSteps / keySteps.length) * 100 : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-6">
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Key Steps</h1>
          <p className="text-muted-foreground mt-1">Manage project phases and milestones effectively.</p>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold whitespace-nowrap">Project</span>
            <div className="w-56">
              <Select
                value={selectedProjectId}
                onValueChange={(val) => {
                  localStorage.setItem("selectedProjectId", val);
                  setSelectedProjectId(val);
                  setNewStep((prev) => ({ ...prev, projectId: val }));
                }}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select Project" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto">
                  {projects.length > 0 ? (
                    projects.map((p: any) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.title}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-2 text-xs text-muted-foreground">No projects available</div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Dialog
            open={openDialog}
            onOpenChange={(open) => {
              setOpenDialog(open);
              if (!open) {
                setEditingStep(null);
                setParentKeyStepForSubmilestone(null);
              }
            }}
          >
            {!editingStep && !parentKeyStepForSubmilestone && (
              <DialogTrigger asChild>
                <Button className="w-full md:w-auto">
                  <Plus className="mr-2 h-4 w-4" />
                  New Key Step
                </Button>
              </DialogTrigger>
            )}

            <DialogContent className="sm:max-w-[525px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingStep
                    ? "Edit Key Step"
                    : parentKeyStepForSubmilestone
                    ? "Add Sub-Milestone"
                    : "Create New Key Step"}
                </DialogTitle>
                <DialogDescription>
                  {editingStep
                    ? "Update the details of this step."
                    : parentKeyStepForSubmilestone
                    ? `Add a sub-milestone under "${parentKeyStepForSubmilestone.title}"`
                    : "Define a new phase or milestone for your timeline."}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                {parentKeyStepForSubmilestone && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                    <p className="text-sm font-semibold text-blue-900">Parent Milestone:</p>
                    <p className="text-sm text-blue-800">
                      <span className="font-medium">{parentKeyStepForSubmilestone.title}</span>
                      {parentKeyStepForSubmilestone.description && (
                        <div className="text-xs mt-1">{parentKeyStepForSubmilestone.description}</div>
                      )}
                    </p>
                  </div>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="header">Step Header / Category</Label>
                  <Input
                    id="header"
                    placeholder="e.g., UI/UX Design Phase"
                    value={editingStep?.header ?? newStep.header}
                    onChange={(e) =>
                      editingStep
                        ? setEditingStep({ ...editingStep, header: e.target.value })
                        : setNewStep({ ...newStep, header: e.target.value })
                    }
                    disabled={!!parentKeyStepForSubmilestone}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="title">
                    {parentKeyStepForSubmilestone ? "Sub-Milestone Title" : "Step Title"}
                  </Label>
                  <Input
                    id="title"
                    placeholder={parentKeyStepForSubmilestone ? "e.g., Design Review Meeting" : "e.g., Initial Design Review"}
                    value={editingStep?.title ?? newStep.title}
                    onChange={(e) =>
                      editingStep
                        ? setEditingStep({ ...editingStep, title: e.target.value })
                        : setNewStep({ ...newStep, title: e.target.value })
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Detail the objectives of this step..."
                    value={editingStep?.description ?? newStep.description}
                    onChange={(e) =>
                      editingStep
                        ? setEditingStep({ ...editingStep, description: e.target.value })
                        : setNewStep({ ...newStep, description: e.target.value })
                    }
                    disabled={!!parentKeyStepForSubmilestone}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="requirements">Requirements</Label>
                  <Textarea
                    id="requirements"
                    placeholder="List specific requirements for this step..."
                    value={editingStep?.requirements ?? newStep.requirements}
                    onChange={(e) =>
                      editingStep
                        ? setEditingStep({ ...editingStep, requirements: e.target.value })
                        : setNewStep({ ...newStep, requirements: e.target.value })
                    }
                    disabled={!!parentKeyStepForSubmilestone}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="phase">Phase Number</Label>
                    <Input
                      type="number"
                      id="phase"
                      min={1}
                      value={editingStep?.phase ?? newStep.phase}
                      onChange={(e) =>
                        editingStep
                          ? setEditingStep({ ...editingStep, phase: Number(e.target.value) })
                          : setNewStep({ ...newStep, phase: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={editingStep?.status ?? newStep.status}
                      onValueChange={(val: any) =>
                        editingStep
                          ? setEditingStep({ ...editingStep, status: val })
                          : setNewStep({ ...newStep, status: val })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in-progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      type="date"
                      value={editingStep?.startDate ?? newStep.startDate}
                      onChange={(e) =>
                        editingStep
                          ? setEditingStep({ ...editingStep, startDate: e.target.value })
                          : setNewStep({ ...newStep, startDate: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      type="date"
                      value={editingStep?.endDate ?? newStep.endDate}
                      onChange={(e) =>
                        editingStep
                          ? setEditingStep({ ...editingStep, endDate: e.target.value })
                          : setNewStep({ ...newStep, endDate: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setOpenDialog(false);
                    setEditingStep(null);
                    setParentKeyStepForSubmilestone(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={editingStep ? handleUpdateStep : handleAddStep}>
                  {editingStep
                    ? "Save Changes"
                    : parentKeyStepForSubmilestone
                    ? "Create Sub-Milestone"
                    : "Create Step"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Key Steps List */}
      <div className="grid gap-4">
        {keySteps.length > 0 ? (
          keySteps
            .filter((step) => !step.parentKeyStepId) // Only show parent keysteps
            .sort((a, b) => a.phase - b.phase)
            .map((step) => (
              <div key={step.id}>
                <Card
                  className="group hover:border-primary/50 transition-all duration-200 shadow-sm overflow-hidden cursor-pointer"
                  onClick={() => {
                    localStorage.setItem("selectedProjectId", String(selectedProjectId));
                    localStorage.setItem("selectedKeyStepId", String(step.id));
                    window.location.href = '/tasks';
                  }}
                >
                  {step.header && (
                    <div className="bg-muted/30 px-6 py-2 border-b flex items-center gap-2">
                      <Tag className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        {step.header}
                      </span>
                    </div>
                  )}
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex items-center justify-center h-12 w-12 rounded-full bg-background border shadow-sm group-hover:scale-110 transition-transform">
                          {getStatusIcon(step.status)}
                        </div>
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary" className="font-mono">
                              Phase {step.phase}
                            </Badge>
                            <CardTitle className="text-lg">{step.title}</CardTitle>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className={`${getStatusColor(step.status)} capitalize`}>
                              {step.status.replace("-", " ")}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => { e.stopPropagation(); handleEditStep(step); }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={(e) => { e.stopPropagation(); setStepToDelete(step); setOpenDeleteDialog(true); }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pl-20 space-y-4">
                    <p className="text-muted-foreground leading-relaxed">{step.description}</p>
                    {step.requirements && (
                      <div className="bg-primary/5 rounded-lg p-3 border border-primary/10">
                        <div className="flex items-center gap-2 mb-2">
                          <ListChecks className="h-4 w-4 text-primary" />
                          <span className="text-sm font-semibold">Requirements</span>
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{step.requirements}</p>
                      </div>
                    )}
                    <div className="pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setParentKeyStepForSubmilestone(step);
                          setNewStep({
                            header: step.header || "",
                            title: "",
                            description: step.description || "",
                            requirements: step.requirements || "",
                            phase: step.phase,
                            status: "pending",
                            startDate: step.startDate,
                            endDate: step.endDate,
                            projectId: selectedProjectId,
                            parentKeyStepId: step.id,
                          });
                          setOpenDialog(true);
                        }}
                        className="w-full"
                      >
                        <Plus className="h-3 w-3 mr-1" /> Add Sub-Milestone
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Submilestones */}
                {childKeySteps[step.id] && childKeySteps[step.id].length > 0 && (
                  <div className="ml-6 mt-3 space-y-3 border-l-2 border-primary/20 pl-4">
                    {childKeySteps[step.id]
                      .sort((a, b) => a.phase - b.phase)
                      .map((child) => (
                        <Card
                          key={child.id}
                          className="group hover:border-primary/50 transition-all duration-200 shadow-sm bg-primary/2"
                        >
                          <CardHeader className="pb-3 py-3">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3 flex-1">
                                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-background border shadow-sm group-hover:scale-110 transition-transform">
                                  {getStatusIcon(child.status)}
                                </div>
                                <div className="flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline" className="font-mono text-xs">
                                      Sub
                                    </Badge>
                                    <CardTitle className="text-base">{child.title}</CardTitle>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className={`${getStatusColor(child.status)} capitalize text-xs`}>
                                      {child.status.replace("-", " ")}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleEditStep(child)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                  onClick={() => {
                                    setStepToDelete(child);
                                    setOpenDeleteDialog(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="pl-12 space-y-2">
                            {child.description && (
                              <p className="text-sm text-muted-foreground leading-relaxed">{child.description}</p>
                            )}
                            <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground pt-1">
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <span>{child.startDate}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                <span>{child.endDate}</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                )}
              </div>
            ))
        ) : (
          <div className="text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
            No steps found for this project. Click "New Key Step" to add one.
          </div>
        )}

        {/* DELETE CONFIRMATION DIALOG */}
        <Dialog open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Key Step</DialogTitle>
            </DialogHeader>

            <div className="py-2 text-sm text-muted-foreground">
              Are you sure you want to delete
              <span className="font-semibold"> {stepToDelete?.title}</span>?
            </div>

            <DialogFooter className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setOpenDeleteDialog(false);
                  setStepToDelete(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  if (!stepToDelete) return;
                  try {
                    const res = await apiFetch(`/api/key-steps/${stepToDelete.id}`, {
                      method: "DELETE",
                    });
                    if (res.ok) {
                      setKeySteps((prev) => prev.filter((s) => s.id !== stepToDelete.id));
                      setOpenDeleteDialog(false);
                      setStepToDelete(null);
                    } else {
                      const errText = await res.text();
                      throw new Error(errText || "Failed to delete");
                    }
                  } catch (err: any) {
                    console.error("Error deleting step:", err);
                    alert("Delete failed: " + err.message);
                  }
                }}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
