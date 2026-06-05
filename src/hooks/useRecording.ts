import { useRef, useState, useCallback } from 'react';
import type { RemoteParticipant } from './useMeetingRoom';

export type RecordingState = 'idle' | 'recording' | 'uploading' | 'done' | 'error';

interface Options {
  localStream: MediaStream | null;
  remoteParticipants: RemoteParticipant[];
  onStop: (blob: Blob) => Promise<void>;
}

export function useRecording({ localStream, remoteParticipants, onStop }: Options) {
  const [state, setState] = useState<RecordingState>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const start = useCallback(() => {
    if (!localStream) { setErrorMsg('No local stream'); setState('error'); return; }

    chunksRef.current = [];
    const tracks: MediaStreamTrack[] = [];

    // ── Audio: mix local + all remote via Web Audio API ──────────────────────
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const dest = ctx.createMediaStreamDestination();

      const localAudio = localStream.getAudioTracks()[0];
      if (localAudio) {
        ctx.createMediaStreamSource(new MediaStream([localAudio])).connect(dest);
      }
      remoteParticipants.forEach((p) => {
        const audioTrack = p.stream?.getAudioTracks()[0];
        if (audioTrack) {
          ctx.createMediaStreamSource(new MediaStream([audioTrack])).connect(dest);
        }
      });
      dest.stream.getAudioTracks().forEach((t) => tracks.push(t));
    } catch {
      // Web Audio failed (e.g., no audio) — continue without audio mix
    }

    // ── Video: local camera track ─────────────────────────────────────────────
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) tracks.push(videoTrack);

    if (tracks.length === 0) {
      setErrorMsg('Aucune piste média disponible pour l\'enregistrement');
      setState('error');
      return;
    }

    const composite = new MediaStream(tracks);

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm')
      ? 'video/webm'
      : '';

    const recorder = new MediaRecorder(composite, mimeType ? { mimeType } : undefined);
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      audioCtxRef.current?.close();
      audioCtxRef.current = null;

      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      chunksRef.current = [];
      setState('uploading');
      setUploadProgress(0);
      try {
        await onStop(blob);
        setState('done');
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : 'Upload échoué');
        setState('error');
      }
    };

    recorder.onerror = () => {
      setState('error');
      setErrorMsg('Erreur d\'enregistrement');
    };

    recorder.start(1000); // collect a chunk every second
    setState('recording');
  }, [localStream, remoteParticipants, onStop]);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
  }, []);

  return { state, uploadProgress, setUploadProgress, errorMsg, start, stop };
}
