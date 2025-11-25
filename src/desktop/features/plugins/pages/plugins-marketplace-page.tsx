import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/common/components/ui/card";
import { Button } from "@/common/components/ui/button";
import { Badge } from "@/common/components/ui/badge";
import { Facebook, MessageCircle, Video, Megaphone } from "lucide-react";

const plugins = [
  {
    id: "facebook-ads",
    title: "Facebook Ads",
    description: "Create and manage Facebook ad campaigns directly.",
    icon: Facebook,
    status: "Coming Soon",
  },
  {
    id: "microsoft-ads",
    title: "Microsoft Ads",
    description: "Optimize your reach with Microsoft Advertising integration.",
    icon: Megaphone,
    status: "Coming Soon",
  },
  {
    id: "tiktok-ads",
    title: "TikTok Ads",
    description: "Launch viral campaigns on TikTok.",
    icon: Video,
    status: "Coming Soon",
  },
  {
    id: "whatsapp-broadcast",
    title: "WhatsApp Broadcast",
    description: "Send bulk messages to your customers efficiently.",
    icon: MessageCircle,
    status: "Available",
  },
  {
    id: "google-ads",
    title: "Google Ads",
    description: "Manage Google Search and Display campaigns.",
    icon: Megaphone,
    status: "Coming Soon",
  },
];

export function PluginsMarketplacePage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Plugin Marketplace</h1>
        <p className="text-muted-foreground">Discover and install plugins to extend functionality.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plugins.map((plugin) => (
          <Card key={plugin.id} className="flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between">
                <plugin.icon className="w-8 h-8 text-primary" />
                <Badge variant={plugin.status === "Available" ? "default" : "secondary"}>
                  {plugin.status}
                </Badge>
              </div>
              <CardTitle className="mt-4">{plugin.title}</CardTitle>
              <CardDescription>{plugin.description}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto pt-0">
              <Button className="w-full" disabled={plugin.status !== "Available"}>
                {plugin.status === "Available" ? "Install" : "Notify Me"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
