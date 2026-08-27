/**
 * Turn dropped/picked files into UIMessage parts.
 *
 * Ported from the classification logic that lived inside `useGateway.sendMessage`.
 * The behaviour is worth preserving verbatim: text-ish files are inlined as
 * fenced text rather than handed over as binary (Anthropic rejects most
 * non-PDF file parts), and genuinely unsupported types become an explicit note
 * so the model says "I can't read that" instead of silently ignoring it.
 *
 * The output shape changed from Anthropic content blocks to AI SDK
 * `UIMessagePart`s, because the transport now runs `convertToModelMessages`.
 */

export const MAX_FILE_SIZE_MB = 20;
export const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;
const FILE_READ_TIMEOUT_MS = 30_000;
/** Beyond this, inlined text is truncated rather than blowing the context. */
const MAX_TEXT_CHARS = 50_000;

const TEXT_MIME_PREFIXES = [
  'text/', 'application/json', 'application/xml',
  'application/javascript', 'application/typescript',
  'application/x-yaml', 'application/toml',
];

const TEXT_EXTENSIONS = [
  '.txt', '.md', '.csv', '.json', '.xml', '.yaml', '.yml', '.toml', '.html',
  '.css', '.js', '.ts', '.tsx', '.jsx', '.py', '.rb', '.go', '.rs', '.sh',
  '.env', '.log', '.sql', '.graphql',
];

export interface AttachmentPart {
  type: 'text' | 'file';
  text?: string;
  url?: string;
  mediaType?: string;
  filename?: string;
}

export interface AttachmentResult {
  parts: AttachmentPart[];
  /** Human-readable reasons individual files were skipped. */
  errors: string[];
}

function isTextFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    TEXT_MIME_PREFIXES.some(t => file.type.startsWith(t)) ||
    TEXT_EXTENSIONS.some(ext => name.endsWith(ext)) ||
    // No MIME type and small: almost always a text file macOS didn't classify.
    (!file.type && file.size < 1024 * 1024)
  );
}

function readFile(file: File, as: 'dataUrl' | 'text'): Promise<{ data: string; error?: string }> {
  return new Promise((resolve) => {
    if (file.size > MAX_FILE_SIZE) {
      resolve({
        data: '',
        error: `"${file.name}" exceeds the ${MAX_FILE_SIZE_MB}MB limit (${Math.round(file.size / 1024 / 1024)}MB)`,
      });
      return;
    }

    const reader = new FileReader();
    const timeout = setTimeout(() => {
      reader.abort();
      resolve({ data: '', error: `Timed out reading "${file.name}"` });
    }, FILE_READ_TIMEOUT_MS);

    reader.onload = () => {
      clearTimeout(timeout);
      resolve({ data: reader.result as string });
    };
    reader.onerror = () => {
      clearTimeout(timeout);
      resolve({ data: '', error: `Failed to read "${file.name}"` });
    };
    reader.onabort = () => {
      clearTimeout(timeout);
      resolve({ data: '', error: `Reading "${file.name}" was cancelled` });
    };

    if (as === 'dataUrl') reader.readAsDataURL(file);
    else reader.readAsText(file);
  });
}

export async function filesToParts(files: File[]): Promise<AttachmentResult> {
  const parts: AttachmentPart[] = [];
  const errors: string[] = [];

  for (const file of files) {
    if (file.type.startsWith('image/')) {
      // Data URL rather than bare base64 — that's what FileUIPart expects and
      // what convertToModelMessages turns into a canonical ImagePart.
      const { data, error } = await readFile(file, 'dataUrl');
      if (error) errors.push(error);
      else parts.push({ type: 'file', url: data, mediaType: file.type, filename: file.name });
      continue;
    }

    if (isTextFile(file)) {
      const { data, error } = await readFile(file, 'text');
      if (error) {
        errors.push(error);
      } else {
        const truncated = data.length > MAX_TEXT_CHARS
          ? `${data.slice(0, MAX_TEXT_CHARS)}\n\n... [truncated at ${MAX_TEXT_CHARS} chars, total: ${data.length}]`
          : data;
        parts.push({ type: 'text', text: `📄 File: ${file.name}\n\`\`\`\n${truncated}\n\`\`\`` });
      }
      continue;
    }

    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      const { data, error } = await readFile(file, 'dataUrl');
      if (error) errors.push(error);
      else parts.push({ type: 'file', url: data, mediaType: 'application/pdf', filename: file.name });
      continue;
    }

    // Tell the model explicitly rather than dropping the file silently —
    // otherwise it answers as though the attachment didn't exist.
    parts.push({
      type: 'text',
      text: `[Attached file: ${file.name} (${file.type || 'unknown type'}, ${Math.round(file.size / 1024)}KB) — this file type is not supported. Supported: images, PDFs, and text files.]`,
    });
  }

  return { parts, errors };
}
