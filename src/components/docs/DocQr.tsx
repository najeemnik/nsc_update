import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/**
 * Wave 27: real scannable verification QR (offline-generated, no CDN).
 * Falls back to nothing while rendering — never blocks the document.
 */
export const DocQr: React.FC<{ payload: string; size?: number; caption?: string }> = ({
  payload, size = 88, caption,
}) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setUrl(null);
    QRCode.toDataURL(payload, { width: 176, margin: 1, errorCorrectionLevel: 'M' })
      .then(u => {
        if (alive) setUrl(u);
      })
      .catch(() => {
        if (alive) setUrl(null);
      });
    return () => {
      alive = false;
    };
  }, [payload]);

  if (!url) return null;
  return (
    <div className="flex flex-col items-center gap-1">
      <img src={url} alt="verification qr" width={size} height={size} className="rounded-lg border border-slate-200" draggable={false} />
      {caption && <span className="text-[9px] text-slate-400 font-semibold">{caption}</span>}
    </div>
  );
};
