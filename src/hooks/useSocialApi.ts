import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';

const BASE_URL = (import.meta.env.VITE_OUTREACH_API_URL ?? 'http://localhost:3001') + '/api/social';
const BACKEND_URL = import.meta.env.VITE_OUTREACH_API_URL ?? 'http://localhost:3001';

export function useSocialApi() {
  const { currentUser } = useAuth();
  const { activeProjectId } = useProject();

  const headers = useCallback(async (): Promise<Record<string, string>> => {
    if (!currentUser) throw new Error('Not authenticated');
    const token = await currentUser.getIdToken();
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-project-id': activeProjectId ?? '',
    };
  }, [currentUser, activeProjectId]);

  const getAccounts = useCallback(async () => {
    const h = await headers();
    const res = await fetch(`${BASE_URL}/accounts?project_id=${activeProjectId}`, { headers: h });
    if (!res.ok) throw new Error(`Failed to fetch accounts: ${res.status}`);
    return res.json();
  }, [headers, activeProjectId]);

  const deleteAccount = useCallback(async (id: string) => {
    const h = await headers();
    const res = await fetch(`${BASE_URL}/accounts/${id}`, { method: 'DELETE', headers: h });
    if (!res.ok) throw new Error(`Failed to delete account: ${res.status}`);
    return res.json();
  }, [headers]);

  const getPosts = useCallback(async (params?: { status?: string; from?: string; to?: string }) => {
    const h = await headers();
    const qp = new URLSearchParams({ project_id: activeProjectId ?? '', ...(params as any) });
    const res = await fetch(`${BASE_URL}/posts?${qp}`, { headers: h });
    if (!res.ok) throw new Error(`Failed to fetch posts: ${res.status}`);
    return res.json();
  }, [headers, activeProjectId]);

  const createPost = useCallback(async (data: any) => {
    const h = await headers();
    const res = await fetch(`${BASE_URL}/posts`, {
      method: 'POST', headers: h,
      body: JSON.stringify({ ...data, project_id: activeProjectId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to create post: ${res.status}`);
    }
    return res.json();
  }, [headers, activeProjectId]);

  const updatePost = useCallback(async (id: string, data: any) => {
    const h = await headers();
    const res = await fetch(`${BASE_URL}/posts/${id}`, {
      method: 'PATCH', headers: h, body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to update post: ${res.status}`);
    return res.json();
  }, [headers]);

  const deletePost = useCallback(async (id: string) => {
    const h = await headers();
    const res = await fetch(`${BASE_URL}/posts/${id}`, { method: 'DELETE', headers: h });
    if (!res.ok) throw new Error(`Failed to delete post: ${res.status}`);
    return res.json();
  }, [headers]);

  const publishNow = useCallback(async (id: string) => {
    const h = await headers();
    const res = await fetch(`${BASE_URL}/posts/${id}/publish`, { method: 'POST', headers: h });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to publish: ${res.status}`);
    }
    return res.json();
  }, [headers]);

  const getConnectUrl = useCallback((platform: string, source: string = 'social-studio') => {
    return `${BACKEND_URL}/api/social/auth/${platform}?project_id=${activeProjectId}&user_id=${currentUser?.uid || ''}&source=${source}`;
  }, [activeProjectId, currentUser?.uid]);

  const connectTokenAccount = useCallback(async (platform: string, credentials: any) => {
    const h = await headers();
    const res = await fetch(`${BASE_URL}/accounts/token`, {
      method: 'POST', headers: h,
      body: JSON.stringify({ platform, credentials, project_id: activeProjectId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to connect ${platform}: ${res.status}`);
    }
    return res.json();
  }, [headers, activeProjectId]);

  const uploadMedia = useCallback(async (files: File[]) => {
    const h = await headers();
    // Remove content type so browser sets multipart/form-data boundary
    const uploadHeaders = { ...h };
    delete uploadHeaders['Content-Type'];

    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    const res = await fetch(`${BASE_URL}/media`, {
      method: 'POST',
      headers: uploadHeaders,
      body: formData,
    });
    if (!res.ok) throw new Error(`Failed to upload media: ${res.status}`);
    const data = await res.json();
    return data.urls as string[];
  }, [headers]);

  return { getAccounts, deleteAccount, getPosts, createPost, updatePost, deletePost, publishNow, getConnectUrl, connectTokenAccount, uploadMedia, activeProjectId };
}
