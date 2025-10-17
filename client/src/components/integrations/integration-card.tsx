import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";

interface IntegrationCardProps {
  name: string;
  description: string;
  icon: LucideIcon;
  logoUrl?: string;
  isAvailable: boolean;
  onConfigure?: () => void;
}

export function IntegrationCard({
  name,
  description,
  icon: Icon,
  logoUrl,
  isAvailable,
  onConfigure,
}: IntegrationCardProps) {
  return (
    <Card 
      className={`
        group hover:shadow-lg transition-all duration-300 
        ${!isAvailable && 'opacity-60'}
      `}
    >
      <CardContent className="p-8">
        <div className="flex flex-col items-center text-center space-y-4">
          {/* Logo/Icon */}
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center group-hover:scale-110 transition-transform">
            {logoUrl ? (
              <img src={logoUrl} alt={name} className="w-12 h-12 object-contain" />
            ) : (
              <Icon className="w-10 h-10 text-primary" />
            )}
          </div>

          {/* Name */}
          <div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              {name}
            </h3>
            {!isAvailable && (
              <span className="inline-block px-3 py-1 bg-muted text-muted-foreground text-xs rounded-full font-medium">
                Próximamente
              </span>
            )}
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground leading-relaxed min-h-[3rem]">
            {description}
          </p>

          {/* Action Button */}
          <div className="w-full pt-4">
            {isAvailable ? (
              <Button 
                onClick={onConfigure}
                className="w-full"
                variant="outline"
              >
                Configurar
              </Button>
            ) : (
              <Button 
                className="w-full"
                variant="outline"
                disabled
              >
                Próximamente
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}