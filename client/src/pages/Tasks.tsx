import { useState, useEffect, Fragment } from "react";
import { useAuth } from "@/components/Layout";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Trash2,
  Edit,
  Search,
  Copy,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Circle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/apiClient";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* ================= TYPES ================= */

interface Subtask {
  id?: string;
  title: string;
  description?: string;
  isCompleted: boolean;
  assignedTo: string[]; // array of employee IDs
  startDate?: string | null;
  endDate?: string | null;
}

interface Task {
  id: string;
  projectId: string;
  keyStepId?: string;
  taskName: string;
  description?: string;
  status: string;
  priority: "low" | "medium" | "high";
  startDate?: string;
  endDate?: string;
  assignerId: string;
  taskMembers?: string[];
  subtasks?: Subtask[];
}

/* ================= COMPONENT ================= */

export default function Tasks() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Data
  const [employees, setEmployees] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [keySteps, setKeySteps] = useState<any[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);

  // Filters / UI state
  const [projectId, setProjectId] = useState("");
  const [selectedKeyStepId, setSelectedKeyStepId] = useState<string>("");
  const [expandedTasks, setExpandedTasks] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("all");

  // Multi-select state for tasks
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

  // Bulk assign state
  const [bulkAssignMembers, setBulkAssignMembers] = useState<string[]>([]);
  const [bulkAssignDepartment, setBulkAssignDepartment] = useState("");
  const [departments] = useState<string[]>([
    "HR",
    "Operations",
    "Software Developers",
    "Finance",
    "Purchase",
    "Presales",
    "IT Support",
  ]);

  // Delete dialog state
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  // Quick Add Task
  const [quickAddTaskOpen, setQuickAddTaskOpen] = useState(false);
  const [quickTaskName, setQuickTaskName] = useState("");

  // Quick Add Subtask (kept, even if UI not shown here)
  const [quickAddSubtaskOpen, setQuickAddSubtaskOpen] = useState(false);
  const [quickSubtaskTaskId, setQuickSubtaskTaskId] = useState("");
  const [quickSubtaskTitle, setQuickSubtaskTitle] = useState("");
  const [quickSubtaskStartDate, setQuickSubtaskStartDate] = useState("");
  const [quickSubtaskEndDate, setQuickSubtaskEndDate] = useState("");
  const [quickSubtaskCompleted, setQuickSubtaskCompleted] = useState(false);

  // Clone modals
  const [cloneTaskOpen, setCloneTaskOpen] = useState(false);
  const [cloneTaskData, setCloneTaskData] = useState<{ id: string; name: string } | null>(null);
  const [cloneTaskNewName, setCloneTaskNewName] = useState("");

  const [cloneSubtaskOpen, setCloneSubtaskOpen] = useState(false);
  const [cloneSubtaskData, setCloneSubtaskData] = useState<{ id: string; title: string } | null>(null);
  const [cloneSubtaskNewTitle, setCloneSubtaskNewTitle] = useState("");

  // Inline add-subtask form state (per-task)
  const [subtaskForms, setSubtaskForms] = useState<Record<string, { title: string; startDate: string; endDate: string; status: string; isCompleted: boolean }>>({});

  const updateSubtaskForm = (taskId: string, field: string, value: any) => {
    setSubtaskForms(prev => ({
      ...prev,
      [taskId]: {
        ...(prev[taskId] || {}),
        [field]: value,
      },
    }));
  };

  const addInlineSubtask = async (taskId: string) => {
    const form = subtaskForms[taskId] || { title: "", startDate: "", endDate: "", status: "Planned", isCompleted: false };
    if (!form.title || form.title.trim() === "") {
      alert("Subtask name is required");
      return;
    }

    // optimistic UI: add temporary subtask (id = temp)
    const tempId = `tmp-${Date.now()}`;
    const newSubtask: Subtask = {
      id: tempId,
      title: form.title.trim(),
      description: "",
      isCompleted: !!form.isCompleted,
      assignedTo: [],
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
    };

    setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, subtasks: [...(t.subtasks || []), newSubtask] } : t)));

    // reset form
    setSubtaskForms(prev => ({ ...prev, [taskId]: { title: "", startDate: "", endDate: "", status: "Planned", isCompleted: false } }));

    // persist
    try {
      const res = await apiFetch(`/api/subtasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          title: newSubtask.title,
          startDate: newSubtask.startDate || null,
          endDate: newSubtask.endDate || null,
          completed: newSubtask.isCompleted,
        }),
      });

      if (!res.ok) throw new Error("Failed to create subtask");

      await refreshTasks();
    } catch (err) {
      // revert optimistic
      setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, subtasks: (t.subtasks || []).filter(s => s.id !== tempId) } : t)));
      console.error(err);
      alert("Failed to add subtask");
    }
  };

  const toggleSubtaskCompletion = async (taskId: string, subtaskId: string, currentlyCompleted?: boolean) => {
    // optimistic UI: flip the UI immediately
    setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, subtasks: t.subtasks?.map(s => (s.id === subtaskId ? { ...s, isCompleted: !s.isCompleted } : s)) } : t)));

    // determine the value to persist (prefer passed-in current state to avoid stale closure)
    const newVal = typeof currentlyCompleted !== 'undefined' ? !currentlyCompleted : true;
    console.debug('[toggleSubtaskCompletion] taskId=', taskId, 'subtaskId=', subtaskId, 'newVal=', newVal);

    // persist to server
    try {
      const res = await apiFetch(`/api/subtasks/${subtaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted: newVal }),
      });

      const body = await res.json().catch(() => ({}));
      console.debug('[toggleSubtaskCompletion] PATCH response ok=', res.ok, 'body=', body);

      if (!res.ok) {
        throw new Error("Failed to update subtask");
      }

      // refresh the task list to get canonical state
      await refreshTasks();
    } catch (err) {
      // revert optimistic change on error
      setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, subtasks: t.subtasks?.map(s => (s.id === subtaskId ? { ...s, isCompleted: !s.isCompleted } : s)) } : t)));
      console.error(err);
      alert("Failed to update subtask status");
    }
  };

  /* ================= LOAD INITIAL DATA ================= */

  useEffect(() => {
    apiFetch("/api/employees")
      .then((r) => r.json())
      .then((data) => setEmployees(Array.isArray(data) ? data : []))
      .catch(() => setEmployees([]));

    apiFetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        setProjects(arr);
        // Derive unique companies from projects
        const companySet = new Set<string>();
        arr.forEach((p: any) => { if (p.company) companySet.add(String(p.company)); });
        setCompanies(Array.from(companySet));
      })
      .catch(() => setProjects([]));

    const savedKey = localStorage.getItem("selectedKeyStepId");
    if (savedKey) {
      setSelectedKeyStepId(savedKey);
      localStorage.removeItem("selectedKeyStepId");
    }
  }, []);

  /* ================= LOAD PROJECT-SPECIFIC DATA ================= */

  useEffect(() => {
    // Clear selection when filters change (prevents weird bulk actions)
    setSelectedTaskIds([]);

    if (!projectId) {
      // Load all user's tasks when no project is selected
      apiFetch("/api/tasks/bulk")
        .then((r) => r.json())
        .then((data) => setTasks(normalizeTasks(data)))
        .catch(() => setTasks([]));

      setKeySteps([]);
      setSelectedKeyStepId("");
      return;
    }

    // Load project-specific tasks
    apiFetch(`/api/tasks/${projectId}`)
      .then((r) => r.json())
      .then((data) => setTasks(normalizeTasks(data)))
      .catch(() => setTasks([]));

    // Load Key Steps for project
    apiFetch(`/api/projects/${projectId}/key-steps`)
      .then((r) => r.json())
      .then((data) => setKeySteps(Array.isArray(data) ? data : []))
      .catch(() => setKeySteps([]));
  }, [projectId]);

  /* ================= FILTERED TASKS ================= */

  const filteredTasks: Task[] = tasks.filter((t) => {
    const matchesSearch = (t.taskName || "")
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesKey = selectedKeyStepId
      ? String(t.keyStepId) === String(selectedKeyStepId)
      : true;

    // Company filter: match task's project company
    const taskProject = projects.find(p => String(p.id) === String(t.projectId));
    const matchesCompany = companyFilter === "all" ||
      (taskProject && String(taskProject.company || "").toLowerCase() === companyFilter.toLowerCase());

    return matchesSearch && matchesKey && matchesCompany;
  });

  // Select all tasks in current filtered view
  const allSelected =
    filteredTasks.length > 0 &&
    filteredTasks.every((t) => selectedTaskIds.includes(t.id));

  const toggleSelectAll = () => {
    if (allSelected) setSelectedTaskIds([]);
    else setSelectedTaskIds(filteredTasks.map((t) => t.id));
  };

  const toggleSelectTask = (id: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  /* ================= HELPERS ================= */

  const toggleExpand = (id: string) => {
    setExpandedTasks((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  const openAdd = () => {
    if (projectId && projectId !== "") {
      navigate(`/add-task?projectId=${projectId}`);
    } else {
      navigate(`/add-task`);
    }
  };

  const askDelete = (t: Task) => {
    setTaskToDelete(t);
    setOpenDeleteDialog(true);
  };

  const normalizeTasks = (arr: any[]): Task[] => {
    return (Array.isArray(arr) ? arr : []).map((t: any) => ({
      id: t.id,
      projectId: t.projectId,
      keyStepId: t.keyStepId,
      taskName: t.taskName || t.task_name || "",
      description: t.description || "",
      status: t.status || "",
      priority: t.priority || "medium",
      startDate: t.startDate || t.start_date || null,
      endDate: t.endDate || t.end_date || null,
      assignerId: t.assignerId || t.assigner_id || null,
      // backend returns `assignedMembers`; UI expects `taskMembers`
      taskMembers: t.taskMembers || t.assignedMembers || t.assigned_members || [],
      subtasks: Array.isArray(t.subtasks) ? t.subtasks : [],
    }));
  };

  const refreshTasks = async () => {
    try {
      const url = projectId ? `/api/tasks/${projectId}` : `/api/tasks/bulk`;
      const updated = await apiFetch(url).then((r) => r.json());
      setTasks(normalizeTasks(updated));
    } catch {
      setTasks([]);
    }
  };

  // Ensure the page shows ALL tasks by default on first load
  useEffect(() => {
    // explicit default: clear any project filter and load the user's full task list
    setProjectId("");
    refreshTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ================= BULK ASSIGN ================= */

  const handleBulkAssign = async () => {
    if (selectedTaskIds.length === 0) return;
    if (bulkAssignMembers.length === 0 && !bulkAssignDepartment) {
      alert("Please select at least one member or a department.");
      return;
    }

    try {
      // If department is selected, we might want to assign to everyone in that department?
      // For now, let's stick to the multi-person selection which is what the user asked for.
      const res = await apiFetch("/api/tasks/bulk-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskIds: selectedTaskIds,
          employeeIds: bulkAssignMembers,
        }),
      });

      if (!res.ok) throw new Error("Bulk assign failed");

      const data = await res.json();
      alert(data.message || "Tasks assigned successfully");

      setBulkAssignMembers([]);
      setBulkAssignDepartment("");
      setSelectedTaskIds([]);
      await refreshTasks();
    } catch (err) {
      console.error(err);
      alert("Failed to bulk assign tasks");
    }
  };

  /* ================= API ACTIONS ================= */

  const confirmDelete = async () => {
    if (!taskToDelete) return;
    try {
      await apiFetch(`/api/tasks/${taskToDelete.id}`, { method: "DELETE" });
      await refreshTasks();
      setOpenDeleteDialog(false);
      setTaskToDelete(null);
    } catch {
      alert("Delete failed");
    }
  };

  /* ================= QUICK ADD HANDLERS ================= */

  const handleQuickAddTask = async () => {
    if (!projectId) {
      alert("Please select a project first.");
      return;
    }
    if (!quickTaskName.trim()) {
      alert("Please enter a task name");
      return;
    }

    try {
      await apiFetch("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          projectId,
          taskName: quickTaskName.trim(),
          description: "",
          status: "pending",
          priority: "medium",
          assignerId: user?.id ?? null,
        }),
      });

      await refreshTasks();
      setQuickTaskName("");
      setQuickAddTaskOpen(false);
    } catch {
      alert("Failed to create task");
    }
  };

  const handleQuickAddSubtask = async () => {
    if (!quickSubtaskTaskId) {
      alert("Select a task first");
      return;
    }
    if (!quickSubtaskTitle.trim()) {
      alert("Please enter a subtask title");
      return;
    }

    try {
      await apiFetch(`/api/subtasks`, {
        method: "POST",
        body: JSON.stringify({
          taskId: quickSubtaskTaskId,
          title: quickSubtaskTitle.trim(),
          startDate: quickSubtaskStartDate || null,
          endDate: quickSubtaskEndDate || null,
          completed: quickSubtaskCompleted,
        }),
      });

      setQuickAddSubtaskOpen(false);
      setQuickSubtaskTaskId("");
      setQuickSubtaskTitle("");
      setQuickSubtaskStartDate("");
      setQuickSubtaskEndDate("");
      setQuickSubtaskCompleted(false);

      await refreshTasks();
    } catch {
      alert("Failed to add subtask");
    }
  };

  /* ================= CLONE HANDLERS ================= */

  const handleCloneTask = async () => {
    if (!cloneTaskData) return;

    try {
      const response = await apiFetch(`/api/tasks/${cloneTaskData.id}/clone`, {
        method: "POST",
        body: JSON.stringify({ newName: cloneTaskNewName || undefined }),
      });

      if (!response.ok) throw new Error("Clone failed");

      await refreshTasks();
      setCloneTaskNewName("");
      setCloneTaskOpen(false);
      setCloneTaskData(null);
      alert("Task cloned successfully!");
    } catch {
      alert("Failed to clone task");
    }
  };

  const handleCloneSubtask = async () => {
    if (!cloneSubtaskData) return;

    try {
      const response = await apiFetch(`/api/subtasks/${cloneSubtaskData.id}/clone`, {
        method: "POST",
        body: JSON.stringify({ newTitle: cloneSubtaskNewTitle || undefined }),
      });

      if (!response.ok) throw new Error("Clone failed");

      await refreshTasks();
      setCloneSubtaskNewTitle("");
      setCloneSubtaskOpen(false);
      setCloneSubtaskData(null);
      alert("Subtask cloned successfully!");
    } catch {
      alert("Failed to clone subtask");
    }
  };

  /* ================= UI HELPERS ================= */

  const StatusBadge = ({ status }: { status: string }) => (
    <Badge
      variant={status === "Completed" ? "default" : "outline"}
      className="text-xs whitespace-nowrap inline-flex justify-center"
    >
      {status || "—"}
    </Badge>
  );

  const PriorityBadge = ({ priority }: { priority: Task["priority"] | any }) => (
    <Badge
      variant="outline"
      className={`text-xs whitespace-nowrap inline-flex justify-center ${priority === "high"
        ? "bg-red-50 text-red-700 border-red-200"
        : priority === "medium"
          ? "bg-amber-50 text-amber-700 border-amber-200"
          : "bg-green-50 text-green-700 border-green-200"
        }`}
    >
      {priority || "—"}
    </Badge>
  );

  /* ================= RENDER ================= */

  return (
    <div className="space-y-6 p-6 bg-slate-50 min-h-screen">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            {projectId ? "Manage project tasks" : "View all tasks assigned to you"}
          </p>
        </div>

        <div className="flex gap-4 flexticas-flex-wrap">
          {/* Project select */}
          <div className="flex items-center">
            <span className="text-sm font-semibold mr-3">Project</span>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="w-56 bg-white">
                <SelectValue placeholder="Select Project" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px] overflow-y-auto">
                {projects.length > 0 ? (
                  projects.map((p) => (
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

          {/* Key Step select (only if project selected) */}
          {projectId && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold mr-3">Key Step</span>
              <Select
                value={selectedKeyStepId}
                onValueChange={(val) => {
                  setSelectedKeyStepId(val);
                }}
              >
                <SelectTrigger className="w-56 bg-white">
                  <SelectValue placeholder="Filter by key step..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto">
                  {keySteps.length > 0 ? (
                    keySteps.map((ks) => (
                      <SelectItem key={ks.id} value={String(ks.id)}>
                        {ks.title}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-2 text-xs text-muted-foreground">No key steps available</div>
                  )}
                </SelectContent>
              </Select>

              {selectedKeyStepId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedKeyStepId("")}
                  className="h-9 px-2 text-xs"
                >
                  Clear
                </Button>
              )}
            </div>
          )}

          {/* Search */}
          <div className="flex items-center">
            <span className="text-sm font-semibold mr-3">Tasks</span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                className="pl-9 w-56 bg-white"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Company Filter */}
          <div className="flex items-center">
            <span className="text-sm font-semibold mr-3">Company</span>
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="w-56 bg-white">
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

          <Button onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1" /> Add Task
          </Button>

          <Button
            onClick={() => setQuickAddTaskOpen(true)}
            variant="outline"
            className="border-amber-200 text-amber-700 hover:bg-amber-50"
          >
            <Plus className="h-4 w-4 mr-1" /> Quick Add
          </Button>
        </div>
      </div>

      {/* BULK ASSIGN UI */}
      {selectedTaskIds.length > 0 && (
        <div className="flex items-center gap-4 mb-4 p-3 bg-amber-50 border border-amber-200 rounded">
          <span className="font-semibold text-sm">Bulk Assign:</span>

          {/* Assign to Person (Multi-select) */}
          <div className="flex-1 max-w-sm">
            <Select
              value=""
              onValueChange={(id) => {
                if (!bulkAssignMembers.includes(id)) {
                  setBulkAssignMembers(prev => [...prev, id]);
                }
              }}
            >
              <SelectTrigger className="w-full bg-white">
                <SelectValue placeholder="Add Person..." />
              </SelectTrigger>
              <SelectContent className="max-h-[300px] overflow-y-auto">
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-1 flex-wrap mt-1">
              {bulkAssignMembers.map(id => (
                <Badge
                  key={id}
                  variant="secondary"
                  className="text-[10px] py-0 px-1 cursor-pointer"
                  onClick={() => setBulkAssignMembers(prev => prev.filter(x => x !== id))}
                >
                  {employees.find(e => e.id === id)?.name || id} ✕
                </Badge>
              ))}
            </div>
          </div>

          {/* Assign to Department */}
          <Select value={bulkAssignDepartment} onValueChange={setBulkAssignDepartment}>
            <SelectTrigger className="w-48 bg-white">
              <SelectValue placeholder="Select Department" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px] overflow-y-auto">
              {departments.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={handleBulkAssign}
            disabled={bulkAssignMembers.length === 0 && !bulkAssignDepartment}
            className="bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
          >
            Assign Selected Tasks
          </Button>
        </div>
      )}

      {/* MAIN TABLE */}
      <div className="bg-white border rounded-xl overflow-x-auto">
        <table className="w-full border-collapse table-fixed">
          <colgroup>
            <col style={{ width: "3%" }} />
            <col style={{ width: "4%" }} />
            <col style={{ width: "22%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "6%" }} />
            <col style={{ width: "7%" }} />
          </colgroup>

          <thead>
            <tr className="bg-slate-100 border-b">
              <th className="px-2 py-3 text-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  aria-label="Select all tasks"
                />
              </th>
              <th className="px-2 py-3 text-center text-xs font-bold uppercase text-slate-600 border-r">
                {/* expand */}
              </th>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase text-slate-600 border-r">
                Task Name
              </th>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase text-slate-600 border-r">
                Assignees
              </th>
              <th className="px-3 py-3 text-center text-xs font-bold uppercase text-slate-600 border-r">
                Start Date
              </th>
              <th className="px-3 py-3 text-center text-xs font-bold uppercase text-slate-600 border-r">
                End Date
              </th>
              <th className="px-3 py-3 text-center text-xs font-bold uppercase text-slate-600 border-r">
                Status
              </th>
              <th className="px-3 py-3 text-center text-xs font-bold uppercase text-slate-600 border-r">
                Priority
              </th>
              <th className="px-3 py-3 text-center text-xs font-bold uppercase text-slate-600 border-r">
                Subtasks
              </th>
              <th className="px-2 py-3 text-center text-xs font-bold uppercase text-slate-600">
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-12 text-center text-slate-500">
                  No tasks found
                </td>
              </tr>
            ) : (
              filteredTasks.map((task: Task, taskIndex: number) => {
                const isExpanded = expandedTasks.includes(task.id);

                return (
                  <Fragment key={task.id}>
                    <tr className="border-b hover:bg-slate-50">
                      {/* checkbox */}
                      <td className="px-2 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedTaskIds.includes(task.id)}
                          onChange={() => toggleSelectTask(task.id)}
                          aria-label={`Select task ${task.taskName}`}
                        />
                      </td>

                      {/* expand */}
                      <td className="px-2 py-3 text-center border-r">
                        <button
                          onClick={() => toggleExpand(task.id)}
                          className="text-slate-600 hover:text-slate-900"
                          title={isExpanded ? "Collapse" : "Expand"}
                        >
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      </td>

                      {/* name */}
                      <td className="px-3 py-3 text-left border-r truncate">
                        <div className="font-medium text-slate-900">{task.taskName}</div>
                        {task.description ? (
                          <div className="text-xs text-slate-500 truncate">{task.description}</div>
                        ) : null}
                      </td>

                      {/* assignees */}
                      <td className="px-3 py-3 text-left border-r">
                        <div className="text-sm text-slate-700">
                          {Array.isArray(task.taskMembers) && task.taskMembers.length > 0
                            ? task.taskMembers.length + " member(s)"
                            : "—"}
                        </div>
                      </td>

                      {/* start */}
                      <td className="px-3 py-3 text-center border-r text-sm text-slate-700">
                        {task.startDate ? String(task.startDate) : "—"}
                      </td>

                      {/* end */}
                      <td className="px-3 py-3 text-center border-r text-sm text-slate-700">
                        {task.endDate ? String(task.endDate) : "—"}
                      </td>

                      {/* status */}
                      <td className="px-3 py-3 text-center border-r">
                        <StatusBadge status={task.status} />
                      </td>

                      {/* priority */}
                      <td className="px-3 py-3 text-center border-r">
                        <PriorityBadge priority={task.priority} />
                      </td>

                      {/* subtasks count */}
                      <td className="px-3 py-3 text-center border-r">
                        <Badge variant="secondary" className="text-xs inline-flex justify-center w-full">
                          {task.subtasks?.length || 0}
                        </Badge>
                      </td>

                      {/* actions */}
                      <td className="px-2 py-3 text-center">
                        <div className="flex gap-2 justify-center items-center">
                          <button
                            onClick={() => navigate(`/add-task?id=${task.id}&projectId=${task.projectId}`)}
                            className="text-blue-600 hover:text-blue-700"
                            title="Edit Task"
                          >
                            <Edit size={16} />
                          </button>

                          <button
                            onClick={() => {
                              setCloneTaskData({ id: task.id, name: task.taskName });
                              setCloneTaskNewName(`${task.taskName} (Copy)`);
                              setCloneTaskOpen(true);
                            }}
                            className="text-green-600 hover:text-green-700"
                            title="Clone Task"
                          >
                            <Copy size={16} />
                          </button>

                          <button
                            onClick={() => askDelete(task)}
                            className="text-red-600 hover:text-red-700"
                            title="Delete Task"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* expanded row */}
                    {isExpanded && (
                      <tr className="bg-slate-50 border-b">
                        <td colSpan={10} className="px-4 py-4">
                          <div className="text-sm text-slate-700">
                            <div className="font-semibold mb-2">Details</div>
                            <div><span className="font-medium">Status:</span> {task.status || "—"}</div>
                            <div><span className="font-medium">Priority:</span> {task.priority || "—"}</div>
                            <div><span className="font-medium">Subtasks:</span> {task.subtasks?.length || 0}</div>
                            {task.description ? (
                              <div className="mt-2">
                                <span className="font-medium">Description:</span> {task.description}
                              </div>
                            ) : null}
                            {Array.isArray(task.subtasks) && task.subtasks.length > 0 && (
                              <div className="mt-4">
                                <div className="font-medium mb-2">Subtasks List</div>

                                {/* tree-style subtasks */}
                                <ul className="pl-4 space-y-3">
                                  {task.subtasks.map((subtask, idx) => {
                                    const numbering = `${taskIndex + 1}.${idx + 1}`;
                                    return (
                                      <li key={subtask.id || idx} className="flex gap-3 items-start">
                                        <div className="w-6 flex items-center justify-center">
                                          <button
                                            onClick={() => toggleSubtaskCompletion(task.id, String(subtask.id), !!subtask.isCompleted)}
                                            className="p-0"
                                            title={subtask.isCompleted ? "Mark as pending" : "Mark completed"}
                                          >
                                            {subtask.isCompleted ? (
                                              <CheckCircle2 size={18} className="text-green-500" />
                                            ) : (
                                              <Circle size={18} className="text-slate-400" />
                                            )}
                                          </button>
                                        </div>

                                        <div className="flex-1">
                                          <div className="flex items-center justify-between gap-4">
                                            <div>
                                              <span className={`font-semibold ${subtask.isCompleted ? 'line-through text-slate-400' : ''}`}>{`${numbering}: ${subtask.title}`}</span>
                                            </div>
                                            <div className="text-xs text-slate-500 whitespace-nowrap">
                                              <span className="mr-3">Start: {subtask.startDate || "—"}</span>
                                              <span className="mr-3">End: {subtask.endDate || "—"}</span>
                                              <span>Status: {subtask.isCompleted ? "Completed" : "Pending"}</span>
                                            </div>
                                          </div>
                                          {subtask.description ? (
                                            <div className="text-xs text-slate-500 mt-1">{subtask.description}</div>
                                          ) : null}
                                        </div>

                                        {/* complete toggle (checkbox kept for accessibility) */}
                                        <div className="flex items-center">
                                          <input
                                            type="checkbox"
                                            checked={!!subtask.isCompleted}
                                            onChange={(e) => toggleSubtaskCompletion(task.id, String(subtask.id), !!subtask.isCompleted)}
                                            title="Mark complete"
                                          />
                                        </div>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            )}

                            {/* inline Add Subtask form */}
                            <div className="mt-4 border-t pt-4">
                              <div className="font-medium mb-2">Add Subtask</div>
                              <div className="grid grid-cols-3 gap-3 items-end">
                                <div>
                                  <label className="text-xs text-slate-600">Subtask Name *</label>
                                  <Input
                                    placeholder="Subtask name"
                                    value={(subtaskForms[task.id]?.title) || ""}
                                    onChange={(e) => updateSubtaskForm(task.id, 'title', e.target.value)}
                                  />
                                </div>

                                <div>
                                  <label className="text-xs text-slate-600">Start Date</label>
                                  <Input
                                    type="date"
                                    value={(subtaskForms[task.id]?.startDate) || ""}
                                    onChange={(e) => updateSubtaskForm(task.id, 'startDate', e.target.value)}
                                  />
                                </div>

                                <div>
                                  <label className="text-xs text-slate-600">End Date</label>
                                  <Input
                                    type="date"
                                    value={(subtaskForms[task.id]?.endDate) || ""}
                                    onChange={(e) => updateSubtaskForm(task.id, 'endDate', e.target.value)}
                                  />
                                </div>

                                <div>
                                  <label className="text-xs text-slate-600">Status</label>
                                  <Select
                                    value={(subtaskForms[task.id]?.status) || 'Planned'}
                                    onValueChange={(v) => updateSubtaskForm(task.id, 'status', v)}
                                  >
                                    <SelectTrigger className="h-8">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Planned">Planned</SelectItem>
                                      <SelectItem value="In Progress">In Progress</SelectItem>
                                      <SelectItem value="Completed">Completed</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="flex items-center gap-2">
                                  <input
                                    id={`completed-${task.id}`}
                                    type="checkbox"
                                    checked={!!subtaskForms[task.id]?.isCompleted}
                                    onChange={(e) => updateSubtaskForm(task.id, 'isCompleted', e.target.checked)}
                                  />
                                  <label htmlFor={`completed-${task.id}`} className="text-xs text-slate-600">Mark complete</label>
                                </div>

                                <div className="col-span-3 text-right">
                                  <Button size="sm" onClick={() => addInlineSubtask(task.id)}>Add Subtask</Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* DELETE DIALOG */}
      <Dialog open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            Delete <span className="font-bold">{taskToDelete?.taskName}</span>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QUICK ADD TASK DIALOG */}
      <Dialog open={quickAddTaskOpen} onOpenChange={setQuickAddTaskOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quick Add Task</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Task Name *</label>
              <Input
                placeholder="Enter task name..."
                value={quickTaskName}
                onChange={(e) => setQuickTaskName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleQuickAddTask()}
              />
            </div>
            <p className="text-xs text-slate-500">
              Description can be added later by editing the task.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickAddTaskOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleQuickAddTask}>Create Task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QUICK ADD SUBTASK DIALOG (kept, even if not triggered here) */}
      <Dialog open={quickAddSubtaskOpen} onOpenChange={setQuickAddSubtaskOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quick Add Subtask</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Subtask Title *</label>
              <Input
                placeholder="Enter subtask title..."
                value={quickSubtaskTitle}
                onChange={(e) => setQuickSubtaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleQuickAddSubtask()}
              />
            </div>
            <p className="text-xs text-slate-500">
              Description can be added later by editing the subtask.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickAddSubtaskOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleQuickAddSubtask}>Create Subtask</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CLONE TASK DIALOG */}
      <Dialog open={cloneTaskOpen} onOpenChange={setCloneTaskOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clone Task</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-sm text-slate-600">
              Cloning: <span className="font-bold">{cloneTaskData?.name}</span>
            </div>

            <div>
              <label className="text-sm font-medium">New Task Name</label>
              <Input
                placeholder="Enter new task name..."
                value={cloneTaskNewName}
                onChange={(e) => setCloneTaskNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCloneTask()}
              />
            </div>

            <p className="text-xs text-slate-500">
              All subtasks and team members will be cloned.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCloneTaskOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCloneTask}>Clone Task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CLONE SUBTASK DIALOG */}
      <Dialog open={cloneSubtaskOpen} onOpenChange={setCloneSubtaskOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clone Subtask</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-sm text-slate-600">
              Cloning: <span className="font-bold">{cloneSubtaskData?.title}</span>
            </div>

            <div>
              <label className="text-sm font-medium">New Subtask Title</label>
              <Input
                placeholder="Enter new task title..."
                value={cloneSubtaskNewTitle}
                onChange={(e) => setCloneSubtaskNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCloneSubtask()}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCloneSubtaskOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCloneSubtask}>Clone Subtask</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
