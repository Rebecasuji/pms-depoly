import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Ticket,
  Plus,
  Search,
  Filter,
  MessageSquare,
  History,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Paperclip,
  Send,
  MoreVertical,
  ChevronRight,
  Download,
  ExternalLink,
  ArrowLeft,
  User as UserIcon,
  Tag,
  Building2,
  Calendar,
  Trash2,
  Pencil,
  Mic,
  Play,
  Pause,
  Copy,
  Check,
  ChevronsUpDown
} from "lucide-react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { VoiceRecorder } from "@/components/VoiceRecorder";

import { useAuth } from "@/components/Layout";
import { apiFetch } from "@/lib/apiClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

// --- Types ---
interface TicketData {
  id: string;
  ticketCode: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  department: string;
  projectId?: string;
  projectName?: string;
  createdBy: string;
  createdByName: string;
  assignedTo?: string;
  assignedToName?: string;
  companyName?: string;
  participants?: string[];
  createdAt: string;
  updatedAt: string;
  comments?: CommentData[];
  attachments?: AttachmentData[];
  taskId?: string | null;
}

interface CommentData {
  id: string;
  content: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

interface AttachmentData {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageUrl: string;
  createdAt: string;
}

// --- Constants ---
const CATEGORIES = ["Technical", "HR", "Facility", "Hardware", "Software", "Accounts", "Other"];
const PRIORITIES = ["Critical", "High", "Medium", "Low"];

const PRIORITY_COLORS: Record<string, string> = {
  Critical: "bg-red-500 hover:bg-red-600 text-white border-none",
  High: "bg-orange-500 hover:bg-orange-600 text-white border-none",
  Medium: "bg-yellow-500 hover:bg-yellow-600 text-white border-none",
  Low: "bg-green-500 hover:bg-green-600 text-white border-none",
};

const STATUS_COLORS: Record<string, string> = {
  Open: "bg-blue-100 text-blue-700 border-blue-200",
  "In Progress": "bg-purple-100 text-purple-700 border-purple-200",
  Resolved: "bg-green-100 text-green-700 border-green-200",
  Closed: "bg-gray-100 text-gray-700 border-gray-200",
};

// --- Custom Searchable Select ---
function SearchableSelect({ 
  options, 
  value, 
  onValueChange, 
  placeholder = "Select...", 
  emptyMessage = "No options found.",
  disabled = false
}: { 
  options: { value: string, label: string }[], 
  value: string, 
  onValueChange: (v: string) => void,
  placeholder?: string,
  emptyMessage?: string,
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled}
        >
          {value
            ? options.find((option) => option.value === value)?.label || value
            : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder={`Search ${placeholder.toLowerCase()}...`} />
          <CommandList className="max-h-[200px] overflow-y-auto">
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onValueChange(option.value === value ? "" : option.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function MultiSearchableSelect({ 
  options, 
  selectedValues, 
  onToggle, 
  placeholder = "Select members...",
  disabled = false
}: { 
  options: { value: string, label: string }[], 
  selectedValues: string[], 
  onToggle: (v: string) => void,
  placeholder?: string,
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled}
        >
          {selectedValues.length > 0 
            ? `${selectedValues.length} selected` 
            : placeholder}
          <Plus className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="Search members..." />
          <CommandList className="max-h-[200px] overflow-y-auto">
            <CommandEmpty>No one found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onToggle(option.value);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedValues.includes(option.value) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function TicketsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("my");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const isAdmin = user?.role === "ADMIN";

  // Queries
  const { data: tickets = [], isLoading: ticketsLoading } = useQuery<TicketData[]>({
    queryKey: ["/api/tickets"],
  });

  const { data: projects = [] } = useQuery<any[]>({
    queryKey: ["/api/projects"],
  });

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["/api/employees"],
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab === "raise") {
      setActiveTab("raise");
    } else if (tab === "manage") {
      setActiveTab("manage");
    }
  }, [isAdmin]);

  if (selectedTicketId) {
    return <TicketDetailView id={selectedTicketId} onBack={() => setSelectedTicketId(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ticket Management</h1>
          <p className="text-muted-foreground">Raise, track, and manage support tickets.</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button variant="outline" onClick={() => window.open("/api/tickets/export", "_blank")}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          )}
          <Button onClick={() => setActiveTab("raise")}>
            <Plus className="mr-2 h-4 w-4" /> Raise Ticket
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-background/50 backdrop-blur-sm border p-1 shadow-sm">
          <TabsTrigger value="my" className="px-6">My Tickets</TabsTrigger>
          <TabsTrigger value="manage" className="px-6">
            {isAdmin ? "Manage Tickets" : "Assigned Tickets"}
          </TabsTrigger>
          <TabsTrigger value="raise" className="px-6 text-primary font-semibold">
            <Plus className="mr-1 h-3.5 w-3.5" /> Raise Ticket
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my" className="space-y-4">
          <TicketsTable 
            tickets={tickets.filter(t => 
              t.createdBy === user?.employeeId ||
              t.assignedTo === user?.employeeId ||
              (Array.isArray(t.participants) && t.participants.includes(user?.employeeId))
            )}
            isLoading={ticketsLoading} 
            onView={setSelectedTicketId} 
            projects={projects}
            employees={employees}
          />
        </TabsContent>

        <TabsContent value="manage" className="space-y-4">
          <TicketsTable 
            tickets={isAdmin ? tickets : tickets.filter(t => t.assignedTo === user?.employeeId)} 
            isLoading={ticketsLoading} 
            onView={setSelectedTicketId} 
            isAdminView={isAdmin} 
            employees={employees}
            projects={projects}
          />
        </TabsContent>

        <TabsContent value="raise">
          <RaiseTicketForm 
            projects={projects} 
            employees={employees}
            onSuccess={() => setActiveTab("my")} 
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// --- Components ---

function RaiseTicketForm({ 
  projects, 
  employees = [],
  onSuccess,
  initialData,
  isClone = false
}: { 
  projects: any[], 
  employees?: any[],
  onSuccess: () => void,
  initialData?: TicketData,
  isClone?: boolean
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: initialData?.title || "",
    description: initialData?.description || "",
    category: initialData?.category || "Other",
    priority: initialData?.priority || "Medium",
    department: initialData?.department || "",
    projectId: initialData?.projectId || "",
    manualProject: (initialData as any)?.manualProject || "",
    companyName: initialData?.companyName || "",
    participants: initialData?.participants || [],
    assignedTo: initialData?.assignedTo || "",
  });

  const filteredAndSortedProjects = useMemo(() => {
    if (!projects || projects.length === 0) return [];
    if (!user) return projects;

    const isAdmin = user.role?.toUpperCase() === 'ADMIN';
    // Admin (SAM) sees ALL projects sorted alphabetically
    if (isAdmin) return [...projects].sort((a, b) => (a.title || "").localeCompare(b.title || ""));

    const normalizeDept = (d: string) => {
      if (!d) return "";
      let norm = d.toLowerCase().trim();
      if (norm.includes("software")) return "software";
      if (norm.includes("hardware") || norm.includes("technician")) return "hardware";
      return norm;
    };

    const userDept = normalizeDept(user.department || "");
    const empId = user.employeeId;

    const isDeptProject = (p: any) =>
      userDept && (p.departments || []).some((d: string) => normalizeDept(d) === userDept);

    const isAssignedProject = (p: any) =>
      empId && (
        (p.team && p.team.includes(empId)) ||
        (p.taskAssignees && p.taskAssignees.includes(empId)) ||
        (p.createdByEmployeeId === empId)
      );

    // Sort: department projects first, then assigned, then alphabetical rest
    return [...projects].sort((a, b) => {
      const aDept = isDeptProject(a) ? 2 : isAssignedProject(a) ? 1 : 0;
      const bDept = isDeptProject(b) ? 2 : isAssignedProject(b) ? 1 : 0;
      if (aDept !== bDept) return bDept - aDept;
      return (a.title || "").localeCompare(b.title || "");
    });
  }, [projects, user]);


  const { data: departments = [] } = useQuery<string[]>({
    queryKey: ["/api/departments"],
  });

  // Filter employees based on selected department
  const filteredEmployees = useMemo(() => {
    if (!formData.department) return employees;
    return employees.filter(e => e.department === formData.department);
  }, [employees, formData.department]);

  const [files, setFiles] = useState<File[]>([]);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [interimTranscription, setInterimTranscription] = useState("");
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  // Handle transcription
  const handleTranscription = useCallback((text: string, isFinal: boolean) => {
    if (isFinal) {
      setFormData(prev => {
        const current = prev.description.trim();
        return {
          ...prev,
          description: current ? `${current} ${text}.` : `${text}.`
        };
      });
      setInterimTranscription("");
    } else {
      setInterimTranscription(text);
    }

    // Auto-scroll textarea
    setTimeout(() => {
      if (descriptionRef.current) {
        descriptionRef.current.scrollTop = descriptionRef.current.scrollHeight;
      }
    }, 10);
  }, []);

  const raiseMutation = useMutation({
    mutationFn: async (data: any) => {
      // First upload files and voice note if any
      let attachments = [];
      if (files.length > 0 || audioBlob) {
        const formDataFiles = new FormData();
        files.forEach(file => formDataFiles.append("files", file));
        
        if (audioBlob) {
          const voiceFile = new File([audioBlob], `voice-note-${Date.now()}.webm`, { type: "audio/webm" });
          formDataFiles.append("files", voiceFile);
        }

        const uploadRes = await apiFetch("/api/site-reports/upload", { // Reuse existing upload endpoint
          method: "POST",
          body: formDataFiles,
        });
        if (uploadRes.ok) {
          attachments = await uploadRes.json();
        }
      }

      const url = (initialData?.id && !isClone) ? `/api/tickets/${initialData.id}` : "/api/tickets";
      const method = (initialData?.id && !isClone) ? "PATCH" : "POST";

      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, attachments }),
      });
      if (!res.ok) throw new Error("Failed to process ticket");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      if (initialData?.id && !isClone) {
         queryClient.invalidateQueries({ queryKey: [`/api/tickets/${initialData.id}`] });
      }
      toast({ 
        title: (initialData?.id && !isClone) ? "Ticket Updated" : "Ticket Raised", 
        description: (initialData?.id && !isClone) ? "Your changes have been saved." : "Your ticket has been submitted successfully." 
      });
      onSuccess();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
    onSettled: () => setIsSubmitting(false),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    raiseMutation.mutate(formData);
  };

