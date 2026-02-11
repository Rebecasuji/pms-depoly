import { useState, useEffect, Fragment } from "react";
import { useAuth } from "@/components/Layout";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Calendar,
  Edit,
  CheckCircle2,
  Circle,
  Search,
  Copy,
  X,
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
  // Multi-select state for tasks
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [keySteps, setKeySteps] = useState<any[]>([]);
  const [selectedKeyStepId, setSelectedKeyStepId] = useState<string>("");
  const [expandedTasks, setExpandedTasks] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Bulk assign state
  const [bulkAssignPerson, setBulkAssignPerson] = useState("");
  const [bulkAssignDepartment, setBulkAssignDepartment] = useState("");
  const [departments, setDepartments] = useState<string[]>(["HR", "Operations", "Software Developers", "Finance", "Purchase", "Presales", "IT Support"]);

  // Handler for bulk assignment
  const handleBulkAssign = async () => {
    // TODO: Implement API call to assign selected tasks to person or department
    // Example: await apiFetch('/api/tasks/bulk-assign', { method: 'POST', body: JSON.stringify({ taskIds: selectedTaskIds, personId: bulkAssignPerson, department: bulkAssignDepartment }) })
    alert(`Assigning ${selectedTaskIds.length} tasks to ${bulkAssignPerson || bulkAssignDepartment}`);
    // After API: refresh tasks, clear selection, reset dropdowns
    setBulkAssignPerson("");
    setBulkAssignDepartment("");
    setSelectedTaskIds([]);
  };

  // filteredTasks: Apply search and optional keystep filter
  // Show all tasks when no project is selected
  const filteredTasks = tasks.filter(t => {
    const matchesSearch = (t.taskName || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesKey = selectedKeyStepId ? String(t.keyStepId) === String(selectedKeyStepId) : true;
    return matchesSearch && matchesKey;
  });

  // Select all tasks in current filtered view
  const allSelected = filteredTasks.length > 0 && filteredTasks.every(t => selectedTaskIds.includes(t.id));
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(filteredTasks.map(t => t.id));
    }
  };
  const toggleSelectTask = (id: string) => {
    setSelectedTaskIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const [projectId, setProjectId] = useState("");

  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  // Quick Add Task
  const [quickAddTaskOpen, setQuickAddTaskOpen] = useState(false);
  const [quickTaskName, setQuickTaskName] = useState("");

  // Quick Add Subtask
  const [quickAddSubtaskOpen, setQuickAddSubtaskOpen] = useState(false);
  const [quickSubtaskTaskId, setQuickSubtaskTaskId] = useState("");
  const [quickSubtaskTitle, setQuickSubtaskTitle] = useState("");

  // Clone modals
  const [cloneTaskOpen, setCloneTaskOpen] = useState(false);
  const [cloneTaskData, setCloneTaskData] = useState<{ id: string; name: string } | null>(null);
  const [cloneTaskNewName, setCloneTaskNewName] = useState("");

  const [cloneSubtaskOpen, setCloneSubtaskOpen] = useState(false);
  const [cloneSubtaskData, setCloneSubtaskData] = useState<{ id: string; title: string } | null>(null);
  const [cloneSubtaskNewTitle, setCloneSubtaskNewTitle] = useState("");

  /* ================= LOAD INITIAL DATA ================= */

  useEffect(() => {
    apiFetch("/api/employees")
      .then(r => r.json())
      .then(data => setEmployees(Array.isArray(data) ? data : []))
      .catch(() => setEmployees([]));

    apiFetch("/api/projects")
      .then(r => r.json())
      .then(data => {
        const arr = Array.isArray(data) ? data : [];
        setProjects(arr);
        // Don't auto-select previous project - start with empty selection
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
    if (!projectId) {
      // Load all user's tasks when no project is selected
      apiFetch("/api/tasks/bulk")
        .then(r => r.json())
        .then(data => setTasks(Array.isArray(data) ? data : []))
        .catch(() => setTasks([]));
      
      // Clear keysteps and reset keystep filter
      setKeySteps([]);
      setSelectedKeyStepId("");
      return;
    }

    // Load project-specific tasks
    apiFetch(`/api/tasks/${projectId}`)
      .then(r => r.json())
      .then(data => setTasks(Array.isArray(data) ? data : []))
      .catch(() => setTasks([]));

    // Load Key Steps for project
    apiFetch(`/api/projects/${projectId}/key-steps`)
      .then(r => r.json())
      .then(data => setKeySteps(Array.isArray(data) ? data : []))
      .catch(() => setKeySteps([]));
  }, [projectId]);

  /* ================= HELPERS ================= */

  const openAdd = () => {
    navigate(`/add-task?projectId=${projectId}`);
  };

  const openEdit = (task: Task) => {
    navigate(`/add-task?id=${task.id}&projectId=${task.projectId}`);
  };

  const toggleExpand = (id: string) => {
    setExpandedTasks(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-100 text-red-700 border-red-200";
      case "medium": return "bg-amber-100 text-amber-700 border-amber-200";
      default: return "bg-emerald-100 text-emerald-700 border-emerald-200";
    }
  };

  /* ================= API ACTIONS ================= */

  const confirmDelete = async () => {
    if (!taskToDelete) return;
    try {
      await apiFetch(`/api/tasks/${taskToDelete.id}`, { method: "DELETE" });
      const updated = await apiFetch(`/api/tasks/${projectId}`).then(r => r.json());
      setTasks(Array.isArray(updated) ? updated : []);
      setOpenDeleteDialog(false);
      setTaskToDelete(null);
    } catch (err) {
      alert("Delete failed");
    }
  };

  const askDelete = (task: Task) => {
    setTaskToDelete(task);
    setOpenDeleteDialog(true);
  };

  /* ================= QUICK ADD HANDLERS ================= */

  const handleQuickAddTask = async () => {
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
          assignerId: null,
        }),
      });

      // Refresh tasks
      const updated = await apiFetch(`/api/tasks/${projectId}`).then(r => r.json());
      setTasks(Array.isArray(updated) ? updated : []);
      setQuickTaskName("");
      setQuickAddTaskOpen(false);
    } catch (err) {
      alert("Failed to create task");
    }
  };

  const handleQuickAddSubtask = async () => {
    if (!quickSubtaskTitle.trim()) {
      alert("Please enter a subtask title");
      return;
    }

    try {
      await apiFetch("/api/subtasks", {
        method: "POST",
        body: JSON.stringify({
          taskId: quickSubtaskTaskId,
          title: quickSubtaskTitle.trim(),
          description: "",
          isCompleted: false,
        }),
      });

      // Refresh tasks
      const updated = await apiFetch(`/api/tasks/${projectId}`).then(r => r.json());
      setTasks(Array.isArray(updated) ? updated : []);
      setQuickSubtaskTitle("");
      setQuickAddSubtaskOpen(false);
    } catch (err) {
      alert("Failed to create subtask");
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

      // Refresh tasks
      const updated = await apiFetch(`/api/tasks/${projectId}`).then(r => r.json());
      setTasks(Array.isArray(updated) ? updated : []);
      setCloneTaskNewName("");
      setCloneTaskOpen(false);
      setCloneTaskData(null);
      alert("Task cloned successfully!");
    } catch (err) {
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

      // Refresh tasks
      const updated = await apiFetch(`/api/tasks/${projectId}`).then(r => r.json());
      setTasks(Array.isArray(updated) ? updated : []);
      setCloneSubtaskNewTitle("");
      setCloneSubtaskOpen(false);
      setCloneSubtaskData(null);
      alert("Subtask cloned successfully!");
    } catch (err) {
      alert("Failed to clone subtask");
    }
  };

  /* ================= SUBTASK HANDLERS ================= */



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

        <div className="flex gap-4">
          <div className="flex items-center">
            <span className="text-sm font-semibold mr-3">Project</span>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="w-56 bg-white">
                <SelectValue placeholder="Select Project" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px] overflow-y-auto">
                {projects.length > 0 ? (
                  projects.map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>
                  ))
                ) : (
                  <div className="p-2 text-xs text-muted-foreground">No projects available</div>
                )}
              </SelectContent>
            </Select>
          </div>

          {projectId && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold mr-3">Key Step</span>
              <Select
                value={selectedKeyStepId}
                onValueChange={val => {
                  setSelectedKeyStepId(val);
                  // Only filter tasks, do not navigate
                }}
              >
                <SelectTrigger className="w-56 bg-white">
                  <SelectValue placeholder="Filter by key step..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto">
                  {keySteps.length > 0 ? (
                    keySteps.map(ks => (
                      <SelectItem key={ks.id} value={String(ks.id)}>{ks.title}</SelectItem>
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

          <div className="flex items-center">
            <span className="text-sm font-semibold mr-3">Tasks</span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                className="pl-9 w-56 bg-white"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
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
          {/* Assign to Person */}
          <Select
            value={bulkAssignPerson}
            onValueChange={setBulkAssignPerson}
          >
            <SelectTrigger className="w-48 bg-white">
              <SelectValue placeholder="Select Person" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px] overflow-y-auto">
              {employees.map(e => (
                <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Assign to Department */}
          <Select
            value={bulkAssignDepartment}
            onValueChange={setBulkAssignDepartment}
          >
            <SelectTrigger className="w-48 bg-white">
              <SelectValue placeholder="Select Department" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px] overflow-y-auto">
              {departments.map(d => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={handleBulkAssign}
            disabled={!bulkAssignPerson && !bulkAssignDepartment}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            Assign Selected Tasks
          </Button>
        </div>
      )}

      {/* MAIN TABLE */}
      <div className="bg-white border rounded-xl overflow-x-auto">
        <table className="w-full border-collapse table-fixed">
          <colgroup>
            <col style={{ width: '3%' }} />
            <col style={{ width: '4%' }} />
            <col style={{ width: '22%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '8%' }} />
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
              <th className="px-2 py-3 text-center text-xs font-bold uppercase text-slate-600 border-r"></th>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase text-slate-600 border-r">Task Name</th>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase text-slate-600 border-r">Assignees</th>
              <th className="px-3 py-3 text-center text-xs font-bold uppercase text-slate-600 border-r">Start Date</th>
              <th className="px-3 py-3 text-center text-xs font-bold uppercase text-slate-600 border-r">End Date</th>
              <th className="px-3 py-3 text-center text-xs font-bold uppercase text-slate-600 border-r">Status</th>
              <th className="px-3 py-3 text-center text-xs font-bold uppercase text-slate-600 border-r">Priority</th>
              <th className="px-3 py-3 text-center text-xs font-bold uppercase text-slate-600 border-r">Subtasks</th>
              <th className="px-2 py-3 text-center text-xs font-bold uppercase text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-12 text-center text-slate-500">No tasks found</td>
              </tr>
            ) : (
              filteredTasks.map(task => (
                <Fragment key={task.id}>
                  {/* MAIN TASK ROW */}
                  <tr className="border-b hover:bg-slate-50 transition-colors">
                    <td className="px-2 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedTaskIds.includes(task.id)}
                        onChange={() => toggleSelectTask(task.id)}
                        aria-label={`Select task ${task.taskName}`}
                      />
                    </td>
                    <td className="px-2 py-3 text-center border-r">
                      <button
                        onClick={() => toggleExpand(task.id)}
                        className="text-slate-500 hover:text-slate-700 flex justify-center"
                      >
                        {expandedTasks.includes(task.id) ? (
                          <ChevronDown size={18} />
                        ) : (
                          <ChevronRight size={18} />
                        )}
                      </button>
                    </td>
                    <td className="px-3 py-3 align-top border-r">
                      <span
                        className={`text-sm font-medium block ${
                          task.status === "Completed"
                            ? "line-through opacity-50 text-slate-400"
                            : "text-slate-900"
                        }`}
                      >
                        {task.taskName}
                      </span>
                      {task.description && (
                        <div className="text-xs text-slate-500 mt-1 truncate">
                          {task.description}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top border-r">
                      <div className="flex gap-1 flex-wrap items-center">
                        {(task.taskMembers || []).length > 0 ? (
                          (task.taskMembers || []).map(id => (
                            <Badge
                              key={id}
                              variant="secondary"
                              className="text-xs whitespace-nowrap"
                            >
                              {employees.find(e => e.id === id)?.name || id}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400">Unassigned</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center text-sm text-slate-600 border-r">
                      {task.startDate ? new Date(task.startDate).toLocaleDateString() : "N/A"}
                    </td>
                    <td className="px-3 py-3 text-center text-sm text-slate-600 border-r">
                      {task.endDate ? new Date(task.endDate).toLocaleDateString() : "N/A"}
                    </td>
                    <td className="px-3 py-3 text-center border-r">
                      <Badge
                        variant={
                          task.status === "Completed" ? "default" : "outline"
                        }
                        className="text-xs whitespace-nowrap inline-flex justify-center"
                      >
                        {task.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-center border-r">
                      <Badge
                        variant="outline"
                        className={`text-xs whitespace-nowrap inline-flex justify-center ${
                          task.priority === "high"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : task.priority === "medium"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-green-50 text-green-700 border-green-200"
                        }`}
                      >
                        {task.priority || "—"}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-center border-r">
                      <Badge variant="secondary" className="text-xs inline-flex justify-center w-full">
                        {task.subtasks?.length || 0}
                      </Badge>
                    </td>
                    <td className="px-2 py-3 text-center">
                      <div className="flex gap-1 justify-center items-center">
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

                  {/* EXPANDED SUBTASKS ROW */}
                  {expandedTasks.includes(task.id) && (
                    <tr className="bg-slate-50 border-b">
                      <td colSpan={9} className="px-4 py-4">
                        <div className="space-y-4">
                          {/* Description */}
                          {task.description && (
                            <div>
                              <h4 className="text-xs font-semibold text-slate-700 uppercase mb-2">
                                Description
                              </h4>
                              <p className="text-sm text-slate-600 bg-white p-3 rounded border">
                                {task.description}
                              </p>
                            </div>
                          )}

                          {/* Subtasks */}
                          {task.subtasks && task.subtasks.length > 0 && (
                            <div>
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-xs font-semibold text-slate-700 uppercase">
                                  Subtasks ({task.subtasks.length})
                                </h4>
                                <button
                                  onClick={() => {
                                    setQuickSubtaskTaskId(task.id);
                                    setQuickSubtaskTitle("");
                                    setQuickAddSubtaskOpen(true);
                                  }}
                                  className="inline-flex items-center text-xs text-amber-600 hover:text-amber-700 gap-1"
                                >
                                  <Plus size={12} /> Quick Add
                                </button>
                              </div>
                              <div className="space-y-2">
                                {task.subtasks.map((subtask, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-start gap-3 p-3 bg-white rounded border border-slate-200 hover:border-slate-300 transition-colors"
                                  >
                                    <div className="pt-0.5">
                                      {subtask.isCompleted ? (
                                        <CheckCircle2
                                          size={16}
                                          className="text-green-500"
                                        />
                                      ) : (
                                        <Circle
                                          size={16}
                                          className="text-slate-300"
                                        />
                                      )}
                                    </div>
                                    <div className="flex-1">
                                      <span
                                        className={`text-sm ${
                                          subtask.isCompleted
                                            ? "line-through text-slate-400"
                                            : "text-slate-900"
                                        }`}
                                      >
                                        {subtask.title}
                                      </span>
                                      {subtask.description && (
                                        <div className="text-xs text-slate-500 mt-1">
                                          {subtask.description}
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex gap-1">
                                      {subtask.assignedTo &&
                                        subtask.assignedTo.length > 0 && (
                                          <div className="flex gap-1 flex-wrap justify-end">
                                            {subtask.assignedTo.map(id => (
                                              <Badge
                                                key={id}
                                                variant="outline"
                                                className="text-xs whitespace-nowrap"
                                              >
                                                {employees.find(
                                                  e => e.id === id
                                                )?.name ||
                                                  id.slice(0, 3)}
                                              </Badge>
                                            ))}
                                          </div>
                                        )}
                                      <button
                                        onClick={() => {
                                          setCloneSubtaskData({ id: subtask.id || "", title: subtask.title });
                                          setCloneSubtaskNewTitle(`${subtask.title} (Copy)`);
                                          setCloneSubtaskOpen(true);
                                        }}
                                        className="inline-flex items-center text-green-600 hover:text-green-700 ml-2"
                                        title="Clone Subtask"
                                      >
                                        <Copy size={14} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {!task.subtasks ||
                            (task.subtasks.length === 0 && (
                              <p className="text-sm text-slate-500">
                                No subtasks
                              </p>
                            ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* DELETE DIALOG */}
      <Dialog open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Task</DialogTitle></DialogHeader>
          <p className="text-sm">Delete <span className="font-bold">{taskToDelete?.taskName}</span>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDeleteDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QUICK ADD TASK DIALOG */}
      <Dialog open={quickAddTaskOpen} onOpenChange={setQuickAddTaskOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Quick Add Task</DialogTitle></DialogHeader>
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
            <p className="text-xs text-slate-500">Description can be added later by editing the task.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickAddTaskOpen(false)}>Cancel</Button>
            <Button onClick={handleQuickAddTask}>Create Task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QUICK ADD SUBTASK DIALOG */}
      <Dialog open={quickAddSubtaskOpen} onOpenChange={setQuickAddSubtaskOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Quick Add Subtask</DialogTitle></DialogHeader>
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
            <p className="text-xs text-slate-500">Description can be added later by editing the subtask.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickAddSubtaskOpen(false)}>Cancel</Button>
            <Button onClick={handleQuickAddSubtask}>Create Subtask</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CLONE TASK DIALOG */}
      <Dialog open={cloneTaskOpen} onOpenChange={setCloneTaskOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Clone Task</DialogTitle></DialogHeader>
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
            <p className="text-xs text-slate-500">All subtasks and team members will be cloned.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloneTaskOpen(false)}>Cancel</Button>
            <Button onClick={handleCloneTask}>Clone Task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CLONE SUBTASK DIALOG */}
      <Dialog open={cloneSubtaskOpen} onOpenChange={setCloneSubtaskOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Clone Subtask</DialogTitle></DialogHeader>
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
            <Button variant="outline" onClick={() => setCloneSubtaskOpen(false)}>Cancel</Button>
            <Button onClick={handleCloneSubtask}>Clone Subtask</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
