import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { api } from './api.js';
import ShareDialog from './ShareDialog.jsx';

const SAVE_DELAY_MS = 800;

/**
 * Debounced autosave. Edits accumulate in `pending`; one request is in flight at a
 * time, and anything typed during a save is sent in a follow-up save.
 */
function useAutosave(id) {
  const [status, setStatus] = useState('saved'); // saved | dirty | saving | error
  const [error, setError] = useState('');
  const pending = useRef({});
  const timer = useRef(null);
  const saving = useRef(false);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    if (saving.current || Object.keys(pending.current).length === 0) return;
    const patch = pending.current;
    pending.current = {};
    saving.current = true;
    setStatus('saving');
    try {
      await api.updateDoc(id, patch);
      setError('');
      saving.current = false;
      if (Object.keys(pending.current).length) flush();
      else setStatus('saved');
    } catch (e) {
      saving.current = false;
      pending.current = { ...patch, ...pending.current }; // keep the edits for a retry
      setError(e.message);
      setStatus('error');
    }
  }, [id]);

  const queue = useCallback((patch) => {
    pending.current = { ...pending.current, ...patch };
    setStatus('dirty');
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
  }, [flush]);

  // Save on the way out, and warn if the tab closes with unsaved edits.
  useEffect(() => {
    const beforeUnload = (e) => {
      if (Object.keys(pending.current).length || saving.current) {
        flush();
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      flush();
    };
  }, [flush]);

  return { status, error, queue, flush };
}

function ToolbarButton({ label, title, active, onClick, disabled }) {
  return (
    <button
      type="button"
      className={`tool${active ? ' active' : ''}`}
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} // keep the text selection
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function Toolbar({ editor }) {
  const chain = () => editor.chain().focus();
  const block = editor.isActive('heading', { level: 1 }) ? 'h1'
    : editor.isActive('heading', { level: 2 }) ? 'h2'
    : editor.isActive('heading', { level: 3 }) ? 'h3' : 'p';
  const setBlock = (value) =>
    value === 'p' ? chain().setParagraph().run() : chain().setHeading({ level: Number(value[1]) }).run();

  return (
    <div className="toolbar" role="toolbar" aria-label="Formatting">
      <select value={block} onChange={(e) => setBlock(e.target.value)} aria-label="Text style">
        <option value="p">Normal text</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
      </select>
      <span className="divider" />
      <ToolbarButton label={<b>B</b>} title="Bold (Ctrl+B)" active={editor.isActive('bold')} onClick={() => chain().toggleBold().run()} />
      <ToolbarButton label={<i>I</i>} title="Italic (Ctrl+I)" active={editor.isActive('italic')} onClick={() => chain().toggleItalic().run()} />
      <ToolbarButton label={<u>U</u>} title="Underline (Ctrl+U)" active={editor.isActive('underline')} onClick={() => chain().toggleUnderline().run()} />
      <span className="divider" />
      <ToolbarButton label="• List" title="Bulleted list" active={editor.isActive('bulletList')} onClick={() => chain().toggleBulletList().run()} />
      <ToolbarButton label="1. List" title="Numbered list" active={editor.isActive('orderedList')} onClick={() => chain().toggleOrderedList().run()} />
      <span className="divider" />
      <ToolbarButton label="Undo" title="Undo (Ctrl+Z)" disabled={!editor.can().undo()} onClick={() => chain().undo().run()} />
      <ToolbarButton label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={!editor.can().redo()} onClick={() => chain().redo().run()} />
    </div>
  );
}

const STATUS_TEXT = { saved: 'All changes saved', dirty: 'Unsaved changes…', saving: 'Saving…', error: 'Not saved' };

function DocumentEditor({ doc }) {
  const canEdit = doc.role !== 'viewer';
  const isOwner = doc.role === 'owner';
  const [title, setTitle] = useState(doc.title);
  const [sharing, setSharing] = useState(false);
  const { status, error, queue, flush } = useAutosave(doc.id);
  const closeShare = useCallback(() => setSharing(false), []);

  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: doc.content,
    editable: canEdit,
    onUpdate: ({ editor }) => queue({ content: editor.getHTML() }),
  });

  const onTitle = (e) => {
    setTitle(e.target.value);
    if (e.target.value.trim()) queue({ title: e.target.value });
  };
  const onTitleBlur = () => {
    if (!title.trim()) setTitle(doc.title); // an empty title is never saved
  };

  return (
    <div className="page">
      <header className="topbar">
        <a className="link" href="#/" onClick={flush}>← Documents</a>
        <input
          className="title-input"
          value={title}
          onChange={onTitle}
          onBlur={onTitleBlur}
          readOnly={!canEdit}
          maxLength={200}
          aria-label="Document title"
        />
        <span className={`badge ${doc.role}`}>
          {isOwner ? 'Owner' : canEdit ? `Can edit · owner ${doc.owner.name}` : `View only · owner ${doc.owner.name}`}
        </span>
        <span className="spacer" />
        {canEdit && (
          <span className={`save-status ${status}`} role="status">
            {STATUS_TEXT[status]}
            {status === 'error' && <button className="link" onClick={flush}>Retry</button>}
          </span>
        )}
        {isOwner && <button className="primary" onClick={() => setSharing(true)}>Share</button>}
      </header>

      {status === 'error' && <p className="error banner" role="alert">{error}</p>}
      {!canEdit && <p className="banner muted">You have view-only access. Ask {doc.owner.name} for edit access to make changes.</p>}
      {canEdit && editor && <Toolbar editor={editor} />}

      <main className="paper-wrap">
        <EditorContent editor={editor} className="paper" />
      </main>

      {sharing && <ShareDialog docId={doc.id} ownerId={doc.owner.id} onClose={closeShare} />}
    </div>
  );
}

export default function EditorPage({ id }) {
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getDoc(id).then((r) => setDoc(r.document)).catch((e) => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <div className="center">
        <div className="card">
          <p className="error" role="alert">{error}</p>
          <p className="muted">It may have been deleted, or you may no longer have access.</p>
          <a className="link" href="#/">← Back to documents</a>
        </div>
      </div>
    );
  }
  if (!doc) return <div className="center muted">Opening document…</div>;
  return <DocumentEditor doc={doc} />;
}