  return (
    <Card className="max-w-3xl mx-auto border-t-4 border-t-primary shadow-lg glassmorphism">
      <CardHeader>
        <CardTitle>Create New Support Ticket</CardTitle>
        <CardDescription>Fill out the form below to raise a new support request.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="title">Ticket Title</Label>
              <Input 
                id="title" 
                placeholder="Brief summary of the issue" 
                value={formData.title} 
                onChange={e => setFormData({ ...formData, title: e.target.value })} 
                className="transition-all focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input 
                id="companyName" 
                placeholder="Client/Company name" 
                value={formData.companyName} 
                onChange={e => setFormData({ ...formData, companyName: e.target.value })} 
                className="transition-all focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={formData.category} onValueChange={v => setFormData({ ...formData, category: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={formData.priority} onValueChange={v => setFormData({ ...formData, priority: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Target Department</Label>
              <SearchableSelect 
                options={departments.map(d => ({ value: d, label: d }))}
                value={formData.department}
                onValueChange={v => setFormData({ ...formData, department: v, assignedTo: "", participants: [] })}
                placeholder="Select department..."
              />
            </div>

            <div className="space-y-2">
              <Label>Link Project</Label>
              <SearchableSelect 
                options={[
                  { value: "none", label: "None" },
                  ...filteredAndSortedProjects.map(p => ({ value: p.id, label: p.title }))
                ]}
                value={formData.projectId}
                onValueChange={v => setFormData({ ...formData, projectId: v })}
                placeholder="Select project..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manualProject">Manual Project Entry</Label>
              <Input 
                id="manualProject"
                placeholder="Type project name manually" 
                value={formData.manualProject}
                onChange={e => setFormData({ ...formData, manualProject: e.target.value })}
                className="transition-all focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <VoiceRecorder 
            onRecordingComplete={setAudioBlob} 
            onTranscription={handleTranscription}
            onIsRecordingChange={setIsRecording}
          />

          <div className="space-y-2 animate-in fade-in slide-in-from-top-4 duration-500">
            <Label className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Description (Auto-generated from voice or manual)
            </Label>
            <Textarea 
              ref={descriptionRef}
              placeholder="Speak now… your description will appear here automatically." 
              className="min-h-[150px] resize-none focus:ring-primary/20 transition-all duration-300 border-primary/10 shadow-inner bg-background/50 font-medium" 
              value={formData.description + (interimTranscription ? (formData.description ? " " : "") + interimTranscription + "..." : "")}
              onChange={e => {
                // If the user types manually, we update the base description
                setFormData({ ...formData, description: e.target.value });
              }}
            />
            <div className="flex items-center justify-between px-1">
              <p className="text-[10px] text-muted-foreground italic">
                {isRecording ? "Transcription active... keep speaking." : "You can edit the transcribed text manually."}
              </p>
              {formData.description && (
                <button 
                  type="button" 
                  onClick={() => setFormData({...formData, description: ""})}
                  className="text-[10px] text-destructive hover:underline"
                >
                  Clear Description
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Team & Collaboration</Label>
            <div className="border rounded-lg p-3 bg-muted/20 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Assigned To</Label>
                <SearchableSelect 
                  options={[
                    { value: "none", label: "Unassigned" },
                    ...filteredEmployees.map(emp => ({ value: emp.id, label: emp.name }))
                  ]}
                  value={formData.assignedTo}
                  onValueChange={v => setFormData({ ...formData, assignedTo: v === "none" ? "" : v })}
                  placeholder="Choose assignee..."
                  disabled={!formData.department}
                />
                {!formData.department && <p className="text-[10px] text-amber-600">Select a department first</p>}
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Participants / CC</Label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {formData.participants.map((pId: string) => {
                    const emp = employees.find((e: any) => e.id === pId);
                    return (
                      <Badge key={pId} variant="secondary" className="pr-1 gap-1">
                        {emp?.name || pId}
                        <button 
                          type="button" 
                          onClick={() => setFormData({ ...formData, participants: formData.participants.filter((id: string) => id !== pId) })}
                          className="hover:text-destructive"
                        >
                          ×
                        </button>
                      </Badge>
                    );
                  })}
                </div>
                <MultiSearchableSelect 
                  options={filteredEmployees
                    .filter(e => e.id !== formData.assignedTo)
                    .map(emp => ({ value: emp.id, label: emp.name }))
                  }
                  selectedValues={formData.participants}
                  onToggle={v => {
                    if (formData.participants.includes(v)) {
                      setFormData({ ...formData, participants: formData.participants.filter(id => id !== v) });
                    } else {
                      setFormData({ ...formData, participants: [...formData.participants, v] });
                    }
                  }}
                  placeholder="Add participant..."
                  disabled={!formData.department}
                />
              </div>
            </div>
          </div>

          <VoiceRecorder onRecordingComplete={setAudioBlob} />

          <div className="space-y-2">
            <Label>Attachments</Label>
            <div className="flex items-center gap-4 p-4 border-2 border-dashed rounded-lg bg-muted/30 transition-colors hover:bg-muted/50 cursor-pointer relative">
              <input 
                type="file" 
                multiple 
                className="absolute inset-0 opacity-0 cursor-pointer" 
                onChange={e => setFiles(Array.from(e.target.files || []))}
              />
              <div className="flex-1 flex flex-col items-center justify-center py-2 text-muted-foreground">
                <Paperclip className="h-8 w-8 mb-2" />
                <p className="text-sm font-medium">Click or drag files to upload</p>
                <p className="text-xs">Max size: 10MB each</p>
              </div>
            </div>
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {files.map((f, i) => (
                  <Badge key={i} variant="secondary" className="pl-1 pr-2 py-1 gap-1">
                    <Paperclip className="h-3 w-3" />
                    {f.name}
                    <button type="button" onClick={() => setFiles(files.filter((_, idx) => idx !== i))} className="ml-1 text-muted-foreground hover:text-foreground">×</button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between border-t p-6 bg-muted/10">
          <Button type="button" variant="ghost" onClick={() => onSuccess()}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting} className="min-w-[120px]">
            {isSubmitting ? (
              <>
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Processing...
              </>
            ) : initialData?.id ? "Update Ticket" : "Submit Ticket"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function TicketsTable({ 
  tickets, 
  isLoading, 
  onView, 
  isAdminView,
  employees = [],
  projects = []
}: { 
  tickets: TicketData[], 
  isLoading: boolean, 
  onView: (id: string) => void,
  isAdminView?: boolean,
  employees?: any[],
  projects?: any[]
}) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/tickets/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete ticket");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      toast({ title: "Deleted", description: "Ticket has been removed successfully." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      const res = await apiFetch(`/api/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update ticket");
      return res.json();
    },
    onMutate: async ({ id, data }) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: ["/api/tickets"] });

      // Snapshot the previous value
      const previousTickets = queryClient.getQueryData<TicketData[]>(["/api/tickets"]);

      // Optimistically update to the new value
      queryClient.setQueryData<TicketData[]>(["/api/tickets"], (old) => {
        return old?.map(t => t.id === id ? { ...t, ...data } : t);
      });

      // Return a context object with the snapshotted value
      return { previousTickets };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousTickets) {
        queryClient.setQueryData(["/api/tickets"], context.previousTickets);
      }
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
    onSettled: (data, error, variables) => {
      // Always refetch after error or success to ensure we have the correct data from the server
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      queryClient.invalidateQueries({ queryKey: [/^\/api\/tickets\/.+/] }); 
    },
  });

  const [editingTicket, setEditingTicket] = useState<TicketData | null>(null);
  const [cloningTicket, setCloningTicket] = useState<TicketData | null>(null);
  const [addToTaskTicket, setAddToTaskTicket] = useState<TicketData | null>(null);

  const filtered = useMemo(() => {
    return tickets.filter(t => {
      const matchSearch = t.title.toLowerCase().includes(search.toLowerCase()) || 
                          t.ticketCode.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || t.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [tickets, search, statusFilter]);

  if (isLoading) {
    return (
      <Card className="w-full h-96 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground animate-pulse">Loading tickets...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-none shadow-sm shadow-primary/10">
      <div className="p-4 bg-background border-b flex flex-col sm:flex-row gap-4 justify-between items-center sm:items-center">
        <div className="relative w-full sm:w-80 group">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <Input 
            placeholder="Search by ID or title..." 
            className="pl-9 h-9" 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Open">Open</SelectItem>
              <SelectItem value="In Progress">In Progress</SelectItem>
              <SelectItem value="Resolved">Resolved</SelectItem>
              <SelectItem value="Closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="relative overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="w-[120px]">ID</TableHead>
              <TableHead>Ticket Information</TableHead>
              <TableHead className="hidden md:table-cell">Category</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden lg:table-cell">Raised Date</TableHead>
              {isAdminView && <TableHead>Assignee</TableHead>}
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdminView ? 8 : 7} className="h-64 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <Ticket className="h-12 w-12 mb-4 opacity-20" />
                    <p className="text-lg font-medium">No tickets found</p>
                    <p className="text-sm">Try adjusting your search or filters.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((t) => (
                <TableRow key={t.id} className="group hover:bg-muted/20 transition-colors">
                  <TableCell className="font-mono text-xs font-bold text-primary">{t.ticketCode}</TableCell>
                  <TableCell>
                    <div className="flex flex-col max-w-[300px]">
                      <span className="font-semibold truncate">{t.title}</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <UserIcon className="h-3 w-3" /> {t.createdByName}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant="outline" className="font-normal capitalize">{t.category}</Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Badge className={`${PRIORITY_COLORS[t.priority] || "bg-gray-500"} cursor-pointer hover:opacity-80 transition-opacity`}>
                          {t.priority}
                        </Badge>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {PRIORITIES.map(p => (
                          <DropdownMenuItem key={p} onClick={() => updateMutation.mutate({ id: t.id, data: { priority: p } })}>
                            {p}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Badge variant="outline" className={`${STATUS_COLORS[t.status]} px-2 py-0 h-6 cursor-pointer hover:bg-opacity-80 transition-all`}>
                          {t.status}
                        </Badge>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {Object.keys(STATUS_COLORS).map(s => (
                          <DropdownMenuItem key={s} onClick={() => updateMutation.mutate({ id: t.id, data: { status: s } })}>
                            {s}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {new Date(t.createdAt).toLocaleDateString()}
                  </TableCell>
                  {isAdminView && (
                    <TableCell>
                      {t.assignedToName ? (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-[10px]">{t.assignedToName[0]}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs truncate max-w-[100px]">{t.assignedToName}</span>
                          <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => updateMutation.mutate({ id: t.id, data: { assignedTo: null } })}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      ) : (
                        <AdminAssignSelect ticketId={t.id} employees={employees} />
                      )}
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => onView(t.id)} title="View Details">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      {t.taskId ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          onClick={() => {
                            sessionStorage.setItem("tasks_navigate_fresh", "1");
                            localStorage.setItem("tasks_searchQuery", t.title);
                            window.location.href = "/tasks";
                          }}
                          title="Go to Linked PMS Task"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" 
                          onClick={() => setAddToTaskTicket(t)} 
                          title="Add to PMS Task"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-purple-600 hover:text-purple-700 hover:bg-purple-50" onClick={() => setCloningTicket(t)} title="Clone Ticket">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50" onClick={() => setEditingTicket(t)} title="Edit Ticket">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => {
                        if (confirm("Are you sure you want to delete this ticket?")) {
                          deleteMutation.mutate(t.id);
                        }
                      }} title="Delete Ticket">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editingTicket} onOpenChange={(open) => !open && setEditingTicket(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Ticket: {editingTicket?.ticketCode}</DialogTitle>
            <DialogDescription>Modify ticket details and click save updates.</DialogDescription>
          </DialogHeader>
          {editingTicket && (
            <RaiseTicketForm 
              projects={projects}
              employees={employees}
              initialData={editingTicket}
              onSuccess={() => setEditingTicket(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!cloningTicket} onOpenChange={(open) => !open && setCloningTicket(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Clone Ticket: {cloningTicket?.ticketCode}</DialogTitle>
            <DialogDescription>Create a new ticket based on this one.</DialogDescription>
          </DialogHeader>
          {cloningTicket && (
            <RaiseTicketForm 
              projects={projects}
              employees={employees}
              initialData={cloningTicket}
              isClone={true}
              onSuccess={() => setCloningTicket(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!addToTaskTicket} onOpenChange={(open) => !open && setAddToTaskTicket(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-xl border-t-4 border-t-emerald-500 shadow-2xl glassmorphism">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
              <Plus className="h-5 w-5 text-emerald-500" />
              Add Ticket to PMS Task
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Create a project management task automatically from Ticket <strong>{addToTaskTicket?.ticketCode}</strong>.
            </DialogDescription>
          </DialogHeader>

          {addToTaskTicket && (
            <AddToTaskForm 
              ticket={addToTaskTicket} 
              projects={projects} 
              employees={employees} 
              onClose={() => setAddToTaskTicket(null)} 
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function AddToTaskForm({
  ticket,
  projects,
  employees,
  onClose
}: {
  ticket: TicketData,
  projects: any[],
  employees: any[],
  onClose: () => void
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedProjectId, setSelectedProjectId] = useState<string>(ticket.projectId || "");
  const [selectedKeyStepId, setSelectedKeyStepId] = useState<string>("");
  const [selectedAssignee, setSelectedAssignee] = useState<string>(ticket.assignedTo || "");
  const [dueDate, setDueDate] = useState<string>("");
  const [createAsSubtask, setCreateAsSubtask] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const filteredAndSortedProjects = useMemo(() => {
    if (!projects || projects.length === 0) return [];
    if (!user) return projects;

    const isAdmin = user.role?.toUpperCase() === 'ADMIN';
    const normalizeDept = (d: string) => {
      if (!d) return "";
      let norm = d.toLowerCase().trim();
      if (norm.includes("software")) return "software";
      if (norm.includes("hardware") || norm.includes("technician")) return "hardware";
      return norm;
    };

    const userDept = normalizeDept(user.department || "");
    const empId = user.employeeId;
    
    const validProjects = projects.filter(p => {
      const isAssigned = empId && (
        (p.team && p.team.includes(empId)) || 
        (p.taskAssignees && p.taskAssignees.includes(empId)) ||
        (p.createdByEmployeeId === empId)
      );
      
      const isDept = userDept && (p.departments || []).some((d: string) => normalizeDept(d) === userDept);
      
      return isAssigned || isDept || (p.createdByEmployeeId === user.id);
    });

    return validProjects.sort((a, b) => {
      if (isAdmin) return a.title.localeCompare(b.title);

      const aAssigned = empId && ((a.team && a.team.includes(empId)) || (a.createdByEmployeeId === empId)) ? 1 : 0;
      const bAssigned = empId && ((b.team && b.team.includes(empId)) || (b.createdByEmployeeId === empId)) ? 1 : 0;
      
      if (aAssigned !== bAssigned) return bAssigned - aAssigned;
      
      return (a.title || "").localeCompare(b.title || "");
    });
  }, [projects, user]);

  // Fetch KeySteps for selected project
  const { data: keySteps = [], isLoading: keyStepsLoading } = useQuery<any[]>({
    queryKey: [`/api/projects/${selectedProjectId}/key-steps`],
    queryFn: async () => {
      const res = await apiFetch(`/api/projects/${selectedProjectId}/key-steps`);
      if (!res.ok) throw new Error("Failed to fetch key steps");
      return res.json();
    },
    enabled: !!selectedProjectId && selectedProjectId !== "none",
  });

  const handleCreateTask = async () => {
    if (!selectedProjectId) {
      toast({ title: "Validation Error", description: "Please select a project.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    try {
      // 1. Create PMS Task
      const taskBody = {
        projectId: selectedProjectId,
        keyStepId: selectedKeyStepId || null,
        taskName: ticket.title,
        description: ticket.description,
        status: syncStatus ? (ticket.status === "Open" ? "pending" : "in-progress") : "pending",
        priority: ticket.priority.toLowerCase() === "critical" ? "high" : 
                  ticket.priority.toLowerCase() === "high" ? "high" : 
                  ticket.priority.toLowerCase() === "medium" ? "medium" : "low",
        startDate: new Date().toISOString(),
        endDate: dueDate || null,
        assignerId: user?.employeeId || null,
        taskMembers: selectedAssignee ? [selectedAssignee] : [],
        subtasks: createAsSubtask ? [{ title: ticket.title, description: ticket.description, assignedTo: selectedAssignee ? [selectedAssignee] : [] }] : [],
        ticketId: ticket.id,
      };

      const taskRes = await apiFetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskBody),
      });

      if (!taskRes.ok) {
        throw new Error("Failed to create PMS Task");
      }

      const task = await taskRes.json();

      // 2. Update Ticket with taskId and projectId
      const ticketRes = await apiFetch(`/api/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: task.id,
          projectId: selectedProjectId,
          status: syncStatus ? (ticket.status === "Resolved" || ticket.status === "Closed" ? ticket.status : "In Progress") : ticket.status,
        }),
      });

      if (!ticketRes.ok) {
        throw new Error("Failed to link Ticket to Task");
      }

      // 3. Create In-App Notification (pushing to localStorage)
      const savedNotifications = localStorage.getItem("pms_notifications");
      const currentNotifications = savedNotifications ? JSON.parse(savedNotifications) : [];
      const newNotification = {
        id: Date.now(),
        title: "Task Created from Ticket",
        message: `A new task "${ticket.title}" has been created from Ticket ${ticket.ticketCode} and linked to the project.`,
        time: "Just now",
        unread: true,
      };
      localStorage.setItem("pms_notifications", JSON.stringify([newNotification, ...currentNotifications]));
      window.dispatchEvent(new Event("pms-new-notification"));

      toast({
        title: "Success",
        description: `Task created and linked successfully to Ticket ${ticket.ticketCode}.`,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 py-4">
      {/* Search & Link Project */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Linked Project *</Label>
        {ticket.projectId && ticket.projectId !== "none" ? (
          // Project is LOCKED — auto-selected from the ticket
          <div className="flex items-center gap-2 h-9 border border-emerald-300 rounded-md px-3 bg-emerald-50/60 text-sm font-medium text-emerald-800">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            {projects.find(p => p.id === ticket.projectId)?.title || "Linked Project"}
            <span className="ml-auto text-[10px] text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full font-semibold">Auto-linked · Locked</span>
          </div>
        ) : (
          <SearchableSelect 
            options={filteredAndSortedProjects.map(p => ({ value: p.id, label: p.title }))}
            value={selectedProjectId}
            onValueChange={(v) => {
              setSelectedProjectId(v);
              setSelectedKeyStepId("");
            }}
            placeholder="Select a project..."
          />
        )}
      </div>

      {/* KeyStep Dropdown */}
      {selectedProjectId && (
        <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
          <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Key Step (Phase)</Label>
          {keyStepsLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground h-9 border rounded-md px-3 bg-muted/10">
              <div className="h-3.5 w-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Loading keysteps...
            </div>
          ) : keySteps.length === 0 ? (
            <div className="text-xs text-amber-600 h-9 border border-amber-200/50 rounded-md px-3 bg-amber-50/50 flex items-center">
              No keysteps found under this project.
            </div>
          ) : (
            <SearchableSelect 
              options={keySteps.map(ks => ({ value: ks.id, label: ks.title }))}
              value={selectedKeyStepId}
              onValueChange={setSelectedKeyStepId}
              placeholder="Select a keystep phase..."
            />
          )}
        </div>
      )}

      {/* Assign To */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Assign To</Label>
        <SearchableSelect 
          options={employees.map(emp => ({ value: emp.id, label: emp.name }))}
          value={selectedAssignee}
          onValueChange={setSelectedAssignee}
          placeholder="Select assignee..."
        />
      </div>

      {/* Due Date */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          Due Date (Optional)
        </Label>
        <Input 
          type="date" 
          value={dueDate} 
          onChange={e => setDueDate(e.target.value)} 
          className="w-full text-sm font-medium focus:ring-2 focus:ring-emerald-500/20"
        />
      </div>

      {/* Additional Options */}
      <div className="border border-border/80 rounded-xl p-4 bg-muted/15 space-y-4 shadow-inner">
        {/* Create as Subtask Checkbox */}
        <label className="flex items-start gap-3 cursor-pointer group select-none">
          <input 
            type="checkbox" 
            checked={createAsSubtask} 
            onChange={e => setCreateAsSubtask(e.target.checked)} 
            className="h-4.5 w-4.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 transition-all cursor-pointer mt-0.5"
          />
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground group-hover:text-emerald-700 transition-colors">Create as Subtask</span>
            <span className="text-xs text-muted-foreground">Automatically nest ticket as a subtask inside the created PMS Task.</span>
          </div>
        </label>

        <Separator />

        {/* Status Sync Checkbox */}
        <label className="flex items-start gap-3 cursor-pointer group select-none">
          <input 
            type="checkbox" 
            checked={syncStatus} 
            onChange={e => setSyncStatus(e.target.checked)} 
            className="h-4.5 w-4.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 transition-all cursor-pointer mt-0.5"
          />
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground group-hover:text-emerald-700 transition-colors">Two-Way Status Sync</span>
            <span className="text-xs text-muted-foreground">Keep the ticket status and task status fully synchronized in real-time.</span>
          </div>
        </label>
      </div>

      <DialogFooter className="pt-2">
        <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
        <Button 
          onClick={handleCreateTask} 
          disabled={isSubmitting || !selectedProjectId} 
          className="min-w-[140px] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-all shadow-md shadow-emerald-600/10"
        >
          {isSubmitting ? (
            <>
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Creating...
            </>
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />
              Create Task
            </>
          )}
        </Button>
      </DialogFooter>
    </div>
  );
}

function AdminAssignSelect({ ticketId, employees }: { ticketId: string, employees: any[] }) {
  const { toast } = useToast();
  const assignMutation = useMutation({
    mutationFn: async (empId: string) => {
      const res = await apiFetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedTo: empId, status: "In Progress" }),
      });
      if (!res.ok) throw new Error("Failed to assign ticket");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      toast({ title: "Ticket Assigned", description: "The ticket has been assigned successfully." });
    },
  });

  return (
    <Select onValueChange={v => assignMutation.mutate(v)}>
      <SelectTrigger className="w-[130px] h-8 text-xs bg-muted/50">
        <SelectValue placeholder="Assign To" />
      </SelectTrigger>
      <SelectContent>
        {employees.map(e => <SelectItem key={e.id} value={e.id} className="text-xs">{e.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function TicketDetailView({ id, onBack }: { id: string, onBack: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comment, setComment] = useState("");
  const isAdmin = user?.role === "ADMIN";

  const { data: ticket, isLoading } = useQuery<TicketData & { comments: CommentData[], attachments: AttachmentData[] }>({
    queryKey: [`/api/tickets/${id}`],
  });

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["/api/employees"],
  });

  const commentMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiFetch(`/api/tickets/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Failed to add comment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tickets/${id}`] });
      setComment("");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiFetch(`/api/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onMutate: async (newData) => {
      // Cancel refetches
      await queryClient.cancelQueries({ queryKey: [`/api/tickets/${id}`] });
      await queryClient.cancelQueries({ queryKey: ["/api/tickets"] });

      // Snapshot previous
      const previousTicket = queryClient.getQueryData([`/api/tickets/${id}`]);

      // Optimistic update
      queryClient.setQueryData([`/api/tickets/${id}`], (old: any) => ({
        ...old,
        ...newData
      }));

      return { previousTicket };
    },
    onError: (err, newData, context) => {
      if (context?.previousTicket) {
        queryClient.setQueryData([`/api/tickets/${id}`], context.previousTicket);
      }
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tickets/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
    },
  });

  if (isLoading || !ticket) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground animate-pulse text-sm">Loading details...</p>
        </div>
      </div>
    );
  }

  const isOwner = ticket.createdBy === user?.employeeId;
  const isAssigned = ticket.assignedTo === user?.employeeId;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" onClick={onBack} className="group">
        <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" /> Back to List
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Ticket Info */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-lg border-none hover-glass transition-all overflow-hidden">
            <div className="p-1 bg-gradient-to-r from-primary/40 via-primary/20 to-transparent" />
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">{ticket.ticketCode}</span>
                    <Badge className={PRIORITY_COLORS[ticket.priority]}>{ticket.priority}</Badge>
                  </div>
                  <CardTitle className="text-2xl pt-2">{ticket.title}</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  {(isAdmin || isOwner || isAssigned) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className={`${STATUS_COLORS[ticket.status]} border-none`}>
                          {ticket.status} <ChevronRight className="ml-2 h-4 w-4 rotate-90" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => updateMutation.mutate({ status: "Open" })}>Open</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateMutation.mutate({ status: "In Progress" })}>In Progress</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateMutation.mutate({ status: "Resolved" })}>Resolved</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateMutation.mutate({ status: "Closed" })}>Closed</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  {isOwner && ticket.status === "Closed" && (
                    <Button variant="outline" size="sm" onClick={() => updateMutation.mutate({ status: "Open" })}>
                      Reopen Ticket
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground pb-4 border-b">
                <div className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /> Created {new Date(ticket.createdAt).toLocaleString()}</div>
                <div className="flex items-center gap-1.5"><Tag className="h-4 w-4" /> {ticket.category}</div>
                <div className="flex items-center gap-1.5"><Building2 className="h-4 w-4" /> {ticket.department}</div>
                {ticket.companyName && <div className="flex items-center gap-1.5 text-amber-600"><Building2 className="h-4 w-4" /> Company: {ticket.companyName}</div>}
                {ticket.projectName && <div className="flex items-center gap-1.5 text-primary"><FileText className="h-4 w-4" /> Project: {ticket.projectName}</div>}
              </div>

              <div className="prose prose-sm max-w-none pt-4">
                <p className="whitespace-pre-wrap leading-relaxed text-foreground/80">{ticket.description}</p>
              </div>

              {ticket.attachments && ticket.attachments.length > 0 && (
                <div className="mt-8">
                  <h4 className="flex items-center gap-2 text-sm font-semibold mb-3"><Paperclip className="h-4 w-4" /> Attachments ({ticket.attachments.length})</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    {ticket.attachments?.map((att) => {
                      const isAudio = att.mimeType?.startsWith("audio/") || att.fileName.endsWith(".webm") || att.fileName.endsWith(".mp3");
                      
                      if (isAudio) {
                        return (
                          <div key={att.id} className="p-4 border rounded-xl bg-primary/5 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                                <Mic className="h-3 w-3" /> Voice Note
                              </span>
                              <a href={att.storageUrl} download={att.fileName} className="text-muted-foreground hover:text-primary transition-colors">
                                <Download className="h-4 w-4" />
                              </a>
                            </div>
                            <audio src={att.storageUrl} controls className="w-full h-10" />
                          </div>
                        );
                      }

                      return (
                        <div key={att.id} className="flex items-center justify-between p-3 border rounded-xl hover:bg-muted/30 transition-colors group">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="p-2 bg-muted rounded-lg text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                              <Paperclip className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col overflow-hidden">
                              <span className="text-sm font-medium truncate">{att.fileName}</span>
                              <span className="text-[10px] text-muted-foreground">{(att.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <a href={att.storageUrl} target="_blank" rel="noreferrer">
                              <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary">
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </a>
                            <a href={att.storageUrl} download={att.fileName}>
                              <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary">
                                <Download className="h-4 w-4" />
                              </Button>
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Chat style comments */}
          <Card className="shadow-lg border-none glassmorphism overflow-hidden">
            <CardHeader className="py-4 border-b bg-muted/20">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Comments & Discussion
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px] p-6">
                <div className="space-y-6">
                  {ticket.comments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                      <MessageSquare className="h-10 w-10 opacity-20 mb-2" />
                      <p className="text-sm italic">No comments yet. Start the conversation!</p>
                    </div>
                  ) : (
                    ticket.comments.map((c, i) => {
                      const isMe = c.createdBy === user?.employeeId;
                      return (
                        <div key={c.id} className={`flex gap-4 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                          <Avatar className={`mt-1 h-9 w-9 border-2 ${isMe ? "border-primary/20" : "border-muted"}`}>
                            <AvatarFallback className={isMe ? "bg-primary text-primary-foreground" : "bg-muted"}>
                              {c.createdByName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className={`flex flex-col space-y-1.5 max-w-[80%] ${isMe ? "items-end" : "items-start"}`}>
                            <div className="flex items-center gap-2 px-1">
                              <span className="text-xs font-bold">{c.createdByName}</span>
                              <span className="text-[10px] text-muted-foreground">{new Date(c.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                            </div>
                            <div className={`p-4 rounded-2xl shadow-sm text-sm ${
                              isMe 
                                ? "bg-primary text-primary-foreground rounded-tr-none" 
                                : "bg-muted/50 border rounded-tl-none"
                            }`}>
                              {c.content}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </CardContent>
            <CardFooter className="p-4 border-t bg-muted/10">
              <div className="flex w-full gap-3 items-end">
                <div className="flex-1 relative">
                  <Textarea 
                    placeholder="Type your message..." 
                    className="min-h-[60px] max-h-[120px] resize-none pr-12 transition-all focus:ring-2 focus:ring-primary/20 bg-background"
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (comment.trim()) commentMutation.mutate(comment);
                      }
                    }}
                  />
                </div>
                <Button 
                  size="icon" 
                  disabled={!comment.trim() || commentMutation.isPending} 
                  onClick={() => commentMutation.mutate(comment)}
                  className="h-[60px] w-12 rounded-xl transition-all active:scale-95"
                >
                  <Send className={`h-5 w-5 ${comment.trim() ? "animate-pulse" : "opacity-50"}`} />
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>

        {/* Right Column: Actions & Meta */}
        <div className="space-y-6">
          <Card className="shadow-lg border-none bg-primary/5 border-l-4 border-l-primary overflow-hidden">
            <CardHeader className="pb-3 px-4 pt-4">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-primary/70">Action Center</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-6">
              {isAdmin && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Assign Agent</Label>
                    <Select value={ticket.assignedTo || ""} onValueChange={v => updateMutation.mutate({ assignedTo: v, status: ticket.status === "Open" ? "In Progress" : ticket.status })}>
                      <SelectTrigger className="glassmorphism-light">
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Priority Level</Label>
                    <Select value={ticket.priority} onValueChange={v => updateMutation.mutate({ priority: v })}>
                      <SelectTrigger className="glassmorphism-light">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <Separator className="bg-primary/10" />

              <div className="space-y-4 pt-2">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-70">Raised By</span>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7 ring-2 ring-primary/10 ring-offset-1">
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{ticket.createdByName[0]}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{ticket.createdByName}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-70">Handled By</span>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7 ring-2 ring-blue-500/10 ring-offset-1">
                      <AvatarFallback className="text-[10px] bg-blue-50 text-blue-600">
                        {ticket.assignedToName ? ticket.assignedToName[0] : "?"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{ticket.assignedToName || <span className="text-muted-foreground italic">Not assigned</span>}</span>
                  </div>
                </div>

                {ticket.taskId && (
                  <div className="flex flex-col gap-1.5 pt-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-70">Linked PMS Task</span>
                    <Button
                      variant="outline"
                      className="w-full text-xs h-9 gap-2 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 transition-all font-semibold justify-start px-3"
                      onClick={() => {
                        sessionStorage.setItem("tasks_navigate_fresh", "1");
                        localStorage.setItem("tasks_searchQuery", ticket.title);
                        window.location.href = "/tasks";
                      }}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      View Linked Task
                    </Button>
                  </div>
                )}

                {ticket.participants && ticket.participants.length > 0 && (
                  <div className="flex flex-col gap-2 pt-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-70">Participants</span>
                    <div className="flex flex-wrap gap-2">
                      {ticket.participants.map(pId => {
                        const emp = employees.find((e: any) => e.id === pId);
                        return (
                          <div key={pId} className="flex items-center gap-1.5 bg-background border rounded-full pl-1 pr-2 py-0.5" title={emp?.name}>
                            <Avatar className="h-5 w-5">
                              <AvatarFallback className="text-[8px]">{emp?.name ? emp.name[0] : "?"}</AvatarFallback>
                            </Avatar>
                            <span className="text-[10px] font-medium truncate max-w-[80px]">{emp?.name || "Member"}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4">
                <Button variant="outline" className="w-full text-xs h-9 gap-2 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all">
                  <AlertCircle className="h-3.5 w-3.5" /> Report Issue
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-none glassmorphism">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                Ticket History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-0 before:w-0.5 before:bg-muted">
                <div className="relative">
                  <div className="absolute -left-[23px] mt-1.5 h-3.5 w-3.5 rounded-full border-2 border-primary bg-background shadow-sm" />
                  <div className="space-y-0.5 text-xs">
                    <p className="font-bold">Ticket Created</p>
                    <p className="text-muted-foreground">{new Date(ticket.createdAt).toLocaleString()}</p>
                    <p className="text-primary font-medium mt-1">Status: Open</p>
                  </div>
                </div>
                {ticket.assignedTo && (
                  <div className="relative">
                    <div className="absolute -left-[23px] mt-1.5 h-3.5 w-3.5 rounded-full border-2 border-blue-500 bg-background shadow-sm" />
                    <div className="space-y-0.5 text-xs">
                      <p className="font-bold">Ticket Assigned</p>
                      <p className="text-muted-foreground">Assigned to {ticket.assignedToName}</p>
                    </div>
                  </div>
                )}
                <div className="relative">
                  <div className="absolute -left-[23px] mt-1.5 h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/30 bg-background shadow-sm" />
                  <div className="space-y-0.5 text-xs">
                    <p className="font-bold">Last Update</p>
                    <p className="text-muted-foreground">{new Date(ticket.updatedAt).toLocaleString()}</p>
                    <p className="font-medium mt-1">Current Status: <span className="text-primary">{ticket.status}</span></p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
