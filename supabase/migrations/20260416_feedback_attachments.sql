-- Migration: Add image attachments support for Feedback
-- Date: 2026-04-16

-- 1. Add attachment_url to feedback table
ALTER TABLE public.feedback 
ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- 2. Create Storage Bucket for Feedback Attachments
-- We use a script that is safe to run multiple times
INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback_attachments', 'feedback_attachments', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Set RLS Policies for Storage
-- Allow anyone to read (public bucket)
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'feedback_attachments');

-- Allow authenticated users to upload their feedback images
CREATE POLICY "Authenticated users can upload feedback" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'feedback_attachments');

-- Allow users to delete their own attachments if needed
CREATE POLICY "Users can delete their own feedback images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'feedback_attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
