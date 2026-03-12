/**
 * Inline Video Player Component
 * Handles both Vimeo and MP4 videos within [data-video-el="container"] elements
 * - Lazy loads videos when they come into view
 * - Plays/pauses video on click or via dedicated toggle button
 */
import type { VimeoUrl } from '@vimeo/player';

class InlineVideoPlayer {
  private readonly CONTAINER_SELECTOR = '[data-video-el="container"]';
  private readonly VIMEO_SELECTOR = '[data-video-el="vimeo"]';
  private readonly MP4_SELECTOR = '[data-video-el="mp4"]';
  private readonly TOGGLE_BUTTON_SELECTOR = '[data-video-el="toggle"]';

  private readonly VIDEO_URL_ATTR = 'data-video-url';
  private readonly VIDEO_LOOP_ATTR = 'data-video-loop';
  private readonly VIDEO_AUTOPLAY_ATTR = 'data-video-autoplay';
  private readonly VIDEO_MUTE_ATTR = 'data-video-muted';

  private readonly PLAY_STATE_ATTR = 'data-play-state';
  private readonly PLAY_STATE_PLAYING = 'playing';
  private readonly PLAY_STATE_PAUSED = 'paused';
  private readonly PLAY_STATE_NONE = 'none';

  private observer: IntersectionObserver;
  private videoInstances: Map<HTMLElement, any> = new Map();
  private currentlyPlaying: HTMLElement | null = null;

