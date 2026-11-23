import React, { useState, useEffect, useRef } from 'react';
import {
  Bold, Italic, Underline, Strikethrough, Heading1, Heading2, Heading3,
  List, ListOrdered, Table as TableIcon, Code, PenTool, AlignLeft,
  AlignCenter, AlignRight, AlignJustify, Save, Send, ArrowLeft, ZoomIn,
  ZoomOut, ShieldAlert, CheckCircle2, Clock, FileText, Download, History, RotateCcw, X
} from 'lucide-react';
import { api } from '../lib/api';
import { AcademicDocument, User } from '../types';
import { EngineeringCanvas } from './EngineeringCanvas';

interface DocumentEditorProps {
  docId: string | null;
  currentUser: User;
  onBack: () => void;
  onSubmitted: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const DocumentEditor: React.FC<DocumentEditorProps> = ({
  docId,
  currentUser,
  onBack,
  onSubmitted,
  showToast,
}) => {
  const [doc, setDoc] = useState<AcademicDocument | null>(null);
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState<'Assignment' | 'Experiment'>('Assignment');
  const [subject, setSubject] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [docNumber, setDocNumber] = useState('1');
  const [wordCount, setWordCount] = useState(0);
  const [wordGoal, setWordGoal] = useState(500);
  const [saveStatus, setSaveStatus] = useState<string>('Saved');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [zoom, setZoom] = useState(1.0);
  const [isCanvasOpen, setIsCanvasOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [subjectList, setSubjectList] = useState<any[]>([]);

  const editorRef = useRef<HTMLDivElement | null>(null);
  const lastKeystrokeRef = useRef<number>(0);
  const burstCountRef = useRef<number>(0);
  const autoSaveTimerRef = useRef<any>(null);

  // Load curriculum and existing document
  useEffect(() => {
    loadCurriculum();
    if (docId) {
      loadDocument(docId);
    } else {
      setDoc(null);
      setTitle('');
      setDocType('Assignment');
      setDocNumber('1');
      if (editorRef.current) {
        editorRef.current.innerHTML = '<p>Start authoring your academic document here...</p>';
      }
    }
  }, [docId]);

  const loadCurriculum = async () => {
    try {
      const hierarchy = await api.academic.getHierarchy();
      setSubjectList(hierarchy.subjects || []);
      if (!subject && hierarchy.subjects.length > 0) {
        setSubject(hierarchy.subjects[0].name);
        setSubjectCode(hierarchy.subjects[0].code);
      }
    } catch (e) {
      console.error('Failed to load subjects', e);
    }
  };

  const loadDocument = async (id: string) => {
    try {
      const data = await api.documents.getDocument(id);
      setDoc(data);
      setTitle(data.title);
      setDocType(data.doc_type);
      setSubject(data.subject_name);
      setSubjectCode(data.subject_code);
      setDocNumber(data.doc_number);
      setWordCount(data.word_count);
      setVersions(data.versions || []);
      if (editorRef.current) {
        editorRef.current.innerHTML = data.content_html;
      }
      setHasUnsavedChanges(false);
    } catch (err: any) {
      showToast(err.message || 'Failed to load document', 'error');
    }
  };

  const handleRestoreVersion = async (versionNum: number) => {
    if (!docId) return;
    if (!confirm(`Restore document to version v${versionNum}? Any unsaved changes in current editor will be overwritten.`)) return;
    try {
      const res = await api.documents.restoreVersion(docId, versionNum);
      if (editorRef.current) {
        editorRef.current.innerHTML = res.content_html;
      }
      showToast(`Restored to version v${versionNum}`, 'success');
      loadDocument(docId);
      setShowVersionHistory(false);
    } catch (err: any) {
      showToast(err.message || 'Failed to restore version', 'error');
    }
  };

  // Integrity and Telemetry Listeners
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    // 1. Intercept Paste
    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      showToast('Academic Integrity Violation: External pasting is disabled by institutional policy.', 'error');
      api.integrity.logEvent({
        document_id: docId || undefined,
        event_type: 'paste_attempt',
        severity: 'medium',
        metadata: {
          chars_attempted: e.clipboardData?.getData('text').length || 0,
          timestamp: new Date().toISOString(),
        },
      });
    };

    // 2. Intercept Drag and Drop
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      showToast('Integrity Alert: External drag-and-drop is restricted.', 'error');
      api.integrity.logEvent({
        document_id: docId || undefined,
        event_type: 'drop_attempt',
        severity: 'medium',
        metadata: { timestamp: new Date().toISOString() },
      });
    };

