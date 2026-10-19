import { QRCodeSVG } from 'qrcode.react';

// The QR code contains only the pickup code. Scanning it just fills in the code for the business;
// the server still checks everything before a pickup is confirmed.
export default function PickupQr({ code, size = 160 }: { code: string; size?: number }) {
  return (
    <div className="inline-block bg-white p-3 rounded-xl border border-ink-900/10">
      <QRCodeSVG value={code} size={size} level="M" />
    </div>
  );
}
