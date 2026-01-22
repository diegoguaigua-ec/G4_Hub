import rateLimit from 'express-rate-limit';

/**
 * Rate limiter para API general
 * Límites conservadores para no afectar usuarios legítimos
 */
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 200, // 200 requests por ventana (conservador para no afectar uso normal)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: {
        error: 'Demasiadas solicitudes desde esta IP, por favor intenta de nuevo más tarde.',
        retryAfter: 'Consulta el header RateLimit-Reset para saber cuándo puedes intentar de nuevo'
    },
    // Excluir health checks del rate limiting
    skip: (req) => req.path === '/health' || req.path === '/api/health',
});

/**
 * Rate limiter específico para webhooks
 * Límites por tienda para evitar abuso
 */
export const webhookLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 100, // 100 webhooks por minuto por tienda (muy generoso)
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Rate limit por storeId para aislar por tienda
        const storeId = req.params.storeId || 'unknown';
        return `webhook:${storeId}`;
    },
    message: {
        error: 'Demasiados webhooks recibidos para esta tienda, por favor contacta soporte.',
        storeId: (req: any) => req.params.storeId
    },
    // No aplicar rate limiting al endpoint de test
    skip: (req) => req.path.includes('/test'),
});

/**
 * Rate limiter estricto para autenticación
 * Previene ataques de fuerza bruta
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10, // 10 intentos por ventana
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Demasiados intentos de inicio de sesión, por favor intenta de nuevo en 15 minutos.',
    },
});
