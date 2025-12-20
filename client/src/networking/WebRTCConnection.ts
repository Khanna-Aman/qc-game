/**
 * WebRTC P2P Connection Manager
 * Handles peer connection, data channels, and signaling
 */

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'failed';

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'peer_joined' | 'peer_disconnected' | 'connected';
  sdp?: string;
  candidate?: RTCIceCandidateInit;
  role?: 'host' | 'guest';
  game_seed?: number;
}

export interface WebRTCCallbacks {
  onStateChange: (state: ConnectionState) => void;
  onMessage: (data: unknown) => void;
  onGameSeed: (seed: number) => void;
  onReconnecting?: (attempt: number) => void;
}

interface ReconnectConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

// Free public STUN servers
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ]
};

const DEFAULT_RECONNECT_CONFIG: ReconnectConfig = {
  maxAttempts: 5,
  baseDelayMs: 1000,
  maxDelayMs: 10000
};

export class WebRTCConnection {
  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private ws: WebSocket | null = null;
  private callbacks: WebRTCCallbacks;
  private isHost: boolean = false;
  private pendingCandidates: RTCIceCandidateInit[] = [];

  // Reconnection state
  private serverUrl: string = '';
  private roomId: string = '';
  private reconnectAttempts: number = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectConfig: ReconnectConfig;
  private isReconnecting: boolean = false;

  constructor(callbacks: WebRTCCallbacks, reconnectConfig?: Partial<ReconnectConfig>) {
    this.callbacks = callbacks;
    this.reconnectConfig = { ...DEFAULT_RECONNECT_CONFIG, ...reconnectConfig };
  }

  /**
   * Calculate delay with exponential backoff
   */
  private getReconnectDelay(): number {
    const delay = Math.min(
      this.reconnectConfig.baseDelayMs * Math.pow(2, this.reconnectAttempts),
      this.reconnectConfig.maxDelayMs
    );
    // Add jitter (±20%)
    return delay * (0.8 + Math.random() * 0.4);
  }

