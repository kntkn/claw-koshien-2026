/**
 * StreamManager handles VDO.Ninja video stream connections.
 * Each participant's stream is received via an iframe/API and
 * exposed as an HTMLVideoElement for texture mapping.
 */

export interface StreamEntry {
  id: string;
  deskId: string;
  videoElement: HTMLVideoElement;
  active: boolean;
}

export class StreamManager {
  private streams = new Map<string, StreamEntry>();
  private container: HTMLDivElement;
  private roomId: string;

  constructor(roomId = 'claw-koshien-2026') {
    this.roomId = roomId;

    // Hidden container for video elements
    this.container = document.createElement('div');
    this.container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;overflow:hidden;';
    document.body.appendChild(this.container);
  }

  /**
   * Add a VDO.Ninja stream.
   * The streamId corresponds to the push ID used by the participant.
   */
  addStream(streamId: string, deskId: string): HTMLVideoElement {
    if (this.streams.has(streamId)) {
      return this.streams.get(streamId)!.videoElement;
    }

    const video = document.createElement('video');
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    video.style.cssText = 'width:640px;height:360px;';

    // VDO.Ninja embed URL for viewing
    const iframe = document.createElement('iframe');
    iframe.allow = 'autoplay; camera; microphone';
    iframe.style.cssText = 'width:640px;height:360px;border:none;';
    iframe.src = `https://vdo.ninja/?view=${streamId}&room=${this.roomId}&cleanoutput&noaudio`;

    this.container.appendChild(iframe);

    // Listen for the iframe's video stream via postMessage API
    const entry: StreamEntry = { id: streamId, deskId, videoElement: video, active: false };
    this.streams.set(streamId, entry);

    // Poll for video in iframe (fallback approach)
    this.pollIframeVideo(iframe, entry);

    return video;
  }

  private pollIframeVideo(iframe: HTMLIFrameElement, entry: StreamEntry) {
    let attempts = 0;
    const poll = setInterval(() => {
      attempts++;
      if (attempts > 60) {
        clearInterval(poll);
        return;
      }
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          const video = iframeDoc.querySelector('video');
          if (video && video.readyState >= 2) {
            entry.videoElement = video;
            entry.active = true;
            clearInterval(poll);
          }
        }
      } catch {
        // Cross-origin, use alternative approach
      }
    }, 1000);
  }

  /**
   * Alternative: directly attach a MediaStream (for local testing)
   */
  attachMediaStream(streamId: string, deskId: string, stream: MediaStream): HTMLVideoElement {
    const video = document.createElement('video');
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    this.container.appendChild(video);

    const entry: StreamEntry = { id: streamId, deskId, videoElement: video, active: true };
    this.streams.set(streamId, entry);
    return video;
  }

  getStream(streamId: string): StreamEntry | undefined {
    return this.streams.get(streamId);
  }

  getStreamByDeskId(deskId: string): StreamEntry | undefined {
    for (const entry of this.streams.values()) {
      if (entry.deskId === deskId) return entry;
    }
    return undefined;
  }

  getActiveStreams(): StreamEntry[] {
    return [...this.streams.values()].filter(s => s.active);
  }

  removeStream(streamId: string) {
    const entry = this.streams.get(streamId);
    if (entry) {
      entry.videoElement.pause();
      entry.videoElement.srcObject = null;
      this.streams.delete(streamId);
    }
  }

  getRoomId(): string {
    return this.roomId;
  }
}
