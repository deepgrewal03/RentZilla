import { randomUUID } from "node:crypto";
import { db, listingsTable, reportsTable, usersTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";

export class ReportError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function parseReport(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ReportError(400, "Invalid report");
  const input = body as Record<string, unknown>;
  const legacy = input.targetType === undefined && input.targetId === undefined;
  const targetType = legacy ? "user" : input.targetType;
  const targetId = legacy ? input.reportedUserId : input.targetId;
  if (targetType !== "user" && targetType !== "listing" && targetType !== "provider") {
    throw new ReportError(400, "targetType must be user, listing or provider");
  }
  if (typeof targetId !== "string" || !targetId.trim() || targetId.length > 200) {
    throw new ReportError(400, "A valid targetId is required");
  }
  if (!legacy && input.reportedUserId !== undefined &&
      (targetType !== "user" || input.reportedUserId !== targetId)) {
    throw new ReportError(400, "reportedUserId conflicts with the explicit target");
  }
  if (typeof input.reason !== "string" || !["spam", "fraud", "abuse", "fake_listing", "other"].includes(input.reason)) {
    throw new ReportError(400, "Invalid reason");
  }
  if (input.description !== undefined &&
      (typeof input.description !== "string" || input.description.length > 2000)) {
    throw new ReportError(400, "description must be a string of at most 2000 characters");
  }
  return { targetType, targetId, reason: input.reason, description: input.description as string | undefined };
}

export async function createSafetyReport(reporterId: string, body: unknown) {
  const input = parseReport(body);
  return db.transaction(async (tx) => {
    // PostgreSQL transaction lock serializes ALL submissions by this reporter,
    // across processes/restarts, making duplicate and rolling quota checks atomic.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`safety-report:${reporterId}`}, 0))`);
    let ownerId = input.targetId;
    let targetName: string | null = null;
    if (input.targetType === "listing") {
      const [listing] = await tx.select().from(listingsTable).where(eq(listingsTable.id, input.targetId)).limit(1);
      if (!listing) throw new ReportError(404, "Listing not found");
      ownerId = listing.providerId;
      targetName = listing.title;
    }
    const [owner] = await tx.select().from(usersTable).where(eq(usersTable.id, ownerId)).limit(1);
    if (!owner || (input.targetType === "provider" && owner.role !== "provider" && owner.role !== "both")) {
      throw new ReportError(404, "Report target not found");
    }
    if (ownerId === reporterId) throw new ReportError(400, "You cannot report yourself or your own listing");
    const ownerName = owner.name || [owner.firstName, owner.lastName].filter(Boolean).join(" ") || owner.email;
    const [duplicate] = await tx.select({ id: reportsTable.id }).from(reportsTable).where(and(
      eq(reportsTable.reporterId, reporterId), eq(reportsTable.targetType, input.targetType),
      eq(reportsTable.targetId, input.targetId),
    )).limit(1);
    if (duplicate) throw new ReportError(409, "You have already reported this target");
    const quota = await tx.execute<{ hourly: number; daily: number }>(sql`
      SELECT count(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour')::int AS hourly,
        count(*)::int AS daily FROM reports
      WHERE reporter_id = ${reporterId} AND created_at > NOW() - INTERVAL '24 hours'
    `);
    if (quota.rows[0].hourly >= 5 || quota.rows[0].daily >= 20) {
      throw new ReportError(429, "Report limit reached (5 per hour, 20 per day). Please try again later");
    }
    const [report] = await tx.insert(reportsTable).values({
      id: randomUUID(), reporterId, ...input,
      targetName: targetName ?? ownerName, reportedUserId: ownerId, reportedUserName: ownerName,
    }).returning();
    return report;
  });
}