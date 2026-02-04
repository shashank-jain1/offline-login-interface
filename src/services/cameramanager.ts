/**
 * Camera Manager - Ensures only one component can access the camera at a time
 */

class CameraManager {
    private activeStream: MediaStream | null = null;
    private activeVideo: HTMLVideoElement | null = null;
  
    /**
     * Get camera stream - releases any existing stream first
     */
    async getStream(videoElement: HTMLVideoElement): Promise<MediaStream> {
      console.log('[CameraManager] Requesting camera stream...');
      
      // Release any existing stream first
      await this.releaseStream();
  
      try {
        console.log('[CameraManager] Requesting getUserMedia...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          },
          audio: false,
        });
  
        console.log('[CameraManager] Got stream, tracks:', stream.getTracks().length);
        
        this.activeStream = stream;
        this.activeVideo = videoElement;
        videoElement.srcObject = stream;
  
        return new Promise((resolve, reject) => {
          videoElement.onloadedmetadata = () => {
            console.log('[CameraManager] Video metadata loaded');
            videoElement.play()
              .then(() => {
                console.log('[CameraManager] Video playing');
                resolve(stream);
              })
              .catch((err) => {
                console.error('[CameraManager] Video play error:', err);
                this.releaseStream();
                reject(err);
              });
          };
  
          videoElement.onerror = (err) => {
            console.error('[CameraManager] Video element error:', err);
            this.releaseStream();
            reject(err);
          };
  
          // Timeout after 10 seconds
          setTimeout(() => {
            if (videoElement.readyState === 0) {
              console.error('[CameraManager] Stream timeout');
              this.releaseStream();
              reject(new Error('Camera stream timeout'));
            }
          }, 10000);
        });
      } catch (error: any) {
        console.error('[CameraManager] getUserMedia error:', error);
        
        // Clear references on error
        this.activeStream = null;
        this.activeVideo = null;
        
        throw error;
      }
    }
  
    /**
     * Release the active camera stream
     */
    async releaseStream(): Promise<void> {
      console.log('[CameraManager] Releasing stream...');
      
      if (this.activeStream) {
        console.log('[CameraManager] Stopping tracks...');
        this.activeStream.getTracks().forEach(track => {
          console.log('[CameraManager] Stopping track:', track.kind, track.id);
          track.stop();
        });
        this.activeStream = null;
      }
  
      if (this.activeVideo) {
        console.log('[CameraManager] Clearing video srcObject');
        this.activeVideo.srcObject = null;
        this.activeVideo = null;
      }
  
      // Give browser time to actually release the camera
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log('[CameraManager] Stream released');
    }
  
    /**
     * Check if camera is currently active
     */
    isActive(): boolean {
      return this.activeStream !== null;
    }
  }
  
  // Singleton instance
  export const cameraManager = new CameraManager();