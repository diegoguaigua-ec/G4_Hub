import { db } from "../db";
import { tenants, notifications, users } from "@shared/schema";
import { sql, and, lte, gte, eq } from "drizzle-orm";

/**
 * Check for accounts expiring within 10 days and create notifications
 * This should be called daily via a scheduled job
 */
export async function checkExpiringAccounts() {
  try {
    const now = new Date();
    const tenDaysFromNow = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

    // Find tenants expiring within 10 days that haven't expired yet
    const expiringTenants = await db
      .select()
      .from(tenants)
      .where(
        and(
          // Has expiration date
          sql`${tenants.expiresAt} IS NOT NULL`,
          // Expires in the future (not yet expired)
          gte(tenants.expiresAt, now),
          // Expires within 10 days
          lte(tenants.expiresAt, tenDaysFromNow),
          // Account is approved (only notify active accounts)
          eq(tenants.accountStatus, "approved")
        )
      );

    console.log(`[Expiration Check] Found ${expiringTenants.length} expiring accounts`);

    for (const tenant of expiringTenants) {
      if (!tenant.expiresAt) continue;

      // Calculate days remaining
      const expiresAt = new Date(tenant.expiresAt);
      const daysRemaining = Math.ceil(
        (expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      );

      // Check if we already created a notification today for this tenant
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const existingNotification = await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.tenantId, tenant.id),
            eq(notifications.type, "account_expiring"),
            gte(notifications.createdAt, today),
            lte(notifications.createdAt, tomorrow)
          )
        )
        .limit(1);

      // Skip if we already notified today
      if (existingNotification.length > 0) {
        console.log(`[Expiration Check] Already notified tenant ${tenant.id} today`);
        continue;
      }

      // Get all users for this tenant
      const tenantUsers = await db
        .select()
        .from(users)
        .where(eq(users.tenantId, tenant.id));

      // Create notification for each user
      for (const user of tenantUsers) {
        const severity = daysRemaining <= 3 ? "error" : daysRemaining <= 7 ? "warning" : "info";

        await db.insert(notifications).values({
          tenantId: tenant.id,
          userId: user.id,
          type: "account_expiring",
          title: "⏰ Tu cuenta está por vencer",
          message: `Tu cuenta de G4 Hub vencerá en ${daysRemaining} ${daysRemaining === 1 ? "día" : "días"} (${expiresAt.toLocaleDateString("es-ES")}). Contacta con nosotros para renovar tu suscripción.`,
          severity,
          read: false,
          data: {
            expiresAt: expiresAt.toISOString(),
            daysRemaining,
          },
        });

        console.log(
          `[Expiration Check] Created notification for tenant ${tenant.id}, user ${user.id}, days remaining: ${daysRemaining}`
        );
      }
    }

    // Also check for already expired accounts that need notification
    const expiredTenants = await db
      .select()
      .from(tenants)
      .where(
        and(
          sql`${tenants.expiresAt} IS NOT NULL`,
          lte(tenants.expiresAt, now),
          eq(tenants.accountStatus, "approved")
        )
      );

    console.log(`[Expiration Check] Found ${expiredTenants.length} expired accounts`);

    for (const tenant of expiredTenants) {
      // Check if we already created an expiration notification
      const existingExpiredNotification = await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.tenantId, tenant.id),
            eq(notifications.type, "account_expired")
          )
        )
        .limit(1);

      if (existingExpiredNotification.length > 0) {
        continue;
      }

      // Get all users for this tenant
      const tenantUsers = await db
        .select()
        .from(users)
        .where(eq(users.tenantId, tenant.id));

      // Create expired notification for each user
      for (const user of tenantUsers) {
        await db.insert(notifications).values({
          tenantId: tenant.id,
          userId: user.id,
          type: "account_expired",
          title: "❌ Tu cuenta ha expirado",
          message: "Tu cuenta de G4 Hub ha expirado. Todos los servicios están suspendidos. Contacta con nosotros para reactivar tu cuenta.",
          severity: "error",
          read: false,
          data: {
            expiresAt: tenant.expiresAt?.toISOString(),
          },
        });

        console.log(
          `[Expiration Check] Created expired notification for tenant ${tenant.id}, user ${user.id}`
        );
      }
    }

    return {
      expiringCount: expiringTenants.length,
      expiredCount: expiredTenants.length,
    };
  } catch (error) {
    console.error("[Expiration Check] Error checking expiring accounts:", error);
    throw error;
  }
}

/**
 * Initialize the expiration check scheduler
 * Runs every 24 hours starting from server startup
 */
export function initializeExpirationScheduler() {
  // Run immediately on startup
  console.log("[Expiration Scheduler] Running initial expiration check...");
  checkExpiringAccounts().catch((error) => {
    console.error("[Expiration Scheduler] Error in initial check:", error);
  });

  // Schedule to run every 24 hours (86400000 ms)
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  setInterval(() => {
    console.log("[Expiration Scheduler] Running scheduled expiration check...");
    checkExpiringAccounts().catch((error) => {
      console.error("[Expiration Scheduler] Error in scheduled check:", error);
    });
  }, TWENTY_FOUR_HOURS);

  console.log("[Expiration Scheduler] Scheduler initialized - will run every 24 hours");
}
