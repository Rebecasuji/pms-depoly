import { useState, createContext, useContext, useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  FolderKanban,
  MessageSquare,
  BarChart3,
  Calendar as CalendarIcon,
  Blocks,
  LogOut,
  Menu,
  Bell,
  Search,
  CheckCircle2,
  Settings,
  User as UserIcon,
  Folder,
  Users as UsersIcon,
  Plus,
  Clock,
  AlertCircle
} from "lucide-react";

// UI Components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

// Mock Data
import { PROJECTS, USERS } from "@/lib/mockData";
import { apiFetch, clearApiCache } from "@/lib/apiClient";
import companyLogo from "@/pages/logo.jpg";


// --- Types ---
interface KeyStep {
  id: string;
  projectId: string;
  title: string;
  description: string;
  phase: number;
  status: "pending" | "in-progress" | "completed";
  startDate: string;
  endDate: string;
}

// --- Auth Context ---
const AuthContext = createContext<{
  user: any;
  isLoading: boolean;
  login: (employeeCode?: string, password?: string) => Promise<void>;
  logout: () => void;
} | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("knockturn_token");
    if (!token) {
      console.log("[AUTH] No token found");
      setIsLoading(false);
      return;
    }
    // Token exists — restore session by fetching current user
    apiFetch("/api/me")
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          console.log("[AUTH] Session restored for:", data.user?.name);
          setUser(data.user);
        } else {
          console.warn("[AUTH] Token invalid, clearing");
          localStorage.removeItem("knockturn_token");
        }
      })
      .catch(() => {
        console.warn("[AUTH] Failed to restore session");
        localStorage.removeItem("knockturn_token");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const login = async (employeeCode?: string, password?: string) => {
    try {
      console.log("[LOGIN] Sending credentials for:", employeeCode);
      const res = await apiFetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeCode, password }),
      });

      console.log("[LOGIN] Response status:", res.status, res.ok);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
        console.error("[LOGIN] Login failed:", errorData);
        throw new Error(errorData.error || `Login failed (${res.status})`);
      }

      const data = await res.json();
      console.log("[LOGIN] Success! User:", data.user);
      localStorage.setItem("knockturn_token", data.token);
      setUser(data.user);
      setLocation("/");
    } catch (err) {
      console.error("[LOGIN] Error during login:", err);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await apiFetch("/api/logout", { method: "POST" });
      clearApiCache();
    } catch (e) {
      // ignore
    }
    setUser(null);
    localStorage.removeItem("knockturn_token");
    setLocation("/login");
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

// --- Sidebar Configuration ---
const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Projects", href: "/projects", icon: Folder },
  { label: "Key Steps", href: "/key-steps", icon: FolderKanban },
  { label: "Tasks", href: "/tasks", icon: CheckCircle2 },
  { label: "Team", href: "/users", icon: UsersIcon },
  { label: "Calendar", href: "/calendar", icon: CalendarIcon },

  // 🚧 Under construction items
  { label: "Overview", href: "/overview", icon: FolderKanban, underConstruction: true },
  { label: "Discussion", href: "/discussion", icon: MessageSquare, underConstruction: true },
  { label: "Reports", href: "/reports", icon: BarChart3, underConstruction: true },
  { label: "Extensions", href: "/extensions", icon: Blocks, underConstruction: true },
];

