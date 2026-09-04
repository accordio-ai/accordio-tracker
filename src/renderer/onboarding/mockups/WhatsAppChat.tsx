// Ported verbatim from the marketing site (components/landing/WhatsAppChat.tsx)
// for the setup window's trial step. Keep in sync by copy.

import { useState, useEffect, useRef } from 'react';
import { BrandMark } from './brand';

// The phone mockup renders the same scripted conversations in four skins —
// Claude, WhatsApp, Telegram and Slack — switched by the hero tabs.
export type ChatPlatform = 'claude' | 'whatsapp' | 'telegram' | 'slack';

export interface Message {
  role: 'assistant' | 'user';
  text: string;
  time: string;
  attachment?: 'pdf';
  // Voice notes render as a WhatsApp voice bubble with a real, playable file.
  // `text` is used as the accessible label instead of visible copy.
  voice?: boolean;
  // Link messages render as their own bubble with a WhatsApp-style preview card
  link?: string;
  linkTitle?: string;
  linkDesc?: string;
  linkBanner?: string; // big stat rendered in the og-image banner
}

// The Claude starburst mark, used by the Claude phone skin and platform tab.
export function ClaudeStar({ size = 16, color = 'hsl(14.8, 63.1%, 59.6%)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill={color} aria-hidden="true">
      <path d="m19.6 66.5 19.7-11 .3-1-.3-.5h-1l-3.3-.2-11.2-.3L14 53l-9.5-.5-2.4-.5L0 49l.2-1.5 2-1.3 2.9.2 6.3.5 9.5.6 6.9.4L38 49.1h1.6l.2-.7-.5-.4-.4-.4L29 41l-10.6-7-5.6-4.1-3-2-1.5-2-.6-4.2 2.7-3 3.7.3.9.2 3.7 2.9 8 6.1L37 36l1.5 1.2.6-.4.1-.3-.7-1.1L33 25l-6-10.4-2.7-4.3-.7-2.6c-.3-1-.4-2-.4-3l3-4.2L28 0l4.2.6L33.8 2l2.6 6 4.1 9.3L47 29.9l2 3.8 1 3.4.3 1h.7v-.5l.5-7.2 1-8.7 1-11.2.3-3.2 1.6-3.8 3-2L61 2.6l2 2.9-.3 1.8-1.1 7.7L59 27.1l-1.5 8.2h.9l1-1.1 4.1-5.4 6.9-8.6 3-3.5L77 13l2.3-1.8h4.3l3.1 4.7-1.4 4.9-4.4 5.6-3.7 4.7-5.3 7.1-3.2 5.7.3.4h.7l12-2.6 6.4-1.1 7.6-1.3 3.5 1.6.4 1.6-1.4 3.4-8.2 2-9.6 2-14.3 3.3-.2.1.2.3 6.4.6 2.8.2h6.8l12.6 1 3.3 2 1.9 2.7-.3 2-5.1 2.6-6.8-1.6-16-3.8-5.4-1.3h-.8v.4l4.6 4.5 8.3 7.5L89 80.1l.5 2.4-1.3 2-1.4-.2-9.2-7-3.6-3-8-6.8h-.5v.7l1.8 2.7 9.8 14.7.5 4.5-.7 1.4-2.6 1-2.7-.6-5.8-8-6-9-4.7-8.2-.5.4-2.9 30.2-1.3 1.5-3 1.2-2.5-2-1.4-3 1.4-6.2 1.6-8 1.3-6.4 1.2-7.9.7-2.6v-.2H49L43 72l-9 12.3-7.2 7.6-1.7.7-3-1.5.3-2.8L24 86l10-12.8 6-7.9 4-4.6-.1-.5h-.3L17.2 77.4l-4.7.6-2-2 .2-3 1-1 8-5.5Z" />
    </svg>
  );
}

// Accordio leaf mark for the link-preview banners and app avatar
export function AccordioLeaf({ size = 16, color = '#78d277' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M25.4535 9.69495C26.7885 8.34607 28.1235 6.36012 30.0541 2.53354C30.2145 2.21573 29.9705 1.84176 29.6146 1.85024C9.12978 2.33837 6.35583 21.9399 4.96014 30.4009H7.78681C8.77614 25.6885 11.2295 22.9753 15.0455 22.5469C20.4983 21.8583 24.4576 17.1841 25.9998 13.0093C26.0925 12.7584 25.9517 12.4851 25.6967 12.4045L23.4641 11.6989L25.4535 9.69495Z" fill={color} />
      <path d="M6.21963 2.37033C6.4017 2.03743 6.87982 2.03743 7.06189 2.37033L7.34331 2.88488C8.04808 4.1735 9.10759 5.23301 10.3962 5.93778L10.9108 6.2192C11.2437 6.40127 11.2437 6.87939 10.9108 7.06146L10.3962 7.34287C9.10759 8.04764 8.04808 9.10715 7.34331 10.3958L7.06189 10.9103C6.87982 11.2432 6.4017 11.2432 6.21963 10.9103L5.93822 10.3958C5.23345 9.10715 4.17394 8.04764 2.88531 7.34287L2.37077 7.06146C2.03787 6.87939 2.03787 6.40127 2.37077 6.2192L2.88532 5.93778C4.17394 5.23301 5.23345 4.1735 5.93822 2.88488L6.21963 2.37033Z" fill={color} />
    </svg>
  );
}

