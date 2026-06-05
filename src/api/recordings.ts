import { api } from '../services/api';
import { loadSession } from '../utils/session';

export interface RecordingDto {
  id: number;
  meetingId: number;
  meetingSubject: string;
  meetingDate: string;
  organizationId: number;
  organizationName: string;
  fileName: string;
  fileSizeBytes: number;
  recordedAt: string;
  recordedByName: string;
}

export const getMyRecordings = () =>
  api.get<RecordingDto[]>('/recordings/mine');

export const getMeetingRecordings = (orgId: number, meetingId: number) =>
  api.get<RecordingDto[]>(`/organizations/${orgId}/meetings/${meetingId}/recordings`);

export const deleteRecording = (id: number) =>
  api.delete<void>(`/recordings/${id}`);

export function getDownloadUrl(id: number): string {
  const BASE = import.meta.env.VITE_API_URL as string;
  const token = loadSession()?.token ?? '';
  return `${BASE}/recordings/${id}/download?token=${token}`;
}

export async function uploadRecording(
  orgId: number,
  meetingId: number,
  blob: Blob,
  onProgress?: (pct: number) => void,
): Promise<RecordingDto> {
  const BASE = import.meta.env.VITE_API_URL as string;
  const token = loadSession()?.token ?? '';
  const form = new FormData();
  form.append('file', blob, `recording-${Date.now()}.webm`);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE}/organizations/${orgId}/meetings/${meetingId}/recordings`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText) as RecordingDto);
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('Upload network error'));
    xhr.send(form);
  });
}
