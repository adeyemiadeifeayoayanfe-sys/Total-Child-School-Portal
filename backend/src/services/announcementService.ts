import { supabaseAdmin } from '../config/supabase';
import { AppError, ValidationError, NotFoundError } from '../middleware/errorHandler';
import { logAudit } from '../utils/auditLogger';
import { createNotification } from '../utils/notifications';
export type AnnouncementAudience =
  | 'everyone'
  | 'admins'
  | 'teachers'
  | 'parents';
interface AnnouncementInput {
  title: string;
  message: string;
  audience: AnnouncementAudience;
  is_published?: boolean;
}
function validateAnnouncementInput(input: AnnouncementInput) {
  const title = input.title?.trim();
  const message = input.message?.trim();
  if (!title) {
    throw new ValidationError('Announcement title is required');
  }
  if (title.length > 200) {
    throw new ValidationError('Announcement title must not exceed 200 characters');
  }
  if (!message) {
    throw new ValidationError('Announcement message is required');
  }
  if (message.length > 5000) {
    throw new ValidationError('Announcement message must not exceed 5000 characters');
  }
  const validAudiences: AnnouncementAudience[] = [
    'everyone',
    'admins',
    'teachers',
    'parents',
  ];
  if (!validAudiences.includes(input.audience)) {
    throw new ValidationError('Invalid announcement audience');
  }
  return { title, message };
}
async function getAudienceRoles(audience: AnnouncementAudience) {
  switch (audience) {
    case 'admins':
      return ['admin', 'super_admin'];
    case 'teachers':
      return ['teacher'];
    case 'parents':
      return ['parent'];
    case 'everyone':
    default:
      return ['admin', 'super_admin', 'teacher', 'parent'];
  }
}
async function notifyAnnouncementRecipients(
  announcement: {
    id: string;
    title: string;
    message: string;
    audience: AnnouncementAudience;
  }
) {
  const roles = await getAudienceRoles(announcement.audience);
  const { data: users, error } = await supabaseAdmin
    .from('users')
    .select('id')
    .in('role', roles)
    .eq('status', 'active');
  if (error) {
    throw new AppError('Failed to find announcement recipients', 500);
  }
  if (!users || users.length === 0) {
    return;
  }
  await Promise.all(
    users.map((user) =>
      createNotification({
        user_id: user.id,
        title: announcement.title,
        message: announcement.message,
        notification_type: 'announcement',
        link: '/announcements',
        metadata: {
          announcement_id: announcement.id,
          audience: announcement.audience,
        },
      })
    )
  );
}
export async function createAnnouncement(
  input: AnnouncementInput,
  userId: string
) {
  const { title, message } = validateAnnouncementInput(input);
  const { data, error } = await supabaseAdmin
    .from('announcements')
    .insert({
      title,
      message,
      audience: input.audience,
      is_published: input.is_published !== false,
      published_at: input.is_published === false ? null : new Date().toISOString(),
      created_by: userId,
      updated_by: userId,
    })
    .select('*')
    .single();
  if (error || !data) {
    throw new AppError('Failed to create announcement', 500);
  }
  if (data.is_published) {
    await notifyAnnouncementRecipients(data);
  }
  await logAudit(userId, {
    action: 'create',
    entity_type: 'announcement',
    entity_id: data.id,
    metadata: {
      title,
      audience: data.audience,
      is_published: data.is_published,
    },
  });
  return data;
}
export async function getAnnouncements(options?: {
  includeUnpublished?: boolean;
  audience?: AnnouncementAudience;
}) {
  let query = supabaseAdmin
    .from('announcements')
    .select(`
      *,
      creator:users!announcements_created_by_fkey(
        id,
        email,
        role
      )
    `)
    .order('published_at', { ascending: false })
    .order('created_at', { ascending: false });
  if (!options?.includeUnpublished) {
    query = query.eq('is_published', true);
  }
  if (options?.audience) {
    query = query.in('audience', ['everyone', options.audience]);
  }
  const { data, error } = await query;
  if (error) {
    throw new AppError('Failed to fetch announcements', 500);
  }
  return data || [];
}
export async function getAnnouncementById(id: string) {
  const { data, error } = await supabaseAdmin
    .from('announcements')
    .select(`
      *,
      creator:users!announcements_created_by_fkey(
        id,
        email,
        role
      )
    `)
    .eq('id', id)
    .single();
  if (error || !data) {
    throw new NotFoundError('Announcement not found');
  }
  return data;
}
export async function updateAnnouncement(
  id: string,
  input: Partial<AnnouncementInput>,
  userId: string
) {
  const existing = await getAnnouncementById(id);
  const title = input.title !== undefined
    ? input.title.trim()
    : existing.title;
  const message = input.message !== undefined
    ? input.message.trim()
    : existing.message;
  const audience = input.audience || existing.audience;
  validateAnnouncementInput({
    title,
    message,
    audience,
    is_published: input.is_published ?? existing.is_published,
  });
  const nextPublished =
    input.is_published !== undefined
      ? input.is_published
      : existing.is_published;
  const { data, error } = await supabaseAdmin
    .from('announcements')
    .update({
      title,
      message,
      audience,
      is_published: nextPublished,
      published_at: nextPublished
        ? existing.published_at || new Date().toISOString()
        : null,
      updated_by: userId,
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error || !data) {
    throw new AppError('Failed to update announcement', 500);
  }
  if (!existing.is_published && data.is_published) {
    await notifyAnnouncementRecipients(data);
  }
  await logAudit(userId, {
    action: 'update',
    entity_type: 'announcement',
    entity_id: id,
    metadata: {
      title,
      audience,
      is_published: data.is_published,
    },
  });
  return data;
}
export async function deleteAnnouncement(id: string, userId: string) {
  await getAnnouncementById(id);
  const { error } = await supabaseAdmin
    .from('announcements')
    .delete()
    .eq('id', id);
  if (error) {
    throw new AppError('Failed to delete announcement', 500);
  }
  await logAudit(userId, {
    action: 'delete',
    entity_type: 'announcement',
    entity_id: id,
  });
  return { success: true };
}



