import { useState } from "react";
import { Button } from "@/common/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/common/components/ui/card";
import { Input } from "@/common/components/ui/input";
import { Label } from "@/common/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/common/components/ui/dialog";
import { Badge } from "@/common/components/ui/badge";
import { Plus, Code2, Key, Settings, Copy } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/common/components/ui/select";

interface App {
  id: string;
  name: string;
  description: string;
  appId: string;
  status: "active" | "development" | "review";
  type: "plugin" | "integration";
  createdAt: string;
}

const MOCK_APPS: App[] = [
  {
    id: "1",
    name: "My Custom CRM Sync",
    description: "Syncs chat contacts to internal CRM system",
    appId: "app_8f92j29s",
    status: "active",
    type: "integration",
    createdAt: "2024-03-15",
  },
  {
    id: "2",
    name: "Order Query Bot",
    description: "Automated order status checking plugin",
    appId: "app_k29s8d21",
    status: "development",
    type: "plugin",
    createdAt: "2024-05-20",
  },
];

export function MyAppsPage() {
  const [apps, setApps] = useState<App[]>(MOCK_APPS);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newAppName, setNewAppName] = useState("");
  const [newAppType, setNewAppType] = useState("plugin");

  const handleCreate = () => {
    const newApp: App = {
      id: Date.now().toString(),
      name: newAppName,
      description: "New application created via Developer Portal",
      appId: `app_${Math.random().toString(36).substr(2, 8)}`,
      status: "development",
      type: newAppType as "plugin" | "integration",
      createdAt: new Date().toISOString().split("T")[0],
    };
    setApps([...apps, newApp]);
    setIsCreateOpen(false);
    setNewAppName("");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Developer Center</h1>
          <p className="text-muted-foreground">Create and manage your custom plugins and integrations.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create App
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New App</DialogTitle>
              <DialogDescription>
                Start building your own plugin or integration. You'll get an App ID and Secret after creation.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">App Name</Label>
                <Input
                  id="name"
                  value={newAppName}
                  onChange={(e) => setNewAppName(e.target.value)}
                  placeholder="e.g. My Awesome Plugin"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="type">App Type</Label>
                <Select value={newAppType} onValueChange={setNewAppType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="plugin">Plugin (UI Extension)</SelectItem>
                    <SelectItem value="integration">Integration (API Only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!newAppName}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {apps.map((app) => (
          <Card key={app.id} className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Code2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{app.name}</CardTitle>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                      {app.createdAt}
                    </div>
                  </div>
                </div>
                <Badge variant={app.status === "active" ? "default" : "secondary"}>
                  {app.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1 pb-3">
              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                {app.description}
              </p>
              <div className="bg-muted/50 p-2 rounded text-xs font-mono flex items-center justify-between group">
                <span className="text-muted-foreground">ID: {app.appId}</span>
                <Button variant="ghost" size="icon" className="h-4 w-4 opacity-0 group-hover:opacity-100">
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
            <CardFooter className="pt-3 border-t flex gap-2">
              <Button variant="outline" size="sm" className="flex-1">
                <Key className="w-3.5 h-3.5 mr-2" />
                Credentials
              </Button>
              <Button variant="outline" size="sm" className="flex-1">
                <Settings className="w-3.5 h-3.5 mr-2" />
                Settings
              </Button>
            </CardFooter>
          </Card>
        ))}
        
        {apps.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-lg">
            <div className="p-4 bg-muted rounded-full mb-4">
              <Code2 className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">No apps yet</h3>
            <p className="text-muted-foreground max-w-sm mt-2 mb-6">
              Create your first app to start building plugins and integrations for the platform.
            </p>
            <Button onClick={() => setIsCreateOpen(true)}>Create App</Button>
          </div>
        )}
      </div>
    </div>
  );
}
