import { useState, useEffect } from "react";
import {
  Plus,
  X,
  Trash2,
  ChevronDown,
  ChevronRight,
  Calendar,
  Edit,
  CheckCircle2,
  Circle,
  User,
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
  DialogTrigger,
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

// TASK INTERFACE (MATCHING BACKEND SCHEMA)
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

interface Subtask {
  id?: string;
  title: string;
  isCompleted: boolean;
  assignedMember?: string;
  assignedTo?: string;
}

export default function Tasks() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [openDialog, setOpenDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<string[]>([]);
  const [newSubtasks, setNewSubtasks] = useState<Subtask[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const [newTask, setNewTask] = useState({
    title: "", // Form input title, mapped to taskName on save
    description: "",
    startDate: "",
    endDate: "",
    status: "pending" as const,
    priority: "medium" as const,
    assignedMembers: [] as string[],
    assignerId: "",
    projectId: ""
  });

  // Load basic data (Employees and Projects)
  useEffect(() => {
    fetch('/api/employees')
      .then(r => r.json())
      .then(data => setEmployees(data))
      .catch(console.error);

    fetch('/api/projects')
      .then(r => r.json())
      .then(data => {
        setProjects(data);
        if (data.length > 0) {
          setNewTask(prev => ({ ...prev, projectId: data[0].id }));
        }
      })
      .catch(console.error);
  }, []);

  // LOAD TASKS FROM DATABASE (Refetches when project selection changes)
  useEffect(() => {
    if (!newTask.projectId) return;

    fetch(`/api/tasks/${newTask.projectId}`)
      .then(res => res.json())
      .then(data => setTasks(data))
      .catch(console.error);
  }, [newTask.projectId]);

  const filteredTasks = tasks.filter((task) => {
    const nameStr = task.taskName.toLowerCase();
    return nameStr.includes(searchQuery.toLowerCase()) || searchQuery === "";
  });

  // ADD TASK (API POST WITH TRANSACTIONS)
  const handleAddTask = async () => {
    if (!newTask.title || !newTask.projectId || !newTask.assignerId) {
      alert("Please fill in Task Name, Project, and Assigner.");
      return;
    }

    const payload = {
      projectId: newTask.projectId,
      taskName: newTask.title,
      description: newTask.description,
      status: newTask.status,
      priority: newTask.priority,
      startDate: newTask.startDate,
      endDate: newTask.endDate,
      assignerId: newTask.assignerId,
      taskMembers: newTask.assignedMembers,
      subtasks: newSubtasks.map(st => ({
        title: st.title,
        assignedTo: st.assignedMember,
        isCompleted: false,
      })),
    };

    try {
      // --- Updated fetch logic start ---
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }

      const data = await res.json();
      // --- Updated fetch logic end ---

      // Reload from DB so state is always synced with server
      const updated = await fetch(`/api/tasks/${newTask.projectId}`).then(r => r.json());
      setTasks(updated);

      // Reset Form
      setNewTask({
        title: "",
        description: "",
        startDate: "",
        endDate: "",
        status: "pending",
        priority: "medium",
        assignedMembers: [],
        assignerId: "",
        projectId: newTask.projectId,
      });
      setNewSubtasks([]);
      setOpenDialog(false);
    } catch (error) {
      alert("Error: " + error);
    }
  };

  const handleUpdateTask = () => {
    if (!editingTask) return;
    // PUT logic would go here
    setEditingTask(null);
  };

  const handleDeleteTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  const handleAddSubtask = () => {
    const newSubtask: Subtask = {
      title: "",
      isCompleted: false,
      assignedMember: ""
    };
    setNewSubtasks([...newSubtasks, newSubtask]);
  };

  const toggleExpand = (taskId: string) => {
    setExpandedTasks(prev =>
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    );
  };

  const toggleMember = (memberId: string) => {
    const current = newTask.assignedMembers;
    const updated = current.includes(memberId) ? current.filter(id => id !== memberId) : [...current, memberId];
    setNewTask({ ...newTask, assignedMembers: updated });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-100 text-red-700 border-red-200";
      case "medium": return "bg-amber-100 text-amber-700 border-amber-200";
      default: return "bg-emerald-100 text-emerald-700 border-emerald-200";
    }
  };

  return (
    <div className="space-y-6 p-6 bg-slate-50 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Tasks</h1>
          <p className="text-muted-foreground mt-1 text-sm">Organize and track your project progress.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search tasks..."
              className="pl-9 w-64 bg-white border-slate-200"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <Dialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Task</DialogTitle>
              </DialogHeader>
              {editingTask && (
                <div className="space-y-4 py-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Project</Label>
                      <Select value={editingTask.projectId} onValueChange={(val) => setEditingTask({ ...editingTask, projectId: val })}>
                        <SelectTrigger><SelectValue placeholder="Select Project" /></SelectTrigger>
                        <SelectContent>
                          {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Assigner</Label>
                      <Select value={editingTask.assignerId} onValueChange={(val) => setEditingTask({ ...editingTask, assignerId: val })}>
                        <SelectTrigger><SelectValue placeholder="Select Assigner" /></SelectTrigger>
                        <SelectContent>
                          {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Task Name</Label>
                    <Input
                      value={editingTask.taskName}
                      onChange={(e) => setEditingTask({ ...editingTask, taskName: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={editingTask.description || ""}
                      onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input type="date" value={editingTask.startDate || ""} onChange={(e) => setEditingTask({ ...editingTask, startDate: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>End Date</Label>
                      <Input type="date" value={editingTask.endDate || ""} onChange={(e) => setEditingTask({ ...editingTask, endDate: e.target.value })} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={editingTask.status} onValueChange={(val: any) => setEditingTask({ ...editingTask, status: val })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="in-progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Select value={editingTask.priority} onValueChange={(val: any) => setEditingTask({ ...editingTask, priority: val })}>
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
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingTask(null)}>Cancel</Button>
                <Button onClick={async () => {
                  if (!editingTask) return;
                  const payload = {
                    taskName: editingTask.taskName,
                    description: editingTask.description ?? "",
                    startDate: editingTask.startDate ?? "",
                    endDate: editingTask.endDate ?? "",
                    status: editingTask.status,
                    priority: editingTask.priority,
                    assignerId: editingTask.assignerId,
                    projectId: editingTask.projectId,
                    taskMembers: editingTask.taskMembers ?? [],
                    subtasks: editingTask.subtasks ?? [],
                  };

                  try {
                    const res = await fetch(`/api/tasks/${editingTask.id}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(payload),
                    });
                    if (!res.ok) throw new Error(await res.text());
                    const updatedTasks = await fetch(`/api/tasks/${editingTask.projectId}`).then(r => r.json());
                    setTasks(updatedTasks);
                    setEditingTask(null);
                  } catch (err) {
                    alert("Failed to update task: " + err);
                  }
                }}>Save Changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-12 bg-slate-100/80 border-b text-[10px] font-bold text-slate-500 uppercase p-4 tracking-wider">
          <div className="col-span-3 px-2">Task Name</div>
          <div className="col-span-2 px-2">Project</div>
          <div className="col-span-1 px-2 text-center">Assigner</div>
          <div className="col-span-2 px-2 text-center">Due Date</div>
          <div className="col-span-2 px-2 text-center">Priority</div>
          <div className="col-span-1 px-2 text-center">Status</div>
          <div className="col-span-1 px-2 text-right">Actions</div>
        </div>

        <div className="divide-y">
          {filteredTasks.length > 0 ? (
            filteredTasks.map((task) => (
              <div key={task.id} className="group transition-colors hover:bg-slate-50/30">
                <div className="grid grid-cols-12 items-center p-4 text-xs">
                  <div className="col-span-3 flex flex-col px-2">
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleExpand(task.id)}>
                        {expandedTasks.includes(task.id) ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                      </button>
                      <span className={`font-semibold text-slate-800 text-[13px] ${task.status === 'completed' ? 'line-through opacity-50' : ''}`}>
                        {task.taskName}
                      </span>
                    </div>
                  </div>

                  <div className="col-span-2 px-2 text-slate-500 font-medium">
                    {projects.find(p => p.id === task.projectId)?.title || "Project"}
                  </div>

                  <div className="col-span-1 px-2 text-center text-[11px] font-semibold text-slate-700">
                    {employees.find((u: any) => u.id === task.assignerId)?.name || "—"}
                  </div>

                  <div className="col-span-2 px-2 text-center flex flex-col items-center text-[10px] text-slate-500">
                    <div className="flex items-center gap-1 font-medium"><Calendar className="h-3 w-3 opacity-70" /> {task.endDate || "N/A"}</div>
                  </div>

                  <div className="col-span-2 px-2 text-center">
                    <Badge variant="outline" className={`text-[9px] uppercase font-bold py-0 h-4 ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </Badge>
                  </div>

                  <div className="col-span-1 px-2 text-center">
                    <Badge variant={task.status === 'completed' ? 'default' : 'outline'} className="text-[9px] px-1.5 capitalize h-5">
                      {task.status}
                    </Badge>
                  </div>

                  <div className="col-span-1 px-2 text-right flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingTask(task); }}><Edit className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => handleDeleteTask(task.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>

                {expandedTasks.includes(task.id) && (
                  <div className="bg-slate-50/50 border-l-4 border-blue-500 mx-6 mb-4 mt-0 p-3 rounded-r-lg space-y-2">
                    <div className="mb-2">
                      <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                        <span className="font-bold text-slate-700 uppercase text-[9px] mr-2">Description:</span>
                        {task.description || "No description provided."}
                      </p>
                    </div>
                    {task.subtasks?.map((st, sIdx) => (
                      <div key={sIdx} className="flex items-center gap-3 py-1.5 px-3 bg-white border border-slate-100 rounded-md text-[11px] shadow-sm">
                        {st.isCompleted ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Circle className="h-3.5 w-3.5 text-slate-300" />}
                        <span className={st.isCompleted ? "line-through text-slate-400" : "text-slate-700"}>{st.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="p-12 text-center text-slate-500 text-sm">
              No tasks found. Select a project to view tasks.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}