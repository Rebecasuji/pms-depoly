import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
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

export default function AddKeyStep() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  // Parse URL params from location
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const projectId = params.get("projectId");
  const keyStepId = params.get("keyStepId"); // For editing

  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);

  const [form, setForm] = useState({
    header: "",
    title: "",
    description: "",
    requirements: "",
    phase: "1",
    status: "pending" as "pending" | "in-progress" | "completed",
    startDate: "",
    endDate: "",
  });

  // Load projects
  useEffect(() => {
    apiFetch("/api/projects")
      .then(r => {
        if (!r.ok) throw new Error(`API error: ${r.status}`);
        return r.json();
      })
      .then(data => setProjects(Array.isArray(data) ? data : []))
      .catch(err => {
        console.error("Failed to load projects:", err);
        setProjects([]);
      });
  }, []);

  // Load existing keystep if editing
  useEffect(() => {
    if (keyStepId) {
      apiFetch(`/api/key-steps/${keyStepId}`)
        .then(r => {
          if (!r.ok) throw new Error(`API error: ${r.status}`);
          return r.json();
        })
        .then((data: any) => {
          setForm({
            header: data.header || "",
            title: data.title || "",
            description: data.description || "",
            requirements: data.requirements || "",
            phase: String(data.phase) || "1",
            status: data.status || "pending",
            startDate: data.startDate || "",
            endDate: data.endDate || "",
          });
        })
        .catch(err => {
          console.error("Failed to load keystep:", err);
          toast({ variant: "destructive", title: "Error", description: "Failed to load keystep" });
        });
    }
  }, [keyStepId, toast]);

  const handleSave = async () => {
    if (!form.title || !form.startDate || !form.endDate) {
      toast({ variant: "destructive", title: "Validation Error", description: "Title, Start Date, and End Date are required" });
      return;
    }

    if (!projectId && !keyStepId) {
      toast({ variant: "destructive", title: "Error", description: "Project ID is required" });
      return;
    }

    setLoading(true);

    try {
      const payload = {
        ...form,
        projectId: projectId || undefined,
        phase: parseInt(form.phase) || 1,
      };

      const method = keyStepId ? "PUT" : "POST";
      const url = keyStepId ? `/api/key-steps/${keyStepId}` : "/api/key-steps";

      const response = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Server Error (${response.status}): ${errText}`);
      }

      toast({
        title: "Success",
        description: keyStepId ? "Key step updated successfully!" : "Key step created successfully!",
      });

      // Navigate back after a short delay
      setTimeout(() => setLocation("/key-steps"), 1000);
    } catch (err: any) {
      console.error("Save error:", err);
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const selectedProjectName = projects.find((p: any) => String(p.id) === projectId)?.title || "Unknown Project";

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => setLocation("/key-steps")} className="hover:bg-slate-200 p-2 rounded-lg">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold">{keyStepId ? "Edit Key Step" : "Create New Key Step"}</h1>
            <p className="text-muted-foreground mt-1">
              {projectId ? `Project: ${selectedProjectName}` : "Select a project"}
            </p>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-lg border p-8 shadow-sm">
          <div className="space-y-6">
            {/* Header Field */}
            <div className="grid gap-2">
              <Label htmlFor="header">Step Header / Category</Label>
              <Input
                id="header"
                placeholder="e.g., UI/UX Design Phase"
                value={form.header}
                onChange={(e) => setForm({ ...form, header: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Optional: Category or phase name</p>
            </div>

            {/* Title Field */}
            <div className="grid gap-2">
              <Label htmlFor="title">Step Title *</Label>
              <Input
                id="title"
                placeholder="e.g., Initial Design Review"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className={!form.title ? "border-red-200" : ""}
              />
              <p className="text-xs text-muted-foreground">Required field</p>
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Detail the objectives of this step..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
              />
            </div>

            {/* Requirements */}
            <div className="grid gap-2">
              <Label htmlFor="requirements">Requirements</Label>
              <Textarea
                id="requirements"
                placeholder="List specific requirements for this step..."
                value={form.requirements}
                onChange={(e) => setForm({ ...form, requirements: e.target.value })}
                rows={4}
              />
            </div>

            {/* Phase and Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="grid gap-2">
                <Label htmlFor="phase">Phase Number</Label>
                <Input
                  type="number"
                  id="phase"
                  min="1"
                  value={form.phase}
                  onChange={(e) => setForm({ ...form, phase: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select value={form.status} onValueChange={(val: any) => setForm({ ...form, status: val })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="grid gap-2">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  type="date"
                  id="startDate"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className={!form.startDate ? "border-red-200" : ""}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="endDate">End Date *</Label>
                <Input
                  type="date"
                  id="endDate"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className={!form.endDate ? "border-red-200" : ""}
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end mt-8 pt-6 border-t">
            <Button
              variant="outline"
              onClick={() => setLocation("/key-steps")}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading}
              className="bg-primary hover:bg-primary/90"
            >
              {loading ? "Saving..." : keyStepId ? "Save Changes" : "Create Step"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
