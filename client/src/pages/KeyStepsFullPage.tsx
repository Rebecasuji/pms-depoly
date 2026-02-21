import { useEffect, useMemo, useState, Fragment } from "react";
import {
  Plus,
  Edit,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy,
  X,
  Filter,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { useLocation } from "wouter";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  description?: string | null;
  requirements?: string | null;
  phase: number;
  status: "pending" | "in-progress" | "completed";
  startDate: string;
  endDate: string;
}

const isoDateOnly = (d: Date) => d.toISOString().slice(0, 10);

export default function KeyStepsFullPage() {
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
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");

  // --- Filter state ---
  const [filterHeader, setFilterHeader] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");

  // --- Expand state for detail rows ---
  const [expandedStepIds, setExpandedStepIds] = useState<Set<string>>(new Set());
  const [projectSearch, setProjectSearch] = useState("");

  const toggleExpand = (id: string) => {
    setExpandedStepIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const hasActiveFilters = filterHeader || filterStartDate || filterEndDate;

  const clearFilters = () => {
    setFilterHeader("");
    setFilterStartDate("");
    setFilterEndDate("");
  };

  // Load projects
  useEffect(() => {
    apiFetch("/api/projects")
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load projects");
        return r.json();
      })
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        setProjects(arr);
      })
      .catch((err) => {
        console.error("Projects load error:", err);
        toast({ variant: "destructive", title: "Error", description: "Failed to load projects" });
      });
  }, [toast]);

  const refreshKeySteps = async (projectId: string) => {
    try {
      let url = "/api/keysteps/bulk";
      if (projectId && projectId !== "all") {
        url = `/api/projects/${projectId}/key-steps`;
      }
      const r = await apiFetch(url);
      if (!r.ok) throw new Error(`Failed to load key steps (${r.status})`);
      const data = await r.json();
      const rootSteps = Array.isArray(data)
        ? (data as KeyStep[]).filter((ks) => !ks.parentKeyStepId)
        : [];
      setKeySteps(rootSteps);
      setSelectedKeystepIds([]);
    } catch (err) {
      console.error("Failed to load key steps:", err);
      setKeySteps([]);
    }
  };

  useEffect(() => {
    if (selectedProjectId && selectedProjectId !== "all") {
      localStorage.setItem("selectedProjectId", selectedProjectId);
    }
    refreshKeySteps(selectedProjectId);
  }, [selectedProjectId]);

  const openEditPage = (step: KeyStep) => {
    setLocation(`/add-key-step?projectId=${step.projectId}&keyStepId=${step.id}`);
  };

  const handleDeleteStep = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}"?`)) return;
    const prev = keySteps;
    setKeySteps((k) => k.filter((s) => s.id !== id));
    try {
      const response = await apiFetch(`/api/key-steps/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const txt = await response.text().catch(() => "");
        throw new Error(txt || `Delete failed (${response.status})`);
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error("Delete did not succeed on server");
      }
      toast({ title: "Deleted", description: "Key step deleted successfully" });
      // Small delay to ensure DB transaction completes before re-fetching
      await new Promise((r) => setTimeout(r, 500));
      await refreshKeySteps(selectedProjectId);
    } catch (err: any) {
      setKeySteps(prev);
      toast({ variant: "destructive", title: "Error", description: err?.message || "Failed to delete key step" });
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === "completed") return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (status === "in-progress") return <Clock className="h-4 w-4 text-blue-500" />;
    return <AlertCircle className="h-4 w-4 text-amber-500" />;
  };

  const getStatusBadgeClass = (status: string) => {
    if (status === "completed") return "bg-green-100 text-green-800 border-green-200";
    if (status === "in-progress") return "bg-blue-100 text-blue-800 border-blue-200";
    return "bg-amber-100 text-amber-800 border-amber-200";
  };

  // Sort then filter
  const sortedKeySteps = useMemo(() => {
    return keySteps
      .slice()
      .sort((a, b) => Number(a.phase) - Number(b.phase) || a.title.localeCompare(b.title));
  }, [keySteps]);

  const filteredKeySteps = useMemo(() => {
    return sortedKeySteps.filter((step) => {
      // Header filter
      if (filterHeader) {
        const h = (step.header || "").toLowerCase();
        if (!h.includes(filterHeader.toLowerCase())) return false;
      }
      // Start date filter — only show steps with startDate >= filterStartDate
      if (filterStartDate && step.startDate) {
        if (step.startDate < filterStartDate) return false;
      }
      // End date filter — only show steps with endDate <= filterEndDate
      if (filterEndDate && step.endDate) {
        if (step.endDate > filterEndDate) return false;
      }
      return true;
    });
  }, [sortedKeySteps, filterHeader, filterStartDate, filterEndDate]);

  const allSelected =
    filteredKeySteps.length > 0 && selectedKeystepIds.length === filteredKeySteps.length;

  const toggleSelectAll = (checked: boolean) => {
    if (checked) setSelectedKeystepIds(filteredKeySteps.map((k) => k.id));
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

  const quickAdd = async () => {
    if (!selectedProjectId) {
      toast({ variant: "destructive", title: "Select a project", description: "Please select a project first." });
      return;
    }
    const titles = quickTitles.map((t) => t.trim()).filter(Boolean);
    if (titles.length === 0) return;
    try {
      const today = isoDateOnly(new Date());
      const payloads = titles.map((title) => ({
        projectId: selectedProjectId, title, status: "pending", phase: 1,
        header: "", description: "", requirements: "",
        startDate: today, endDate: today, parentKeyStepId: null,
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
      if (failed.length > 0) throw new Error("Some key steps failed to create.");
      const createdItems = await Promise.all(responses.map((r) => r.json()));
      setKeySteps((prev) => {
        const newRoots = createdItems.filter((c: any) => !c.parentKeyStepId);
        const existingIds = new Set(prev.map((p) => p.id));
        const toAdd = newRoots.filter((n: any) => !existingIds.has(n.id));
        return [...toAdd, ...prev];
      });
      toast({ title: "Added", description: `Created ${titles.length} key step${titles.length > 1 ? "s" : ""}.` });
      resetQuickTitles(5);
      setQuickAddOpen(false);
      await refreshKeySteps(selectedProjectId);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e?.message || "Failed to create key steps" });
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
      setCloneOpen(false); setCloneTitle(""); setCloneKeystep(null);
      await refreshKeySteps(selectedProjectId);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e?.message || "Failed to clone key step" });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Key Steps</h1>
          <p className="text-muted-foreground mt-1">Manage project phases and key steps effectively.</p>
        </div>

        {/* Controls Row — Project selector + action buttons */}
        <div className="flex flex-wrap items-end gap-3 mb-4 bg-white p-4 rounded-lg border">
          {/* Project Select */}
          <div className="min-w-[200px]">
            <p className="text-xs text-muted-foreground mb-1 font-medium">Project</p>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px] overflow-y-auto">
                <div className="px-2 py-1.5 sticky top-0 bg-white z-10">
                  <input
                    type="text"
                    placeholder="Search projects..."
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <SelectItem value="all">All Projects</SelectItem>
                {projects
                  .filter((p: any) =>
                    !projectSearch || (p.title || "").toLowerCase().includes(projectSearch.toLowerCase())
                  )
                  .map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>
                  ))
                }
                {projects.filter((p: any) =>
                  !projectSearch || (p.title || "").toLowerCase().includes(projectSearch.toLowerCase())
                ).length === 0 && (
                    <div className="p-2 text-xs text-muted-foreground text-center">No projects found</div>
                  )}
              </SelectContent>
            </Select>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* New Key Step */}
          <Button
            onClick={() => setLocation(`/add-key-step?projectId=${selectedProjectId}`)}
            disabled={!selectedProjectId}
            className="h-9"
          >
            <Plus className="mr-1 h-4 w-4" /> New Key Step
          </Button>

          {/* Quick Add — under construction */}
          <div className="relative group">
            <Button
              variant="outline"
              className="h-9 border-dashed text-muted-foreground"
              onClick={() => alert("Quick Add Keysteps is currently under construction.")}
            >
              <Plus className="mr-1 h-4 w-4" /> Quick Add
            </Button>
            {/* tooltip */}
            <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:flex items-center gap-1 whitespace-nowrap rounded bg-white border px-2 py-1 text-xs text-green-600 shadow-md z-50">
              <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
              Under Construction
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-end gap-3 mb-4 bg-white p-4 rounded-lg border">
          <Filter className="h-4 w-4 text-muted-foreground mt-5" />

          {/* Header filter */}
          <div className="flex-1 min-w-[180px]">
            <p className="text-xs text-muted-foreground mb-1 font-medium">Header</p>
            <Input
              placeholder="Filter by header..."
              value={filterHeader}
              onChange={(e) => setFilterHeader(e.target.value)}
              className="h-9"
            />
          </div>

          {/* Start Date filter */}
          <div className="min-w-[160px]">
            <p className="text-xs text-muted-foreground mb-1 font-medium">Start Date</p>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* End Date filter */}
          <div className="min-w-[160px]">
            <p className="text-xs text-muted-foreground mb-1 font-medium">End Date</p>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Clear Filters — always visible, dimmed when nothing active */}
          <Button
            variant={hasActiveFilters ? "destructive" : "outline"}
            size="sm"
            className="h-9 gap-1"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
          >
            <X className="h-3.5 w-3.5" />
            Clear Filters
            {hasActiveFilters && (
              <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-xs font-semibold">
                {[filterHeader, filterStartDate, filterEndDate].filter(Boolean).length}
              </span>
            )}
          </Button>
        </div>

        {/* Results summary */}
        {hasActiveFilters && (
          <p className="text-sm text-muted-foreground mb-2">
            Showing {filteredKeySteps.length} of {sortedKeySteps.length} key steps
          </p>
        )}

        {/* Quick Add Modal */}
        {quickAddOpen && (
          <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/30">
            <div className="bg-white rounded-lg p-6 w-[520px] max-w-[92vw] shadow-lg">
              <h2 className="text-lg font-bold mb-2">Quick Add Key Steps</h2>
              <p className="text-xs text-muted-foreground mb-4">Add multiple titles. Empty rows are ignored.</p>
              <div className="space-y-2 mb-4 max-h-[45vh] overflow-y-auto pr-1">
                {quickTitles.map((t, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      className="w-full border rounded p-2"
                      placeholder={`Title #${idx + 1}`}
                      value={t}
                      onChange={(e) => updateQuickTitle(idx, e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") quickAdd(); }}
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeQuickTitleRow(idx)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mb-4">
                <Button type="button" variant="outline" size="sm" onClick={addQuickTitleRow}>
                  <Plus className="h-4 w-4 mr-1" /> Add Title
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => resetQuickTitles(5)}>Reset</Button>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => { setQuickAddOpen(false); resetQuickTitles(5); }}>Cancel</Button>
                <Button variant="default" size="sm" onClick={quickAdd}>Create</Button>
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
                onKeyDown={(e) => { if (e.key === "Enter") doClone(); }}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setCloneOpen(false)}>Cancel</Button>
                <Button variant="default" size="sm" onClick={doClone}>Clone</Button>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto bg-white rounded-lg border shadow-sm">
          {filteredKeySteps.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {/* Chevron toggle — first column */}
                  <th className="px-2 py-3 w-8" />

                  <th className="px-3 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(e) => toggleSelectAll(e.target.checked)}
                      className="rounded"
                    />
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Title
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Header
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Start Date
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    End Date
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>

                  {/* Phase moved to last */}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Phase
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {filteredKeySteps.map((step) => (
                  <Fragment key={step.id}>
                    <tr className="hover:bg-slate-50 transition-colors">
                      {/* Expand toggle */}
                      <td className="px-2 py-3 w-8">
                        <button
                          onClick={() => toggleExpand(step.id)}
                          className="rounded p-0.5 hover:bg-slate-200 transition-colors text-slate-500"
                          title={expandedStepIds.has(step.id) ? "Hide details" : "Show details"}
                        >
                          {expandedStepIds.has(step.id)
                            ? <ChevronDown className="h-4 w-4" />
                            : <ChevronRight className="h-4 w-4" />}
                        </button>
                      </td>
                      {/* Checkbox */}
                      <td className="px-3 py-3 w-8">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={selectedKeystepIds.includes(step.id)}
                          onChange={(e) => toggleOne(step.id, e.target.checked)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>

                      {/* Title */}
                      <td
                        className="px-4 py-3 font-medium cursor-pointer"
                        onClick={() => {
                          localStorage.setItem("selectedProjectId", String(step.projectId));
                          localStorage.setItem("selectedKeyStepId", String(step.id));
                          setLocation("/tasks");
                        }}
                      >
                        <div className="flex items-center gap-2">
                          {getStatusIcon(step.status)}
                          <span className="hover:text-primary hover:underline underline-offset-2 transition-colors">
                            {step.title}
                          </span>
                        </div>
                      </td>

                      {/* Header */}
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {step.header ? (
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium">{step.header}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* Start Date */}
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {step.startDate ? new Date(step.startDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                      </td>

                      {/* End Date */}
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {step.endDate ? new Date(step.endDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={`${getStatusBadgeClass(step.status)} capitalize text-xs font-medium`}
                        >
                          {step.status.replace("-", " ")}
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={(e) => { e.stopPropagation(); openEditPage(step); }}
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-slate-100"
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
                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={(e) => { e.stopPropagation(); handleDeleteStep(step.id, step.title); }}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>

                      {/* Phase — last column */}
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200">
                          Phase {step.phase}
                        </Badge>
                      </td>
                    </tr>

                    {/* Expanded detail panel */}
                    {expandedStepIds.has(step.id) && (
                      <tr className="bg-indigo-50/60 border-t border-indigo-100">
                        <td colSpan={9} className="px-8 py-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Header</p>
                              <p className="text-sm">{step.header || <span className="text-gray-400 italic">None</span>}</p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Phase</p>
                              <p className="text-sm font-medium">Phase {step.phase}</p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Status</p>
                              <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium capitalize ${getStatusBadgeClass(step.status)}`}>
                                {step.status.replace("-", " ")}
                              </span>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Duration</p>
                              <p className="text-sm">
                                {step.startDate ? new Date(step.startDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                                {" → "}
                                {step.endDate ? new Date(step.endDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                              </p>
                            </div>
                            {step.description && (
                              <div className="col-span-2">
                                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Description</p>
                                <p className="text-sm text-gray-700">{step.description}</p>
                              </div>
                            )}
                            {step.requirements && (
                              <div className="col-span-2">
                                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Requirements</p>
                                <p className="text-sm text-gray-700">{step.requirements}</p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              {hasActiveFilters ? (
                <div>
                  <p className="text-base font-medium mb-1">No key steps match your filters</p>
                  <p className="text-sm mb-3">Try adjusting or clearing the filters</p>
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    <X className="h-3.5 w-3.5 mr-1" /> Clear Filters
                  </Button>
                </div>
              ) : (
                <div>
                  <p className="text-base font-medium mb-1">No key steps found</p>
                  <p className="text-sm">Select a project and click "New Key Step" to get started</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
