import { 
  Github, 
  Slack, 
  Figma, 
  Mail, 
  Trello, 
  Database, 
  Cloud,
  Check,
  Briefcase,
  LayoutGrid,
  MessageSquare, // Icon for WhatsApp
  ArrowUpRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const EXTENSIONS = [
  {
    id: 'github',
    name: 'GitHub',
    description: 'Link commits and pull requests to your tasks automatically.',
    icon: Github,
    connected: true,
    category: 'Development'
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Receive notifications and update tasks directly from Slack channels.',
    icon: Slack,
    connected: true,
    category: 'Communication'
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    description: 'Send task updates and receive reminders directly on your WhatsApp.',
    icon: MessageSquare,
    connected: false,
    category: 'Communication'
  },
  {
    id: 'figma',
    name: 'Figma',
    description: 'Embed designs and prototypes directly into your task descriptions.',
    icon: Figma,
    connected: false,
    category: 'Design'
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Turn emails into actionable tasks with a single click.',
    icon: Mail,
    connected: false,
    category: 'Communication'
  },
  {
    id: 'zoho',
    name: 'Zoho CRM',
    description: 'Sync customer data and sales leads directly to your projects.',
    icon: Briefcase,
    connected: false,
    category: 'CRM'
  },
  {
    id: 'microsoft',
    name: 'Microsoft 365',
    description: 'Access OneDrive files and sync with Outlook Calendar.',
    icon: LayoutGrid,
    connected: false,
    category: 'Productivity'
  },
  {
    id: 'trello',
    name: 'Trello Import',
    description: 'One-time import tool to bring your Trello boards into Knockturn.',
    icon: Trello,
    connected: false,
    category: 'Import'
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    description: 'Sync your database schema changes with project milestones.',
    icon: Database,
    connected: false,
    category: 'Development'
  },
  {
    id: 'aws',
    name: 'AWS DevOps',
    description: 'Trigger deployment pipelines when milestones are completed.',
    icon: Cloud,
    connected: false,
    category: 'DevOps'
  }
];

export default function Extensions() {
  return (
    <div className="space-y-6 p-8 font-sans antialiased">
      <div className="flex items-center justify-between">
        <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Extentions</h1>
          <p className="text-slate-500 mt-4 font-medium">Supercharge your workflow with third-party integrations.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {EXTENSIONS.map((ext) => (
          <Card key={ext.id} className="flex flex-col border-2 border-slate-100 rounded-[24px] shadow-sm hover:shadow-md transition-all group">
            <CardHeader>
              <div className="flex items-start justify-between">
                 <div className="p-3 bg-slate-50 rounded-xl group-hover:bg-blue-50 transition-colors">
                    <ext.icon className="h-6 w-6 text-slate-700 group-hover:text-blue-600" />
                 </div>
                 {ext.connected && (
                    <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 border-emerald-200 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <Check className="mr-1 h-3 w-3 stroke-[3px]" />
                        Connected
                    </Badge>
                 )}
              </div>
              <CardTitle className="mt-4 font-black text-slate-800 tracking-tight">{ext.name}</CardTitle>
              <CardDescription className="text-xs font-medium leading-relaxed text-slate-500">
                {ext.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
               <Badge variant="secondary" className="text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 px-2 rounded-md">
                {ext.category}
               </Badge>
            </CardContent>
            <CardFooter className="pt-0">
               {ext.connected ? (
                  <Button variant="outline" className="w-full font-bold border-2 rounded-xl text-slate-600 hover:bg-slate-50">
                    Manage Settings
                  </Button>
               ) : (
                  <Button className="w-full font-bold bg-slate-900 hover:bg-blue-600 rounded-xl transition-all">
                    Connect Integration
                  </Button>
               )}
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}