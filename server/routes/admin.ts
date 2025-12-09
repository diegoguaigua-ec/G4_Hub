import { Router, Request } from "express";
import { storage } from "../storage";
import { requireAdmin } from "../middleware/requireAdmin";
import { User, adminActions, tenants, users } from "@shared/schema";
import { db } from "../db";
import { eq, sql, and, or, like, desc } from "drizzle-orm";
import { getPlan, PlanType } from "@shared/plans";
import { formatEcuadorDate } from "../utils/dateFormatters";

const router = Router();

// Proper TypeScript interface for authenticated requests
interface AuthenticatedRequest extends Request {
  user: User;
}

// All admin routes require admin role
router.use(requireAdmin);

/**
 * GET /api/admin/stats
 * Get admin dashboard statistics
 */
router.get("/stats", async (req, res) => {
  try {
    const stats = await db.transaction(async (tx) => {
      // Total tenants
      const totalTenantsResult = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(tenants);
      const totalTenants = totalTenantsResult[0]?.count || 0;

      // Pending approvals
      const pendingResult = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(tenants)
        .where(eq(tenants.accountStatus, "pending"));
      const pendingApprovals = pendingResult[0]?.count || 0;

      // Approved accounts
      const approvedResult = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(tenants)
        .where(eq(tenants.accountStatus, "approved"));
      const approvedAccounts = approvedResult[0]?.count || 0;

      // Rejected accounts
      const rejectedResult = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(tenants)
        .where(eq(tenants.accountStatus, "rejected"));
      const rejectedAccounts = rejectedResult[0]?.count || 0;

      // Suspended accounts
      const suspendedResult = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(tenants)
        .where(eq(tenants.accountStatus, "suspended"));
      const suspendedAccounts = suspendedResult[0]?.count || 0;

      // Total users
      const totalUsersResult = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(users);
      const totalUsers = totalUsersResult[0]?.count || 0;

      // Recent actions (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentActionsResult = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(adminActions)
        .where(sql`created_at >= ${sevenDaysAgo.toISOString()}`);
      const recentActions = recentActionsResult[0]?.count || 0;

      // Distribution by plan
      const planDistribution = await tx
        .select({
          planType: tenants.planType,
          count: sql<number>`count(*)::int`,
        })
        .from(tenants)
        .groupBy(tenants.planType);

      return {
        totalTenants,
        pendingTenants: pendingApprovals,
        approvedTenants: approvedAccounts,
        rejectedTenants: rejectedAccounts,
        suspendedTenants: suspendedAccounts,
        totalUsers,
        recentActions,
        // Keep legacy names for backwards compatibility
        pendingApprovals,
        approvedAccounts,
        rejectedAccounts,
        suspendedAccounts,
        planDistribution: planDistribution.reduce((acc, curr) => {
          if (curr.planType) {
            acc[curr.planType] = curr.count;
          }
          return acc;
        }, {} as Record<string, number>),
      };
    });

    res.json(stats);
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    res.status(500).json({ message: "Failed to fetch statistics" });
  }
});

/**
 * GET /api/admin/users
 * Get list of tenants with filters and pagination
 */