  /**
   * Attempt to reconnect
   */
  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.reconnectConfig.maxAttempts) {
      console.log('[Reconnect] Max attempts reached, giving up');
      this.callbacks.onStateChange('failed');
      return;
    }

    this.reconnectAttempts++;
    this.isReconnecting = true;
    this.callbacks.onReconnecting?.(this.reconnectAttempts);
    console.log(`[Reconnect] Attempt ${this.reconnectAttempts}/${this.reconnectConfig.maxAttempts}`);

    const delay = this.getReconnectDelay();
    console.log(`[Reconnect] Waiting ${Math.round(delay)}ms...`);

    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.connect(this.serverUrl, this.roomId, true);
      } catch (err) {
        console.error('[Reconnect] Failed:', err);
        await this.attemptReconnect();
      }
    }, delay);
  }

  /**
   * Cancel any pending reconnection
   */
  private cancelReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.isReconnecting = false;
  }

  /**
   * Connect to signaling server and establish P2P connection
   */
  async connect(serverUrl: string, roomId: string, isReconnect: boolean = false): Promise<void> {
    // Store connection info for reconnection
    this.serverUrl = serverUrl;
    this.roomId = roomId;

    if (!isReconnect) {
      this.reconnectAttempts = 0;
    }

    this.callbacks.onStateChange('connecting');

    // Connect to signaling WebSocket
    const wsUrl = `${serverUrl.replace('http', 'ws')}/ws/${roomId}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('[WS] Connected to signaling server');
      // Reset reconnect attempts on successful connection
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
    };

    this.ws.onmessage = async (event) => {
      const message: SignalingMessage = JSON.parse(event.data);
      await this.handleSignalingMessage(message);
    };

    this.ws.onerror = (error) => {
      console.error('[WS] Error:', error);
      if (!this.isReconnecting) {
        this.attemptReconnect();
      }
    };

    this.ws.onclose = () => {
      console.log('[WS] Disconnected from signaling server');
      // Attempt reconnection if we were connected and this wasn't intentional
      if (!this.isReconnecting && this.reconnectAttempts === 0) {
        this.attemptReconnect();
      }
    };
  }

  private async handleSignalingMessage(message: SignalingMessage): Promise<void> {
    console.log('[Signal]', message.type);

    switch (message.type) {
      case 'connected':
        this.isHost = message.role === 'host';
        if (message.game_seed) {
          this.callbacks.onGameSeed(message.game_seed);
        }
        if (this.isHost) {
          // Host waits for guest
          console.log('[P2P] Waiting for peer to join...');
        }
        break;

      case 'peer_joined':
        if (message.game_seed) {
          this.callbacks.onGameSeed(message.game_seed);
        }
        // Host initiates P2P connection
        await this.createPeerConnection();
        await this.createOffer();
        break;

      case 'offer':
        await this.createPeerConnection();
        await this.handleOffer(message.sdp!);
        break;

      case 'answer':
        await this.handleAnswer(message.sdp!);
        break;

      case 'ice-candidate':
        await this.handleIceCandidate(message.candidate!);
        break;

      case 'peer_disconnected':
        this.callbacks.onStateChange('disconnected');
        break;
    }
  }

  private async createPeerConnection(): Promise<void> {
    this.pc = new RTCPeerConnection(ICE_SERVERS);

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignaling({
          type: 'ice-candidate',
          candidate: event.candidate.toJSON()
        });
      }
    };

    this.pc.onconnectionstatechange = () => {
      console.log('[P2P] Connection state:', this.pc?.connectionState);
      if (this.pc?.connectionState === 'connected') {
        this.callbacks.onStateChange('connected');
      } else if (this.pc?.connectionState === 'failed') {
        this.callbacks.onStateChange('failed');
      }
    };

    if (this.isHost) {
      // Host creates data channel
      this.dataChannel = this.pc.createDataChannel('game', {
        ordered: true
      });
      this.setupDataChannel();
    } else {
      // Guest receives data channel
      this.pc.ondatachannel = (event) => {
        this.dataChannel = event.channel;
        this.setupDataChannel();
      };
    }
  }

  private setupDataChannel(): void {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      console.log('[DataChannel] Open');
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
      this.callbacks.onStateChange('connected');
    };

    this.dataChannel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.callbacks.onMessage(data);
      } catch {
        console.error('[DataChannel] Failed to parse message');
      }
    };

    this.dataChannel.onclose = () => {
      console.log('[DataChannel] Closed');
      this.callbacks.onStateChange('disconnected');
      // Attempt reconnection if not already doing so
      if (!this.isReconnecting && this.reconnectAttempts < this.reconnectConfig.maxAttempts) {
        this.attemptReconnect();
      }
    };

    this.dataChannel.onerror = (error) => {
      console.error('[DataChannel] Error:', error);
    };
  }

  private async createOffer(): Promise<void> {
    if (!this.pc) return;

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    this.sendSignaling({
      type: 'offer',
      sdp: offer.sdp
    });
  }

  private async handleOffer(sdp: string): Promise<void> {
    if (!this.pc) return;

    await this.pc.setRemoteDescription({ type: 'offer', sdp });

    // Process any pending ICE candidates
    for (const candidate of this.pendingCandidates) {
      await this.pc.addIceCandidate(candidate);
    }
    this.pendingCandidates = [];

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    this.sendSignaling({
      type: 'answer',
      sdp: answer.sdp
    });
  }

  private async handleAnswer(sdp: string): Promise<void> {
    if (!this.pc) return;

    await this.pc.setRemoteDescription({ type: 'answer', sdp });

    // Process any pending ICE candidates
    for (const candidate of this.pendingCandidates) {
      await this.pc.addIceCandidate(candidate);
    }
    this.pendingCandidates = [];
  }

  private async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.pc || !this.pc.remoteDescription) {
      // Queue candidate if remote description not set yet
      this.pendingCandidates.push(candidate);
      return;
    }

    await this.pc.addIceCandidate(candidate);
  }

  private sendSignaling(message: SignalingMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send game data to peer
   */
  send(data: unknown): void {
    if (this.dataChannel?.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(data));
    }
  }

  /**
   * Close all connections (intentional disconnect, no reconnect)
   */
  disconnect(): void {
    // Cancel any pending reconnect
    this.cancelReconnect();
    this.reconnectAttempts = this.reconnectConfig.maxAttempts; // Prevent auto-reconnect

    this.dataChannel?.close();
    this.pc?.close();
    this.ws?.close();
    this.dataChannel = null;
    this.pc = null;
    this.ws = null;
  }

  /**
   * Check if currently attempting to reconnect
   */
  isAttemptingReconnect(): boolean {
    return this.isReconnecting;
  }

  /**
   * Get current reconnection attempt number
   */
  getReconnectAttempt(): number {
    return this.reconnectAttempts;
  }
}

