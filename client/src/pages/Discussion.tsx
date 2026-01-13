import { useState, useMemo } from "react";
import { 
  Search, 
  MoreVertical, 
  Paperclip, 
  Send,
  Phone,
  Video,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { USERS } from "@/lib/mockData";

const INITIAL_THREADS = [
  { id: 't1', title: 'Website Redesign Kickoff', lastMessage: 'The timeline looks good to me.', time: '10:30 AM', unread: 2, tags: ['Project'] },
  { id: 't2', title: 'Mobile App API Specs', lastMessage: 'Can we update the swagger docs?', time: 'Yesterday', unread: 0, tags: ['Tech'] },
  { id: 't3', title: 'Q1 Marketing Strategy', lastMessage: 'Budget approval needed by Friday', time: 'Mon', unread: 0, tags: ['General'] },
  { id: 't4', title: 'Design System Review', lastMessage: 'I uploaded the new Figma links', time: 'Mon', unread: 5, tags: ['Design'] },
];

const INITIAL_MESSAGES = [
  { id: 'm1', threadId: 't1', senderId: 'u1', text: 'Hey team, just wanted to kick off the discussion for the Website Redesign.', time: '10:00 AM' },
  { id: 'm2', threadId: 't1', senderId: 'u4', text: 'I have the initial wireframes ready. Shall I share them here?', time: '10:05 AM' },
  { id: 'm3', threadId: 't1', senderId: 'u1', text: 'Yes, please do. @Sarah, we will need your input on feasibility.', time: '10:10 AM' },
  { id: 'm4', threadId: 't1', senderId: 'u2', text: 'Sure thing. I will take a look as soon as they are up.', time: '10:15 AM' },
  { id: 'm5', threadId: 't1', senderId: 'u4', text: 'Here is the link: figma.com/file/xyz...', time: '10:20 AM' },
  { id: 'm6', threadId: 't1', senderId: 'u3', text: 'The timeline looks good to me.', time: '10:30 AM' },
];

export default function Discussion() {
  const [activeThread, setActiveThread] = useState(INITIAL_THREADS[0]);
  const [messageInput, setMessageInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [messages, setMessages] = useState(INITIAL_MESSAGES);

  // 1. Search Logic: Filters threads based on title or tags
  const filteredThreads = useMemo(() => {
    return INITIAL_THREADS.filter(thread => 
      thread.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      thread.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [searchTerm]);

  // 2. Message Filtering: Only show messages for the active thread
  const activeMessages = messages.filter(m => m.threadId === activeThread.id);

  // 3. Send Message Handler
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim()) return;

    const newMessage = {
      id: `m${Date.now()}`,
      threadId: activeThread.id,
      senderId: 'u1', // Mocking current user
      text: messageInput,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages([...messages, newMessage]);
    setMessageInput("");
  };

  return (
    <div className="flex h-full flex-col md:flex-row gap-6 h-[calc(100vh-8rem)]">
      {/* Thread List */}
      <div className="w-full md:w-80 flex flex-col border rounded-lg bg-card text-card-foreground shadow-sm overflow-hidden">
        <div className="p-4 border-b space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Discussions</h2>
            <Button size="icon" variant="ghost" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
                placeholder="Search threads..." 
                className="pl-8 h-9" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="flex flex-col">
            {filteredThreads.length > 0 ? (
              filteredThreads.map((thread) => (
                <button
                  key={thread.id}
                  onClick={() => setActiveThread(thread)}
                  className={`flex flex-col gap-1 p-4 text-left transition-colors hover:bg-muted/50 ${
                    activeThread.id === thread.id ? "bg-muted" : ""
                  }`}
                >
                  <div className="flex w-full flex-col gap-1">
                    <div className="flex items-center">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold">{thread.title}</div>
                        {thread.unread > 0 && (
                          <span className="flex h-2 w-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <div className="ml-auto text-xs text-muted-foreground">
                        {thread.time}
                      </div>
                    </div>
                    <div className="text-xs font-medium text-muted-foreground">
                       {thread.tags.map(tag => (
                         <Badge key={tag} variant="outline" className="mr-1 text-[10px] h-4 px-1">{tag}</Badge>
                       ))}
                    </div>
                  </div>
                  <div className="line-clamp-1 text-xs text-muted-foreground">
                    {thread.lastMessage}
                  </div>
                </button>
              ))
            ) : (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No threads found.
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col border rounded-lg bg-card text-card-foreground shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{activeThread.title}</h3>
              <Badge variant="secondary" className="text-xs">
                {activeThread.tags[0]}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" className="h-8 w-8"><Phone className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" className="h-8 w-8"><Video className="h-4 w-4" /></Button>
            <Separator orientation="vertical" className="mx-2 h-6" />
            <Button size="icon" variant="ghost" className="h-8 w-8"><Info className="h-4 w-4" /></Button>
          </div>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {activeMessages.map((message) => {
              const sender = USERS.find((u) => u.id === message.senderId);
              const isMe = message.senderId === 'u1';

              return (
                <div key={message.id} className={`flex gap-3 ${isMe ? "justify-end" : ""}`}>
                  {!isMe && (
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={sender?.avatar} />
                      <AvatarFallback>{sender?.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                  )}
                  <div className={`flex flex-col gap-1 max-w-[70%] ${isMe ? "items-end" : ""}`}>
                    <div className="flex items-center gap-2">
                      {!isMe && <span className="text-xs font-medium">{sender?.name}</span>}
                      <span className="text-[10px] text-muted-foreground">{message.time}</span>
                    </div>
                    <div className={`rounded-lg px-3 py-2 text-sm ${isMe ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      {message.text}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="p-4 border-t bg-background">
          <form className="flex items-center gap-2" onSubmit={handleSendMessage}>
            <Button size="icon" variant="ghost" type="button">
              <Paperclip className="h-4 w-4" />
            </Button>
            <Input
              placeholder="Type your message..."
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={!messageInput.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}