router.get("/users", async (req, res) => {
  try {
    const {
      status, // accountStatus filter
      plan, // planType filter
      search, // search in name, subdomain, email
      limit = "50",
      offset = "0",
      page = "1", // page number (1-indexed)
    } = req.query;

    const limitNum = parseInt(limit as string, 10);
    const pageNum = parseInt(page as string, 10);
    // Calculate offset from page number (page is 1-indexed)
    const offsetNum = page !== "1" ? (pageNum - 1) * limitNum : parseInt(offset as string, 10);

    // Build where conditions
    const conditions: any[] = [];

    if (status) {
      conditions.push(eq(tenants.accountStatus, status as string));
    }

    if (plan) {
      conditions.push(eq(tenants.planType, plan as string));
    }

    if (search && typeof search === "string") {
      const searchPattern = `%${search}%`;
      conditions.push(
        or(
          like(tenants.name, searchPattern),
          like(tenants.subdomain, searchPattern)
        )
      );
    }

    // Get tenants (without join to avoid duplicates)
    const allTenants = await db
      .select()
      .from(tenants)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(tenants.createdAt))
      .limit(limitNum)
      .offset(offsetNum);

    // Get total count for pagination
    const totalResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tenants)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = totalResult[0]?.count || 0;

    // Fetch owner user for each tenant
    const tenantsWithOwners = await Promise.all(
      allTenants.map(async (tenant) => {
        const ownerUser = await storage.getTenantOwnerUser(tenant.id);
        return {
          ...tenant,
          ownerEmail: ownerUser?.email,
          ownerName: ownerUser?.name,
        };
      })
    );

    res.json({
      tenants: tenantsWithOwners,
      total,
      page: pageNum,
      limit: limitNum,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

/**
 * GET /api/admin/users/:id
 * Get detailed tenant information
 */
router.get("/users/:id", async (req, res) => {
  try {
    const tenantId = parseInt(req.params.id, 10);

    const tenant = await storage.getTenant(tenantId);
    if (!tenant) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    // Get associated users
    const tenantUsers = await db
      .select()
      .from(users)
      .where(eq(users.tenantId, tenantId));

    // Get stores
    const stores = await storage.getStoresByTenant(tenantId);

    // Get integrations
    const integrations = await storage.getIntegrationsByTenant(tenantId);

    // Get recent admin actions for this tenant
    const recentActions = await db
      .select({
        action: adminActions,
        adminUser: users,
      })
      .from(adminActions)
      .leftJoin(users, eq(adminActions.adminUserId, users.id))
      .where(eq(adminActions.targetTenantId, tenantId))
      .orderBy(desc(adminActions.createdAt))
      .limit(10);

    res.json({
      tenant,
      users: tenantUsers.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        createdAt: u.createdAt,
      })),
      stores: stores.length,
      integrations: integrations.length,
      recentActions: recentActions.map(({ action, adminUser }) => ({
        ...action,
        adminUserName: adminUser?.name,
        adminUserEmail: adminUser?.email,
      })),
    });
  } catch (error) {
    console.error("Error fetching tenant details:", error);
    res.status(500).json({ message: "Failed to fetch tenant details" });
  }
});

/**
 * PUT /api/admin/users/:id/approve
 * Approve a pending tenant account
 */
router.put("/users/:id/approve", async (req, res) => {
  try {
    const tenantId = parseInt(req.params.id, 10);
    const adminUser = (req as AuthenticatedRequest).user;

    const tenant = await storage.getTenant(tenantId);
    if (!tenant) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    if (tenant.accountStatus === "approved") {
      return res.status(400).json({ message: "Account is already approved" });
    }

    // Update tenant status
    await storage.updateTenantAccountStatus(tenantId, "approved");

    // Log admin action
    await storage.createAdminAction({
      adminUserId: adminUser.id,
      targetTenantId: tenantId,
      actionType: "approve_account",
      description: `Cuenta aprobada por ${adminUser.name}`,
      metadata: {
        previousStatus: tenant.accountStatus,
        newStatus: "approved",
      },
    });

    res.json({ message: "Account approved successfully" });
  } catch (error) {
    console.error("Error approving account:", error);
    res.status(500).json({ message: "Failed to approve account" });
  }
});

/**
 * PUT /api/admin/users/:id/reject
 * Reject a pending tenant account
 */
router.put("/users/:id/reject", async (req, res) => {
  try {
    const tenantId = parseInt(req.params.id, 10);
    const adminUser = (req as AuthenticatedRequest).user;
    const { reason } = req.body;

    const tenant = await storage.getTenant(tenantId);
    if (!tenant) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    // Update tenant status
    await storage.updateTenantAccountStatus(tenantId, "rejected");

    // Log admin action
    await storage.createAdminAction({
      adminUserId: adminUser.id,
      targetTenantId: tenantId,
      actionType: "reject_account",
      description: `Cuenta rechazada por ${adminUser.name}${reason ? `: ${reason}` : ""}`,
      metadata: {
        previousStatus: tenant.accountStatus,
        newStatus: "rejected",
        reason: reason || null,
      },
    });

    res.json({ message: "Account rejected successfully" });
  } catch (error) {
    console.error("Error rejecting account:", error);
    res.status(500).json({ message: "Failed to reject account" });
  }
});

/**
 * PUT /api/admin/users/:id/suspend
 * Suspend a tenant account
 */
router.put("/users/:id/suspend", async (req, res) => {
  try {
    const tenantId = parseInt(req.params.id, 10);
    const adminUser = (req as AuthenticatedRequest).user;
    const { reason } = req.body;

    const tenant = await storage.getTenant(tenantId);
    if (!tenant) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    // Update tenant status
    await storage.updateTenantAccountStatus(tenantId, "suspended");

    // Log admin action
    await storage.createAdminAction({
      adminUserId: adminUser.id,
      targetTenantId: tenantId,
      actionType: "suspend_account",
      description: `Cuenta suspendida por ${adminUser.name}${reason ? `: ${reason}` : ""}`,
      metadata: {
        previousStatus: tenant.accountStatus,
        newStatus: "suspended",
        reason: reason || null,
      },
    });

    res.json({ message: "Account suspended successfully" });
  } catch (error) {
    console.error("Error suspending account:", error);
    res.status(500).json({ message: "Failed to suspend account" });
  }
});

