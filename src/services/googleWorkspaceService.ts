import { auth } from '../lib/firebase';

const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Creates a Google Doc via the Railway backend proxy.
 * The backend uses a Service Account to call Google Drive API server-side,
 * so no Google OAuth token is ever handled in the browser.
 */
export const createGoogleDocFromHtml = async (html: string, title: string): Promise<string> => {
    const user = auth.currentUser;
    if (!user) throw new Error('User must be logged in to export to Google Docs.');

    const idToken = await user.getIdToken(true);

    const res = await fetch(`${API_BASE}/api/workspace/export-doc`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ html, title }),
    });

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to create Google Doc (${res.status})`);
    }

    const data = await res.json();
    return data.url;
};

/**
 * Creates a Google Sheet via the Railway backend proxy.
 * The backend uses a Service Account to call Google Drive API server-side,
 * so no Google OAuth token is ever handled in the browser.
 */
export const createGoogleSheetFromCsv = async (csv: string, title: string): Promise<string> => {
    const user = auth.currentUser;
    if (!user) throw new Error('User must be logged in to export to Google Sheets.');

    const idToken = await user.getIdToken(true);

    const res = await fetch(`${API_BASE}/api/workspace/export-sheet`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ csv, title }),
    });

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to create Google Sheet (${res.status})`);
    }

    const data = await res.json();
    return data.url;
};
