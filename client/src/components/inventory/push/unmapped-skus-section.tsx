import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronRight, AlertTriangle, Check, Download } from "lucide-react";
import { useUnmappedSkus } from "@/hooks/use-unmapped-skus";
import { useResolveUnmappedSku } from "@/hooks/use-resolve-unmapped-sku";
import { formatTableDate } from "@/lib/dateFormatters";
import { handleExportUnmappedSkus } from "@/lib/exportHelpers";

interface UnmappedSkusSectionProps {
  storeId: number | null;
  storeName: string;
}

export function UnmappedSkusSection({ storeId, storeName }: UnmappedSkusSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { data, isLoading } = useUnmappedSkus(storeId);
  const resolveMutation = useResolveUnmappedSku(storeId);

  const skus = data?.unmapped_skus || [];

  if (!isLoading && skus.length === 0) {
    return null;
  }

  const handleExport = async () => {
    if (!storeId) return;
    setIsExporting(true);
    try {
      await handleExportUnmappedSkus(storeId, storeName);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border rounded-lg">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between p-4 h-auto font-semibold">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <span>SKUs sin Mapear ({isLoading ? '...' : skus.length} productos)</span>
          </div>
          {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="px-4 pb-4">
        <Alert className="mb-4 bg-yellow-500/10 border-yellow-200">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription>
            Estos productos existen en tus tiendas pero no se encontraron en Contífico.
            Verifica que los SKUs coincidan en ambos sistemas.
          </AlertDescription>
        </Alert>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead className="text-center">Veces</TableHead>
                <TableHead>Primera vez</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {skus.map((sku) => (
                <TableRow key={sku.id}>
                  <TableCell className="font-mono">{sku.sku}</TableCell>
                  <TableCell>{sku.productName || 'N/A'}</TableCell>
                  <TableCell className="text-center">{sku.occurrences}</TableCell>
                  <TableCell>{formatTableDate(sku.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => resolveMutation.mutate(sku.id)}
                      disabled={resolveMutation.isPending}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Marcar como resuelto
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={isExporting}
          >
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? 'Exportando...' : 'Exportar a Excel'}
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
