import { useState, useEffect } from "react";
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
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);

  const [expandedTasks, setExpandedTasks] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [projectId, setProjectId] = useState("");

  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  /* ================= LOAD INITIAL DATA ================= */

  useEffect(() => {
    fetch("/api/employees")
      .then(r => r.json())
      .then(data => setEmployees(Array.isArray(data) ? data : []))
      .catch(() => setEmployees([]));

    fetch("/api/projects", { headers: { Authorization: `Bearer ${localStorage.getItem("knockturn_token")}` } })
      .then(r => r.json())
      .then(data => {
        const arr = Array.isArray(data) ? data : [];
        setProjects(arr);
        if (arr.length > 0 && !projectId) {
          setProjectId(arr[0].id);
        }
      })
      .catch(() => setProjects([]));
  }, []);

  /* ================= LOAD PROJECT-SPECIFIC DATA ================= */

  useEffect(() => {
    if (!projectId) return;

    // Load Tasks
    fetch(`/api/tasks/${projectId}`)
      .then(r => r.json())
      .then(data => setTasks(Array.isArray(data) ? data : []))
      .catch(() => setTasks([]));

    const loadMilestones = async () => {
      if (!projectId) return;
      try {
        const data = await fetch(`/api/projects/${projectId}/key-steps`).then(r => r.json());
        setMilestones(Array.isArray(data) ? data : []);
      } catch {
        setMilestones([]);
      }
    };

    // Load Milestones (Key Steps)
    fetch(`/api/projects/${projectId}/key-steps`)
      .then(r => r.json())
      .then(data => setMilestones(Array.isArray(data) ? data : []))
      .catch(() => setMilestones([]));
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
      await fetch(`/api/tasks/${taskToDelete.id}`, { method: "DELETE" });
      const updated = await fetch(`/api/tasks/${projectId}`).then(r => r.json());
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

  /* ================= SUBTASK HANDLERS ================= */

  const filteredTasks = tasks.filter(t =>
    (t.taskName || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 p-6 bg-slate-50 min-h-screen">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Tasks</h1>
          <p className="text-sm text-muted-foreground">Manage project tasks</p>
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
        </div>
      </div>

      {/* MAIN TABLE */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 bg-slate-100 border-b text-[10px] font-bold p-4 uppercase text-slate-500">
          <div className="col-span-3">Task</div>
          <div className="col-span-2">Project</div>
          <div className="col-span-2">Milestone</div>
          <div className="col-span-1 text-center">Assigner</div>
          <div className="col-span-2 text-center">Due</div>
          <div className="col-span-1 text-center">Status</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>

        {filteredTasks.length === 0 && (
          <div className="p-12 text-center text-slate-500">No tasks found</div>
        )}

        {filteredTasks.map(task => (
          <div key={task.id} className="border-b hover:bg-slate-50">
            <div className="grid grid-cols-12 items-center p-4 text-xs">
              <div className="col-span-3 flex items-center gap-2">
                <button onClick={() => toggleExpand(task.id)}>
                  {expandedTasks.includes(task.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                <span className={task.status === "Completed" ? "line-through opacity-50" : ""}>
                  {task.taskName}
                </span>
              </div>
              <div className="col-span-2 text-slate-500">
                {projects.find(p => p.id === task.projectId)?.title || "Unknown"}
              </div>
              <div className="col-span-2 text-slate-500 italic">
                {task.keyStepId && task.keyStepId !== "none"
                  ? milestones.find(m => m.id === task.keyStepId)?.title || "Linked"
                  : "—"}
              </div>
              <div className="col-span-1 text-center">
                {employees.find(e => e.id === task.assignerId)?.name || "—"}
              </div>
              <div className="col-span-2 text-center text-slate-500 flex justify-center gap-1">
                <Calendar size={14} /> {task.endDate || "N/A"}
              </div>
              <div className="col-span-1 text-center">
                <Badge variant={task.status === "Completed" ? "default" : "outline"}>
                  {task.status}
                </Badge>
              </div>
              <div className="col-span-1 text-right flex justify-end gap-1">
                <Button size="icon" variant="ghost" onClick={() => openEdit(task)}><Edit size={14} /></Button>
                <Button size="icon" variant="ghost" className="text-red-500" onClick={() => askDelete(task)}><Trash2 size={14} /></Button>
              </div>
            </div>

            {/* EXPANDED VIEW */}
            {expandedTasks.includes(task.id) && (
              <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-slate-700">Description</h4>
                  <p className="text-xs text-slate-600">{task.description || "No description"}</p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">Subtasks</h4>
                  {task.subtasks?.map((s, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 text-xs p-2 border-b">
                      <div className="col-span-1 text-center">
                        {s.isCompleted ? <CheckCircle2 size={14} className="text-green-500 mx-auto" /> : <Circle size={14} className="mx-auto" />}
                      </div>
                      <div className="col-span-7">{s.title}</div>
                      <div className="col-span-4 flex gap-1 flex-wrap">
                        {s.assignedTo?.map(id => (
                          <Badge key={id} variant="outline" className="text-[10px]">
                            {employees.find(e => e.id === id)?.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
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
    </div>
  );
}