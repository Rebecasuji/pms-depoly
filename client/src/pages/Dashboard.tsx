import { useState, useEffect, useRef } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/apiClient";
import {
  CheckCircle2,
  Layers,
  ChevronDown,
  Download,
  Plus,
  Briefcase,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

export default function Dashboard() {
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [keySteps, setKeySteps] = useState<any[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [expandedSections, setExpandedSections] = useState({ analytics: true });
  const [newProjectDialog, setNewProjectDialog] = useState(false);

  const [newProject, setNewProject] = useState({
    title: "",
    description: "",
    startDate: "",
    endDate: "",
    status: "open" as const,
    department: "" as string,
    vendors: "",
  });

  const dashboardRef = useRef<HTMLDivElement>(null);

  // Fetch departments on mount
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await apiFetch("/api/departments");
        if (!res.ok) throw new Error("Failed to fetch departments");
        const data = await res.json();
        setDepartments(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Fetch departments error:", err);
      }
    };
    fetchDepartments();
  }, []);

  // ---------------- PROJECTS ----------------

  const fetchProjects = async () => {
    try {
      const res = await apiFetch("/api/projects");
      if (!res.ok) throw new Error("Failed to fetch projects");
      const data = await res.json();
      setProjects(data);
    } catch (err) {
      console.error("Fetch projects error:", err);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const getProjectName = (projectId: any) => {
    const project = projects.find((p) => String(p.id) === String(projectId));
    return project ? project.title : "Unknown Project";
  };


  // ---------------- TASKS (BULK FETCH) ----------------

  const fetchTasks = async () => {
    try {
      if (projects.length === 0) {
        setTasks([]);
        return;
      }
      // Fetch all tasks for all projects at once
      const res = await apiFetch("/api/tasks/bulk");
      if (!res.ok) throw new Error("Failed to fetch tasks");
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Fetch tasks error:", err);
      setTasks([]);
    }
  };

  // ---------------- KEY STEPS (BULK FETCH) ----------------

  const fetchKeySteps = async () => {
    try {
      if (projects.length === 0) {
        setKeySteps([]);
        return;
      }
      // Fetch all keysteps for all projects at once
      const res = await apiFetch("/api/keysteps/bulk");
      if (!res.ok) throw new Error("Failed to fetch keysteps");
      const data = await res.json();
      setKeySteps(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Fetch keysteps error:", err);
      setKeySteps([]);
    }
  };

  useEffect(() => {
    if (projects.length > 0) {
      // Fetch tasks and keysteps in parallel (not sequentially)
      Promise.all([fetchTasks(), fetchKeySteps()]);
    }
  }, [projects]);

  // ---------------- CREATE PROJECT ----------------

  const handleCreateProject = async () => {
    if (!newProject.title || !newProject.startDate || !newProject.endDate) return;

    try {
      // Auto-generate project code from title (e.g., "My Project" -> "MYPROJECT")
      const autoProjectCode = newProject.title
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .substring(0, 20) || "PROJECT";

      const response = await apiFetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newProject.title,
          projectCode: autoProjectCode,
          description: newProject.description,
          startDate: newProject.startDate,
          endDate: newProject.endDate,
          status: newProject.status,
          department: newProject.department ? [newProject.department] : [],
          vendors: newProject.vendors ? [newProject.vendors] : [],
          progress: 0,
          team: [],
        }),
      });

      if (!response.ok) throw new Error("Failed to create project");

      await fetchProjects();
      setNewProject({
        title: "",
        description: "",
        startDate: "",
        endDate: "",
        status: "open",
        department: "",
        vendors: "",
      });
      setNewProjectDialog(false);
    } catch (err) {
      console.error(err);
      alert("Failed to create project");
    }
  };

  // ---------------- TASK COMPLETION ----------------

  const completedCount = tasks.filter((t) =>
    ["completed", "done", "closed"].includes(String(t.status).toLowerCase())
  ).length;

  const completionPercent =
    tasks.length === 0 ? 0 : Math.round((completedCount / tasks.length) * 100);

  // ---------------- UI HELPERS ----------------

  const toggleSection = (section: string) => {
    //setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // ---------------- REAL ANALYTICS DATA ----------------

  // Bar chart: tasks per project
  const barData = projects.map((project) => {
    const projectTasks = tasks.filter((t) => t.projectId === project.id);
    const completed = projectTasks.filter((t) =>
      ["completed", "done", "closed"].includes(String(t.status).toLowerCase())
    ).length;

    return {
      name: project.title,
      tasks: projectTasks.length,
      completed,
    };
  });

  // Pie chart: key steps completion
  const completedKeySteps = keySteps.filter((ks) =>
    ["completed", "done", "closed"].includes(String(ks.status).toLowerCase())
  ).length;

  const pieData = [
    { name: "Completed", value: completedKeySteps, color: "hsl(var(--chart-2))" },
    { name: "Pending", value: keySteps.length - completedKeySteps, color: "hsl(var(--chart-1))" },
  ];

  // -------- GROUP KEY STEPS BY PROJECT (TOP STATS) --------
  const groupedKeySteps = projects
    .map((project) => {
      const steps = keySteps.filter((ks) => String(ks.projectId) === String(project.id));
      return {
        projectId: project.id,
        projectName: project.title,
        steps,
      };
    })
    .filter((g) => g.steps.length > 0);


  // ---------------- RENDER ----------------

  return (
    <div ref={dashboardRef} className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Welcome back. Here's what's happening today.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              try {
                // 1️⃣ Summary stats
                const totalProjects = projects.length;
                const totalTasks = tasks.length;
                const totalKeySteps = keySteps.length;

                // 2️⃣ Start HTML for Word
                let html = `
<html xmlns:o='urn:schemas-microsoft-com:office:office'
      xmlns:w='urn:schemas-microsoft-com:office:word'
      xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset="utf-8"><title>Dashboard Export</title></head>
<body>
<h2>Dashboard Summary</h2>
<p><strong>Total Projects:</strong> ${totalProjects}</p>
<p><strong>Total Tasks:</strong> ${totalTasks}</p>
<p><strong>Total Key Steps:</strong> ${totalKeySteps}</p>

<h3>Projects Overview</h3>
<table border="1" cellspacing="0" cellpadding="5">
  <tr>
    <th>Project Name</th>
    <th>Start Date</th>
    <th>End Date</th>
    <th>Progress</th>
    <th>Number of Tasks</th>
    <th>Number of Key Steps</th>
  </tr>
`;

                projects.forEach((p) => {
                  const projectTasks = tasks.filter((t) => t.projectId === p.id);
                  const projectKeySteps = keySteps.filter((ks) => ks.projectId === p.id);

                  html += `
  <tr>
    <td>${p.title}</td>
    <td>${p.startDate}</td>
    <td>${p.endDate}</td>
    <td>${p.progress || 0}%</td>
    <td>${projectTasks.length}</td>
    <td>${projectKeySteps.length}</td>
  </tr>
`;
                });

                html += `</table></body></html>`;

                // 3️⃣ Create and download Word file
                const blob = new Blob([html], { type: "application/msword" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "dashboard.doc";
                a.click();
                URL.revokeObjectURL(url);
              } catch (err: any) {
                console.error(err);
                alert("Failed to export dashboard: " + err.message);
              }
            }}
          >
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>

          <Dialog open={newProjectDialog} onOpenChange={setNewProjectDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> New Project
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
                <DialogDescription>
                  Add a new project with team members and vendors.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label>Project Name</Label>
                  <Input
                    value={newProject.title}
                    onChange={(e) =>
                      setNewProject({ ...newProject, title: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={newProject.description}
                    onChange={(e) =>
                      setNewProject({
                        ...newProject,
                        description: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    type="date"
                    value={newProject.startDate}
                    onChange={(e) =>
                      setNewProject({
                        ...newProject,
                        startDate: e.target.value,
                      })
                    }
                  />
                  <Input
                    type="date"
                    value={newProject.endDate}
                    onChange={(e) =>
                      setNewProject({ ...newProject, endDate: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label>Department (visible to all members in this department)</Label>
                  <Select
                    value={newProject.department}
                    onValueChange={(val: string) =>
                      setNewProject({ ...newProject, department: val })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Select
                  value={newProject.status}
                  onValueChange={(val: any) =>
                    setNewProject({ ...newProject, status: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setNewProjectDialog(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateProject}>Create Project</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* TOP STATS */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">

        {/* PROJECTS */}
        <Card className="hover:shadow-lg hover:scale-105 transition-transform transition-shadow">
          <CardHeader className="flex justify-between pb-2">
            <CardTitle className="text-sm">Total Projects</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>

          <CardContent className="space-y-3">
            {/* Main Count */}
            <div className="flex items-end justify-between">
              <div className="text-3xl font-bold">{projects.length}</div>
              <span className="text-xs text-muted-foreground">
                All time
              </span>
            </div>

            {/* Divider */}
            <div className="h-px bg-border" />

            {/* Sub info row */}
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Tracked projects</span>
              <span>Updated live</span>
            </div>
          </CardContent>
        </Card>

        {/* TASKS */}
        <Card className="hover:shadow-lg hover:scale-105 transition-transform transition-shadow">
          <CardHeader className="flex justify-between pb-2">
            <CardTitle className="text-sm">Task Completion</CardTitle>
          </CardHeader>

          <CardContent className="space-y-2">
            {tasks.length === 0 ? (
              <p className="text-xs text-muted-foreground">No tasks yet</p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  {completedCount} of {tasks.length} tasks completed
                </p>

                <Progress value={completionPercent} />

                <div className="pt-2 space-y-1">
                  {tasks.slice(0, 3).map((task) => (
                    <div
                      key={task.id}
                      className="text-xs border-b last:border-none py-1 space-y-0.5"
                    >
                      <div className="flex justify-between">
                        <span className="truncate font-medium">
                          {task.taskName || task.title}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {task.status}
                        </Badge>
                      </div>

                      <div className="text-[10px] text-muted-foreground truncate">
                        📁 {getProjectName(task.projectId)}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* KEY STEPS */}
        <Card className="hover:shadow-lg hover:scale-105 transition-transform transition-shadow">
          <CardHeader className="flex justify-between pb-2">
            <CardTitle className="text-sm">Key Steps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-2xl font-bold">{keySteps.length}</div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {groupedKeySteps.slice(0, 4).map((group) => (
                <div key={group.projectId} className="space-y-1">
                  {/* Project Name */}
                  <div className="text-xs font-semibold truncate">
                    📁 {group.projectName}
                  </div>

                  {/* Steps under project */}
                  {group.steps.slice(0, 2).map((ks) => (
                    <div
                      key={ks.id}
                      className="text-[11px] text-muted-foreground truncate pl-3"
                    >
                      • {ks.title || ks.stepName}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* CALENDAR */}
        <Card className="hover:shadow-lg hover:scale-105 transition-transform transition-shadow">
          <CardHeader className="flex justify-between pb-2">
            <CardTitle className="text-sm">Upcoming</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-1">
            {projects.slice(0, 3).map((p) => (
              <div key={p.id} className="text-xs">
                <span className="font-medium">{p.title}</span>
                <div className="text-muted-foreground">{p.endDate}</div>
              </div>
            ))}
          </CardContent>
        </Card>

      </div>

      {/* CURRENT PROJECTS */}
      <Card className="border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Current Projects</CardTitle>
          </div>
          <Badge variant="outline">{projects.length} Projects</Badge>
        </div>

        <div className="border-t">
          {projects.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              No projects yet
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-6 py-3 text-xs font-bold">Name</th>
                  <th className="px-6 py-3 text-xs font-bold">Dates</th>
                  <th className="px-6 py-3 text-xs font-bold">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {projects.map((project) => (
                  <tr key={project.id}>
                    <td className="px-6 py-4 font-semibold text-sm">
                      {project.title}
                    </td>
                    <td className="px-6 py-4 text-xs text-muted-foreground">
                      {project.startDate} — {project.endDate}
                    </td>
                    <td className="px-6 py-4 font-bold text-primary">
                      {project.progress || 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* ANALYTICS */}
      <Card>
        <CardHeader
          className="pb-3 cursor-pointer flex justify-between"
          onClick={() => toggleSection("analytics")}
        >
          <div>
            <CardTitle>Analytics</CardTitle>
            <CardDescription>Performance overview</CardDescription>
          </div>
          <ChevronDown
            className={`h-5 w-5 transition-transform ${expandedSections.analytics ? "" : "-rotate-90"
              }`}
          />
        </CardHeader>

        {expandedSections.analytics && (
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {/* BAR CHART: Tasks per Project */}
              <div className="flex flex-col items-center w-full">
                <h3 className="text-sm font-semibold mb-2">Tasks</h3>

                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="tasks" stackId="a" fill="hsl(var(--chart-1))" name="Total Tasks" />
                    <Bar dataKey="completed" stackId="a" fill="hsl(var(--chart-2))" name="Completed Tasks" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* PIE CHART: Key Steps Completion */}
              <div className="flex flex-col items-center w-full">
                <h3 className="text-sm font-semibold mb-2">Key Steps</h3>

                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      dataKey="value"
                      label={({ name, value }) => {
                        const percent =
                          keySteps.length === 0
                            ? 0
                            : ((value / keySteps.length) * 100).toFixed(0);
                        return `${name}: ${value} (${percent}%)`;
                      }}
                    >
                      {pieData.map((entry, index) => (
                        <Cell
                          key={index}
                          fill={entry.color}
                          stroke="#fff"
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>

                    <Legend
                      verticalAlign="bottom"
                      align="center"
                      iconType="circle"
                      formatter={(value, entry: any) => {
                        const percent =
                          keySteps.length === 0
                            ? 0
                            : ((entry.payload.value / keySteps.length) * 100).toFixed(0);
                        return `${value}: ${percent}%`;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}



