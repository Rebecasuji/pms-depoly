import { useState, useEffect } from "react";
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

export default function Projects() {
  const [projects, setProjects] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [openDialog, setOpenDialog] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Current project being edited (null if creating)
  const [editingId, setEditingId] = useState<string | null>(null);

  // Modal mode: create / edit / saveAs
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'saveAs'>('create');

  const [formProject, setFormProject] = useState({
    title: "",
    projectCode: "",
    clientName: "",
    description: "",
    startDate: "",
    endDate: "",
    progress: 0,
    team: [] as string[],
    vendors: [] as string[]
  });

  const [uploadingProject, setUploadingProject] = useState<string | null>(null);
  const [projectFiles, setProjectFiles] = useState<Record<string, any[]>>({});

  // CHANGE 1 — Extract fetchProjects into a function
  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      setProjects(data);
    } catch (err) {
      console.error("Failed to fetch projects", err);
    }
  };

  // CHANGE 2 — Call fetchProjects() correctly in useEffect
  useEffect(() => {
    // Fetch Employees
    fetch('/api/employees')
      .then(r => r.json())
      .then(data => setEmployees(data))
      .catch(console.error);

    // Fetch Projects
    fetchProjects();
  }, []);

  // CHANGE 3 — Fetch project files when expanded
  const fetchProjectFiles = async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/files`);
      const data = await res.json();
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
    return matchesSearch && matchesStatus;
  });

  const handleOpenCreate = () => {
    setModalMode('create');   // 🔥 IMPORTANT
    setEditingId(null);
    setFormProject({
      title: "",
      projectCode: "",
      clientName: "",
      description: "",
      startDate: "",
      endDate: "",
      progress: 0,
      team: [],
      vendors: []
    });
    setOpenDialog(true);
  };

  const handleFileUpload = async (projectId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch(`/api/projects/${projectId}/upload`, {
        method: 'POST',
        body: formData
      });
      if (response.ok) {
        const newFile = await response.json();
        setProjectFiles(prev => ({
          ...prev,
          [projectId]: [...(prev[projectId] || []), newFile]
        }));
      }
    } catch (err) {
      console.error('Upload failed:', err);
    }
  };

  const handleOpenEdit = (project: any) => {
    setModalMode('edit'); // set modal to edit mode
    setEditingId(project.id); // <-- fix here
    setFormProject({
      title: project.title,
      projectCode: project.projectCode || "",
      clientName: project.clientName || "",
      description: project.description || "",
      startDate: project.startDate?.slice(0, 10) || "",
      endDate: project.endDate?.slice(0, 10) || "",
      progress: project.progress || 0,
      team: project.team || [],
      vendors: project.vendors || []
    });
    setOpenDialog(true);
  };

  const handleSaveProject = async () => {
    if (!formProject.title || !formProject.startDate || !formProject.endDate) {
      alert("Please fill required fields");
      return;
    }

    try {
      const payload = {
        title: formProject.title,
        projectCode: formProject.projectCode,   // ✅ ADD THIS
        clientName: formProject.clientName,
        description: formProject.description,
        startDate: formProject.startDate,
        endDate: formProject.endDate,
        progress: formProject.progress,
        team: formProject.team,
        vendors: formProject.vendors,
      };

      let response;

      if (modalMode === 'edit' && editingId) {
        // UPDATE existing project
        response = await fetch(`/api/projects/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        // CREATE new project (Create or Save As)
        response = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!response.ok) {
        const text = await response.text();
        console.error("Save failed response:", text);
        throw new Error(text || "Save failed");
      }

      await fetchProjects();
      setOpenDialog(false);
      setEditingId(null);
      setModalMode('create');
    } catch (error) {
      console.error("Failed to save project:", error);
      alert("Save failed. Check console.");
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setProjects(projects.filter(p => p.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete project:", error);
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
    const s = status?.toLowerCase() || 'open';
    if (s === 'pending') {
      return <Badge className="bg-orange-500 hover:bg-orange-600 text-white text-[10px] uppercase border-none">Pending</Badge>;
    }
    if (s === 'out of schedule') {
      return <Badge className="bg-red-600 hover:bg-red-700 text-white text-[10px] uppercase border-none">Out of Schedule</Badge>;
    }
    if (s === 'in-progress') {
      return <Badge className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] uppercase border-none">In Progress</Badge>;
    }
    return <Badge variant="secondary" className="text-[10px] uppercase">{status}</Badge>;
  };

  const getProgressColorClass = (progress: number) => {
    if (progress <= 30) return "bg-red-500";
    if (progress <= 70) return "bg-amber-500";
    return "bg-emerald-500";
  };

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
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">
                {editingId ? "Edit Project" : "Create New Project"}
              </DialogTitle>
              <DialogDescription className="font-sans">
                {editingId
                  ? "Update project details and team assignments."
                  : "Add a new project with team members and milestones."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 font-sans py-4">
              {/* Project Name & Code */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Project Name</Label>
                  <Input
                    id="title"
                    value={formProject.title}
                    onChange={(e) => setFormProject({ ...formProject, title: e.target.value })}
                    placeholder="e.g., Website Redesign"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="projectCode">Project Code</Label>
                  <Input
                    id="projectCode"
                    value={formProject.projectCode}
                    onChange={(e) => setFormProject({ ...formProject, projectCode: e.target.value })}
                    placeholder="e.g., K-2025-001"
                  />
                </div>
              </div>

              {/* Client & Vendor */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clientName">Client Name</Label>
                  <Input
                    id="clientName"
                    value={formProject.clientName}
                    onChange={(e) => setFormProject({ ...formProject, clientName: e.target.value })}
                    placeholder="e.g., Acme Corp"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vendor">Assign Vendor</Label>
                  <Input
                    id="vendor"
                    value={formProject.vendors[0] || ""}
                    onChange={(e) => setFormProject({ ...formProject, vendors: [e.target.value] })}
                    placeholder="Enter vendor name"
                  />
                </div>
              </div>

              {/* Team Members */}
              <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    <UserPlus className="h-4 w-4" /> Assign Team Members
                  </Label>
                  <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                    {formProject.team.length} Selected
                  </span>
                </div>

                <Select onValueChange={addTeamMember}>
                  <SelectTrigger className="w-full bg-background">
                    <SelectValue placeholder="Search and add employees..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[250px]">
                    {employees.map((emp) => (
                      <SelectItem
                        key={emp.id}
                        value={emp.id}
                        disabled={formProject.team.includes(emp.id)}
                      >
                        <div className="flex flex-col py-0.5">
                          <span className="font-medium text-sm">{emp.name}</span>
                          <span className="text-[10px] text-muted-foreground">{emp.designation}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <ScrollArea className="h-[120px] w-full rounded-md border bg-background p-2">
                  {formProject.team.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground italic">
                      No team members assigned yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {formProject.team.map((id) => {
                        const emp = employees.find((e) => e.id === id);
                        return (
                          <div
                            key={id}
                            className="flex items-center justify-between p-2 rounded-md border bg-muted/30 group"
                          >
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-bold truncate">{emp?.name || id}</span>
                              <span className="text-[9px] text-muted-foreground truncate uppercase">{emp?.designation || "Staff"}</span>
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

              {/* Progress & Dates */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="progress">Progress (%)</Label>
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
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formProject.startDate}
                    onChange={(e) => setFormProject({ ...formProject, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
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
                <Label htmlFor="description">Description</Label>
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
              <Button variant="outline" onClick={() => setOpenDialog(false)}>Cancel</Button>
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
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects, codes, or clients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
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
          filteredProjects.map(project => {
            const isExpanded = expandedId === project.id;

            return (
              <Card key={project.id} className="hover:shadow-sm transition-all overflow-hidden border-muted/60">
                <div
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/20"
                  // UPDATED CLICK LOGIC
                  onClick={() => {
                    const next = isExpanded ? null : project.id;
                    setExpandedId(next);
                    if (!isExpanded) {
                      fetchProjectFiles(project.id);
                    }
                  }}
                >
                  <div className="flex items-center gap-4 flex-1">
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-foreground leading-tight">{project.title}</span>
                        {project.projectCode && (
                          <span className="text-[10px] text-muted-foreground font-mono font-medium uppercase tracking-wider mt-0.5">
                            {project.projectCode}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(project.status)}
                        {project.clientName && (
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Building2 className="h-3 w-3" /> {project.clientName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="hidden md:flex items-center gap-3 w-32">
                      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full transition-all ${getProgressColorClass(project.progress)}`}
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium">{project.progress}%</span>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setExpandedId(project.id); }}>
                          <Eye className="mr-2 h-4 w-4" /> View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenEdit(project); }}>
                          <Edit className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id); }} className="text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="col-span-2">
                            <p className="text-muted-foreground text-xs uppercase font-semibold">Client</p>
                            <p className="font-medium">{project.clientName || "Not Assigned"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs uppercase font-semibold">Start Date</p>
                            <p className="font-medium">{project.startDate}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs uppercase font-semibold">End Date</p>
                            <p className="font-medium">{project.endDate}</p>
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
                            {projectFiles[project.id]?.length > 0 ? (
                              projectFiles[project.id].map((file: any) => (
                                <div key={file.id} className="flex items-center gap-2 p-2 rounded border bg-muted/20">
                                  <FileIcon className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm flex-1 truncate">{file.fileName}</span>
                                  <span className="text-xs text-muted-foreground">{(file.fileSize / 1024).toFixed(1)}KB</span>
                                </div>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">No files uploaded</span>
                            )}
                            <label className="flex items-center gap-2 px-3 py-2 text-sm border border-dashed rounded cursor-pointer hover:bg-muted/20 transition-colors">
                              <Upload className="h-4 w-4" />
                              <span>Upload File</span>
                              <input
                                type="file"
                                className="hidden"
                                onChange={(e) => {
                                  if (e.target.files?.[0]) {
                                    handleFileUpload(project.id, e.target.files[0]);
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}