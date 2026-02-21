import { useEffect, useMemo, useState, Fragment } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Copy,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/apiClient";
import { formatDate } from "@/lib/utils";

interface KeyStep {
  id: string;
  projectId: string;
  header?: string | null;
  title: string;

  // kept optional to avoid breaking if backend still returns them
  description?: string | null;
  requirements?: string | null;

  phase: number;
  status: "pending" | "in-progress" | "completed";
  startDate: string;
  endDate: string;
  parentKeyStepId?: string | null;
}

// FORCE absolute API calls to bypass proxy issues
const API_BASE = "";

export default function KeySteps() {
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);

  // Track which keystep is showing the sub-keystep form
  const [showSubFormFor, setShowSubFormFor] = useState<string | null>(null);

  const [keySteps, setKeySteps] = useState<KeyStep[]>([]);
  const [childKeySteps, setChildKeySteps] = useState<Record<string, KeyStep[]>>({});
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [companies, setCompanies] = useState<string[]>([]);
  const [companyFilter, setCompanyFilter] = useState<string>("all");

  const [openDialog, setOpenDialog] = useState(false);
  const [editingStep, setEditingStep] = useState<KeyStep | null>(null);

  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [stepToDelete, setStepToDelete] = useState<KeyStep | null>(null);

  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const [cloneStepData, setCloneStepData] = useState<KeyStep | null>(null);
  const [cloneStepNewTitle, setCloneStepNewTitle] = useState("");
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);

  // Create form state (description/requirements removed)
  const [newStep, setNewStep] = useState({
    header: "",
    projectId: selectedProjectId || "",
    phase: 1,
    status: "pending" as const,
    startDate: "",
    endDate: "",
  });

  // Multiple-title create mode (default 5 empty rows)
  const [newTitles, setNewTitles] = useState<string[]>(
    Array.from({ length: 5 }).map(() => "")
  );

  const updateNewTitle = (idx: number, value: string) =>
    setNewTitles((prev) => prev.map((v, i) => (i === idx ? value : v)));
  const addTitleRow = () => setNewTitles((prev) => [...prev, ""]);
  const removeTitleRow = (idx: number) =>
    setNewTitles((prev) => prev.filter((_, i) => i !== idx));
  const resetNewTitles = (count = 5) =>
    setNewTitles(Array.from({ length: count }).map(() => ""));

  // Load projects
  useEffect(() => {
    const savedProjectId = localStorage.getItem("selectedProjectId");

    apiFetch(`/api/projects`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load projects");
        return r.json();
      })
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        setProjects(arr);
        // Derive unique companies from projects
        const companySet = new Set<string>();
        arr.forEach((p: any) => { if (p.company) companySet.add(String(p.company)); });
        setCompanies(Array.from(companySet));
        if (savedProjectId) setSelectedProjectId(savedProjectId);
      })
      .catch((err) => console.error("Projects load error:", err));
  }, []);

  // Fetch children for a keystep
  const fetchChildrenForStep = async (parentId: string) => {
    try {
      const res = await apiFetch(`/api/key-steps/${parentId}/children`);
      if (res.ok) {
        const children = await res.json();
        setChildKeySteps((prev) => ({
          ...prev,
          [parentId]: Array.isArray(children) ? children : [],
        }));
      }
    } catch (err) {
      console.error("Failed to fetch children for step:", parentId, err);
    }
  };

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

        const arr: KeyStep[] = Array.isArray(data) ? data : [];
        setKeySteps(arr);

        // Fetch children for each parent keystep
        arr.forEach((step) => {
          if (!step.parentKeyStepId) fetchChildrenForStep(step.id);
        });
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

  const parentsSorted = useMemo(() => {
    let filtered = keySteps.filter((s) => !s.parentKeyStepId);

    // Apply company filter
    if (companyFilter !== "all") {
      const selectedProject = projects.find(p => String(p.id) === String(selectedProjectId));
      if (selectedProject && String(selectedProject.company || "").toLowerCase() !== companyFilter.toLowerCase()) {
        filtered = [];
      }
    }

    return filtered
      .slice()
      .sort((a, b) => Number(a.phase) - Number(b.phase) || a.title.localeCompare(b.title));
  }, [keySteps, companyFilter, projects, selectedProjectId]);

  // Create MANY key steps (multiple titles) — description/requirements removed
  const createMultipleSteps = async () => {
    // prefer the project chosen inside the dialog, fall back to page-selected
    const projectIdToUse = (newStep.projectId || selectedProjectId || "").trim();
    if (!projectIdToUse) {
      alert("Please select a project first.");
      return;
    }

    const titles = newTitles.map((t) => t.trim()).filter(Boolean);
    if (titles.length === 0) {
      alert("Please enter at least one title.");
      return;
    }
    if (!newStep.startDate || !newStep.endDate) {
      alert("Please fill in Start Date and End Date.");
      return;
    }

    try {
      const payloads = titles.map((title) => ({
        projectId: projectIdToUse,
        parentKeyStepId: null,
        header: newStep.header || null,
        title,
        // send empty strings so backend won't fail if columns exist
        phase: Number(newStep.phase) || 1,
        status: newStep.status.toLowerCase(),
        startDate: newStep.startDate,
        endDate: newStep.endDate,
      }));

      const responses = await Promise.all(
        payloads.map((p) =>
          apiFetch(`/api/key-steps`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(p),
          })
        )
      );

      const failed = responses.filter((r) => !r.ok);
      if (failed.length > 0) {
        const texts = await Promise.all(
          failed.map((r) => r.text().catch(() => ""))
        );
        console.error("Some creations failed:", texts);
        alert("One or more key steps failed to create. Check console for details.");
      }

      // refresh list
      const updated = await apiFetch(`/api/projects/${selectedProjectId}/key-steps`).then((r) =>
        r.json()
      );

      const arr: KeyStep[] = Array.isArray(updated) ? updated : [];
      setKeySteps(arr);
      arr.forEach((step) => {
        if (!step.parentKeyStepId) fetchChildrenForStep(step.id);
      });

      // reset + close
      resetNewTitles(5);
      setNewStep({ header: "", projectId: selectedProjectId || "", phase: 1, status: "pending", startDate: "", endDate: "" });
      setOpenDialog(false);
    } catch (err) {
      console.error(err);
      alert("Failed to create key steps");
    }
  };

  // Create ONE sub-step (inline row) — description/requirements removed
  const createSubStep = async (parentId: string, title: string, phase: number, startDate: string, endDate: string) => {
    if (!selectedProjectId) return;

    const payload = {
      projectId: selectedProjectId,
      parentKeyStepId: parentId,
      header: null,
      title,
      phase: Number(phase) || 1,
      status: "pending",
      startDate,
      endDate,
    };

    const response = await apiFetch(`/api/key-steps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("❌ API ERROR:", errText);
      throw new Error(errText || "Failed to create sub-step");
    }

    // Refresh children for this parent
    await fetchChildrenForStep(parentId);

    // Refresh parent list too (in case API returns it there as well)
    const updated = await apiFetch(`/api/projects/${selectedProjectId}/key-steps`).then((r) => r.json());
    setKeySteps(Array.isArray(updated) ? updated : []);
  };

  // Update step (used by dialog + inline edit)
  const updateStep = async (step: KeyStep) => {
    if (!step.title || !step.phase || !step.startDate || !step.endDate) {
      alert("Please fill in Title, Phase, Start Date, and End Date.");
      return;
    }

    try {
      const url = `${API_BASE}/api/key-steps/${step.id}`;

      const payload = {
        title: step.title,
        header: step.header || "",
        phase: Number(step.phase),
        status: step.status.toLowerCase(),
        startDate: step.startDate,
        endDate: step.endDate,
        projectId: step.projectId || selectedProjectId,
        parentKeyStepId: step.parentKeyStepId ?? null,
      };

      const res = await apiFetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text();

      if (!res.ok) {
        console.error("PUT failed response:", text);
        throw new Error(`Update failed (${res.status}): ${text}`);
      }

      let updated: KeyStep;
      try {
        updated = JSON.parse(text);
      } catch {
        console.error("Invalid JSON from server:", text);
        throw new Error("Invalid JSON response from server");
      }

      setKeySteps((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));

      if (updated.parentKeyStepId) {
        fetchChildrenForStep(updated.parentKeyStepId);
      }
    } catch (err: any) {
      console.error("Update error details:", err);
      alert("Failed to update step: " + err.message);
    }
  };

  // Clone step
  const handleCloneStep = async () => {
    if (!cloneStepData) return;

    try {
      const response = await apiFetch(`/api/key-steps/${cloneStepData.id}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newTitle: cloneStepNewTitle || undefined }),
      });

      if (!response.ok) throw new Error("Clone failed");

      const updated = await apiFetch(`/api/projects/${selectedProjectId}/key-steps`).then((r) =>
        r.json()
      );

      const arr: KeyStep[] = Array.isArray(updated) ? updated : [];
      setKeySteps(arr);

      arr.forEach((step) => {
        if (!step.parentKeyStepId) fetchChildrenForStep(step.id);
      });

      setCloneStepNewTitle("");
      setCloneDialogOpen(false);
      setCloneStepData(null);
      alert("Key step cloned successfully!");
    } catch (err) {
      alert("Failed to clone key step");
    }
  };

  // Toggle expanded row
  const toggleExpand = (id: string) => {
    setExpandedRows((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
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

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-6">
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Key Steps</h1>
          <p className="text-muted-foreground mt-1">
            Manage project phases and milestones effectively.
          </p>
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

          {/* Company Filter */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold whitespace-nowrap">Company</span>
            <div className="w-56">
              <Select value={companyFilter} onValueChange={setCompanyFilter}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="All Companies" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto">
                  <SelectItem value="all">All Companies</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c} value={c.toLowerCase()}>
                      {c}
                    </SelectItem>
                  ))}
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
                resetNewTitles(5);
                setNewStep({ header: "", projectId: selectedProjectId || "", phase: 1, status: "pending", startDate: "", endDate: "" });
              } else {
                // opening: if edit mode not set, ensure multi-title defaults + prefill project
                if (!editingStep) {
                  resetNewTitles(5);
                  setNewStep((s) => ({ ...s, projectId: selectedProjectId || "" }));
                }
              }
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

            <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingStep ? "Edit Key Step" : "Create Key Steps"}</DialogTitle>
                <DialogDescription>
                  {editingStep
                    ? "Update this step."
                    : "Create multiple steps at once (description and requirements removed)."}
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

                {/* Project selector (create mode only) */}
                {!editingStep && (
                  <div className="grid gap-2">
                    <Label htmlFor="keystepProject">Project</Label>
                    <Select
                      value={newStep.projectId || selectedProjectId}
                      onValueChange={(val) => setNewStep((s) => ({ ...s, projectId: val }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px] overflow-y-auto">
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
                )}

                {/* Title section */}
                {editingStep ? (
                  <div className="grid gap-2">
                    <Label htmlFor="title">Step Title</Label>
                    <Input
                      id="title"
                      placeholder="e.g., Initial Design Review"
                      value={editingStep.title}
                      onChange={(e) => setEditingStep({ ...editingStep, title: e.target.value })}
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Label>Step Titles (create multiple)</Label>
                    <div className="space-y-2">
                      {newTitles.map((t, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <Input
                            placeholder={`Title #${idx + 1}`}
                            value={t}
                            onChange={(e) => updateNewTitle(idx, e.target.value)}
                          />
                          {newTitles.length > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeTitleRow(idx)}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2 items-center">
                      <Button type="button" size="sm" onClick={addTitleRow} variant="ghost">
                        + Add another title
                      </Button>
                      <div className="text-xs text-muted-foreground ml-auto">
                        Empty rows are ignored.
                      </div>
                    </div>
                  </div>
                )}

                {/* Phase + Status */}
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

                {/* Dates */}
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

                <Button
                  type="button"
                  onClick={async () => {
                    if (editingStep) {
                      await updateStep(editingStep);
                      setOpenDialog(false);
                      setEditingStep(null);
                    } else {
                      await createMultipleSteps();
                    }
                  }}
                >
                  {editingStep ? "Save Changes" : "Create Steps"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Key Steps Table (description removed) */}
      <div className="bg-white border rounded-xl overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b">
              <th className="px-3 py-3 text-center text-xs font-bold uppercase text-slate-600 border-r w-10"></th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600 border-r">
                Key Step Name
              </th>
              <th className="px-3 py-3 text-center text-xs font-bold uppercase text-slate-600 border-r w-32">
                Status
              </th>
              <th className="px-3 py-3 text-center text-xs font-bold uppercase text-slate-600 border-r w-28">
                Start Date
              </th>
              <th className="px-3 py-3 text-center text-xs font-bold uppercase text-slate-600 border-r w-28">
                End Date
              </th>
              <th className="px-3 py-3 text-center text-xs font-bold uppercase text-slate-600 border-r w-24">
                Sub-Steps
              </th>
              <th className="px-3 py-3 text-center text-xs font-bold uppercase text-slate-600 w-36">
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {parentsSorted.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-12 text-center text-slate-500">
                  No key steps found for this project. Click "New Key Step" to add one.
                </td>
              </tr>
            ) : (
              parentsSorted.map((step) => (
                <Fragment key={step.id}>
                  {/* INLINE EDIT ROW */}
                  {inlineEditId === step.id && (
                    <tr className="border-b bg-yellow-50">
                      <td className="px-3 py-2 text-center border-r"></td>
                      <td className="px-4 py-2 border-r" colSpan={6}>
                        <form
                          className="flex flex-wrap gap-2 items-center"
                          onSubmit={async (e) => {
                            e.preventDefault();
                            const formEl = e.target as HTMLFormElement;

                            const title = (formEl.elements.namedItem("editTitle") as HTMLInputElement).value;
                            const phase = (formEl.elements.namedItem("editPhase") as HTMLInputElement).value;
                            const startDate = (formEl.elements.namedItem("editStartDate") as HTMLInputElement).value;
                            const endDate = (formEl.elements.namedItem("editEndDate") as HTMLInputElement).value;

                            await updateStep({
                              ...step,
                              title,
                              phase: Number(phase),
                              startDate,
                              endDate,
                            });

                            setInlineEditId(null);
                          }}
                        >
                          <input
                            name="editTitle"
                            defaultValue={step.title}
                            placeholder="Title"
                            className="border rounded px-2 py-1 text-xs"
                          />
                          <input
                            name="editPhase"
                            type="number"
                            min="1"
                            defaultValue={step.phase}
                            placeholder="Phase"
                            className="border rounded px-2 py-1 w-16 text-xs"
                          />
                          <input
                            name="editStartDate"
                            type="date"
                            defaultValue={step.startDate}
                            className="border rounded px-2 py-1 text-xs"
                          />
                          <input
                            name="editEndDate"
                            type="date"
                            defaultValue={step.endDate}
                            className="border rounded px-2 py-1 text-xs"
                          />
                          <button type="submit" className="bg-blue-600 text-white px-2 py-1 rounded text-xs">
                            Save
                          </button>
                          <button
                            type="button"
                            className="ml-2 text-xs text-slate-500 underline"
                            onClick={() => setInlineEditId(null)}
                          >
                            Cancel
                          </button>
                        </form>
                      </td>
                    </tr>
                  )}

                  {/* MAIN KEY STEP ROW */}
                  <tr className="border-b hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-3 text-center border-r">
                      <button
                        onClick={() => toggleExpand(step.id)}
                        className="text-slate-500 hover:text-slate-700"
                      >
                        {expandedRows.includes(step.id) ? (
                          <ChevronDown size={18} />
                        ) : (
                          <ChevronRight size={18} />
                        )}
                      </button>
                    </td>

                    <td className="px-4 py-3 border-r">
                      <div>
                        {step.header ? (
                          <div className="mb-1">
                            <span className="inline-block bg-white border rounded px-2 py-0.5 text-xs text-slate-700">{step.header}</span>
                          </div>
                        ) : null}

                        <div className="text-sm font-medium text-slate-900">
                          <span className="text-xs text-slate-500 font-mono">[Phase {step.phase}]</span>{" "}
                          {step.title}
                        </div>
                      </div>
                    </td>

                    <td className="px-3 py-3 text-center border-r">
                      <Badge
                        variant="outline"
                        className={`text-xs whitespace-nowrap ${getStatusColor(step.status)}`}
                      >
                        {step.status.replace("-", " ")}
                      </Badge>
                    </td>

                    <td className="px-3 py-3 text-center text-sm text-slate-600 border-r">
                      {formatDate(step.startDate)}
                    </td>

                    <td className="px-3 py-3 text-center text-sm text-slate-600 border-r">
                      {formatDate(step.endDate)}
                    </td>

                    <td className="px-3 py-3 text-center border-r">
                      <Badge variant="secondary" className="text-xs">
                        {childKeySteps[step.id]?.length || 0}
                      </Badge>
                    </td>

                    <td className="px-3 py-3 text-center">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => setInlineEditId(step.id)}
                          className="text-blue-600 hover:text-blue-700"
                          title="Edit (inline)"
                        >
                          <Edit size={16} />
                        </button>

                        <button
                          onClick={() => {
                            setEditingStep(step);
                            setOpenDialog(true);
                          }}
                          className="text-indigo-600 hover:text-indigo-700"
                          title="Edit (dialog)"
                        >
                          <Edit size={16} />
                        </button>

                        <button
                          onClick={() => {
                            setCloneStepData(step);
                            setCloneStepNewTitle(`${step.title} (Copy)`);
                            setCloneDialogOpen(true);
                          }}
                          className="text-green-600 hover:text-green-700"
                          title="Clone"
                        >
                          <Copy size={16} />
                        </button>

                        <button
                          onClick={() => {
                            setStepToDelete(step);
                            setOpenDeleteDialog(true);
                          }}
                          className="text-red-600 hover:text-red-700"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>

                        <button
                          onClick={() =>
                            setShowSubFormFor(showSubFormFor === step.id ? null : step.id)
                          }
                          className={`text-purple-700 hover:text-purple-900 border border-purple-200 rounded px-2 py-1 text-xs ml-2 ${showSubFormFor === step.id ? "bg-purple-100" : ""
                            }`}
                          title="Add Sub-Phase"
                        >
                          + Add Sub-Phase
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* EXPANDED SUB-KEYSTEPS ROWS */}
                  {expandedRows.includes(step.id) && (
                    <>
                      {(childKeySteps[step.id] || [])
                        .slice()
                        .sort((a, b) => Number(a.phase) - Number(b.phase) || a.title.localeCompare(b.title))
                        .map((child) => (
                          <tr
                            key={child.id}
                            className="border-b bg-slate-50/50 hover:bg-slate-100 transition-colors"
                          >
                            <td className="px-3 py-2 text-center border-r"></td>

                            <td className="px-4 py-2 border-r">
                              <div className="text-sm font-medium text-slate-900">
                                <span className="text-xs text-slate-500 font-mono">
                                  [Phase {child.phase}]
                                </span>{" "}
                                ↳ {child.title}
                              </div>
                            </td>

                            <td className="px-3 py-2 text-center border-r">
                              <Badge
                                variant="outline"
                                className={`text-xs whitespace-nowrap ${getStatusColor(child.status)}`}
                              >
                                {child.status.replace("-", " ")}
                              </Badge>
                            </td>

                            <td className="px-3 py-2 text-center text-sm text-slate-600 border-r">
                              {formatDate(child.startDate)}
                            </td>

                            <td className="px-3 py-2 text-center text-sm text-slate-600 border-r">
                              {formatDate(child.endDate)}
                            </td>

                            <td className="px-3 py-2 text-center border-r">
                              <Badge variant="outline" className="text-xs">—</Badge>
                            </td>

                            <td className="px-3 py-2 text-center">
                              <div className="flex gap-2 justify-center">
                                <button
                                  onClick={() => {
                                    setEditingStep(child);
                                    setOpenDialog(true);
                                  }}
                                  className="text-blue-600 hover:text-blue-700"
                                  title="Edit"
                                >
                                  <Edit size={16} />
                                </button>

                                <button
                                  onClick={() => {
                                    setCloneStepData(child);
                                    setCloneStepNewTitle(`${child.title} (Copy)`);
                                    setCloneDialogOpen(true);
                                  }}
                                  className="text-green-600 hover:text-green-700"
                                  title="Clone"
                                >
                                  <Copy size={16} />
                                </button>

                                <button
                                  onClick={() => {
                                    setStepToDelete(child);
                                    setOpenDeleteDialog(true);
                                  }}
                                  className="text-red-600 hover:text-red-700"
                                  title="Delete"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}

                      {/* Inline sub-keystep creation row */}
                      {showSubFormFor === step.id && (
                        <tr className="border-b bg-purple-50/75">
                          <td className="px-3 py-2 text-center border-r"></td>
                          <td className="px-4 py-2 border-r" colSpan={6}>
                            <form
                              className="flex flex-wrap gap-2 items-center"
                              onSubmit={async (e) => {
                                e.preventDefault();
                                const formEl = e.target as HTMLFormElement;

                                const title = (formEl.elements.namedItem("subTitle") as HTMLInputElement).value;
                                const phase = (formEl.elements.namedItem("subPhase") as HTMLInputElement).value;
                                const startDate = (formEl.elements.namedItem("subStartDate") as HTMLInputElement).value;
                                const endDate = (formEl.elements.namedItem("subEndDate") as HTMLInputElement).value;

                                if (!title || !phase || !startDate || !endDate) {
                                  alert("Fill all fields");
                                  return;
                                }

                                try {
                                  await createSubStep(step.id, title, Number(phase), startDate, endDate);
                                  formEl.reset();
                                  setShowSubFormFor(null);
                                } catch (err: any) {
                                  alert(err?.message || "Failed to add sub-step");
                                }
                              }}
                            >
                              <input
                                name="subTitle"
                                placeholder="Sub-phase title"
                                className="border rounded px-2 py-1 text-xs"
                              />
                              <input
                                name="subPhase"
                                type="number"
                                min="1"
                                placeholder="Phase"
                                className="border rounded px-2 py-1 w-16 text-xs"
                              />
                              <input
                                name="subStartDate"
                                type="date"
                                className="border rounded px-2 py-1 text-xs"
                              />
                              <input
                                name="subEndDate"
                                type="date"
                                className="border rounded px-2 py-1 text-xs"
                              />
                              <button
                                type="submit"
                                className="bg-purple-600 text-white px-2 py-1 rounded text-xs"
                              >
                                Add Sub-Phase
                              </button>
                              <button
                                type="button"
                                className="ml-2 text-xs text-slate-500 underline"
                                onClick={() => setShowSubFormFor(null)}
                              >
                                Cancel
                              </button>
                            </form>
                          </td>
                        </tr>
                      )}
                    </>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* CLONE DIALOG */}
      <Dialog open={cloneDialogOpen} onOpenChange={setCloneDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Clone Key Step</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="cloneTitle">New Key Step Title</Label>
              <Input
                id="cloneTitle"
                value={cloneStepNewTitle}
                onChange={(e) => setCloneStepNewTitle(e.target.value)}
                placeholder="Enter new title..."
              />
            </div>
          </div>

          <DialogFooter className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setCloneDialogOpen(false);
                setCloneStepData(null);
                setCloneStepNewTitle("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCloneStep}>Clone</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

                    // also remove from cached children
                    setChildKeySteps((prev) => {
                      const next = { ...prev };
                      delete next[stepToDelete.id];
                      // if deleted is a child, refresh its parent
                      if (stepToDelete.parentKeyStepId) {
                        fetchChildrenForStep(stepToDelete.parentKeyStepId);
                      }
                      return next;
                    });

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
  );
}