    // 3. Tab Blur / Focus Switch
    const handleBlur = () => {
      if (doc?.status !== 'submitted' && doc?.status !== 'graded') {
        showToast('Security Alert: Focus switch or window blur recorded.', 'info');
        api.integrity.logEvent({
          document_id: docId || undefined,
          event_type: 'tab_blur',
          severity: 'low',
          metadata: { timestamp: new Date().toISOString() },
        });
      }
    };

    // 4. Typing Cadence Burst
    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      if (now - lastKeystrokeRef.current < 30) {
        burstCountRef.current++;
      } else {
        burstCountRef.current = 0;
      }

      if (burstCountRef.current > 15) {
        showToast('Integrity Notice: Unnatural keystroke cadence recorded.', 'info');
        api.integrity.logEvent({
          document_id: docId || undefined,
          event_type: 'typing_burst',
          severity: 'medium',
          metadata: { burst_count: burstCountRef.current },
        });
        burstCountRef.current = 0;
      }
      lastKeystrokeRef.current = now;

      // Ctrl + S Autosave Shortcut
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveDocument(false);
      }
    };

    editor.addEventListener('paste', handlePaste);
    editor.addEventListener('drop', handleDrop);
    editor.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', handleBlur);

    return () => {
      editor.removeEventListener('paste', handlePaste);
      editor.removeEventListener('drop', handleDrop);
      editor.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', handleBlur);
    };
  }, [docId, doc]);

  const handleInput = () => {
    setHasUnsavedChanges(true);
    setSaveStatus('Unsaved Changes');
    updateWordCount();

    // Debounced autosave
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      if (title.trim()) {
        saveDocument(true);
      }
    }, 3500);
  };

  const updateWordCount = () => {
    if (!editorRef.current) return;
    const text = editorRef.current.innerText || '';
    const words = text.trim().split(/\s+/).filter((w) => w.length > 0).length;
    setWordCount(words);
  };

  const executeCommand = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (editorRef.current) editorRef.current.focus();
    handleInput();
  };

  const insertTable = () => {
    const tableHtml = `
      <table style="width:100%; border-collapse:collapse; margin:14px 0; border:1px solid #94a3b8;">
        <thead>
          <tr style="background-color:#f1f5f9;">
            <th style="border:1px solid #94a3b8; padding:8px; text-align:left;">Parameter / Attribute</th>
            <th style="border:1px solid #94a3b8; padding:8px; text-align:left;">Specification / Value</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border:1px solid #94a3b8; padding:8px;">Observation 1</td>
            <td style="border:1px solid #94a3b8; padding:8px;">Data Value</td>
          </tr>
          <tr>
            <td style="border:1px solid #94a3b8; padding:8px;">Observation 2</td>
            <td style="border:1px solid #94a3b8; padding:8px;">Data Value</td>
          </tr>
        </tbody>
      </table>
      <p><br></p>
    `;
    executeCommand('insertHTML', tableHtml);
  };

  const insertCodeBlock = () => {
    const codeHtml = `
      <pre style="background-color:#0f172a; color:#f8fafc; padding:12px; border-radius:8px; font-family:monospace; font-size:12px; margin:12px 0;"><code>// Write your implementation code here
public class AcademicAlgorithm {
    public static void main(String[] args) {
        System.out.println("WriteUp Pro Verified Execution");
    }
}</code></pre>
      <p><br></p>
    `;
    executeCommand('insertHTML', codeHtml);
  };

  const handleCanvasInsert = (dataUrl: string) => {
    executeCommand('insertImage', dataUrl);
    showToast('Diagram inserted into document.', 'success');
  };

  const saveDocument = async (isAuto = false) => {
    if (!title.trim()) {
      if (!isAuto) showToast('Document Title is required.', 'error');
      return;
    }

    try {
      setSaveStatus('Saving...');
      const payload = {
        title: title.trim(),
        subject_name: subject,
        subject_code: subjectCode,
        doc_type: docType,
        doc_number: docNumber,
        content_html: editorRef.current?.innerHTML || '',
        word_count: wordCount,
        status: doc?.status || 'draft',
      };

      const res = await api.documents.saveDocument(payload, docId || undefined);
      setHasUnsavedChanges(false);
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setSaveStatus(`Saved at ${timeStr}`);
      if (!isAuto) showToast('Document saved successfully.', 'success');
    } catch (err: any) {
      setSaveStatus('Save Failed');
      if (!isAuto) showToast(err.message || 'Failed to save document', 'error');
    }
  };

  const handleSubmitFinal = async () => {
    if (!title.trim()) {
      showToast('Document Title is required.', 'error');
      return;
    }
    if (wordCount < 10) {
      showToast('Document cannot be submitted empty. Please write your content.', 'error');
      return;
    }

    const confirmSubmit = window.confirm(
      'Are you sure you want to finalize this submission?\nOnce submitted, an immutable snapshot is recorded and sent to faculty for evaluation.'
    );
    if (!confirmSubmit) return;

    try {
      setIsSubmitting(true);
      // Ensure latest changes saved first
      await saveDocument(true);

      const targetDocId = docId || doc?.id;
      if (!targetDocId) {
        showToast('Save document before final submission.', 'error');
        return;
      }

      const res = await api.submissions.createSubmission(targetDocId);
      showToast(`Document successfully submitted! Receipt: ${res.submission_code}`, 'success');
      onSubmitted();
    } catch (err: any) {
      showToast(err.message || 'Failed to submit document', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isReadOnly = doc?.status === 'submitted' || doc?.status === 'graded';

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden bg-slate-100 dark:bg-slate-950">
      {/* Top Header Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex items-center justify-between shadow-sm z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center gap-1 text-sm font-semibold"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>
          <div className="h-5 w-px bg-slate-200 dark:bg-slate-800" />
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              handleInput();
            }}
            disabled={isReadOnly}
            placeholder="Enter Academic Document Title..."
            className="text-base font-bold text-slate-900 dark:text-white bg-transparent border-0 focus:ring-2 focus:ring-indigo-500 rounded-lg px-2 py-1 w-96 placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
            <Clock className="w-3.5 h-3.5 text-indigo-500" />
            <span>{saveStatus}</span>
          </div>

          {docId && (
            <button
              onClick={() => setShowVersionHistory(true)}
              className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl flex items-center gap-1.5 shadow-sm"
              title="Inspect Version History"
            >
              <History className="w-3.5 h-3.5 text-indigo-500" /> History
            </button>
          )}

          {!isReadOnly ? (
            <>
              <button
                onClick={() => saveDocument(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl flex items-center gap-1.5 shadow-sm"
              >
                <Save className="w-4 h-4 text-slate-500" /> Save Draft
              </button>
              <button
                onClick={handleSubmitFinal}
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/20 flex items-center gap-1.5"
              >
                <Send className="w-4 h-4" /> Final Submit
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                {doc?.status}
              </span>
              <a
                href={api.exports.getPdfUrl(doc?.id || '')}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" /> Download PDF
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Formatting & Controls Toolbar */}
      {!isReadOnly && (
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-2 flex flex-wrap items-center justify-between gap-2 shadow-sm z-10 text-xs">
          <div className="flex items-center gap-1">
            {/* Document Attributes */}
            <select
              value={docType}
              onChange={(e) => {
                setDocType(e.target.value as any);
                handleInput();
              }}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-semibold text-slate-800 dark:text-slate-200"
            >
              <option value="Assignment">Assignment</option>
              <option value="Experiment">Practical Experiment</option>
            </select>

            <select
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                const match = subjectList.find((s) => s.name === e.target.value);
                if (match) setSubjectCode(match.code);
                handleInput();
              }}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 max-w-[180px]"
            >
              {subjectList.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>

            <input
              type="text"
              value={docNumber}
              onChange={(e) => {
                setDocNumber(e.target.value);
                handleInput();
              }}
              placeholder="No."
              className="w-14 px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-center font-bold text-slate-800 dark:text-slate-200"
            />

            <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 mx-1" />

            {/* Rich Text Tools */}
            <button onClick={() => executeCommand('bold')} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800" title="Bold">
              <Bold className="w-4 h-4" />
            </button>
            <button onClick={() => executeCommand('italic')} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800" title="Italic">
              <Italic className="w-4 h-4" />
            </button>
            <button onClick={() => executeCommand('underline')} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800" title="Underline">
              <Underline className="w-4 h-4" />
            </button>
            <button onClick={() => executeCommand('strikeThrough')} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800" title="Strikethrough">
              <Strikethrough className="w-4 h-4" />
            </button>

            <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 mx-1" />

            <button onClick={() => executeCommand('formatBlock', '<h1>')} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800" title="Heading 1">
              <Heading1 className="w-4 h-4" />
            </button>
            <button onClick={() => executeCommand('formatBlock', '<h2>')} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800" title="Heading 2">
              <Heading2 className="w-4 h-4" />
            </button>
            <button onClick={() => executeCommand('formatBlock', '<p>')} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800" title="Paragraph">
              <FileText className="w-4 h-4" />
            </button>

            <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 mx-1" />

            <button onClick={() => executeCommand('insertUnorderedList')} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800" title="Bullet List">
              <List className="w-4 h-4" />
            </button>
            <button onClick={() => executeCommand('insertOrderedList')} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800" title="Numbered List">
              <ListOrdered className="w-4 h-4" />
            </button>
            <button onClick={insertTable} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800" title="Insert Table">
              <TableIcon className="w-4 h-4" />
            </button>
            <button onClick={insertCodeBlock} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800" title="Insert Code Block">
              <Code className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsCanvasOpen(true)}
              className="p-1.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 flex items-center gap-1 font-semibold"
              title="Draw Engineering Diagram"
            >
              <PenTool className="w-4 h-4" /> Canvas
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button onClick={() => setZoom((z) => Math.max(0.6, z - 0.1))} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800" title="Zoom Out">
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="font-mono text-slate-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom((z) => Math.min(1.4, z + 0.1))} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800" title="Zoom In">
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-1.5 border-l border-slate-200 dark:border-slate-800 pl-3">
              <span className="text-slate-500">Words:</span>
              <span className={`font-bold ${wordCount >= wordGoal ? 'text-emerald-600' : 'text-slate-700 dark:text-slate-300'}`}>
                {wordCount}
              </span>
              <span className="text-slate-400">/</span>
              <input
                type="number"
                value={wordGoal}
                onChange={(e) => setWordGoal(Number(e.target.value))}
                className="w-12 px-1 text-center bg-transparent border-b border-slate-300 dark:border-slate-700 text-slate-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Editor Main Canvas - Scrollable A4 View */}
      <div className="flex-1 overflow-y-auto p-8 flex justify-center items-start">
        <div
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
          className="transition-transform duration-150 ease-out flex flex-col gap-6"
        >
          {/* A4 Paper 1: Cover Page */}
          <div className="w-[210mm] min-h-[297mm] bg-white text-slate-900 p-[20mm] shadow-2xl rounded-sm border border-slate-200 flex flex-col justify-between font-sans relative">
            <div>
              {/* Institution Header */}
              <div className="text-center border-b-2 border-indigo-600 pb-4 mb-6">
                <h1 className="text-xl font-extrabold tracking-tight text-slate-900 uppercase">
                  Imperial Institute of Engineering & Technology
                </h1>
                <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">
                  Department of Computer Engineering • Academic Year 2026-27
                </p>
              </div>

              {/* Document Metadata Table */}
              <table className="w-full text-xs border-collapse border border-slate-300 mb-6">
                <tbody>
                  <tr className="bg-slate-50">
                    <td className="border border-slate-300 p-2 font-bold w-1/3">Class & Division</td>
                    <td className="border border-slate-300 p-2">
                      {currentUser.profile && 'year_level' in currentUser.profile
                        ? `${currentUser.profile.year_level} - ${currentUser.profile.division_name}`
                        : 'SE - Div A'}
                    </td>
                    <td className="border border-slate-300 p-2 font-bold w-1/3">Subject Code</td>
                    <td className="border border-slate-300 p-2">{subjectCode || 'CE-CO201'}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-300 p-2 font-bold">Subject Name</td>
                    <td className="border border-slate-300 p-2" colSpan={3}>
                      {subject || 'Computer Engineering Subject'}
                    </td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="border border-slate-300 p-2 font-bold">{docType} Number</td>
                    <td className="border border-slate-300 p-2">{docNumber}</td>
                    <td className="border border-slate-300 p-2 font-bold">Roll Number</td>
                    <td className="border border-slate-300 p-2 font-mono font-bold">
                      {currentUser.profile && 'roll_number' in currentUser.profile ? currentUser.profile.roll_number : '21CE104'}
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-slate-300 p-2 font-bold">Student Name</td>
                    <td className="border border-slate-300 p-2">{currentUser.full_name}</td>
                    <td className="border border-slate-300 p-2 font-bold">Submission Status</td>
                    <td className="border border-slate-300 p-2 font-semibold text-indigo-600 uppercase">
                      {doc?.status || 'Draft'}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Rubric Matrix */}
              <div className="mb-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Evaluation Rubric Criteria Matrix ({docType === 'Assignment' ? 'Max 10 Marks' : 'Max 15 Marks'})
                </h3>
                {(() => {
                  const rubrics = doc?.rubric_scores || (doc?.rubric_scores_json ? (() => { try { return JSON.parse(doc.rubric_scores_json); } catch { return {}; } })() : {});
                  const totalMarks = doc?.marks ?? doc?.marks_awarded ?? null;

                  if (docType === 'Assignment') {
                    return (
                      <table className="w-full text-xs border-collapse border border-slate-300 text-center">
                        <thead>
                          <tr className="bg-slate-100 font-bold">
                            <th className="border border-slate-300 p-2 text-left">Criteria</th>
                            <th className="border border-slate-300 p-2">Below Exp.</th>
                            <th className="border border-slate-300 p-2">Average</th>
                            <th className="border border-slate-300 p-2">Good</th>
                            <th className="border border-slate-300 p-2 w-16">Awarded</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="border border-slate-300 p-2 text-left font-semibold">Knowledge & Understanding (4)</td>
                            <td className="border border-slate-300 p-2">2</td>
                            <td className="border border-slate-300 p-2">3</td>
                            <td className="border border-slate-300 p-2">4</td>
                            <td className="border border-slate-300 p-2 font-bold text-indigo-600">
                              {rubrics.knowledge !== undefined && rubrics.knowledge !== null ? rubrics.knowledge : '-'}
                            </td>
                          </tr>
                          <tr>
                            <td className="border border-slate-300 p-2 text-left font-semibold">Content & Neatness (3)</td>
                            <td className="border border-slate-300 p-2">1</td>
                            <td className="border border-slate-300 p-2">2</td>
                            <td className="border border-slate-300 p-2">3</td>
                            <td className="border border-slate-300 p-2 font-bold text-indigo-600">
                              {rubrics.content !== undefined && rubrics.content !== null ? rubrics.content : '-'}
                            </td>
                          </tr>
                          <tr>
                            <td className="border border-slate-300 p-2 text-left font-semibold">Punctuality (3)</td>
                            <td className="border border-slate-300 p-2">1</td>
                            <td className="border border-slate-300 p-2">2</td>
                            <td className="border border-slate-300 p-2">3</td>
                            <td className="border border-slate-300 p-2 font-bold text-indigo-600">
                              {rubrics.punctuality !== undefined && rubrics.punctuality !== null ? rubrics.punctuality : '-'}
                            </td>
                          </tr>
                          <tr className="bg-slate-50 font-bold">
                            <td className="border border-slate-300 p-2 text-left" colSpan={4}>
                              TOTAL MARKS (10)
                            </td>
                            <td className="border border-slate-300 p-2 text-base text-indigo-700">
                              {totalMarks !== null ? totalMarks : '-'}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    );
                  }

                  return (
                    <table className="w-full text-xs border-collapse border border-slate-300 text-center">
                      <thead>
                        <tr className="bg-slate-100 font-bold">
                          <th className="border border-slate-300 p-2 text-left">Criteria</th>
                          <th className="border border-slate-300 p-2">Below Exp.</th>
                          <th className="border border-slate-300 p-2">Average</th>
                          <th className="border border-slate-300 p-2">Good</th>
                          <th className="border border-slate-300 p-2 w-16">Awarded</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border border-slate-300 p-2 text-left font-semibold">Knowledge & Theory (4)</td>
                          <td className="border border-slate-300 p-2">2</td>
                          <td className="border border-slate-300 p-2">3</td>
                          <td className="border border-slate-300 p-2">4</td>
                          <td className="border border-slate-300 p-2 font-bold text-indigo-600">
                            {rubrics.knowledge !== undefined && rubrics.knowledge !== null ? rubrics.knowledge : '-'}
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-slate-300 p-2 text-left font-semibold">Performance & Implementation (5)</td>
                          <td className="border border-slate-300 p-2">2</td>
                          <td className="border border-slate-300 p-2">3</td>
                          <td className="border border-slate-300 p-2">5</td>
                          <td className="border border-slate-300 p-2 font-bold text-indigo-600">
                            {rubrics.performance !== undefined && rubrics.performance !== null ? rubrics.performance : '-'}
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-slate-300 p-2 text-left font-semibold">Content & Observations (3)</td>
                          <td className="border border-slate-300 p-2">1</td>
                          <td className="border border-slate-300 p-2">2</td>
                          <td className="border border-slate-300 p-2">3</td>
                          <td className="border border-slate-300 p-2 font-bold text-indigo-600">
                            {rubrics.content !== undefined && rubrics.content !== null ? rubrics.content : '-'}
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-slate-300 p-2 text-left font-semibold">Punctuality (3)</td>
                          <td className="border border-slate-300 p-2">1</td>
                          <td className="border border-slate-300 p-2">2</td>
                          <td className="border border-slate-300 p-2">3</td>
                          <td className="border border-slate-300 p-2 font-bold text-indigo-600">
                            {rubrics.punctuality !== undefined && rubrics.punctuality !== null ? rubrics.punctuality : '-'}
                          </td>
                        </tr>
                        <tr className="bg-slate-50 font-bold">
                          <td className="border border-slate-300 p-2 text-left" colSpan={4}>
                            TOTAL MARKS (15)
                          </td>
                          <td className="border border-slate-300 p-2 text-base text-indigo-700">
                            {totalMarks !== null ? totalMarks : '-'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            </div>

            {/* Signature Block */}
            <div className="border-t border-slate-300 pt-4 flex items-center justify-between text-xs text-slate-600">
              <div>
                <p>Digital Submission Verification Code:</p>
                <p className="font-mono font-bold text-slate-900">{doc?.submission_code || 'PENDING SUBMISSION'}</p>
              </div>
              <div className="text-right">
                <p>Faculty Approval Signature:</p>
                <div className="min-h-10 flex flex-col items-end justify-center">
                  {doc?.status === 'graded' ? (
                    <>
                      <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                        DIGITALLY VERIFIED
                      </span>
                      {doc?.digital_signature_code && (
                        <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {doc.digital_signature_code}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-slate-400">________________________</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* A4 Paper 2: Authoring Canvas */}
          <div className="w-[210mm] min-h-[297mm] bg-white text-slate-900 p-[20mm] shadow-2xl rounded-sm border border-slate-200 font-sans relative">
            <div className="border-b border-slate-200 pb-2 mb-4 flex items-center justify-between text-xs text-slate-400">
              <span>{title || 'Untitled Document'}</span>
              <span>Page 2 of 2</span>
            </div>

            {/* Editable Content Region */}
            <div
              ref={editorRef}
              contentEditable={!isReadOnly}
              onInput={handleInput}
              className="outline-none min-h-[220mm] text-[11pt] leading-relaxed text-slate-800 prose max-w-none focus:ring-0"
            />
          </div>
        </div>
      </div>

      {/* Engineering Canvas Modal */}
      <EngineeringCanvas
        isOpen={isCanvasOpen}
        onClose={() => setIsCanvasOpen(false)}
        onInsert={handleCanvasInsert}
      />

      {/* Version History Modal */}
      {showVersionHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Document Version History</h3>
              </div>
              <button
                onClick={() => setShowVersionHistory(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 max-h-96 overflow-y-auto space-y-3">
              {versions.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">No historical versions recorded yet.</p>
              ) : (
                versions.map((ver) => (
                  <div
                    key={ver.version_num}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-indigo-600 dark:text-indigo-400">
                          v{ver.version_num}
                        </span>
                        <span className="text-slate-700 dark:text-slate-300 font-medium">
                          {ver.change_summary}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 font-mono">
                        {new Date(ver.created_at).toLocaleString()}
                      </p>
                    </div>

                    {!isReadOnly && (
                      <button
                        onClick={() => handleRestoreVersion(ver.version_num)}
                        className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 dark:text-slate-200 rounded-lg font-bold flex items-center gap-1 shadow-sm transition-colors text-[11px]"
                      >
                        <RotateCcw className="w-3 h-3" /> Restore
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/20 text-right">
              <button
                onClick={() => setShowVersionHistory(false)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
