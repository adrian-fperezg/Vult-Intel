import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getMediaUrl(url: string | undefined | null): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('data:')) return url;
  if (url.startsWith('blob:')) return url;
  
  const backendUrl = import.meta.env.VITE_OUTREACH_API_URL || 'http://localhost:3001';
  // Ensure no double slashes
  const baseUrl = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;
  const path = url.startsWith('/') ? url : `/${url}`;
  
  return `${baseUrl}${path}`;
}

