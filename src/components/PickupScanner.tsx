import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

// Opens the camera and reads a QR code. Calls onDetected once with the text that was found.
export default function PickupScanner({ onDetected }: { onDetected: (text: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let stopped = false;
    let raf = 0;
    let stream: MediaStream | null = null;
    let lastScan = 0;

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('unsupported');
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        await video.play();
        setStarting(false);

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('canvas');

        const tick = (time: number) => {
          if (stopped) return;
          // Look for a QR code about 8 times per second
          if (time - lastScan > 120 && video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth) {
            lastScan = time;
            const scale = Math.min(1, 640 / video.videoWidth);
            canvas.width = Math.round(video.videoWidth * scale);
            canvas.height = Math.round(video.videoHeight * scale);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const result = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
            if (result && result.data) {
              stopped = true;
              onDetectedRef.current(result.data);
              return;
            }
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch (e) {
        const name = e instanceof DOMException ? e.name : '';
        if (name === 'NotAllowedError') {
          setError('Camera permission was blocked. Allow camera access for this site, or enter the code instead.');
        } else if (name === 'NotFoundError') {
          setError('No camera was found on this device. Please enter the code instead.');
        } else {
          setError("The camera couldn't be started. Please enter the code instead.");
        }
        setStarting(false);
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (error) {
    return <p className="text-sm text-error-700 text-center py-6">{error}</p>;
  }

  return (
    <div>
      <div className="relative rounded-xl overflow-hidden bg-ink-900 aspect-square max-w-sm mx-auto">
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        <div className="absolute inset-8 border-2 border-white/80 rounded-xl pointer-events-none" />
        {starting && (
          <p className="absolute inset-0 flex items-center justify-center text-white text-sm">Starting camera…</p>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <p className="text-xs text-ink-500 text-center mt-3">Point the camera at the customer's QR code.</p>
    </div>
  );
}
