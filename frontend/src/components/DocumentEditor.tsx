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
    <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden bg-[#ECE4D4] dark:bg-[#12100E]">
      {/* Top Header Bar */}
      <div className="bg-white dark:bg-[#1D1814] border-b-2 border-[#1A1209] px-6 py-2.5 flex items-center justify-between shadow-sm z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="neo-btn px-3 py-1.5 bg-[#F4EFE6] dark:bg-[#26201B] text-[#1A1209] dark:text-[#F7F3E9] text-xs flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" /> ← BACK TO DOSSIER
          </button>
          <div className="h-5 w-0.5 bg-[#1A1209]" />
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              handleInput();
            }}
            disabled={isReadOnly}
            placeholder="Enter Academic Document Title..."
            className="text-sm font-bold tracking-tight text-[#1A1209] dark:text-white bg-transparent border-b-2 border-transparent focus:border-[#B84915] outline-none px-2 py-0.5 w-96 placeholder:text-[#786958]"
          />
        </div>

        <div className="flex items-center gap-3 font-mono">
          <div className="flex items-center gap-2 text-[11px] text-[#5C4D3C] dark:text-[#D4C7B5] bg-[#F4EFE6] dark:bg-[#26201B] px-3 py-1.5 border border-[#1A1209] shadow-[1.5px_1.5px_0px_#1A1209]">
            <Clock className="w-3.5 h-3.5 text-[#B84915]" />
            <span>{saveStatus}</span>
          </div>

          {docId && (
            <button
              onClick={() => setShowVersionHistory(true)}
              className="neo-btn px-3 py-1.5 text-xs bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-[#F7F3E9] flex items-center gap-1.5"
              title="Inspect Version History"
            >
              <History className="w-3.5 h-3.5 text-[#B84915]" /> History
            </button>
          )}

          {!isReadOnly ? (
            <>
              <button
                onClick={() => saveDocument(false)}
                className="neo-btn px-4 py-1.5 text-xs bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-[#F7F3E9] flex items-center gap-1.5"
              >
                <Save className="w-4 h-4 text-[#786958]" /> Save Draft
              </button>
              <button
                onClick={handleSubmitFinal}
                disabled={isSubmitting}
                className="neo-btn px-5 py-1.5 text-xs bg-[#B84915] hover:bg-[#A03D0E] text-white flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-4 h-4" /> Final Submit →
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <span className="stamp-badge bg-[#1F5A2E]/10 text-[#1F5A2E] border-[#1F5A2E]">
                {doc?.status}
              </span>
              <a
                href={api.exports.getPdfUrl(doc?.id || '')}
                target="_blank"
                rel="noreferrer"
                className="neo-btn px-4 py-1.5 text-xs bg-[#1A365D] hover:bg-[#12243F] text-white flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" /> Download PDF
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Formatting & Controls Toolbar */}
      {!isReadOnly && (
        <div className="bg-[#FAF6EE] dark:bg-[#26201B] border-b-2 border-[#1A1209] px-6 py-2 flex flex-wrap items-center justify-between gap-2 z-10 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            {/* Document Attributes */}
            <select
              value={docType}
              onChange={(e) => {
                setDocType(e.target.value as any);
                handleInput();
              }}
              className="px-2.5 py-1.5 bg-[#FFFAF1] dark:bg-[#1D1814] border-2 border-[#1A1209] font-bold text-[#1A1209] dark:text-white text-xs outline-none"
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
              className="px-2.5 py-1.5 bg-[#FFFAF1] dark:bg-[#1D1814] border-2 border-[#1A1209] text-[#1A1209] dark:text-white max-w-[180px] text-xs outline-none"
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
              className="w-14 px-2 py-1.5 bg-[#FFFAF1] dark:bg-[#1D1814] border-2 border-[#1A1209] text-center font-bold text-[#1A1209] dark:text-white text-xs outline-none"
            />

            <div className="h-5 w-0.5 bg-[#1A1209] mx-1" />

            {/* Rich Text Tools */}
            <button onClick={() => executeCommand('bold')} className="p-1.5 border border-[#1A1209] bg-white dark:bg-[#1D1814] hover:bg-[#F4EFE6] text-[#1A1209] dark:text-white" title="Bold">
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => executeCommand('italic')} className="p-1.5 border border-[#1A1209] bg-white dark:bg-[#1D1814] hover:bg-[#F4EFE6] text-[#1A1209] dark:text-white" title="Italic">
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => executeCommand('underline')} className="p-1.5 border border-[#1A1209] bg-white dark:bg-[#1D1814] hover:bg-[#F4EFE6] text-[#1A1209] dark:text-white" title="Underline">
              <Underline className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => executeCommand('strikeThrough')} className="p-1.5 border border-[#1A1209] bg-white dark:bg-[#1D1814] hover:bg-[#F4EFE6] text-[#1A1209] dark:text-white" title="Strikethrough">
              <Strikethrough className="w-3.5 h-3.5" />
            </button>

            <div className="h-5 w-0.5 bg-[#1A1209] mx-1" />

            <button onClick={() => executeCommand('formatBlock', '<h1>')} className="p-1.5 border border-[#1A1209] bg-white dark:bg-[#1D1814] hover:bg-[#F4EFE6] text-[#1A1209] dark:text-white" title="Heading 1">
              <Heading1 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => executeCommand('formatBlock', '<h2>')} className="p-1.5 border border-[#1A1209] bg-white dark:bg-[#1D1814] hover:bg-[#F4EFE6] text-[#1A1209] dark:text-white" title="Heading 2">
              <Heading2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => executeCommand('formatBlock', '<p>')} className="p-1.5 border border-[#1A1209] bg-white dark:bg-[#1D1814] hover:bg-[#F4EFE6] text-[#1A1209] dark:text-white" title="Paragraph">
              <FileText className="w-3.5 h-3.5" />
            </button>

            <div className="h-5 w-0.5 bg-[#1A1209] mx-1" />

            <button onClick={() => executeCommand('insertUnorderedList')} className="p-1.5 border border-[#1A1209] bg-white dark:bg-[#1D1814] hover:bg-[#F4EFE6] text-[#1A1209] dark:text-white" title="Bullet List">
              <List className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => executeCommand('insertOrderedList')} className="p-1.5 border border-[#1A1209] bg-white dark:bg-[#1D1814] hover:bg-[#F4EFE6] text-[#1A1209] dark:text-white" title="Numbered List">
              <ListOrdered className="w-3.5 h-3.5" />
            </button>
            <button onClick={insertTable} className="p-1.5 border border-[#1A1209] bg-white dark:bg-[#1D1814] hover:bg-[#F4EFE6] text-[#1A1209] dark:text-white" title="Insert Table">
              <TableIcon className="w-3.5 h-3.5" />
            </button>
            <button onClick={insertCodeBlock} className="p-1.5 border border-[#1A1209] bg-white dark:bg-[#1D1814] hover:bg-[#F4EFE6] text-[#1A1209] dark:text-white" title="Insert Code Block">
              <Code className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsCanvasOpen(true)}
              className="neo-btn px-2.5 py-1 text-xs bg-[#1A365D] hover:bg-[#12243F] text-white flex items-center gap-1 font-mono"
              title="Draw Engineering Diagram"
            >
              <PenTool className="w-3.5 h-3.5" /> CANVAS
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button onClick={() => setZoom((z) => Math.max(0.6, z - 0.1))} className="p-1 border border-[#1A1209] bg-white dark:bg-[#1D1814]" title="Zoom Out">
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[#1A1209] dark:text-white w-10 text-center font-bold">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom((z) => Math.min(1.4, z + 0.1))} className="p-1 border border-[#1A1209] bg-white dark:bg-[#1D1814]" title="Zoom In">
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-1.5 border-l-2 border-[#1A1209] pl-3">
              <span className="text-[#786958]">WORDS:</span>
              <span className={`font-bold font-mono ${wordCount >= wordGoal ? 'text-[#1F5A2E]' : 'text-[#1A1209] dark:text-white'}`}>
                {wordCount}
              </span>
              <span className="text-[#786958]">/</span>
              <input
                type="number"
                value={wordGoal}
                onChange={(e) => setWordGoal(Number(e.target.value))}
                className="w-12 px-1 text-center bg-transparent border-b-2 border-[#1A1209] font-mono text-[#1A1209] dark:text-white font-bold"
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
          <div className="w-[210mm] min-h-[297mm] bg-white text-[#1A1209] p-[20mm] border-2 border-[#1A1209] shadow-[6px_6px_0px_#1A1209] flex flex-col justify-between font-sans relative">
            <div>
              {/* Institution Header */}
              <div className="text-center border-b-2 border-[#1A1209] pb-4 mb-6">
                <span className="font-mono text-[9px] uppercase tracking-widest text-[#B84915] font-bold block mb-1">
                  OFFICIAL INSTITUTIONAL RECORD // ACADEMIC YEAR 2026-27
                </span>
                <h1 className="text-xl font-extrabold uppercase tracking-tight text-[#1A1209]">
                  Imperial Institute of Engineering & Technology
                </h1>
                <p className="text-xs text-[#5C4D3C] uppercase tracking-widest mt-1 font-mono">
                  Department of Computer Engineering • Academic Year 2026-27
                </p>
              </div>

              {/* Document Metadata Table */}
              <table className="w-full text-xs border-collapse border-2 border-[#1A1209] mb-6 font-mono">
                <tbody>
                  <tr className="bg-[#FAF6EE]">
                    <td className="border-2 border-[#1A1209] p-2 font-bold w-1/3">Class & Division</td>
                    <td className="border-2 border-[#1A1209] p-2">{`${profile?.year_level || 'SE'} - ${profile?.division_name || 'Div A'}`}</td>
                    <td className="border-2 border-[#1A1209] p-2 font-bold w-1/3">Subject Code</td>
                    <td className="border-2 border-[#1A1209] p-2">{subjectCode}</td>
                  </tr>
                  <tr>
                    <td className="border-2 border-[#1A1209] p-2 font-bold">Subject Name</td>
                    <td className="border-2 border-[#1A1209] p-2 font-sans font-bold" colSpan={3}>{subject}</td>
                  </tr>
                  <tr className="bg-[#FAF6EE]">
                    <td className="border-2 border-[#1A1209] p-2 font-bold">{docType} Number</td>
                    <td className="border-2 border-[#1A1209] p-2">{docNumber}</td>
                    <td className="border-2 border-[#1A1209] p-2 font-bold">Roll Number</td>
                    <td className="border-2 border-[#1A1209] p-2 font-bold">{profile?.roll_number || '21CE104'}</td>
                  </tr>
                  <tr>
                    <td className="border-2 border-[#1A1209] p-2 font-bold">Student Name</td>
                    <td className="border-2 border-[#1A1209] p-2 font-sans font-bold">{currentUser.full_name}</td>
                    <td className="border-2 border-[#1A1209] p-2 font-bold">Submission Status</td>
                    <td className="border-2 border-[#1A1209] p-2 font-bold uppercase">
                      <span className="stamp-badge py-0 bg-white text-[#1A1209]">
                        {doc?.status || 'DRAFT'}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Rubric Matrix */}
              <div className="mb-6 font-mono">
                <span className="text-[9px] font-bold uppercase tracking-widest text-[#B84915] block mb-1">
                  EVALUATION RUBRIC CRITERIA MATRIX // {docType === 'Assignment' ? 'MAX 10 MARKS' : 'MAX 15 MARKS'}
                </span>
                {(() => {
                  const rubrics = doc?.rubric_scores || (doc?.rubric_scores_json ? (() => { try { return JSON.parse(doc.rubric_scores_json); } catch { return {}; } })() : {});
                  const totalMarks = doc?.marks ?? doc?.marks_awarded ?? null;

                  if (docType === 'Assignment') {
                    return (
                      <table className="w-full text-xs border-collapse border-2 border-[#1A1209] text-center font-mono">
                        <thead>
                          <tr className="bg-[#FAF6EE] font-bold border-b-2 border-[#1A1209]">
                            <th className="border-2 border-[#1A1209] p-2 text-left">Criteria</th>
                            <th className="border-2 border-[#1A1209] p-2">Below Exp.</th>
                            <th className="border-2 border-[#1A1209] p-2">Average</th>
                            <th className="border-2 border-[#1A1209] p-2">Good</th>
                            <th className="border-2 border-[#1A1209] p-2 w-20">Awarded</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="border-2 border-[#1A1209] p-2 text-left font-bold">1. Knowledge & Understanding (Max: 4)</td>
                            <td className="border-2 border-[#1A1209] p-2">2</td>
                            <td className="border-2 border-[#1A1209] p-2">3</td>
                            <td className="border-2 border-[#1A1209] p-2">4</td>
                            <td className="border-2 border-[#1A1209] p-2 font-bold text-[#B84915]">
                              {rubrics.knowledge !== undefined && rubrics.knowledge !== null ? `${rubrics.knowledge} / 4` : '—'}
                            </td>
                          </tr>
                          <tr className="bg-[#FAF6EE]/50">
                            <td className="border-2 border-[#1A1209] p-2 text-left font-bold">2. Content Structure & Neatness (Max: 3)</td>
                            <td className="border-2 border-[#1A1209] p-2">1</td>
                            <td className="border-2 border-[#1A1209] p-2">2</td>
                            <td className="border-2 border-[#1A1209] p-2">3</td>
                            <td className="border-2 border-[#1A1209] p-2 font-bold text-[#B84915]">
                              {rubrics.content !== undefined && rubrics.content !== null ? `${rubrics.content} / 3` : '—'}
                            </td>
                          </tr>
                          <tr>
                            <td className="border-2 border-[#1A1209] p-2 text-left font-bold">3. Academic Punctuality (Max: 3)</td>
                            <td className="border-2 border-[#1A1209] p-2">1</td>
                            <td className="border-2 border-[#1A1209] p-2">2</td>
                            <td className="border-2 border-[#1A1209] p-2">3</td>
                            <td className="border-2 border-[#1A1209] p-2 font-bold text-[#B84915]">
                              {rubrics.punctuality !== undefined && rubrics.punctuality !== null ? `${rubrics.punctuality} / 3` : '—'}
                            </td>
                          </tr>
                          <tr className="bg-[#FAF6EE] font-bold border-t-2 border-[#1A1209]">
                            <td className="border-2 border-[#1A1209] p-2 text-left font-black" colSpan={4}>
                              TOTAL EVALUATION SCORE (MAX 10)
                            </td>
                            <td className="border-2 border-[#1A1209] p-2 font-black text-sm text-[#1A1209]">
                              {totalMarks !== null ? `${totalMarks} / 10` : '—'}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    );
                  }

                  return (
                    <table className="w-full text-xs border-collapse border-2 border-[#1A1209] text-center font-mono">
                      <thead>
                        <tr className="bg-[#FAF6EE] font-bold border-b-2 border-[#1A1209]">
                          <th className="border-2 border-[#1A1209] p-2 text-left">Criteria</th>
                          <th className="border-2 border-[#1A1209] p-2">Below Exp.</th>
                          <th className="border-2 border-[#1A1209] p-2">Average</th>
                          <th className="border-2 border-[#1A1209] p-2">Good</th>
                          <th className="border-2 border-[#1A1209] p-2 w-20">Awarded</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border-2 border-[#1A1209] p-2 text-left font-bold">1. Knowledge & Theory (Max: 4)</td>
                          <td className="border-2 border-[#1A1209] p-2">2</td>
                          <td className="border-2 border-[#1A1209] p-2">3</td>
                          <td className="border-2 border-[#1A1209] p-2">4</td>
                          <td className="border-2 border-[#1A1209] p-2 font-bold text-[#B84915]">
                            {rubrics.knowledge !== undefined && rubrics.knowledge !== null ? `${rubrics.knowledge} / 4` : '—'}
                          </td>
                        </tr>
                        <tr className="bg-[#FAF6EE]/50">
                          <td className="border-2 border-[#1A1209] p-2 text-left font-bold">2. Performance & Implementation (Max: 5)</td>
                          <td className="border-2 border-[#1A1209] p-2">2</td>
                          <td className="border-2 border-[#1A1209] p-2">3</td>
                          <td className="border-2 border-[#1A1209] p-2">5</td>
                          <td className="border-2 border-[#1A1209] p-2 font-bold text-[#B84915]">
                            {rubrics.performance !== undefined && rubrics.performance !== null ? `${rubrics.performance} / 5` : '—'}
                          </td>
                        </tr>
                        <tr>
                          <td className="border-2 border-[#1A1209] p-2 text-left font-bold">3. Content & Observations (Max: 3)</td>
                          <td className="border-2 border-[#1A1209] p-2">1</td>
                          <td className="border-2 border-[#1A1209] p-2">2</td>
                          <td className="border-2 border-[#1A1209] p-2">3</td>
                          <td className="border-2 border-[#1A1209] p-2 font-bold text-[#B84915]">
                            {rubrics.content !== undefined && rubrics.content !== null ? `${rubrics.content} / 3` : '—'}
                          </td>
                        </tr>
                        <tr className="bg-[#FAF6EE]/50">
                          <td className="border-2 border-[#1A1209] p-2 text-left font-bold">4. Academic Punctuality (Max: 3)</td>
                          <td className="border-2 border-[#1A1209] p-2">1</td>
                          <td className="border-2 border-[#1A1209] p-2">2</td>
                          <td className="border-2 border-[#1A1209] p-2">3</td>
                          <td className="border-2 border-[#1A1209] p-2 font-bold text-[#B84915]">
                            {rubrics.punctuality !== undefined && rubrics.punctuality !== null ? `${rubrics.punctuality} / 3` : '—'}
                          </td>
                        </tr>
                        <tr className="bg-[#FAF6EE] font-bold border-t-2 border-[#1A1209]">
                          <td className="border-2 border-[#1A1209] p-2 text-left font-black" colSpan={4}>
                            TOTAL EVALUATION SCORE (MAX 15)
                          </td>
                          <td className="border-2 border-[#1A1209] p-2 font-black text-sm text-[#1A1209]">
                            {totalMarks !== null ? `${totalMarks} / 15` : '—'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            </div>

            {/* Signature Block */}
            <div className="border-t-2 border-[#1A1209] pt-4 flex items-center justify-between text-xs font-mono text-[#5C4D3C]">
              <div>
                <p className="font-bold text-[10px] uppercase text-[#786958]">Submission Verification Code:</p>
                <p className="font-mono font-black text-[#1A1209] text-xs">{doc?.submission_code || 'PENDING SUBMISSION'}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-[10px] uppercase text-[#786958]">Faculty Approval Signature:</p>
                <div className="min-h-10 flex flex-col items-end justify-center">
                  {doc?.status === 'graded' ? (
                    <>
                      <span className="stamp-badge py-0.5 px-2 bg-[#1F5A2E]/10 text-[#1F5A2E] border-[#1F5A2E]">
                        DIGITALLY VERIFIED & APPROVED
                      </span>
                      {doc?.digital_signature_code && (
                        <span className="text-[10px] text-[#1A1209] font-mono font-bold mt-1">
                          STAMP: {doc.digital_signature_code}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-[#A89886] font-mono tracking-widest">________________________</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* A4 Paper 2: Authoring Canvas */}
          <div className="w-[210mm] min-h-[297mm] bg-white text-[#1A1209] p-[20mm] border-2 border-[#1A1209] shadow-[6px_6px_0px_#1A1209] font-sans relative">
            <div className="border-b-2 border-[#1A1209] pb-2 mb-4 flex items-center justify-between text-xs font-mono text-[#786958]">
              <span className="font-bold text-[#1A1209]">{title || 'Untitled Academic Write-up'}</span>
              <span>Page 2 of 2 // Manuscript Body</span>
            </div>

            {/* Editable Content Region */}
            <div
              ref={editorRef}
              contentEditable={!isReadOnly}
              onInput={handleInput}
              className="outline-none min-h-[220mm] text-[11pt] leading-relaxed text-[#1A1209] prose max-w-none focus:ring-0"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[6px_6px_0px_#1A1209] w-full max-w-lg overflow-hidden flex flex-col font-mono">
            <div className="flex items-center justify-between px-6 py-4 bg-[#F4EFE6] dark:bg-[#26201B] border-b-2 border-[#1A1209]">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-[#B84915]" />
                <h3 className="text-base font-bold text-[#1A1209] dark:text-white uppercase">DOCUMENT VERSION HISTORY</h3>
              </div>
              <button
                onClick={() => setShowVersionHistory(false)}
                className="neo-btn p-1 bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 max-h-96 overflow-y-auto space-y-3">
              {versions.length === 0 ? (
                <p className="text-xs text-[#786958] text-center py-6">No historical versions recorded yet.</p>
              ) : (
                versions.map((ver) => (
                  <div
                    key={ver.version_num}
                    className="p-3.5 border-2 border-[#1A1209] bg-[#FAF6EE] dark:bg-[#26201B] shadow-[2px_2px_0px_#1A1209] flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#B84915]">
                          v{ver.version_num}
                        </span>
                        <span className="text-[#1A1209] dark:text-white font-sans font-semibold">
                          {ver.change_summary}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#786958] mt-1 font-mono">
                        {new Date(ver.created_at).toLocaleString()}
                      </p>
                    </div>

                    {!isReadOnly && (
                      <button
                        onClick={() => handleRestoreVersion(ver.version_num)}
                        className="neo-btn px-2.5 py-1.5 bg-[#1A365D] hover:bg-[#12243F] text-white text-[11px] flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" /> Restore
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t-2 border-[#1A1209] bg-[#FAF6EE] dark:bg-[#26201B] text-right">
              <button
                onClick={() => setShowVersionHistory(false)}
                className="neo-btn px-4 py-1.5 bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-white text-xs"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
