import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Search,
  Plus,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Building2,
  Hash,
  Upload,
  Download,
  FileIcon,
  Users,
  X,
  ExternalLink,
  UserPlus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { v4 as uuidv4 } from "uuid";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/Layout";
import { apiFetch } from "@/lib/apiClient";

export default function Projects() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const userDepartment = user?.department || null;
  const [projects, setProjects] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [openDialog, setOpenDialog] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'saveAs'>('create');
  const [showAdvanced, setShowAdvanced] = useState(false);
  // For non-admins, default to "all" so backend filters by department
  // Admins can see truly all projects with "all"
  const [departmentFilter, setDepartmentFilter] = useState<string>(isAdmin ? "all" : "all");
  // Sorting
  const [sortKey, setSortKey] = useState<string>(() => localStorage.getItem("projects_sort_key") || "name");
  const [sortDir, setSortDir] = useState<string>(() => localStorage.getItem("projects_sort_dir") || "asc");
  const [, setLocation] = useLocation();
  const [formProject, setFormProject] = useState({
    title: "",
    projectCode: "",
    department: [] as string[],
    clientName: "",
    description: "",
    startDate: "",
    endDate: "",
    progress: 0,
    status: "Planned",
    team: [] as string[],
    vendors: [] as string[]
  });
  const [uploadingProject, setUploadingProject] = useState<string | null>(null);
  const [projectFiles, setProjectFiles] = useState<Record<string, any[]>>({});
  const [vendorInput, setVendorInput] = useState("");
  const [teamMemberSearch, setTeamMemberSearch] = useState("");

  // use shared apiFetch from lib/apiClient (includes caching, dedupe, auth)

  // FETCH DEPARTMENTS
  const fetchDepartments = async () => {
    try {
      const res = await apiFetch("/api/departments");
      if (!res.ok) throw new Error("Failed to fetch departments");
      const data = await res.json();
      setDepartments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch departments", err);
      setDepartments([]);
    }
  };

  // FETCH PROJECTS
  const fetchProjects = async () => {
    try {
      const res = await apiFetch("/api/projects");
      if (!res.ok) throw new Error("Failed to fetch projects");
      const data = await res.json();
      setProjects(data);
    } catch (err) {
      console.error("Failed to fetch projects", err);
    }
  };

  const addVendor = () => {
    const value = vendorInput.trim();
    if (!value) return;

    // prevent duplicates (case-insensitive)
    if (
      formProject.vendors.some(
        v => v.toLowerCase() === value.toLowerCase()
      )
    ) {
      setVendorInput("");
      return;
    }

    setFormProject(prev => ({
      ...prev,
      vendors: [...prev.vendors, value],
    }));

    setVendorInput("");
  };

  const removeVendor = (vendor: string) => {
    setFormProject(prev => ({
      ...prev,
      vendors: prev.vendors.filter(v => v !== vendor),
    }));
  };

  // Fetch employees data
  const fetchEmployees = async () => {
    try {
      const empRes = await apiFetch('/api/employees');
      if (!empRes.ok) {
        console.error("Failed to fetch employees:", empRes.status);
        setEmployees([]);
      } else {
        const empData = await empRes.json();
        console.log("Loaded employees:", empData);
        setEmployees(Array.isArray(empData) ? empData : []);
      }
    } catch (err) {
      console.error("Error fetching employees:", err);
      setEmployees([]);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      await fetchEmployees();
      await fetchDepartments();
    };

    loadInitialData();
    fetchProjects();
  }, []);

  const fetchProjectFiles = async (projectId: string) => {
    try {
      const res = await apiFetch(`/api/projects/${projectId}/files`);
      const data = res.ok ? await res.json() : [];
      setProjectFiles(prev => ({
        ...prev,
        [projectId]: data
      }));
    } catch (err) {
      console.error("Failed to fetch project files", err);
    }
  };

  const filteredProjects = projects.filter(p => {
    const matchesSearch =
      p.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.projectCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.clientName?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || p.status === statusFilter;

    // Normalize department filter value to match backend normalization
    const filterDeptNorm = departmentFilter === "all" ? "" : departmentFilter.toLowerCase();
    const projectDepts = (p.department || []).map((d: string) => d.toLowerCase());
    const matchesDepartment =
      departmentFilter === "all" ||
      projectDepts.includes(filterDeptNorm);

    return matchesSearch && matchesStatus && matchesDepartment;
  });

  const handleOpenCreate = () => {
    setModalMode("create");
    setEditingId(null);
    setShowAdvanced(false);
    setFormProject({
      title: "",
      projectCode: "",
      department: [],
      clientName: "",
      description: "",
      startDate: "",
      endDate: "",
      progress: 0,
      status: "Planned",
      team: [],
      vendors: []
    });
    setTeamMemberSearch("");
    // Refresh employees before opening dialog
    fetchEmployees().then(() => {
      setOpenDialog(true);
    });
  };

  const handleFileUpload = async (projectId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await apiFetch(`/api/projects/${projectId}/upload`, {
        method: 'POST',
        body: formData
      });
      if (response.ok) {
        const uploadedFile = await response.json();
        // Ensure the backend returns { id, fileName, fileSize, url }
        setProjectFiles(prev => ({
          ...prev,
          [projectId]: [...(prev[projectId] || []), uploadedFile]
        }));
      }
    } catch (err) {
      console.error('Upload failed:', err);
    }
  };

  const handleOpenEdit = (project: any) => {
    setModalMode("edit");
    setEditingId(project.id);

    setFormProject({
      title: project.title,
      projectCode: project.projectCode || "",
      department: project.department ?? [],
      clientName: project.clientName || "",
      description: project.description || "",
      startDate: project.startDate ? new Date(project.startDate).toISOString().split("T")[0] : "",
      endDate: project.endDate ? new Date(project.endDate).toISOString().split("T")[0] : "",
      progress: project.progress || 0,
      status: project.status || "Planned",
      team: project.team || [],
      vendors: project.vendors || [],
    });

    setTeamMemberSearch("");
    // Refresh employees before opening dialog
    fetchEmployees().then(() => {
      setOpenDialog(true);
    });
  };

  // OPTIMIZED SAVE PROJECT - minimal validation, fast execution
  const handleSaveProject = async () => {
    const titleTrimmed = formProject.title?.trim();
    if (!titleTrimmed) {
      toast({ variant: "destructive", title: "Error", description: "Project name is required" });
      return;
    }

    if (!formProject.startDate) {
      toast({ variant: "destructive", title: "Error", description: "Start date is required" });
      return;
    }

    if (!formProject.endDate) {
      toast({ variant: "destructive", title: "Error", description: "End date is required" });
      return;
    }

    try {
      // Only send title as required; other fields are optional
      const payload = {
        title: titleTrimmed,
        projectCode: formProject.projectCode?.trim() || "",
        clientName: formProject.clientName?.trim() || "",
        department: formProject.department || [],
        description: formProject.description?.trim() || "",
        status: formProject.status || "Planned",
        startDate: formProject.startDate || "",
        endDate: formProject.endDate || "",
        progress: Number(formProject.progress) || 0,
        team: formProject.team || [],
        vendors: formProject.vendors || [],
      };

      let response;
      if (modalMode === "edit" && editingId) {
        response = await apiFetch(`/api/projects/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        response = await apiFetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!response.ok) {
        let errorMessage = "Failed to save project";
        try {
          const errorData = await response.json();
          errorMessage = errorData.details || errorData.error || errorMessage;
          if (response.status === 409) {
            toast({
              variant: "destructive",
              title: "Duplicate Project Code",
              description: "This code exists. Leave empty to auto-generate.",
            });
            return;
          }
        } catch (e) {
          const text = await response.text();
          errorMessage = text || errorMessage;
        }
        toast({ variant: "destructive", title: "Error", description: errorMessage });
        return;
      }

      setOpenDialog(false);
      setEditingId(null);
      setModalMode("create");
      setFormProject({
        title: "",
        projectCode: "",
        department: [],
        clientName: "",
        description: "",
        startDate: "",
        endDate: "",
        progress: 0,
        status: "Planned",
        team: [],
        vendors: [],
      });
      setVendorInput("");
      setTeamMemberSearch("");

      // Update local state without refetching entire projects list for performance
      try {
        const json = await response.json();
        if (modalMode === "edit" && editingId) {
          // replace updated project in local state
          setProjects((prev) => prev.map((p) => (String(p.id) === String(json.id) ? json : p)));
        } else {
          // prepend newly created project for immediate visibility
          setProjects((prev) => [json, ...prev]);
        }
      } catch (e) {
        // fallback: refetch if parsing fails
        await fetchProjects();
      }
      toast({
        title: modalMode === "edit" ? "Updated" : "Created",
        description: `Project "${titleTrimmed}" ${modalMode === "edit" ? "updated" : "created"}!`,
      });
    } catch (error) {
      console.error("Save error:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to save project" });
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      const response = await apiFetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setProjects(projects.filter(p => p.id !== id));
        toast({ title: "Deleted", description: "Project deleted successfully" });
      }
    } catch (error) {
      console.error("Failed to delete project:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to delete project" });
    }
  };

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

  const addTeamMember = (id: string) => {
    if (!formProject.team.includes(id)) {
      setFormProject({ ...formProject, team: [...formProject.team, id] });
    }
  };

  const removeTeamMember = (id: string) => {
    setFormProject({ ...formProject, team: formProject.team.filter(m => m !== id) });
  };

  const getStatusBadge = (status: string) => {
    const s = status || 'Planned';
    if (s === 'Planned') {
      return <Badge className="bg-slate-500 hover:bg-slate-600 text-white text-[10px] uppercase border-none">Planned</Badge>;
    }
    if (s === 'In Progress') {
      return <Badge className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] uppercase border-none">In Progress</Badge>;
    }
    if (s === 'On Hold') {
      return <Badge className="bg-orange-500 hover:bg-orange-600 text-white text-[10px] uppercase border-none">On Hold</Badge>;
    }
    if (s === 'Completed') {
      return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] uppercase border-none">Completed</Badge>;
    }
    return (
      <Badge variant="secondary" className="text-[10px] uppercase">
        {status || "Planned"}
      </Badge>
    );
  };

  const getProgressColorClass = (progress: number) => {
    if (progress <= 30) return "bg-red-500";
    if (progress <= 70) return "bg-amber-500";
    return "bg-emerald-500";
  };

  const filteredEmployees =
    formProject.department.length > 0
      ? employees.filter(emp =>
        formProject.department.includes(emp.department)
      )
      : employees;

  // Group employees by department
  const employeesByDepartment = employees.reduce((acc, emp) => {
    const dept = emp.department || "General";
    if (!acc[dept]) {
      acc[dept] = [];
    }
    acc[dept].push(emp);
    return acc;
  }, {} as Record<string, any[]>);

  const sortedDepartments = Object.keys(employeesByDepartment).sort();

  // Filter employees by search term for team member dropdown
  const filteredEmployeesForTeam = teamMemberSearch.trim() 
    ? employees.filter(emp => 
        emp.name?.toLowerCase().includes(teamMemberSearch.toLowerCase()) ||
        emp.empCode?.toLowerCase().includes(teamMemberSearch.toLowerCase()) ||
        emp.designation?.toLowerCase().includes(teamMemberSearch.toLowerCase()) ||
        emp.department?.toLowerCase().includes(teamMemberSearch.toLowerCase())
      )
    : employees;

  // Apply department filtering to the team picker (if departments selected)
  const filteredEmployeesForPicker = formProject.department.length > 0
    ? filteredEmployeesForTeam.filter(emp => formProject.department.includes(emp.department))
    : filteredEmployeesForTeam;

  // Group filtered employees by department
  const filteredEmployeesByDepartment = filteredEmployeesForPicker.reduce((acc, emp) => {
    const dept = emp.department || "General";
    if (!acc[dept]) {
      acc[dept] = [];
    }
    acc[dept].push(emp);
    return acc;
  }, {} as Record<string, any[]>);

  const filteredSortedDepartments = Object.keys(filteredEmployeesByDepartment).sort();

  const formatDateDisplay = (d: string | undefined | null) => {
    if (!d) return "Not set";
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return d;
      const dd = String(dt.getDate()).padStart(2, "0");
      const mon = dt.toLocaleString("en-US", { month: "short" });
      return `${dd}-${mon}-${dt.getFullYear()}`;
    } catch {
      return d;
    }
  };

  // Apply sorting to filtered projects
  const sortedProjects = [...filteredProjects].sort((a, b) => {
    const key = sortKey;
    let va: any = a[key === 'name' ? 'title' : (key === 'created' ? 'createdAt' : 'endDate')];
    let vb: any = b[key === 'name' ? 'title' : (key === 'created' ? 'createdAt' : 'endDate')];
    if (!va) va = "";
    if (!vb) vb = "";
    if (key === 'created' || key === 'end') {
      va = new Date(va).getTime() || 0;
      vb = new Date(vb).getTime() || 0;
    } else {
      va = String(va).toLowerCase();
      vb = String(vb).toLowerCase();
    }
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  useEffect(() => {
    localStorage.setItem("projects_sort_key", sortKey);
    localStorage.setItem("projects_sort_dir", sortDir);
  }, [sortKey, sortDir]);

  return (
    <div className="space-y-6">
      {/* New Project Button & Dialog */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Projects</h1>
          <p className="text-muted-foreground mt-1 font-sans">Create and manage your projects.</p>
        </div>

        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          {/* Button to open modal */}
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>

          {/* Dialog Content */}
          <DialogContent className="max-w-none w-screen h-screen m-0 rounded-none overflow-y-auto">
            <DialogHeader className="px-6 pt-6">
              <DialogTitle className="text-2xl font-display">
                {editingId ? "Edit Project" : "Create New Project"}
              </DialogTitle>
              <DialogDescription className="font-sans">
                {editingId
                  ? "Update project details and team assignments."
                  : "Add a new project with team members and milestones."}
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 space-y-8 font-sans py-4 max-w-5xl mx-auto">
              {/* Project Name, Code & Status */}
              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="title" className="font-bold">Project Name <span className="text-destructive">*</span></Label>
                  <Input
                    id="title"
                    value={formProject.title}
                    onChange={(e) => setFormProject({ ...formProject, title: e.target.value })}
                    placeholder="e.g., Website Redesign"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="projectCode">Project Code <span className="text-xs text-muted-foreground">(optional)</span></Label>
                  <Input
                    id="projectCode"
                    value={formProject.projectCode}
                    onChange={(e) => setFormProject({ ...formProject, projectCode: e.target.value })}
                    placeholder="e.g., K-2025-001 (optional - leave empty to auto-generate)"
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty to auto-generate or enter a unique code
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Project Status <span className="text-xs text-muted-foreground">(optional)</span></Label>
                  <Select
                    value={formProject.status || "Planned"}
                    onValueChange={(v) => setFormProject({ ...formProject, status: v })}
                  >
                    <SelectTrigger id="status">
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Planned">Planned</SelectItem>
                      <SelectItem value="In Progress">In Progress</SelectItem>
                      <SelectItem value="On Hold">On Hold</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Client & Departments */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clientName">Client Name <span className="text-xs text-muted-foreground">(optional)</span></Label>
                  <Input
                    id="clientName"
                    value={formProject.clientName}
                    onChange={(e) => setFormProject({ ...formProject, clientName: e.target.value })}
                    placeholder="e.g., Acme Corp"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Departments <span className="text-xs text-muted-foreground">(optional)</span></Label>
                  <div className="grid grid-cols-2 gap-2 border rounded-lg p-3 bg-muted/20">
                    {[
                      "HR",
                      "Operations",
                      "Software Developers",
                      "Finance",
                      "Purchase",
                      "Presales",
                      "IT Support",
                    ].map((dept) => {
                      const isChecked = formProject.department.includes(dept);

                      return (
                        <label
                          key={dept}
                          className="flex items-center gap-2 text-sm cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setFormProject((prev) => ({
                                ...prev,
                                department: isChecked
                                  ? prev.department.filter(d => d !== dept)
                                  : Array.from(new Set([...prev.department, dept])),
                              }));
                            }}
                          />
                          {dept}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Advanced Options Toggle */}
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <span className="text-sm font-bold uppercase text-muted-foreground">
                  {showAdvanced ? '−' : '+'} Advanced Options
                </span>
                {showAdvanced && <span className="text-xs text-primary">{formProject.team.length + formProject.vendors.length} items</span>}
              </button>

              {showAdvanced && (
                <div className="space-y-6 p-4 border rounded-lg bg-muted/10">
                  {/* Team Members */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                        <UserPlus className="h-4 w-4" /> Assign Team Members
                      </Label>
                      <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                        {formProject.team.length} Selected
                      </span>
                    </div>

                    {/* Search input for team members */}
                    <Input
                      placeholder="Search by name, code, designation, or department..."
                      value={teamMemberSearch}
                      onChange={(e) => setTeamMemberSearch(e.target.value)}
                      className="bg-background"
                    />

                    <Select
                      value=""
                      onValueChange={(id) => {
                        addTeamMember(id);
                        setTeamMemberSearch("");
                      }}
                    >
                        <SelectTrigger className="w-full bg-background">
                        <SelectValue placeholder={filteredEmployeesForPicker.length === 0 ? "No employees match search" : "Select employee to add..."} />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px] w-full">
                        {filteredEmployeesForPicker.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground">
                            No employees found
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {filteredSortedDepartments.map((dept) => (
                              <div key={dept}>
                                {/* Department Header */}
                                <div className="px-3 py-2 text-xs font-bold uppercase text-primary bg-muted/50 sticky top-0">
                                  {dept}
                                </div>
                                {/* Employees in this department */}
                                {filteredEmployeesByDepartment[dept].map((emp: any) => {
                                  const isSelected = formProject.team.includes(emp.id);
                                  return (
                                    <SelectItem
                                      key={emp.id}
                                      value={emp.id}
                                      disabled={isSelected}
                                      className={isSelected ? "opacity-50" : ""}
                                    >
                                      <div className="flex flex-col py-0.5 pl-2">
                                        <span className="font-medium text-sm">{emp.name}</span>
                                        <span className="text-[10px] text-muted-foreground">
                                          {emp.designation || "N/A"} • {emp.empCode}
                                        </span>
                                      </div>
                                    </SelectItem>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        )}
                      </SelectContent>
                    </Select>

                    <ScrollArea className="h-[100px] w-full rounded-md border bg-background p-2">
                      {formProject.team.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-xs text-muted-foreground italic">
                          No team members assigned yet.
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {formProject.team.map((id) => {
                            const emp = employees.find((e) => String(e.id) === String(id));
                            return (
                              <div
                                key={id}
                                className="flex items-center justify-between p-2 rounded-md border bg-muted/30 group"
                              >
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs font-bold truncate">{emp?.name || id}</span>
                                  <span className="text-[9px] text-muted-foreground truncate uppercase">{emp?.designation || "Staff"}</span>
                                  {formProject.department.length > 0 && emp && !formProject.department.includes(emp.department) && (
                                    <span className="text-[9px] text-destructive">Inactive / Not in department</span>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                  onClick={() => removeTeamMember(id)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </ScrollArea>
                  </div>

                  {/* Vendors (Manual Entry) */}
                  <div className="space-y-3 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                        <Users className="h-4 w-4" /> Vendors
                      </Label>
                      <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                        {formProject.vendors.length} Added
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <Input
                        value={vendorInput}
                        onChange={(e) => setVendorInput(e.target.value)}
                        placeholder="Type vendor name and press Add"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addVendor();
                          }
                        }}
                      />
                      <Button type="button" onClick={addVendor}>
                        Add
                      </Button>
                    </div>

                    {formProject.vendors.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">
                        No vendors added yet.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {formProject.vendors.map((vendor) => (
                          <Badge
                            key={vendor}
                            variant="secondary"
                            className="flex items-center gap-1"
                          >
                            {vendor}
                            <button
                              type="button"
                              onClick={() => removeVendor(vendor)}
                              className="ml-1 hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Progress & Dates */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="progress">Progress (%) <span className="text-xs text-muted-foreground">(optional)</span></Label>
                  <Input
                    id="progress"
                    type="number"
                    min="0"
                    max="100"
                    value={formProject.progress}
                    onChange={(e) => setFormProject({ ...formProject, progress: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startDate" className="font-bold">Start Date <span className="text-destructive">*</span></Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formProject.startDate}
                    onChange={(e) => setFormProject({ ...formProject, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate" className="font-bold">End Date <span className="text-destructive">*</span></Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formProject.endDate}
                    onChange={(e) => setFormProject({ ...formProject, endDate: e.target.value })}
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description <span className="text-xs text-muted-foreground">(optional)</span></Label>
                <Textarea
                  id="description"
                  value={formProject.description}
                  onChange={(e) => setFormProject({ ...formProject, description: e.target.value })}
                  placeholder="Describe your project goals and scope..."
                  className="min-h-[100px]"
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <DialogFooter className="pt-4 border-t">
              <Button variant="outline" onClick={() => {
                setOpenDialog(false);
                setTeamMemberSearch("");
              }}>Cancel</Button>
              <Button onClick={handleSaveProject} className="min-w-[120px]">
                {modalMode === 'edit' ? "Update Project" :
                  modalMode === 'saveAs' ? "Create As Project" :
                    "Create Project"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col md:flex-row gap-4 font-sans">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects, codes, or clients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Department Filter - Only for Admins */}
        {isAdmin && departments.length > 0 && (
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-full md:w-56">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept} value={dept.toLowerCase()}>
                  {dept}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Status Filter */}
        {/* Sort */}
        <div className="flex gap-2">
          <Select value={sortKey} onValueChange={(v) => setSortKey(v)}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Project Name (A–Z)</SelectItem>
              <SelectItem value="created">Created Date</SelectItem>
              <SelectItem value="end">End Date</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortDir} onValueChange={(v) => setSortDir(v)}>
            <SelectTrigger className="w-full md:w-36">
              <SelectValue placeholder="Direction" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">Asc</SelectItem>
              <SelectItem value="desc">Desc</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-40">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in-progress">In Progress</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="out of schedule">Out of Schedule</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 font-sans">
        {filteredProjects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No projects found</p>
            </CardContent>
          </Card>
        ) : (
          sortedProjects.map(project => {
            const isExpanded = expandedId === project.id;

            return (
              <Card key={project.id} className="hover:shadow-sm transition-all overflow-hidden border-muted/60">
                <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/20" onClick={() => {
                    // Toggle expanded details view
                    setExpandedId(isExpanded ? null : project.id);
                  }}>
                  <div className="flex items-center gap-4 flex-1">
                    <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    <div className="flex-1">
                      <span className="font-bold text-foreground leading-tight">{project.title}</span>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-sm text-muted-foreground">{employees.find(e => e.id === project.createdByEmployeeId)?.name || "-"}</div>
                      <div className="text-sm text-muted-foreground">{formatDateDisplay(project.createdAt)}</div>
                      <div className="text-sm text-muted-foreground">{project.endDate ? formatDateDisplay(project.endDate) : "Not set"}</div>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <CardContent className="pt-0 pb-5 px-4 animate-in fade-in slide-in-from-top-1">
                    <div className="pt-4 border-t border-muted/40 space-y-6">
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div className="space-y-1">
                            <p className="text-xs font-semibold uppercase text-muted-foreground">About Project</p>
                            <p className="text-sm text-foreground/80 leading-relaxed">{project.description}</p>
                          </div>
                          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground bg-muted/40 w-fit px-2 py-1 rounded">
                            <Hash className="h-3 w-3" />
                            Code: {project.projectCode || "N/A"}
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                            Departments
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {project.department && project.department.length > 0 ? (
                              project.department.map((dept: string) => (
                                <Badge key={dept} variant="secondary">
                                  {dept}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                No departments assigned
                              </span>
                            )}
                          </div>
                        </div>


                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="col-span-2">
                            <p className="text-muted-foreground text-xs uppercase font-semibold">Client</p>
                            <p className="font-medium">{project.clientName || "Not Assigned"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs uppercase font-semibold">Start Date</p>
                            <p className="font-medium">{project.startDate ? new Date(project.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : "Not set"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs uppercase font-semibold">End Date</p>
                            <p className="font-medium">{project.endDate ? new Date(project.endDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : "Not set"}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/30 p-4 rounded-lg">
                        <div className="space-y-2">
                          <p className="text-xs font-semibold uppercase text-muted-foreground">Team Members ({project.team?.length || 0})</p>
                          <div className="flex flex-wrap gap-2">
                            {project.team && project.team.length > 0 ? (
                              project.team.map((memberId: string) => {
                                const emp = employees.find(e => e.id === memberId);
                                return (
                                  <Badge key={memberId} variant="outline" className="flex flex-col items-start px-2 py-1">
                                    <span className="text-[11px] font-bold">{emp?.name || memberId}</span>
                                    <span className="text-[9px] text-muted-foreground">{emp?.designation}</span>
                                  </Badge>
                                );
                              })
                            ) : (
                              <span className="text-xs text-muted-foreground">No team members</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <p className="text-xs font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-2"><Users className="h-3 w-3" /> Vendors</p>
                          <div className="flex flex-wrap gap-2">
                            {project.vendors && project.vendors.length > 0 ? (
                              project.vendors.map((vendor: string) => (
                                <Badge key={vendor} variant="secondary">{vendor}</Badge>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">No vendors assigned</span>
                            )}
                          </div>
                        </div>

                        <div className="border-t pt-4">
                          <p className="text-xs font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-2"><Upload className="h-3 w-3" /> Project Files</p>
                          <div className="space-y-2">
                            <div className="space-y-2">
                              {projectFiles[project.id]?.length > 0 ? (
                                projectFiles[project.id].map((file: any) => (
                                  <div key={file.id} className="flex items-center gap-2 p-2 rounded border bg-muted/20">
                                    <FileIcon className="h-4 w-4 text-muted-foreground" />

                                    {/* Clickable to open */}
                                    <a
                                      href={file.url} // MUST be a full URL
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm flex-1 truncate underline hover:text-primary"
                                    >
                                      {file.fileName}
                                    </a>

                                    <span className="text-xs text-muted-foreground">{(file.fileSize / 1024).toFixed(1)} KB</span>

                                    <div className="flex gap-1">
                                      {/* Download button */}
                                      <a
                                        href={file.url} // MUST be a full URL
                                        download={file.fileName}
                                        className="text-xs px-2 py-0.5 border rounded hover:bg-muted/20"
                                      >
                                        Download
                                      </a>

                                      {/* Cancel/Delete button with confirmation */}
                                      <button
                                        onClick={async () => {
                                          if (confirm(`Are you sure you want to delete ${file.fileName}?`)) {
                                            try {
                                              const res = await apiFetch(`/api/projects/${project.id}/files/${file.id}`, { method: "DELETE" });
                                              if (res.ok) {
                                                setProjectFiles(prev => ({
                                                  ...prev,
                                                  [project.id]: prev[project.id].filter(f => f.id !== file.id)
                                                }));
                                                toast({ title: "Deleted", description: `${file.fileName} deleted successfully` });
                                              }
                                            } catch (err) {
                                              console.error("Failed to delete file:", err);
                                              toast({ variant: "destructive", title: "Error", description: "Failed to delete file" });
                                            }
                                          }
                                        }}
                                        className="text-xs px-2 py-0.5 border rounded text-destructive hover:bg-muted/20"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground">No files uploaded</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-3 pt-4 border-t border-muted/40">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEdit(project)}
                          className="flex items-center gap-2"
                        >
                          <Edit className="h-4 w-4" />
                          Edit Project
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            localStorage.setItem("selectedProjectId", String(project.id));
                            setLocation('/keysteps');
                          }}
                          className="flex items-center gap-2"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Go to Key Steps
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })
        )}
        {/* DELETE CONFIRMATION DIALOG */}
        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-destructive">
                Confirm Delete
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this project?
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setProjectToDelete(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  if (projectToDelete) {
                    await handleDeleteProject(projectToDelete);
                  }
                  setDeleteConfirmOpen(false);
                  setProjectToDelete(null);
                }}
              >
                Continue
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}