import React, { useCallback, useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { Announcement, AnnouncementAudience } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
const audienceLabels: Record<AnnouncementAudience, string> = {
  everyone: 'Everyone',
  admins: 'Admins',
  teachers: 'Teachers',
  parents: 'Parents',
};
const audienceDescriptions: Record<AnnouncementAudience, string> = {
  everyone: 'All administrators, teachers and parents',
  admins: 'Administrators only',
  teachers: 'Teachers only',
  parents: 'Parents only',
};
function formatDate(value: string | null) {
  if (!value) return 'Not published';
  return new Date(value).toLocaleString('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
function getAudienceLabel(audience: AnnouncementAudience) {
  return audienceLabels[audience] || audience;
}
export default function AnnouncementsPage() {
  const { activeRole } = useAuth();
  const { call, loading } = useApi<Announcement[]>();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [saving, setSaving] = useState(false);
  const isAdmin =
    activeRole === 'admin' ||
    activeRole === 'super_admin';
  const [form, setForm] = useState({
    title: '',
    message: '',
    audience: 'everyone' as AnnouncementAudience,
    is_published: true,
  });
  const fetchAnnouncements = useCallback(async () => {
    const result = await call('/announcements');
    if (result.success) {
      setAnnouncements(result.data || []);
    }
  }, [call]);
  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);
  const openCreate = () => {
    setEditing(null);
    setForm({
      title: '',
      message: '',
      audience: 'everyone',
      is_published: true,
    });
    setShowModal(true);
  };
  const openEdit = (announcement: Announcement) => {
    setEditing(announcement);
    setForm({
      title: announcement.title,
      message: announcement.message,
      audience: announcement.audience,
      is_published: announcement.is_published,
    });
    setShowModal(true);
  };
  const handleSave = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      return;
    }
    setSaving(true);
    const result = await call(
      editing
        ? `/announcements/${editing.id}`
        : '/announcements',
      {
        method: editing ? 'PUT' : 'POST',
        body: form,
      }
    );
    setSaving(false);
    if (result.success) {
      setShowModal(false);
      await fetchAnnouncements();
    }
  };
  const handleDelete = async (announcement: Announcement) => {
    const confirmed = window.confirm(
      `Delete "${announcement.title}"?`
    );
    if (!confirmed) return;
    const result = await call(
      `/announcements/${announcement.id}`,
      { method: 'DELETE' }
    );
    if (result.success) {
      await fetchAnnouncements();
    }
  };
  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Announcements</h1>
          <p>
            School-wide notices and important communication.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate}>
            New Announcement
          </Button>
        )}
      </div>
      {loading && announcements.length === 0 ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : announcements.length === 0 ? (
        <Card>
          <EmptyState
            title="No announcements"
            description={
              isAdmin
                ? 'Create the first announcement for the school community.'
                : 'There are currently no announcements for your account.'
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {announcements.map((announcement) => (
            <Card key={announcement.id}>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold">
                        {announcement.title}
                      </h2>
                      <span className="badge badge-info">
                        {getAudienceLabel(announcement.audience)}
                      </span>
                      {!announcement.is_published && (
                        <span className="badge badge-warning">
                          Draft
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      {formatDate(announcement.published_at)}
                    </p>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openEdit(announcement)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(announcement)}
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
                <div className="whitespace-pre-wrap text-gray-700">
                  {announcement.message}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      {isAdmin && (
        <Modal
          open={showModal}
          onClose={() => !saving && setShowModal(false)}
          title={editing ? 'Edit Announcement' : 'New Announcement'}
        >
          <div className="space-y-5">
            <div>
              <label className="form-label">
                Title
              </label>
              <input
                className="form-input"
                value={form.title}
                maxLength={200}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="Announcement title"
              />
            </div>
            <div>
              <label className="form-label">
                Message
              </label>
              <textarea
                className="form-input min-h-[160px]"
                value={form.message}
                maxLength={5000}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    message: event.target.value,
                  }))
                }
                placeholder="Write the announcement..."
              />
            </div>
            <div>
              <label className="form-label">
                Audience
              </label>
              <select
                className="form-input"
                value={form.audience}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    audience:
                      event.target.value as AnnouncementAudience,
                  }))
                }
              >
                <option value="everyone">
                  Everyone
                </option>
                <option value="admins">
                  Administrators
                </option>
                <option value="teachers">
                  Teachers
                </option>
                <option value="parents">
                  Parents
                </option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {audienceDescriptions[form.audience]}
              </p>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    is_published: event.target.checked,
                  }))
                }
              />
              <span className="text-sm">
                Publish immediately
              </span>
            </label>
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setShowModal(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={
                  saving ||
                  !form.title.trim() ||
                  !form.message.trim()
                }
              >
                {saving
                  ? 'Saving...'
                  : editing
                    ? 'Save Changes'
                    : 'Publish Announcement'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}




