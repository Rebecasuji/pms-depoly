import { useState, useEffect } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  assignedTo?: string;
}

interface Task {
  id: string;
  projectId: string;
  taskName: string;
  description?: string;
  status: "pending" | "in-progress" | "completed";
  priority: "low" | "medium" | "high";
  startDate?: string;
  endDate?: string;
  assignerId: string;
  taskMembers?: string[];
  subtasks?: Subtask[];
}

/* ================= COMPONENT ================= */

export default function Tasks() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [openDialog, setOpenDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const [subtasks, setSubtasks] = useState<Subtask[]>([]);

  const [form, setForm] = useState({
    projectId: "",
    taskName: "",
    description: "",
    startDate: "",
    endDate: "",
    status: "pending" as "pending" | "in-progress" | "completed",
    priority: "medium" as "low" | "medium" | "high",
    assignerId: "",
    taskMembers: [] as string[],
  });

  /* ================= LOAD EMPLOYEES & PROJECTS ================= */

  useEffect(() => {
    fetch("/api/employees").then(r => r.json()).then(setEmployees);
    fetch("/api/projects")
      .then(r => r.json())
      .then(data => {
        setProjects(data);
        if (data.length > 0) {
          setForm(f => ({ ...f, projectId: data[0].id }));
        }
      });
  }, []);

  /* ================= LOAD TASKS ================= */

  useEffect(() => {
    if (!form.projectId) return;
    fetch(`/api/tasks/${form.projectId}`)
      .then(r => r.json())
      .then(setTasks);
  }, [form.projectId]);

  /* ================= HELPERS ================= */

  const resetForm = () => {
    setForm({
      projectId: form.projectId,
      taskName: "",
      description: "",
      startDate: "",
      endDate: "",
      status: "pending",
      priority: "medium",
      assignerId: "",
      taskMembers: [],
    });
    setSubtasks([]);
  };

  const openAdd = () => {
    setEditingTask(null);
    resetForm();
    setOpenDialog(true);
  };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    setForm({
      projectId: task.projectId,
      taskName: task.taskName,
      description: task.description || "",
      startDate: task.startDate || "",
      endDate: task.endDate || "",
      status: task.status,
      priority: task.priority,
      assignerId: task.assignerId,
      taskMembers: task.taskMembers || [],
    });
    setSubtasks(task.subtasks || []);
    setOpenDialog(true);
  };

  const toggleExpand = (id: string) => {
    setExpandedTasks(p =>
      p.includes(id) ? p.filter(x => x !== id) : [...p, id]
    );
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-100 text-red-700 border-red-200";
      case "medium": return "bg-amber-100 text-amber-700 border-amber-200";
      default: return "bg-emerald-100 text-emerald-700 border-emerald-200";
    }
  };

  /* ================= SAVE (ADD / EDIT) ================= */

  const handleSave = async () => {
    if (!form.taskName || !form.projectId || !form.assignerId) {
      alert("Task Name, Project, and Assigner required");
      return;
    }

    const payload = { ...form, subtasks };

    try {
      if (editingTask) {
        await fetch(`/api/tasks/${editingTask.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const updated = await fetch(`/api/tasks/${form.projectId}`).then(r => r.json());
      setTasks(updated);

      setOpenDialog(false);
      setEditingTask(null);
      resetForm();
    } catch (err) {
      alert("Save failed");
    }
  };

  /* ================= DELETE ================= */

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this task?")) return;

    try {
      await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      const updated = await fetch(`/api/tasks/${form.projectId}`).then(r => r.json());
      setTasks(updated);
    } catch (err) {
      alert("Delete failed");
    }
  };

  /* ================= UI ================= */

  const filteredTasks = tasks.filter(t =>
    t.taskName.toLowerCase().includes(searchQuery.toLowerCase())
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

          {/* PROJECT */}
          <Select value={form.projectId} onValueChange={v => setForm(f => ({ ...f, projectId: v }))}>
            <SelectTrigger className="w-56 bg-white">
              <SelectValue placeholder="Select Project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* SEARCH */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              className="pl-9 w-56 bg-white"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <Button onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1" /> Add Task
          </Button>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white border rounded-xl overflow-hidden">

        <div className="grid grid-cols-12 bg-slate-100 border-b text-[10px] font-bold p-4 uppercase text-slate-500">
          <div className="col-span-3">Task</div>
          <div className="col-span-2">Project</div>
          <div className="col-span-1 text-center">Assigner</div>
          <div className="col-span-2 text-center">Due</div>
          <div className="col-span-2 text-center">Priority</div>
          <div className="col-span-1 text-center">Status</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>

        {filteredTasks.length === 0 && (
          <div className="p-12 text-center text-slate-500">
            No tasks found
          </div>
        )}

        {filteredTasks.map(task => (
          <div key={task.id} className="border-b hover:bg-slate-50">

            <div className="grid grid-cols-12 items-center p-4 text-xs">

              <div className="col-span-3 flex items-center gap-2">
                <button onClick={() => toggleExpand(task.id)}>
                  {expandedTasks.includes(task.id)
                    ? <ChevronDown size={16} />
                    : <ChevronRight size={16} />}
                </button>
                <span className={task.status === "completed" ? "line-through opacity-50" : ""}>
                  {task.taskName}
                </span>
              </div>

              <div className="col-span-2 text-slate-500">
                {projects.find(p => p.id === task.projectId)?.title}
              </div>

              <div className="col-span-1 text-center">
                {employees.find(e => e.id === task.assignerId)?.name || "—"}
              </div>

              <div className="col-span-2 text-center text-slate-500 flex justify-center gap-1">
                <Calendar size={14} /> {task.endDate || "N/A"}
              </div>

              <div className="col-span-2 text-center">
                <Badge variant="outline" className={getPriorityColor(task.priority)}>
                  {task.priority}
                </Badge>
              </div>

              <div className="col-span-1 text-center">
                <Badge variant={task.status === "completed" ? "default" : "outline"}>
                  {task.status}
                </Badge>
              </div>

              <div className="col-span-1 text-right flex justify-end gap-1">
                <Button size="icon" variant="ghost" onClick={() => openEdit(task)}>
                  <Edit size={14} />
                </Button>
                <Button size="icon" variant="ghost" className="text-red-500" onClick={() => handleDelete(task.id)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>

            {expandedTasks.includes(task.id) && (
              <div className="bg-slate-50 px-8 pb-4">
                <p className="text-xs text-slate-600 mb-2">{task.description || "No description"}</p>

                {task.subtasks?.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs bg-white p-2 rounded border mb-1">
                    {s.isCompleted
                      ? <CheckCircle2 size={14} className="text-green-500" />
                      : <Circle size={14} />}
                    {s.title}
                  </div>
                ))}
              </div>
            )}

          </div>
        ))}

      </div>

      {/* MODAL */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingTask ? "Edit Task" : "Add Task"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Project</Label>
                <Select value={form.projectId} onValueChange={v => setForm(f => ({ ...f, projectId: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Assigner</Label>
                <Select value={form.assignerId} onValueChange={v => setForm(f => ({ ...f, assignerId: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {employees.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Task Name</Label>
              <Input value={form.taskName} onChange={e => setForm(f => ({ ...f, taskName: e.target.value }))} />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start</Label>
                <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div>
                <Label>End</Label>
                <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingTask ? "Save Changes" : "Add Task"}</Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>

    </div>
  );
}
