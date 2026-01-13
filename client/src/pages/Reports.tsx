import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/* ================================
   PROJECT CONFIG (ONE PLACE)
================================ */
const projectConfig = {
  projectName: "Knockturn PMS",
  projectStartDate: new Date("2025-01-01T10:00:00"),
  sprintDurationDays: 7,
};

/* ================================
   HELPERS
================================ */
const formatDateTime = (date: Date) =>
  date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

/* ================================
   VELOCITY DATA (DATE BASED)
================================ */
const velocityData = Array.from({ length: 5 }).map((_, index) => {
  const start = new Date(projectConfig.projectStartDate);
  start.setDate(start.getDate() + index * projectConfig.sprintDurationDays);

  const end = new Date(start);
  end.setDate(end.getDate() + projectConfig.sprintDurationDays - 1);

  return {
    sprint: `${start.toLocaleDateString("en-IN")} - ${end.toLocaleDateString(
      "en-IN",
    )}`,
    planned: [20, 22, 25, 24, 28][index],
    completed: [18, 20, 24, 26, 22][index],
  };
});

/* ================================
   BURN DOWN DATA (DATE BASED)
================================ */
const burnDownData = Array.from({ length: 10 }).map((_, index) => {
  const date = new Date(projectConfig.projectStartDate);
  date.setDate(date.getDate() + index);

  return {
    day: date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
    }),
    remaining: [100, 95, 88, 75, 60, 55, 40, 25, 10, 0][index],
    ideal: 100 - index * 10,
  };
});

/* ================================
   RESOURCE DATA
================================ */
const resourceData = [
  { name: "Alex", tasks: 12, issues: 2 },
  { name: "Sarah", tasks: 15, issues: 1 },
  { name: "Mike", tasks: 8, issues: 5 },
  { name: "Emily", tasks: 10, issues: 0 },
];

/* ================================
   PDF EXPORT
================================ */
const generatePDF = async () => {
  const element = document.getElementById("reports-container");
  if (!element) return;

  const canvas = await html2canvas(element);
  const pdf = new jsPDF("portrait", "mm", "a4");

  const imgWidth = 210;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  const imgData = canvas.toDataURL("image/png");

  pdf.text(projectConfig.projectName, 10, 10);
  pdf.text(`Generated on: ${formatDateTime(new Date())}`, 10, 18);
  pdf.addImage(imgData, "PNG", 0, 25, imgWidth, imgHeight);

  pdf.save("project-reports.pdf");
};

/* ================================
   COMPONENT
================================ */
export default function Reports() {
  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">
            Reports
          </h1>
          <p className="text-muted-foreground mt-1">
            Analytics & performance metrics • Generated on{" "}
            <span className="font-medium">
              {formatDateTime(new Date())}
            </span>
          </p>
        </div>

        <Button variant="outline" onClick={generatePDF}>
          <Download className="mr-2 h-4 w-4" />
          Export PDF
        </Button>
      </div>

      {/* REPORTS */}
      <div id="reports-container">
        <Tabs defaultValue="velocity" className="space-y-4">
          <TabsList>
            <TabsTrigger value="velocity">Team Velocity</TabsTrigger>
            <TabsTrigger value="burndown">Burn Down</TabsTrigger>
            <TabsTrigger value="workload">Resource Workload</TabsTrigger>
          </TabsList>

          {/* VELOCITY */}
          <TabsContent value="velocity">
            <Card>
              <CardHeader>
                <CardTitle>Sprint Velocity</CardTitle>
                <CardDescription>
                  Planned vs completed points per sprint (date based)
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={velocityData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="sprint" fontSize={11} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="planned" fill="hsl(var(--muted))" />
                    <Bar dataKey="completed" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* BURN DOWN */}
          <TabsContent value="burndown">
            <Card>
              <CardHeader>
                <CardTitle>Sprint Burn Down</CardTitle>
                <CardDescription>
                  Remaining work vs ideal timeline (calendar based)
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={burnDownData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      dataKey="ideal"
                      stroke="hsl(var(--muted-foreground))"
                      strokeDasharray="5 5"
                    />
                    <Line
                      dataKey="remaining"
                      stroke="hsl(var(--primary))"
                      strokeWidth={3}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* WORKLOAD */}
          <TabsContent value="workload">
            <Card>
              <CardHeader>
                <CardTitle>Team Workload</CardTitle>
                <CardDescription>
                  Active tasks and open issues per member
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={resourceData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area
                      dataKey="tasks"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.3}
                    />
                    <Area
                      dataKey="issues"
                      stroke="hsl(var(--destructive))"
                      fill="hsl(var(--destructive))"
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
