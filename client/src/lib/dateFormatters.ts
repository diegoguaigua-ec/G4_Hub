import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Formatea una fecha para mostrar en la tabla
 * @param dateString - Fecha en formato ISO string
 * @returns Fecha formateada como "15 Nov, 12:05"
 */
export function formatTableDate(dateString: string | Date): string {
  if (!dateString) return '';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return format(date, "d MMM, HH:mm", { locale: es });
}

/**
 * Formatea una fecha de manera relativa
 * @param dateString - Fecha en formato ISO string
 * @returns Fecha formateada como "hace 2 horas"
 */
export function formatRelativeDate(dateString: string | Date): string {
  if (!dateString) return '';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return formatDistanceToNow(date, { addSuffix: true, locale: es });
}

/**
 * Formatea una fecha para mostrar en detalles
 * @param dateString - Fecha en formato ISO string
 * @returns Fecha formateada como "15 nov 2025, 12:05"
 */
export function formatDetailDate(dateString: string | Date): string {
  if (!dateString) return '';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return format(date, "d MMM yyyy, HH:mm", { locale: es });
}

/**
 * Convierte un rango de fecha seleccionado a fechas específicas
 * @param dateRange - Rango seleccionado (today, last_7_days, last_30_days, custom)
 * @returns Objeto con date_from y date_to en formato ISO
 */
export function convertDateRange(dateRange: string, customFrom?: Date, customTo?: Date): {
  date_from?: string;
  date_to?: string;
} {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (dateRange) {
    case 'today': {
      const startOfDay = new Date(today);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);
      return {
        date_from: startOfDay.toISOString(),
        date_to: endOfDay.toISOString(),
      };
    }
    case 'last_7_days': {
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return {
        date_from: sevenDaysAgo.toISOString(),
        date_to: now.toISOString(),
      };
    }
    case 'last_30_days': {
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return {
        date_from: thirtyDaysAgo.toISOString(),
        date_to: now.toISOString(),
      };
    }
    case 'custom': {
      if (customFrom && customTo) {
        return {
          date_from: customFrom.toISOString(),
          date_to: customTo.toISOString(),
        };
      }
      return {};
    }
    default:
      return {};
  }
}
