import prisma from '../lib/prisma';

export const VALID_NOTIFICATION_TYPES = [
  'INFO',
  'SUCCESS',
  'WARNING',
  'CRITICAL',
  'ALERT',
  'REQUISITION',
  'MAINTENANCE',
  'ASSIGNMENT',
  'USER',
  'SYSTEM',
] as const;

export type NotificationType = (typeof VALID_NOTIFICATION_TYPES)[number];

export const VALID_NOTIFICATION_PRIORITIES = [
  'LOW',
  'NORMAL',
  'HIGH',
  'CRITICAL',
] as const;

export type NotificationPriority = (typeof VALID_NOTIFICATION_PRIORITIES)[number];

export interface CreateNotificationInput {
  recipientId: string;
  title: string;
  message: string;
  type?: string;
  priority?: string;
  actionUrl?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
}

export interface NotificationListFilters {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
  type?: string;
  priority?: string;
}

export class NotificationServiceError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode: number = 400, code: string = 'BAD_REQUEST') {
    super(message);
    this.name = 'NotificationServiceError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Validates notification type and priority.
 */
export function validateNotificationAttributes(type?: string, priority?: string): {
  normalizedType: string;
  normalizedPriority: string;
} {
  const normalizedType = (type || 'INFO').toUpperCase();
  const normalizedPriority = (priority || 'NORMAL').toUpperCase();

  if (!VALID_NOTIFICATION_TYPES.includes(normalizedType as any)) {
    throw new NotificationServiceError(
      `Invalid notification type: '${type}'. Supported types: ${VALID_NOTIFICATION_TYPES.join(', ')}`,
      400,
      'INVALID_TYPE'
    );
  }

  if (!VALID_NOTIFICATION_PRIORITIES.includes(normalizedPriority as any)) {
    throw new NotificationServiceError(
      `Invalid notification priority: '${priority}'. Supported priorities: ${VALID_NOTIFICATION_PRIORITIES.join(', ')}`,
      400,
      'INVALID_PRIORITY'
    );
  }

  return { normalizedType, normalizedPriority };
}

/**
 * Creates a notification for a single recipient.
 */
export async function createNotification(
  input: CreateNotificationInput,
  client: any = prisma
) {
  if (!input.recipientId || typeof input.recipientId !== 'string' || !input.recipientId.trim()) {
    throw new NotificationServiceError('Recipient ID is required', 400, 'MISSING_RECIPIENT');
  }

  if (!input.title || typeof input.title !== 'string' || !input.title.trim()) {
    throw new NotificationServiceError('Notification title is required', 400, 'MISSING_TITLE');
  }

  if (!input.message || typeof input.message !== 'string' || !input.message.trim()) {
    throw new NotificationServiceError('Notification message is required', 400, 'MISSING_MESSAGE');
  }

  const { normalizedType, normalizedPriority } = validateNotificationAttributes(
    input.type,
    input.priority
  );

  return client.notification.create({
    data: {
      recipientId: input.recipientId.trim(),
      title: input.title.trim(),
      message: input.message.trim(),
      type: normalizedType,
      priority: normalizedPriority,
      actionUrl: input.actionUrl?.trim() || null,
      relatedEntityType: input.relatedEntityType?.trim() || null,
      relatedEntityId: input.relatedEntityId?.trim() || null,
    },
  });
}

/**
 * Creates notifications for multiple recipients in batch.
 */
export async function createNotifications(
  recipientIds: string[],
  params: Omit<CreateNotificationInput, 'recipientId'>,
  client: any = prisma
) {
  if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
    return [];
  }

  // Deduplicate and filter non-empty IDs
  const uniqueRecipientIds = Array.from(new Set(recipientIds.map((id) => (id || '').trim()))).filter(Boolean);
  if (uniqueRecipientIds.length === 0) {
    return [];
  }

  if (!params.title || typeof params.title !== 'string' || !params.title.trim()) {
    throw new NotificationServiceError('Notification title is required', 400, 'MISSING_TITLE');
  }

  if (!params.message || typeof params.message !== 'string' || !params.message.trim()) {
    throw new NotificationServiceError('Notification message is required', 400, 'MISSING_MESSAGE');
  }

  const { normalizedType, normalizedPriority } = validateNotificationAttributes(
    params.type,
    params.priority
  );

  const notificationsData = uniqueRecipientIds.map((recipientId) => ({
    recipientId,
    title: params.title.trim(),
    message: params.message.trim(),
    type: normalizedType,
    priority: normalizedPriority,
    actionUrl: params.actionUrl?.trim() || null,
    relatedEntityType: params.relatedEntityType?.trim() || null,
    relatedEntityId: params.relatedEntityId?.trim() || null,
  }));

  // Create notifications sequentially or in transaction to return created records
  if (client.$transaction) {
    return client.$transaction(
      notificationsData.map((data: any) => client.notification.create({ data }))
    );
  } else {
    const results = [];
    for (const data of notificationsData) {
      const created = await client.notification.create({ data });
      results.push(created);
    }
    return results;
  }
}

/**
 * Lists notifications for a specific user with pagination and optional filters.
 */