// One scenario per skill tab
const scenarios: Message[][] = [
  // 0 — Time tracker (the connector demo hero: tracked day → unbilled → invoice)
  [
    { role: 'user', text: 'how much did I work today?', time: '17:40' },
    { role: 'assistant', text: "6.2h tracked:\n\n• Acme Corp — 3.1h, wireframes\n• FreshBrand — 1.6h, call + follow-up\n• Admin — 1.5h\n\nAcme is at $2,340 unbilled this month.", time: '17:40' },
    { role: 'user', text: 'draft the invoice', time: '17:41' },
    { role: 'assistant', text: 'Draft ready. Review and send:', time: '17:41', link: 'accordio.ai/i/acme-march', linkTitle: 'Invoice — Acme Corp', linkDesc: '$2,340 · 18.5h tracked · Draft', linkBanner: '$2,340' },
  ],
  // 1 — Create & sign contracts
  [
    { role: 'user', text: 'Voice message: new contract for Sarah Chen, brand redesign, $4,800, 6 weeks', time: '10:15', voice: true },
    { role: 'assistant', text: 'Contract drafted with your standard terms. 3 milestones, 50% upfront. E-sign link sent to sarah@designco.com.', time: '10:16' },
    { role: 'assistant', text: "Here's the signing link:", time: '10:16', link: 'accordio.ai/sign/brand-redesign', linkTitle: 'Brand Redesign — Service Agreement', linkDesc: 'Sarah Chen · $4,800 · Awaiting signature', linkBanner: '$4,800' },
    { role: 'assistant', text: '✅ Sarah signed. First milestone ($2,400) invoice auto-created.', time: '10:44' },
  ],
  // 2 — Keeps your books
  [
    { role: 'user', text: 'expense this one', time: '13:12', attachment: 'pdf' },
    { role: 'assistant', text: '$1,240 from Northwind Studio, filed under Subcontractors. Invoice saved to your books and attached to the Acme project.', time: '13:12' },
    { role: 'assistant', text: 'Also: a $2,400 deposit from Acme Corp just landed in your bank. Matched to invoice #41 and marked paid. ✅', time: '13:13' },
  ],
  // 3 — Proactive alerts
  [
    { role: 'assistant', text: "Heads up. Invoice #32 for TechStart is 5 days overdue ($3,200). Want me to chase it?", time: '08:02' },
    { role: 'user', text: 'yeah go for it', time: '08:03' },
    { role: 'assistant', text: "Done. Payment reminder sent to mark@techstart.io. I'll follow up Friday if they don't pay.", time: '08:03' },
    { role: 'assistant', text: "Here's the payment link:", time: '08:03', link: 'accordio.ai/pay/inv-32', linkTitle: 'Invoice #32 — TechStart', linkDesc: '$3,200 · Pay by card or bank transfer', linkBanner: '$3,200' },
  ],
  // 4 — Manages your inbox
  [
    { role: 'assistant', text: "New email from Acme Corp: they want to push the launch to March 25. Want me to reply?", time: '11:20' },
    { role: 'user', text: 'yes, agree but keep the budget the same', time: '11:21' },
    { role: 'assistant', text: '✅ Reply sent. Confirmed the new date and noted that scope and budget are unchanged.', time: '11:21' },
  ],
  // 5 — Meeting recorder
  [
    { role: 'assistant', text: "Your call with Acme Corp just ended (38 min). Here's what I caught:\n\n• They want the homepage done by March 20\n• Budget increased to $6,000\n• John needs the Figma link today", time: '15:45' },
    { role: 'user', text: 'update the contract and send john the new slides', time: '15:46' },
    { role: 'assistant', text: '✅ Contract amended to $6,000, sent for re-sign. Updated deck shared with john@acme.com.', time: '15:46' },
    { role: 'assistant', text: 'Preview of the deck:', time: '15:46', link: 'accordio.ai/d/acme-homepage', linkTitle: 'Acme Homepage — Proposal', linkDesc: '12 slides · Updated 1 min ago', linkBanner: '12 slides' },
  ],
];

// Drip timings — shared with the exported per-scenario duration below so the
// parent's autoplay never switches tabs before a conversation has finished.
const GAP_FIRST = 200;
const GAP_AFTER_USER = 800;
const GAP_AFTER_ASSISTANT = 1600;
const GAP_LINK = 450;
const TYPING_FIRST = 500;
const TYPING = 1200;

// How long a conversation takes to play out end to end, in ms.
export function scenarioDuration(scenario: Message[]) {
  return scenario.reduce((total, msg, i) => {
    const isFirst = i === 0;
    const gap = isFirst ? GAP_FIRST : scenario[i - 1].role === 'user' ? GAP_AFTER_USER : GAP_AFTER_ASSISTANT;
    if (msg.role !== 'assistant') return total + gap;
    if (msg.link) return total + GAP_LINK;
    return total + gap + (isFirst ? TYPING_FIRST : TYPING);
  }, 0);
}

export const SCENARIO_DURATIONS = scenarios.map(scenarioDuration);

