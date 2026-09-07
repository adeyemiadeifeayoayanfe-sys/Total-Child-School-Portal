import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { useToast } from '../components/ui/Toast';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const { call } = useApi();
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    first_name: user?.profile?.first_name || '',
    last_name: user?.profile?.last_name || '',
    phone: user?.profile?.phone || '',
    address: user?.profile?.address || '',
  });
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
  });
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const handleSaveProfile = async () => {
    setSaving(true);
    const result = await call('/auth/profile', {
      method: 'PUT',
      body: formData,
    });

    if (result.success) {
      showToast('success', 'Profile updated successfully');
      await refreshUser();
    } else {
      showToast('error', result.error || 'Failed to update profile');
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (!passwordForm.current_password || !passwordForm.new_password) {
      showToast('error', 'Please fill in all password fields');
      return;
    }

    if (passwordForm.new_password.length < 8) {
      showToast('error', 'New password must be at least 8 characters');
      return;
    }

    setChangingPassword(true);
    const result = await call('/auth/change-password', {
      method: 'POST',
      body: passwordForm,
    });

    if (result.success) {
      showToast('success', 'Password changed successfully');
      setPasswordForm({ current_password: '', new_password: '' });
    } else {
      showToast('error', result.error || 'Failed to change password');
    }
    setChangingPassword(false);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Profile</h1>
          <p className="page-description">Manage your account information</p>
        </div>
      </div>

      <div className="grid gap-4 max-w-2xl">
        <Card title="Profile Information">
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">First Name</label>
                <input
                  className="form-input"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Last Name</label>
                <input
                  className="form-input"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" value={user?.email || ''} disabled />
              <p className="form-hint">Email cannot be changed. Contact an administrator for assistance.</p>
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input
                className="form-input"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Phone number"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Address</label>
              <textarea
                className="form-textarea"
                rows={2}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Home address"
              />
            </div>
            <Button variant="primary" onClick={handleSaveProfile} loading={saving}>
              Save Profile
            </Button>
          </div>
        </Card>

        <Card title="Change Password">
          <div className="grid gap-4">
            <div className="form-group">
              <label className="form-label">Current Password</label>
              <input
                type="password"
                className="form-input"
                value={passwordForm.current_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                placeholder="Enter current password"
              />
            </div>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input
                type="password"
                className="form-input"
                value={passwordForm.new_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                placeholder="Min 8 characters"
              />
              <p className="form-hint">Minimum 8 characters with uppercase, lowercase, and number.</p>
            </div>
            <Button variant="primary" onClick={handleChangePassword} loading={changingPassword}>
              Change Password
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}