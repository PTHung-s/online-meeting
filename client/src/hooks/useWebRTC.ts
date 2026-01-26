import { useEffect, useRef, useCallback } from 'react';
import { socket } from '../services/socket';
import { useMeetingStore } from '../store/useMeetingStore';

const ICE_CONFIG = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

export const useWebRTC = () => {
  const { 
    localStream, 
    peers,
    addPeer, 
    removePeer, 
    updatePeerStream, 
    updatePeerState
  } = useMeetingStore();
  
  const pcs = useRef<Map<string, RTCPeerConnection>>(new Map());
  const makingOffer = useRef<boolean>(false);
  const ignoreOffer = useRef<boolean>(false);

  const createPC = useCallback((remoteSocketId: string) => {
    if (pcs.current.has(remoteSocketId)) return pcs.current.get(remoteSocketId)!;

    const pc = new RTCPeerConnection(ICE_CONFIG);
    console.log(`Creating PC for ${remoteSocketId}`);
    pcs.current.set(remoteSocketId, pc);

    // Add local tracks
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('rtc:signal', {
          to: remoteSocketId,
          signal: { type: 'ice', candidate: event.candidate }
        });
      }
    };

    pc.ontrack = (event) => {
      console.log(`Received remote track (${event.track.kind}) from ${remoteSocketId}`);
      const remoteStream = event.streams[0] || new MediaStream();
      if (remoteStream.getTracks().indexOf(event.track) === -1) {
        remoteStream.addTrack(event.track);
      }
      updatePeerStream(remoteSocketId, remoteStream);
    };

    // Perfect Negotiation Pattern
    pc.onnegotiationneeded = async () => {
      try {
        makingOffer.current = true;
        await pc.setLocalDescription();
        socket.emit('rtc:signal', {
          to: remoteSocketId,
          signal: { type: 'offer', offer: pc.localDescription }
        });
      } catch (err) {
        console.error("Negotiation error:", err);
      } finally {
        makingOffer.current = false;
      }
    };

    return pc;
  }, [localStream, updatePeerStream]);

  // Handle new joiners and signals
  useEffect(() => {
    const handlePeerJoined = ({ socketId, name }: { socketId: string, name: string }) => {
      addPeer({ socketId, name });
      // When a new peer joins, we create a PC. 
      // This will trigger onnegotiationneeded on this side.
      createPC(socketId);
    };

    const handlePeerLeft = ({ socketId }: { socketId: string }) => {
      pcs.current.get(socketId)?.close();
      pcs.current.delete(socketId);
      removePeer(socketId);
    };

    const handleSignal = async ({ from, signal }: { from: string, signal: any }) => {
      let pc = pcs.current.get(from);
      if (!pc) pc = createPC(from);

      try {
        if (signal.type === 'offer') {
          const polite = socket.id! > from; 
          const offerCollision = (signal.type === 'offer') && (makingOffer.current || pc.signalingState !== 'stable');
          
          ignoreOffer.current = !polite && offerCollision;
          if (ignoreOffer.current) {
            console.log("Collision detected, ignoring offer (impolite)");
            return;
          }

          await pc.setRemoteDescription(new RTCSessionDescription(signal.offer));
          await pc.setLocalDescription(await pc.createAnswer());
          socket.emit('rtc:signal', { 
            to: from, 
            signal: { type: 'answer', answer: pc.localDescription } 
          });

        } else if (signal.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.answer));
        } else if (signal.type === 'ice') {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } catch (e) {
            if (!ignoreOffer.current) throw e;
          }
        }
      } catch (err) {
        console.error("Signaling error:", err);
      }
    };

    const handleUpdateState = ({ socketId, state }: { socketId: string, state: any }) => {
      updatePeerState(socketId, state);
    };

    socket.on('rtc:signal', handleSignal);
    socket.on('peer:update-state', handleUpdateState);
    socket.on('peer:joined', handlePeerJoined);
    socket.on('peer:left', handlePeerLeft);

    return () => {
      socket.off('rtc:signal', handleSignal);
      socket.off('peer:joined', handlePeerJoined);
      socket.off('peer:left', handlePeerLeft);
      socket.off('peer:update-state', handleUpdateState);
    };
  }, [addPeer, removePeer, createPC, updatePeerState]);

  // Remove the initialPeersInitiated block as it's now handled by handlePeerJoined and current peers list
  useEffect(() => {
    peers.forEach(peer => {
      if (!pcs.current.has(peer.socketId)) {
        createPC(peer.socketId);
      }
    });
  }, [peers, createPC]);

  // Handle local track updates (mute/unmute/screen share)
  useEffect(() => {
    if (!localStream) return;
    
    pcs.current.forEach((pc, remoteSocketId) => {
      const localTracks = localStream.getTracks();
      const senders = pc.getSenders();

      // 1. Add or replace tracks
      localTracks.forEach(track => {
        const existingSender = senders.find(s => s.track?.kind === track.kind);
        
        if (existingSender) {
          if (existingSender.track !== track) {
            console.log(`Replacing ${track.kind} track for ${remoteSocketId}`);
            existingSender.replaceTrack(track);
          }
        } else {
          console.log(`Adding new ${track.kind} track to ${remoteSocketId}`);
          pc.addTrack(track, localStream);
          // Manually trigger negotiation
          pc.onnegotiationneeded?.(new Event('negotiationneeded'));
        }
      });

      // 2. Remove tracks that are no longer in localStream
      senders.forEach(sender => {
        if (sender.track && !localTracks.find(t => t.kind === sender.track?.kind)) {
          console.log(`Removing ${sender.track.kind} track from ${remoteSocketId}`);
          pc.removeTrack(sender);
          pc.onnegotiationneeded?.(new Event('negotiationneeded'));
        }
      });
    });
  }, [localStream]);

  return { pcs: pcs.current };
};
