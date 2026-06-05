import { api } from '../services/api';
import { loadSession } from '../utils/session';

export interface MeetingFileDto {
  id: number;
  meetingId: number;
  meetingSubject: string;
  meetingDate: string;
  organizationId: number;
  organizationName: string;
  fileName: string;
  fileSizeBytes: number;
  contentType?: string;
  uploadedAt: string;
  uploadedByName: string;
  uploadedById: number;
}

export const getMyMeetingFiles = () =>
  api.get<MeetingFileDto[]>('/meeting-files/mine');

export const getMeetingFiles = (orgId: number, meetingId: number) =>
  api.get<MeetingFileDto[]>(`/organizations/${orgId}/meetings/${meetingId}/files`);

export const deleteMeetingFile = (id: number) =>
  api.delete<void>(`/meeting-files/${id}`);

export function getMeetingFileViewUrl(id: number): string {
  const BASE = import.meta.env.VITE_API_URL as string;
  const token = loadSession()?.token ?? '';
  return `${BASE}/meeting-files/${id}/download?inline=true&token=${encodeURIComponent(token)}`;
}

export function getMeetingFileDownloadUrl(id: number): string {
  const BASE = import.meta.env.VITE_API_URL as string;
  const token = loadSession()?.token ?? '';
  return `${BASE}/meeting-files/${id}/download?token=${encodeURIComponent(token)}`;
}

export async function uploadMeetingFile(
  orgId: number,
  meetingId: number,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<MeetingFileDto> {
  const BASE = import.meta.env.VITE_API_URL as string;
  const token = loadSession()?.token ?? '';
  const form = new FormData();
  form.append('file', file, file.name);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE}/organizations/${orgId}/meetings/${meetingId}/files`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText) as MeetingFileDto);
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('Upload network error'));
    xhr.send(form);
  });
}
