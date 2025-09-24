import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, Brain, TrendingUp, MessageCircle } from "lucide-react";

export default function AutomationSection() {
  const features = [
    {
      title: "Smart Inventory",
      description: "AI-driven stock level optimization and automated reorder points",
      icon: Brain,
    },
    {
      title: "Predictive Analytics",
      description: "Forecast demand and optimize pricing strategies automatically",
      icon: TrendingUp,
    },
    {
      title: "Auto Customer Care",
      description: "Intelligent chatbots and personalized customer interactions",
      icon: MessageCircle,
    },
  ];

  return (
    <div className="text-center py-20">
      <div className="w-24 h-24 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
        <Bot className="h-12 w-12 text-primary" />
      </div>
      <h2 className="text-3xl font-bold text-foreground mb-4">AI-Powered Automation</h2>
      <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">
        Advanced automation features are coming soon. Get ready to revolutionize your e-commerce operations with 
        intelligent inventory management, predictive analytics, and automated customer engagement.
      </p>
      <div className="flex gap-4 justify-center mb-16">
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3" data-testid="button-join-beta">
          Join Beta Waitlist
        </Button>
        <Button variant="outline" className="px-6 py-3" data-testid="button-learn-more">
          Learn More
        </Button>
      </div>
      
      {/* Feature Preview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        {features.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <Card key={index} className="border border-border text-left">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