/**
 * PUT /api/admin/users/:id/activate
 * Activate a suspended tenant account
 */
router.put("/users/:id/activate", async (req, res) => {
  try {
    const tenantId = parseInt(req.params.id, 10);
    const adminUser = (req as AuthenticatedRequest).user;

    const tenant = await storage.getTenant(tenantId);
    if (!tenant) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    // Update tenant status to approved (reactivate)
    await storage.updateTenantAccountStatus(tenantId, "approved");

    // Log admin action
    await storage.createAdminAction({
      adminUserId: adminUser.id,
      targetTenantId: tenantId,
      actionType: "activate_account",
      description: `Cuenta reactivada por ${adminUser.name}`,
      metadata: {
        previousStatus: tenant.accountStatus,
        newStatus: "approved",
      },
    });

    res.json({ message: "Account activated successfully" });
  } catch (error) {
    console.error("Error activating account:", error);
    res.status(500).json({ message: "Failed to activate account" });
  }
});

/**
 * PUT /api/admin/users/:tenantId/role/:userId
 * Change a user's role (user <-> admin)
 */
router.put("/users/:tenantId/role/:userId", async (req, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId, 10);
    const userId = parseInt(req.params.userId, 10);
    const adminUser = (req as AuthenticatedRequest).user;
    const { role } = req.body;

    // Validate role
    if (!role || !["user", "admin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role. Must be 'user' or 'admin'" });
    }

    const tenant = await storage.getTenant(tenantId);
    if (!tenant) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    // Get the user to update
    const targetUser = await storage.getUser(userId);
    if (!targetUser || targetUser.tenantId !== tenantId) {
      return res.status(404).json({ message: "User not found in this tenant" });
    }

    if (targetUser.role === role) {
      return res.status(400).json({ message: `User already has role '${role}'` });
    }

    const oldRole = targetUser.role;

    // Update user role
    await storage.updateUserRole(userId, role);

    // Log admin action
    await storage.createAdminAction({
      adminUserId: adminUser.id,
      targetTenantId: tenantId,
      actionType: "change_user_role",
      description: `Rol de usuario ${targetUser.email} cambiado de ${oldRole} a ${role} por ${adminUser.name}`,
      metadata: {
        userId,
        userEmail: targetUser.email,
        oldRole,
        newRole: role,
      },
    });

    res.json({ message: "User role updated successfully", user: { id: userId, role } });
  } catch (error) {
    console.error("Error updating user role:", error);
    res.status(500).json({ message: "Failed to update user role" });
  }
});

/**
 * PUT /api/admin/users/:id/plan
 * Change tenant's plan
 */
router.put("/users/:id/plan", async (req, res) => {
  try {
    const tenantId = parseInt(req.params.id, 10);
    const adminUser = (req as AuthenticatedRequest).user;
    const { planType } = req.body;

    if (!planType || !["starter", "professional", "enterprise"].includes(planType)) {
      return res.status(400).json({ message: "Invalid plan type" });
    }

    const tenant = await storage.getTenant(tenantId);
    if (!tenant) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    const oldPlan = tenant.planType;
    const newPlan = getPlan(planType as PlanType);

    // Update tenant plan
    await storage.updateTenantPlan(tenantId, planType);

    // Log admin action
    await storage.createAdminAction({
      adminUserId: adminUser.id,
      targetTenantId: tenantId,
      actionType: "change_plan",
      description: `Plan cambiado de ${oldPlan} a ${planType} por ${adminUser.name}`,
      metadata: {
        oldPlan,
        newPlan: planType,
        newPlanLimits: newPlan.limits,
      },
    });

    res.json({ message: "Plan updated successfully" });
  } catch (error) {
    console.error("Error updating plan:", error);
    res.status(500).json({ message: "Failed to update plan" });
  }
});

/**
 * PUT /api/admin/users/:id/expires-at
 * Update tenant expiration date
 */
