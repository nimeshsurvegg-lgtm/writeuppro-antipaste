import React, { useState, useEffect, useRef } from 'react';
import {
  X, UploadCloud, FileText, Link2, Edit3, CheckCircle2, AlertTriangle,
  Clock, Download, Trash2, Eye, ShieldCheck, FileCheck, Layers, ExternalLink,
  Save, Send, RefreshCw, FileCode, Check
} from 'lucide-react';
import { api } from '../lib/api';
import { Task, AcademicDocument, Submission, SubmissionAttachment, SpecialSubmissionPayload } from '../types';

interface SpecialDocumentSubmissionModalProps {
  task: Task;
  existingDocId?: string | null;
  onClose: () => void;
  onSubmitted: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const SpecialDocumentSubmissionModal: React.FC<SpecialDocumentSubmissionModalProps> = ({
  task,
  existingDocId,
  onClose,
  onSubmitted,
  showToast,
}) => {
  const allowedMethods = (task.allowed_methods && task.allowed_methods.length > 0)
    ? task.allowed_methods
    : ['editor', 'pdf', 'docx', 'other_files', 'external_link'];

  const allowMultiple = Boolean(task.allow_multiple_methods);
  const maxFileSizeMb = task.max_file_size_mb || 15;
  const maxFiles = task.max_files_count || 3;
  const allowedExts = task.allowed_extensions || ['pdf', 'docx', 'doc', 'zip', 'pptx', 'xlsx', 'png', 'jpg', 'txt'];

  // Current active method or multi-mode
  const [activeMethod, setActiveMethod] = useState<'editor' | 'pdf' | 'docx' | 'other_files' | 'external_link' | 'multi'>(
    allowedMethods[0] || 'editor'
  );

  // Document metadata & inputs
  const [docId, setDocId] = useState<string | null>(existingDocId || null);
  const [title, setTitle] = useState(task.title || '');
  const [contentHtml, setContentHtml] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [externalTitle, setExternalTitle] = useState('');
  const [externalDesc, setExternalDesc] = useState('');

  // Attachments
  const [attachments, setAttachments] = useState<SubmissionAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States
  const [loading, setLoading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [submissionReceipt, setSubmissionReceipt] = useState<any | null>(null);
  const [existingSubmission, setExistingSubmission] = useState<Submission | null>(null);
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<string | null>(null);

  // Word count & Char count
  const wordCount = contentHtml.replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  const charCount = contentHtml.replace(/<[^>]*>/g, '').length;

  // Deadline calculation
  const isPastDeadline = Boolean(task.due_date && new Date() > new Date(task.due_date));

  // Load existing document or submission
  useEffect(() => {
    loadExistingData();
  }, [existingDocId, task.id]);

  const loadExistingData = async () => {
    try {
      setLoading(true);
      if (existingDocId) {
        const doc = await api.documents.getDocument(existingDocId);
        if (doc) {
          setDocId(doc.id);
          setTitle(doc.title || task.title);
          setContentHtml(doc.content_html || '');
          setExternalUrl(doc.external_link_url || '');
          setExternalTitle(doc.external_link_title || '');
          setExternalDesc(doc.external_link_description || '');
          if (doc.submission_method && allowedMethods.includes(doc.submission_method as any)) {
            setActiveMethod(doc.submission_method as any);
          }
          if (doc.attachments && Array.isArray(doc.attachments)) {
            setAttachments(doc.attachments);
          }
          if (doc.status === 'submitted' || doc.status === 'graded' || doc.status === 'returned') {
            const subs = await api.submissions.listSubmissions({ task_id: task.id }).catch(() => []);
            const matched = subs.find((s: any) => s.document_id === doc.id || s.task_id === task.id);
            if (matched) {
              const fullSub = await api.submissions.getSubmission(matched.submission_id).catch(() => matched);
              setExistingSubmission(fullSub);
            }
          }
        }
      } else {
        // Check if student already has a draft or submission for this task
        const subs = await api.submissions.listSubmissions({ task_id: task.id }).catch(() => []);
        if (subs && subs.length > 0) {
          const matched = subs[0];
          const fullSub = await api.submissions.getSubmission(matched.submission_id).catch(() => matched);
          setExistingSubmission(fullSub);
          if (fullSub.document_id) {
            setDocId(fullSub.document_id);
          }
        }
      }
    } catch (err: any) {
      console.warn('Could not load existing document data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Upload handler
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    if (attachments.length + files.length > maxFiles) {
      showToast(`Maximum attachment limit reached (${maxFiles} files allowed).`, 'error');
      return;
    }

    setUploading(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Client-side extension validation
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const cleanAllowed = allowedExts.map((e) => e.toLowerCase().replace('.', ''));

      if (activeMethod === 'pdf' && ext !== 'pdf') {
        showToast(`Only PDF files (.pdf) are permitted in this upload channel. Received .${ext}`, 'error');
        continue;
      }
      if (activeMethod === 'docx' && !['doc', 'docx'].includes(ext)) {
        showToast(`Only Word documents (.doc, .docx) are permitted. Received .${ext}`, 'error');
        continue;
      }
      if (activeMethod === 'other_files' && !cleanAllowed.includes(ext)) {
        showToast(`File type .${ext} is not permitted. Permitted formats: ${cleanAllowed.join(', ')}`, 'error');
        continue;
      }

      // Client-side size check
      if (file.size > maxFileSizeMb * 1024 * 1024) {
        showToast(`File '${file.name}' exceeds maximum permitted size of ${maxFileSizeMb} MB.`, 'error');
        continue;
      }

      try {
        const uploaded = await api.specialSubmissions.uploadAttachment(task.id, file, docId || undefined);
        setAttachments((prev) => [...prev, uploaded]);
        showToast(`'${file.name}' uploaded successfully.`, 'success');
      } catch (err: any) {
        showToast(err.message || `Failed to upload '${file.name}'.`, 'error');
      }
    }
    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Delete attachment
  const handleDeleteAttachment = async (attId: string) => {
    try {
      await api.specialSubmissions.deleteAttachment(attId);
      setAttachments((prev) => prev.filter((a) => a.id !== attId));
      showToast('Attachment removed.', 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to remove attachment.', 'error');
    }
  };

  // Save Draft
  const handleSaveDraft = async () => {
    if (!title.trim()) {
      showToast('Document title is required.', 'error');
      return;
    }
    try {
      setSavingDraft(true);
      const payload: SpecialSubmissionPayload = {
        task_id: task.id,
        document_id: docId || undefined,
        submission_method: activeMethod,
        title: title.trim(),
        content_html: contentHtml,
        word_count: wordCount,
        external_link_url: externalUrl.trim() || undefined,
        external_link_title: externalTitle.trim() || undefined,
        external_link_description: externalDesc.trim() || undefined,
        attachment_ids: attachments.map((a) => a.id),
        is_draft: true,
      };

      const res = await api.specialSubmissions.submitSpecialDocument(payload);
      if (res.document_id) {
        setDocId(res.document_id);
      }
      setLastDraftSavedAt(new Date().toLocaleTimeString());
      showToast('Draft successfully saved to server. You can resume editing anytime.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save draft.', 'error');
    } finally {
      setSavingDraft(false);
    }
  };

  // Final Submit
  const handleFinalSubmit = async () => {
    if (!title.trim()) {
      showToast('Document title is required.', 'error');
      return;
    }

    // Completeness validation
    const hasFiles = attachments.length > 0;
    const hasLink = Boolean(externalUrl && externalUrl.trim().length > 5);
    const hasEditor = Boolean(contentHtml && contentHtml.replace(/<[^>]*>/g, '').trim().length >= 10);

    if (activeMethod === 'pdf' && !hasFiles) {
      showToast('Please upload your PDF manuscript before final submission.', 'error');
      return;
    }
    if (activeMethod === 'docx' && !hasFiles) {
      showToast('Please upload your Word document (.docx) before final submission.', 'error');
      return;
    }
    if (activeMethod === 'other_files' && !hasFiles) {
      showToast('Please upload required project file(s) before final submission.', 'error');
      return;
    }
    if (activeMethod === 'external_link' && !hasLink) {
      showToast('Please enter a valid external document/project link.', 'error');
      return;
    }
    if (activeMethod === 'editor' && !hasEditor) {
      showToast('Please write your submission content before final submission.', 'error');
      return;
    }
    if (activeMethod === 'multi' && !hasFiles && !hasLink && !hasEditor) {
      showToast('Please provide at least one submission component (files, link, or write-up).', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const payload: SpecialSubmissionPayload = {
        task_id: task.id,
        document_id: docId || undefined,
        submission_method: activeMethod,
        title: title.trim(),
        content_html: contentHtml,
        word_count: wordCount,
        external_link_url: externalUrl.trim() || undefined,
        external_link_title: externalTitle.trim() || undefined,
        external_link_description: externalDesc.trim() || undefined,
        attachment_ids: attachments.map((a) => a.id),
        is_draft: false,
      };

      const res = await api.specialSubmissions.submitSpecialDocument(payload);
      setSubmissionReceipt(res);
      showToast(`Submission successfully finalized! Code: ${res.submission_code}`, 'success');
      onSubmitted();
    } catch (err: any) {
      showToast(err.message || 'Final submission failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // If already submitted and finalized (not returned)
  const isFinalized = existingSubmission && existingSubmission.status !== 'returned';

  return (
    <div className="fixed inset-0 z-50 bg-[#1A1209]/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#FAF6EE] dark:bg-[#1D1814] w-full max-w-4xl border-2 border-[#1A1209] shadow-[6px_6px_0px_#1A1209] my-auto max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* MODAL HEADER */}
        <div className="p-4 border-b-2 border-[#1A1209] bg-white dark:bg-[#26201B] flex items-center justify-between shrink-0">
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="stamp-badge text-[9px] bg-[#1A365D] text-white">
                {task.document_category || 'SPECIAL DOCUMENT'}
              </span>
              <span className="text-[10px] font-bold text-[#786958]">
                {task.subject_code} // {task.subject_name}
              </span>
              {isPastDeadline && (
                <span className="stamp-badge text-[9px] bg-[#8B1A1A] text-white flex items-center gap-1">
                  <Clock className="w-3 h-3" /> PAST DEADLINE
                </span>
              )}
              {lastDraftSavedAt && (
                <span className="text-[9px] text-[#1F5A2E] font-bold flex items-center gap-1">
                  <Check className="w-3 h-3" /> Draft saved at {lastDraftSavedAt}
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-lg font-black text-[#1A1209] dark:text-white uppercase tracking-tight">
              {task.title}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 border border-[#1A1209] hover:bg-[#8B1A1A] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* SUCCESS RECEIPT VIEW (IF JUST SUBMITTED) */}
          {submissionReceipt ? (
            <div className="p-6 bg-white dark:bg-[#26201B] border-2 border-[#1A1209] shadow-[4px_4px_0px_#1A1209] text-center space-y-4">
              <div className="w-12 h-12 bg-[#1F5A2E] text-white rounded-none border-2 border-[#1A1209] mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <span className="stamp-badge text-[10px] bg-[#1F5A2E] text-white">SUBMISSION RECEIPT ISSUED</span>
                <h3 className="text-xl font-black text-[#1A1209] dark:text-white mt-1">
                  {submissionReceipt.submission_code}
                </h3>
                <p className="text-xs text-[#786958] mt-1">
                  Timestamp: {submissionReceipt.submission_date} • {submissionReceipt.delay_text}
                </p>
              </div>
              <div className="p-3 bg-[#FAF6EE] dark:bg-[#1D1814] border border-[#1A1209] text-left text-xs space-y-1">
                <p><strong>Title:</strong> {title}</p>
                <p><strong>Channel:</strong> {activeMethod.toUpperCase()}</p>
                {attachments.length > 0 && (
                  <p><strong>Attachments:</strong> {attachments.map((a) => a.original_filename).join(', ')}</p>
                )}
                {externalUrl && (
                  <p><strong>Linked URL:</strong> {externalUrl}</p>
                )}
              </div>
              <button
                onClick={onClose}
                className="neo-btn px-6 py-2 bg-[#1A1209] text-white hover:bg-[#332A24] font-bold text-xs"
              >
                Close & View Workspace
              </button>
            </div>
          ) : isFinalized ? (
            /* READ-ONLY FINALIZED SUBMISSION VIEW */
            <div className="space-y-4">
              <div className="p-4 bg-white dark:bg-[#26201B] border-2 border-[#1A1209] shadow-[3px_3px_0px_#1A1209] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 border-[#E0D8C8]">
                  <span className="stamp-badge text-[10px] bg-[#1F5A2E] text-white">
                    {existingSubmission?.status?.toUpperCase()} RECEIPT: {existingSubmission?.submission_code}
                  </span>
                  <span className="text-xs text-[#786958]">
                    Submitted: {existingSubmission?.submission_date}
                  </span>
                </div>

                {existingSubmission?.status === 'graded' && (
                  <div className="p-3 bg-[#1F5A2E]/10 border border-[#1F5A2E] flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#1F5A2E] block">EVALUATION GRADE</span>
                      <span className="text-xl font-black text-[#1A1209] dark:text-white">
                        {existingSubmission?.marks_awarded} / {existingSubmission?.eval_max_marks || 25} Marks
                      </span>
                    </div>
                    {existingSubmission?.feedback && (
                      <p className="text-xs text-[#786958] max-w-sm italic">
                        "{existingSubmission.feedback}"
                      </p>
                    )}
                  </div>
                )}

                {/* Attachments preview */}
                {attachments.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase mb-2">Submitted Attachments:</h4>
                    <div className="space-y-2">
                      {attachments.map((att) => (
                        <div
                          key={att.id}
                          className="p-2.5 bg-[#FAF6EE] dark:bg-[#1D1814] border border-[#1A1209] flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-[#B84915]" />
                            <span className="font-bold">{att.original_filename}</span>
                            <span className="text-[#786958]">({roundSize(att.file_size)})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <a
                              href={api.specialSubmissions.getAttachmentPreviewUrl(att.id)}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2 py-1 bg-white dark:bg-[#26201B] border border-[#1A1209] hover:bg-[#FAF6EE] text-[10px] font-bold flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" /> Preview
                            </a>
                            <button
                              onClick={() => api.specialSubmissions.downloadAttachment(att.id, att.original_filename)}
                              className="px-2 py-1 bg-[#1A1209] text-white hover:bg-[#332A24] text-[10px] font-bold flex items-center gap-1"
                            >
                              <Download className="w-3 h-3" /> Download
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* External link */}
                {externalUrl && (
                  <div className="p-3 bg-[#FAF6EE] dark:bg-[#1D1814] border border-[#1A1209]">
                    <span className="text-[10px] uppercase font-bold text-[#786958] block">Submitted External Project Link:</span>
                    <a
                      href={externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-[#1A365D] dark:text-[#90CDF4] underline flex items-center gap-1 mt-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      {externalTitle || externalUrl}
                    </a>
                    {externalDesc && (
                      <p className="text-xs text-[#786958] mt-1">{externalDesc}</p>
                    )}
                  </div>
                )}

                {/* Editor Content View */}
                {contentHtml && (
                  <div>
                    <h4 className="text-xs font-bold uppercase mb-1">Submitted Manuscript / Write-Up:</h4>
                    <div
                      className="p-3 bg-[#FAF6EE] dark:bg-[#1D1814] border border-[#1A1209] text-xs prose dark:prose-invert max-w-none max-h-60 overflow-y-auto"
                      dangerouslySetInnerHTML={{ __html: contentHtml }}
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ACTIVE SUBMISSION / DRAFT FORM */
            <div className="space-y-4">
              
              {/* REVISION NOTICE IF RETURNED */}
              {existingSubmission?.status === 'returned' && (
                <div className="p-3 bg-[#8B1A1A]/10 border-2 border-[#8B1A1A] space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[#8B1A1A] flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> WORK RETURNED FOR REVISION BY FACULTY
                  </span>
                  <p className="text-xs text-[#1A1209] dark:text-white">
                    Faculty Remarks: "{existingSubmission.faculty_remarks || 'Please address feedback and submit revision.'}"
                  </p>
                </div>
              )}

              {/* METHOD SELECTOR TABS / CARDS (ONLY SHOW ENABLED METHODS) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-[#786958]">
                    Select Submission Method ({allowedMethods.length} Permitted by Faculty):
                  </span>
                  {allowMultiple && (
                    <button
                      type="button"
                      onClick={() => setActiveMethod(activeMethod === 'multi' ? allowedMethods[0] : 'multi')}
                      className={`px-2.5 py-0.5 text-[10px] font-bold border transition-all ${
                        activeMethod === 'multi'
                          ? 'bg-[#1F5A2E] text-white border-[#1F5A2E]'
                          : 'bg-white dark:bg-[#26201B] text-[#1A1209] dark:text-white border-[#1A1209]'
                      }`}
                    >
                      {activeMethod === 'multi' ? '✓ Multiple Methods Mode Active' : '+ Submit Multiple Formats Together'}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {allowedMethods.includes('pdf') && (
                    <button
                      type="button"
                      onClick={() => setActiveMethod('pdf')}
                      className={`p-2.5 border-2 text-left transition-all ${
                        activeMethod === 'pdf'
                          ? 'border-[#1A1209] bg-white dark:bg-[#26201B] shadow-[2px_2px_0px_#B84915]'
                          : 'border-[#E0D8C8] dark:border-[#332A24] bg-[#FAF6EE] dark:bg-[#12100E] opacity-75'
                      }`}
                    >
                      <UploadCloud className="w-4 h-4 text-[#B84915] mb-1" />
                      <span className="text-xs font-bold block text-[#1A1209] dark:text-white">PDF Upload</span>
                      <span className="text-[9px] text-[#786958] block">Max {maxFileSizeMb}MB</span>
                    </button>
                  )}

                  {allowedMethods.includes('docx') && (
                    <button
                      type="button"
                      onClick={() => setActiveMethod('docx')}
                      className={`p-2.5 border-2 text-left transition-all ${
                        activeMethod === 'docx'
                          ? 'border-[#1A1209] bg-white dark:bg-[#26201B] shadow-[2px_2px_0px_#1A365D]'
                          : 'border-[#E0D8C8] dark:border-[#332A24] bg-[#FAF6EE] dark:bg-[#12100E] opacity-75'
                      }`}
                    >
                      <FileText className="w-4 h-4 text-[#1A365D] mb-1" />
                      <span className="text-xs font-bold block text-[#1A1209] dark:text-white">Word Doc</span>
                      <span className="text-[9px] text-[#786958] block">.doc, .docx</span>
                    </button>
                  )}

                  {allowedMethods.includes('other_files') && (
                    <button
                      type="button"
                      onClick={() => setActiveMethod('other_files')}
                      className={`p-2.5 border-2 text-left transition-all ${
                        activeMethod === 'other_files'
                          ? 'border-[#1A1209] bg-white dark:bg-[#26201B] shadow-[2px_2px_0px_#6B46C1]'
                          : 'border-[#E0D8C8] dark:border-[#332A24] bg-[#FAF6EE] dark:bg-[#12100E] opacity-75'
                      }`}
                    >
                      <FileCode className="w-4 h-4 text-[#6B46C1] mb-1" />
                      <span className="text-xs font-bold block text-[#1A1209] dark:text-white">Other Files</span>
                      <span className="text-[9px] text-[#786958] block">.zip, .pptx, etc.</span>
                    </button>
                  )}

                  {allowedMethods.includes('external_link') && (
                    <button
                      type="button"
                      onClick={() => setActiveMethod('external_link')}
                      className={`p-2.5 border-2 text-left transition-all ${
                        activeMethod === 'external_link'
                          ? 'border-[#1A1209] bg-white dark:bg-[#26201B] shadow-[2px_2px_0px_#1F5A2E]'
                          : 'border-[#E0D8C8] dark:border-[#332A24] bg-[#FAF6EE] dark:bg-[#12100E] opacity-75'
                      }`}
                    >
                      <Link2 className="w-4 h-4 text-[#1F5A2E] mb-1" />
                      <span className="text-xs font-bold block text-[#1A1209] dark:text-white">External Link</span>
                      <span className="text-[9px] text-[#786958] block">Drive, GitHub, Figma</span>
                    </button>
                  )}

                  {allowedMethods.includes('editor') && (
                    <button
                      type="button"
                      onClick={() => setActiveMethod('editor')}
                      className={`p-2.5 border-2 text-left transition-all ${
                        activeMethod === 'editor'
                          ? 'border-[#1A1209] bg-white dark:bg-[#26201B] shadow-[2px_2px_0px_#D97706]'
                          : 'border-[#E0D8C8] dark:border-[#332A24] bg-[#FAF6EE] dark:bg-[#12100E] opacity-75'
                      }`}
                    >
                      <Edit3 className="w-4 h-4 text-[#D97706] mb-1" />
                      <span className="text-xs font-bold block text-[#1A1209] dark:text-white">Rich Editor</span>
                      <span className="text-[9px] text-[#786958] block">Write in WriteUp Pro</span>
                    </button>
                  )}
                </div>
              </div>

              {/* TITLE FIELD */}
              <div>
                <label className="block text-[10px] uppercase font-bold mb-1">Submission Title:</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Mini Project Final Dossier & Implementation Analysis"
                  className="w-full p-2 bg-white dark:bg-[#12100E] border border-[#1A1209] text-xs font-bold"
                />
              </div>

              {/* METHOD CHANNEL 1: FILE UPLOADS (PDF, DOCX, OTHER FILES) */}
              {(['pdf', 'docx', 'other_files', 'multi'].includes(activeMethod)) && (
                <div className="p-4 bg-white dark:bg-[#26201B] border-2 border-[#1A1209] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-[#1A1209] dark:text-white flex items-center gap-1.5">
                      <UploadCloud className="w-4 h-4 text-[#B84915]" />
                      Document & File Upload Zone
                    </span>
                    <span className="text-[10px] text-[#786958]">
                      {attachments.length} / {maxFiles} attachments • Max {maxFileSizeMb}MB per file
                    </span>
                  </div>

                  {/* Drag and Drop Zone */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOver(false);
                      handleFileUpload(e.dataTransfer.files);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
                      isDragOver
                        ? 'border-[#B84915] bg-[#FAF6EE] dark:bg-[#12100E]'
                        : 'border-[#1A1209] bg-[#FAF6EE]/50 dark:bg-[#12100E]/50 hover:bg-[#FAF6EE]'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple={maxFiles > 1}
                      onChange={(e) => handleFileUpload(e.target.files)}
                      className="hidden"
                      accept={
                        activeMethod === 'pdf'
                          ? '.pdf,application/pdf'
                          : activeMethod === 'docx'
                          ? '.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                          : allowedExts.map((e) => `.${e.replace('.', '')}`).join(',')
                      }
                    />

                    <UploadCloud className="w-8 h-8 text-[#B84915] mx-auto mb-2" />
                    <p className="text-xs font-bold text-[#1A1209] dark:text-white">
                      Drag and drop your file(s) here, or click to browse
                    </p>
                    <p className="text-[10px] text-[#786958] mt-1">
                      {activeMethod === 'pdf' && 'Accepted format: .PDF (Strict MIME validated)'}
                      {activeMethod === 'docx' && 'Accepted formats: Microsoft Word (.DOC, .DOCX) — Original preserved'}
                      {activeMethod === 'other_files' && `Allowed formats: ${allowedExts.join(', ')}`}
                      {activeMethod === 'multi' && 'Upload manuscripts, report sheets, or archives.'}
                    </p>
                  </div>

                  {/* Uploading progress indicator */}
                  {uploading && (
                    <div className="p-2 bg-[#FAF6EE] border border-[#1A1209] text-xs font-bold flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#B84915]" />
                      Uploading and verifying file integrity...
                    </div>
                  )}

                  {/* Uploaded File List */}
                  {attachments.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] uppercase font-bold text-[#786958]">Uploaded File Attachments:</span>
                      {attachments.map((att) => (
                        <div
                          key={att.id}
                          className="p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209] flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="w-3.5 h-3.5 text-[#B84915]" />
                            <span className="font-bold text-[#1A1209] dark:text-white">{att.original_filename}</span>
                            <span className="text-[10px] text-[#786958]">({roundSize(att.file_size)})</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => api.specialSubmissions.downloadAttachment(att.id, att.original_filename)}
                              className="p-1 hover:bg-white dark:hover:bg-[#26201B] border border-transparent hover:border-[#1A1209]"
                              title="Download to verify"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAttachment(att.id)}
                              className="p-1 hover:bg-[#8B1A1A] hover:text-white border border-transparent hover:border-[#1A1209]"
                              title="Remove file"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-[#8B1A1A] hover:text-white" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* METHOD CHANNEL 2: EXTERNAL LINK FORM */}
              {(['external_link', 'multi'].includes(activeMethod)) && (
                <div className="p-4 bg-white dark:bg-[#26201B] border-2 border-[#1A1209] space-y-3">
                  <span className="text-xs font-black uppercase text-[#1F5A2E] flex items-center gap-1.5">
                    <Link2 className="w-4 h-4" />
                    External Document / Repository Link
                  </span>

                  <div>
                    <label className="block text-[10px] uppercase font-bold mb-1">Target Project / Document URL:</label>
                    <input
                      type="url"
                      value={externalUrl}
                      onChange={(e) => setExternalUrl(e.target.value)}
                      placeholder="https://drive.google.com/... or https://github.com/..."
                      className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209] text-xs font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] uppercase font-bold mb-1">Link Title / Platform:</label>
                      <input
                        type="text"
                        value={externalTitle}
                        onChange={(e) => setExternalTitle(e.target.value)}
                        placeholder="e.g. GitHub Repository, Google Drive Dossier"
                        className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209] text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold mb-1">Description / Branch / Notes:</label>
                      <input
                        type="text"
                        value={externalDesc}
                        onChange={(e) => setExternalDesc(e.target.value)}
                        placeholder="e.g. Branch main, see demo video in docs"
                        className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209] text-xs"
                      />
                    </div>
                  </div>

                  {/* Permissions Reminder (Requirement D) */}
                  <div className="p-2.5 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1F5A2E] flex items-start gap-2 text-[10px]">
                    <ShieldCheck className="w-4 h-4 text-[#1F5A2E] shrink-0 mt-0.5" />
                    <div className="space-y-0.5 text-[#1A1209] dark:text-[#E0D8C8]">
                      <span className="font-bold block text-[#1F5A2E]">Access Permission Requirement Reminder:</span>
                      <p>
                        Please verify that faculty has access permission for this external link. For Google Docs/Drive, set link access to "Anyone with link (Viewer)" or share directly with your faculty email.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* METHOD CHANNEL 3: WRITEUP PRO RICH EDITOR */}
              {(['editor', 'multi'].includes(activeMethod)) && (
                <div className="p-4 bg-white dark:bg-[#26201B] border-2 border-[#1A1209] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-[#D97706] flex items-center gap-1.5">
                      <Edit3 className="w-4 h-4" />
                      Write Directly in WriteUp Pro Authoring Workspace
                    </span>
                    <span className="text-[10px] font-mono text-[#786958]">
                      {wordCount} words • {charCount} chars
                    </span>
                  </div>

                  {/* Formatting Toolbar */}
                  <div className="flex flex-wrap gap-1 p-1 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209] text-xs">
                    <button
                      type="button"
                      onClick={() => insertFormatting('<h3>', '</h3>')}
                      className="px-2 py-1 bg-white dark:bg-[#1D1814] border border-[#E0D8C8] font-bold text-[10px]"
                    >
                      H3 Heading
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormatting('<strong>', '</strong>')}
                      className="px-2 py-1 bg-white dark:bg-[#1D1814] border border-[#E0D8C8] font-bold text-[10px]"
                    >
                      B
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormatting('<em>', '</em>')}
                      className="px-2 py-1 bg-white dark:bg-[#1D1814] border border-[#E0D8C8] italic text-[10px]"
                    >
                      I
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormatting('<ul><li>', '</li></ul>')}
                      className="px-2 py-1 bg-white dark:bg-[#1D1814] border border-[#E0D8C8] text-[10px]"
                    >
                      List
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormatting('<table border="1"><tr><th>Header</th></tr><tr><td>Data</td></tr></table>')}
                      className="px-2 py-1 bg-white dark:bg-[#1D1814] border border-[#E0D8C8] text-[10px]"
                    >
                      Table
                    </button>
                  </div>

                  <textarea
                    rows={8}
                    value={contentHtml}
                    onChange={(e) => setContentHtml(e.target.value)}
                    placeholder="Type or format your special document write-up directly here..."
                    className="w-full p-3 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209] text-xs font-serif leading-relaxed"
                  />
                </div>
              )}

              {/* SUBMISSION PREVIEW ACCORDION (REQUIREMENT 4) */}
              <div className="border border-[#1A1209]">
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className="w-full p-2.5 bg-[#FAF6EE] dark:bg-[#26201B] flex items-center justify-between text-xs font-bold text-[#1A1209] dark:text-white"
                >
                  <span className="flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-[#1A365D]" />
                    {showPreview ? 'Hide Submission Preview' : 'Preview Submission Before Finalizing'}
                  </span>
                  <span className="text-[10px] text-[#786958]">{showPreview ? '▲ Collapse' : '▼ Expand'}</span>
                </button>

                {showPreview && (
                  <div className="p-4 bg-white dark:bg-[#1D1814] border-t border-[#1A1209] space-y-2 text-xs">
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <p><strong>Title:</strong> {title || '(Not set)'}</p>
                      <p><strong>Subject:</strong> {task.subject_name}</p>
                      <p><strong>Selected Method:</strong> {activeMethod.toUpperCase()}</p>
                      <p><strong>Deadline:</strong> {task.due_date}</p>
                    </div>

                    {attachments.length > 0 && (
                      <div className="pt-2">
                        <span className="font-bold text-[10px] block">Attached Files:</span>
                        <ul className="list-disc pl-4 text-[11px] text-[#786958]">
                          {attachments.map((a) => (
                            <li key={a.id}>{a.original_filename} ({roundSize(a.file_size)})</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {externalUrl && (
                      <div className="pt-1">
                        <span className="font-bold text-[10px] block">External URL:</span>
                        <a href={externalUrl} target="_blank" rel="noreferrer" className="text-[#1A365D] underline">
                          {externalUrl}
                        </a>
                      </div>
                    )}

                    {contentHtml && (
                      <div className="pt-2">
                        <span className="font-bold text-[10px] block">Editor Manuscript Preview:</span>
                        <div
                          className="p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#E0D8C8] text-[11px] max-h-32 overflow-y-auto"
                          dangerouslySetInnerHTML={{ __html: contentHtml }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        {!submissionReceipt && !isFinalized && (
          <div className="p-4 border-t-2 border-[#1A1209] bg-white dark:bg-[#26201B] flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="text-[10px] text-[#786958]">
              {isPastDeadline ? (
                <span className="text-[#8B1A1A] font-bold">
                  Late submission policy: {task.late_submission_policy || 'allow'}
                </span>
              ) : (
                <span>On-time submission window open.</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={savingDraft || submitting}
                className="px-4 py-2 bg-[#FAF6EE] dark:bg-[#1D1814] text-[#1A1209] dark:text-white border-2 border-[#1A1209] hover:bg-white font-bold text-xs flex items-center gap-1.5 transition-all"
              >
                {savingDraft ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save as Draft
              </button>

              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={submitting || savingDraft}
                className="neo-btn px-6 py-2 bg-[#B84915] text-white hover:bg-[#963A0F] font-bold text-xs flex items-center gap-1.5"
              >
                {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Final Submit
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  function insertFormatting(startTag: string, endTag: string = '') {
    setContentHtml((prev) => `${prev}\n${startTag}New Content${endTag}`);
  }

  function roundSize(bytes: number) {
    if (!bytes) return '0 KB';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
};
