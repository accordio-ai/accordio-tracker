/**
 * A user turn.
 *
 * Matches the dashboard: a green pill bubble, right-aligned, capped at 85% of
 * the column. Deliberately no avatar and no "You" header row — the old desktop
 * chat had both, which is most of why the two surfaces read as different
 * products.
 */

import type { AgiMessage } from '../../lib/chat/types';
import { AttachmentTile } from './AttachmentTile';

interface UserMessageProps {
  message: AgiMessage;
}

export function UserMessage({ message }: UserMessageProps) {
  const text = message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('\n');

  const files = message.parts.filter(
    (p): p is { type: 'file'; url: string; mediaType: string; filename?: string } =>
      p.type === 'file'
  );

  return (
    <div className="flex flex-col items-end">
      {files.length > 0 && (
        <div className="mb-2 flex max-w-[85%] flex-wrap justify-end gap-2">
          {files.map((file, i) => (
            <AttachmentTile
              key={`${file.filename ?? 'file'}-${i}`}
              url={file.url}
              mediaType={file.mediaType}
              filename={file.filename}
            />
          ))}
        </div>
      )}
      {text && (
        <div className="max-w-[85%] rounded-2xl bg-[#E8F5E6] px-4 py-3 text-[#1F2A1C] dark:bg-card dark:text-foreground">
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{text}</p>
        </div>
      )}
    </div>
  );
}
