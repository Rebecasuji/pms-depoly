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
  X,
  Check,
  ChevronsUpDown,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn, formatDate } from "@/lib/utils";

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

  // Helper: normalize department strings for robust matching
  function normalizeDept(input?: string | null) {
    if (!input) return "";
    let v = String(input).trim().toLowerCase().replace(/\s+/g, " ");
    if (v === 'presales') return v;
    if (v.length > 3 && v.endsWith("s")) v = v.slice(0, -1);
    return v;
  }

  // Data
  const [employees, setEmployees] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [keySteps, setKeySteps] = useState<any[]>([]);
  const [clients, setClients] = useState<string[]>([]);

  // Filters / UI state — lazy-init from localStorage so navigation from KeySteps works
  const [projectId, setProjectId] = useState<string>(() => {
    const saved = localStorage.getItem("selectedProjectId");
    if (saved) { localStorage.removeItem("selectedProjectId"); return saved; }
    return "";
  });
  const [selectedKeyStepId, setSelectedKeyStepId] = useState<string>(() => {
    const saved = localStorage.getItem("selectedKeyStepId");
    if (saved) { localStorage.removeItem("selectedKeyStepId"); return saved; }
    return "";
  });
  const [expandedTasks, setExpandedTasks] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [projectPopoverOpen, setProjectPopoverOpen] = useState(false);
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [deptPopoverOpen, setDeptPopoverOpen] = useState(false);
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);

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
        // Derive unique clients from projects
        const clientSet = new Set<string>();
        arr.forEach((p: any) => { if (p.clientName) clientSet.add(String(p.clientName)); });
        setClients(Array.from(clientSet));
      })
      .catch(() => setProjects([]));
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
      // NOTE: do NOT clear selectedKeyStepId here — it may have been set from navigation
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

    // Project data for filtering
    const taskProject = projects.find(p => String(p.id) === String(t.projectId));

    // Client filter
    const matchesClient = clientFilter === "all" ||
      (taskProject && String(taskProject.clientName || "").toLowerCase() === clientFilter.toLowerCase());

    // Department filter
    const projectDepts = taskProject?.department || [];
    const filterDeptNorm = normalizeDept(departmentFilter);
    const matchesDepartment = departmentFilter === "all" ||
      projectDepts.some((d: string) => normalizeDept(d) === filterDeptNorm);

    // Status filter
    const matchesStatus = statusFilter === "all" ||
      (t.status || "").toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesKey && matchesClient && matchesDepartment && matchesStatus;
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

  // (removed: old useEffect that called setProjectId("") on mount
  //  which conflicted with localStorage-based navigation)

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
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            {projectId ? "Manage project tasks" : "View all tasks"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Project select (Searchable) */}
          <div className="flex items-center">
            <span className="text-sm font-semibold mr-3">Project</span>
            <Popover open={projectPopoverOpen} onOpenChange={setProjectPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={projectPopoverOpen}
                  className="w-56 justify-between bg-white font-normal"
                >
                  <span className="truncate">
                    {projectId
                      ? projects.find((p) => String(p.id) === projectId)?.title
                      : "All Projects"}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-0">
                <Command>
                  <CommandInput placeholder="Search project..." />
                  <CommandList>
                    <CommandEmpty>No project found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="all-projects"
                        onSelect={() => {
                          setProjectId("");
                          setProjectPopoverOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            !projectId ? "opacity-100" : "opacity-0"
                          )}
                        />
                        All Projects
                      </CommandItem>
                      {projects.map((p) => (
                        <CommandItem
                          key={p.id}
                          value={p.title}
                          onSelect={() => {
                            setProjectId(String(p.id));
                            setProjectPopoverOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              projectId === String(p.id) ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {p.title}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
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

          {/* Client Filter (Searchable) */}
          <div className="flex items-center">
            <span className="text-sm font-semibold mr-3">Client</span>
            <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={clientPopoverOpen}
                  className="w-56 justify-between bg-white font-normal capitalize"
                >
                  <span className="truncate">
                    {clientFilter === "all" ? "All Clients" : clientFilter}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-0">
                <Command>
                  <CommandInput placeholder="Search client..." />
                  <CommandList>
                    <CommandEmpty>No client found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="all"
                        onSelect={() => {
                          setClientFilter("all");
                          setClientPopoverOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            clientFilter === "all" ? "opacity-100" : "opacity-0"
                          )}
                        />
                        All Clients
                      </CommandItem>
                      {clients.map((c) => (
                        <CommandItem
                          key={c}
                          value={c}
                          onSelect={() => {
                            setClientFilter(c.toLowerCase());
                            setClientPopoverOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              clientFilter === c.toLowerCase() ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {c}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Department Filter (Searchable) */}
          <div className="flex items-center">
            <span className="text-sm font-semibold mr-3">Department</span>
            <Popover open={deptPopoverOpen} onOpenChange={setDeptPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={deptPopoverOpen}
                  className="w-56 justify-between bg-white font-normal"
                >
                  <span className="truncate">
                    {departmentFilter === "all" ? "All Departments" : departmentFilter}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-0">
                <Command>
                  <CommandInput placeholder="Search dept..." />
                  <CommandList>
                    <CommandEmpty>No department found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="all"
                        onSelect={() => {
                          setDepartmentFilter("all");
                          setDeptPopoverOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            departmentFilter === "all" ? "opacity-100" : "opacity-0"
                          )}
                        />
                        All Departments
                      </CommandItem>
                      {departments.map((d) => (
                        <CommandItem
                          key={d}
                          value={d}
                          onSelect={() => {
                            setDepartmentFilter(d);
                            setDeptPopoverOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              departmentFilter === d ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {d}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Status Filter */}
          <div className="flex items-center">
            <span className="text-sm font-semibold mr-3">Status</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48 bg-white">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="On Hold">On Hold</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Clear Filters */}
          {(() => {
            const activeCount = [
              projectId,
              searchQuery,
              clientFilter !== "all" ? clientFilter : "",
              departmentFilter !== "all" ? departmentFilter : "",
              statusFilter !== "all" ? statusFilter : "",
              selectedKeyStepId,
            ].filter(Boolean).length;
            return (
              <Button
                variant={activeCount > 0 ? "destructive" : "outline"}
                size="sm"
                className="h-9 gap-1"
                disabled={activeCount === 0}
                onClick={() => {
                  setProjectId("");
                  setSearchQuery("");
                  setClientFilter("all");
                  setDepartmentFilter("all");
                  setStatusFilter("all");
                  setSelectedKeyStepId("");
                }}
              >
                <X className="h-3.5 w-3.5" />
                Clear Filters
                {activeCount > 0 && (
                  <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-xs font-semibold">
                    {activeCount}
                  </span>
                )}
              </Button>
            );
          })()}

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
                        <div className="flex flex-wrap gap-1 overflow-hidden max-h-[3.5rem]">
                          {Array.isArray(task.taskMembers) && task.taskMembers.length > 0
                            ? task.taskMembers.map((memberId: string) => {
                              const emp = employees.find(e => String(e.id) === String(memberId));
                              return (
                                <span key={memberId} className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium whitespace-nowrap">
                                  {emp?.name || memberId}
                                </span>
                              );
                            })
                            : <span className="text-sm text-slate-400">—</span>}
                        </div>
                      </td>

                      {/* start */}
                      <td className="px-3 py-3 text-center border-r text-sm text-slate-700">
                        {formatDate(task.startDate)}
                      </td>

                      {/* end */}
                      <td className="px-3 py-3 text-center border-r text-sm text-slate-700">
                        {formatDate(task.endDate)}
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
                    {isExpanded && (() => {
                      const taskProject = projects.find(p => String(p.id) === String(task.projectId));
                      return (
                        <tr className="bg-blue-50/40 border-b border-blue-100">
                          <td colSpan={10} className="px-6 py-5">
                            {/* Project Banner */}
                            <div className="flex items-center gap-3 mb-5 pb-3 border-b border-blue-200/60">
                              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white text-xs font-bold flex-shrink-0">
                                {(taskProject?.title || "?").charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 leading-none mb-0.5">Project</p>
                                <p className="text-sm font-semibold text-slate-900">
                                  {taskProject?.title || <span className="text-slate-400 italic">Unknown Project</span>}
                                </p>
                              </div>
                              {taskProject?.clientName && (
                                <div className="ml-auto">
                                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 leading-none mb-0.5">Client</p>
                                  <p className="text-sm font-medium text-slate-700">{taskProject.clientName}</p>
                                </div>
                              )}
                            </div>

                            {/* Detail grid — uniform 4-col layout */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-10 gap-y-4 mb-4">
                              {/* Status */}
                              <div className="min-w-0">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Status</p>
                                <div className="mt-0.5"><StatusBadge status={task.status} /></div>
                              </div>

                              {/* Priority */}
                              <div className="min-w-0">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Priority</p>
                                <div className="mt-0.5"><PriorityBadge priority={task.priority} /></div>
                              </div>

                              {/* Start Date */}
                              <div className="min-w-0">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Start Date</p>
                                <p className="text-sm text-slate-700 mt-0.5">{formatDate(task.startDate)}</p>
                              </div>

                              {/* End Date */}
                              <div className="min-w-0">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">End Date</p>
                                <p className="text-sm text-slate-700 mt-0.5">{formatDate(task.endDate)}</p>
                              </div>

                              {/* Subtask Count */}
                              <div className="min-w-0">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Subtasks</p>
                                <p className="text-sm font-medium text-slate-800 mt-0.5">{task.subtasks?.length || 0}</p>
                              </div>

                              {/* Assignees */}
                              <div className="min-w-0 col-span-2 md:col-span-3">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Assignees</p>
                                {Array.isArray(task.taskMembers) && task.taskMembers.length > 0 ? (
                                  <div className="flex flex-wrap gap-1.5 mt-0.5">
                                    {task.taskMembers.map((memberId: string) => {
                                      const emp = employees.find(e => String(e.id) === String(memberId));
                                      return (
                                        <span key={memberId} className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-xs font-medium">
                                          {emp?.name || memberId}
                                        </span>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <p className="text-sm text-slate-400 italic mt-0.5">No assignees</p>
                                )}
                              </div>

                              {/* Description */}
                              {task.description && (
                                <div className="col-span-2 md:col-span-4 min-w-0">
                                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Description</p>
                                  <p className="text-sm text-slate-700 leading-relaxed mt-0.5">{task.description}</p>
                                </div>
                              )}
                            </div>

                            {/* Subtasks list */}
                            {Array.isArray(task.subtasks) && task.subtasks.length > 0 && (
                              <div className="mt-4 pt-3 border-t border-blue-200/60">
                                <div className="font-medium mb-2 text-slate-800">Subtasks List</div>

                                {/* tree-style subtasks */}
                                <ul className="pl-4 space-y-3">
                                  {task.subtasks.map((subtask, idx) => {
                                    const numbering = `${taskIndex + 1}.${idx + 1}`;
                                    return (
                                      <li key={subtask.id || idx} className="flex gap-3 items-start">
                                        <div className="w-6 flex items-center justify-center flex-shrink-0">
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

                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center justify-between gap-4">
                                            <div className="min-w-0">
                                              <span className={`font-semibold ${subtask.isCompleted ? 'line-through text-slate-400' : ''}`}>{`${numbering}: ${subtask.title}`}</span>
                                            </div>
                                            <div className="text-xs text-slate-500 whitespace-nowrap flex-shrink-0">
                                              <span className="mr-3">Start: {formatDate(subtask.startDate)}</span>
                                              <span className="mr-3">End: {formatDate(subtask.endDate)}</span>
                                              <span>Status: {subtask.isCompleted ? "Completed" : "Pending"}</span>
                                            </div>
                                          </div>
                                          {subtask.description ? (
                                            <div className="text-xs text-slate-500 mt-1">{subtask.description}</div>
                                          ) : null}
                                        </div>

                                        {/* complete toggle (checkbox kept for accessibility) */}
                                        <div className="flex items-center flex-shrink-0">
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
                          </td>
                        </tr>
                      );
                    })()}

                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* DELETE DIALOG */}
      < Dialog open={openDeleteDialog} onOpenChange={setOpenDeleteDialog} >
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
      </Dialog >

      {/* QUICK ADD TASK DIALOG */}
      < Dialog open={quickAddTaskOpen} onOpenChange={setQuickAddTaskOpen} >
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
      </Dialog >

      {/* QUICK ADD SUBTASK DIALOG (kept, even if not triggered here) */}
      < Dialog open={quickAddSubtaskOpen} onOpenChange={setQuickAddSubtaskOpen} >
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
      </Dialog >

      {/* CLONE TASK DIALOG */}
      < Dialog open={cloneTaskOpen} onOpenChange={setCloneTaskOpen} >
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
      </Dialog >

      {/* CLONE SUBTASK DIALOG */}
      < Dialog open={cloneSubtaskOpen} onOpenChange={setCloneSubtaskOpen} >
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
      </Dialog >
    </div >
  );
}