export function Sidebar() {
  const [location] = useLocation();
  const SHOW_TEAM = import.meta.env.VITE_SHOW_TEAM === "true";

  const filteredNav = NAV_ITEMS.filter(
    (item) => item.label !== "Team" || SHOW_TEAM
  );

  return (
    <div className="flex h-full w-64 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center justify-center border-b border-sidebar-border px-6">
        <img
          src={companyLogo}
          alt="Company Logo"
          className="h-12 object-contain"
        />
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-3">
          {filteredNav.map((item) => {
            const isActive = location === item.href;

            const content = (
              <div
                className={`group relative flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors
                ${item.underConstruction
                    ? "cursor-pointer text-sidebar-foreground/50"
                    : isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon
                    className={`h-4 w-4 ${isActive ? "text-primary" : "text-sidebar-foreground/50"}`}
                  />
                  {item.label}
                </div>

                {item.underConstruction && (
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                )}

                {item.underConstruction && (
                  <div className="pointer-events-none absolute right-2 top-1/2 z-50 hidden -translate-y-1/2 rounded-md bg-white px-2 py-1 text-xs font-medium text-green-600 shadow-md group-hover:block">
                    Under Construction
                  </div>
                )}
              </div>
            );

            if (item.underConstruction) {
              return (
                <div
                  key={item.label}
                  onClick={() => alert(`${item.label} is currently under construction.`)}
                >
                  {content}
                </div>
              );
            }

            return (
              <Link key={item.href} href={item.href}>
                {content}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

// --- Layout with Global Search and Profile Management ---
export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [displayUser, setDisplayUser] = useState(user);

  // Refresh user profile from server
  const refreshProfile = async () => {
    try {
      const res = await apiFetch("/api/me");
      if (res.ok) {
        const data = await res.json();
        setDisplayUser(data.user);
      }
    } catch (err) {
      console.error("Failed to refresh profile:", err);
    }
  };

  const [profileData, setProfileData] = useState({
    bio: localStorage.getItem(`bio_${user?.id}`) || "Professional project manager.",
    avatar: localStorage.getItem(`avatar_${user?.id}`) || user?.avatar || ""
  });

  const [notifications, setNotifications] = useState([
    { id: 1, title: "Update", message: "Key Step 'Phase 1' completed", time: "2m ago", unread: true },
    { id: 2, title: "Reminder", message: "QA Testing starts tomorrow", time: "1h ago", unread: true }
  ]);


  const unreadCount = notifications.filter(n => n.unread).length;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setProfileData(prev => ({ ...prev, avatar: base64String }));
        localStorage.setItem(`avatar_${user?.id}`, base64String);
      };
      reader.readAsDataURL(file);
    }
  };


  if (!user) return <>{children}</>;

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {sidebarOpen && <div className="hidden lg:block"><Sidebar /></div>}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b bg-background px-6">
          <div className="flex items-center gap-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden"><Menu /></Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64"><Sidebar /></SheetContent>
            </Sheet>
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="hidden lg:flex"><Menu /></Button>
          </div>

          <div className="flex items-center gap-4">
            <DropdownMenu onOpenChange={(open) => open && setNotifications(n => n.map(x => ({ ...x, unread: false })))}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  {unreadCount > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-background" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-80" align="end">
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <ScrollArea className="h-64">
                  {notifications.map(n => (
                    <div key={n.id} className="p-4 border-b last:border-0">
                      <p className={`text-sm font-medium ${n.unread ? "text-primary" : ""}`}>{n.title}</p>
                      <p className="text-xs text-muted-foreground">{n.message}</p>
                    </div>
                  ))}
                </ScrollArea>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={profileData.avatar} />
                    <AvatarFallback>{displayUser?.name?.[0]}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{displayUser?.name}</p>
                    <p className="text-xs text-muted-foreground">{displayUser?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={refreshProfile}>
                  <Clock className="mr-2 h-4 w-4" /> Refresh Profile
                </DropdownMenuItem>
                <Dialog>
                  <DialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      <UserIcon className="mr-2 h-4 w-4" /> Profile & Settings
                    </DropdownMenuItem>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Employee Profile</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="flex flex-col items-center gap-3">
                        <Avatar className="h-20 w-20">
                          <AvatarImage src={profileData.avatar} />
                        </Avatar>
                        <Input type="file" id="avatar-upload" className="hidden" onChange={handleImageUpload} />
                        <Button variant="outline" size="sm" asChild>
                          <label htmlFor="avatar-upload" className="cursor-pointer">Change Image</label>
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <Label>Bio</Label>
                        <Textarea
                          value={profileData.bio}
                          onChange={(e) => {
                            setProfileData(prev => ({ ...prev, bio: e.target.value }));
                            localStorage.setItem(`bio_${user?.id}`, e.target.value);
                          }}
                        />
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                <DropdownMenuItem onClick={logout} className="text-red-600">
                  <LogOut className="mr-2 h-4 w-4" /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6 bg-muted/20">{children}</main>
      </div>
    </div>
  );
}

// --- KeySteps Component ---
export function KeySteps() {
  const [keySteps, setKeySteps] = useState<KeyStep[]>([
    { id: "ks1", projectId: "p1", title: "Phase 1: Design", description: "Design mockups", phase: 1, status: "completed", startDate: "2025-01-01", endDate: "2025-01-15" },
    { id: "ks2", projectId: "p1", title: "Phase 2: Development", description: "Coding", phase: 2, status: "in-progress", startDate: "2025-01-15", endDate: "2025-02-28" }
  ]);

  const [localSearch, setLocalSearch] = useState("");
  const filteredSteps = useMemo(() => {
    return keySteps.filter(step =>
      step.title.toLowerCase().includes(localSearch.toLowerCase())
    );
  }, [keySteps, localSearch]);

  const progressPercent = keySteps.length > 0 ? (keySteps.filter(s => s.status === "completed").length / keySteps.length) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Key Steps</h1>
          <p className="text-muted-foreground">Manage project phases.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search steps..."
              className="pl-9"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
            />
          </div>
          <Button><Plus className="mr-2 h-4 w-4" /> New Key Step</Button>
        </div>
      </div>

      <Card className="bg-primary/5 border-primary/10">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <CardTitle>Overall Progress</CardTitle>
            <span className="text-xl font-bold">{Math.round(progressPercent)}%</span>
          </div>
        </CardHeader>
        <CardContent><Progress value={progressPercent} className="h-2" /></CardContent>
      </Card>

      <div className="space-y-4">
        {filteredSteps.map(step => (
          <Card key={step.id}>
            <CardHeader>
              <div className="flex items-center gap-4">
                {step.status === "completed" ? <CheckCircle2 className="text-green-600" /> : <Clock className="text-blue-600" />}
                <div>
                  <Badge variant="outline">Phase {step.phase}</Badge>
                  <CardTitle className="text-lg mt-1">{step.title}</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pl-14">
              <p className="text-muted-foreground">{step.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}