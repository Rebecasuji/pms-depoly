import { useState, useEffect, Fragment, useMemo } from "react";
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
  Percent,
  MessageSquare,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/apiClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { TaskFilters, CustomFilter } from "@/components/TaskFilters";

/* ================= TYPES ================= */

interface Subtask {
  id?: string;
  title: string;
  description?: string;
  isCompleted: boolean;
  assignedTo: string[]; // array of employee IDs
  startDate?: string | null;
  endDate?: string | null;
  progress?: number;
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
  progress?: number;
  taskPeriod?: string;
  reminderFrequency?: string;
  ticketId?: string;
}

/* ================= COMPONENT ================= */

interface Chip {
  type: string;
  label: string;
  id?: string;
}

export default function Tasks() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "ADMIN" || user?.employeeCode === "E0001";

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
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [keySteps, setKeySteps] = useState<any[]>([]);
  const [clients, setClients] = useState<string[]>([]);

  // Filters / UI state
  const [projectId, setProjectId] = useState<string>(() => {
    // Priority 1: URL query param (when navigating from Projects page — matches KeySteps behavior)
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("project_id") || params.get("projectId");
    if (fromUrl) {
      localStorage.setItem("tasks_projectId", fromUrl);
      localStorage.setItem("selectedProjectId", fromUrl);
      return fromUrl;
    }
    return localStorage.getItem("tasks_projectId") || "";
  });
  const [selectedKeyStepId, setSelectedKeyStepId] = useState<string>(() => localStorage.getItem("tasks_keyStepId") || "");
  const [expandedTasks, setExpandedTasks] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>(() => localStorage.getItem("tasks_searchQuery") || "");
  const [clientFilter, setClientFilter] = useState<string>(() => localStorage.getItem("tasks_clientFilter") || "all");
  const [departmentFilter, setDepartmentFilter] = useState<string>(() => localStorage.getItem("tasks_departmentFilter") || "all");
  const [statusFilter, setStatusFilter] = useState<string>(() => localStorage.getItem("tasks_statusFilter") || "all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>(() => localStorage.getItem("tasks_assigneeFilter") || "all");
  const [priorityFilter, setPriorityFilter] = useState<string>(() => localStorage.getItem("tasks_priorityFilter") || "all");
  const [progressFilter, setProgressFilter] = useState<string>(() => localStorage.getItem("tasks_progressFilter") || "all");
  const [periodFilter, setPeriodFilter] = useState<string>(() => localStorage.getItem("tasks_periodFilter") || "all");
  const [overdueFilter, setOverdueFilter] = useState<string>(() => localStorage.getItem("tasks_overdueFilter") || "all");
  const [projectPopoverOpen, setProjectPopoverOpen] = useState(false);
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [deptPopoverOpen, setDeptPopoverOpen] = useState(false);
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);
  const [assigneePopoverOpen, setAssigneePopoverOpen] = useState(false);

  // Custom Filters state
  const [customFilters, setCustomFilters] = useState<CustomFilter[]>(() => {
    const saved = localStorage.getItem("tasks_customFilters");
    return saved ? JSON.parse(saved) : [];
  });

  // Group By state
  const [groupBy, setGroupBy] = useState<string>("none");

  // Saved filter sets (Favorites)
  const [savedFilterSets, setSavedFilterSets] = useState<Record<string, any>>(() => {
    // Try DB settings first
    const dbFavorites = user?.filterSettings?.savedFilterSets;
    if (dbFavorites && Object.keys(dbFavorites).length > 0) return dbFavorites;

    const saved = localStorage.getItem("tasks_savedFilterSets");
    return saved ? JSON.parse(saved) : {};
  });

  // Pinned Filters (Users can add their own permanent-like filters)
  const [pinnedFilters, setPinnedFilters] = useState<Record<string, string>>(() => {
    // Try DB settings first
    const dbSettings = user?.filterSettings?.pinnedFilters;
    if (dbSettings && Object.keys(dbSettings).length > 0) return dbSettings;

    // Fallback to local storage
    const saved = localStorage.getItem("tasks_pinnedFilters");
    return saved ? JSON.parse(saved) : {};
  });

  // Sync Pinned Filters & Saved Filter Sets (Favorites) to DB when changed
  useEffect(() => {
    if (user?.id) {
      apiFetch("/api/users/filter-settings", {
        method: "PATCH",
        body: JSON.stringify({
          settings: {
            ...user.filterSettings,
            pinnedFilters,
            savedFilterSets
          }
        })
      }).catch(err => console.error("Failed to sync filters to DB:", err));
    }
    // Also keep local storage as fallback
    localStorage.setItem("tasks_pinnedFilters", JSON.stringify(pinnedFilters));
    localStorage.setItem("tasks_savedFilterSets", JSON.stringify(savedFilterSets));
  }, [pinnedFilters, savedFilterSets, user?.id]);

  // Persistent standard filters (LocalStorage only)
  useEffect(() => {
    localStorage.setItem("tasks_projectId", projectId);
    localStorage.setItem("tasks_searchQuery", searchQuery);
    localStorage.setItem("tasks_clientFilter", clientFilter);
    localStorage.setItem("tasks_departmentFilter", departmentFilter);
    localStorage.setItem("tasks_statusFilter", statusFilter);
    localStorage.setItem("tasks_assigneeFilter", assigneeFilter);
    localStorage.setItem("tasks_priorityFilter", priorityFilter);
    localStorage.setItem("tasks_progressFilter", progressFilter);
    localStorage.setItem("tasks_periodFilter", periodFilter);
    localStorage.setItem("tasks_overdueFilter", overdueFilter);
  }, [projectId, searchQuery, clientFilter, departmentFilter, statusFilter, assigneeFilter, priorityFilter, progressFilter, periodFilter, overdueFilter]);

  // Sync with URL on mount or location change — handles navigation from Projects page (matches KeySteps behavior)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("project_id") || params.get("projectId");
    if (fromUrl && fromUrl !== projectId) {
      setTasks([]); // Clear stale data before loading new project's tasks
      setSelectedKeyStepId("");
      setProjectId(fromUrl);
      localStorage.setItem("tasks_projectId", fromUrl);
      localStorage.setItem("selectedProjectId", fromUrl);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [window.location.search]);

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
    "Sales",
  ]);

  // Delete dialog state
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  // Quick Add Task
  const [quickAddTaskOpen, setQuickAddTaskOpen] = useState(false);
  const [quickTaskName, setQuickTaskName] = useState("");

  // Compact inline quick add task
  const [newQuickTaskName, setNewQuickTaskName] = useState("");
  const [newQuickTaskProjectId, setNewQuickTaskProjectId] = useState("");

  // Sync quick add project with current project filter
  useEffect(() => {
    if (projectId) {
      setNewQuickTaskProjectId(projectId);
    }
  }, [projectId]);

  const submitQuickTaskAtTop = async () => {
    if (!newQuickTaskName.trim()) {
      alert("Please enter a task name");
      return;
    }
    const targetProjId = newQuickTaskProjectId || projectId;
    if (!targetProjId) {
      alert("Please select a project first.");
      return;
    }

    try {
      const res = await apiFetch("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          projectId: targetProjId,
          taskName: newQuickTaskName.trim(),
          description: "",
          status: "pending",
          priority: "medium",
          assignerId: user?.employeeId ?? null,
        }),
      });

      if (!res.ok) throw new Error("Failed");
      setNewQuickTaskName("");
      refreshTasks();
    } catch {
      alert("Failed to create task");
    }
  };

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

      refreshTasks();
    } catch (err) {
      // revert optimistic
      setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, subtasks: (t.subtasks || []).filter(s => s.id !== tempId) } : t)));
      console.error(err);
      alert("Failed to add subtask");
    }
  };
  const toggleSubtaskCompletion = async (taskId: string, subtaskId: string, currentlyCompleted?: boolean) => {
    const targetVal = typeof currentlyCompleted !== 'undefined' ? !currentlyCompleted : true;
    const newProgress = targetVal ? 100 : 0;

    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          subtasks: t.subtasks?.map(s => s.id === subtaskId ? { ...s, isCompleted: targetVal, progress: newProgress } : s)
        };
      }
      return t;
    }));

    try {
      const res = await apiFetch(`/api/subtasks/${subtaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progress: newProgress }),
      });

      if (!res.ok) throw new Error("Failed to update subtask");
      // Signal Completed page to refresh when subtask is marked done
      if (targetVal) sessionStorage.setItem("__completedRefresh", Date.now().toString());
      refreshTasks(); // Non-blocking background refresh
    } catch (err) {
      console.error(err);
      alert("Failed to update subtask status");
      refreshTasks();
    }
  };

  const updateSubtaskProgress = async (taskId: string, subtaskId: string, value: number) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          subtasks: t.subtasks?.map(s => s.id === subtaskId ? { ...s, progress: value, isCompleted: value === 100 } : s)
        };
      }
      return t;
    }));

    try {
      await apiFetch(`/api/subtasks/${subtaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progress: value }),
      });
      await refreshTasks();
    } catch (err) {
      console.error(err);
    }
  };

  const [editingTaskField, setEditingTaskField] = useState<{ taskId: string; field: string } | null>(null);
  const [tempTaskValue, setTempTaskValue] = useState<string>("");

  const startEditingTask = (taskId: string, field: string, initialValue: string) => {
    setEditingTaskField({ taskId, field });
    setTempTaskValue(initialValue || "");
  };

  const handleInlineTaskUpdate = async (taskId: string, field: string, value: any) => {
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, [field]: value } : t));
    setEditingTaskField(null);

    // If task was just marked Completed, remove it from view after a short delay
    if (field === "status" && String(value).toLowerCase() === "completed") {
      setTimeout(() => {
        setTasks(prev => prev.filter(t => t.id !== taskId));
      }, 800);
    }

    try {
      // Backend mapping: UI 'taskMembers' -> Backend 'assignedMembers'
      const payloadField = field === "taskMembers" ? "assignedMembers" : field;

      const res = await apiFetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [payloadField]: value }),
      });

      if (!res.ok) throw new Error("Update failed");
      
      // refresh in background to get server-side calculated progress if any
      refreshTasks();
    } catch (err) {
      console.error(err);
      alert("Failed to update task");
      refreshTasks(); // Revert/sync with server
    }
  };

  const handleMemberToggle = async (taskId: string, memberId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const currentMembers = Array.isArray(task.taskMembers) ? task.taskMembers : [];
    const isMember = currentMembers.some(id => String(id) === String(memberId));
    
    let newMembers;
    if (isMember) {
      newMembers = currentMembers.filter(id => String(id) !== String(memberId));
    } else {
      newMembers = [...currentMembers, memberId];
    }

    await handleInlineTaskUpdate(taskId, "taskMembers", newMembers);
  };

  /* ================= LOAD INITIAL DATA ================= */

  useEffect(() => {
    apiFetch("/api/projects")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        setProjects(arr);
        // Derive unique clients from projects
        const clientSet = new Set<string>();
        arr.forEach((p: any) => { if (p.clientName) clientSet.add(String(p.clientName)); });
        setClients(Array.from(clientSet));
      })
      .catch(() => setProjects([]));

    // Initially load all employees if no project is selected (global view)
    if (!projectId) {
      apiFetch("/api/employees")
        .then((r) => r.ok ? r.json() : [])
        .then((data) => {
          const arr = Array.isArray(data) ? data : [];
          setEmployees(arr);
          setAllEmployees(arr);
        })
        .catch(() => {
          setEmployees([]);
          setAllEmployees([]);
        });
    } else {
      // Still need all employees for lookup even if a project is selected
      apiFetch("/api/employees")
        .then((r) => r.ok ? r.json() : [])
        .then((data) => setAllEmployees(Array.isArray(data) ? data : []))
        .catch(() => setAllEmployees([]));
    }
  }, []);

  /* ================= LOAD PROJECT-SPECIFIC DATA ================= */

  useEffect(() => {
    // Clear selection when filters change
    setSelectedTaskIds([]);

    // If status is 'all', we request '' (all) by default
    const statusParam = statusFilter === "all" ? "" : statusFilter;

    if (!projectId) {
      // Load all tasks (active/selected status)
      apiFetch(`/api/tasks/bulk?status=${statusParam}`, { bypassCache: true })
        .then((r) => r.ok ? r.json() : [])
        .then((data) => {
          console.log("[TASKS DEBUG] Data received from backend:", data);
          setTasks(normalizeTasks(data));
        })
        .catch((err) => {
          console.error("[TASKS DEBUG] Failed to fetch tasks:", err);
          setTasks([]);
        });

      // Load all key steps so names are available in the table
      apiFetch(`/api/keysteps/bulk?status=all`)
        .then((r) => r.ok ? r.json() : [])
        .then((data) => setKeySteps(Array.isArray(data) ? data : []))
        .catch(() => setKeySteps([]));

      // Reset employees to all employees for global view
      if (allEmployees.length > 0) {
        setEmployees(allEmployees);
      } else {
        apiFetch("/api/employees")
          .then(r => r.ok ? r.json() : [])
          .then(data => {
            const arr = Array.isArray(data) ? data : [];
            setEmployees(arr);
            setAllEmployees(arr);
          });
      }
      return;
    }

    // Load project-specific tasks
    apiFetch(`/api/tasks/${projectId}?status=${statusParam}`, { bypassCache: true })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setTasks(normalizeTasks(data)))
      .catch(() => setTasks([]));

    // Load Key Steps for project
    apiFetch(`/api/projects/${projectId}/key-steps`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setKeySteps(Array.isArray(data) ? data : []))
      .catch(() => setKeySteps([]));

    // Project-based Member Filtering:
    // When a project is selected, fetch only members assigned to that project.
    // If no project is selected, fall back to all employees (for global view).
    const membersUrl = `/api/projects/${projectId}/members`;
    apiFetch(membersUrl)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        const memberList = Array.isArray(data) ? data : [];
        console.log(`[TASKS-MEMBERS] Loaded ${memberList.length} members for project ${projectId}`);
        setEmployees(memberList);
      })
      .catch((err) => {
        console.error("[TASKS-MEMBERS] Failed to fetch project members:", err);
        // Fallback to all employees if project members fetch fails or if we want global access
        apiFetch("/api/employees")
          .then(r => r.ok ? r.json() : [])
          .then(data => setEmployees(Array.isArray(data) ? data : []));
      });

  }, [projectId, departmentFilter, statusFilter, isAdmin]);

  /* ================= PERSIST FILTERS TO LOCALSTORAGE ================= */

  useEffect(() => { localStorage.setItem("tasks_projectId", projectId); }, [projectId]);
  useEffect(() => { localStorage.setItem("tasks_keyStepId", selectedKeyStepId); }, [selectedKeyStepId]);
  useEffect(() => { localStorage.setItem("tasks_searchQuery", searchQuery); }, [searchQuery]);
  useEffect(() => { localStorage.setItem("tasks_clientFilter", clientFilter); }, [clientFilter]);
  useEffect(() => { localStorage.setItem("tasks_departmentFilter", departmentFilter); }, [departmentFilter]);
  useEffect(() => { localStorage.setItem("tasks_statusFilter", statusFilter); }, [statusFilter]);
  useEffect(() => { localStorage.setItem("tasks_assigneeFilter", assigneeFilter); }, [assigneeFilter]);
  useEffect(() => { localStorage.setItem("tasks_priorityFilter", priorityFilter); }, [priorityFilter]);
  useEffect(() => { localStorage.setItem("tasks_progressFilter", progressFilter); }, [progressFilter]);
  useEffect(() => { localStorage.setItem("tasks_customFilters", JSON.stringify(customFilters)); }, [customFilters]);
  useEffect(() => { localStorage.setItem("tasks_savedFilterSets", JSON.stringify(savedFilterSets)); }, [savedFilterSets]);
  useEffect(() => { localStorage.setItem("tasks_pinnedFilters", JSON.stringify(pinnedFilters)); }, [pinnedFilters]);

  // User must select at minimum a Department OR a Project before tasks are shown
  // UNLESS the user is an Admin, who sees everything by default.
  // UPDATE: User wants to see tasks even if "All Projects" is selected.
  const hasRequiredFilter = true; // Always show tasks but apply filters

  /* ================= FILTERED TASKS ================= */

  const uniqueProgressValues = Array.from(new Set(tasks.map(t => t.progress || 0))).sort((a, b) => a - b);

  const filteredTasks: Task[] = !hasRequiredFilter ? [] : tasks.filter((t) => {
    // Project data for filtering
    const taskProject = projects.find(p => String(p.id) === String(t.projectId));

    // Search filter — match task name, project title, assignee names, status, or description
    const memberNames = (t.taskMembers || []).map(mId => allEmployees.find(e => String(e.id) === String(mId))?.name || "").join(" ");
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = ((t.taskName || "").toLowerCase().includes(searchLower)) ||
      (taskProject && taskProject.title && taskProject.title.toLowerCase().includes(searchLower)) ||
      (memberNames.toLowerCase().includes(searchLower)) ||
      (t.status && t.status.toLowerCase().includes(searchLower)) ||
      (t.description && t.description.toLowerCase().includes(searchLower)) ||
      (t.priority && t.priority.toLowerCase().includes(searchLower));

    const matchesKey = selectedKeyStepId
      ? String(t.keyStepId) === String(selectedKeyStepId)
      : true;

    // In "All Projects" view, do not hide tasks just because their project object is not in the active projects list.
    // This ensures tasks in completed projects or directly assigned tasks are visible.
    const matchesKnownProject = true;

    // Client filter
    const matchesClient = clientFilter === "all" ||
      (taskProject && String(taskProject.clientName || "").toLowerCase() === clientFilter.toLowerCase());

    // Department filter — match project dept OR any assigned member's dept
    const filterDeptNorm = normalizeDept(departmentFilter);
    const projectDepts: string[] = taskProject?.department || [];
    const memberDepts: string[] = (t.taskMembers || []).flatMap((memberId: string) => {
      const emp = allEmployees.find((e: any) => String(e.id) === String(memberId));
      return emp?.department ? [emp.department as string] : [];
    });
    const allDepts = [...projectDepts, ...memberDepts];
    const matchesDepartment = departmentFilter === "all" ||
      allDepts.some((d: string) => normalizeDept(d) === filterDeptNorm);

    // Status filter — explicitly filter by status
    const taskStatus = (t.status || "").toLowerCase();
    const matchesStatus = statusFilter === "all"
      ? true 
      : taskStatus === statusFilter.toLowerCase();

    // Assignee filter — match if the selected employee is in the task members OR is the assigner OR matches department
    const selectedEmployeeObj = allEmployees.find(e => String(e.id) === String(assigneeFilter));
    const empDept = selectedEmployeeObj ? normalizeDept(selectedEmployeeObj.department) : "";

    const matchesAssignee = assigneeFilter === "all" || (() => {
      const isAssigned = (t.taskMembers || []).some((id: string) => String(id) === String(assigneeFilter)) ||
        String(t.assignerId) === String(assigneeFilter);
      
      const allDeptsNorm = allDepts.map(d => normalizeDept(d));
      const isDeptRelated = empDept && allDeptsNorm.some(d => d === empDept);

      return isAssigned || isDeptRelated;
    })();

    // Priority filter
    const matchesPriority = priorityFilter === "all" || String(t.priority).toLowerCase() === priorityFilter.toLowerCase();

    // Progress filter
    const matchesProgress = progressFilter === "all" || String(t.progress || 0) === progressFilter;

    // Period filter
    let matchesPeriod = true;
    if (periodFilter !== "all") {
      // First try matching by taskPeriod field
      const periodMap: Record<string, string> = {
        "1": "today",
        "7": "1 week",
        "15": "fortnight",
        "30": "1 month",
        "90": "quarterly",
        "180": "half yearly",
        "365": "annual"
      };
      
      const mappedPeriod = periodMap[periodFilter];
      if (mappedPeriod && t.taskPeriod === mappedPeriod) {
        matchesPeriod = true;
      } else {
        // Fallback to date range calculation
        const days = parseInt(periodFilter);
        const now = new Date();
        const targetDate = new Date();
        targetDate.setDate(now.getDate() - days);
        
        const taskStart = t.startDate ? new Date(t.startDate) : null;
        const taskEnd = t.endDate ? new Date(t.endDate) : null;
        
        if (days === 1) {
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
          matchesPeriod = !!((taskStart && taskStart <= endOfToday) && (taskEnd && taskEnd >= startOfToday));
        } else {
          matchesPeriod = !!((taskStart && taskStart >= targetDate) || (taskEnd && taskEnd >= targetDate));
        }
      }
    }

    // Overdue filter
    let matchesOverdue = true;
    if (overdueFilter !== "all") {
      const now = new Date();
      const end = t.endDate ? new Date(t.endDate) : null;
      const isCompleted = String((t.status || "")).toLowerCase() === "completed";
      const isOverdue = !!(end && end < new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) && !isCompleted);
      matchesOverdue = overdueFilter === "overdue" ? isOverdue : true;
    }
    // Custom filters
    const matchesCustom = customFilters.every(cf => {
      if (!cf.value) return true;
      let taskValue: any = t[cf.field as keyof Task];

      // Handle special cases for fields
      if (cf.field === "startDate" || cf.field === "endDate") {
        if (!taskValue) return false;
      }

      const val = String(taskValue || "").toLowerCase();
      const filterVal = cf.value.toLowerCase();

      switch (cf.operator) {
        case "==": return val === filterVal;
        case "!=": return val !== filterVal;
        case "contains": return val.includes(filterVal);
        case ">": return Number(taskValue || 0) > Number(cf.value);
        case "<": return Number(taskValue || 0) < Number(cf.value);
        default: return true;
      }
    });

    // Pinned filters logic
    const matchesPinned = Object.entries(pinnedFilters).every(([field, value]) => {
      if (!value || value === "all") return true;
      const taskValue = t[field as keyof Task];
      return String(taskValue || "").toLowerCase() === value.toLowerCase();
    });

    return matchesSearch && matchesKey && matchesKnownProject && matchesClient && matchesDepartment && matchesStatus && matchesAssignee && matchesCustom && matchesPriority && matchesProgress && matchesPinned && matchesPeriod && matchesOverdue;
  });

  console.log(`[TASKS-DEBUG] Total Tasks: ${tasks.length}, Filtered Tasks: ${filteredTasks.length}, hasRequiredFilter: ${hasRequiredFilter}, projectId: ${projectId}, statusFilter: ${statusFilter}`);

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
      progress: t.progress || 0,
      taskPeriod: t.taskPeriod || t.task_period || "custom",
      reminderFrequency: t.reminderFrequency || t.reminder_frequency || "4 times",
      subtasks: (Array.isArray(t.subtasks) ? t.subtasks : []).map((st: any) => ({
        ...st,
        isCompleted: !!st.isCompleted,
        progress: st.progress || 0,
      })),
    }));
  };

  const refreshTasks = async () => {
    try {
      const statusParam = statusFilter === "all" ? "" : statusFilter;
      const url = projectId
        ? `/api/tasks/${projectId}?status=${statusParam}`
        : `/api/tasks/bulk?status=${statusParam}`;
      const updated = await apiFetch(url, { bypassCache: true }).then((r) => r.ok ? r.json() : []);
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
    const deletedId = taskToDelete.id;

    // Close dialog and remove from local state immediately (optimistic UI)
    setOpenDeleteDialog(false);
    setTasks(prev => prev.filter(t => t.id !== deletedId));
    setTaskToDelete(null);

    try {
      const res = await apiFetch(`/api/tasks/${deletedId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      // refresh just in case anything else changed
      refreshTasks();
    } catch {
      alert("Delete failed");
      refreshTasks(); // revert by fetching again
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

    const name = quickTaskName.trim();
    setQuickTaskName("");
    setQuickAddTaskOpen(false);

    // optimistic
    const tempId = `tmp-${Date.now()}`;
    const newTask: Task = {
      id: tempId,
      projectId,
      taskName: name,
      status: "pending",
      priority: "medium",
      assignerId: user?.id ?? "",
      subtasks: [],
      progress: 0,
    };
    setTasks(prev => [newTask, ...prev]);

    try {
      const res = await apiFetch("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          projectId,
          taskName: name,
          description: "",
          status: "pending",
          priority: "medium",
          assignerId: user?.employeeId ?? null,
        }),
      });

      if (!res.ok) throw new Error("Failed");
      refreshTasks();
    } catch {
      alert("Failed to create task");
      setTasks(prev => prev.filter(t => t.id !== tempId));
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

      refreshTasks();
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

  const getStatusStyle = (status: string) => {
    const s = String(status || "").toLowerCase();
    if (s === "completed") {
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }
    if (s === "in progress" || s === "in-progress") {
      return "bg-sky-50 text-sky-700 border-sky-200";
    }
    if (s === "planned") {
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    }
    if (s === "on hold" || s === "on-hold") {
      return "bg-amber-50 text-amber-700 border-amber-200";
    }
    return "bg-slate-50 text-slate-600 border-slate-200";
  };

  const StatusBadge = ({ task }: { task: Task }) => (
    <Popover open={editingTaskField?.taskId === task.id && editingTaskField?.field === "status"}
      onOpenChange={(open) => open ? startEditingTask(task.id, "status", task.status) : setEditingTaskField(null)}>
      <PopoverTrigger asChild>
        <button className="cursor-pointer hover:opacity-80 transition-opacity">
          <Badge
            variant="outline"
            className={cn("text-[11px] font-bold px-2.5 py-0.5 rounded-full inline-flex justify-center min-w-[95px] border whitespace-nowrap", getStatusStyle(task.status))}
          >
            {task.status || "—"}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-40" align="center">
        <Command>
          <CommandList>
            <CommandGroup>
              {["Not Started", "Planned", "In Progress", "On Hold", "Completed"].map((s) => (
                <CommandItem
                  key={s}
                  onSelect={() => handleInlineTaskUpdate(task.id, "status", s)}
                >
                  <Check className={cn("mr-2 h-4 w-4", task.status === s ? "opacity-100" : "opacity-0")} />
                  {s}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );

  const PriorityBadge = ({ task }: { task: Task }) => (
    <Popover open={editingTaskField?.taskId === task.id && editingTaskField?.field === "priority"}
      onOpenChange={(open) => open ? startEditingTask(task.id, "priority", task.priority) : setEditingTaskField(null)}>
      <PopoverTrigger asChild>
        <button className="cursor-pointer hover:opacity-80 transition-opacity">
          <Badge
            variant="outline"
            className={cn(
              "text-[11px] font-bold px-2.5 py-0.5 rounded-full inline-flex justify-center min-w-[75px] border capitalize whitespace-nowrap",
              task.priority === "high"
                ? "bg-rose-50 text-rose-700 border-rose-200"
                : task.priority === "medium"
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
            )}
          >
            {task.priority || "—"}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-32" align="center">
        <Command>
          <CommandList>
            <CommandGroup>
              {["low", "medium", "high"].map((p) => (
                <CommandItem
                  key={p}
                  onSelect={() => handleInlineTaskUpdate(task.id, "priority", p)}
                  className="capitalize"
                >
                  <Check className={cn("mr-2 h-4 w-4", task.priority === p ? "opacity-100" : "opacity-0")} />
                  {p}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );

  const KeyStepBadge = ({ task }: { task: Task }) => {
    const ks = keySteps.find(k => String(k.id) === String(task.keyStepId));
    return (
      <Popover open={editingTaskField?.taskId === task.id && editingTaskField?.field === "keyStepId"}
        onOpenChange={(open) => open ? startEditingTask(task.id, "keyStepId", task.keyStepId || "") : setEditingTaskField(null)}>
        <PopoverTrigger asChild>
          <button className="cursor-pointer hover:opacity-80 transition-opacity text-left max-w-full truncate block">
            {ks ? (
              <Badge variant="outline" className="text-[11px] bg-indigo-50 text-indigo-700 border-indigo-200 px-2 py-0.5 rounded-full font-medium truncate max-w-[150px] inline-block">
                {ks.title}
              </Badge>
            ) : (
              <span className="text-[10px] text-slate-400 italic">No Key Step</span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-64" align="center">
          <Command>
            <CommandInput placeholder="Search key step..." className="h-8 text-xs" />
            <CommandList className="max-h-48 overflow-y-auto">
              <CommandEmpty className="p-2 text-xs text-slate-400 text-center">No milestones found.</CommandEmpty>
              <CommandGroup>
                <CommandItem onSelect={() => handleInlineTaskUpdate(task.id, "keyStepId", null)}>
                  <Check className={cn("mr-2 h-4 w-4", !task.keyStepId ? "opacity-100" : "opacity-0")} />
                  No Key Step
                </CommandItem>
                {keySteps.map((k) => (
                  <CommandItem
                    key={k.id}
                    onSelect={() => handleInlineTaskUpdate(task.id, "keyStepId", k.id)}
                  >
                    <Check className={cn("mr-2 h-4 w-4", String(task.keyStepId) === String(k.id) ? "opacity-100" : "opacity-0")} />
                    {k.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  };

  const PeriodBadge = ({ task }: { task: Task }) => (
    <Popover open={editingTaskField?.taskId === task.id && editingTaskField?.field === "taskPeriod"}
      onOpenChange={(open) => open ? startEditingTask(task.id, "taskPeriod", task.taskPeriod || "custom") : setEditingTaskField(null)}>
      <PopoverTrigger asChild>
        <button className="cursor-pointer hover:opacity-80 transition-opacity">
          {task.taskPeriod && task.taskPeriod !== "custom" ? (
            <Badge variant="outline" className="text-[11px] capitalize bg-blue-50/70 text-blue-700 border-blue-200/60 rounded-full font-semibold">
              {task.taskPeriod}
            </Badge>
          ) : (
            <span className="text-slate-400 font-medium">—</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-40" align="center">
        <Command>
          <CommandList>
            <CommandGroup>
              {["custom", "today", "1 week", "fortnight", "1 month", "quarterly", "half yearly", "annual"].map((p) => (
                <CommandItem
                  key={p}
                  onSelect={() => handleInlineTaskUpdate(task.id, "taskPeriod", p)}
                  className="capitalize"
                >
                  <Check className={cn("mr-2 h-4 w-4", (task.taskPeriod || "custom") === p ? "opacity-100" : "opacity-0")} />
                  {p}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );

  const FrequencyBadge = ({ task }: { task: Task }) => (
    <Popover open={editingTaskField?.taskId === task.id && editingTaskField?.field === "reminderFrequency"}
      onOpenChange={(open) => open ? startEditingTask(task.id, "reminderFrequency", task.reminderFrequency || "4 times") : setEditingTaskField(null)}>
      <PopoverTrigger asChild>
        <button className="cursor-pointer hover:opacity-80 transition-opacity">
          <Badge variant="outline" className="text-[11px] capitalize bg-amber-50/70 text-amber-700 border-amber-200/60 rounded-full font-semibold">
            {task.reminderFrequency || "4 Times"}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-40" align="center">
        <Command>
          <CommandList>
            <CommandGroup>
              {["1 time", "2 times", "4 times", "daily", "weekly", "monthly", "custom"].map((f) => (
                <CommandItem
                  key={f}
                  onSelect={() => handleInlineTaskUpdate(task.id, "reminderFrequency", f)}
                  className="capitalize"
                >
                  <Check className={cn("mr-2 h-4 w-4", (task.reminderFrequency || "4 times") === f ? "opacity-100" : "opacity-0")} />
                  {f}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );


  // Grouping logic
  const groupedTasks = useMemo(() => {
    if (!groupBy || groupBy === "none") {
      if (assigneeFilter !== "all") {
        const selectedEmployeeObj = allEmployees.find(e => String(e.id) === String(assigneeFilter));
        const employeeName = selectedEmployeeObj ? selectedEmployeeObj.name : "";

        const assignedGroup: Task[] = [];
        const deptGroup: Task[] = [];

        filteredTasks.forEach(t => {
          const isAssigned = (t.taskMembers || []).some((id: string) => String(id) === String(assigneeFilter)) ||
            String(t.assignerId) === String(assigneeFilter);
          
          if (isAssigned) {
            assignedGroup.push(t);
          } else {
            deptGroup.push(t);
          }
        });

        const groups: Record<string, Task[]> = {};
        if (assignedGroup.length > 0) {
          groups[`Assigned to ${employeeName}`] = assignedGroup;
        }
        if (deptGroup.length > 0) {
          groups[`Department Related`] = deptGroup;
        }
        return groups;
      }
      return { "": filteredTasks };
    }

    const groups: Record<string, typeof filteredTasks> = {};

    filteredTasks.forEach(task => {
      let groupName = "Unknown";
      const taskProject = projects.find(p => String(p.id) === String(task.projectId));

      switch (groupBy) {
        case "projectId":
          groupName = taskProject?.title || "No Project";
          break;
        case "clientName":
          groupName = taskProject?.clientName || "No Client";
          break;
        case "status":
          groupName = task.status || "No Status";
          break;
        case "assignee": {
          const members = Array.isArray(task.taskMembers) ? task.taskMembers : [];
          if (members.length === 0) {
            groupName = "Unassigned";
          } else {
            // Take first assignee for grouping simplicity
            const firstId = members[0];
            groupName = allEmployees.find(e => String(e.id) === String(firstId))?.name || "Unknown Assignee";
          }
          break;
        }
        case "priority":
          groupName = (task.priority || "No Priority").charAt(0).toUpperCase() + (task.priority || "No Priority").slice(1);
          break;
        case "department": {
          const projectDepts = taskProject?.department || [];
          const memberDepts: string[] = (task.taskMembers || []).flatMap((memberId: string) => {
            const emp = allEmployees.find((e: any) => String(e.id) === String(memberId));
            return emp?.department ? [emp.department as string] : [];
          });
          const allDepts = Array.from(new Set([...projectDepts, ...memberDepts]));
          groupName = allDepts.length > 0 ? allDepts.join(", ") : "No Department";
          break;
        }
        case "keyStep":
          groupName = keySteps.find(ks => String(ks.id) === String(task.keyStepId))?.title || "No Key Step";
          break;
        case "progress":
          groupName = `Progress: ${task.progress || 0}%`;
          break;
        case "startDate":
        case "endDate": {
          const dateStr = task[groupBy as keyof Task] as string;
          if (!dateStr) {
            groupName = "No Date";
          } else {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) {
              groupName = "Invalid Date";
            } else {
              groupName = d.toLocaleString('default', { month: 'long', year: 'numeric' });
            }
          }
          break;
        }
        default:
          groupName = "Other";
      }

      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(task);
    });

    // Prioritize assigned tasks within each custom group
    if (assigneeFilter !== "all") {
      Object.keys(groups).forEach(key => {
        groups[key].sort((a, b) => {
          const aAssigned = (a.taskMembers || []).some((id: string) => String(id) === String(assigneeFilter)) || String(a.assignerId) === String(assigneeFilter);
          const bAssigned = (b.taskMembers || []).some((id: string) => String(id) === String(assigneeFilter)) || String(b.assignerId) === String(assigneeFilter);
          if (aAssigned && !bAssigned) return -1;
          if (!aAssigned && bAssigned) return 1;
          return 0;
        });
      });
    }

    return groups;
  }, [filteredTasks, groupBy, projects, employees, keySteps, assigneeFilter]);

  const handleClearFilters = () => {
    setProjectId("");
    setSearchQuery("");
    setClientFilter("all");
    setDepartmentFilter("all");
    setStatusFilter("all");
    setAssigneeFilter("all");
    setPriorityFilter("all");
    setProgressFilter("all");
    setPinnedFilters({});
    setSelectedKeyStepId("");
    setCustomFilters([]);
    setGroupBy("none");
    setPeriodFilter("all");
  };

  const removeFilterChip = (type: string, id?: string) => {
    switch (type) {
      case "project": setProjectId(""); break;
      case "client": setClientFilter("all"); break;
      case "keystep": setSelectedKeyStepId(""); break;
      case "department": setDepartmentFilter("all"); break;
      case "status": setStatusFilter("all"); break;
      case "assignee": setAssigneeFilter("all"); break;
      case "priority": setPriorityFilter("all"); break;
      case "progress": setProgressFilter("all"); break;
      case "pinned":
        if (id) {
          setPinnedFilters(prev => ({ ...prev, [id]: "all" }));
        }
        break;
      case "search": setSearchQuery(""); break;
      case "period": setPeriodFilter("all"); break;
      case "custom": setCustomFilters(prev => prev.filter(f => f.id !== id)); break;
    }
  };

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

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <TaskFilters
              projectId={projectId}
              setProjectId={setProjectId}
              projects={projects}
              clientFilter={clientFilter}
              setClientFilter={setClientFilter}
              clients={clients}
              selectedKeyStepId={selectedKeyStepId}
              setSelectedKeyStepId={setSelectedKeyStepId}
              keySteps={keySteps}
              departmentFilter={departmentFilter}
              setDepartmentFilter={setDepartmentFilter}
              departments={departments}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              assigneeFilter={assigneeFilter}
              setAssigneeFilter={setAssigneeFilter}
              employees={employees}
              priorityFilter={priorityFilter}
              setPriorityFilter={setPriorityFilter}
              progressFilter={progressFilter}
              setProgressFilter={setProgressFilter}
              uniqueProgressValues={uniqueProgressValues}
              pinnedFilters={pinnedFilters}
              setPinnedFilters={setPinnedFilters}
              tasks={tasks} // Needed to calculate unique values for pinned fields
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              customFilters={customFilters}
              setCustomFilters={setCustomFilters}
              savedFilterSets={savedFilterSets}
              setSavedFilterSets={setSavedFilterSets}
              groupBy={groupBy}
              setGroupBy={setGroupBy}
              onClearAll={handleClearFilters}
              onApply={refreshTasks} // Fetch fresh tasks when filters are applied
              periodFilter={periodFilter}
              setPeriodFilter={setPeriodFilter}
            />

            <Button
              onClick={() => setOverdueFilter(prev => prev === "overdue" ? "all" : "overdue")}
              className={cn(
                "h-9 px-3 text-xs flex items-center gap-2",
                overdueFilter === "overdue" ? "bg-red-600 text-white" : "bg-white border border-slate-200 text-slate-700"
              )}
            >
              <span>Overdue</span>
            </Button>

            <div className="h-8 w-[1px] bg-slate-200 hidden md:block" />

            <div className="flex items-center gap-2">
              <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                <Plus className="h-4 w-4 mr-1" /> Add Task
              </Button>

              <Button
                onClick={() => setQuickAddTaskOpen(true)}
                variant="outline"
                className="border-amber-200 text-amber-700 hover:bg-amber-50 shadow-sm"
              >
                <Plus className="h-4 w-4 mr-1" /> Quick Add
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <Input
                className="pl-9 w-64 bg-white border-slate-200 focus:ring-2 focus:ring-blue-100 transition-all"
                placeholder="Quick search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* ACTIVE FILTER CHIPS (Odoo Style) */}
        {(() => {
          const chips: Chip[] = [];
          if (projectId) chips.push({ type: "project", label: `Project: ${projects.find(p => String(p.id) === projectId)?.title || projectId}` });
          if (clientFilter !== "all") chips.push({ type: "client", label: `Client: ${clientFilter}` });
          if (selectedKeyStepId) {
            const keyStepLabel = keySteps.find(ks => String(ks.id) === String(selectedKeyStepId))?.title || selectedKeyStepId;
            chips.push({ type: "keystep", label: `Key Step: ${keyStepLabel}` });
          }
          if (departmentFilter !== "all") chips.push({ type: "department", label: `Dept: ${departmentFilter}` });
          if (statusFilter !== "all") chips.push({ type: "status", label: `Status: ${statusFilter}` });
          if (priorityFilter !== "all") chips.push({ type: "priority", label: `Priority: ${priorityFilter}` });
          if (progressFilter !== "all") chips.push({ type: "progress", label: `Progress: ${progressFilter}%` });

          Object.entries(pinnedFilters).forEach(([field, value]) => {
            if (value && value !== "all") {
              chips.push({ type: "pinned", id: field, label: `${field}: ${value}` });
            }
          });

          if (assigneeFilter !== "all") chips.push({ type: "assignee", label: `Assigned: ${employees.find(e => String(e.id) === assigneeFilter)?.name || assigneeFilter}` });
          if (overdueFilter !== "all") chips.push({ type: "overdue", label: `Overdue: ${overdueFilter}` });
          if (periodFilter !== "all") {
            const periodLabels: Record<string, string> = {
              "1": "Today",
              "7": "1 Week",
              "15": "Fortnight",
              "30": "1 Month",
              "90": "Quarterly",
              "180": "Half Yearly",
              "365": "Annual"
            };
            chips.push({ type: "period", label: `Period: ${periodLabels[periodFilter] || periodFilter}` });
          }
          if (searchQuery) chips.push({ type: "search", label: `Search: ${searchQuery}` });

          customFilters.forEach(cf => {
            if (cf.value) {
              chips.push({ type: "custom", id: cf.id, label: `${cf.field} ${cf.operator} ${cf.value}` });
            }
          });

          if (chips.length === 0) return null;

          return (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Active Filters:</span>
              {(chips as Chip[]).map((chip, idx) => (
                <Badge
                  key={idx}
                  variant="secondary"
                  className="bg-white border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors px-2 py-1 flex items-center gap-1.5 shadow-sm rounded-md"
                >
                  <span className="text-xs font-medium">{chip.label}</span>
                  <button
                    onClick={() => removeFilterChip(chip.type, chip.id)}
                    className="text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </Badge>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="h-7 px-2 text-xs text-slate-500 hover:text-red-600 hover:bg-red-50 font-semibold"
              >
                Clear All
              </Button>
            </div>
          );
        })()}
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
           {/* MAIN TABLE CONTAINER */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-sm max-h-[calc(100vh-220px)] custom-scrollbar relative">
        <table className="w-full border-collapse table-auto text-xs">
          
          {/* Sticky Table Header */}
          <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-md z-30 border-b border-slate-200 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
            <tr>
              <th className="px-2 py-2 border-r w-8 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  aria-label="Select all tasks"
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="px-2 py-2 border-r w-8 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {/* Collapse / Expand icon */}
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-slate-500 border-r min-w-[280px]">
                Task Name
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-slate-500 border-r min-w-[140px]">
                Project
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-slate-500 border-r min-w-[130px]">
                Key Step
              </th>
              <th className="px-3 py-2 text-center text-[10px] font-bold uppercase text-slate-500 border-r min-w-[90px]">
                Period
              </th>
              <th className="px-3 py-2 text-center text-[10px] font-bold uppercase text-slate-500 border-r min-w-[110px]">
                Frequency
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-slate-500 border-r min-w-[130px]">
                Assignees
              </th>
              <th className="px-2 py-2 text-center text-[10px] font-bold uppercase text-slate-500 border-r min-w-[95px]">
                Start Date
              </th>
              <th className="px-2 py-2 text-center text-[10px] font-bold uppercase text-slate-500 border-r min-w-[95px]">
                End Date
              </th>
              <th className="px-3 py-2 text-center text-[10px] font-bold uppercase text-slate-500 border-r min-w-[90px]">
                Priority
              </th>
              <th className="px-3 py-2 text-center text-[10px] font-bold uppercase text-slate-500 border-r min-w-[110px]">
                Status
              </th>
              <th className="px-3 py-2 text-center text-[10px] font-bold uppercase text-slate-500 border-r min-w-[120px]">
                Progress
              </th>
              <th className="px-2 py-2 text-center text-[10px] font-bold uppercase text-slate-500 min-w-[100px]">
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {/* 1. FAST INLINE QUICK TASK CREATION ROW */}
            <tr className="bg-blue-50/20 border-b border-dashed border-slate-200 hover:bg-blue-50/40 transition-colors">
              <td className="px-2 py-1.5 text-center border-r">
                <Plus className="h-3.5 w-3.5 text-blue-500 mx-auto" />
              </td>
              <td className="px-2 py-1.5 border-r" />
              <td className="px-3 py-1.5 border-r">
                <Input
                  placeholder="+ Quick add a task here... Press Enter"
                  className="h-7 text-xs bg-white border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-full font-medium"
                  value={newQuickTaskName}
                  onChange={(e) => setNewQuickTaskName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      submitQuickTaskAtTop();
                    }
                  }}
                />
              </td>
              <td className="px-2 py-1.5 border-r">
                <Select
                  value={newQuickTaskProjectId}
                  onValueChange={setNewQuickTaskProjectId}
                >
                  <SelectTrigger className="h-7 text-xs bg-white border-slate-200 hover:bg-slate-50 w-full">
                    <SelectValue placeholder="Select project..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)} className="text-xs">
                        {p.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </td>
              <td className="px-2 py-1.5 border-r text-center text-slate-400">—</td>
              <td className="px-2 py-1.5 border-r text-center text-slate-400">—</td>
              <td className="px-2 py-1.5 border-r text-center text-slate-400">—</td>
              <td className="px-2 py-1.5 border-r text-center text-slate-400">—</td>
              <td className="px-2 py-1.5 border-r text-center text-slate-400">—</td>
              <td className="px-2 py-1.5 border-r text-center text-slate-400">—</td>
              <td className="px-2 py-1.5 border-r text-center text-slate-400">—</td>
              <td className="px-2 py-1.5 border-r text-center text-slate-400">—</td>
              <td className="px-2 py-1.5 border-r text-center text-slate-400">—</td>
              <td className="px-2 py-1.5 text-center">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={submitQuickTaskAtTop}
                  className="h-6 px-2 text-[10px] text-blue-600 hover:bg-blue-50 font-bold"
                >
                  Create
                </Button>
              </td>
            </tr>

            {/* 2. TASK LIST AND SUBTASK HIERARCHY */}
            {!hasRequiredFilter ? (
              <tr>
                <td colSpan={14}>
                  <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                    <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-100 text-slate-400">
                      <Search size={24} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-700">Select a Department or Project to view tasks</p>
                      <p className="text-xs text-slate-400">Narrow down tasks using the filters above.</p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={14} className="p-12 text-center text-slate-505 italic">
                  No tasks found for the selected filters
                </td>
              </tr>
            ) : (
              Object.entries(groupedTasks).map(([groupName, tasksInGroup]) => (
                <Fragment key={groupName}>
                  {/* Category Headers (if grouped) */}
                  {((groupBy !== "none" && groupBy !== "") || assigneeFilter !== "all") && groupName && (
                    <tr className={groupName.startsWith("Assigned") ? "bg-blue-50/30 border-y border-blue-100" : "bg-slate-100/60 border-y border-slate-200"}>
                      <td colSpan={14} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                        <div className="flex items-center gap-2">
                          <ChevronDown size={12} className="text-slate-400" />
                          <span>{groupName}</span>
                          <span className="font-normal text-slate-400 normal-case">({tasksInGroup.length} {tasksInGroup.length === 1 ? 'task' : 'tasks'})</span>
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Render Task Rows */}
                  {tasksInGroup.map((task: Task, taskIndex: number) => {
                    const isExpanded = expandedTasks.includes(task.id);
                    const totalSubtasksCount = Array.isArray(task.subtasks) ? task.subtasks.length : 0;
                    const isTaskCompleted = (task.status || "").toLowerCase() === "completed";
                    const taskProject = projects.find(p => String(p.id) === String(task.projectId));
                    const nowDate = new Date();
                    const today = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());
                    const taskEnd = task.endDate ? new Date(task.endDate) : null;
                    const isTaskOverdue = !!(taskEnd && taskEnd < today && !isTaskCompleted);

                    return (
                      <Fragment key={task.id}>
                        {/* Parent Task Row */}
                        <tr className={cn(
                          "border-b border-slate-150 hover:bg-slate-50/80 transition-colors h-9",
                          isTaskCompleted ? "opacity-75 bg-emerald-50/20" : "",
                          isTaskOverdue ? "bg-red-50/60 border-l-4 border-red-500" : ""
                        )}>
                          
                          {/* Selection Checkbox */}
                          <td className="px-2 py-1 text-center border-r">
                            <input
                              type="checkbox"
                              checked={selectedTaskIds.includes(task.id)}
                              onChange={() => toggleSelectTask(task.id)}
                              aria-label={`Select task ${task.taskName}`}
                              className="rounded border-slate-350 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                            />
                          </td>

                          {/* Expand chevron */}
                          <td className="px-2 py-1 text-center border-r">
                            <button
                              onClick={() => toggleExpand(task.id)}
                              className={cn(
                                "flex items-center justify-center mx-auto rounded p-0.5 transition-colors",
                                totalSubtasksCount > 0 ? "text-blue-600 hover:bg-blue-50" : "text-slate-300"
                              )}
                              title={totalSubtasksCount > 0 ? (isExpanded ? "Collapse subtasks" : "Expand subtasks") : "No subtasks"}
                            >
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                          </td>

                          {/* Task Name (Inline editable) */}
                          <td className="px-3 py-1 border-r font-medium text-slate-900 min-w-[280px]">
                            {editingTaskField?.taskId === task.id && editingTaskField?.field === "taskName" ? (
                              <Input
                                autoFocus
                                className="h-7 text-xs p-1 focus:ring-1 focus:ring-blue-500 w-full"
                                value={tempTaskValue}
                                onChange={(e) => setTempTaskValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleInlineTaskUpdate(task.id, "taskName", tempTaskValue);
                                  if (e.key === 'Escape') setEditingTaskField(null);
                                }}
                                onBlur={() => handleInlineTaskUpdate(task.id, "taskName", tempTaskValue)}
                              />
                            ) : (
                              <div className="flex items-center gap-1.5 justify-between group">
                                <span
                                  className={cn("cursor-pointer hover:underline truncate", isTaskOverdue ? "text-red-700 font-semibold" : "")}
                                  onClick={() => startEditingTask(task.id, "taskName", task.taskName)}
                                >
                                  {task.taskName}
                                </span>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {task.ticketId && (
                                    <Badge
                                      variant="secondary"
                                      className="cursor-pointer bg-emerald-50 text-emerald-750 border-emerald-200 text-[8px] px-1 py-0.5 uppercase"
                                      onClick={() => window.location.href = `/tickets?tab=manage`}
                                    >
                                      Ticket
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Project Column */}
                          <td className="px-3 py-1 border-r text-slate-700 font-semibold truncate max-w-[140px]">
                            {taskProject ? (
                              <span title={taskProject.title} className="text-slate-600 font-medium">
                                {taskProject.title}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">No Project</span>
                            )}
                          </td>

                          {/* Key Step Column */}
                          <td className="px-3 py-1 border-r min-w-[130px]">
                            <KeyStepBadge task={task} />
                          </td>

                          {/* Period Column */}
                          <td className="px-3 py-1 border-r text-center min-w-[90px]">
                            <PeriodBadge task={task} />
                          </td>

                          {/* Frequency Column */}
                          <td className="px-3 py-1 border-r text-center min-w-[110px]">
                            <FrequencyBadge task={task} />
                          </td>

                          {/* Assignees Column (overlapping circular badges) */}
                          <td className="px-3 py-1 border-r min-w-[130px]">
                            {(() => {
                              const members = Array.isArray(task.taskMembers) ? task.taskMembers : [];
                              return (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <div className="flex -space-x-1.5 overflow-hidden hover:space-x-1 transition-all duration-300 cursor-pointer p-0.5">
                                      {members.length === 0 ? (
                                        <span className="text-[10px] text-slate-350 italic">Unassigned</span>
                                      ) : (
                                        members.map((memberId: string, idx: number) => {
                                          const emp = allEmployees.find((e: any) => String(e.id) === String(memberId));
                                          const name = emp?.name || memberId;
                                          const initials = name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

                                          if (idx > 3) return null;
                                          if (idx === 3 && members.length > 4) {
                                            return (
                                              <div key="extra" className="relative inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-200 border border-white text-[8px] font-bold text-slate-655 z-0">
                                                +{members.length - 3}
                                              </div>
                                            );
                                          }

                                          return (
                                            <div
                                              key={memberId}
                                              className="relative inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-500 border border-white text-[8px] font-bold text-white shadow-sm ring-1 ring-slate-900/5 transition-transform hover:z-10 hover:scale-110"
                                              title={name}
                                            >
                                              {initials}
                                            </div>
                                          );
                                        })
                                      )}
                                    </div>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-64 p-0 shadow-xl border-slate-200" align="start">
                                    <Command>
                                      <CommandInput placeholder="Search member..." className="h-8 text-xs" />
                                      <CommandList className="max-h-[300px] overflow-y-auto">
                                        <CommandEmpty className="py-2 text-xs text-slate-400 text-center">No member found.</CommandEmpty>
                                        <CommandGroup heading="Assign Members">
                                          {allEmployees.map((emp) => {
                                            const isAssigned = members.some(mId => String(mId) === String(emp.id));
                                            return (
                                              <CommandItem
                                                key={emp.id}
                                                onSelect={() => handleMemberToggle(task.id, String(emp.id))}
                                                className="text-xs cursor-pointer"
                                              >
                                                <div className={cn(
                                                  "mr-2 flex h-3.5 w-3.5 items-center justify-center rounded-sm border border-primary",
                                                  isAssigned ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible"
                                                )}>
                                                  <Check className="h-2.5 w-2.5" />
                                                </div>
                                                <span className="flex-1 text-[11px]">{emp.name}</span>
                                                {emp.department && <span className="text-[9px] text-slate-400 bg-slate-100 px-1 rounded">{emp.department}</span>}
                                              </CommandItem>
                                            );
                                          })}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                              );
                            })()}
                          </td>

                          {/* Start Date Column */}
                          <td className="px-2 py-1 text-center border-r font-medium text-slate-700 min-w-[95px]">
                            {editingTaskField?.taskId === task.id && editingTaskField?.field === "startDate" ? (
                              <Input
                                type="date"
                                autoFocus
                                className="h-7 text-[10px] p-0.5"
                                value={tempTaskValue}
                                onChange={(e) => setTempTaskValue(e.target.value)}
                                onBlur={() => handleInlineTaskUpdate(task.id, "startDate", tempTaskValue)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleInlineTaskUpdate(task.id, "startDate", tempTaskValue);
                                  if (e.key === 'Escape') setEditingTaskField(null);
                                }}
                              />
                            ) : (
                              <span
                                className="cursor-pointer hover:bg-slate-100 p-0.5 rounded"
                                onClick={() => startEditingTask(task.id, "startDate", task.startDate || "")}
                              >
                                {formatDate(task.startDate) || "—"}
                              </span>
                            )}
                          </td>

                          {/* End Date Column */}
                          <td className="px-2 py-1 text-center border-r font-medium text-slate-700 min-w-[95px]">
                            {editingTaskField?.taskId === task.id && editingTaskField?.field === "endDate" ? (
                              <Input
                                type="date"
                                autoFocus
                                className="h-7 text-[10px] p-0.5"
                                value={tempTaskValue}
                                onChange={(e) => setTempTaskValue(e.target.value)}
                                onBlur={() => handleInlineTaskUpdate(task.id, "endDate", tempTaskValue)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleInlineTaskUpdate(task.id, "endDate", tempTaskValue);
                                  if (e.key === 'Escape') setEditingTaskField(null);
                                }}
                              />
                            ) : (
                              <span
                                className="cursor-pointer hover:bg-slate-100 p-0.5 rounded"
                                onClick={() => startEditingTask(task.id, "endDate", task.endDate || "")}
                              >
                                {formatDate(task.endDate) || "—"}
                              </span>
                            )}
                          </td>

                          {/* Priority Column */}
                          <td className="px-3 py-1 border-r text-center min-w-[90px]">
                            <PriorityBadge task={task} />
                          </td>

                          {/* Status Column */}
                          <td className="px-3 py-1 border-r text-center min-w-[110px]">
                            <StatusBadge task={task} />
                          </td>

                          {/* Progress Column */}
                          <td className="px-3 py-1 border-r text-center min-w-[120px]">
                            <div className="flex items-center gap-1.5 w-full">
                              <Progress value={task.progress || 0} className="h-1.5 flex-1 bg-slate-100" />
                              <span className="text-[10px] font-bold text-slate-600 shrink-0 w-8 text-right">{task.progress || 0}%</span>
                            </div>
                          </td>

                          {/* Actions Column */}
                          <td className="px-2 py-1 text-center">
                            <div className="flex items-center justify-center gap-0.5">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                onClick={() => navigate(`/add-task?id=${task.id}&projectId=${task.projectId}`)}
                                title="Edit Task"
                              >
                                <Edit size={12} />
                              </Button>

                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => {
                                  setCloneTaskData({ id: task.id, name: task.taskName });
                                  setCloneTaskNewName(`${task.taskName} (Copy)`);
                                  setCloneTaskOpen(true);
                                }}
                                title="Clone Task"
                              >
                                <Copy size={12} />
                              </Button>

                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                onClick={() => navigate("/discussion")}
                                title="Discuss Task"
                              >
                                <MessageSquare size={12} />
                              </Button>

                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-red-650 hover:text-red-750 hover:bg-red-50"
                                onClick={() => askDelete(task)}
                                title="Delete Task"
                              >
                                <Trash2 size={12} />
                              </Button>
                            </div>
                          </td>
                        </tr>

                        {/* Render Nested Expandable Subtask Rows */}
                        {isExpanded && (
                          <>
                            {Array.isArray(task.subtasks) && task.subtasks.map((subtask, subIndex) => {
                              const isSubtaskCompleted = !!subtask.isCompleted;
                              const members = Array.isArray(subtask.assignedTo) ? subtask.assignedTo : [];

                              return (
                                <tr
                                  key={subtask.id || subIndex}
                                  className={cn(
                                    "bg-slate-50/50 hover:bg-slate-100/60 border-b border-slate-100/80 transition-colors h-8 text-[11px]",
                                    isSubtaskCompleted ? "opacity-70 bg-green-50/10" : ""
                                  )}
                                >
                                  {/* Empty bullet */}
                                  <td className="px-2 py-0.5 text-center border-r text-slate-400">
                                    <span className="text-[9px] font-bold select-none">•</span>
                                  </td>

                                  {/* Subtask tree line symbol */}
                                  <td className="px-2 py-0.5 text-center border-r font-mono text-slate-400 select-none text-[10px]">
                                    └─
                                  </td>

                                  {/* Subtask Title & Completion Checkbox */}
                                  <td className="px-3 py-0.5 border-r font-medium min-w-[280px]">
                                    <div className="flex items-center gap-2 pl-4">
                                      <button
                                        onClick={() => toggleSubtaskCompletion(task.id, String(subtask.id), isSubtaskCompleted)}
                                        className="p-0 hover:scale-110 transition-transform flex-shrink-0"
                                        title={isSubtaskCompleted ? "Mark pending" : "Mark completed"}
                                      >
                                        {isSubtaskCompleted ? (
                                          <CheckCircle2 size={14} className="text-green-500" />
                                        ) : (
                                          <Circle size={14} className="text-slate-400 hover:text-blue-500" />
                                        )}
                                      </button>
                                      <span className={cn(
                                        "truncate",
                                        isSubtaskCompleted ? "line-through text-slate-400" : "text-slate-700"
                                      )}>
                                        {subtask.title}
                                      </span>
                                    </div>
                                  </td>

                                  {/* Inherited Project */}
                                  <td className="px-3 py-0.5 border-r text-slate-400 italic text-[10px] truncate max-w-[140px]">
                                    {taskProject?.title || "—"}
                                  </td>

                                  {/* Milestone / Key Step (dashed) */}
                                  <td className="px-3 py-0.5 border-r text-slate-400 text-center">—</td>

                                  {/* Period (dashed) */}
                                  <td className="px-3 py-0.5 border-r text-slate-400 text-center">—</td>

                                  {/* Frequency (dashed) */}
                                  <td className="px-3 py-0.5 border-r text-slate-400 text-center">—</td>

                                  {/* Subtask Assignees */}
                                  <td className="px-3 py-0.5 border-r min-w-[130px]">
                                    {(() => {
                                      return (
                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <div className="flex -space-x-1.5 overflow-hidden hover:space-x-1 transition-all duration-300 cursor-pointer p-0.5">
                                              {members.length === 0 ? (
                                                <div className="w-4.5 h-4.5 rounded-full border border-dashed border-slate-300 flex items-center justify-center text-slate-300 hover:border-blue-400 hover:text-blue-400 transition-colors">
                                                  <Plus size={8} />
                                                </div>
                                              ) : (
                                                members.map((memberId: string, idx: number) => {
                                                  const emp = allEmployees.find((e: any) => String(e.id) === String(memberId));
                                                  const name = emp?.name || memberId;
                                                  const initials = name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

                                                  if (idx > 2) return null;
                                                  if (idx === 2 && members.length > 3) {
                                                    return (
                                                      <div key="extra" className="relative inline-flex items-center justify-center w-4.5 h-4.5 rounded-full bg-slate-200 border border-white text-[7px] font-bold text-slate-655 z-0">
                                                        +{members.length - 2}
                                                      </div>
                                                    );
                                                  }

                                                  return (
                                                    <div
                                                      key={memberId}
                                                      className="relative inline-flex items-center justify-center w-4.5 h-4.5 rounded-full bg-slate-400 border border-white text-[7px] font-bold text-white shadow-sm ring-1 ring-slate-900/5 transition-transform hover:z-10 hover:scale-110"
                                                      title={name}
                                                    >
                                                      {initials}
                                                    </div>
                                                  );
                                                })
                                              )}
                                            </div>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-56 p-0 shadow-xl border-slate-200" align="start">
                                            <Command>
                                              <CommandInput placeholder="Search member..." className="h-8 text-xs" />
                                              <CommandList className="max-h-48 overflow-y-auto">
                                                <CommandEmpty className="py-2 text-[10px] text-slate-400 text-center">No member found.</CommandEmpty>
                                                <CommandGroup heading="Subtask Members">
                                                  {allEmployees.map((emp) => {
                                                    const isAssigned = members.some(mId => String(mId) === String(emp.id));
                                                    return (
                                                      <CommandItem
                                                        key={emp.id}
                                                        onSelect={async () => {
                                                          const newAssigned = isAssigned
                                                            ? members.filter(id => String(id) !== String(emp.id))
                                                            : [...members, String(emp.id)];

                                                          try {
                                                            await apiFetch(`/api/subtasks/${subtask.id}`, {
                                                              method: "PATCH",
                                                              headers: { "Content-Type": "application/json" },
                                                              body: JSON.stringify({ assignedTo: newAssigned[0] || null }),
                                                            });
                                                            refreshTasks();
                                                          } catch (err) {
                                                            console.error("Subtask member update failed:", err);
                                                          }
                                                        }}
                                                        className="text-xs cursor-pointer"
                                                      >
                                                        <div className={cn(
                                                          "mr-2 flex h-3 w-3 items-center justify-center rounded-sm border border-primary",
                                                          isAssigned ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible"
                                                        )}>
                                                          <Check className="h-2 w-2" />
                                                        </div>
                                                        <span className="flex-1 text-[11px]">{emp.name}</span>
                                                      </CommandItem>
                                                    );
                                                  })}
                                                </CommandGroup>
                                              </CommandList>
                                            </Command>
                                          </PopoverContent>
                                        </Popover>
                                      );
                                    })()}
                                  </td>

                                  {/* Subtask Start Date */}
                                  <td className="px-2 py-0.5 text-center border-r font-medium text-slate-600 min-w-[95px]">
                                    <Input
                                      type="date"
                                      className="h-6 text-[10px] p-0.5 w-full bg-transparent border-none text-slate-700 hover:bg-slate-100 focus:bg-white text-center"
                                      value={subtask.startDate || ""}
                                      onChange={async (e) => {
                                        try {
                                          await apiFetch(`/api/subtasks/${subtask.id}`, {
                                            method: "PATCH",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ startDate: e.target.value }),
                                          });
                                          refreshTasks();
                                        } catch (err) {
                                          console.error(err);
                                        }
                                      }}
                                    />
                                  </td>

                                  {/* Subtask End Date */}
                                  <td className="px-2 py-0.5 text-center border-r font-medium text-slate-600 min-w-[95px]">
                                    <Input
                                      type="date"
                                      className="h-6 text-[10px] p-0.5 w-full bg-transparent border-none text-slate-700 hover:bg-slate-100 focus:bg-white text-center"
                                      value={subtask.endDate || ""}
                                      onChange={async (e) => {
                                        try {
                                          await apiFetch(`/api/subtasks/${subtask.id}`, {
                                            method: "PATCH",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ endDate: e.target.value }),
                                          });
                                          refreshTasks();
                                        } catch (err) {
                                          console.error(err);
                                        }
                                      }}
                                    />
                                  </td>

                                  {/* Priority (dashed) */}
                                  <td className="px-3 py-0.5 border-r text-slate-400 text-center">—</td>

                                  {/* Subtask Status Badge */}
                                  <td className="px-3 py-0.5 border-r text-center min-w-[110px]">
                                    <button
                                      onClick={() => toggleSubtaskCompletion(task.id, String(subtask.id), isSubtaskCompleted)}
                                      className={cn(
                                        "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider whitespace-nowrap border cursor-pointer hover:opacity-80 transition-all",
                                        isSubtaskCompleted
                                          ? "bg-green-50 text-green-707 border-green-200"
                                          : "bg-slate-50 text-slate-606 border-slate-200"
                                      )}
                                    >
                                      {isSubtaskCompleted ? "✓ Completed" : "Pending"}
                                    </button>
                                  </td>

                                  {/* Subtask Progress bar */}
                                  <td className="px-3 py-0.5 border-r text-center min-w-[120px]">
                                    <div className="flex items-center gap-1 w-full justify-center">
                                      <Progress value={isSubtaskCompleted ? 100 : (subtask.progress || 0)} className="h-1 bg-slate-100 flex-1" />
                                      <span className="text-[9px] font-bold text-slate-500 w-6 shrink-0 text-right">
                                        {isSubtaskCompleted ? 100 : (subtask.progress || 0)}%
                                      </span>
                                    </div>
                                  </td>

                                  {/* Subtask actions (delete/clone) */}
                                  <td className="px-2 py-0.5 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-5 w-5 text-green-600 hover:text-green-755"
                                        onClick={() => {
                                          setCloneSubtaskData({ id: subtask.id!, title: subtask.title });
                                          setCloneSubtaskNewTitle(`${subtask.title} (Copy)`);
                                          setCloneSubtaskOpen(true);
                                        }}
                                        title="Clone Subtask"
                                      >
                                        <Copy size={10} />
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}

                            {/* 3. INLINE FAST SUBTASK CREATION ROW (shown for expanded task) */}
                            <tr className="bg-blue-50/10 border-b border-slate-100 text-[11px] h-8">
                              <td className="px-2 py-0.5 text-center border-r" />
                              <td className="px-2 py-0.5 text-center border-r font-mono text-slate-400 select-none text-[10px]">
                                └─+
                              </td>
                              <td className="px-3 py-0.5 border-r" colSpan={11}>
                                <div className="flex items-center pl-4 w-full">
                                  <Input
                                    placeholder="Add subtask title... Press Enter to create"
                                    className="h-6 text-xs bg-slate-55/50 border-dashed border-slate-200 focus:bg-white focus:border-blue-500 w-full max-w-[500px]"
                                    value={subtaskForms[task.id]?.title || ""}
                                    onChange={(e) => updateSubtaskForm(task.id, "title", e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        addInlineSubtask(task.id);
                                      }
                                    }}
                                  />
                                </div>
                              </td>
                              <td className="px-2 py-0.5 text-center">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => addInlineSubtask(task.id)}
                                  className="h-5 px-1.5 text-[9px] text-blue-600 hover:bg-blue-50 font-bold"
                                >
                                  Add
                                </Button>
                              </td>
                            </tr>
                          </>
                        )}
                      </Fragment>
                    );
                  })}
                </Fragment>
              ))
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
            <DialogDescription>Add a new task quickly to your project.</DialogDescription>
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

      {/* QUICK ADD SUBTASK DIALOG */}
      <Dialog open={quickAddSubtaskOpen} onOpenChange={setQuickAddSubtaskOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quick Add Subtask</DialogTitle>
            <DialogDescription>Add a subtask to an existing task.</DialogDescription>
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
            <DialogDescription>Create a copy of this task with the same configuration.</DialogDescription>
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