  constructor() {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.initializeVideo(entry.target as HTMLElement);
          }
        });
      },
      {
        rootMargin: '500px', // Start loading when x px away from viewport
        threshold: 0,
      }
    );

    this.initializeAll();
  }

  private initializeAll(): void {
    const containers = document.querySelectorAll(this.CONTAINER_SELECTOR);

    if (containers.length === 0) {
      console.debug('[InlineVideoPlayer] No video containers found');
      return;
    }

    containers.forEach((container) => {
      this.observer.observe(container);
    });

    window.IS_DEBUG_MODE &&
      console.debug('[InlineVideoPlayer] Observing', containers.length, 'video containers');
  }

  private async fetchThumbnail(videoUrl: string): Promise<string | null> {
    try {
      const response = await fetch(
        `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(videoUrl)}&height=1920`
      );

      if (!response.ok) {
        window.IS_DEBUG_MODE &&
          console.error(
            `[InlineVideoPlayer] Failed to fetch thumbnail for the video: ${videoUrl}`,
            response.statusText
          );
        return null;
      }

      const data = await response.json();
      return data.thumbnail_url || null;
    } catch (error) {
      console.error('[InlineVideoPlayer] Error fetching thumbnail:', error);
      return null;
    }
  }

  private async initializeVideo(container: HTMLElement): Promise<void> {
    // Stop observing once we start initializing
    this.observer.unobserve(container);

    // Check if already initialized
    if (this.videoInstances.has(container)) {
      return;
    }

    const vimeoEl = container.querySelector(this.VIMEO_SELECTOR);
    const mp4El = container.querySelector<HTMLVideoElement>(this.MP4_SELECTOR);

    if (!vimeoEl && !mp4El) {
      console.error('[InlineVideoPlayer] No video element found in container', container);
      return;
    }

    const shouldLoop = container.getAttribute(this.VIDEO_LOOP_ATTR) === 'true';
    const shouldAutoplay = container.getAttribute(this.VIDEO_AUTOPLAY_ATTR) === 'true';
    const shouldMute = container.getAttribute(this.VIDEO_MUTE_ATTR) !== 'false'; // Default to true

    const toggleButtons = container.querySelectorAll(this.TOGGLE_BUTTON_SELECTOR);

    let player: any = null;
    let isPlaying = shouldAutoplay;

    const setPlayState = (state: 'playing' | 'paused' | 'none') => {
      container.setAttribute(this.PLAY_STATE_ATTR, state);
      toggleButtons.forEach((btn) => btn.setAttribute(this.PLAY_STATE_ATTR, state));
    };

    // Unified play/pause logic
    const playVideo = async () => {
      if (isPlaying) return;

      // Pause any other currently playing video
      if (this.currentlyPlaying && this.currentlyPlaying !== container) {
        const instance = this.videoInstances.get(this.currentlyPlaying);
        if (instance?.pauseVideo) {
          await instance.pauseVideo();
        }
      }

      try {
        isPlaying = true;
        this.currentlyPlaying = container;
        setPlayState(this.PLAY_STATE_PLAYING);

        if (vimeoEl) {
          await player.setMuted(shouldMute);
          if (!shouldMute) await player.setVolume(1);
          await player.play();
        } else if (mp4El) {
          mp4El.muted = shouldMute;
          if (!shouldMute) mp4El.volume = 1;
          await mp4El.play();
        }
      } catch (err) {
        console.error('[InlineVideoPlayer] Error playing video:', err);
        isPlaying = false;
        this.currentlyPlaying = null;
      }
    };

    const pauseVideo = async () => {
      if (!isPlaying) return;
      isPlaying = false;
      if (this.currentlyPlaying === container) {
        this.currentlyPlaying = null;
      }
      setPlayState(this.PLAY_STATE_PAUSED);

      if (vimeoEl) {
        await player.pause();
      } else if (mp4El) {
        mp4El.pause();
      }
    };

    const togglePlay = async (e?: Event) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (isPlaying) {
        await pauseVideo();
      } else {
        await playVideo();
      }
    };

    // Initialize Vimeo Player
    if (vimeoEl) {
      const videoUrl = vimeoEl.getAttribute(this.VIDEO_URL_ATTR);
      if (!videoUrl) {
        console.error('[InlineVideoPlayer] No video URL found on vimeo element', vimeoEl);
        return;
      }

      // Fetch and apply thumbnail
      const thumbnailUrl = await this.fetchThumbnail(videoUrl);
      if (thumbnailUrl) {
        container.style.setProperty('--thumb', `url('${thumbnailUrl}')`);
      }

      if (!window.Vimeo?.Player) {
        console.error('[InlineVideoPlayer] Vimeo API not available');
        return;
      }

      try {
        player = new window.Vimeo.Player(vimeoEl, {
          url: videoUrl as VimeoUrl,
          background: true,
          muted: true,
          autoplay: true,
          loop: shouldLoop,
        });

        await player.ready();
        await player.setCurrentTime(1);

        if (!shouldAutoplay) {
          await player.pause();
        }

        player.on('ended', () => {
          isPlaying = false;
          if (this.currentlyPlaying === container) this.currentlyPlaying = null;
          setPlayState(this.PLAY_STATE_NONE);
        });
      } catch (error) {
        console.error('[InlineVideoPlayer] Error initializing Vimeo video:', error);
      }
    }
    // Initialize MP4 Player
    else if (mp4El) {
      mp4El.muted = true;
      mp4El.loop = shouldLoop;
      mp4El.autoplay = shouldAutoplay;
      mp4El.setAttribute('playsinline', 'true');
      mp4El.controls = false;

      if (!shouldAutoplay) {
        mp4El.pause();
      }

      mp4El.onended = () => {
        isPlaying = false;
        if (this.currentlyPlaying === container) this.currentlyPlaying = null;
        setPlayState(this.PLAY_STATE_NONE);
      };

      player = mp4El; // Reference for unified logic
    }

    // Store functions for cross-instance calls
    this.videoInstances.set(container, { player, pauseVideo, playVideo });

    // Click handlers
    container.addEventListener('click', () => togglePlay());
    toggleButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => togglePlay(e));
    });

    // Initial state
    setPlayState(shouldAutoplay ? this.PLAY_STATE_PLAYING : this.PLAY_STATE_NONE);

    window.IS_DEBUG_MODE && console.debug('[InlineVideoPlayer] Player initialized for', container);
  }

  public destroy(): void {
    this.observer.disconnect();
    this.videoInstances.forEach((instance) => {
      try {
        if (instance.player && typeof instance.player.destroy === 'function') {
          instance.player.destroy();
        }
      } catch (err) {
        console.error('[InlineVideoPlayer] Error destroying player:', err);
      }
    });
    this.videoInstances.clear();
  }
}

window.loadScript('https://player.vimeo.com/api/player.js', { name: 'vimeo-sdk' });

// Initialize session
window.Webflow = window.Webflow || [];
window.Webflow.push(() => {
  const init = () => new InlineVideoPlayer();

  if (window.Vimeo?.Player) {
    init();
  } else {
    document.addEventListener('scriptLoaded:vimeo-sdk', init, { once: true });
  }
});
