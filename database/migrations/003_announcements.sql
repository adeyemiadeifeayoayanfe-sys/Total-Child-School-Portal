-- ============================================================
-- 003_announcements.sql
-- CEM Total Child School
-- ============================================================
CREATE TYPE announcement_audience AS ENUM (
  'everyone',
  'admins',
  'teachers',
  'parents'
);
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  audience announcement_audience NOT NULL DEFAULT 'everyone',
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_announcements_audience
  ON announcements(audience);
CREATE INDEX IF NOT EXISTS idx_announcements_published
  ON announcements(is_published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_created_by
  ON announcements(created_by);
-- Keep updated_at current when an announcement is edited.
CREATE OR REPLACE FUNCTION update_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS announcements_updated_at ON announcements;
CREATE TRIGGER announcements_updated_at
BEFORE UPDATE ON announcements
FOR EACH ROW
EXECUTE FUNCTION update_announcements_updated_at();


