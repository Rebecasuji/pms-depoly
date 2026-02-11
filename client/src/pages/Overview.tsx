import { useState } from "react";
import { 
  Folder, 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  MoreHorizontal,
  Calendar,
  User as UserIcon,
  CheckCircle2,
  Circle,
  Clock,
  Layers // Added missing import
} from "lucide-react";
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { PROJECTS, USERS } from "@/lib/mockData";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Overview() {
  const [expandedProjects, setExpandedProjects] = useState<string[]>(['p1']);
  const [expandedKeysteps, setExpandedKeysteps] = useState<string[]>(['m1', 'm2']);

  const toggleProject = (id: string) => {
    setExpandedProjects(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const toggleKeystep = (id: string) => {
    setExpandedKeysteps(prev => 
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Overview</h1>
          <p className="text-muted-foreground mt-1">Manage projects, keysteps, and tasks hierarchy.</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Project
        </Button>
      </div>

      <div className="flex-1 overflow-auto rounded-lg border bg-card text-card-foreground shadow-sm">
        {PROJECTS.map((project) => (
          <div key={project.id} className="border-b last:border-0">
            <div className="flex items-center justify-between bg-muted/30 p-4 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6"
                  onClick={() => toggleProject(project.id)}
                >
                  {expandedProjects.includes(project.id) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
                <Folder className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-semibold">{project.title}</h3>
                  <p className="text-xs text-muted-foreground hidden sm:block">{project.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                 <div className="hidden md:flex flex-col w-32 gap-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                       <span>Progress</span>
                       <span>{project.progress}%</span>
                    </div>
                    <Progress value={project.progress} className="h-2" />
                 </div>
                 <div className="flex -space-x-2">
                    {project.team.map(userId => {
                       const user = USERS.find(u => u.id === userId);
                       return (
                          <Avatar key={userId} className="h-8 w-8 border-2 border-background">
                             <AvatarImage src={user?.avatar} />
                             <AvatarFallback>{user?.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                       );
                    })}
                 </div>
                 <Badge variant={project.status === 'open' ? 'secondary' : project.status === 'in-progress' ? 'default' : 'outline'}>
                    {project.status}
                 </Badge>
                 <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                 </Button>
              </div>
            </div>

            {expandedProjects.includes(project.id) && (
              <div className="bg-background">
                {project.keysteps.map((keystep) => (
                  <div key={keystep.id} className="border-l-4 border-l-primary/10 ml-8 my-2 pl-4">
                    <div className="flex items-center justify-between py-3 pr-4 group hover:bg-muted/20 rounded-md transition-colors">
                      <div className="flex items-center gap-3">
                         <Button 
                           variant="ghost" 
                           size="icon" 
                           className="h-5 w-5"
                           onClick={() => toggleKeystep(keystep.id)}
                         >
                           {expandedKeysteps.includes(keystep.id) ? (
                             <ChevronDown className="h-3 w-3" />
                           ) : (
                             <ChevronRight className="h-3 w-3" />
                           )}
                         </Button>
                         <div className="h-2 w-2 rounded-full bg-primary/70" />
                         <span className="font-medium text-sm">{keystep.title}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                         <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {keystep.dueDate}
                         </span>
                         <Badge variant="outline" className="text-[10px] h-5">{keystep.status}</Badge>
                         <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                             <Plus className="h-3 w-3" />
                         </Button>
                      </div>
                    </div>

                    {expandedKeysteps.includes(keystep.id) && (
                      <div className="ml-8 space-y-4 py-2">
                         {keystep.taskLists.map(taskList => (
                            <div key={taskList.id} className="space-y-2">
                               <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-2">{taskList.title}</h4>
                               <div className="space-y-1">
                                  {taskList.tasks.map(task => {
                                    const assignee = USERS.find(u => u.id === task.assignee);
                                    return (
                                      <div key={task.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/40 group border border-transparent hover:border-border transition-all">
                                         <div className="flex items-center gap-3">
                                            <button className="text-muted-foreground hover:text-primary transition-colors">
                                               {task.status === 'closed' ? (
                                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                               ) : (
                                                  <Circle className="h-4 w-4" />
                                               )}
                                            </button>
                                            <span className={`text-sm ${task.status === 'closed' ? 'line-through text-muted-foreground' : ''}`}>{task.title}</span>
                                            {task.subtasks.length > 0 && (
                                               <Badge variant="secondary" className="text-[10px] h-5 gap-1">
                                                  <Layers className="h-3 w-3" />
                                                  {task.subtasks.filter(t => t.isCompleted).length}/{task.subtasks.length}
                                               </Badge>
                                            )}
                                         </div>
                                         <div className="flex items-center gap-3">
                                            <Badge 
                                              variant="outline" 
                                              className={`text-[10px] h-5 uppercase border-0 ${
                                                task.priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                task.priority === 'medium' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                                                'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                              }`}
                                            >
                                               {task.priority}
                                            </Badge>
                                            {assignee && (
                                               <Avatar className="h-6 w-6">
                                                  <AvatarImage src={assignee.avatar} />
                                                  <AvatarFallback>{assignee.name.charAt(0)}</AvatarFallback>
                                               </Avatar>
                                            )}
                                            <span className="text-xs text-muted-foreground w-20 text-right">{task.dueDate}</span>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                                               <MoreHorizontal className="h-3 w-3" />
                                            </Button>
                                         </div>
                                      </div>
                                    );
                                  })}
                                  <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-primary pl-2 text-xs">
                                     <Plus className="mr-2 h-3 w-3" />
                                     Add Task
                                  </Button>
                               </div>
                            </div>
                         ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
