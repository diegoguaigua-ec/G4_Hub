import { formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';

/**
 * Timezone para Ecuador
 */
const ECUADOR_TIMEZONE = 'America/Guayaquil';

/**
 * Formatea una fecha en formato Ecuador estándar para Excel y reportes
 * @param dateString - Fecha en formato ISO string o Date object
 * @returns Fecha formateada como "08/12/2025, 3:19 p. m."
 */
export function formatEcuadorDateTime(dateString: string | Date | null | undefined): string {
  if (!dateString) return 'N/A';
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
  if (!dateString) return 'N/A';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;

  // Formatear directamente en la zona horaria de Ecuador con segundos
  return formatInTimeZone(date, ECUADOR_TIMEZONE, "dd/MM/yyyy, h:mm:ss aaa", { locale: es });
}

/**
 * Formatea una fecha solo con la fecha (sin hora)
 * @param dateString - Fecha en formato ISO string o Date object
 * @returns Fecha formateada como "08/12/2025"
 */
export function formatEcuadorDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return 'N/A';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;

  return formatInTimeZone(date, ECUADOR_TIMEZONE, "dd/MM/yyyy", { locale: es });
}

/**
 * Formatea una fecha y hora para logs
 * @param dateString - Fecha en formato ISO string o Date object
 * @returns Fecha formateada como "08/12/2025 15:19:45"
 */
export function formatLogTimestamp(dateString: string | Date | null | undefined): string {
  if (!dateString) return 'N/A';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;

  return formatInTimeZone(date, ECUADOR_TIMEZONE, "dd/MM/yyyy HH:mm:ss", { locale: es });
}