router.put("/users/:id/expires-at", async (req, res) => {
  try {
    const tenantId = parseInt(req.params.id, 10);
    const adminUser = (req as AuthenticatedRequest).user;
    const { expiresAt } = req.body;

    const tenant = await storage.getTenant(tenantId);
    if (!tenant) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    // expiresAt can be a date string or null to remove expiration
    const expirationDate = expiresAt ? new Date(expiresAt) : null;

    // Update tenant expiration
    await storage.updateTenantExpiresAt(tenantId, expirationDate);

    // Log admin action
    await storage.createAdminAction({
      adminUserId: adminUser.id,
      targetTenantId: tenantId,
      actionType: "update_expiration",
      description: expirationDate
        ? `Fecha de vencimiento actualizada a ${formatEcuadorDate(expirationDate)} por ${adminUser.name}`
        : `Fecha de vencimiento eliminada por ${adminUser.name}`,
      metadata: {
        oldExpiresAt: tenant.expiresAt,
        newExpiresAt: expirationDate,
      },
    });

    res.json({ message: "Expiration date updated successfully" });
  } catch (error) {
    console.error("Error updating expiration:", error);
    res.status(500).json({ message: "Failed to update expiration date" });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Delete a tenant (dangerous operation)
 */
router.delete("/users/:id", async (req, res) => {
  try {
    const tenantId = parseInt(req.params.id, 10);
    const adminUser = (req as AuthenticatedRequest).user;

    const tenant = await storage.getTenant(tenantId);
    if (!tenant) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    // Log admin action before deletion
    await storage.createAdminAction({
      adminUserId: adminUser.id,
      targetTenantId: tenantId,
      actionType: "delete_account",
      description: `Cuenta eliminada por ${adminUser.name}`,
      metadata: {
        tenantName: tenant.name,
        subdomain: tenant.subdomain,
        planType: tenant.planType,
      },
    });

    // Delete tenant (cascade will delete related records)
    await storage.deleteTenant(tenantId);

    res.json({ message: "Account deleted successfully" });
  } catch (error) {
    console.error("Error deleting account:", error);
    res.status(500).json({ message: "Failed to delete account" });
  }
});

/**
 * GET /api/admin/actions
 * Get recent admin actions log
 */
router.get("/actions", async (req, res) => {
  try {
    const { limit = "50", offset = "0" } = req.query;
    const limitNum = parseInt(limit as string, 10);
    const offsetNum = parseInt(offset as string, 10);

    const actions = await db
      .select({
        action: adminActions,
        adminUser: users,
        targetTenant: tenants,
      })
      .from(adminActions)
      .leftJoin(users, eq(adminActions.adminUserId, users.id))
      .leftJoin(tenants, eq(adminActions.targetTenantId, tenants.id))
      .orderBy(desc(adminActions.createdAt))
      .limit(limitNum)
      .offset(offsetNum);

    // Get total count
    const totalResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(adminActions);
    const total = totalResult[0]?.count || 0;

    res.json({
      actions: actions.map(({ action, adminUser, targetTenant }) => ({
        ...action,
        adminUserName: adminUser?.name,
        adminUserEmail: adminUser?.email,
        targetTenantName: targetTenant?.name,
        targetTenantSubdomain: targetTenant?.subdomain,
      })),
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum,
      },
    });
  } catch (error) {
    console.error("Error fetching admin actions:", error);
    res.status(500).json({ message: "Failed to fetch admin actions" });
  }
});

/**
 * GET /api/admin/webhooks/:storeId
 * List all webhooks for a specific store from the platform (Shopify, etc.)
 */
router.get("/webhooks/:storeId", async (req, res) => {
  try {
    const storeId = parseInt(req.params.storeId, 10);

    const store = await storage.getStore(storeId);
    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    if (store.platform !== "shopify") {
      return res.status(400).json({ message: "Webhook management only supported for Shopify stores" });
    }

    // Import connector dynamically to avoid circular dependencies
    const { getConnector } = await import("../connectors/index");
    const connector = getConnector(store);
    const shopifyConnector = connector as any;

    if (!shopifyConnector.listWebhooks) {
      return res.status(400).json({ message: "Store connector does not support webhook listing" });
    }

    // Get webhooks from Shopify
    const result = await shopifyConnector.listWebhooks();

    if (!result.success) {
      return res.status(500).json({ message: "Failed to fetch webhooks from Shopify", error: result.error });
    }

    // Get webhooks from our database (new table)
    const dbWebhooks = await storage.getWebhooksByStore(storeId);

    res.json({
      store: {
        id: store.id,
        name: store.name,
        platform: store.platform,
      },
      webhooks: {
        live: result.webhooks, // Webhooks actually in Shopify
        database: dbWebhooks, // Webhooks registered in our database table
      },
      orphaned: result.webhooks.filter(
        (liveWh: any) => !dbWebhooks.find((dbWh: any) => dbWh.platformWebhookId === liveWh.id.toString())
      ),
    });
  } catch (error: any) {
    console.error("Error fetching webhooks:", error);
    res.status(500).json({ message: "Failed to fetch webhooks", error: error.message });
  }
});

/**
 * DELETE /api/admin/webhooks/:storeId/:webhookId
 * Delete a specific webhook from the platform
 */
router.delete("/webhooks/:storeId/:webhookId", async (req, res) => {
  try {
    const storeId = parseInt(req.params.storeId, 10);
    const webhookId = parseInt(req.params.webhookId, 10);
    const adminUser = (req as AuthenticatedRequest).user;

    const store = await storage.getStore(storeId);
    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    if (store.platform !== "shopify") {
      return res.status(400).json({ message: "Webhook management only supported for Shopify stores" });
    }

    // Import connector dynamically
    const { getConnector } = await import("../connectors/index");
    const connector = getConnector(store);
    const shopifyConnector = connector as any;

    // Delete the webhook from Shopify
    const result = await shopifyConnector.deleteWebhooks([webhookId]);

    if (!result.success && result.deleted === 0) {
      return res.status(500).json({
        message: "Failed to delete webhook",
        errors: result.errors,
      });
    }

    // Mark webhook as deleted in our database
    const dbWebhook = await storage.getWebhookByPlatformId("shopify", webhookId.toString());
    if (dbWebhook) {
      await storage.markWebhookAsDeleted(dbWebhook.id);
    }

    // Log admin action
    await storage.createAdminAction({
      adminUserId: adminUser.id,
      targetTenantId: store.tenantId,
      actionType: "delete_webhook",
      description: `Webhook ${webhookId} eliminado manualmente por ${adminUser.name} de tienda ${store.name}`,
      metadata: {
        storeId: store.id,
        webhookId,
        storeName: store.name,
      },
    });

    res.json({
      message: "Webhook deleted successfully",
      webhookId,
      storeId,
    });
  } catch (error: any) {
    console.error("Error deleting webhook:", error);
    res.status(500).json({ message: "Failed to delete webhook", error: error.message });
  }
});

/**
 * POST /api/admin/webhooks/:storeId/cleanup
 * Clean up all orphaned webhooks for a store
 */
router.post("/webhooks/:storeId/cleanup", async (req, res) => {
  try {
    const storeId = parseInt(req.params.storeId, 10);
    const adminUser = (req as AuthenticatedRequest).user;

    const store = await storage.getStore(storeId);
    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    if (store.platform !== "shopify") {
      return res.status(400).json({ message: "Webhook cleanup only supported for Shopify stores" });
    }

    // Import connector dynamically
    const { getConnector } = await import("../connectors/index");
    const connector = getConnector(store);
    const shopifyConnector = connector as any;

    // Get all webhooks from Shopify
    const listResult = await shopifyConnector.listWebhooks();
    if (!listResult.success) {
      return res.status(500).json({ message: "Failed to list webhooks", error: listResult.error });
    }

    // Get webhooks from our database
    const dbWebhooks = await storage.getWebhooksByStore(storeId);

    // Find orphaned webhooks (in Shopify but not in our DB)
    const orphanedWebhooks = listResult.webhooks.filter(
      (liveWh: any) => !dbWebhooks.find((dbWh: any) => dbWh.platformWebhookId === liveWh.id.toString())
    );

    if (orphanedWebhooks.length === 0) {
      return res.json({
        message: "No orphaned webhooks found",
        deleted: 0,
      });
    }

    // Delete all orphaned webhooks from Shopify
    const webhookIds = orphanedWebhooks.map((wh: any) => wh.id);
    const deleteResult = await shopifyConnector.deleteWebhooks(webhookIds);

    // Note: No need to mark as deleted in DB since they don't exist there (orphaned)

    // Log admin action
    await storage.createAdminAction({
      adminUserId: adminUser.id,
      targetTenantId: store.tenantId,
      actionType: "cleanup_webhooks",
      description: `${deleteResult.deleted} webhooks huérfanos eliminados por ${adminUser.name} de tienda ${store.name}`,
      metadata: {
        storeId: store.id,
        storeName: store.name,
        totalOrphaned: orphanedWebhooks.length,
        deleted: deleteResult.deleted,
        errors: deleteResult.errors,
        webhookIds,
      },
    });

    res.json({
      message: `Cleaned up ${deleteResult.deleted} orphaned webhooks`,
      deleted: deleteResult.deleted,
      errors: deleteResult.errors,
      orphanedWebhooks: orphanedWebhooks.map((wh: any) => ({
        id: wh.id,
        address: wh.address,
        topic: wh.topic,
      })),
    });
  } catch (error: any) {
    console.error("Error cleaning up webhooks:", error);
    res.status(500).json({ message: "Failed to cleanup webhooks", error: error.message });
  }
});

export default router;
