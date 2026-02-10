import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, Plus, Trash2, CheckCircle2, Circle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/apiClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function AddEditTask() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const taskId = searchParams.get("id");
  const projectId = searchParams.get("projectId");

  const [employees, setEmployees] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [subtasks, setSubtasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    projectId: String(projectId || ""),
    keyStepId: "",
    taskName: "",
    description: "",
    startDate: "",
    endDate: "",
    status: "pending",
    priority: "medium" as "low" | "medium" | "high",
    assignerId: "",
    taskMembers: [] as string[],
  });

  // Load initial data - employees and projects
  useEffect(() => {
    let isMounted = true;

    Promise.all([
      apiFetch("/api/employees").then(r => {
        if (!r.ok) throw new Error(`API error: ${r.status}`);
        return r.json();
      }),
      apiFetch("/api/projects").then(r => {
        if (!r.ok) throw new Error(`API error: ${r.status}`);
        return r.json();
      })
    ])
      .then(([empData, projData]) => {
        if (!isMounted) return;
        setEmployees(Array.isArray(empData) ? empData : []);
        setProjects(Array.isArray(projData) ? projData : []);
      })
      .catch(err => {
        if (!isMounted) return;
        console.error("Failed to load data:", err);
        setEmployees([]);
        setProjects([]);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Load task data when editing
  useEffect(() => {
    if (!taskId) return;

    let isMounted = true;

    apiFetch(`/api/task/${taskId}`)
      .then(r => {
        if (!r.ok) throw new Error(`API error: ${r.status}`);
        return r.json();
      })
      .then((task: any) => {
        if (!isMounted) return;
        setForm({
          projectId: String(task.projectId || ""),
          keyStepId: String(task.keyStepId || ""),
          taskName: task.taskName || "",
          description: task.description || "",
          startDate: task.startDate || "",
          endDate: task.endDate || "",
          status: task.status || "pending",
          priority: task.priority || "medium",
          assignerId: String(task.assignerId || ""),
          taskMembers: task.taskMembers || [],
        });
        setSubtasks(Array.isArray(task.subtasks) ? task.subtasks : []);
      })
      .catch(err => {
        if (!isMounted) return;
        console.error("Failed to load task:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [taskId]);

  // Load milestones when project changes
  useEffect(() => {
    if (!form.projectId) {
      setMilestones([]);
      return;
    }

    let isMounted = true;

    apiFetch(`/api/projects/${form.projectId}/key-steps`)
      .then(r => {
        if (!r.ok) throw new Error(`API error: ${r.status}`);
        return r.json();
      })
      .then(data => {
        if (!isMounted) return;
        setMilestones(Array.isArray(data) ? data : []);
      })
      .catch(err => {
        if (!isMounted) return;
        console.error("Failed to load milestones:", err);
        setMilestones([]);
      });

    return () => {
      isMounted = false;
    };
  }, [form.projectId]);

  const addSubtask = () => {
    setSubtasks(s => [...s, { id: undefined, title: "", isCompleted: false, assignedTo: [] }]);
  };

  const updateSubtask = (index: number, key: string, value: any) => {
    setSubtasks(s => s.map((st, i) => (i === index ? { ...st, [key]: value } : st)));
  };

  const removeSubtask = (index: number) => {
    setSubtasks(s => s.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!form.taskName || !form.projectId || !form.assignerId) {
      toast({ variant: "destructive", title: "Validation Error", description: "Task Name, Project, and Assigner are required" });
      return;
    }

    setLoading(true);

    try {
      const payload = { ...form, subtasks };
      const method = taskId ? "PUT" : "POST";
      const url = taskId ? `/api/tasks/${taskId}` : "/api/tasks";

      const response = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("API Error:", error);
        toast({ variant: "destructive", title: "Error", description: error.message || error.details || "Failed to save task" });
        setLoading(false);
        return;
      }

      const result = await response.json();
      console.log("Task saved:", result);
      
      toast({
        title: taskId ? "Updated" : "Created",
        description: `Task "${form.taskName}" ${taskId ? "updated" : "created"} successfully!`,
      });
      
      setTimeout(() => navigate("/tasks"), 1000);
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Failed to save task" });
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate("/tasks")} className="hover:bg-slate-200 p-2 rounded-lg">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-3xl font-bold">{taskId ? "Edit Task" : "Add Task"}</h1>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg border p-8 space-y-6">
          {/* Row 1: Project & Assigner */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <Label className="text-sm font-semibold mb-2 block">Project *</Label>
              <Select value={form.projectId} onValueChange={v => setForm(f => ({ ...f, projectId: v }))}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select Project" />
                </SelectTrigger>
                <SelectContent className="max-h-[320px] overflow-y-auto">
                  {projects.length > 0 ? (
                    projects.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>)
                  ) : (
                    <div className="p-2 text-xs text-muted-foreground">No projects available</div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-semibold mb-2 block">Assigner *</Label>
              <Select value={form.assignerId} onValueChange={v => setForm(f => ({ ...f, assignerId: v }))}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select Assigner" />
                </SelectTrigger>
                <SelectContent>
                  {employees.length > 0 ? (
                    employees.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)
                  ) : (
                    <div className="p-2 text-xs text-muted-foreground">No employees available</div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-semibold mb-2 block">Assignees (multiple)</Label>
              <Select
                value=""
                onValueChange={v => setForm(f => ({ ...f, taskMembers: Array.isArray(f.taskMembers) ? Array.from(new Set([...f.taskMembers, v])) : [v] }))}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Add assignee..." />
                </SelectTrigger>
                <SelectContent>
                  {employees.length > 0 ? (
                    employees.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)
                  ) : (
                    <div className="p-2 text-xs text-muted-foreground">No employees available</div>
                  )}
                </SelectContent>
              </Select>

              <div className="flex gap-2 flex-wrap mt-2">
                {form.taskMembers.map(id => (
                  <Badge key={id} variant="secondary" className="text-xs cursor-pointer" onClick={() => setForm(f => ({ ...f, taskMembers: f.taskMembers.filter(x => x !== id) }))}>
                    {employees.find(e => e.id === id)?.name || id} ✕
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Milestone */}
          <div>
            <Label className="text-sm font-semibold mb-2 block">Milestone (Key Step)</Label>
            <Select value={form.keyStepId || "none"} onValueChange={v => setForm(f => ({ ...f, keyStepId: v === "none" ? "" : v }))}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Select Milestone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Milestone</SelectItem>
                {milestones.map(m => <SelectItem key={m.id} value={String(m.id)}>{m.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Task Name & Description */}
          <div>
            <Label className="text-sm font-semibold mb-2 block">Task Name *</Label>
            <Input
              value={form.taskName}
              onChange={e => setForm(f => ({ ...f, taskName: e.target.value }))}
              placeholder="Enter task name"
              className="h-10"
            />
          </div>

          <div>
            <Label className="text-sm font-semibold mb-2 block">Description</Label>
            <Textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Enter task description"
              rows={4}
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <Label className="text-sm font-semibold mb-2 block">Start Date</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                className="h-10"
              />
            </div>
            <div>
              <Label className="text-sm font-semibold mb-2 block">End Date</Label>
              <Input
                type="date"
                value={form.endDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                className="h-10"
              />
            </div>
          </div>

          {/* Status & Priority */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <Label className="text-sm font-semibold mb-2 block">Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Planned">Planned</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-semibold mb-2 block">Priority</Label>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v as any }))}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Subtasks */}
          <div className="border-t pt-6 space-y-4">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-semibold">Subtasks</Label>
              <Button size="sm" variant="outline" onClick={addSubtask}>
                <Plus className="h-4 w-4 mr-1" /> Add Subtask
              </Button>
            </div>

            {subtasks.map((st, i) => (
              <div key={i} className="p-4 bg-slate-50 border rounded-lg space-y-3">
                <div className="flex gap-3 items-start">
                  <button
                    onClick={() => updateSubtask(i, "isCompleted", !st.isCompleted)}
                    className="mt-2"
                  >
                    {st.isCompleted ? (
                      <CheckCircle2 size={20} className="text-green-500" />
                    ) : (
                      <Circle size={20} className="text-slate-400" />
                    )}
                  </button>
                  <div className="flex-1">
                    <Input
                      placeholder="Subtask title"
                      value={st.title}
                      onChange={e => updateSubtask(i, "title", e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-500 hover:text-red-700"
                    onClick={() => removeSubtask(i)}
                  >
                    <Trash2 size={18} />
                  </Button>
                </div>

                <Select
                  value=""
                  onValueChange={id => {
                    if (!st.assignedTo.includes(id)) {
                      updateSubtask(i, "assignedTo", [...st.assignedTo, id]);
                    }
                  }}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Assign members..." />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map(e => (
                      <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex gap-2 flex-wrap">
                  {st.assignedTo.map(id => (
                    <Badge
                      key={id}
                      variant="secondary"
                      className="text-xs cursor-pointer"
                      onClick={() =>
                        updateSubtask(i, "assignedTo", st.assignedTo.filter((x: string) => x !== id))
                      }
                    >
                      {employees.find(e => e.id === id)?.name} ✕
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Buttons */}
          <div className="flex gap-4 justify-end border-t pt-6">
            <Button
              variant="outline"
              onClick={() => navigate("/tasks")}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? "Saving..." : taskId ? "Save Changes" : "Create Task"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
