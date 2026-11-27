import React, { useState, useEffect } from 'react';
import {
  Folder, FileCheck, CheckCircle2, RotateCcw, Download, Eye,
  Search, Filter, AlertTriangle, ArrowLeft, ShieldCheck, Check, Clock,
  Plus, BookOpen, Layers, BarChart3, Award, Users, AlertCircle,
  Settings2, UploadCloud, FileText, Link2, Edit3, ExternalLink
} from 'lucide-react';
import { api } from '../lib/api';
import { Submission, User, Task, CustomRubric, LabBatch, FacultyTeachingFolders } from '../types';
import { FacultyClassWorkspace } from './FacultyClassWorkspace';
import { CalendarView } from './CalendarView';

interface FacultyWorkspaceProps {
  currentUser: User;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  activeTab?: string;
  setActiveTab?: (tab: any) => void;
}

export const FacultyWorkspace: React.FC<FacultyWorkspaceProps> = ({
  currentUser,
  showToast,
  activeTab: propActiveTab,
  setActiveTab: propSetActiveTab,
}) => {
  const [internalTab, setInternalTab] = useState<'my_classes' | 'inbox' | 'create_task' | 'rubrics' | 'analytics' | 'calendar' | 'reevaluations'>('my_classes');

  const activeTab = (propActiveTab as any) || internalTab;
  const setActiveTab = (tab: any) => {
    setInternalTab(tab);
    if (propSetActiveTab) {
      propSetActiveTab(tab);
    }
  };
  const [reevaluations, setReevaluations] = useState<any[]>([]);
  const [reviewReevalId, setReviewReevalId] = useState<string | null>(null);
  const [reevalNewMarks, setReevalNewMarks] = useState<number>(0);
  const [reevalRemarks, setReevalRemarks] = useState<string>('');
  const [teachingFolders, setTeachingFolders] = useState<FacultyTeachingFolders | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [activeSubmission, setActiveSubmission] = useState<Submission | null>(null);
  const [similarity, setSimilarity] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [openingSubId, setOpeningSubId] = useState<string | null>(null);

  // Faculty Workload & Classroom Meta
  const [facultyStats, setFacultyStats] = useState<any>(null);
  const [myBatches, setMyBatches] = useState<LabBatch[]>([]);
  const [customRubrics, setCustomRubrics] = useState<CustomRubric[]>([]);
  const [allSubjects, setAllSubjects] = useState<any[]>([]);

  // Rubric Scores State (Supports both standard criteria and dynamic custom rubrics)
  const [standardScores, setStandardScores] = useState<{ knowledge: number; content: number; punctuality: number; performance: number }>({
    knowledge: 3,
    content: 2,
    punctuality: 2,
    performance: 3,
  });
  const [dynamicRubricScores, setDynamicRubricScores] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState('');
  const [remarks, setRemarks] = useState('Approved and verified');
  const [privateNotes, setPrivateNotes] = useState('');

  const roundFileSize = (bytes: number) => {
    if (!bytes) return '0 KB';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Assessment Creation State (3 Decoupled Workflows)
  const [assessmentWorkflow, setAssessmentWorkflow] = useState<'assignment' | 'experiment' | 'special'>('assignment');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskType, setTaskType] = useState<'Assignment' | 'Experiment'>('Assignment');
  const [taskCategory, setTaskCategory] = useState<'standard' | 'special'>('standard');
  const [specialCategory, setSpecialCategory] = useState('Mini Project Report');
  const [targetType, setTargetType] = useState<'division' | 'batch'>('division');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [taskSubjectId, setTaskSubjectId] = useState('');
  const [taskNumber, setTaskNumber] = useState('1');
  const [taskMaxMarks, setTaskMaxMarks] = useState(10);
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskInstructions, setTaskInstructions] = useState('');
  const [latePolicy, setLatePolicy] = useState<'allow' | 'penalty' | 'reject'>('penalty');
  const [latePenaltyPct, setLatePenaltyPct] = useState(10);
  const [selectedRubricId, setSelectedRubricId] = useState('');

  // Special Submission Method Configuration State
  const [methodPdf, setMethodPdf] = useState(true);
  const [methodDocx, setMethodDocx] = useState(true);
  const [methodOtherFiles, setMethodOtherFiles] = useState(false);
  const [methodExternalLink, setMethodExternalLink] = useState(true);
  const [methodEditor, setMethodEditor] = useState(true);
  const [allowMultipleMethods, setAllowMultipleMethods] = useState(false);
  const [maxFileSizeMb, setMaxFileSizeMb] = useState(15);
  const [maxFilesCount, setMaxFilesCount] = useState(3);
  const [allowedExtensions, setAllowedExtensions] = useState<string[]>(['pdf', 'docx', 'doc', 'zip', 'pptx', 'xlsx', 'png', 'jpg', 'txt']);
  const [requirePdfConversion, setRequirePdfConversion] = useState(false);
  const [allowResubmission, setAllowResubmission] = useState(true);
  const [allowEditBeforeDeadline, setAllowEditBeforeDeadline] = useState(true);

  // Experiment-specific fields
  const [exptNumber, setExptNumber] = useState('EXPT-01');
  const [exptObjective, setExptObjective] = useState('');
  const [exptReqs, setExptReqs] = useState('');
  const [exptProcedure, setExptProcedure] = useState('');
  const [exptOutput, setExptOutput] = useState('');

  // Custom Rubric Builder Form State
  const [newRubricTitle, setNewRubricTitle] = useState('');
  const [newRubricDocCat, setNewRubricDocCat] = useState('Mini Project');
  const [rubricCriteria, setRubricCriteria] = useState<Array<{ id: string; name: string; max_score: number; guidance?: string }>>([
    { id: 'c1', name: 'Problem Definition & Formulation', max_score: 10, guidance: 'Clear definition of problem and scope' },
    { id: 'c2', name: 'Design & Architecture', max_score: 15, guidance: 'System diagrams and architectural design' },
    { id: 'c3', name: 'Implementation & Prototype', max_score: 15, guidance: 'Working code and functional modules' },
    { id: 'c4', name: 'Viva Voce & Documentation', max_score: 10, guidance: 'Defense and quality of write-up' },
  ]);

  useEffect(() => {
    loadFacultyData();
  }, [statusFilter, batchFilter, subjectFilter]);

  const loadFacultyData = async () => {
    try {
      setLoading(true);
      const [subsData, statsData, batchesData, rubricsData, subjectsData, teachingFoldersData] = await Promise.all([
        api.submissions.listSubmissions({
          status_filter: statusFilter || undefined,
          batch_id: batchFilter || undefined,
          subject: subjectFilter || undefined,
        }),
        api.analytics.getFacultyAnalytics().catch(() => null),
        api.academic.listLabBatches().catch(() => []),
        api.tasks.listCustomRubrics().catch(() => []),
        api.academic.listSubjects({ academic_year: '2026-27' }).catch(() => []),
        api.academic.getFacultyTeachingFolders().catch(() => null),
      ]);

      setSubmissions(subsData || []);
      setFacultyStats(statsData);
      setMyBatches(batchesData || []);
      setCustomRubrics(rubricsData || []);
      setAllSubjects(subjectsData || []);
      if (teachingFoldersData) {
        setTeachingFolders(teachingFoldersData);
      }

      if (subjectsData?.length && !taskSubjectId) {
        setTaskSubjectId(subjectsData[0].id);
      }
      if (batchesData?.length && !selectedBatchId) {
        setSelectedBatchId(batchesData[0].id);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load faculty records', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openEvaluation = async (sub: Submission) => {
    try {
      setOpeningSubId(sub.submission_id);
      const [fullSub, simResult] = await Promise.all([
        api.submissions.getSubmission(sub.submission_id),
        api.evaluations.getSimilarity(sub.submission_id).catch(() => null),
      ]);
      setActiveSubmission(fullSub);
      setSimilarity(simResult);

      if (fullSub.status === 'graded') {
        const scores = fullSub.rubric_scores || (fullSub.rubric_scores_json ? JSON.parse(fullSub.rubric_scores_json) : {});
        if (fullSub.custom_rubric) {
          setDynamicRubricScores(scores);
        } else {
          setStandardScores({
            knowledge: scores.knowledge || 0,
            content: scores.content || 0,
            punctuality: scores.punctuality || 0,
            performance: scores.performance || 0,
          });
        }
        setFeedback(fullSub.feedback || '');
        setRemarks(fullSub.faculty_remarks || '');
        setPrivateNotes(fullSub.faculty_private_notes || '');
      } else {
        // Reset defaults
        if (fullSub.custom_rubric?.criteria) {
          const initScores: Record<string, number> = {};
          fullSub.custom_rubric.criteria.forEach((c: any) => {
            initScores[c.id || c.name] = Math.round(c.max_score * 0.8);
          });
          setDynamicRubricScores(initScores);
        } else {
          setStandardScores({ knowledge: 3, content: 2, punctuality: 2, performance: 3 });
        }
        setFeedback('');
        setRemarks('Approved and verified');
        setPrivateNotes(fullSub.faculty_private_notes || '');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load submission details', 'error');
    } finally {
      setOpeningSubId(null);
    }
  };

  // Evaluation calculations
  const hasCustomRubric = Boolean(activeSubmission?.custom_rubric?.criteria?.length);
  const isAssignment = activeSubmission?.doc_type === 'Assignment';

  const maxAllowed = hasCustomRubric
    ? activeSubmission!.custom_rubric!.total_marks ||
      activeSubmission!.custom_rubric!.criteria.reduce((sum: number, c: any) => sum + Number(c.max_score), 0)
    : isAssignment
    ? 10
    : 15;

  const currentTotal = hasCustomRubric
    ? Object.values(dynamicRubricScores).reduce((sum, v) => sum + (Number(v) || 0), 0)
    : isAssignment
    ? standardScores.knowledge + standardScores.content + standardScores.punctuality
    : standardScores.knowledge + standardScores.content + standardScores.punctuality + standardScores.performance;

  const isScoreInvalid =
    currentTotal > maxAllowed ||
    (!hasCustomRubric &&
      (standardScores.knowledge > 4 ||
        standardScores.content > 3 ||
        standardScores.punctuality > 3 ||
        (!isAssignment && standardScores.performance > 5)));

  const handleApprove = async () => {
    if (!activeSubmission) return;
    if (isScoreInvalid) {
      showToast(`Total score exceeds maximum allowed limit (${maxAllowed}). Please verify rubric entries.`, 'error');
      return;
    }

    const subId = activeSubmission.submission_id || (activeSubmission as any).id;
    try {
      const rubricScoresPayload = hasCustomRubric
        ? dynamicRubricScores
        : isAssignment
        ? { knowledge: standardScores.knowledge, content: standardScores.content, punctuality: standardScores.punctuality }
        : standardScores;

      const res = await api.evaluations.submitEvaluation({
        submission_id: subId,
        marks_awarded: currentTotal,
        rubric_scores: rubricScoresPayload,
        feedback,
        remarks,
        faculty_private_notes: privateNotes || '',
      });

      showToast(`Approved! Digital Signature Stamp: ${res.digital_signature_code}`, 'success');
      loadFacultyData();
      setActiveSubmission({
        ...activeSubmission,
        status: 'graded',
        marks_awarded: currentTotal,
        digital_signature_code: res.digital_signature_code,
      });
    } catch (err: any) {
      showToast(err.message || 'Failed to finalize evaluation', 'error');
    }
  };

  const handleReturn = async () => {
    if (!activeSubmission) return;
    const subId = activeSubmission.submission_id || (activeSubmission as any).id;
    const reason = prompt('Enter correction remarks for reverting this submission to draft:', 'Please expand practical analysis and add algorithmic traces.');
    if (!reason) return;

    try {
      await api.evaluations.returnSubmission(subId, reason);
      showToast('Document returned to student for corrections.', 'info');
      loadFacultyData();
      setActiveSubmission(null);
    } catch (err: any) {
      showToast(err.message || 'Failed to return submission', 'error');
    }
  };

  const handleCreateTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) {
      showToast('Task title is required.', 'error');
      return;
    }

    try {
      let finalTaskType = 'Assignment';
      let finalCategory = 'standard';
      let finalMaxMarks = 10;
      let finalTaskNumber = taskNumber || '1';
      let customRubricIdToUse: string | undefined = undefined;

      let specialMethods: Array<'editor' | 'pdf' | 'docx' | 'other_files' | 'external_link'> = [];

      if (assessmentWorkflow === 'special') {
        finalTaskType = 'Special Document';
        finalCategory = 'special_document';
        finalTaskNumber = '1';
        customRubricIdToUse = selectedRubricId || undefined;
        const selRubric = customRubrics.find((r) => r.id === selectedRubricId);
        if (selRubric) {
          finalMaxMarks = selRubric.total_marks || selRubric.criteria.reduce((s: number, c: any) => s + Number(c.max_score || c.max_marks || 0), 0);
        } else {
          finalMaxMarks = 25;
        }

        if (methodEditor) specialMethods.push('editor');
        if (methodPdf) specialMethods.push('pdf');
        if (methodDocx) specialMethods.push('docx');
        if (methodOtherFiles) specialMethods.push('other_files');
        if (methodExternalLink) specialMethods.push('external_link');

        if (specialMethods.length === 0) {
          showToast('Please enable at least one submission method.', 'error');
          return;
        }
      } else if (assessmentWorkflow === 'experiment') {
        finalTaskType = 'Experiment';
        finalCategory = 'experiment';
        finalTaskNumber = exptNumber || taskNumber || '1';
        finalMaxMarks = 15;
      } else {
        finalTaskType = 'Assignment';
        finalCategory = 'standard';
        finalTaskNumber = taskNumber || '1';
        finalMaxMarks = 10;
      }

      const payload: any = {
        title: taskTitle.trim(),
        subject_id: taskSubjectId,
        task_type: finalTaskType,
        task_number: finalTaskNumber,
        max_marks: finalMaxMarks,
        due_date: taskDueDate || new Date(Date.now() + 86400000 * 3).toISOString().substring(0, 16),
        instructions: taskInstructions,
        target_type: assessmentWorkflow === 'experiment' ? targetType : 'division',
        category: finalCategory,
        document_category: assessmentWorkflow === 'special' ? specialCategory : undefined,
        late_submission_policy: latePolicy,
        late_penalty_percent: Number(latePenaltyPct),
        custom_rubric_id: customRubricIdToUse,
        academic_year: '2026-27',
        branch_code: 'CE',
        year_level: 'SE',
        semester_number: 3,
        division_name: 'Div A',
      };

      if (assessmentWorkflow === 'special') {
        payload.allowed_methods = specialMethods;
        payload.allow_multiple_methods = allowMultipleMethods;
        payload.max_file_size_mb = Number(maxFileSizeMb);
        payload.max_files_count = Number(maxFilesCount);
        payload.allowed_extensions = allowedExtensions;
        payload.require_pdf_conversion = requirePdfConversion;
        payload.allow_resubmission = allowResubmission;
        payload.allow_edit_before_deadline = allowEditBeforeDeadline;
      }

      if (assessmentWorkflow === 'experiment' && targetType === 'batch') {
        payload.batch_id = selectedBatchId;
      }

      if (assessmentWorkflow === 'experiment') {
        payload.experiment_number = exptNumber;
        payload.objective = exptObjective;
        payload.hardware_software_req = exptReqs;
        payload.procedure = exptProcedure;
        payload.expected_output = exptOutput;
      }

      await api.tasks.createTask(payload);
      showToast(`${finalTaskType} '${taskTitle}' published successfully.`, 'success');
      setTaskTitle('');
      setTaskInstructions('');
      setActiveTab('inbox');
      loadFacultyData();
    } catch (err: any) {
      showToast(err.message || 'Failed to publish task', 'error');
    }
  };

  const handleCreateCustomRubricSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRubricTitle.trim()) {
      showToast('Rubric Title is required.', 'error');
      return;
    }
    const totalMax = rubricCriteria.reduce((sum, c) => sum + Number(c.max_score), 0);
    if (totalMax <= 0) {
      showToast('Total marks for rubric must be greater than zero.', 'error');
      return;
    }

    try {
      await api.tasks.createCustomRubric({
        title: newRubricTitle.trim(),
        document_category: newRubricDocCat,
        criteria: rubricCriteria,
      });
      showToast(`Custom Rubric '${newRubricTitle}' created (${totalMax} Total Marks).`, 'success');
      setNewRubricTitle('');
      loadFacultyData();
    } catch (err: any) {
      showToast(err.message || 'Failed to create custom rubric', 'error');
    }
  };

  // Filtered submissions
  const filteredSubmissions = submissions.filter((s) => {
    const matchSearch =
      !search ||
      s.student_name.toLowerCase().includes(search.toLowerCase()) ||
      s.subject_name.toLowerCase().includes(search.toLowerCase()) ||
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.roll_number.toLowerCase().includes(search.toLowerCase());
    const matchType =
      !typeFilter ||
      (typeFilter === 'Assignment' && (s.doc_type === 'Assignment' || s.task_category === 'standard')) ||
      (typeFilter === 'Experiment' && (s.doc_type === 'Experiment' || s.task_category === 'experiment')) ||
      (typeFilter === 'Special Document' && (s.doc_type === 'Special Document' || s.task_category === 'special_document'));
    return matchSearch && matchType;
  });

  // ----------------------------------------------------
  // SPLIT SCREEN EVALUATION VIEW
  // ----------------------------------------------------
  if (activeSubmission) {
    return (
      <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden bg-[#FBF9F3] dark:bg-[#14110E]">
        {/* Top Evaluation Action Bar */}
        <div className="bg-white dark:bg-[#1D1814] border-b-2 border-[#1A1209] px-6 py-2.5 flex items-center justify-between shadow-xs z-20 font-mono">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveSubmission(null)}
              className="neo-btn px-3 py-1.5 bg-[#F4EFE6] dark:bg-[#26201B] text-[#1A1209] dark:text-[#F7F3E9] text-xs flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" /> &larr; BACK TO INBOX
            </button>
            <div className="h-5 w-0.5 bg-[#1A1209]" />
            <div>
              <h2 className="text-sm font-extrabold text-[#1A1209] dark:text-white tracking-tight">
                {activeSubmission.title}
              </h2>
              <p className="text-xs text-[#786958] dark:text-[#A89886]">
                Author: <span className="font-bold text-[#1A1209] dark:text-white">{activeSubmission.student_name}</span> • Roll:{' '}
                <span className="font-bold text-[#B84915]">{activeSubmission.roll_number}</span> • Code:{' '}
                <span className="font-bold">{activeSubmission.submission_code}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {activeSubmission.is_late === 1 && (
              <span className="px-2.5 py-1 bg-[#FFF5F5] border border-[#8B1A1A] text-[#8B1A1A] text-xs font-bold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> {activeSubmission.delay_text} (-{activeSubmission.late_penalty_applied}%)
              </span>
            )}

            <button
              onClick={async () => {
                try {
                  showToast('Preparing authenticated PDF copy...', 'info');
                  await api.exports.downloadPdf(activeSubmission.document_id, activeSubmission.title);
                  showToast('PDF downloaded successfully.', 'success');
                } catch (err: any) {
                  showToast(err.message || 'Failed to download PDF', 'error');
                }
              }}
              className="neo-btn px-3.5 py-1.5 bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-[#F7F3E9] text-xs flex items-center gap-1.5"
            >
              <Download className="w-4 h-4 text-[#B84915]" /> PDF Copy
            </button>

            {activeSubmission.status !== 'graded' && (
              <button
                onClick={handleReturn}
                className="neo-btn px-3.5 py-1.5 bg-[#FFF5F5] dark:bg-[#2A1515] text-[#8B1A1A] border-[#8B1A1A] text-xs flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" /> Return for Corrections
              </button>
            )}
          </div>
        </div>

        {/* Split Screen Workspace */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel: Read-Only Student Document Preview */}
          <div className="flex-1 overflow-y-auto p-8 bg-[#ECE4D4] dark:bg-[#12100E] flex justify-center items-start">
            <div className="w-[210mm] min-h-[297mm] bg-white text-[#1A1209] p-[20mm] border-2 border-[#1A1209] shadow-[6px_6px_0px_#1A1209] font-sans">
              {/* Cover Page */}
              <div className="border-b-2 border-[#1A1209] pb-4 mb-6 text-center font-mono">
                <span className="text-[9px] uppercase tracking-widest text-[#B84915] font-bold block mb-1">
                  OFFICIAL INSTITUTIONAL SUBMISSION RECORD // DISPATCH NO. {activeSubmission.submission_code}
                </span>
                <h1 className="text-lg font-extrabold uppercase tracking-tight text-[#1A1209]">
                  Imperial Institute of Engineering & Technology
                </h1>
                <p className="text-xs text-[#5C4D3C] uppercase tracking-widest mt-1">
                  Department of Computer Engineering • Academic Year 2026-27
                </p>
              </div>

              <table className="w-full text-xs border-collapse border-2 border-[#1A1209] mb-6 font-mono">
                <tbody>
                  <tr className="bg-[#FAF6EE]">
                    <td className="border-2 border-[#1A1209] p-2 font-bold w-1/3">Class & Division</td>
                    <td className="border-2 border-[#1A1209] p-2">{`${activeSubmission.year_level} - ${activeSubmission.division_name}`}</td>
                    <td className="border-2 border-[#1A1209] p-2 font-bold w-1/3">Subject Code</td>
                    <td className="border-2 border-[#1A1209] p-2">{activeSubmission.subject_code}</td>
                  </tr>
                  <tr>
                    <td className="border-2 border-[#1A1209] p-2 font-bold">Subject Name</td>
                    <td className="border-2 border-[#1A1209] p-2 font-sans font-bold" colSpan={3}>
                      {activeSubmission.subject_name}
                    </td>
                  </tr>
                  <tr className="bg-[#FAF6EE]">
                    <td className="border-2 border-[#1A1209] p-2 font-bold">{activeSubmission.doc_type} No.</td>
                    <td className="border-2 border-[#1A1209] p-2">{activeSubmission.doc_number}</td>
                    <td className="border-2 border-[#1A1209] p-2 font-bold">Roll Number</td>
                    <td className="border-2 border-[#1A1209] p-2 font-bold">{activeSubmission.roll_number}</td>
                  </tr>
                  <tr>
                    <td className="border-2 border-[#1A1209] p-2 font-bold">Submission Date</td>
                    <td className="border-2 border-[#1A1209] p-2">{activeSubmission.submission_date}</td>
                    <td className="border-2 border-[#1A1209] p-2 font-bold">Status</td>
                    <td className="border-2 border-[#1A1209] p-2 font-bold uppercase">
                      <span className="stamp-badge py-0 bg-white text-[#1A1209]">{activeSubmission.status}</span>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Multi-Format Submissions: Files & External Links */}
              {activeSubmission.attachments && activeSubmission.attachments.length > 0 && (
                <div className="mb-6 p-4 bg-[#FAF6EE] border-2 border-[#1A1209] space-y-3 font-mono">
                  <span className="text-[10px] uppercase font-bold text-[#B84915] block">
                    SUBMITTED MANUSCRIPT ATTACHMENTS ({activeSubmission.attachments.length} FILES):
                  </span>
                  <div className="space-y-2">
                    {activeSubmission.attachments.map((att: any) => {
                      const isPdf = att.original_filename.toLowerCase().endsWith('.pdf');
                      const previewUrl = api.specialSubmissions.getAttachmentPreviewUrl(att.id);
                      return (
                        <div key={att.id} className="p-3 bg-white border border-[#1A1209] space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-[#B84915]" />
                              <span className="font-bold text-xs">{att.original_filename}</span>
                              <span className="text-[10px] text-[#786958]">
                                ({roundFileSize(att.file_size)})
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <a
                                href={previewUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1 bg-[#FAF6EE] hover:bg-[#E0D8C8] text-[#1A1209] text-[10px] font-bold border border-[#1A1209] flex items-center gap-1"
                              >
                                <Eye className="w-3 h-3" /> Preview
                              </a>
                              <button
                                type="button"
                                onClick={() => api.specialSubmissions.downloadAttachment(att.id, att.original_filename)}
                                className="px-2.5 py-1 bg-[#1A1209] text-white hover:bg-[#332A24] text-[10px] font-bold border border-[#1A1209] flex items-center gap-1"
                              >
                                <Download className="w-3 h-3" /> Download Original
                              </button>
                            </div>
                          </div>
                          {isPdf && (
                            <div className="mt-2 border border-[#E0D8C8] overflow-hidden">
                              <iframe
                                src={previewUrl}
                                title={att.original_filename}
                                className="w-full h-80 bg-gray-100"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* External Project Link */}
              {activeSubmission.external_link_url && (
                <div className="mb-6 p-4 bg-[#FAF6EE] border-2 border-[#1A1209] space-y-2 font-mono">
                  <span className="text-[10px] uppercase font-bold text-[#1F5A2E] block">
                    SUBMITTED EXTERNAL PROJECT REPOSITORY / DOSSIER LINK:
                  </span>
                  <div className="p-3 bg-white border border-[#1A1209] space-y-1">
                    <a
                      href={activeSubmission.external_link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-[#1A365D] underline flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {activeSubmission.external_link_title || activeSubmission.external_link_url}
                    </a>
                    {activeSubmission.external_link_description && (
                      <p className="text-xs text-[#5C4D3C] mt-1">{activeSubmission.external_link_description}</p>
                    )}
                  </div>
                  <div className="p-2 bg-[#FFFDF7] border border-[#E0D8C8] text-[10px] text-[#786958] flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#1F5A2E] shrink-0" />
                    <span>
                      Notice: If this repository is private, ensure your faculty institutional ID has been granted view/read permissions by the student.
                    </span>
                  </div>
                </div>
              )}

              {/* Document HTML Body */}
              <div
                className="prose prose-sm max-w-none text-justify border-t-2 border-[#1A1209] pt-6"
                dangerouslySetInnerHTML={{ __html: activeSubmission.snapshot_html || '<p>No write-up text captured.</p>' }}
              />
            </div>
          </div>

          {/* Right Panel: Grading & Digital Stamp Panel */}
          <div className="w-96 border-l-2 border-[#1A1209] bg-white dark:bg-[#1D1814] flex flex-col justify-between overflow-y-auto p-5 font-mono text-xs space-y-4">
            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#B84915] block">
                  DIGITAL EVALUATION MATRIX
                </span>
                <h3 className="text-base font-black text-[#1A1209] dark:text-white uppercase mt-0.5">
                  Criterion Scoring & Validation
                </h3>
              </div>

              {/* Dynamic Rubric Scoring Input */}
              {hasCustomRubric ? (
                <div className="space-y-3 p-3 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]">
                  <span className="text-[10px] uppercase font-bold text-[#1A365D] block">
                    Custom Rubric: {activeSubmission.custom_rubric!.title}
                  </span>
                  {activeSubmission.custom_rubric!.criteria.map((c: any) => {
                    const cKey = c.id || c.name;
                    return (
                      <div key={cKey}>
                        <div className="flex justify-between text-[11px] font-bold mb-1">
                          <span>{c.name}</span>
                          <span className="text-[#786958]">Max: {c.max_score}</span>
                        </div>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max={c.max_score}
                          value={dynamicRubricScores[cKey] ?? 0}
                          onChange={(e) =>
                            setDynamicRubricScores({
                              ...dynamicRubricScores,
                              [cKey]: Math.min(Number(c.max_score), Math.max(0, parseFloat(e.target.value) || 0)),
                            })
                          }
                          className="w-full p-2 bg-white dark:bg-[#1D1814] border border-[#1A1209]"
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-3 p-3 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]">
                  <div>
                    <div className="flex justify-between text-[11px] font-bold mb-1">
                      <span>1. Knowledge & Theory</span>
                      <span className="text-[#786958]">Max: 4.0</span>
                    </div>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="4.0"
                      value={standardScores.knowledge}
                      onChange={(e) =>
                        setStandardScores({
                          ...standardScores,
                          knowledge: Math.min(4.0, Math.max(0, parseFloat(e.target.value) || 0)),
                        })
                      }
                      className="w-full p-2 bg-white dark:bg-[#1D1814] border border-[#1A1209]"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] font-bold mb-1">
                      <span>2. Content Structure & Neatness</span>
                      <span className="text-[#786958]">Max: 3.0</span>
                    </div>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="3.0"
                      value={standardScores.content}
                      onChange={(e) =>
                        setStandardScores({
                          ...standardScores,
                          content: Math.min(3.0, Math.max(0, parseFloat(e.target.value) || 0)),
                        })
                      }
                      className="w-full p-2 bg-white dark:bg-[#1D1814] border border-[#1A1209]"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] font-bold mb-1">
                      <span>3. Academic Punctuality</span>
                      <span className="text-[#786958]">Max: 3.0</span>
                    </div>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="3.0"
                      value={standardScores.punctuality}
                      onChange={(e) =>
                        setStandardScores({
                          ...standardScores,
                          punctuality: Math.min(3.0, Math.max(0, parseFloat(e.target.value) || 0)),
                        })
                      }
                      className="w-full p-2 bg-white dark:bg-[#1D1814] border border-[#1A1209]"
                    />
                  </div>

                  {!isAssignment && (
                    <div>
                      <div className="flex justify-between text-[11px] font-bold mb-1">
                        <span>4. Practical Execution & Performance</span>
                        <span className="text-[#786958]">Max: 5.0</span>
                      </div>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="5.0"
                        value={standardScores.performance}
                        onChange={(e) =>
                          setStandardScores({
                            ...standardScores,
                            performance: Math.min(5.0, Math.max(0, parseFloat(e.target.value) || 0)),
                          })
                        }
                        className="w-full p-2 bg-white dark:bg-[#1D1814] border border-[#1A1209]"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Total Score Banner */}
              <div
                className={`p-3 border-2 ${
                  isScoreInvalid
                    ? 'border-[#8B1A1A] bg-[#FFF5F5] text-[#8B1A1A]'
                    : 'border-[#1A1209] bg-[#EBF8EE] text-[#1F5A2E]'
                } flex items-center justify-between font-bold`}
              >
                <span>TOTAL SCORE:</span>
                <span className="text-base">
                  {currentTotal} / {maxAllowed}
                </span>
              </div>

              {/* Qualitative Remarks */}
              <div>
                <label className="block text-[10px] uppercase font-bold mb-1 text-[#786958]">Faculty Remarks:</label>
                <textarea
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209] text-xs"
                />
              </div>

              {/* Feedback */}
              <div>
                <label className="block text-[10px] uppercase font-bold mb-1 text-[#786958]">Constructive Feedback (Student Visible):</label>
                <textarea
                  rows={2}
                  placeholder="Detailed student feedback..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209] text-xs"
                />
              </div>

              {/* Private Faculty Notes */}
              <div>
                <label className="block text-[10px] uppercase font-bold mb-1 text-[#8B1A1A]">
                  Private Evaluation Notes (Faculty Eyes Only):
                </label>
                <textarea
                  rows={2}
                  placeholder="Confidential defense notes, viva verification or internal marks..."
                  value={privateNotes}
                  onChange={(e) => setPrivateNotes(e.target.value)}
                  className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209] text-xs font-mono"
                />
              </div>
            </div>

            {/* Approval Action Button */}
            <div className="pt-4 border-t border-[#E0D8C8]">
              <button
                onClick={handleApprove}
                disabled={isScoreInvalid}
                className={`w-full py-2.5 font-bold text-xs uppercase flex items-center justify-center gap-2 border-2 border-[#1A1209] shadow-[3px_3px_0px_#1A1209] ${
                  isScoreInvalid
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-[#1F5A2E] text-white hover:bg-[#164422]'
                }`}
              >
                <Check className="w-4 h-4" /> DIGITALLY SIGN & APPROVE
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // MAIN FACULTY WORKSPACE VIEW
  // ----------------------------------------------------
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 font-mono text-xs">
      {/* Header */}
      <div className="p-6 bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[4px_4px_0px_#1A1209] flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#B84915] block mb-1">
            FACULTY INSTRUCTIONAL CONSOLE // DEPARTMENTAL WORKSPACE
          </span>
          <h1 className="text-2xl font-black text-[#1A1209] dark:text-white tracking-tight">
            Academic Classroom & Evaluation Portal.
          </h1>
          <p className="text-xs text-[#5C4D3C] dark:text-[#B8A99A] mt-1">
            Subject allotments, laboratory batch experiments, custom rubric builder, and digitally stamped evaluation dossiers.
          </p>
        </div>

        <button
          onClick={loadFacultyData}
          disabled={loading}
          className="neo-btn px-4 py-2 bg-[#F4EFE6] dark:bg-[#26201B] hover:bg-[#B84915] hover:text-white text-[#1A1209] dark:text-white text-xs flex items-center gap-2"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>REFRESH CLASSROOM</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center border-b-2 border-[#1A1209] gap-2 pb-0">
        <button
          onClick={() => setActiveTab('my_classes')}
          className={`neo-btn px-4 py-2 text-xs flex items-center gap-1.5 ${
            activeTab === 'my_classes'
              ? 'bg-[#1A365D] text-white shadow-[2px_2px_0px_#1A1209]'
              : 'bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-[#D4C7B5]'
          }`}
        >
          <Folder className="w-3.5 h-3.5 text-[#B84915]" /> MY CLASSES ({teachingFolders?.class_folders?.length || 0})
        </button>

        <button
          onClick={() => setActiveTab('inbox')}
          className={`neo-btn px-4 py-2 text-xs flex items-center gap-1.5 ${
            activeTab === 'inbox'
              ? 'bg-[#1A365D] text-white shadow-[2px_2px_0px_#1A1209]'
              : 'bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-[#D4C7B5]'
          }`}
        >
          <Folder className="w-3.5 h-3.5" /> SUBMISSIONS INBOX ({submissions.length})
        </button>

        <button
          onClick={() => setActiveTab('create_task')}
          className={`neo-btn px-4 py-2 text-xs flex items-center gap-1.5 ${
            activeTab === 'create_task'
              ? 'bg-[#B84915] text-white shadow-[2px_2px_0px_#1A1209]'
              : 'bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-[#D4C7B5]'
          }`}
        >
          <Plus className="w-3.5 h-3.5" /> CREATE ASSIGNMENT / EXPERIMENT
        </button>

        <button
          onClick={() => setActiveTab('rubrics')}
          className={`neo-btn px-4 py-2 text-xs flex items-center gap-1.5 ${
            activeTab === 'rubrics'
              ? 'bg-[#1F5A2E] text-white shadow-[2px_2px_0px_#1A1209]'
              : 'bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-[#D4C7B5]'
          }`}
        >
          <Award className="w-3.5 h-3.5" /> CUSTOM RUBRIC BUILDER ({customRubrics.length})
        </button>

        <button
          onClick={() => setActiveTab('calendar')}
          className={`neo-btn px-4 py-2 text-xs flex items-center gap-1.5 ${
            activeTab === 'calendar'
              ? 'bg-[#1A365D] text-white shadow-[2px_2px_0px_#1A1209]'
              : 'bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-[#D4C7B5]'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-indigo-400" /> ACADEMIC CALENDAR
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`neo-btn px-4 py-2 text-xs flex items-center gap-1.5 ${
            activeTab === 'analytics'
              ? 'bg-[#1A365D] text-white shadow-[2px_2px_0px_#1A1209]'
              : 'bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-[#D4C7B5]'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" /> CLASSROOM ANALYTICS
        </button>
      </div>

      {/* ---------------------------------------------------- */}
      {/* TAB 0: ROLE-BASED CLASS & TEACHING WORKSPACE */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'my_classes' && (
        <FacultyClassWorkspace
          teachingFolders={teachingFolders}
          loading={loading}
          onRefresh={loadFacultyData}
          onEvaluateSubmission={(item) => {
            // Find full submission object or construct from queue item
            const found = submissions.find((s) => s.submission_id === item.submission_id);
            if (found) {
              openEvaluation(found);
            } else {
              openEvaluation(item as any);
            }
          }}
          showToast={showToast}
        />
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 1: SUBMISSIONS INBOX */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'inbox' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#1D1814] p-4 border-2 border-[#1A1209] shadow-[3.5px_3.5px_0px_#1A1209]">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#786958]" />
                <input
                  type="text"
                  placeholder="Filter author, subject, title..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209] text-xs font-mono"
                />
              </div>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209] text-xs font-mono"
              >
                <option value="">All Assessment Types</option>
                <option value="Assignment">Standard Assignment</option>
                <option value="Experiment">Laboratory Experiment</option>
                <option value="Special Document">Special Document</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209] text-xs font-mono"
              >
                <option value="">All Statuses</option>
                <option value="submitted">Submitted (Pending Review)</option>
                <option value="graded">Graded & Approved</option>
                <option value="returned">Returned for Corrections</option>
              </select>

              <select
                value={batchFilter}
                onChange={(e) => setBatchFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209] text-xs font-mono"
              >
                <option value="">All Lab Batches</option>
                {myBatches.slice(0, 10).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.batch_name} ({b.branch_code})
                  </option>
                ))}
              </select>
            </div>

            <span className="text-xs text-[#786958]">
              {filteredSubmissions.length} active submissions in inbox
            </span>
          </div>

          {/* Submissions Table */}
          <div className="bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[4px_4px_0px_#1A1209] overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F4EFE6] dark:bg-[#26201B] border-b-2 border-[#1A1209] uppercase text-[10px]">
                <tr>
                  <th className="p-3">Roll No</th>
                  <th className="p-3">Student Name</th>
                  <th className="p-3">Subject / Document</th>
                  <th className="p-3">Batch / Type</th>
                  <th className="p-3">Submitted At</th>
                  <th className="p-3">Delay / Punctuality</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Evaluation Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0D8C8] dark:divide-[#332A24]">
                {filteredSubmissions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-[#786958]">
                      No student submissions match the active classroom filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredSubmissions.map((sub) => (
                    <tr key={sub.submission_id} className="hover:bg-[#FAF6EE] dark:hover:bg-[#231C17]">
                      <td className="p-3 font-bold text-[#B84915]">{sub.roll_number}</td>
                      <td className="p-3 font-medium text-[#1A1209] dark:text-white">{sub.student_name}</td>
                      <td className="p-3">
                        <span className="font-bold block text-[#1A1209] dark:text-white">{sub.title}</span>
                        <span className="text-[10px] text-[#786958]">{sub.subject_name}</span>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 bg-[#E8EFF8] text-[#1A365D] border border-[#1A365D] text-[10px]">
                          {sub.batch_name || sub.doc_type}
                        </span>
                      </td>
                      <td className="p-3 text-[#786958]">{sub.submission_date}</td>
                      <td className="p-3">
                        {sub.is_late === 1 ? (
                          <span className="px-2 py-0.5 bg-[#FFF5F5] text-[#8B1A1A] border border-[#8B1A1A] text-[10px] font-bold">
                            {sub.delay_text}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-[#EBF8EE] text-[#1F5A2E] border border-[#1F5A2E] text-[10px] font-bold">
                            On Time
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 text-[9px] uppercase font-bold border ${
                            sub.status === 'graded'
                              ? 'bg-[#EBF8EE] text-[#1F5A2E] border-[#1F5A2E]'
                              : sub.status === 'submitted'
                              ? 'bg-[#FFF8E7] text-[#B84915] border-[#B84915]'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {sub.status === 'graded' ? `Graded: ${sub.marks_awarded}/${sub.eval_max_marks}` : sub.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => openEvaluation(sub)}
                          disabled={openingSubId === sub.submission_id}
                          className="px-3 py-1.5 bg-[#1A365D] text-white hover:bg-[#12243F] border border-[#1A1209] font-bold text-[10px] flex items-center gap-1.5 ml-auto"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {sub.status === 'graded' ? 'VIEW EVALUATION' : 'GRADE SUBMISSION'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 2: CREATE TASK / EXPERIMENT / SPECIAL DOCUMENT */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'create_task' && (
        <div className="bg-white dark:bg-[#1D1814] p-6 border-2 border-[#1A1209] shadow-[4px_4px_0px_#1A1209] space-y-6">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#B84915] block">
              ACADEMIC ASSESSMENT AUTHORING ENGINE // 3 DECOUPLED WORKFLOWS
            </span>
            <h2 className="text-xl font-black text-[#1A1209] dark:text-white uppercase tracking-tight mt-0.5">
              Publish Assignment, Lab Experiment or Special Document.
            </h2>
            <p className="text-xs text-[#5C4D3C] dark:text-[#A89886] mt-1">
              Select the exact academic format below. Special documents, experiments, and standard assignments follow dedicated, logically segregated workflows.
            </p>
          </div>

          {/* Workflow Selector Tabs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setAssessmentWorkflow('assignment');
                setTaskType('Assignment');
                setTaskCategory('standard');
                setTaskMaxMarks(10);
              }}
              className={`p-3.5 border-2 text-left transition-all ${
                assessmentWorkflow === 'assignment'
                  ? 'border-[#1A1209] bg-[#FAF6EE] dark:bg-[#26201B] shadow-[3px_3px_0px_#B84915]'
                  : 'border-[#E0D8C8] dark:border-[#332A24] bg-white dark:bg-[#1D1814] hover:border-[#1A1209]'
              }`}
            >
              <span className="text-[9px] uppercase font-bold text-[#B84915] block">FORMAT 1</span>
              <span className="text-xs font-black text-[#1A1209] dark:text-white block mt-0.5">STANDARD ASSIGNMENT</span>
              <span className="text-[10px] text-[#786958] mt-1 block leading-tight">
                Theory essays, tutorials, and questions with standard 10-mark rubric.
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAssessmentWorkflow('experiment');
                setTaskType('Experiment');
                setTaskCategory('experiment');
                setTaskMaxMarks(15);
              }}
              className={`p-3.5 border-2 text-left transition-all ${
                assessmentWorkflow === 'experiment'
                  ? 'border-[#1A1209] bg-[#FAF6EE] dark:bg-[#26201B] shadow-[3px_3px_0px_#1F5A2E]'
                  : 'border-[#E0D8C8] dark:border-[#332A24] bg-white dark:bg-[#1D1814] hover:border-[#1A1209]'
              }`}
            >
              <span className="text-[9px] uppercase font-bold text-[#1F5A2E] block">FORMAT 2</span>
              <span className="text-xs font-black text-[#1A1209] dark:text-white block mt-0.5">LABORATORY EXPERIMENT</span>
              <span className="text-[10px] text-[#786958] mt-1 block leading-tight">
                Hands-on practicals targeted to division or specific lab batches (A1, A2).
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAssessmentWorkflow('special');
                setTaskType('Assignment');
                setTaskCategory('special');
                const sel = customRubrics[0];
                if (sel) {
                  setSelectedRubricId(sel.id);
                  setTaskMaxMarks(sel.total_marks || 25);
                }
              }}
              className={`p-3.5 border-2 text-left transition-all ${
                assessmentWorkflow === 'special'
                  ? 'border-[#1A1209] bg-[#FAF6EE] dark:bg-[#26201B] shadow-[3px_3px_0px_#1A365D]'
                  : 'border-[#E0D8C8] dark:border-[#332A24] bg-white dark:bg-[#1D1814] hover:border-[#1A1209]'
              }`}
            >
              <span className="text-[9px] uppercase font-bold text-[#1A365D] block">FORMAT 3</span>
              <span className="text-xs font-black text-[#1A1209] dark:text-white block mt-0.5">SPECIAL DOCUMENT</span>
              <span className="text-[10px] text-[#786958] mt-1 block leading-tight">
                Mini/Major Projects, Internships & Research Papers with custom rubrics.
              </span>
            </button>
          </div>

          <form onSubmit={handleCreateTaskSubmit} className="space-y-4 pt-2">
            {/* WORKFLOW 1: STANDARD ASSIGNMENT */}
            {assessmentWorkflow === 'assignment' && (
              <div className="space-y-4">
                <div className="p-3 bg-[#FAF6EE] dark:bg-[#26201B] border border-[#1A1209] flex items-center justify-between">
                  <span className="text-xs font-bold text-[#B84915]">
                    STANDARD ASSIGNMENT RUBRIC: 10 MARKS (Knowledge: 4.0 | Content: 3.0 | Punctuality: 3.0)
                  </span>
                  <span className="stamp-badge py-0 text-[9px] bg-white text-[#1A1209]">AUTO-EVALUATED</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] uppercase font-bold mb-1">Assignment Title:</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Assignment 2: Relational Schema Normalization & BCNF"
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold mb-1">Assignment Number:</label>
                    <input
                      type="text"
                      value={taskNumber}
                      onChange={(e) => setTaskNumber(e.target.value)}
                      placeholder="e.g. 1, 2"
                      className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase font-bold mb-1">Subject:</label>
                    <select
                      value={taskSubjectId}
                      onChange={(e) => setTaskSubjectId(e.target.value)}
                      className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]"
                    >
                      {allSubjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.code} - {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold mb-1">Submission Deadline:</label>
                    <input
                      type="datetime-local"
                      value={taskDueDate}
                      onChange={(e) => setTaskDueDate(e.target.value)}
                      className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold mb-1">Late Submission Policy:</label>
                    <select
                      value={latePolicy}
                      onChange={(e) => setLatePolicy(e.target.value as any)}
                      className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]"
                    >
                      <option value="penalty">Deduct Late Penalty (10%)</option>
                      <option value="allow">Allow Late Submissions</option>
                      <option value="reject">Reject After Deadline</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold mb-1">Assignment Questions / Instructions:</label>
                  <textarea
                    rows={4}
                    placeholder="Enter academic questions, analytical tasks, or essay prompts..."
                    value={taskInstructions}
                    onChange={(e) => setTaskInstructions(e.target.value)}
                    className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]"
                  />
                </div>
              </div>
            )}

            {/* WORKFLOW 2: LABORATORY EXPERIMENT */}
            {assessmentWorkflow === 'experiment' && (
              <div className="space-y-4">
                <div className="p-3 bg-[#FAF6EE] dark:bg-[#26201B] border border-[#1A1209] flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1F5A2E]">
                    LABORATORY RUBRIC: 15 MARKS (Knowledge: 4.0 | Practical Performance: 5.0 | Content: 3.0 | Punctuality: 3.0)
                  </span>
                  <span className="stamp-badge py-0 text-[9px] bg-white text-[#1A1209]">PRACTICAL POD</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] uppercase font-bold mb-1">Experiment Title:</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Experiment 3: Heap Sort & Priority Queues"
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold mb-1">Experiment Number:</label>
                    <input
                      type="text"
                      value={exptNumber}
                      onChange={(e) => setExptNumber(e.target.value)}
                      placeholder="e.g. Exp 1, Exp 2"
                      className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase font-bold mb-1">Laboratory Subject:</label>
                    <select
                      value={taskSubjectId}
                      onChange={(e) => setTaskSubjectId(e.target.value)}
                      className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]"
                    >
                      {allSubjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.code} - {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold mb-1">Target Audience:</label>
                    <select
                      value={targetType}
                      onChange={(e) => setTargetType(e.target.value as any)}
                      className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]"
                    >
                      <option value="division">Entire Division (All Batches)</option>
                      <option value="batch">Specific Lab Batch Only</option>
                    </select>
                  </div>

                  {targetType === 'batch' ? (
                    <div>
                      <label className="block text-[10px] uppercase font-bold mb-1">Select Batch:</label>
                      <select
                        value={selectedBatchId}
                        onChange={(e) => setSelectedBatchId(e.target.value)}
                        className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]"
                      >
                        {myBatches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.batch_name} ({b.division_name})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[10px] uppercase font-bold mb-1">Submission Deadline:</label>
                      <input
                        type="datetime-local"
                        value={taskDueDate}
                        onChange={(e) => setTaskDueDate(e.target.value)}
                        className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]"
                      />
                    </div>
                  )}
                </div>

                {targetType === 'batch' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold mb-1">Submission Deadline:</label>
                      <input
                        type="datetime-local"
                        value={taskDueDate}
                        onChange={(e) => setTaskDueDate(e.target.value)}
                        className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold mb-1">Late Policy:</label>
                      <select
                        value={latePolicy}
                        onChange={(e) => setLatePolicy(e.target.value as any)}
                        className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]"
                      >
                        <option value="penalty">Deduct Late Penalty (10%)</option>
                        <option value="allow">Allow Late Submissions</option>
                        <option value="reject">Reject After Deadline</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase font-bold mb-1">Experiment Objective:</label>
                    <textarea
                      rows={2}
                      placeholder="To design, trace, and evaluate algorithmic time/space bounds..."
                      value={exptObjective}
                      onChange={(e) => setExptObjective(e.target.value)}
                      className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold mb-1">Hardware / Software Requirements:</label>
                    <textarea
                      rows={2}
                      placeholder="e.g. GCC 11.2, Java JDK 17, Linux Ubuntu 22.04 LTS..."
                      value={exptReqs}
                      onChange={(e) => setExptReqs(e.target.value)}
                      className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold mb-1">Step-by-Step Procedure:</label>
                  <textarea
                    rows={3}
                    placeholder="1. Construct min-heap structure. 2. Perform heapify on node removal..."
                    value={exptProcedure}
                    onChange={(e) => setExptProcedure(e.target.value)}
                    className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]"
                  />
                </div>
              </div>
            )}

            {/* WORKFLOW 3: SPECIAL DOCUMENT SUBMISSION */}
            {assessmentWorkflow === 'special' && (
              <div className="space-y-4">
                <div className="p-3 bg-[#FAF6EE] dark:bg-[#26201B] border border-[#1A1209] flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#1A365D]">
                    SPECIAL DOCUMENT WORKFLOW: EVALUATED STRICTLY AGAINST CUSTOM RUBRIC CRITERIA
                  </span>
                  {selectedRubricId ? (
                    <span className="stamp-badge py-0 text-[10px] bg-[#1A365D] text-white">
                      TOTAL MARKS: {customRubrics.find((r) => r.id === selectedRubricId)?.total_marks || 25} (AUTO-DERIVED)
                    </span>
                  ) : (
                    <span className="text-[10px] text-[#8B1A1A] font-bold">PLEASE ATTACH A CUSTOM RUBRIC</span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] uppercase font-bold mb-1">Document Title:</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Mini Project: Smart Campus IoT Energy Monitoring System"
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold mb-1">Document Category:</label>
                    <select
                      value={specialCategory}
                      onChange={(e) => setSpecialCategory(e.target.value)}
                      className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]"
                    >
                      <option value="Mini Project Report">Mini Project Report</option>
                      <option value="Major Project Phase I Report">Major Project Phase I Report</option>
                      <option value="Major Project Phase II Report">Major Project Phase II Report</option>
                      <option value="Industry Internship Dossier">Industry Internship Dossier</option>
                      <option value="Research Paper / Manuscript">Research Paper / Manuscript</option>
                      <option value="Technical Seminar Report">Technical Seminar Report</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase font-bold mb-1">Subject / Project Course:</label>
                    <select
                      value={taskSubjectId}
                      onChange={(e) => setTaskSubjectId(e.target.value)}
                      className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]"
                    >
                      {allSubjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.code} - {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold mb-1">Attached Custom Rubric:</label>
                    <select
                      required
                      value={selectedRubricId}
                      onChange={(e) => {
                        setSelectedRubricId(e.target.value);
                        const r = customRubrics.find((cr) => cr.id === e.target.value);
                        if (r) setTaskMaxMarks(r.total_marks);
                      }}
                      className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]"
                    >
                      <option value="">-- Select Saved Custom Rubric --</option>
                      {customRubrics.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.title} ({r.total_marks} Marks)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold mb-1">Submission Deadline:</label>
                    <input
                      type="datetime-local"
                      value={taskDueDate}
                      onChange={(e) => setTaskDueDate(e.target.value)}
                      className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]"
                    />
                  </div>
                </div>

                {/* Show Criteria Preview of Selected Rubric */}
                {selectedRubricId && (
                  <div className="p-3 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209] space-y-2">
                    <span className="text-[10px] uppercase font-bold text-[#1A365D] block">
                      Criteria Breakdown for Attached Rubric ({customRubrics.find((r) => r.id === selectedRubricId)?.total_marks} Marks Total):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                      {customRubrics.find((r) => r.id === selectedRubricId)?.criteria?.map((c: any, i: number) => (
                        <div key={i} className="p-2 bg-white dark:bg-[#1D1814] border border-[#E0D8C8] text-[10px]">
                          <span className="font-bold block text-[#1A1209] dark:text-white">{c.name}</span>
                          <span className="text-[#B84915] font-bold">Max: {c.max_score || c.max_marks} marks</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* SUBMISSION METHOD CONFIGURATION */}
                <div className="p-4 bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[3px_3px_0px_#1A1209] space-y-4">
                  <div className="flex flex-wrap items-center justify-between border-b pb-2 border-[#E0D8C8] dark:border-[#332A24] gap-2">
                    <div>
                      <h4 className="text-xs font-black uppercase text-[#1A1209] dark:text-white flex items-center gap-2">
                        <Settings2 className="w-4 h-4 text-[#B84915]" />
                        Submission Method Configuration
                      </h4>
                      <p className="text-[10px] text-[#786958]">
                        Configure permitted submission channels, file constraints, and verification policies.
                      </p>
                    </div>

                    {/* Method Combination Policy Toggle */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-[#1A1209] dark:text-white">Combination Rule:</span>
                      <button
                        type="button"
                        onClick={() => setAllowMultipleMethods(!allowMultipleMethods)}
                        className={`px-2.5 py-1 text-[10px] font-bold border transition-all ${
                          allowMultipleMethods
                            ? 'bg-[#1F5A2E] text-white border-[#1F5A2E] shadow-[2px_2px_0px_#1A1209]'
                            : 'bg-[#FAF6EE] dark:bg-[#26201B] text-[#1A1209] dark:text-white border-[#1A1209]'
                        }`}
                      >
                        {allowMultipleMethods ? '✓ Allow Multiple Methods Together' : 'Allow Any One Method (Default)'}
                      </button>
                    </div>
                  </div>

                  {/* 5 Selectable / Toggleable Method Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    {/* Card A: PDF Upload */}
                    <div
                      onClick={() => setMethodPdf(!methodPdf)}
                      className={`p-3 border-2 cursor-pointer transition-all ${
                        methodPdf
                          ? 'border-[#1A1209] bg-[#FAF6EE] dark:bg-[#26201B] shadow-[2px_2px_0px_#B84915]'
                          : 'border-[#E0D8C8] dark:border-[#332A24] bg-white dark:bg-[#12100E] opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-[#B84915]">METHOD A</span>
                        <input
                          type="checkbox"
                          checked={methodPdf}
                          onChange={(e) => setMethodPdf(e.target.checked)}
                          className="accent-[#B84915]"
                        />
                      </div>
                      <span className="text-xs font-bold block mt-1 text-[#1A1209] dark:text-white">PDF Upload</span>
                      <span className="text-[9px] text-[#786958] block mt-0.5">MIME & file type validated PDF manuscripts</span>
                    </div>

                    {/* Card B: Word Document */}
                    <div
                      onClick={() => setMethodDocx(!methodDocx)}
                      className={`p-3 border-2 cursor-pointer transition-all ${
                        methodDocx
                          ? 'border-[#1A1209] bg-[#FAF6EE] dark:bg-[#26201B] shadow-[2px_2px_0px_#1A365D]'
                          : 'border-[#E0D8C8] dark:border-[#332A24] bg-white dark:bg-[#12100E] opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-[#1A365D]">METHOD B</span>
                        <input
                          type="checkbox"
                          checked={methodDocx}
                          onChange={(e) => setMethodDocx(e.target.checked)}
                          className="accent-[#1A365D]"
                        />
                      </div>
                      <span className="text-xs font-bold block mt-1 text-[#1A1209] dark:text-white">Word Document</span>
                      <span className="text-[9px] text-[#786958] block mt-0.5">.doc and .docx with preserved original</span>
                    </div>

                    {/* Card C: Other Files */}
                    <div
                      onClick={() => setMethodOtherFiles(!methodOtherFiles)}
                      className={`p-3 border-2 cursor-pointer transition-all ${
                        methodOtherFiles
                          ? 'border-[#1A1209] bg-[#FAF6EE] dark:bg-[#26201B] shadow-[2px_2px_0px_#6B46C1]'
                          : 'border-[#E0D8C8] dark:border-[#332A24] bg-white dark:bg-[#12100E] opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-[#6B46C1]">METHOD C</span>
                        <input
                          type="checkbox"
                          checked={methodOtherFiles}
                          onChange={(e) => setMethodOtherFiles(e.target.checked)}
                          className="accent-[#6B46C1]"
                        />
                      </div>
                      <span className="text-xs font-bold block mt-1 text-[#1A1209] dark:text-white">Other Safe Files</span>
                      <span className="text-[9px] text-[#786958] block mt-0.5">.pptx, .xlsx, .zip, .png, .txt</span>
                    </div>

                    {/* Card D: External Link */}
                    <div
                      onClick={() => setMethodExternalLink(!methodExternalLink)}
                      className={`p-3 border-2 cursor-pointer transition-all ${
                        methodExternalLink
                          ? 'border-[#1A1209] bg-[#FAF6EE] dark:bg-[#26201B] shadow-[2px_2px_0px_#1F5A2E]'
                          : 'border-[#E0D8C8] dark:border-[#332A24] bg-white dark:bg-[#12100E] opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-[#1F5A2E]">METHOD D</span>
                        <input
                          type="checkbox"
                          checked={methodExternalLink}
                          onChange={(e) => setMethodExternalLink(e.target.checked)}
                          className="accent-[#1F5A2E]"
                        />
                      </div>
                      <span className="text-xs font-bold block mt-1 text-[#1A1209] dark:text-white">External Link</span>
                      <span className="text-[9px] text-[#786958] block mt-0.5">Google Drive, GitHub, OneDrive, Figma</span>
                    </div>

                    {/* Card E: WriteUp Pro Editor */}
                    <div
                      onClick={() => setMethodEditor(!methodEditor)}
                      className={`p-3 border-2 cursor-pointer transition-all ${
                        methodEditor
                          ? 'border-[#1A1209] bg-[#FAF6EE] dark:bg-[#26201B] shadow-[2px_2px_0px_#D97706]'
                          : 'border-[#E0D8C8] dark:border-[#332A24] bg-white dark:bg-[#12100E] opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-[#D97706]">METHOD E</span>
                        <input
                          type="checkbox"
                          checked={methodEditor}
                          onChange={(e) => setMethodEditor(e.target.checked)}
                          className="accent-[#D97706]"
                        />
                      </div>
                      <span className="text-xs font-bold block mt-1 text-[#1A1209] dark:text-white">Integrated Editor</span>
                      <span className="text-[9px] text-[#786958] block mt-0.5">Write directly in WriteUp Pro authoring workspace</span>
                    </div>
                  </div>

                  {/* Contextual Configuration Fields (shown only when relevant file methods enabled) */}
                  {(methodPdf || methodDocx || methodOtherFiles) && (
                    <div className="p-3 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209] space-y-3">
                      <span className="text-[10px] font-bold uppercase text-[#1A1209] dark:text-white block">
                        File Upload Limits & Format Controls
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] uppercase font-bold mb-1">Max File Size (MB):</label>
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={maxFileSizeMb}
                            onChange={(e) => setMaxFileSizeMb(Number(e.target.value))}
                            className="w-full p-2 bg-white dark:bg-[#1D1814] border border-[#1A1209] text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase font-bold mb-1">Max Attachments Allowed:</label>
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={maxFilesCount}
                            onChange={(e) => setMaxFilesCount(Number(e.target.value))}
                            className="w-full p-2 bg-white dark:bg-[#1D1814] border border-[#1A1209] text-xs font-mono"
                          />
                        </div>
                        {methodDocx && (
                          <div>
                            <label className="block text-[10px] uppercase font-bold mb-1">Word Document PDF Conversion:</label>
                            <select
                              value={requirePdfConversion ? 'required' : 'optional'}
                              onChange={(e) => setRequirePdfConversion(e.target.value === 'required')}
                              className="w-full p-2 bg-white dark:bg-[#1D1814] border border-[#1A1209] text-xs"
                            >
                              <option value="optional">PDF Conversion Optional (Accept Original .docx)</option>
                              <option value="required">PDF Conversion Required</option>
                            </select>
                          </div>
                        )}
                      </div>

                      {methodOtherFiles && (
                        <div>
                          <label className="block text-[10px] uppercase font-bold mb-1">Permitted Other File Extensions:</label>
                          <div className="flex flex-wrap gap-2 pt-1">
                            {['pptx', 'ppt', 'xlsx', 'xls', 'zip', 'png', 'jpg', 'txt'].map((ext) => {
                              const checked = allowedExtensions.includes(ext);
                              return (
                                <button
                                  type="button"
                                  key={ext}
                                  onClick={() => {
                                    if (checked) {
                                      setAllowedExtensions(allowedExtensions.filter((e) => e !== ext));
                                    } else {
                                      setAllowedExtensions([...allowedExtensions, ext]);
                                    }
                                  }}
                                  className={`px-2 py-0.5 text-[10px] font-mono border ${
                                    checked
                                      ? 'bg-[#1A1209] text-white border-[#1A1209] dark:bg-white dark:text-[#1A1209]'
                                      : 'bg-white dark:bg-[#1D1814] text-[#786958] border-[#E0D8C8] dark:border-[#332A24]'
                                  }`}
                                >
                                  .{ext} {checked && '✓'}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Submission Policies (Resubmission, Edit Before Deadline, Late Policy) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div>
                      <label className="block text-[10px] uppercase font-bold mb-1">Allow Resubmission?</label>
                      <select
                        value={allowResubmission ? 'yes' : 'no'}
                        onChange={(e) => setAllowResubmission(e.target.value === 'yes')}
                        className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209] text-xs"
                      >
                        <option value="yes">Yes — Allow revision if returned by faculty</option>
                        <option value="no">No — Final submission is irrevocable</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold mb-1">Edit / Replace Before Deadline?</label>
                      <select
                        value={allowEditBeforeDeadline ? 'yes' : 'no'}
                        onChange={(e) => setAllowEditBeforeDeadline(e.target.value === 'yes')}
                        className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209] text-xs"
                      >
                        <option value="yes">Yes — Allow edits/replacement before deadline</option>
                        <option value="no">No — One-time submission only</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold mb-1">Late Submission Policy:</label>
                      <select
                        value={latePolicy}
                        onChange={(e) => setLatePolicy(e.target.value as any)}
                        className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209] text-xs"
                      >
                        <option value="penalty">Deduct Late Penalty (10%)</option>
                        <option value="allow">Accept Late Submissions (Record Delay)</option>
                        <option value="reject">Strictly Reject After Deadline</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold mb-1">Submission Guidelines & Guidelines:</label>
                  <textarea
                    rows={4}
                    placeholder="Enter IEEE formatting instructions, architectural diagram guidelines, or defense criteria..."
                    value={taskInstructions}
                    onChange={(e) => setTaskInstructions(e.target.value)}
                    className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              className="neo-btn px-6 py-2.5 bg-[#B84915] text-white hover:bg-[#963A0F] font-bold text-xs flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              {assessmentWorkflow === 'assignment' && 'PUBLISH ASSIGNMENT (10 MARKS)'}
              {assessmentWorkflow === 'experiment' && 'PUBLISH LABORATORY EXPERIMENT (15 MARKS)'}
              {assessmentWorkflow === 'special' && 'PUBLISH SPECIAL DOCUMENT WITH RUBRIC'}
            </button>
          </form>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 3: CUSTOM RUBRICS BUILDER */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'rubrics' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#1D1814] p-6 border-2 border-[#1A1209] shadow-[4px_4px_0px_#1A1209] space-y-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#1F5A2E] block">
                MODULE 9 // MULTI-CRITERIA CUSTOM RUBRIC BUILDER
              </span>
              <h2 className="text-xl font-black text-[#1A1209] dark:text-white uppercase tracking-tight mt-0.5">
                Design Evaluation Rubrics for Special Documents & Projects.
              </h2>
              <p className="text-xs text-[#5C4D3C] dark:text-[#A89886] mt-1">
                Construct rigorous, criterion-by-criterion grading matrix templates for Mini Projects, Major Projects, and Research Papers.
              </p>
            </div>

            <form onSubmit={handleCreateCustomRubricSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold mb-1">Rubric Title:</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Major Project Phase 1 Evaluation Rubric"
                    value={newRubricTitle}
                    onChange={(e) => setNewRubricTitle(e.target.value)}
                    className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold mb-1">Document Category:</label>
                  <select
                    value={newRubricDocCat}
                    onChange={(e) => setNewRubricDocCat(e.target.value)}
                    className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]"
                  >
                    <option value="Mini Project">Mini Project</option>
                    <option value="Major Project">Major Project</option>
                    <option value="Research Paper">Research Paper</option>
                  </select>
                </div>
              </div>

              {/* Criteria Rows */}
              <div className="border border-[#1A1209] p-4 bg-[#FAF6EE] dark:bg-[#12100E] space-y-3">
                <span className="text-[10px] font-bold uppercase text-[#786958] block">
                  CRITERIA BREAKDOWN MATRIX (TOTAL:{' '}
                  {rubricCriteria.reduce((sum, c) => sum + Number(c.max_score), 0)} MARKS)
                </span>

                {rubricCriteria.map((crit, idx) => (
                  <div key={crit.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                    <div className="md:col-span-5">
                      <input
                        type="text"
                        placeholder="Criterion title..."
                        value={crit.name}
                        onChange={(e) => {
                          const copy = [...rubricCriteria];
                          copy[idx].name = e.target.value;
                          setRubricCriteria(copy);
                        }}
                        className="w-full p-1.5 bg-white dark:bg-[#1D1814] border border-[#1A1209]"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <input
                        type="number"
                        placeholder="Max"
                        value={crit.max_score}
                        onChange={(e) => {
                          const copy = [...rubricCriteria];
                          copy[idx].max_score = Number(e.target.value);
                          setRubricCriteria(copy);
                        }}
                        className="w-full p-1.5 bg-white dark:bg-[#1D1814] border border-[#1A1209]"
                      />
                    </div>
                    <div className="md:col-span-4">
                      <input
                        type="text"
                        placeholder="Guideline notes..."
                        value={crit.guidance || ''}
                        onChange={(e) => {
                          const copy = [...rubricCriteria];
                          copy[idx].guidance = e.target.value;
                          setRubricCriteria(copy);
                        }}
                        className="w-full p-1.5 bg-white dark:bg-[#1D1814] border border-[#1A1209]"
                      />
                    </div>
                    <div className="md:col-span-1 text-right">
                      {rubricCriteria.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setRubricCriteria(rubricCriteria.filter((_, i) => i !== idx))}
                          className="px-2 py-1 bg-[#8B1A1A] text-white text-[10px]"
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() =>
                    setRubricCriteria([
                      ...rubricCriteria,
                      { id: `c_${Date.now()}`, name: 'New Criterion', max_score: 10, guidance: '' },
                    ])
                  }
                  className="px-3 py-1 bg-white dark:bg-[#1D1814] border border-[#1A1209] text-xs flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> ADD CRITERION ROW
                </button>
              </div>

              <button
                type="submit"
                className="neo-btn px-6 py-2 bg-[#1F5A2E] text-white hover:bg-[#164422] font-bold text-xs"
              >
                SAVE CUSTOM RUBRIC
              </button>
            </form>
          </div>

          {/* Saved Rubrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {customRubrics.map((r) => (
              <div key={r.id} className="p-4 bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-[#1A1209] dark:text-white">{r.title}</span>
                  <span className="px-2 py-0.5 bg-[#E8EFF8] text-[#1A365D] border border-[#1A365D] font-bold">
                    {r.total_marks} Marks
                  </span>
                </div>
                <p className="text-[#786958] text-[11px]">Category: {r.document_category}</p>
                <div className="pt-2 border-t border-[#E0D8C8] space-y-1">
                  {r.criteria?.map((c) => (
                    <div key={c.id || c.name} className="flex justify-between text-[11px]">
                      <span>{c.name}</span>
                      <span className="font-bold">{c.max_score} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 4: CLASSROOM ANALYTICS */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#1D1814] p-6 border-2 border-[#1A1209] shadow-[4px_4px_0px_#1A1209] space-y-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#1A365D] block">
                MODULE 12 // FACULTY ANALYTICS & SCORE DISTRIBUTION
              </span>
              <h2 className="text-xl font-black text-[#1A1209] dark:text-white uppercase tracking-tight mt-0.5">
                Classroom Academic Performance & Workload Telemetry.
              </h2>
            </div>

            {/* Score Distribution Histogram */}
            {facultyStats?.score_distribution && (
              <div className="p-4 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209] space-y-3">
                <span className="text-[10px] font-bold uppercase text-[#786958] block">
                  SCORE DISTRIBUTION HISTOGRAM (GRADED SUBMISSIONS)
                </span>
                <div className="grid grid-cols-5 gap-2 text-center text-[11px]">
                  <div className="p-2 bg-white dark:bg-[#1D1814] border border-[#1A1209]">
                    <span className="text-[#8B1A1A] font-bold block text-sm">
                      {facultyStats.score_distribution.range_under_40 || 0}
                    </span>
                    <span>&lt; 40%</span>
                  </div>
                  <div className="p-2 bg-white dark:bg-[#1D1814] border border-[#1A1209]">
                    <span className="text-[#B84915] font-bold block text-sm">
                      {facultyStats.score_distribution.range_40_60 || 0}
                    </span>
                    <span>40% - 60%</span>
                  </div>
                  <div className="p-2 bg-white dark:bg-[#1D1814] border border-[#1A1209]">
                    <span className="text-[#1A365D] font-bold block text-sm">
                      {facultyStats.score_distribution.range_60_75 || 0}
                    </span>
                    <span>60% - 75%</span>
                  </div>
                  <div className="p-2 bg-white dark:bg-[#1D1814] border border-[#1A1209]">
                    <span className="text-[#1F5A2E] font-bold block text-sm">
                      {facultyStats.score_distribution.range_75_90 || 1}
                    </span>
                    <span>75% - 90%</span>
                  </div>
                  <div className="p-2 bg-white dark:bg-[#1D1814] border border-[#1A1209]">
                    <span className="text-[#1F5A2E] font-bold block text-sm">
                      {facultyStats.score_distribution.range_90_100 || 1}
                    </span>
                    <span>90% - 100%</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 6: UNIFIED ACADEMIC & DEADLINE CALENDAR */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'calendar' && (
        <CalendarView role="faculty" />
      )}
    </div>
  );
};
