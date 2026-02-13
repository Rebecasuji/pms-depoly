import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Edit,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy,
} from "lucide-react";
import { useLocation } from "wouter";

import { Button } from "@/components/ui/button";
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
  header?: string | null;
  title: string;

  // kept optional so UI won’t break if backend still returns them,
  // but we will NOT show them in create/table
  description?: string | null;
  requirements?: string | null;

  phase: number;
  status: "pending" | "in-progress" | "completed";
  startDate: string;
  endDate: string;
}

const isoDateOnly = (d: Date) => d.toISOString().slice(0, 10); // YYYY-MM-DD

export default function KeyStepsFullPage() {
  // Multi-select state for keysteps
  const [selectedKeystepIds, setSelectedKeystepIds] = useState<string[]>([]);

  // Quick Add (MULTIPLE TITLES)
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickTitles, setQuickTitles] = useState<string[]>(
    Array.from({ length: 5 }).map(() => "")
  );

  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneKeystep, setCloneKeystep] = useState<KeyStep | null>(null);
  const [cloneTitle, setCloneTitle] = useState("");

  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [keySteps, setKeySteps] = useState<KeyStep[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  // Load projects
  useEffect(() => {
    const savedProjectId = localStorage.getItem("selectedProjectId");

    apiFetch("/api/projects")
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load projects");
        return r.json();
      })
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        setProjects(arr);

        const idToUse = savedProjectId || (arr.length > 0 ? String(arr[0].id) : "");
        setSelectedProjectId(idToUse);
      })
      .catch((err) => {
        console.error("Projects load error:", err);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load projects",
        });
      });
  }, [toast]);

  const refreshKeySteps = async (projectId: string) => {
    if (!projectId) {
      setKeySteps([]);
      return;
    }
    try {
      const r = await apiFetch(`/api/projects/${projectId}/key-steps`);
      if (!r.ok) throw new Error(`Failed to load key steps (${r.status})`);
      const data = await r.json();
      const rootSteps = Array.isArray(data)
        ? (data as KeyStep[]).filter((ks) => !ks.parentKeyStepId)
        : [];
      setKeySteps(rootSteps);
      setSelectedKeystepIds([]); // reset selection when reloading
    } catch (err) {
      console.error("Failed to load key steps:", err);
      setKeySteps([]);
    }
  };

  // Load keysteps when project changes
  useEffect(() => {
    if (!selectedProjectId) return;
    localStorage.setItem("selectedProjectId", selectedProjectId);
    refreshKeySteps(selectedProjectId);
  }, [selectedProjectId]);

  const openEditPage = (step: KeyStep) => {
    setLocation(`/add-key-step?projectId=${step.projectId}&keyStepId=${step.id}`);
  };

  const handleDeleteStep = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}"?`)) return;

    // optimistic remove from UI
    const prev = keySteps;
    setKeySteps((k) => k.filter((s) => s.id !== id));

    try {
      const response = await apiFetch(`/api/key-steps/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const txt = await response.text().catch(() => "");
        throw new Error(txt || `Delete failed (${response.status})`);
      }

      toast({ title: "Deleted", description: "Key step deleted successfully" });

      // final sync to ensure children/ordering are consistent
      await refreshKeySteps(selectedProjectId);
    } catch (err: any) {
      // restore previous state on error
      setKeySteps(prev);
      console.error("Delete failed:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: err?.message || "Failed to delete key step",
      });
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

  // Sort by phase number correctly
  const sortedKeySteps = useMemo(() => {
    return keySteps
      .slice()
      .sort(
        (a, b) => Number(a.phase) - Number(b.phase) || a.title.localeCompare(b.title)
      );
  }, [keySteps]);

  const allSelected =
    sortedKeySteps.length > 0 && selectedKeystepIds.length === sortedKeySteps.length;

  const toggleSelectAll = (checked: boolean) => {
    if (checked) setSelectedKeystepIds(sortedKeySteps.map((k) => k.id));
    else setSelectedKeystepIds([]);
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedKeystepIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  };

  // ------- QUICK ADD MULTI helpers -------
  const resetQuickTitles = (count = 5) =>
    setQuickTitles(Array.from({ length: count }).map(() => ""));

  const updateQuickTitle = (idx: number, value: string) =>
    setQuickTitles((prev) => prev.map((t, i) => (i === idx ? value : t)));

  const addQuickTitleRow = () => setQuickTitles((prev) => [...prev, ""]);

  const removeQuickTitleRow = (idx: number) =>
    setQuickTitles((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));

  // Create MULTIPLE key steps from Quick Add
  const quickAdd = async () => {
    if (!selectedProjectId) {
      toast({
        variant: "destructive",
        title: "Select a project",
        description: "Please select a project first.",
      });
      return;
    }

    const titles = quickTitles.map((t) => t.trim()).filter(Boolean);
    if (titles.length === 0) return;

    try {
      const now = new Date();
      const today = isoDateOnly(now);

      const payloads = titles.map((title) => ({
        projectId: selectedProjectId,
        title,
        status: "pending",
        phase: 1,
        header: "",

        // not shown in UI (as requested), still send safe values
        description: "",
        requirements: "",

        startDate: today,
        endDate: today,
        parentKeyStepId: null,
      }));

      const responses = await Promise.all(
        payloads.map((p) =>
          apiFetch("/api/key-steps", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(p),
          })
        )
      );

      const failed = responses.filter((r) => !r.ok);
      if (failed.length > 0) {
        const details = await Promise.all(failed.map((r) => r.text().catch(() => "")));
        console.error("Some quick-add creations failed:", details);
        throw new Error("Some key steps failed to create. Check console for details.");
      }

      // parse created rows so we can update UI immediately (no visible lag)
      const createdItems = await Promise.all(responses.map((r) => r.json()));

      // Optimistically update UI with new root keysteps, then re-sync from server
      setKeySteps((prev) => {
        const newRoots = createdItems.filter((c: any) => !c.parentKeyStepId);
        // avoid duplicates by id
        const existingIds = new Set(prev.map((p) => p.id));
        const toAdd = newRoots.filter((n: any) => !existingIds.has(n.id));
        return [...toAdd, ...prev];
      });

      toast({
        title: "Added",
        description: `Created ${titles.length} key step${titles.length > 1 ? "s" : ""}.`,
      });

      resetQuickTitles(5);
      setQuickAddOpen(false);

      // final sync to guarantee ordering/children are correct
      await refreshKeySteps(selectedProjectId);
    } catch (e: any) {
      console.error(e);
      toast({
        variant: "destructive",
        title: "Error",
        description: e?.message || "Failed to create key steps",
      });
    }
  };

  const doClone = async () => {
    if (!cloneKeystep) return;

    try {
      const resp = await apiFetch(`/api/key-steps/${cloneKeystep.id}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newTitle: cloneTitle || cloneKeystep.title }),
      });

      if (!resp.ok) {
        const t = await resp.text().catch(() => "");
        throw new Error(t || `Clone failed (${resp.status})`);
      }

      toast({ title: "Cloned", description: "Key step cloned successfully" });
      setCloneOpen(false);
      setCloneTitle("");
      setCloneKeystep(null);
      await refreshKeySteps(selectedProjectId);
    } catch (e: any) {
      console.error(e);
      toast({
        variant: "destructive",
        title: "Error",
        description: e?.message || "Failed to clone key step",
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold">Key Steps</h1>
            <p className="text-muted-foreground mt-1">
              Manage project phases and key steps effectively.
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col md:flex-row items-center gap-4 mb-8 bg-white p-4 rounded-lg border">
          <div className="flex-1 flex items-center gap-2">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-2">Project</p>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
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

          <Button
            onClick={() => setLocation(`/add-key-step?projectId=${selectedProjectId}`)}
            className="w-full md:w-auto"
            disabled={!selectedProjectId}
          >
            <Plus className="mr-2 h-4 w-4" /> New Key Step
          </Button>
        </div>

        {/* Bulk Actions & Quick Add */}
        <div className="flex items-center gap-2 mb-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setQuickAddOpen(true)}
            disabled={!selectedProjectId}
          >
            <Plus className="h-4 w-4 mr-1" /> Quick Add Keysteps
          </Button>

          {selectedKeystepIds.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => alert(`Bulk action for ${selectedKeystepIds.length} keysteps`)}
            >
              Bulk Action ({selectedKeystepIds.length})
            </Button>
          )}
        </div>

        {/* Quick Add Modal (MULTIPLE TITLES, no description/requirements) */}
        {quickAddOpen && (
          <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/30">
            <div className="bg-white rounded-lg p-6 w-[520px] max-w-[92vw] shadow-lg">
              <h2 className="text-lg font-bold mb-2">Quick Add Key Steps</h2>
              <p className="text-xs text-muted-foreground mb-4">
                Add multiple titles. Empty rows are ignored.
              </p>

              <div className="space-y-2 mb-4 max-h-[45vh] overflow-y-auto pr-1">
                {quickTitles.map((t, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      className="w-full border rounded p-2"
                      placeholder={`Title #${idx + 1}`}
                      value={t}
                      onChange={(e) => updateQuickTitle(idx, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") quickAdd();
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeQuickTitleRow(idx)}
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between mb-4">
                <Button type="button" variant="outline" size="sm" onClick={addQuickTitleRow}>
                  <Plus className="h-4 w-4 mr-1" /> Add Title
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => resetQuickTitles(5)}
                >
                  Reset
                </Button>
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setQuickAddOpen(false);
                    resetQuickTitles(5);
                  }}
                >
                  Cancel
                </Button>
                <Button variant="default" size="sm" onClick={quickAdd}>
                  Create
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Clone Modal */}
        {cloneOpen && cloneKeystep && (
          <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/30">
            <div className="bg-white rounded-lg p-6 w-96 shadow-lg">
              <h2 className="text-lg font-bold mb-4">Clone Keystep</h2>

              <input
                className="w-full border rounded p-2 mb-4"
                placeholder="New keystep title"
                value={cloneTitle}
                onChange={(e) => setCloneTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") doClone();
                }}
              />

              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setCloneOpen(false)}>
                  Cancel
                </Button>
                <Button variant="default" size="sm" onClick={doClone}>
                  Clone
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Table (description/requirements removed) */}
        <div className="overflow-x-auto bg-white rounded-lg border">
          {sortedKeySteps.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(e) => toggleSelectAll(e.target.checked)}
                    />
                  </th>

                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Title
                  </th>

                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Phase
                  </th>

                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Header
                  </th>

                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Start
                  </th>

                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    End
                  </th>

                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>

                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {sortedKeySteps.map((step) => (
                  <tr key={step.id} className="hover:bg-gray-50">
                    <td className="px-2 py-2 w-8">
                      <input
                        type="checkbox"
                        checked={selectedKeystepIds.includes(step.id)}
                        onChange={(e) => toggleOne(step.id, e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>

                    <td
                      className="px-4 py-2 font-medium"
                      onClick={() => {
                        localStorage.setItem("selectedProjectId", String(step.projectId));
                        localStorage.setItem("selectedKeyStepId", String(step.id));
                        setLocation("/tasks");
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      <div className="flex items-center gap-2">
                        {getStatusIcon(step.status)}
                        {step.title}
                      </div>
                    </td>

                    <td className="px-4 py-2">
                      <Badge variant="outline" className="text-xs">
                        Phase {step.phase}
                      </Badge>
                    </td>

                    <td className="px-4 py-2 text-sm">{step.header || ""}</td>

                    <td className="px-4 py-2 text-xs">
                      {step.startDate ? new Date(step.startDate).toLocaleDateString() : "—"}
                    </td>

                    <td className="px-4 py-2 text-xs">
                      {step.endDate ? new Date(step.endDate).toLocaleDateString() : "—"}
                    </td>

                    <td className="px-4 py-2">
                      <Badge
                        variant="outline"
                        className={`${getStatusColor(step.status)} capitalize text-xs`}
                      >
                        {step.status.replace("-", " ")}
                      </Badge>
                    </td>

                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditPage(step);
                          }}
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCloneOpen(true);
                            setCloneKeystep(step);
                            setCloneTitle(`${step.title} (Copy)`);
                          }}
                          title="Clone"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteStep(step.id, step.title);
                          }}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
              No steps found for this project. Click "New Key Step" to add one.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
