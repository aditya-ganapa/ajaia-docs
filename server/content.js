import sanitizeHtml from 'sanitize-html';
import { marked } from 'marked';
import mammoth from 'mammoth';
import path from 'node:path';

export const IMPORT_EXTENSIONS = ['.txt', '.md', '.docx'];
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

// Everything stored or served passes through this allowlist, so content from the
// editor, from imports, or from a hand-crafted API call is held to the same rules.
const SANITIZE_OPTIONS = {
  allowedTags: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h1', 'h2', 'h3',
    'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'hr', 'a',
  ],
  allowedAttributes: { a: ['href'] },
  allowedSchemes: ['http', 'https', 'mailto'],
};

export function sanitizeContent(html) {
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function textToHtml(text) {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export class ImportError extends Error {}

/** Convert an uploaded file into { title, content } for a new document. */
export async function importFile({ originalname, buffer }) {
  const ext = path.extname(originalname || '').toLowerCase();
  if (!IMPORT_EXTENSIONS.includes(ext)) {
    throw new ImportError(`Unsupported file type. Supported: ${IMPORT_EXTENSIONS.join(', ')}`);
  }
  if (!buffer || buffer.length === 0) throw new ImportError('The file is empty.');

  let html;
  try {
    if (ext === '.docx') html = (await mammoth.convertToHtml({ buffer })).value;
    else if (ext === '.md') html = await marked.parse(buffer.toString('utf8'));
    else html = textToHtml(buffer.toString('utf8'));
  } catch {
    throw new ImportError('Could not read this file. It may be corrupted.');
  }

  const title = path.basename(originalname, path.extname(originalname)).trim().slice(0, 200) || 'Imported document';
  return { title, content: sanitizeContent(html) };
}