export async function listNotifications(
  userId: string,
  filters: NotificationListFilters = {},
  client: any = prisma
) {
  if (!userId) {
    throw new NotificationServiceError('User ID is required', 401, 'UNAUTHORIZED');
  }

  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
  const skip = (page - 1) * limit;

  const whereClause: any = {
    recipientId: userId,
  };

  if (filters.unreadOnly === true) {
    whereClause.isRead = false;
  }

  if (filters.type) {
    whereClause.type = filters.type.toUpperCase();
  }

  if (filters.priority) {
    whereClause.priority = filters.priority.toUpperCase();
  }

  const [notifications, total, unreadCount] = await Promise.all([
    client.notification.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    client.notification.count({ where: whereClause }),
    client.notification.count({
      where: {
        recipientId: userId,
        isRead: false,
      },
    }),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;

  return {
    notifications,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
    unreadCount,
  };
}

/**
 * Gets the unread notification count for a user.
 */
export async function getUnreadCount(userId: string, client: any = prisma): Promise<number> {
  if (!userId) return 0;
  return client.notification.count({
    where: {
      recipientId: userId,
      isRead: false,
    },
  });
}

/**
 * Marks a single notification as read, enforcing strict recipient ownership.
 */
export async function markAsRead(
  userId: string,
  notificationId: string,
  client: any = prisma
) {
  if (!userId) {
    throw new NotificationServiceError('Unauthorized', 401, 'UNAUTHORIZED');
  }

  if (!notificationId) {
    throw new NotificationServiceError('Notification ID is required', 400, 'MISSING_ID');
  }

  const existing = await client.notification.findUnique({
    where: { id: notificationId },
  });

  if (!existing) {
    throw new NotificationServiceError('Notification not found', 404, 'NOT_FOUND');
  }

  if (existing.recipientId !== userId) {
    throw new NotificationServiceError(
      'Forbidden: You do not have permission to access this notification',
      403,
      'FORBIDDEN'
    );
  }

  if (existing.isRead) {
    return existing;
  }

  return client.notification.update({
    where: { id: notificationId },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });
}

/**
 * Marks all notifications for a specific user as read.
 */
export async function markAllAsRead(userId: string, client: any = prisma) {
  if (!userId) {
    throw new NotificationServiceError('Unauthorized', 401, 'UNAUTHORIZED');
  }

  const result = await client.notification.updateMany({
    where: {
      recipientId: userId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  return {
    updatedCount: result.count,
  };
}

/**
 * Deletes a single notification, enforcing strict recipient ownership.
 */
export async function deleteNotification(
  userId: string,
  notificationId: string,
  client: any = prisma
) {
  if (!userId) {
    throw new NotificationServiceError('Unauthorized', 401, 'UNAUTHORIZED');
  }

  if (!notificationId) {
    throw new NotificationServiceError('Notification ID is required', 400, 'MISSING_ID');
  }

  const existing = await client.notification.findUnique({
    where: { id: notificationId },
  });

  if (!existing) {
    throw new NotificationServiceError('Notification not found', 404, 'NOT_FOUND');
  }

  if (existing.recipientId !== userId) {
    throw new NotificationServiceError(
      'Forbidden: You do not have permission to delete this notification',
      403,
      'FORBIDDEN'
    );
  }

  await client.notification.delete({
    where: { id: notificationId },
  });

  return { success: true };
}

/**
 * Resolves the active User ID corresponding to an Employee ID.
 */
export async function resolveEmployeeUserId(
  employeeId: string,
  client: any = prisma
): Promise<string | null> {
  if (!employeeId) return null;
  const emp = await client.employee.findUnique({
    where: { id: employeeId },
    select: { userId: true, email: true },
  });
  if (!emp) return null;

  if (emp.userId) {
    const user = await client.user.findUnique({
      where: { id: emp.userId },
      select: { id: true, status: true },
    });
    if (user && ['ACTIVE', 'APPROVED'].includes(user.status)) return user.id;
  }

  if (emp.email) {
    const userByEmail = await client.user.findUnique({
      where: { email: emp.email },
      select: { id: true, status: true },
    });
    if (userByEmail && ['ACTIVE', 'APPROVED'].includes(userByEmail.status)) return userByEmail.id;
  }

  return null;
}

/**
 * Finds all active User IDs matching specified roles and an optional department.
 */
export async function findActiveUserIdsByRole(
  roles: string[],
  departmentId?: string | null,
  client: any = prisma
): Promise<string[]> {
  const where: any = {
    role: { in: roles },
    status: { in: ['ACTIVE', 'APPROVED'] },
  };

  if (departmentId) {
    where.departmentId = departmentId;
  }

  const users = await client.user.findMany({
    where,
    select: { id: true },
  });

  return users.map((u: any) => u.id);
}

/**
 * Safe notification dispatcher for a single user (never throws or crashes business operations).
 */
export async function safeNotifyUser(
  input: CreateNotificationInput,
  client: any = prisma
) {
  try {
    return await createNotification(input, client);
  } catch (err) {
    console.error('[Notification Dispatch Warning] Failed to dispatch notification to user:', err);
    return null;
  }
}

/**
 * Safe notification dispatcher for multiple users (never throws or crashes business operations).
 */
export async function safeNotifyUsers(
  recipientIds: string[],
  params: Omit<CreateNotificationInput, 'recipientId'>,
  client: any = prisma
) {
  try {
    return await createNotifications(recipientIds, params, client);
  } catch (err) {
    console.error('[Notification Dispatch Warning] Failed to dispatch batch notifications:', err);
    return [];
  }
}


