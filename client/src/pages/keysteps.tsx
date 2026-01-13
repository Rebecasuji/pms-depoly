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
}

// FORCE absolute API calls to bypass proxy issues
const API_BASE = "";

export default function KeySteps() {
  const [keySteps, setKeySteps] = useState<KeyStep[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const [openDialog, setOpenDialog] = useState(false);
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
  });

  const [editingStep, setEditingStep] = useState<KeyStep | null>(null);

  // Load projects
  useEffect(() => {
    const savedProjectId = localStorage.getItem("selectedProjectId");

    fetch(`${API_BASE}/api/projects`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load projects");
        return r.json();
      })
      .then((data) => {
        setProjects(data);
        const idToUse = savedProjectId || (data.length > 0 ? data[0].id : "");
        setSelectedProjectId(idToUse);
        setNewStep((prev) => ({ ...prev, projectId: idToUse }));
      })
      .catch((err) => console.error("Projects load error:", err));
  }, []);

  // Load key steps for selected project
  useEffect(() => {
    if (!selectedProjectId) return;

    const controller = new AbortController();

    const fetchSteps = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/projects/${selectedProjectId}/key-steps`, {
          signal: controller.signal,
        });

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
        setKeySteps(Array.isArray(data) ? data : []);
      } catch (err: any) {
        if (err.name !== "AbortError") console.error("Fetch error details:", err);
      }
    };

    fetchSteps();
    return () => controller.abort();
  }, [selectedProjectId]);

  const getProjectName = (id: string) => projects.find((p: any) => p.id === id)?.title || "Unknown Project";

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
      const response = await fetch(`${API_BASE}/api/key-steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newStep,
          projectId: selectedProjectId,
          phase: Number(newStep.phase),
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Server Error (${response.status}): ${errText}`);
      }

      const createdStep = await response.json();
      setKeySteps((prev) => [...prev, createdStep]);

      setNewStep({
        header: "",
        title: "",
        description: "",
        requirements: "",
        phase: 1, // reset as number
        status: "pending",
        startDate: "",
        endDate: "",
        projectId: selectedProjectId,
      });

      setOpenDialog(false);
    } catch (error: any) {
      console.error("Full Error Object:", error);
      alert(`Error: ${error.message}`);
    }
  };

  // Delete step
  const handleDeleteStep = async (id: string) => {
    if (!confirm("Are you sure you want to delete this step?")) return;
    try {
      const response = await fetch(`${API_BASE}/api/key-steps/${id}`, { method: "DELETE" });
      if (response.ok) setKeySteps((prev) => prev.filter((s) => s.id !== id));
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

    const res = await fetch(url, {
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Key Steps</h1>
          <p className="text-muted-foreground mt-1">Manage project phases and milestones effectively.</p>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <div className="w-full md:w-64">
            <Select
              value={selectedProjectId}
              onValueChange={(val) => {
                localStorage.setItem("selectedProjectId", val);
                setSelectedProjectId(val);
                setNewStep((prev) => ({ ...prev, projectId: val }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Dialog
            open={openDialog}
            onOpenChange={(open) => {
              setOpenDialog(open);
              if (!open) setEditingStep(null);
            }}
          >
            {!editingStep && (
              <DialogTrigger asChild>
                <Button className="w-full md:w-auto">
                  <Plus className="mr-2 h-4 w-4" />
                  New Key Step
                </Button>
              </DialogTrigger>
            )}

            <DialogContent className="sm:max-w-[525px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingStep ? "Edit Key Step" : "Create New Key Step"}</DialogTitle>
                <DialogDescription>
                  {editingStep
                    ? "Update the details of this step."
                    : "Define a new phase or milestone for your timeline."}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
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
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="title">Step Title</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Initial Design Review"
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
                  }}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={editingStep ? handleUpdateStep : handleAddStep}>
                  {editingStep ? "Save Changes" : "Create Step"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Progress Card */}
      <Card className="border-primary/10 bg-primary/5">
        <CardHeader className="pb-2">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                Overall Progress
                <span className="text-muted-foreground font-normal">|</span>
                <span className="text-primary">{getProjectName(selectedProjectId)}</span>
              </CardTitle>
              <CardDescription>
                {completedSteps} of {keySteps.length} phases completed
              </CardDescription>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-primary">{Math.round(progressPercent)}%</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={progressPercent} className="h-3 shadow-sm" />
        </CardContent>
      </Card>

      {/* Key Steps List */}
      <div className="grid gap-4">
        {keySteps.length > 0 ? (
          keySteps
            .sort((a, b) => a.phase - b.phase)
            .map((step) => (
              <Card
                key={step.id}
                className="group hover:border-primary/50 transition-all duration-200 shadow-sm overflow-hidden"
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
                        onClick={() => handleEditStep(step)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteStep(step.id)}
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
                  <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground pt-2">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>Starts: {step.startDate}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Ends: {step.endDate}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
        ) : (
          <div className="text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
            No steps found for this project. Click "New Key Step" to add one.
          </div>
        )}
      </div>
    </div>
  );
}
