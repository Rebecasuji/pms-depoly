import { useState, useEffect } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  eachHourOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  startOfDay,
  endOfDay,
  addDays
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CALENDAR_EVENTS, USERS } from "@/lib/mockData";

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  type: "project" | "task" | "milestone" | "meeting" | "assignment";
  assignees: string[];
}

const EVENT_COLORS = {
  project: { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-700' },
  task: { bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-700' },
  milestone: { bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-700' },
  meeting: { bg: 'bg-orange-100', border: 'border-orange-300', text: 'text-orange-700' },
  assignment: { bg: 'bg-yellow-100', border: 'border-yellow-300', text: 'text-yellow-700' }
};

export default function CalendarEnhanced() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  
  // Initialize state from LocalStorage if available, otherwise use CALENDAR_EVENTS
  const [events, setEvents] = useState<CalendarEvent[]>(() => {
    if (typeof window !== 'undefined') {
      const savedEvents = localStorage.getItem("calendar_events_persistence");
      return savedEvents ? JSON.parse(savedEvents) : CALENDAR_EVENTS;
    }
    return CALENDAR_EVENTS;
  });

  const [newEventDialog, setNewEventDialog] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    startDate: format(new Date(), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
    startTime: "09:00",
    endTime: "10:00",
    type: "task" as const,
    assignees: [] as string[]
  });

  // Save to localStorage whenever events change
  useEffect(() => {
    localStorage.setItem("calendar_events_persistence", JSON.stringify(events));
  }, [events]);

  const today = new Date();

  // Month view
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const weekStart = startOfWeek(monthStart);
  const weekEnd = endOfWeek(monthEnd);
  const monthDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Week view
  const weekStartDate = startOfWeek(currentDate);
  const weekEndDate = endOfWeek(currentDate);
  const weekDays = eachDayOfInterval({ start: weekStartDate, end: weekEndDate });

  // Day view
  const dayStart = startOfDay(currentDate);
  const dayEnd = endOfDay(currentDate);
  const dayHours = eachHourOfInterval({ start: dayStart, end: dayEnd });

  const handleCreateEvent = () => {
    if (!newEvent.title || !newEvent.startDate || !newEvent.endDate) return;
    
    const event: CalendarEvent = {
      id: `event${Date.now()}`, // Using timestamp for better unique IDs
      ...newEvent,
      assignees: newEvent.assignees
    };
    
    setEvents([...events, event]);
    setNewEvent({ title: "", description: "", startDate: format(new Date(), "yyyy-MM-dd"), endDate: format(new Date(), "yyyy-MM-dd"), startTime: "09:00", endTime: "10:00", type: "task", assignees: [] });
    setNewEventDialog(false);
  };

  const handleDeleteEvent = (id: string) => {
    setEvents(events.filter(e => e.id !== id));
  };

  const getEventsForDay = (date: Date) => {
    return events.filter(event => {
      const eventStart = new Date(event.startDate);
      const eventEnd = new Date(event.endDate);
      // Normalize dates to remove time for accurate day comparison
      const checkDate = startOfDay(date);
      const start = startOfDay(eventStart);
      const end = startOfDay(eventEnd);
      return checkDate >= start && checkDate <= end;
    });
  };

  const renderEventColor = (type: string) => {
    return EVENT_COLORS[type as keyof typeof EVENT_COLORS] || EVENT_COLORS.task;
  };

  const handlePrev = () => {
    if (viewMode === 'month') setCurrentDate(subMonths(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, -1));
  };

  const handleNext = () => {
    if (viewMode === 'month') setCurrentDate(addMonths(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-display font-bold text-foreground">Calendar</h1>
        <Dialog open={newEventDialog} onOpenChange={setNewEventDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Event
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Event</DialogTitle>
              <DialogDescription>Add a new event to your calendar.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Event Title</Label>
                <Input id="title" placeholder="Event title" value={newEvent.title} onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" placeholder="Event description" value={newEvent.description} onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input type="date" id="startDate" value={newEvent.startDate} onChange={(e) => setNewEvent({ ...newEvent, startDate: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="endDate">End Date</Label>
                  <Input type="date" id="endDate" value={newEvent.endDate} onChange={(e) => setNewEvent({ ...newEvent, endDate: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startTime">Start Time</Label>
                  <Input type="time" id="startTime" value={newEvent.startTime} onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="endTime">End Time</Label>
                  <Input type="time" id="endTime" value={newEvent.endTime} onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })} />
                </div>
              </div>

              <div>
                <Label htmlFor="type">Event Type</Label>
                <Select value={newEvent.type} onValueChange={(val: any) => setNewEvent({ ...newEvent, type: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="task">Task</SelectItem>
                    <SelectItem value="project">Project</SelectItem>
                    <SelectItem value="milestone">Milestone</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="assignment">Assignment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Assign Team Members</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {USERS.map(user => (
                    <div key={user.id} className="flex items-center">
                      <input 
                        type="checkbox" 
                        id={`user-${user.id}`}
                        checked={newEvent.assignees.includes(user.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewEvent({ ...newEvent, assignees: [...newEvent.assignees, user.id] });
                          } else {
                            setNewEvent({ ...newEvent, assignees: newEvent.assignees.filter(id => id !== user.id) });
                          }
                        }}
                        className="mr-2"
                      />
                      <Label htmlFor={`user-${user.id}`} className="cursor-pointer flex-1">{user.name}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewEventDialog(false)}>Cancel</Button>
              <Button onClick={handleCreateEvent}>Create Event</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={handlePrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm font-semibold min-w-40 text-center">
            {viewMode === 'month' && format(currentDate, 'MMMM yyyy')}
            {viewMode === 'week' && `Week of ${format(weekStartDate, 'MMM d')}`}
            {viewMode === 'day' && format(currentDate, 'EEEE, MMMM d, yyyy')}
          </div>
          <Button variant="ghost" size="icon" onClick={handleNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
            Today
          </Button>
        </div>
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
          <TabsList>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="day">Day</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex flex-wrap gap-4 text-xs">
        {Object.entries(EVENT_COLORS).map(([type, colors]) => (
          <div key={type} className="flex items-center gap-2">
            <div className={`h-3 w-3 rounded ${colors.bg}`} />
            <span className="capitalize">{type}</span>
          </div>
        ))}
      </div>

      {viewMode === 'month' && (
        <div className="flex-1 rounded-lg border bg-card text-card-foreground shadow-sm overflow-auto">
          <div className="grid grid-cols-7 border-b bg-muted/30 sticky top-0 z-10">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="py-3 text-center text-sm font-semibold text-muted-foreground">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthDays.map(day => {
              const dayEvents = getEventsForDay(day);
              return (
                <div
                  key={day.toString()}
                  className={`min-h-[120px] border-r border-b p-2 transition-colors hover:bg-muted/20 ${
                    !isSameMonth(day, currentDate) ? 'bg-muted/10 text-muted-foreground' : ''
                  } ${isSameDay(day, today) ? 'bg-primary/5' : ''}`}
                >
                  <div className="text-sm font-medium mb-1">
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 2).map(event => {
                      const colors = renderEventColor(event.type);
                      return (
                        <div
                          key={event.id}
                          className={`text-[10px] px-2 py-1 rounded truncate cursor-pointer border ${colors.bg} ${colors.border} ${colors.text} font-medium`}
                          title={event.title}
                        >
                          {event.title}
                        </div>
                      );
                    })}
                    {dayEvents.length > 2 && (
                      <div className="text-[10px] text-muted-foreground px-2">
                        +{dayEvents.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {viewMode === 'week' && (
        <div className="flex-1 rounded-lg border bg-card text-card-foreground shadow-sm overflow-auto">
          <div className="grid gap-1" style={{ gridTemplateColumns: 'auto ' + 'minmax(120px, 1fr) '.repeat(7) }}>
            <div className="border-r border-b bg-muted/30 p-2" />
            {weekDays.map(day => (
              <div
                key={day.toString()}
                className={`border-r border-b bg-muted/30 p-2 text-center text-sm font-semibold ${
                  isSameDay(day, today) ? 'bg-primary/10' : ''
                }`}
              >
                <div>{format(day, 'EEE')}</div>
                <div className={`text-xs ${isSameDay(day, today) ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                  {format(day, 'd')}
                </div>
              </div>
            ))}
            {dayHours.slice(0, 12).map(hour => (
              <>
                <div key={`time-${hour}`} className="border-r border-b bg-muted/10 p-2 text-xs text-muted-foreground text-right">
                  {format(hour, 'HH:mm')}
                </div>
                {weekDays.map(day => {
                  const dayEvents = getEventsForDay(day);
                  return (
                    <div
                      key={`${day}-${hour}`}
                      className="border-r border-b p-1 min-h-[60px] bg-background hover:bg-muted/30 transition-colors"
                    >
                      <div className="space-y-1">
                        {dayEvents.map(event => {
                          const colors = renderEventColor(event.type);
                          return (
                            <div
                              key={event.id}
                              className={`text-[10px] px-1.5 py-1 rounded truncate cursor-pointer border ${colors.bg} ${colors.border} ${colors.text} font-medium`}
                            >
                              {event.title}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </>
            ))}
          </div>
        </div>
      )}

      {viewMode === 'day' && (
        <div className="flex-1 rounded-lg border bg-card text-card-foreground shadow-sm overflow-auto">
          <Card>
            <CardHeader>
              <CardTitle>{format(currentDate, 'EEEE, MMMM d, yyyy')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {getEventsForDay(currentDate).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No events scheduled for this day</p>
                </div>
              ) : (
                getEventsForDay(currentDate).map(event => {
                  const colors = renderEventColor(event.type);
                  return (
                    <div key={event.id} className={`p-4 rounded-lg border-l-4 ${colors.bg} ${colors.border}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className={`font-semibold ${colors.text}`}>{event.title}</h3>
                          <Badge variant="outline" className={`mt-1 ${colors.text}`}>
                            {event.type}
                          </Badge>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteEvent(event.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      {event.description && (
                        <p className="text-sm text-muted-foreground mt-2">{event.description}</p>
                      )}
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(event.startDate), 'MMM d')} - {format(new Date(event.endDate), 'MMM d')}
                        </span>
                      </div>
                      {event.assignees.length > 0 && (
                        <div className="mt-3 flex flex-col gap-1">
                          <span className="text-xs text-muted-foreground">Assigned to:</span>
                          <div className="flex flex-wrap gap-2">
                            {event.assignees.map(userId => {
                              const user = USERS.find(u => u.id === userId);
                              return (
                                <span key={userId} className="text-sm font-medium text-foreground">
                                  {user?.name || "Unknown User"}
                                  {event.assignees.indexOf(userId) !== event.assignees.length - 1 ? "," : ""}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}