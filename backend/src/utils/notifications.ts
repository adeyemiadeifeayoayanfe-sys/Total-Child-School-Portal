import { supabaseAdmin } from '../config/supabase';
import { NotificationType } from '../types';

interface CreateNotificationData {
  user_id: string;
  title: string;
  message: string;
  notification_type?: NotificationType;
  link?: string;
  metadata?: Record<string, any>;
}

export async function createNotification(data: CreateNotificationData): Promise<void> {
  try {
    const recentWindow = new Date(Date.now() - 60 * 1000).toISOString();
    const { data: existing } = await supabaseAdmin
      .from('notifications')
      .select('id')
      .eq('user_id', data.user_id)
      .eq('title', data.title)
      .eq('message', data.message)
      .eq('notification_type', data.notification_type || 'info')
      .eq('link', data.link || null)
      .gte('created_at', recentWindow)
      .maybeSingle();

    if (existing) {
      return;
    }

    await supabaseAdmin.from('notifications').insert({
      user_id: data.user_id,
      title: data.title,
      message: data.message,
      notification_type: data.notification_type || 'info',
      link: data.link || null,
      metadata: data.metadata || {},
    });
  } catch (error) {
    console.error('Notification creation failed:', error);
    // Don't throw - notifications should not break the main operation
  }
}

export async function notifyAdmins(
  title: string,
  message: string,
  notification_type: NotificationType = 'info',
  link?: string
): Promise<void> {
  try {
    const { data: admins } = await supabaseAdmin
      .from('users')
      .select('id')
      .in('role', ['admin', 'super_admin'])
      .eq('status', 'active');

    if (admins) {
      for (const admin of admins) {
        await createNotification({
          user_id: admin.id,
          title,
          message,
          notification_type,
          link,
        });
      }
    }
  } catch (error) {
    console.error('Admin notification failed:', error);
  }
}
