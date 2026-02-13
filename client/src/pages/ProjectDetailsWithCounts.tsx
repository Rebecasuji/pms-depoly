import { useEffect, useState } from "react";
import { CardContent, Badge } from "@/components/ui";
import { apiFetch } from "@/lib/apiClient";
import { Users, Hash, Upload, FileIcon } from "lucide-react";

export function ProjectDetailsWithCounts({ project }: { project: any }) {
  const [keysteps, setKeysteps] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([
      apiFetch(`/api/projects/${project.id}/key-steps`).then(r => r.json()).catch(() => []),
      apiFetch(`/api/tasks/${project.id}`).then(r => r.json()).catch(() => []),
    ]).then(([ks, ts]) => {
      if (mounted) {
        setKeysteps(Array.isArray(ks) ? ks : []);
        setTasks(Array.isArray(ts) ? ts : []);
        setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, [project.id]);

  const inProgressKeysteps = keysteps.filter((k: any) => k.status === "in-progress");
  const inProgressTasks = tasks.filter((t: any) => t.status === "In Progress" || t.status === "in-progress");

  return (
    <div className="pt-4 border-t border-muted/40 space-y-6">
      <div className="flex flex-wrap gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Key Steps</p>
          <span className="font-bold text-lg">{loading ? '...' : keysteps.length}</span>
          {inProgressKeysteps.length > 0 && (
            <div className="text-xs mt-1 text-blue-600">In Progress: {inProgressKeysteps.length}</div>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Tasks</p>
          <span className="font-bold text-lg">{loading ? '...' : tasks.length}</span>
          {inProgressTasks.length > 0 && (
            <div className="text-xs mt-1 text-blue-600">In Progress: {inProgressTasks.length}</div>
          )}
        </div>
      </div>
      {/* ...existing project details UI... */}
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">In Progress Details</p>
        <div className="space-y-1">
          {inProgressKeysteps.map((k: any) => (
            <div key={k.id} className="text-xs text-blue-700">Keystep: {k.title}</div>
          ))}
          {inProgressTasks.map((t: any) => (
            <div key={t.id} className="text-xs text-blue-700">Task: {t.taskName}</div>
          ))}
          {inProgressKeysteps.length === 0 && inProgressTasks.length === 0 && (
            <div className="text-xs text-muted-foreground">No items in progress</div>
          )}
        </div>
      </div>
    </div>
  );
}