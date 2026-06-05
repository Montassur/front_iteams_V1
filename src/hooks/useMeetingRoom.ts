import { useEffect, useRef, useState, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { loadSession } from '../utils/session';

export interface RemoteParticipant {
  email: string;
  name: string;
  userId?: number;
  stream: MediaStream | null;
  audioEnabled: boolean;
}

interface Options {
  meetingId: number;
  userEmail: string;
  userName: string;
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

function sanitizeEmail(email: string) {
  return email.replace('@', '_at_').replace(/\./g, '_dot_');
}

export function useMeetingRoom({ meetingId, userEmail, userName }: Options) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([]);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [mediaError, setMediaError] = useState('');

  const stompRef = useRef<Client | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peerConnsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteParticipantsRef = useRef<Map<string, RemoteParticipant>>(new Map());

  const syncRemotes = () =>
    setRemoteParticipants(Array.from(remoteParticipantsRef.current.values()));

  useEffect(() => {
    let mounted = true;

    async function init() {
      // ── 1. Acquire local media ──────────────────────────────────────────────
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (mounted) setIsVideoOn(false);
        } catch {
          stream = new MediaStream();
          if (mounted) { setIsVideoOn(false); setIsAudioOn(false); setMediaError('Caméra/micro non disponible'); }
        }
      }
      if (!mounted) { stream.getTracks().forEach((t) => t.stop()); return; }
      localStreamRef.current = stream;
      setLocalStream(stream);

      // ── helpers ─────────────────────────────────────────────────────────────

      function createPeer(email: string, name: string, userId?: number): RTCPeerConnection {
        // Close any existing stale peer for this email
        const old = peerConnsRef.current.get(email);
        if (old) { old.close(); peerConnsRef.current.delete(email); }

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

        localStreamRef.current?.getTracks().forEach((t) =>
          pc.addTrack(t, localStreamRef.current!));

        // Show the participant immediately as an avatar (stream arrives later via ontrack)
        if (!remoteParticipantsRef.current.has(email)) {
          remoteParticipantsRef.current.set(email, { email, name, userId, stream: null, audioEnabled: true });
          syncRemotes();
        }

        pc.ontrack = (ev) => {
          const existing = remoteParticipantsRef.current.get(email);
          remoteParticipantsRef.current.set(email, {
            email,
            name,
            userId: userId ?? existing?.userId,
            stream: ev.streams[0] ?? existing?.stream ?? null,
            audioEnabled: existing?.audioEnabled ?? true,
          });
          syncRemotes();
        };

        pc.onicecandidate = (ev) => {
          if (!ev.candidate || !stompRef.current?.connected) return;
          stompRef.current.publish({
            destination: '/app/meeting.room.signal',
            body: JSON.stringify({ type: 'ice', meetingId, toEmail: email, candidate: ev.candidate }),
          });
        };

        // Clean up on permanent failure
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
            if (peerConnsRef.current.get(email) === pc) {
              peerConnsRef.current.delete(email);
              remoteParticipantsRef.current.delete(email);
              syncRemotes();
            }
          }
        };

        peerConnsRef.current.set(email, pc);
        return pc;
      }

      // ── 2. STOMP ────────────────────────────────────────────────────────────
      const client = new Client({
        webSocketFactory: () => new SockJS(import.meta.env.VITE_WS_URL as string),
        connectHeaders: { Authorization: `Bearer ${loadSession()?.token ?? ''}` },
        reconnectDelay: 5000,
        onConnect: () => {
          // Room events (join / leave)
          client.subscribe(`/topic/meeting/${meetingId}/room`, async (frame) => {
            const msg = JSON.parse(frame.body);
            if (msg.fromEmail === userEmail) return;

            if (msg.type === 'join') {
              // We are already in the room → offer to the newcomer
              const pc = createPeer(msg.fromEmail, msg.fromName, msg.fromUserId ?? undefined);
              try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                client.publish({
                  destination: '/app/meeting.room.signal',
                  body: JSON.stringify({
                    type: 'offer',
                    meetingId,
                    toEmail: msg.fromEmail,
                    fromName: userName,
                    sdp: offer.sdp,
                  }),
                });
              } catch (e) {
                console.warn('[WebRTC] failed to send offer to', msg.fromEmail, e);
              }
            } else if (msg.type === 'leave') {
              peerConnsRef.current.get(msg.fromEmail)?.close();
              peerConnsRef.current.delete(msg.fromEmail);
              remoteParticipantsRef.current.delete(msg.fromEmail);
              syncRemotes();
            }
          });

          // Personal WebRTC signals
          const myTopic = `/topic/meeting/${meetingId}/signal/${sanitizeEmail(userEmail)}`;
          client.subscribe(myTopic, async (frame) => {
            const msg = JSON.parse(frame.body);

            if (msg.type === 'offer') {
              let pc = peerConnsRef.current.get(msg.fromEmail);
              if (!pc) pc = createPeer(msg.fromEmail, msg.fromName || msg.fromEmail, msg.fromUserId ?? undefined);

              // ── Perfect negotiation: resolve glare ──────────────────────────
              // "Polite" peer (lexicographically larger email) rolls back its own
              // pending offer and accepts the incoming one.
              // "Impolite" peer ignores the incoming offer so its own offer wins.
              const offerCollision = pc.signalingState !== 'stable';
              const isPolite = userEmail > msg.fromEmail;

              if (offerCollision && !isPolite) {
                // We are impolite and there is a collision — discard their offer,
                // our offer will be answered instead.
                return;
              }

              try {
                if (offerCollision) {
                  // Polite side: roll back our pending offer before accepting theirs
                  await pc.setLocalDescription({ type: 'rollback' });
                }
                await pc.setRemoteDescription({ type: 'offer', sdp: msg.sdp });
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                client.publish({
                  destination: '/app/meeting.room.signal',
                  body: JSON.stringify({
                    type: 'answer',
                    meetingId,
                    toEmail: msg.fromEmail,
                    fromName: userName,
                    sdp: answer.sdp,
                  }),
                });
              } catch (e) {
                console.warn('[WebRTC] error handling offer from', msg.fromEmail, e);
              }

            } else if (msg.type === 'answer') {
              const pc = peerConnsRef.current.get(msg.fromEmail);
              if (pc && pc.signalingState !== 'stable') {
                try {
                  await pc.setRemoteDescription({ type: 'answer', sdp: msg.sdp });
                } catch (e) {
                  console.warn('[WebRTC] error handling answer from', msg.fromEmail, e);
                }
              }
            } else if (msg.type === 'ice') {
              const pc = peerConnsRef.current.get(msg.fromEmail);
              if (pc && msg.candidate) {
                try { await pc.addIceCandidate(msg.candidate); } catch { /* stale */ }
              }
            }
          });

          // Announce presence to other participants
          client.publish({
            destination: '/app/meeting.room.join',
            body: JSON.stringify({ meetingId, fromName: userName }),
          });
          if (mounted) setIsConnected(true);
        },
      });

      client.activate();
      stompRef.current = client;
    }

    init();

    return () => {
      mounted = false;
      if (stompRef.current?.connected) {
        stompRef.current.publish({
          destination: '/app/meeting.room.leave',
          body: JSON.stringify({ meetingId }),
        });
      }
      peerConnsRef.current.forEach((pc) => pc.close());
      peerConnsRef.current.clear();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      stompRef.current?.deactivate();
    };
  }, [meetingId, userEmail, userName]);

  // ── Controls ─────────────────────────────────────────────────────────────────

  const toggleAudio = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsAudioOn(track.enabled);
  }, []);

  const toggleVideo = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsVideoOn(track.enabled);
  }, []);

  const startScreenShare = useCallback(async () => {
    try {
      const screenStream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true });
      screenStreamRef.current = screenStream;
      const screenTrack: MediaStreamTrack = screenStream.getVideoTracks()[0];

      peerConnsRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        sender?.replaceTrack(screenTrack);
      });

      const previewStream = new MediaStream();
      localStreamRef.current?.getAudioTracks().forEach((t) => previewStream.addTrack(t));
      previewStream.addTrack(screenTrack);
      setLocalStream(previewStream);
      setIsScreenSharing(true);

      screenTrack.onended = () => {
        screenStreamRef.current?.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
        const camTrack = localStreamRef.current?.getVideoTracks()[0];
        peerConnsRef.current.forEach((pc) => {
          const s = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (s && camTrack) s.replaceTrack(camTrack);
        });
        setLocalStream(localStreamRef.current);
        setIsScreenSharing(false);
      };
    } catch { /* user cancelled */ }
  }, []);

  const stopScreenShare = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  return {
    localStream,
    remoteParticipants,
    isAudioOn,
    isVideoOn,
    isScreenSharing,
    isConnected,
    mediaError,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
  };
}
