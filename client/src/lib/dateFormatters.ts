import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz';

/**
 * Timezone para Ecuador
 */
const ECUADOR_TIMEZONE = 'America/Guayaquil';

/**
 * Formatea una fecha en formato Ecuador estándar
 * @param dateString - Fecha en formato ISO string o Date object
 * @returns Fecha formateada como "08/12/2025, 3:19 p. m."
 */
export function formatEcuadorDateTime(dateString: string | Date | null | undefined): string {
  if (!dateString) return 'Nunca';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;

  // Formatear directamente en la zona horaria de Ecuador
  return formatInTimeZone(date, ECUADOR_TIMEZONE, "dd/MM/yyyy, h:mm aaa", { locale: es });
}

/**
 * Formatea una fecha en formato Ecuador con segundos
 * @param dateString - Fecha en formato ISO string o Date object
 * @returns Fecha formateada como "08/12/2025, 3:19:45 p. m."
 */
export function formatEcuadorDateTimeWithSeconds(dateString: string | Date | null | undefined): string {
  if (!dateString) return 'Nunca';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;

  // Formatear directamente en la zona horaria de Ecuador con segundos
  return formatInTimeZone(date, ECUADOR_TIMEZONE, "dd/MM/yyyy, h:mm:ss aaa", { locale: es });
}

/**
 * Formatea solo la fecha (sin hora) en formato Ecuador
 * @param dateString - Fecha en formato ISO string o Date object
 * @returns Fecha formateada como "08/12/2025"
 */
export function formatEcuadorDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return 'N/A';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;

  // Formatear directamente en la zona horaria de Ecuador
  return formatInTimeZone(date, ECUADOR_TIMEZONE, "dd/MM/yyyy", { locale: es });
}

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
 * Formatea una fecha de manera relativa (unificada)
 * @param dateString - Fecha en formato ISO string o Date object
 * @returns Fecha formateada como "hace 2 horas"
 */
export function formatRelativeDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return 'Nunca';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return formatDistanceToNow(date, { addSuffix: true, locale: es });
}

/**
 * Formatea una fecha relativa de manera compacta (minutos, horas, días)
 * @param dateString - Fecha en formato ISO string o Date object
 * @returns Fecha formateada como "hace 3h", "hace 2d", etc.
 */
export function formatRelativeCompact(dateString: string | Date | null | undefined): string {
  if (!dateString) return 'Nunca';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) return 'Ahora mismo';
  if (diffMinutes < 60) return `hace ${diffMinutes}m`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `hace ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `hace ${diffDays}d`;
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