// Document attachment — WhatsApp renders a PDF as a first-page crop flush to
// the top of the bubble, then a file row underneath (icon, name, page/size meta).
function InvoiceRow({ label, val }: { label: string; val: string }) {
  return (
    <div className="flex items-baseline justify-between" style={{ fontSize: 7.5, color: '#3d3d39', lineHeight: 2 }}>
      <span>{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{val}</span>
    </div>
  );
}

// `light` renders the Slack variant: no bubble to bleed into, dark text on
// white. `darkText` flips only the file-row text (for light bubbles like
// Telegram's); `bleedRadius` matches the bubble's top corner radius.
function PdfAttachment({ light = false, darkText, bleedRadius = 8 }: { light?: boolean; darkText?: boolean; bleedRadius?: number }) {
  const dark = darkText ?? light;
  return (
    <div style={{ width: 250 }}>
      {/* First-page crop — full-bleed, matching the bubble's top corners */}
      <div
        className={light ? 'mb-2 rounded-lg' : '-mx-3 -mt-1.5 mb-2'}
        style={{
          background: '#ffffff',
          height: 146,
          overflow: 'hidden',
          ...(light
            ? { border: '1px solid rgba(29,28,29,0.13)' }
            : { borderTopLeftRadius: bleedRadius, borderTopRightRadius: bleedRadius }),
          padding: '26px 20px 0',
          fontFamily: 'ui-sans-serif, -apple-system, Helvetica, Arial, sans-serif',
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 600, color: '#161614', letterSpacing: '-0.1px' }}>Northwind Studio</div>
            <div style={{ fontSize: 7, color: '#8a8a82', marginTop: 1 }}>hello@northwind.studio</div>
          </div>
          <div className="text-right">
            <div style={{ fontSize: 9.5, fontWeight: 600, color: '#161614', letterSpacing: '1px' }}>INVOICE</div>
            <div style={{ fontSize: 7, color: '#8a8a82', marginTop: 1 }}>#2041</div>
          </div>
        </div>
        <div style={{ fontSize: 7, color: '#8a8a82', marginTop: 9 }}>
          Bill to: Accordio · Issued 8 Aug 2026 · Due 22 Aug 2026
        </div>
        <div style={{ borderTop: '1px solid #e4e4dd', marginTop: 7, paddingTop: 3 }}>
          <InvoiceRow label="Copywriting — Acme landing page" val="$900.00" />
          <InvoiceRow label="Revisions (2 rounds)" val="$340.00" />
        </div>
        <div
          className="flex items-baseline justify-between"
          style={{ borderTop: '1px solid #cfcdc6', marginTop: 3, paddingTop: 4, fontSize: 9, fontWeight: 600, color: '#161614' }}
        >
          <span>Total due</span>
          <span>$1,240.00</span>
        </div>
      </div>

      {/* File row */}
      <div className="flex items-center gap-2.5 pb-0.5">
        <svg width="34" height="40" viewBox="0 0 34 40" fill="none" className="flex-shrink-0">
          <path d="M2 3a3 3 0 013-3h16l11 11v26a3 3 0 01-3 3H5a3 3 0 01-3-3V3z" fill="#E5484D" />
          <path d="M21 0l11 11H24a3 3 0 01-3-3V0z" fill="#B4272B" />
          <text x="17" y="30" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="700" fontFamily="ui-sans-serif, Helvetica, Arial, sans-serif" letterSpacing="0.3">PDF</text>
        </svg>
        <div className="min-w-0">
          <div className="text-[14px] leading-tight truncate" style={{ color: dark ? '#1d1c1d' : '#ffffff' }}>Invoice-2041-Northwind.pdf</div>
          <div className="text-[11.5px] leading-tight mt-1" style={{ color: dark ? 'rgba(29,28,29,0.55)' : 'rgba(255,255,255,0.6)' }}>
            2 pages · 148 kB · pdf
          </div>
        </div>
      </div>
    </div>
  );
}

// Waveform peaks sampled from the actual voice-note audio, so the bars match
// what you hear when you hit play.
const VOICE_PEAKS = [
  0.79, 0.6, 0.2, 0.17, 0.17, 0.3, 1.0, 0.8, 0.89, 0.78, 0.8, 0.78, 0.66, 0.81, 0.46, 0.75,
  0.72, 0.73, 0.6, 0.27, 0.17, 0.17, 0.17, 0.31, 0.8, 0.81, 0.67, 0.77, 0.75, 0.53, 0.18, 0.25,
  0.91, 0.96, 0.72, 0.74, 0.86, 0.75, 0.49, 0.23, 0.27, 0.77, 0.36, 0.48, 0.3, 0.23,
];

const FALLBACK_DURATION = 6.4;

function formatClock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Voice note — a real <audio> element behind a platform-styled player.
// `onHold` freezes the parent's scenario autoplay while audio is playing so
// the clip doesn't get cut off by a tab switch. Variants: WhatsApp voice
// bubble (default), Telegram's green circle-play row, Slack's audio card
// (blue play circle, gray waveform, duration, 1× speed chip).
function VoiceNote({ time, label, onHold, variant = 'whatsapp' }: { time: string; label: string; onHold?: (held: boolean) => void; variant?: ChatPlatform }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const barsRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(FALLBACK_DURATION);
  const [rate, setRate] = useState(1);

  // On unmount (scenario switch), stop playback and release the autoplay hold
  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      audio?.pause();
      onHold?.(false);
    };
  }, [onHold]);

  const pct = duration > 0 ? Math.min(position / duration, 1) : 0;

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play().catch(() => {});
    else audio.pause();
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const bars = barsRef.current;
    if (!audio || !bars) return;
    const rect = bars.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
    setPosition(audio.currentTime);
  };

  const cycleRate = () => {
    const next = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1;
    setRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const audioEl = (
    <audio
      ref={audioRef}
      preload="metadata"
      onLoadedMetadata={(e) => {
        const d = e.currentTarget.duration;
        if (Number.isFinite(d) && d > 0) setDuration(d);
      }}
      onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
      onPlay={() => {
        setPlaying(true);
        onHold?.(true);
      }}
      onPause={() => {
        setPlaying(false);
        onHold?.(false);
      }}
      onEnded={() => {
        setPlaying(false);
        setPosition(0);
        onHold?.(false);
      }}
    >
      <source src="./landing/voice-note.m4a" type="audio/mp4" />
      <source src="./landing/voice-note.mp3" type="audio/mpeg" />
    </audio>
  );

  if (variant === 'telegram') {
    // Telegram's voice message: solid green play circle, green waveform,
    // duration below-left, time + green checks below-right. No avatar.
    return (
      <div className="flex items-center gap-2.5" style={{ width: 252, maxWidth: '100%' }}>
        {audioEl}
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? 'Pause voice message' : label}
          className="flex-shrink-0 flex items-center justify-center rounded-full cursor-pointer"
          style={{ width: 38, height: 38, backgroundColor: '#57A84F', border: 'none', padding: 0 }}
        >
          {playing ? (
            <svg width="12" height="14" viewBox="0 0 16 18" fill="#ffffff" aria-hidden="true">
              <rect x="1" y="0" width="5" height="18" rx="1" />
              <rect x="10" y="0" width="5" height="18" rx="1" />
            </svg>
          ) : (
            <svg width="13" height="15" viewBox="0 0 17 19" fill="#ffffff" aria-hidden="true" style={{ marginLeft: 2 }}>
              <path d="M1.5 1.2a.8.8 0 0 1 1.22-.68l13 8.3a.8.8 0 0 1 0 1.36l-13 8.3A.8.8 0 0 1 1.5 17.8V1.2z" />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div ref={barsRef} onClick={seek} className="flex items-center gap-[2px] cursor-pointer overflow-hidden" style={{ height: 22 }}>
            {VOICE_PEAKS.map((peak, i) => (
              <span
                key={i}
                className="rounded-full flex-shrink-0"
                style={{
                  width: 2.5,
                  height: Math.max(3, Math.round(peak * 20)),
                  backgroundColor: i / VOICE_PEAKS.length < pct ? '#3E8E3E' : 'rgba(87,168,79,0.45)',
                }}
              />
            ))}
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-[11.5px]" style={{ color: '#5FA857', fontVariantNumeric: 'tabular-nums' }}>
              {position > 0 ? formatClock(position) : formatClock(Math.round(duration))}
            </span>
            <span className="text-[10.5px] flex items-center gap-0.5" style={{ color: '#5FA857' }}>
              {time}
              <DoubleCheck color="#4CAB4C" />
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'slack') {
    // Slack's audio-clip card: white rounded container, blue circular play
    // button, thin gray waveform, duration, and a playback-speed chip.
    return (
      <div
        className="flex items-center gap-2.5 rounded-2xl px-2.5 py-2"
        style={{ width: 290, maxWidth: '100%', backgroundColor: '#ffffff', border: '1px solid rgba(29,28,29,0.13)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
      >
        {audioEl}
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? 'Pause voice message' : label}
          className="flex-shrink-0 flex items-center justify-center rounded-full cursor-pointer"
          style={{ width: 40, height: 40, backgroundColor: '#1264A3', border: 'none', padding: 0 }}
        >
          {playing ? (
            <svg width="13" height="15" viewBox="0 0 16 18" fill="#ffffff" aria-hidden="true">
              <rect x="1" y="0" width="5" height="18" rx="1" />
              <rect x="10" y="0" width="5" height="18" rx="1" />
            </svg>
          ) : (
            <svg width="14" height="16" viewBox="0 0 17 19" fill="#ffffff" aria-hidden="true" style={{ marginLeft: 2 }}>
              <path d="M1.5 1.2a.8.8 0 0 1 1.22-.68l13 8.3a.8.8 0 0 1 0 1.36l-13 8.3A.8.8 0 0 1 1.5 17.8V1.2z" />
            </svg>
          )}
        </button>

        <div ref={barsRef} onClick={seek} className="flex-1 flex items-center gap-[2px] cursor-pointer min-w-0 overflow-hidden" style={{ height: 24 }}>
          {VOICE_PEAKS.map((peak, i) => (
            <span
              key={i}
              className="rounded-full flex-shrink-0"
              style={{
                width: 2.5,
                height: Math.max(3, Math.round(peak * 18)),
                backgroundColor: i / VOICE_PEAKS.length < pct ? '#1264A3' : 'rgba(29,28,29,0.3)',
              }}
            />
          ))}
        </div>

        <span className="text-[13px] flex-shrink-0" style={{ color: '#454245', fontVariantNumeric: 'tabular-nums' }}>
          {position > 0 ? formatClock(position) : formatClock(Math.round(duration))}
        </span>
        <button
          type="button"
          onClick={cycleRate}
          aria-label={`Playback speed ${rate}x`}
          className="flex-shrink-0 rounded-lg px-2 py-1 text-[12px] font-bold cursor-pointer"
          style={{ backgroundColor: '#f4f4f4', border: 'none', color: '#1d1c1d' }}
        >
          {rate === 1 ? '1×' : rate === 1.5 ? '1.5×' : '2×'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5" style={{ width: 272 }}>
      {audioEl}

      {/* Sender avatar with the mic badge WhatsApp stamps on voice notes */}
      <div className="relative flex-shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="./landing/avatars/avatar-big.jpg" alt="" className="w-11 h-11 rounded-full object-cover" />
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill={playing ? '#78d277' : '#ffffff'}
          className="absolute -right-0.5 -bottom-0.5"
          aria-hidden="true"
        >
          <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
          <path d="M18 11a1 1 0 1 0-2 0 4 4 0 0 1-8 0 1 1 0 1 0-2 0 6 6 0 0 0 5 5.91V20a1 1 0 1 0 2 0v-3.09A6 6 0 0 0 18 11z" />
        </svg>
      </div>

      <div className="flex-1 min-w-0">
        {/* Play control sits on the waveform's centre line, times below both */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? 'Pause voice message' : label}
            className="flex-shrink-0 flex items-center justify-center cursor-pointer"
            style={{ width: 22, height: 26, background: 'none', border: 'none', padding: 0 }}
          >
            {playing ? (
              <svg width="16" height="18" viewBox="0 0 16 18" fill="rgba(255,255,255,0.9)" aria-hidden="true">
                <rect x="1" y="0" width="5" height="18" rx="1" />
                <rect x="10" y="0" width="5" height="18" rx="1" />
              </svg>
            ) : (
              <svg width="17" height="19" viewBox="0 0 17 19" fill="rgba(255,255,255,0.9)" aria-hidden="true">
                <path d="M1.5 1.2a.8.8 0 0 1 1.22-.68l13 8.3a.8.8 0 0 1 0 1.36l-13 8.3A.8.8 0 0 1 1.5 17.8V1.2z" />
              </svg>
            )}
          </button>

          {/* Waveform — click anywhere to scrub */}
          <div ref={barsRef} onClick={seek} className="relative flex items-center gap-[2px] cursor-pointer" style={{ height: 26 }}>
            {VOICE_PEAKS.map((peak, i) => (
              <span
                key={i}
                className="rounded-full flex-shrink-0"
                style={{
                  width: 2,
                  height: Math.max(3, Math.round(peak * 24)),
                  backgroundColor: i / VOICE_PEAKS.length < pct ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.42)',
                }}
              />
            ))}
            <span
              className="absolute rounded-full pointer-events-none"
              style={{
                width: 10,
                height: 10,
                backgroundColor: '#ffffff',
                top: '50%',
                left: `${pct * 100}%`,
                transform: 'translate(-50%, -50%)',
                transition: playing ? 'left 0.2s linear' : 'none',
              }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
          <span className="text-[11.5px]" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {position > 0 ? formatClock(position) : formatClock(Math.round(duration))}
          </span>
          <span className="text-[10.5px] flex items-center gap-1">
            {time}
            <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
              <path d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.011-2.175a.46.46 0 0 0-.355-.153.512.512 0 0 0-.355.153.49.49 0 0 0-.152.355c0 .14.05.262.152.356l2.321 2.5a.506.506 0 0 0 .381.178c.127 0 .254-.06.355-.178L11.07 1.09a.49.49 0 0 0 0-.437zm3 0a.457.457 0 0 0-.303-.102.493.493 0 0 0-.381.178l-6.19 7.636-1.016-1.1a.291.291 0 0 0-.1.254l-.254.254 1.37 1.5a.506.506 0 0 0 .38.178c.128 0 .255-.06.356-.178L14.07 1.09a.49.49 0 0 0 0-.437z" fill="#53bdeb" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}

// Delivered double-check — WhatsApp blue / Telegram accent blue
function DoubleCheck({ color }: { color: string }) {
  return (
    <svg width="16" height="11" viewBox="0 0 16 11" fill="none" className="inline-block ml-1">
      <path d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.011-2.175a.46.46 0 0 0-.355-.153.512.512 0 0 0-.355.153.49.49 0 0 0-.152.355c0 .14.05.262.152.356l2.321 2.5a.506.506 0 0 0 .381.178c.127 0 .254-.06.355-.178L11.07 1.09a.49.49 0 0 0 0-.437zm3 0a.457.457 0 0 0-.303-.102.493.493 0 0 0-.381.178l-6.19 7.636-1.016-1.1a.291.291 0 0 0-.1.254l-.254.254 1.37 1.5a.506.506 0 0 0 .38.178c.128 0 .255-.06.356-.178L14.07 1.09a.49.49 0 0 0 0-.437z" fill={color} />
    </svg>
  );
}

// The Accordio Slack app avatar — dark green tile with a large pale-mint
// leaf, matching the real bot icon in Slack (leaf nearly fills the tile).
function AccordioAppAvatar({ size = 36, radius = 8 }: { size?: number; radius?: number }) {
  return (
    <div
      className="flex items-center justify-center flex-shrink-0 overflow-hidden"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: 'linear-gradient(150deg, #2a4a34 0%, #16281d 65%, #101f16 100%)',
      }}
    >
      <AccordioLeaf size={Math.round(size * 0.86)} color="#cde9c6" />
    </div>
  );
}

// The circular Accordio "avatar" used in the WhatsApp/Telegram headers
function QuillAvatar() {
  return (
    <div
      className="w-10 h-10 rounded-full overflow-hidden relative flex-shrink-0"
      style={{
        background: 'linear-gradient(160deg, rgba(20,32,24,1) 0%, rgba(14,25,19,1) 50%, rgba(16,28,22,1) 100%)',
        border: '1px solid rgba(120, 210, 119, 0.18)',
      }}
    >
      <span className="absolute -right-1 -bottom-1 w-9 h-9" aria-hidden="true"><BrandMark size={36} /></span>
    </div>
  );
}

// Per-skin colors for the bubble chats (WhatsApp dark + Telegram iOS light).
// Slack has its own row-based layout and doesn't read from this table.
const BUBBLE_THEMES = {
  whatsapp: {
    frame: '#181e1c',
    headerBg: '#242626',
    headerBorder: 'rgba(255,255,255,0.2)',
    bubbleIn: '#242626',
    bubbleOut: '#004e36',
    radius: 'rounded-lg',
    check: '#53bdeb',
    todayBg: '#242626',
    todayText: '#ffffff',
    inputBg: '#101010',
    text: '#ffffff',
    timeIn: 'rgba(255,255,255,0.5)',
    timeOut: 'rgba(255,255,255,0.5)',
    dot: 'rgba(255,255,255,0.5)',
  },
  claude: {
    // Claude iOS dark: near-black canvas, no bubbles for the assistant —
    // most of these keys only drive shared chrome (divider, typing dots).
    frame: '#1B1A19',
    headerBg: '#1B1A19',
    headerBorder: 'transparent',
    bubbleIn: 'transparent',
    bubbleOut: '#30302E',
    radius: 'rounded-[22px]',
    check: '#8B8A87',
    todayBg: '#262624',
    todayText: 'rgba(255,255,255,0.7)',
    inputBg: '#1B1A19',
    text: '#EDECE8',
    timeIn: 'rgba(255,255,255,0.35)',
    timeOut: 'rgba(255,255,255,0.35)',
    dot: 'rgba(255,255,255,0.4)',
  },
  telegram: {
    frame: '#8dbd85',
    headerBg: '#ffffff',
    headerBorder: 'transparent',
    bubbleIn: '#ffffff',
    bubbleOut: '#E1FFC7',
    radius: 'rounded-2xl',
    check: '#4CAB4C',
    todayBg: 'rgba(94,124,82,0.6)',
    todayText: '#ffffff',
    inputBg: '#ffffff',
    text: '#1a1a1a',
    timeIn: 'rgba(0,0,0,0.3)',
    timeOut: '#5FA857',
    dot: 'rgba(0,0,0,0.25)',
  },
} as const;

export function WhatsAppChat({
  activeScenario,
  compact = false,
  onAudioHold,
  platform = 'whatsapp',
  messages,
}: {
  activeScenario: number;
  compact?: boolean;
  onAudioHold?: (held: boolean) => void;
  platform?: ChatPlatform;
  /** Play this conversation instead of the built-in scenario at activeScenario
      (feature pages script their own). Remount (key) to replay it. */
  messages?: Message[];
}) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [isFading, setIsFading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const prevScenario = useRef(activeScenario);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view — the phone body is fixed-height and
  // scrolls internally instead of growing.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [visibleCount, isTyping]);

  const scenario = messages ?? scenarios[activeScenario % scenarios.length];

  // When parent changes activeScenario, fade out → reset → fade in
  useEffect(() => {
    if (activeScenario !== prevScenario.current) {
      setIsFading(true);
      setIsTyping(false);
      const t = setTimeout(() => {
        prevScenario.current = activeScenario;
        setVisibleCount(0);
        setIsFading(false);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [activeScenario]);

  // Drip messages in one by one, with typing indicator for assistant messages
  useEffect(() => {
    if (isFading) return;
    if (visibleCount < scenario.length) {
      const nextMsg = scenario[visibleCount];
      const isAssistant = nextMsg.role === 'assistant';
      const isFirst = visibleCount === 0;
      const waitBefore = isFirst
        ? GAP_FIRST
        : scenario[visibleCount - 1].role === 'user'
          ? GAP_AFTER_USER
          : GAP_AFTER_ASSISTANT;

      // Link-preview bubbles follow their text message quickly, no typing indicator
      if (isAssistant && nextMsg.link) {
        const t = setTimeout(() => setVisibleCount((c) => c + 1), GAP_LINK);
        return () => clearTimeout(t);
      }

      if (isAssistant && !isTyping) {
        // Show typing indicator after a pause
        const t = setTimeout(() => setIsTyping(true), waitBefore);
        return () => clearTimeout(t);
      }

      if (isAssistant && isTyping) {
        // Show typing for a bit, then reveal message (faster for first message)
        const t = setTimeout(() => {
          setIsTyping(false);
          setVisibleCount((c) => c + 1);
        }, isFirst ? TYPING_FIRST : TYPING);
        return () => clearTimeout(t);
      }

      // User messages — just delay then show
      const t = setTimeout(() => setVisibleCount((c) => c + 1), waitBefore);
      return () => clearTimeout(t);
    }
  }, [visibleCount, isFading, isTyping, scenario]);

  const isSlack = platform === 'slack';
  const isClaude = platform === 'claude';
  const theme = BUBBLE_THEMES[isSlack ? 'whatsapp' : platform];
  // Claude skin: the first assistant reply carries a tool-call row above it —
  // the connector moment ("Claude read your Accordio data before answering").
  const firstAssistantIdx = scenario.findIndex((m) => m.role === 'assistant');

  // WhatsApp-style embed card (also used inside Telegram bubbles)
  const renderLinkCard = (msg: Message) => (
    <div style={{ width: 258, maxWidth: '100%' }}>
      {/* Link preview card — image banner on top, then title / description /
          domain, URL below */}
      <div
        className="rounded-lg overflow-hidden mt-0.5 mb-1.5"
        style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
      >
        {/* og-image banner */}
        <div
          className="relative flex items-center justify-center"
          style={{
            height: 104,
            background: 'linear-gradient(135deg, #16281d 0%, #0c1811 100%)',
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(120,210,119,0.14) 0%, transparent 65%)',
            }}
          />
          <span
            className="relative text-[26px] font-medium text-white"
            style={{ letterSpacing: '-0.5px' }}
          >
            {msg.linkBanner}
          </span>
          <div className="absolute right-2 bottom-2">
            <AccordioLeaf size={16} />
          </div>
        </div>
        <div className="px-2.5 py-2">
          <div className="text-[13.5px] font-medium text-white leading-snug">
            {msg.linkTitle}
          </div>
          <div className="text-[12.5px] leading-snug mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {msg.linkDesc}
          </div>
          <div className="flex items-center gap-1 mt-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            <span className="text-[11.5px]">accordio.ai</span>
          </div>
        </div>
      </div>
      {msg.text}
    </div>
  );

  // Telegram link preview — blue URL, then a left-accent block with site
  // name, title, description and the image below (iOS light theme).
  const renderTelegramLinkCard = (msg: Message) => (
    <div style={{ width: 258, maxWidth: '100%' }}>
      {msg.text}
      <div className="text-[15px] leading-snug" style={{ color: '#3390EC' }}>{msg.link}</div>
      <div className="mt-1.5 pl-2.5 py-0.5" style={{ borderLeft: '3px solid #3390EC', borderRadius: 2 }}>
        <div className="text-[13.5px] font-semibold leading-snug" style={{ color: '#3390EC' }}>Accordio</div>
        <div className="text-[14px] font-semibold leading-snug mt-0.5" style={{ color: '#1a1a1a' }}>{msg.linkTitle}</div>
        <div className="text-[13px] leading-snug mt-0.5" style={{ color: 'rgba(0,0,0,0.75)' }}>{msg.linkDesc}</div>
        <div
          className="relative flex items-center justify-center rounded-lg overflow-hidden mt-1.5"
          style={{
            height: 96,
            background: 'linear-gradient(135deg, #16281d 0%, #0c1811 100%)',
          }}
        >
          <div
            className="absolute inset-0"
            style={{ background: 'radial-gradient(ellipse at center, rgba(120,210,119,0.14) 0%, transparent 65%)' }}
          />
          <span className="relative text-[24px] font-medium text-white" style={{ letterSpacing: '-0.5px' }}>
            {msg.linkBanner}
          </span>
          <div className="absolute right-2 bottom-2">
            <AccordioLeaf size={14} />
          </div>
        </div>
      </div>
    </div>
  );

  // Slack unfurl — left accent bar, site name, blue title, banner below
  const renderSlackUnfurl = (msg: Message) => (
    <div style={{ maxWidth: 280 }}>
      <div>
        {msg.text}{' '}
        <span style={{ color: '#1264a3', textDecoration: 'underline' }}>{msg.link}</span>
      </div>
      <div className="mt-1.5 pl-3" style={{ borderLeft: '4px solid rgba(29,28,29,0.13)' }}>
        <div className="flex items-center gap-1.5">
          <AccordioLeaf size={13} />
          <span className="text-[13px] font-bold" style={{ color: '#1d1c1d' }}>Accordio</span>
        </div>
        <div className="text-[14px] font-bold leading-snug mt-0.5" style={{ color: '#1264a3' }}>
          {msg.linkTitle}
        </div>
        <div className="text-[13px] leading-snug mt-0.5" style={{ color: '#1d1c1d' }}>
          {msg.linkDesc}
        </div>
        <div
          className="relative flex items-center justify-center rounded-lg overflow-hidden mt-1.5"
          style={{
            height: 96,
            maxWidth: 244,
            background: 'linear-gradient(135deg, #16281d 0%, #0c1811 100%)',
          }}
        >
          <div
            className="absolute inset-0"
            style={{ background: 'radial-gradient(ellipse at center, rgba(120,210,119,0.14) 0%, transparent 65%)' }}
          />
          <span className="relative text-[24px] font-medium text-white" style={{ letterSpacing: '-0.5px' }}>
            {msg.linkBanner}
          </span>
          <div className="absolute right-2 bottom-2">
            <AccordioLeaf size={14} />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="beam-border rounded-t-[32px] rounded-b-[30px] overflow-hidden w-full max-w-[465px]"
      style={{
        backgroundColor: isSlack ? '#ffffff' : theme.frame,
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      {/* Header */}
      {platform === 'whatsapp' && (
        <div className="flex items-center gap-2.5 px-4 py-3" style={{ backgroundColor: theme.headerBg, borderBottom: `1px solid ${theme.headerBorder}` }}>
          <div className="flex items-center gap-0.5 flex-shrink-0 -ml-1">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-90"><path d="M15 18l-6-6 6-6" /></svg>
            <span className="text-white text-[15px] font-medium">3</span>
          </div>
          <QuillAvatar />
          <div className="flex-1">
            <div className="text-white text-[17px] font-medium">Accordio AI</div>
          </div>
          <div className="flex items-center gap-5">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" className="opacity-40 hover:opacity-90 hover:scale-110 transition-all duration-200 cursor-pointer"><rect x="2" y="5" width="14" height="14" rx="2" /><path d="M16 10l5-3v10l-5-3" /></svg>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" className="opacity-40 hover:opacity-90 hover:scale-110 transition-all duration-200 cursor-pointer"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" /></svg>
          </div>
        </div>
      )}
      {isClaude && (
        // Claude iOS: floating circular sidebar button left, new-chat pill right
        <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: '#1B1A19' }}>
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: '#262624', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="14" y2="12" /><line x1="4" y1="17" x2="17" y2="17" /></svg>
          </div>
          <div
            className="flex items-center gap-3 rounded-full px-3.5 py-3 flex-shrink-0"
            style={{ backgroundColor: '#262624', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="rgba(255,255,255,0.85)"><path d="M12 3C6.5 3 2 6.9 2 11.7c0 2.7 1.4 5.1 3.6 6.7-.1.9-.5 2.2-1.5 3.2 1.8-.1 3.3-.8 4.3-1.5.9.2 2 .4 3.6.4 5.5 0 10-3.9 10-8.7S17.5 3 12 3z" /><path d="M12 8v7M8.5 11.5h7" stroke="#262624" strokeWidth="1.8" strokeLinecap="round" /></svg>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="rgba(255,255,255,0.85)"><circle cx="5" cy="12" r="1.9" /><circle cx="12" cy="12" r="1.9" /><circle cx="19" cy="12" r="1.9" /></svg>
          </div>
        </div>
      )}
      {/* Telegram renders its header inside the chat body — iOS Telegram
          floats pill controls over the wallpaper instead of a solid bar. */}
      {isSlack && (
        // Slack mobile's floating-pill header: circular back button, a title
        // pill with the app avatar, and a circular huddle button.
        <div className="flex items-center gap-2 px-3 py-2.5" style={{ backgroundColor: '#ffffff' }}>
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: '#ffffff', border: '1px solid rgba(29,28,29,0.06)', boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1d1c1d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </div>
          <div
            className="flex-1 flex items-center gap-2.5 rounded-full pl-1.5 pr-4 py-1.5 min-w-0"
            style={{ backgroundColor: '#ffffff', border: '1px solid rgba(29,28,29,0.06)', boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}
          >
            <AccordioAppAvatar size={30} radius={9} />
            <span className="text-[16px] font-bold truncate" style={{ color: '#1d1c1d' }}>Accordio</span>
          </div>
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: '#ffffff', border: '1px solid rgba(29,28,29,0.06)', boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#1d1c1d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" /></svg>
          </div>
        </div>
      )}

      {/* Chat body */}
      <div
        className="relative"
        style={{
          ...(platform === 'whatsapp'
            ? {
                backgroundImage: 'url(./landing/whatsapp-wallpaper.png)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : platform === 'telegram'
              ? { background: 'linear-gradient(165deg, #c6d1a0 0%, #a9c78e 35%, #8dbd85 70%, #7db383 100%)' }
              : isClaude
                ? { backgroundColor: '#1B1A19' }
                : { backgroundColor: '#ffffff' }),
          // Telegram floats its header and input INSIDE this body, while
          // WhatsApp/Slack stack theirs outside it (~154px of chrome) — give
          // Telegram that back so all three phones render the same height.
          // Claude's two-row input is taller than WhatsApp's, so its body
          // gives that back to keep the four phones the same height.
          height:
            platform === 'telegram'
              ? (compact ? '726px' : '794px')
              : isClaude
                ? (compact ? '519px' : '587px')
                : compact ? '572px' : '640px',
        }}
      >
        {platform === 'whatsapp' && (
          <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.15)' }} />
        )}
        {platform === 'telegram' && (
          // Doodle texture over the green gradient — reuses the WhatsApp
          // doodle sheet blended into the wallpaper
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: 'url(./landing/whatsapp-wallpaper.png)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              mixBlendMode: 'overlay',
              opacity: 0.3,
            }}
          />
        )}

        {/* Scrollable message area — the phone never grows; overflow scrolls
            inside and auto-follows the newest message. The thread fills
            top-down on every breakpoint, so mobile reads the same way as
            desktop. Telegram pads for its floating header/input, which
            live inside this container. */}
        <div ref={scrollRef} className={`absolute inset-0 overflow-y-auto scrollbar-hide ${platform === 'telegram' ? 'px-4 pt-[78px] pb-[110px]' : 'p-4'}`}>
        <div className="min-h-full flex flex-col">

        {/* Date divider */}
        {isClaude ? (
          // Claude has no date divider — nothing to render here.
          null
        ) : isSlack ? (
          // Slack's unread divider: bold date on the left, red line, NEW badge
          <div className="relative z-10 flex items-center gap-3 mb-3">
            <span className="text-[15px] font-bold" style={{ color: '#1d1c1d' }}>Today</span>
            <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(224,30,90,0.45)' }} />
            <span className="text-[12px] font-bold tracking-wide" style={{ color: '#E01E5A' }}>NEW</span>
          </div>
        ) : (
          <div className="relative z-10 flex justify-center mb-2">
            <span
              className={`px-3 py-1 ${platform === 'telegram' ? 'rounded-full text-[13.5px]' : 'rounded-lg text-[13px]'} font-medium`}
              style={{ backgroundColor: theme.todayBg, color: theme.todayText }}
            >
              Today
            </span>
          </div>
        )}

        <div className={`relative z-10 flex flex-col ${isSlack ? 'gap-4' : 'gap-2'}`} style={{ opacity: isFading ? 0 : 1, transition: 'opacity 0.3s ease' }}>
          {scenario.slice(0, visibleCount).map((msg, i) => (
            isClaude ? (
              // Claude — user gets a dark rounded bubble on the right, the
              // assistant answers as plain serif text with no bubble at all.
              <div key={`${activeScenario}-${i}`} className="wa-message-appear">
                {msg.role === 'user' ? (
                  <div className="flex justify-end">
                    <div
                      className={`rounded-[22px] text-[15.5px] leading-relaxed max-w-[85%] ${msg.attachment ? 'px-3 py-2' : 'px-4 py-2.5'}`}
                      style={{ backgroundColor: '#30302E', color: '#EDECE8', whiteSpace: 'pre-line' }}
                    >
                      {/* Voice notes are a messenger idiom — in the Claude
                          skin the same message renders as typed text. */}
                      {msg.attachment === 'pdf' && <div className="pt-1 pb-1.5"><PdfAttachment /></div>}
                      {msg.voice ? msg.text.replace(/^Voice message:\s*/i, '') : msg.text}
                    </div>
                  </div>
                ) : (
                  <div className="pt-1 pb-1">
                    {i === firstAssistantIdx && (
                      <div className="flex items-center gap-2 mb-3" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 13.5" /></svg>
                        <span className="text-[13.5px]">Read your Accordio data</span>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                      </div>
                    )}
                    <div
                      className="text-[15.5px] leading-relaxed"
                      style={{
                        color: '#EDECE8',
                        fontFamily: 'ui-serif, Georgia, Cambria, "Times New Roman", serif',
                        whiteSpace: 'pre-line',
                      }}
                    >
                      {msg.link ? renderLinkCard(msg) : msg.text}
                    </div>
                  </div>
                )}
              </div>
            ) : isSlack ? (
              // Slack — row layout: square avatar, bold name + time, plain text
              <div key={`${activeScenario}-${i}`} className="flex items-start gap-2.5 wa-message-appear">
                {msg.role === 'user' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src="./landing/avatars/avatar-big.jpg" alt="" className="w-9 h-9 rounded-lg flex-shrink-0 object-cover" />
                ) : (
                  <AccordioAppAvatar size={36} radius={8} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[15px] font-bold" style={{ color: '#1d1c1d' }}>
                      {msg.role === 'user' ? 'Roma' : 'Accordio'}
                    </span>
                    {msg.role === 'assistant' && (
                      <span className="text-[9px] font-bold px-1 py-px rounded" style={{ backgroundColor: 'rgba(29,28,29,0.13)', color: '#616061' }}>APP</span>
                    )}
                    <span className="text-[11px]" style={{ color: 'rgba(29,28,29,0.45)' }}>{msg.time}</span>
                  </div>
                  {msg.voice ? (
                    <div className="mt-1.5">
                      <VoiceNote time={msg.time} label={msg.text} onHold={onAudioHold} variant="slack" />
                    </div>
                  ) : (
                    <div className="text-[15px] leading-relaxed mt-0.5" style={{ color: '#1d1c1d', whiteSpace: 'pre-line' }}>
                      {msg.attachment === 'pdf' && (
                        <div className="mt-1.5 mb-1.5"><PdfAttachment light /></div>
                      )}
                      {msg.link ? renderSlackUnfurl(msg) : msg.text}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // WhatsApp / Telegram — bubble layout
              <div key={`${activeScenario}-${i}`} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} wa-message-appear`}>
                <div
                  className={`relative ${theme.radius} text-[15.5px] leading-relaxed max-w-[85%] ${msg.voice ? (platform === 'telegram' ? 'px-2.5 py-2' : 'px-2 py-2') : 'px-3 py-1.5'}`}
                  style={{ backgroundColor: msg.role === 'user' ? theme.bubbleOut : theme.bubbleIn, color: theme.text, whiteSpace: 'pre-line' }}
                >
                  {msg.voice ? (
                    <VoiceNote time={msg.time} label={msg.text} onHold={onAudioHold} variant={platform} />
                  ) : (
                  <div className="wa-msg-content">
                  {msg.attachment === 'pdf' && (
                    platform === 'telegram' ? <PdfAttachment darkText bleedRadius={14} /> : <PdfAttachment />
                  )}
                  {msg.link
                    ? platform === 'telegram' ? renderTelegramLinkCard(msg) : renderLinkCard(msg)
                    : msg.text}
                  <span className="text-[10.5px] ml-2 float-right mt-1" style={{ color: msg.role === 'user' ? theme.timeOut : theme.timeIn }}>
                    {msg.time}
                    {msg.role === 'user' && <DoubleCheck color={theme.check} />}
                  </span>
                  </div>
                  )}
                </div>
              </div>
            )
          ))}

        </div>

        {/* Typing indicator — outside fade container to prevent flicker */}
        {isTyping && (
          isClaude ? (
            // Claude thinking: the starburst breathes — scales down toward a
            // dot behind a shrinking circular clip, then blooms back out.
            <div className="relative z-10 flex items-center wa-message-appear mt-3">
              <style>{`@keyframes claude-breathe { 0%, 100% { transform: scale(1); clip-path: circle(72% at 50% 50%); } 50% { transform: scale(0.36); clip-path: circle(44% at 50% 50%); } }`}</style>
              <div style={{ animation: 'claude-breathe 1.5s ease-in-out infinite', transformOrigin: 'center' }}>
                <ClaudeStar size={26} />
              </div>
            </div>
          ) : isSlack ? (
            <div className="relative z-10 flex items-center gap-2 wa-message-appear mt-3">
              <AccordioAppAvatar size={20} radius={5} />
              <span className="text-[13px]" style={{ color: '#616061' }}>
                Accordio is <span className="font-bold">typing...</span>
              </span>
            </div>
          ) : (
            <div className="relative z-10 flex justify-start wa-message-appear mt-2">
              <div className={`px-4 py-3 ${theme.radius} flex items-center gap-[5px]`} style={{ backgroundColor: theme.bubbleIn }}>
                <span className="wa-typing-dot w-[7px] h-[7px] rounded-full" style={{ backgroundColor: theme.dot }} />
                <span className="wa-typing-dot w-[7px] h-[7px] rounded-full" style={{ backgroundColor: theme.dot }} />
                <span className="wa-typing-dot w-[7px] h-[7px] rounded-full" style={{ backgroundColor: theme.dot }} />
              </div>
            </div>
          )
        )}
        </div>
        </div>

        {platform === 'telegram' && (
          <>
            {/* Floating header — back pill with unread badge, centered title
                pill with 'bot' subtitle, circular leaf avatar */}
            <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-2 px-3 pt-3">
              <div
                className="flex items-center gap-1 rounded-full pl-2 pr-1.5 py-1.5 flex-shrink-0"
                style={{ backgroundColor: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
              >
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                <span className="px-2 py-px rounded-full text-[13px] font-semibold text-white" style={{ backgroundColor: '#1a1a1a' }}>10</span>
              </div>
              <div
                className="flex-1 rounded-full px-4 py-1 text-center min-w-0"
                style={{ backgroundColor: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
              >
                <div className="text-[16px] font-semibold truncate leading-tight" style={{ color: '#1a1a1a' }}>Accordio AI</div>
                <div className="text-[12px] leading-tight" style={{ color: 'rgba(0,0,0,0.45)' }}>bot</div>
              </div>
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
              >
                <AccordioLeaf size={26} />
              </div>
            </div>

            {/* Floating input — bot Menu button, paperclip, message pill, mic */}
            <div className="absolute bottom-0 left-0 right-0 z-20 px-3 pb-2 pt-1">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-full px-3.5 py-2.5 flex-shrink-0 cursor-pointer" style={{ backgroundColor: '#4C9FE8' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round"><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></svg>
                  <span className="text-[15px] font-semibold text-white">Menu</span>
                </div>
                <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer" style={{ backgroundColor: 'rgba(255,255,255,0.85)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5b6156" strokeWidth="1.6" strokeLinecap="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" /></svg>
                </div>
                <div className="flex-1 flex items-center rounded-full px-3.5 py-2.5 min-w-0" style={{ backgroundColor: 'rgba(255,255,255,0.92)' }}>
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Message"
                    className="flex-1 bg-transparent text-[15px] outline-none min-w-0"
                    style={{ color: '#1a1a1a' }}
                  />
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#8e9389" strokeWidth="1.6" strokeLinecap="round" className="ml-1.5 flex-shrink-0"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 13.5" /></svg>
                </div>
                <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer" style={{ backgroundColor: 'rgba(255,255,255,0.85)' }}>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#3f5a3c" strokeWidth="1.7" strokeLinecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /></svg>
                </div>
              </div>
              {/* iOS home indicator */}
              <div className="flex justify-center pt-2.5 pb-1">
                <div className="w-[120px] h-[5px] rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Input bar */}
      {isClaude && (
        <div style={{ backgroundColor: '#1B1A19' }}>
          <div className="px-3 pt-1 pb-1">
            <div
              className="rounded-[26px] px-4 pt-3.5 pb-3"
              style={{ backgroundColor: '#262624', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Reply to Claude"
                className="w-full bg-transparent text-[15.5px] outline-none"
                style={{ color: 'rgba(255,255,255,0.85)' }}
              />
              <div className="flex items-center justify-between mt-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer"
                  style={{ backgroundColor: '#30302E' }}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                </div>
                <div className="flex items-center gap-3">
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.7" strokeLinecap="round" className="cursor-pointer"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /></svg>
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer"
                    style={{ backgroundColor: '#EDECE8' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B1A19" strokeWidth="2.2" strokeLinecap="round"><line x1="5" y1="9" x2="5" y2="15" /><line x1="9" y1="6" x2="9" y2="18" /><line x1="13" y1="9" x2="13" y2="15" /><line x1="17" y1="7" x2="17" y2="17" /><line x1="21" y1="10" x2="21" y2="14" className="hidden" /></svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* iOS home indicator */}
          <div className="flex justify-center pt-2 pb-3">
            <div className="w-[120px] h-[5px] rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.9)' }} />
          </div>
        </div>
      )}
      {platform === 'whatsapp' && (
        <div style={{ backgroundColor: theme.inputBg }}>
          <div className="flex items-center gap-2 px-3 pt-2 pb-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" className="flex-shrink-0 hover:stroke-white hover:scale-110 transition-all duration-200 cursor-pointer"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          <div className="flex-1 flex items-center px-3 py-2 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="bg-transparent text-[13px] w-full outline-none"
              style={{ color: 'rgba(255,255,255,0.85)' }}
            />
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" className="ml-2 flex-shrink-0 hover:stroke-white/60 transition-colors duration-200 cursor-pointer"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" /></svg>
          </div>
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 hover:scale-105 transition-transform duration-200 cursor-pointer" style={{ backgroundColor: '#78d277' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#0e1913"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" fill="none" stroke="#0e1913" strokeWidth="2" strokeLinecap="round" /><line x1="12" y1="19" x2="12" y2="23" stroke="#0e1913" strokeWidth="2" strokeLinecap="round" /></svg>
          </div>
          </div>
          {/* iOS home indicator */}
          <div className="flex justify-center pt-3 pb-3">
            <div className="w-[120px] h-[5px] rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.9)' }} />
          </div>
        </div>
      )}
      {/* Telegram's input floats inside the chat body above */}
      {isSlack && (
        <div style={{ backgroundColor: '#ffffff', borderTop: '1px solid rgba(29,28,29,0.08)' }}>
          <div className="px-3 pt-2.5 pb-1">
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-full"
              style={{ backgroundColor: '#ffffff', border: '1px solid rgba(29,28,29,0.08)', boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1d1c1d" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0 cursor-pointer"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Message Accordio"
                className="flex-1 bg-transparent text-[15px] outline-none min-w-0"
                style={{ color: '#1d1c1d' }}
              />
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#1d1c1d" strokeWidth="1.8" strokeLinecap="round" className="flex-shrink-0 cursor-pointer"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /></svg>
            </div>
          </div>
          {/* iOS home indicator */}
          <div className="flex justify-center pt-2 pb-3">
            <div className="w-[120px] h-[5px] rounded-full" style={{ backgroundColor: 'rgba(29,28,29,0.85)' }} />
          </div>
        </div>
      )}
    </div>
  );
}
