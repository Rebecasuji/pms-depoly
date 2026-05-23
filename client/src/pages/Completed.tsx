import { useState, useEffect } from "react";
import { useAuth } from "@/components/Layout";
import { apiFetch } from "@/lib/apiClient";
import {
    CheckCircle2,
    Calendar,
    User,
    Search,
    Filter,
    ArrowRight,
    TrendingUp,
    Folder,
    Layers,
    CheckSquare,
    Maximize2,
    ListChecks,
    RotateCcw,
    AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from "@/components/ui/tabs";
import { formatDate } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/* ---------------- TYPES ---------------- */

interface CompletedItem {
    id: string;
    name: string;
    relatedItem?: string;
    subRelatedItem?: string; // for subtasks: parent task name
    assignedUser?: string;
    assignedUserAvatar?: string;
    completionDate: string;
    department?: string;
    type: "Project" | "Key Step" | "Task" | "Subtask";
    raw: any;
}

/* ---------------- COMPONENT ---------------- */

export default function Completed() {
    const { user } = useAuth();

    const [completedProjects, setCompletedProjects] = useState<CompletedItem[]>([]);
    const [completedKeySteps, setCompletedKeySteps] = useState<CompletedItem[]>([]);
    const [completedTasks, setCompletedTasks] = useState<CompletedItem[]>([]);
    const [completedSubtasks, setCompletedSubtasks] = useState<CompletedItem[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [projectSearch, setProjectSearch] = useState("");
    const [keystepSearch, setKeystepSearch] = useState("");
    const [taskSearch, setTaskSearch] = useState("");
    const [subtaskSearch, setSubtaskSearch] = useState("");
    const [selectedItem, setSelectedItem] = useState<CompletedItem | null>(null);
    const [detailedItemInfo, setDetailedItemInfo] = useState<any>(null);
    const [isDetailsLoading, setIsDetailsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    async function fetchData() {
        if (!isRefreshing) setIsRefreshing(true);
        try {
            const [empRes, projRes, compProjRes, compTaskRes, compKSRes] = await Promise.all([
                apiFetch("/api/employees"),
                apiFetch("/api/projects?status=all"),
                apiFetch("/api/projects?status=Completed"),
                apiFetch("/api/tasks/bulk?status=Completed"),
                apiFetch("/api/keysteps/bulk?status=Completed"),
            ]);

            const emps: any[] = await empRes.json();
            const allProjs: any[] = await projRes.json();
            const cProjs: any[] = await compProjRes.json();
            const cTasks: any[] = await compTaskRes.json();
            const cKS: any[] = await compKSRes.json();


            setEmployees(emps);
            setProjects(allProjs);

            const empMap = new Map<string, any>(emps.map((e: any) => [e.id, e]));
            const projMap = new Map<string, any>(allProjs.map((p: any) => [p.id, p]));

            // Format Projects
            setCompletedProjects(cProjs.map((p: any) => ({
                id: p.id,
                name: p.title,
                relatedItem: p.clientName || "N/A",
                assignedUser: empMap.get(p.createdByEmployeeId)?.name || "Admin",
                completionDate: p.completedAt,
                department: p.department || "General",
                type: "Project",
                raw: p
            })));

            // Format Tasks
            setCompletedTasks(cTasks.map((t: any) => ({
                id: t.id,
                name: t.taskName,
                relatedItem: projMap.get(t.projectId)?.title || "Unknown Project",
                assignedUser: t.assignedMembers?.length > 0
                    ? empMap.get(t.assignedMembers[0])?.name + (t.assignedMembers.length > 1 ? ` +${t.assignedMembers.length - 1}` : "")
                    : "Unassigned",
                completionDate: t.completedAt,
                department: t.department || "General",
                type: "Task",
                raw: t
            })));

            // Format Key Steps
            setCompletedKeySteps(cKS.map((ks: any) => ({
                id: ks.id,
                name: ks.title,
                relatedItem: projMap.get(ks.projectId)?.title || "Unknown Project",
                assignedUser: "Project Team",
                completionDate: ks.completedAt,
                department: "Engineering",
                type: "Key Step",
                raw: ks
            })));

        } catch (error) {
            console.error("Failed to fetch completed items:", error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }

    // Fetch completed subtasks separately (different response shape)
    async function fetchSubtasks() {
        try {
            const res = await apiFetch("/api/subtasks/completed/bulk");
            if (!res.ok) return;
            const data: any[] = await res.json();
            if (!Array.isArray(data)) return;
            setCompletedSubtasks(data.map((s: any) => ({
                id: s.id,
                name: s.title,
                relatedItem: s.projectTitle || "Unknown Project",
                subRelatedItem: s.taskName || "Unknown Task",
                assignedUser: s.assignedTo || "Unassigned",
                completionDate: s.updatedAt || s.createdAt,
                department: "General",
                type: "Subtask",
                raw: s,
            })));
        } catch (e) {
            console.error("Failed to fetch completed subtasks:", e);
        }
    }

    useEffect(() => {
        fetchData();
        fetchSubtasks();
    }, []);

    const handleReopenSubtask = async (subtaskId: string) => {
        // Optimistic: remove from list immediately
        setCompletedSubtasks(prev => prev.filter(s => s.id !== subtaskId));
        try {
            const res = await apiFetch(`/api/subtasks/${subtaskId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isCompleted: false, progress: 0 }),
            });
            if (!res.ok) {
                // Revert optimistic update by re-fetching
                const reRes = await apiFetch("/api/subtasks/completed/bulk");
                if (reRes.ok) {
                    const data: any[] = await reRes.json();
                    if (Array.isArray(data)) {
                        setCompletedSubtasks(data.map((s: any) => ({
                            id: s.id,
                            name: s.title,
                            relatedItem: s.projectTitle || "Unknown Project",
                            subRelatedItem: s.taskName || "Unknown Task",
                            assignedUser: s.assignedTo || "Unassigned",
                            completionDate: s.updatedAt || s.createdAt,
                            department: "General",
                            type: "Subtask",
                            raw: s,
                        })));
                    }
                }
                console.error("Failed to reopen subtask");
            }
        } catch (e) {
            console.error("Reopen subtask error:", e);
        }
    };

    const handleReopenTask = async (taskId: string) => {
        // Optimistic: remove from list immediately
        setCompletedTasks(prev => prev.filter(t => t.id !== taskId));
        try {
            const res = await apiFetch(`/api/tasks/${taskId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "pending", progress: 0 }),
            });
            if (!res.ok) {
                // Revert optimistic update by re-fetching
                fetchData();
                console.error("Failed to reopen task");
            }
        } catch (e) {
            console.error("Reopen task error:", e);
        }
    };

    const handleReopenProject = async (projectId: string) => {
        // Optimistic
        setCompletedProjects(prev => prev.filter(p => p.id !== projectId));
        try {
            const res = await apiFetch(`/api/projects/${projectId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "In Progress", progress: 0 }),
            });
            if (!res.ok) {
                fetchData();
                console.error("Failed to reopen project");
            } else {
                // Cascading updates in backend might affect tasks/keysteps too
                fetchData();
                fetchSubtasks();
            }
        } catch (e) {
            console.error("Reopen project error:", e);
        }
    };

    const handleReopenKeyStep = async (ksId: string) => {
        // Optimistic
        setCompletedKeySteps(prev => prev.filter(ks => ks.id !== ksId));
        try {
            const res = await apiFetch(`/api/key-steps/${ksId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "in-progress", progress: 0 }),
            });
            if (!res.ok) {
                fetchData();
                console.error("Failed to reopen key step");
            } else {
                // Cascading updates in backend
                fetchData();
                fetchSubtasks();
            }
        } catch (e) {
            console.error("Reopen key step error:", e);
        }
    };

    const handleItemClick = async (item: CompletedItem) => {
        setSelectedItem(item);
        setDetailedItemInfo(item.raw);
    };

    const filterItems = (items: CompletedItem[], query: string) => {
        const q = query.toLowerCase().trim();
        return items.filter(item =>
            !q ||
            item.name.toLowerCase().includes(q) ||
            item.relatedItem?.toLowerCase().includes(q) ||
            item.subRelatedItem?.toLowerCase().includes(q)
        ).sort((a, b) => new Date(b.completionDate).getTime() - new Date(a.completionDate).getTime());
    };

    const totalCompleted = completedProjects.length + completedKeySteps.length + completedTasks.length + completedSubtasks.length;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* HEADER SECTION */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-6 w-6 text-green-500" />
                        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Completed Archive</h1>
                    </div>
                    <p className="text-slate-500 font-bold text-lg">Historical record of all finalized projects, tasks and subtasks</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="bg-green-50 px-4 py-2 rounded-lg border border-green-100 items-center flex gap-3">
                        <div className="p-2 bg-green-500 rounded-full">
                            <TrendingUp className="h-4 w-4 text-white" />
                        </div>
                        <div>
                            <p className="text-xs text-green-700 font-bold uppercase tracking-wider">Total Finalized</p>
                            <p className="text-2xl font-black text-green-900">{totalCompleted}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* TABS SECTION */}
            <Tabs defaultValue="projects" className="w-full">
                <TabsList className="grid w-full max-w-2xl grid-cols-4 mb-6 bg-slate-100 p-1">
                    <TabsTrigger value="projects" className="font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        Projects ({completedProjects.length})
                    </TabsTrigger>
                    <TabsTrigger value="keysteps" className="font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        Key Steps ({completedKeySteps.length})
                    </TabsTrigger>
                    <TabsTrigger value="tasks" className="font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        Tasks ({completedTasks.length})
                    </TabsTrigger>
                    <TabsTrigger value="subtasks" className="font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        Subtasks ({completedSubtasks.length})
                    </TabsTrigger>
                </TabsList>

                {/* PROJECTS TAB */}
                <TabsContent value="projects" className="mt-0">
                    <Card className="border-slate-200 overflow-hidden shadow-sm">
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-3">
                            <div className="flex items-center justify-between gap-4">
                                <CardTitle className="text-sm font-bold flex items-center gap-2">
                                    <Folder className="h-4 w-4 text-blue-500" />
                                    Completed Projects
                                    <span className="text-xs font-normal text-slate-400">({filterItems(completedProjects, projectSearch).length})</span>
                                </CardTitle>
                                <div className="relative w-56">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                    <Input
                                        placeholder="Search projects..."
                                        className="pl-8 h-8 text-xs bg-white border-slate-200 focus:border-blue-300 rounded-lg"
                                        value={projectSearch}
                                        onChange={(e) => setProjectSearch(e.target.value)}
                                    />
                                </div>
                            </div>
                        </CardHeader>
                        <ScrollArea className="h-[calc(100vh-360px)] w-full rounded-md border bg-white">
                            <div className="min-w-[1000px]">
                                <div className="divide-y divide-slate-100">
                                    {isLoading ? (
                                        <LoadingSpinner color="blue" label="Loading projects..." />
                                    ) : filterItems(completedProjects, projectSearch).length === 0 ? (
                                        <EmptyState icon={<Folder className="h-8 w-8 mx-auto mb-2 opacity-20" />} label={projectSearch ? `No projects match "${projectSearch}"` : "No completed projects found"} />
                                    ) : (
                                        filterItems(completedProjects, projectSearch).map(item => (
                                            <CompletedTableRow 
                                                key={item.id} 
                                                item={item} 
                                                onClick={() => handleItemClick(item)} 
                                                onReopen={() => handleReopenProject(item.id)}
                                            />
                                        ))
                                    )}
                                </div>
                            </div>
                        </ScrollArea>
                    </Card>
                </TabsContent>

                {/* KEY STEPS TAB */}
                <TabsContent value="keysteps" className="mt-0">
                    <Card className="border-slate-200 overflow-hidden shadow-sm">
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-3">
                            <div className="flex items-center justify-between gap-4">
                                <CardTitle className="text-sm font-bold flex items-center gap-2">
                                    <Layers className="h-4 w-4 text-amber-500" />
                                    Completed Key Steps
                                    <span className="text-xs font-normal text-slate-400">({filterItems(completedKeySteps, keystepSearch).length})</span>
                                </CardTitle>
                                <div className="relative w-56">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                    <Input
                                        placeholder="Search key steps..."
                                        className="pl-8 h-8 text-xs bg-white border-slate-200 focus:border-amber-300 rounded-lg"
                                        value={keystepSearch}
                                        onChange={(e) => setKeystepSearch(e.target.value)}
                                    />
                                </div>
                            </div>
                        </CardHeader>
                        <ScrollArea className="h-[calc(100vh-360px)] w-full rounded-md border bg-white">
                            <div className="min-w-[1000px]">
                                <div className="divide-y divide-slate-100">
                                    {isLoading ? (
                                        <LoadingSpinner color="amber" label="Loading key steps..." />
                                    ) : filterItems(completedKeySteps, keystepSearch).length === 0 ? (
                                        <EmptyState icon={<Layers className="h-8 w-8 mx-auto mb-2 opacity-20" />} label={keystepSearch ? `No key steps match "${keystepSearch}"` : "No completed key steps"} />
                                    ) : (
                                        filterItems(completedKeySteps, keystepSearch).map(item => (
                                            <CompletedTableRow 
                                                key={item.id} 
                                                item={item} 
                                                onClick={() => handleItemClick(item)} 
                                                onReopen={() => handleReopenKeyStep(item.id)}
                                            />
                                        ))
                                    )}
                                </div>
                            </div>
                        </ScrollArea>
                    </Card>
                </TabsContent>

                {/* TASKS TAB */}
                <TabsContent value="tasks" className="mt-0">
                    <Card className="border-slate-200 overflow-hidden shadow-sm">
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-3">
                            <div className="flex items-center justify-between gap-4">
                                <CardTitle className="text-sm font-bold flex items-center gap-2">
                                    <CheckSquare className="h-4 w-4 text-indigo-500" />
                                    Completed Tasks
                                    <span className="text-xs font-normal text-slate-400">({filterItems(completedTasks, taskSearch).length})</span>
                                </CardTitle>
                                <div className="relative w-56">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                    <Input
                                        placeholder="Search tasks..."
                                        className="pl-8 h-8 text-xs bg-white border-slate-200 focus:border-indigo-300 rounded-lg"
                                        value={taskSearch}
                                        onChange={(e) => setTaskSearch(e.target.value)}
                                    />
                                </div>
                            </div>
                        </CardHeader>
                        <ScrollArea className="h-[calc(100vh-360px)] w-full rounded-md border bg-white">
                            <div className="min-w-[1000px]">
                                <div className="divide-y divide-slate-100">
                                    {isLoading ? (
                                        <LoadingSpinner color="indigo" label="Loading tasks..." />
                                    ) : filterItems(completedTasks, taskSearch).length === 0 ? (
                                        <EmptyState icon={<CheckSquare className="h-8 w-8 mx-auto mb-2 opacity-20" />} label={taskSearch ? `No tasks match "${taskSearch}"` : "No completed tasks yet"} />
                                    ) : (
                                        filterItems(completedTasks, taskSearch).map(item => (
                                            <CompletedTableRow 
                                                key={item.id} 
                                                item={item} 
                                                onClick={() => handleItemClick(item)} 
                                                onReopen={() => handleReopenTask(item.id)}
                                            />
                                        ))
                                    )}
                                </div>
                            </div>
                        </ScrollArea>
                    </Card>
                </TabsContent>

                {/* SUBTASKS TAB */}
                <TabsContent value="subtasks" className="mt-0">
                    <Card className="border-slate-200 overflow-hidden shadow-sm">
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-3">
                            <div className="flex items-center justify-between gap-4">
                                <CardTitle className="text-sm font-bold flex items-center gap-2">
                                    <ListChecks className="h-4 w-4 text-emerald-500" />
                                    Completed Subtasks
                                    <span className="text-xs font-normal text-slate-400">({filterItems(completedSubtasks, subtaskSearch).length})</span>
                                </CardTitle>
                                <div className="relative w-56">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                    <Input
                                        placeholder="Search subtasks..."
                                        className="pl-8 h-8 text-xs bg-white border-slate-200 focus:border-emerald-300 rounded-lg"
                                        value={subtaskSearch}
                                        onChange={(e) => setSubtaskSearch(e.target.value)}
                                    />
                                </div>
                            </div>
                        </CardHeader>
                        <ScrollArea className="h-[calc(100vh-360px)] w-full rounded-md border bg-white">
                            <div className="min-w-[1000px]">
                                <div className="divide-y divide-slate-100">
                                    {isLoading ? (
                                        <LoadingSpinner color="emerald" label="Loading subtasks..." />
                                    ) : filterItems(completedSubtasks, subtaskSearch).length === 0 ? (
                                        <EmptyState icon={<ListChecks className="h-8 w-8 mx-auto mb-2 opacity-20" />} label={subtaskSearch ? `No subtasks match "${subtaskSearch}"` : "No completed subtasks yet"} />
                                    ) : (
                                        filterItems(completedSubtasks, subtaskSearch).map(item => (
                                            <SubtaskCompletedRow
                                                key={item.id}
                                                item={item}
                                                onClick={() => handleItemClick(item)}
                                                onReopen={() => handleReopenSubtask(item.id)}
                                            />
                                        ))
                                    )}
                                </div>
                            </div>
                        </ScrollArea>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* DETAILS DIALOG */}
            <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <div className="flex items-center gap-2 mb-2">
                            <Badge className={
                                selectedItem?.type === "Project" ? "bg-blue-500" :
                                    selectedItem?.type === "Key Step" ? "bg-amber-500" :
                                        selectedItem?.type === "Subtask" ? "bg-emerald-500" :
                                            "bg-indigo-500"
                            }>
                                {selectedItem?.type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">Archive Record #{selectedItem?.id.slice(0, 8)}</span>
                        </div>
                        <DialogTitle className="text-2xl font-bold">{selectedItem?.name}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground uppercase font-bold">
                                    {selectedItem?.type === 'Project' ? 'Client' : selectedItem?.type === 'Subtask' ? 'Project' : 'Project'}
                                </Label>
                                <p className="font-semibold text-slate-700">{selectedItem?.relatedItem}</p>
                            </div>
                            {selectedItem?.type === 'Subtask' && selectedItem?.subRelatedItem && (
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground uppercase font-bold">Parent Task</Label>
                                    <p className="font-semibold text-slate-700 flex items-center gap-1">
                                        <CheckSquare className="h-3.5 w-3.5 text-indigo-400" />
                                        {selectedItem.subRelatedItem}
                                    </p>
                                </div>
                            )}
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground uppercase font-bold">Completion Date</Label>
                                <div className="flex items-center gap-1.5 font-semibold text-green-600">
                                    <CheckCircle2 className="h-4 w-4" />
                                    {selectedItem && formatDate(selectedItem.completionDate)}
                                </div>
                            </div>
                        </div>

                        <Separator />

                        <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground uppercase font-bold">Description</Label>
                            <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-100 italic">
                                {detailedItemInfo?.description || "No description provided for this item."}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground uppercase font-bold">Assigned To</Label>
                                <div className="flex items-center gap-2">
                                    <Avatar className="h-8 w-8">
                                        <AvatarFallback>{selectedItem?.assignedUser?.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm font-medium">{selectedItem?.assignedUser}</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground uppercase font-bold">Timeline</Label>
                                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                    <Calendar className="h-3.5 w-3.5" />
                                    <span>Started: {detailedItemInfo?.startDate ? formatDate(detailedItemInfo.startDate) : "N/A"}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                    <Calendar className="h-3.5 w-3.5" />
                                    <span>Target End: {detailedItemInfo?.endDate ? formatDate(detailedItemInfo.endDate) : "N/A"}</span>
                                </div>
                            </div>
                        </div>

                        {selectedItem?.type === "Project" && detailedItemInfo && (
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground uppercase font-bold">Project Details</Label>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-slate-50 p-2 rounded border text-center">
                                        <p className="text-[10px] text-muted-foreground uppercase">Code</p>
                                        <p className="text-xs font-bold">{detailedItemInfo.projectCode}</p>
                                    </div>
                                    <div className="bg-slate-50 p-2 rounded border text-center">
                                        <p className="text-[10px] text-muted-foreground uppercase">Status</p>
                                        <p className="text-xs font-bold text-green-600">Finalized</p>
                                    </div>
                                    <div className="bg-slate-50 p-2 rounded border text-center">
                                        <p className="text-[10px] text-muted-foreground uppercase">Progress</p>
                                        <p className="text-xs font-bold">100%</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

/* ---------------- SHARED SUB-COMPONENTS ---------------- */

function LoadingSpinner({ color, label }: { color: string; label: string }) {
    return (
        <div className="flex flex-col items-center justify-center h-40 text-slate-400">
            <div className={`animate-spin rounded-full h-8 w-8 border-b-2 border-${color}-500 mb-2`}></div>
            <p className="text-sm">{label}</p>
        </div>
    );
}

function EmptyState({ icon, label }: { icon: React.ReactNode; label: string }) {
    return (
        <div className="text-center py-12 text-slate-400">
            {icon}
            <p className="text-sm">{label}</p>
        </div>
    );
}

function CompletedTableRow({ item, onClick, onReopen }: { item: CompletedItem, onClick: () => void, onReopen?: () => void }) {
    const [reopening, setReopening] = useState(false);

    const handleReopen = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!onReopen) return;
        setReopening(true);
        await onReopen();
        setReopening(false);
    };

    return (
        <div
            onClick={onClick}
            className="grid grid-cols-[1fr_120px_100px_120px_130px] items-center gap-4 px-6 py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer group"
        >
            {/* Title & Project Info */}
            <div className="flex items-center gap-4 min-w-0">
                <div className="p-2 rounded-lg bg-slate-100 text-slate-500 flex-shrink-0">
                    {item.type === "Project" ? <Folder size={20} /> :
                        item.type === "Key Step" ? <Layers size={20} /> :
                            <CheckSquare size={20} />}
                </div>
                <div className="min-w-0">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <p className="font-bold text-slate-900 text-base truncate cursor-default">{item.name}</p>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{item.name}</p>
                        </TooltipContent>
                    </Tooltip>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">Project</span>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <p className="text-[13px] font-bold text-slate-500 truncate cursor-default">{item.relatedItem}</p>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{item.relatedItem}</p>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                </div>
            </div>

            {/* Department */}
            <div className="flex justify-center">
                <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 font-black text-[10px] py-1 px-3">
                    {item.department || "General"}
                </Badge>
            </div>

            {/* Assigned User */}
            <div className="flex justify-center">
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black uppercase tracking-tight">
                    {item.assignedUser?.split(" ")[0]}
                </div>
            </div>

            {/* Status & Date */}
            <div className="flex flex-col items-center">
                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none font-black text-[9px] px-2 h-5 mb-1 flex items-center gap-1">
                    <CheckCircle2 size={10} />
                    {item.type === "Project" ? "FINALIZED" : item.type === "Key Step" ? "CLOSED" : "RELEASED"}
                </Badge>
                <div className="flex items-center gap-1 text-slate-600 font-bold text-xs">
                    <Calendar size={12} className="text-slate-400" />
                    {formatDate(item.completionDate)}
                </div>
            </div>

             {/* Reopen Action */}
            <div className="flex justify-end pr-2">
                {onReopen && (
                    <button
                        onClick={handleReopen}
                        disabled={reopening}
                        title={`Reopen — mark this ${item.type.toLowerCase()} and its related items as pending`}
                        className={`group/btn relative flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-black transition-all ${
                            item.type === "Project" ? "bg-blue-500 hover:bg-blue-600 shadow-blue-200" :
                            item.type === "Key Step" ? "bg-amber-500 hover:bg-amber-600 shadow-amber-200" :
                            "bg-indigo-500 hover:bg-indigo-600 shadow-indigo-200"
                        } text-white active:scale-95 shadow-md disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden w-[110px]`}
                    >
                        {reopening ? (
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <>
                                <RotateCcw size={14} className="group-hover/btn:rotate-[-180deg] transition-transform duration-500" />
                                <span>REOPEN</span>
                            </>
                        )}
                    </button>
                )}
            </div>

        </div>
    );
}

function SubtaskCompletedRow({ item, onClick, onReopen }: { item: CompletedItem; onClick: () => void; onReopen: () => void }) {
    const [reopening, setReopening] = useState(false);

    const handleReopen = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setReopening(true);
        await onReopen();
        setReopening(false);
    };

    return (
        <div
            onClick={onClick}
            className="grid items-center px-4 py-3 hover:bg-emerald-50/40 transition-colors cursor-pointer border-b border-slate-100"
            style={{ gridTemplateColumns: "40px 1fr auto" }}
        >
            {/* Icon */}
            <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-600 w-8 h-8 flex items-center justify-center">
                <CheckCircle2 size={15} />
            </div>

            {/* Content — title + breadcrumb */}
            <div className="min-w-0 px-3">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <p className="font-semibold text-slate-900 text-sm truncate cursor-default">{item.name}</p>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{item.name}</p>
                    </TooltipContent>
                </Tooltip>
                <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500 min-w-0">
                    <Folder size={10} className="text-blue-400 flex-shrink-0" />
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="truncate max-w-[120px] cursor-default">{item.relatedItem}</span>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{item.relatedItem}</p>
                        </TooltipContent>
                    </Tooltip>
                    <span className="text-slate-300 flex-shrink-0">›</span>
                    <CheckSquare size={10} className="text-indigo-400 flex-shrink-0" />
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="truncate max-w-[160px] cursor-default">{item.subRelatedItem}</span>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{item.subRelatedItem}</p>
                        </TooltipContent>
                    </Tooltip>
                </div>
            </div>

            {/* Right: date + DONE badge + Reopen button — all in a fixed-width flex row */}
            <div
                className="flex items-center gap-2 flex-shrink-0"
                onClick={e => e.stopPropagation()}
            >
                <span className="text-[11px] text-slate-500 whitespace-nowrap hidden sm:inline">
                    {formatDate(item.completionDate) || "—"}
                </span>
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none text-[10px] font-bold whitespace-nowrap">
                    DONE
                </Badge>
                <button
                    onClick={handleReopen}
                    disabled={reopening}
                    title="Reopen — mark this subtask as pending again"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                    {reopening ? (
                        <span className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin inline-block" />
                    ) : (
                        <RotateCcw size={12} />
                    )}
                    {reopening ? "Reopening…" : "Reopen"}
                </button>
            </div>
        </div>
    );
}
