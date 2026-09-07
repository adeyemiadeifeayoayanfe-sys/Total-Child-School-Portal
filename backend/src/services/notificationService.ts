import { supabaseAdmin } from '../config/supabase';
import { AppError, NotFoundError } from '../middleware/errorHandler';

export async function getUserNotifications(userId: string, unreadOnly: boolean = false) {
  let query = supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('user_id', userId);

  if (unreadOnly) {
    query = query.eq('is_read', false);
  }

  const { data, error } = await query.order('created_at', { ascending: false }).limit(50);

  if (error) {
    throw new AppError('Failed to fetch notifications', 500);
  }

  return data || [];
}

export async function markNotificationRead(notificationId: string, userId: string) {
  const { data: existing } = await supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('id', notificationId)
    .eq('user_id', userId)
    .single();

  if (!existing) {
    throw new NotFoundError('Notification not found');
  }

  const { data: updated, error } = await supabaseAdmin
    .from('notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('id', notificationId)
    .select()
    .single();

  if (error || !updated) {
    throw new AppError('Failed to mark notification as read', 500);
  }

  return updated;
}

export async function markAllNotificationsRead(userId: string) {
  const { error } = await supabaseAdmin
    .from('notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    throw new AppError('Failed to mark all notifications as read', 500);
  }

  return { success: true };
}

export async function getUnreadCount(userId: string) {
  const { count, error } = await supabaseAdmin
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    throw new AppError('Failed to fetch unread count', 500);
  }

  return { unread_count: count || 0 };
}

export async function deleteNotification(notificationId: string, userId: string) {
  const { error } = await supabaseAdmin
    .from('notifications')
    .delete()
    .eq('id', notificationId)
    .eq('user_id', userId);

  if (error) {
    throw new AppError('Failed to delete notification', 500);
  }

  return { success: true };
}