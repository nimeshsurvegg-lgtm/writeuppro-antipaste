import React, { useState, useEffect } from 'react';
import {
  Plus, FileText, CheckCircle2, Clock, AlertTriangle, Download, Copy,
  ArrowRight, BookOpen, Award, Check, AlertCircle, Edit3, Trash2,
  Calendar, Layers, UserCheck, Share2, Sparkles, BarChart2, Search,
  Filter, Eye, CheckSquare, X, ExternalLink, ShieldCheck, Folder
} from 'lucide-react';
import { api } from '../lib/api';
import {
  AcademicDocument, User, StudentProfile, StudentPerformanceAverage,
  OpenElectiveConfig, PromotionWindow, StudentWorkspaceFolders
} from '../types';
import { StudentAcademicFolderWorkspace } from './StudentAcademicFolderWorkspace';
import { SpecialDocumentSubmissionModal } from './SpecialDocumentSubmissionModal';
import { SubjectPerformanceView } from './SubjectPerformanceView';
import { CalendarView } from './CalendarView';
import { PortfolioView } from './PortfolioView';
import { StudentPromotionView } from './StudentPromotionView';

interface StudentWorkspaceProps {
  currentUser: User;
  onOpenEditor: (docId: string | null) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onProfileUpdated: () => void;
  activeTab?: string;
  setActiveTab?: (tab: any) => void;
}

export const StudentWorkspace: React.FC<StudentWorkspaceProps> = ({
  currentUser,
  onOpenEditor,
  showToast,
  onProfileUpdated,
  activeTab: propActiveTab,
  setActiveTab: propSetActiveTab,
}) => {
  const [profile, setProfile] = useState<StudentProfile | null>(
    (currentUser.profile as StudentProfile) || null
  );

  const [internalTab, setInternalTab] = useState<
    'overview' | 'subjects' | 'assignments' | 'experiments' | 'special_documents' | 'submissions' | 'performance' | 'calendar' | 'portfolio' | 'electives' | 'promotion'
  >('overview');

  const activeTab = (propActiveTab as any) || internalTab;
  const setActiveTab = (tab: any) => {
    setInternalTab(tab);
    if (propSetActiveTab) {
      propSetActiveTab(tab);
    }
  };
  const [documents, setDocuments] = useState<AcademicDocument[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [enrolledSubjects, setEnrolledSubjects] = useState<any[]>([]);
  const [performanceAverages, setPerformanceAverages] = useState<StudentPerformanceAverage[]>([]);
  const [availableElectives, setAvailableElectives] = useState<OpenElectiveConfig[]>([]);
  const [promotionWindows, setPromotionWindows] = useState<PromotionWindow[]>([]);
  const [workspaceFolders, setWorkspaceFolders] = useState<StudentWorkspaceFolders | null>(null);
  const [loading, setLoading] = useState(false);

  // Task Details Modal State
  const [selectedTask, setSelectedTask] = useState<any | null>(null);

  // Special Submission Flexible Modal State
  const [specialSubTask, setSpecialSubTask] = useState<any | null>(null);
  const [specialDocId, setSpecialDocId] = useState<string | null>(null);

  // Filters & Search
  const [taskSearch, setTaskSearch] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState('ALL');

  // Promotion Request Form
  const [selectedPromoWindowId, setSelectedPromoWindowId] = useState('');
  const [promoCgpa, setPromoCgpa] = useState<number>(profile?.cgpa || 8.5);
  const [promoDivision, setPromoDivision] = useState('Div A');
  const [promoRollNo, setPromoRollNo] = useState('');

  // Setup Form State for onboarding / rejected profiles
  const [rollNumber, setRollNumber] = useState(profile?.roll_number || '');
  const [yearLevel, setYearLevel] = useState(profile?.year_level || 'SE');
  const [branchCode, setBranchCode] = useState(profile?.branch_code || 'CE');
  const [semNumber, setSemNumber] = useState(profile?.semester_number || 3);
  const [division, setDivision] = useState(profile?.division_name || 'Div A');
  const [elective, setElective] = useState(profile?.elective_subject || '');

  useEffect(() => {
    loadStudentData();
  }, []);

  const loadStudentData = async () => {
    try {
      setLoading(true);
      const results = await Promise.allSettled([
        api.documents.listDocuments(),
        api.analytics.getStudentAnalytics(),
        api.tasks.listTasks(),
        api.academic.getStudentEnrolledSubjects().catch(() => []),
        api.academic.getStudentPerformanceAverages().catch(() => []),
        api.academic.listOpenElectives().catch(() => []),
        api.academic.listPromotionWindows().catch(() => []),
        api.academic.getStudentWorkspaceFolders().catch(() => null),
      ]);

      if (results[0].status === 'fulfilled') setDocuments(results[0].value || []);
      if (results[1].status === 'fulfilled') setAnalytics(results[1].value);
      if (results[2].status === 'fulfilled') setTasks(results[2].value || []);
      if (results[3].status === 'fulfilled') setEnrolledSubjects(results[3].value || []);
      if (results[4].status === 'fulfilled') setPerformanceAverages(results[4].value || []);
      if (results[5].status === 'fulfilled') setAvailableElectives(results[5].value || []);
      if (results[6].status === 'fulfilled') {
        const wins = results[6].value || [];
        setPromotionWindows(wins);
        if (wins.length > 0) setSelectedPromoWindowId(wins[0].id);
      }
      if (results[7].status === 'fulfilled' && results[7].value) {
        setWorkspaceFolders(results[7].value);
      }
    } catch (err: any) {
      console.error('Error loading student workspace data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rollNumber.trim()) {
      showToast('Roll Number is required.', 'error');
      return;
    }

    try {
      await api.academic.submitStudentProfile({
        roll_number: rollNumber.trim(),
        year_level: yearLevel,
        branch_code: branchCode,
        semester_number: Number(semNumber),
        division_name: division,
        elective_subject: elective || undefined,
      });
      showToast('Profile submitted for administrator verification.', 'success');
      onProfileUpdated();
    } catch (err: any) {
      showToast(err.message || 'Failed to submit profile', 'error');
    }
  };

  const handleDuplicate = async (docId: string) => {
    try {
      await api.documents.duplicateDocument(docId);
      showToast('Document duplicated successfully as draft.', 'success');
      loadStudentData();
    } catch (err: any) {
      showToast(err.message || 'Failed to duplicate document', 'error');
    }
  };

  const handleDeleteDraft = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this draft? This action cannot be undone.')) return;
    try {
      await api.documents.deleteDocument(docId);
      showToast('Draft deleted successfully.', 'success');
      loadStudentData();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete draft', 'error');
    }
  };

  const handleSelectElective = async (configId: string, subjectId: string) => {
    try {
      await api.academic.selectOpenElective(configId, subjectId);
      showToast('Open elective selection submitted for faculty approval.', 'success');
      loadStudentData();
    } catch (err: any) {
      showToast(err.message || 'Failed to register elective', 'error');
    }
  };

  const handlePromotionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPromoWindowId) {
      showToast('No active promotion window selected.', 'error');
      return;
    }
    if (!promoRollNo.trim()) {
      showToast('Requested roll number is required.', 'error');
      return;
    }

    try {
      await api.academic.submitPromotionRequest({
        promotion_window_id: selectedPromoWindowId,
        cgpa: Number(promoCgpa),
        requested_division: promoDivision,
        requested_roll_number: promoRollNo.trim().toUpperCase(),
      });
      showToast('Promotion request lodged with the academic registry.', 'success');
      loadStudentData();
    } catch (err: any) {
      showToast(err.message || 'Failed to submit promotion request', 'error');
    }
  };

  // Helper to calculate exact task status badge
  const getTaskStatus = (task: any) => {
    if (task.student_doc_status === 'graded') {
      return {
        key: 'evaluated',
        label: `Evaluated (${task.student_marks_awarded ?? '-'} / ${task.max_marks} M)`,
        color: 'bg-[#EBF8EE] text-[#1F5A2E] border-[#1F5A2E]',
      };
    }
    if (task.student_doc_status === 'submitted') {
      if (task.student_is_late) {
        return {
          key: 'late_submitted',
          label: 'Late Submitted',
          color: 'bg-[#FFF5F5] text-[#8B1A1A] border-[#8B1A1A]',
        };
      }
      return {
        key: 'submitted',
        label: 'Submitted',
        color: 'bg-[#FFF8E7] text-[#B84915] border-[#B84915]',
      };
    }
    if (task.student_doc_status === 'draft') {
      return {
        key: 'draft',
        label: 'Draft in Progress',
        color: 'bg-[#E8EFF8] text-[#1A365D] border-[#1A365D]',
      };
    }
    if (task.due_date) {
      const dueTime = new Date(task.due_date).getTime();
      const nowTime = new Date().getTime();
      if (dueTime < nowTime) {
        return {
          key: 'missing',
          label: 'Missing / Overdue',
          color: 'bg-[#FFF5F5] text-[#8B1A1A] border-[#8B1A1A]',
        };
      }
      if (dueTime - nowTime > 5 * 24 * 60 * 60 * 1000) {
        return {
          key: 'upcoming',
          label: 'Upcoming',
          color: 'bg-[#F4EFE6] text-[#786958] border-[#786958]',
        };
      }
    }
    return {
      key: 'open',
      label: 'Open',
      color: 'bg-[#FAF6EE] text-[#1A1209] border-[#1A1209]',
    };
  };

  // Helper to start or resume write-up for a task
  const handleStartTaskWriteUp = async (task: any) => {
    // If Special Document, open dedicated flexible submission modal
    if (task.task_type === 'Special Document' || task.category === 'special_document') {
      setSpecialSubTask(task);
      setSpecialDocId(task.student_doc_id || null);
      return;
    }

    if (task.student_doc_id) {
      onOpenEditor(task.student_doc_id);
      return;
    }
    try {
      const newDoc = await api.documents.saveDocument({
        title: task.title,
        task_id: task.id,
        doc_type: task.task_type || 'Assignment',
        doc_number: String(task.task_number || 1),
        subject_name: task.subject_name || 'Academic Course',
        subject_code: task.subject_code || 'ACAD101',
        content_html: `<p><strong>Objective:</strong> ${task.description || task.title}</p><p>Author your solution here...</p>`,
        word_count: 10,
      });
      showToast(`Draft created for ${task.title}`, 'success');
      loadStudentData();
      onOpenEditor(newDoc.id);
    } catch (err: any) {
      showToast(err.message || 'Failed to start write-up', 'error');
    }
  };

  const handleOpenDocument = (doc: AcademicDocument) => {
    if (doc.doc_type === 'Special Document') {
      const matchTask = tasks.find((t) => t.id === doc.task_id) || {
        id: doc.task_id || 'sp_task',
        title: doc.title,
        task_type: 'Special Document',
        subject_id: '',
        subject_name: doc.subject_name,
        subject_code: doc.subject_code,
        task_number: doc.doc_number || '1',
        max_marks: 25,
        due_date: '',
        status: 'published',
        rubric: [],
        allowed_methods: ['editor', 'pdf', 'docx', 'other_files', 'external_link'],
      };
      setSpecialSubTask(matchTask);
      setSpecialDocId(doc.id);
      return;
    }
    onOpenEditor(doc.id);
  };

  // Filter tasks by section
  const assignmentTasks = tasks.filter((t) => (t.task_type || 'Assignment') === 'Assignment');
  const experimentTasks = tasks.filter((t) => t.task_type === 'Experiment');
  const specialTasks = tasks.filter((t) => t.task_type === 'Special Document');

  // Filter function for search and status
  const filterTaskList = (list: any[]) => {
    return list.filter((t) => {
      const matchesSearch =
        !taskSearch.trim() ||
        t.title?.toLowerCase().includes(taskSearch.toLowerCase()) ||
        t.subject_name?.toLowerCase().includes(taskSearch.toLowerCase()) ||
        t.subject_code?.toLowerCase().includes(taskSearch.toLowerCase());

      if (!matchesSearch) return false;

      if (taskStatusFilter === 'ALL') return true;
      const statusObj = getTaskStatus(t);
      if (taskStatusFilter === 'OPEN') return statusObj.key === 'open' || statusObj.key === 'upcoming';
      if (taskStatusFilter === 'SUBMITTED') return statusObj.key === 'submitted' || statusObj.key === 'late_submitted';
      if (taskStatusFilter === 'EVALUATED') return statusObj.key === 'evaluated';
      if (taskStatusFilter === 'MISSING') return statusObj.key === 'missing';
      return true;
    });
  };

  const isPending = profile?.status === 'pending';
  const isRejected = profile?.status === 'rejected';
  const isBlocked = profile?.status === 'blocked';

  // If student needs initial setup or has rejected status
  if (!profile || isRejected) {
    return (
      <div className="max-w-2xl mx-auto p-8 my-8 bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[6px_6px_0px_#1A1209] font-mono text-xs">
        <div className="text-center mb-8">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#B84915] block mb-1">
            MANDATORY ONBOARDING // PROTOCOL 01
          </span>
          <h2 className="text-xl font-bold tracking-tight text-[#1A1209] dark:text-white">
            Academic Profile Registration
          </h2>
          <p className="text-xs text-[#5C4D3C] dark:text-[#B8A99A] mt-1">
            Complete institutional academic configuration before accessing the authoring workspace.
          </p>
        </div>

        {isRejected && (
          <div className="bg-[#FFF5F5] dark:bg-[#2A1515] border-2 border-[#8B1A1A] p-4 mb-6 flex items-start gap-3 shadow-[3px_3px_0px_#8B1A1A]">
            <AlertCircle className="w-5 h-5 text-[#8B1A1A] mt-0.5 shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-[#8B1A1A] uppercase">Application Reverted by Administrator</h4>
              <p className="text-xs text-[#5C4D3C] dark:text-[#D4C7B5] mt-0.5">
                Remarks: {profile.admin_remarks || 'Please verify your details and resubmit.'}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider mb-1">Roll Number:</label>
            <input
              type="text"
              required
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value)}
              placeholder="e.g. 21CE104"
              className="w-full px-4 py-2.5 bg-[#FFFAF1] dark:bg-[#26201B] border-2 border-[#1A1209] font-bold text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider mb-1">Year Level:</label>
              <select
                value={yearLevel}
                onChange={(e) => setYearLevel(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#FFFAF1] dark:bg-[#26201B] border-2 border-[#1A1209] font-semibold text-xs"
              >
                <option value="FE">First Year (FE)</option>
                <option value="SE">Second Year (SE)</option>
                <option value="TE">Third Year (TE)</option>
                <option value="BE">Final Year (BE)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider mb-1">Department / Branch:</label>
              <select
                value={branchCode}
                onChange={(e) => setBranchCode(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#FFFAF1] dark:bg-[#26201B] border-2 border-[#1A1209] font-semibold text-xs"
              >
                <option value="CE">Computer Engineering (CE)</option>
                <option value="IT">Information Technology (IT)</option>
                <option value="EXTC">Electronics & Telecom (EXTC)</option>
                <option value="AIDS">AI & Data Science (AIDS)</option>
                <option value="MECH">Mechanical Engineering (MECH)</option>
                <option value="CIVIL">Civil Engineering (CIVIL)</option>
                <option value="ASH">Applied Science & Humanities (ASH)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider mb-1">Semester:</label>
              <select
                value={semNumber}
                onChange={(e) => setSemNumber(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-[#FFFAF1] dark:bg-[#26201B] border-2 border-[#1A1209] font-semibold text-xs"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <option key={s} value={s}>
                    Semester {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider mb-1">Division:</label>
              <select
                value={division}
                onChange={(e) => setDivision(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#FFFAF1] dark:bg-[#26201B] border-2 border-[#1A1209] font-semibold text-xs"
              >
                <option value="Div A">Division A</option>
                <option value="Div B">Division B</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="neo-btn w-full py-3.5 bg-[#B84915] hover:bg-[#A03D0E] text-[#FBF9F3] text-xs mt-4"
          >
            Submit for Administrator Verification &rarr;
          </button>
        </form>
      </div>
    );
  }

  // If pending approval
  if (isPending) {
    return (
      <div className="max-w-xl mx-auto p-12 my-12 bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[6px_6px_0px_#1A1209] text-center space-y-4 font-mono text-xs">
        <Clock className="w-12 h-12 text-[#B84915] mx-auto" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#B84915] block">
          STATUS // VERIFICATION IN PROGRESS
        </span>
        <h2 className="text-xl font-bold tracking-tight text-[#1A1209] dark:text-white">
          Profile Pending Administrator Verification
        </h2>
        <p className="text-xs text-[#5C4D3C] dark:text-[#B8A99A] leading-relaxed">
          Your profile (Roll: <span className="font-bold text-[#1A1209] dark:text-white">{profile.roll_number}</span>,{' '}
          {profile.year_level} {profile.branch_code} {profile.division_name}) has been lodged with the academic registry.
          You will be unlocked to author and submit write-ups once verified.
        </p>
      </div>
    );
  }

  // If blocked
  if (isBlocked) {
    return (
      <div className="max-w-xl mx-auto p-12 my-12 bg-white dark:bg-[#1D1814] border-2 border-[#8B1A1A] shadow-[6px_6px_0px_#8B1A1A] text-center space-y-4 font-mono text-xs">
        <AlertTriangle className="w-12 h-12 text-[#8B1A1A] mx-auto" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#8B1A1A] block">
          RESTRICTION NOTICE // SECTION 14
        </span>
        <h2 className="text-xl font-bold tracking-tight text-[#8B1A1A]">Account Access Suspended</h2>
        <p className="text-xs text-[#5C4D3C] dark:text-[#B8A99A]">
          Your student account has been temporarily restricted by the institution administrator. Please contact your
          department coordinator.
        </p>
      </div>
    );
  }

  // Submitted / Evaluated documents for Submissions & Grades tab
  const submittedDocs = documents.filter((d) => d.status === 'submitted' || d.status === 'graded');

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 font-mono text-xs">
      {/* Welcome Dossier Banner with Academic Meta */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#1A365D] dark:bg-[#1D1814] text-white p-6 border-2 border-[#1A1209] shadow-[5px_5px_0px_#1A1209]">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#F4EFE6] opacity-80 block">
            STUDENT ACADEMIC DOSSIER // ROLL NO. {profile.roll_number}
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight mt-1 font-sans">
            Welcome, {currentUser.full_name}.
          </h1>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs opacity-90">
            <span>
              Class: <strong>{profile.year_level} - {profile.division_name}</strong>
            </span>
            <span>•</span>
            <span>
              Branch: <strong>{profile.branch_code}</strong> (Sem {profile.semester_number})
            </span>
            <span>•</span>
            <span>
              Cycle: <strong>{profile.academic_year || '2026-27'}</strong>
            </span>
            <span>•</span>
            <span>
              CGPA: <strong className="text-[#48BB78]">{profile.cgpa ? profile.cgpa.toFixed(2) : '8.65'}</strong>
            </span>
            <span>•</span>
            <span>
              PRN: <strong>{profile.prn || 'PRN202600104'}</strong>
            </span>
          </div>
        </div>

        <button
          onClick={() => onOpenEditor(null)}
          className="neo-btn px-5 py-2.5 bg-[#B84915] hover:bg-[#963A0F] text-white text-xs flex items-center gap-2 border-2 border-white shadow-[3px_3px_0px_#FFFFFF]"
        >
          <Plus className="w-4 h-4" /> NEW ACADEMIC MANUSCRIPT
        </button>
      </div>

      {/* Primary Tab Navigation with 9 Distinct Workflows */}
      <div className="flex flex-wrap items-center border-b-2 border-[#1A1209] gap-2 pb-0">
        <button
          onClick={() => setActiveTab('overview')}
          className={`neo-btn px-3.5 py-2 text-xs flex items-center gap-1.5 ${
            activeTab === 'overview'
              ? 'bg-[#1A365D] text-white shadow-[2px_2px_0px_#1A1209]'
              : 'bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-[#D4C7B5]'
          }`}
        >
          <Folder className="w-3.5 h-3.5 text-[#B84915]" /> MY WORKSPACE ({workspaceFolders?.priority_submissions?.length || 0})
        </button>

        <button
          onClick={() => setActiveTab('subjects')}
          className={`neo-btn px-3.5 py-2 text-xs flex items-center gap-1.5 ${
            activeTab === 'subjects'
              ? 'bg-[#1A365D] text-white shadow-[2px_2px_0px_#1A1209]'
              : 'bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-[#D4C7B5]'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" /> MY SUBJECTS ({enrolledSubjects.length})
        </button>

        <button
          onClick={() => setActiveTab('assignments')}
          className={`neo-btn px-3.5 py-2 text-xs flex items-center gap-1.5 ${
            activeTab === 'assignments'
              ? 'bg-[#B84915] text-white shadow-[2px_2px_0px_#1A1209]'
              : 'bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-[#D4C7B5]'
          }`}
        >
          <CheckSquare className="w-3.5 h-3.5" /> ASSIGNMENTS ({assignmentTasks.length})
        </button>

        <button
          onClick={() => setActiveTab('experiments')}
          className={`neo-btn px-3.5 py-2 text-xs flex items-center gap-1.5 ${
            activeTab === 'experiments'
              ? 'bg-[#1F5A2E] text-white shadow-[2px_2px_0px_#1A1209]'
              : 'bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-[#D4C7B5]'
          }`}
        >
          <Layers className="w-3.5 h-3.5" /> LAB EXPERIMENTS ({experimentTasks.length})
        </button>

        <button
          onClick={() => setActiveTab('special_documents')}
          className={`neo-btn px-3.5 py-2 text-xs flex items-center gap-1.5 ${
            activeTab === 'special_documents'
              ? 'bg-[#6B46C1] text-white shadow-[2px_2px_0px_#1A1209]'
              : 'bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-[#D4C7B5]'
          }`}
        >
          <Award className="w-3.5 h-3.5" /> SPECIAL DOCUMENTS ({specialTasks.length})
        </button>

        <button
          onClick={() => setActiveTab('submissions')}
          className={`neo-btn px-3.5 py-2 text-xs flex items-center gap-1.5 ${
            activeTab === 'submissions'
              ? 'bg-[#1A365D] text-white shadow-[2px_2px_0px_#1A1209]'
              : 'bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-[#D4C7B5]'
          }`}
        >
          <Clock className="w-3.5 h-3.5" /> SUBMISSIONS & GRADES ({submittedDocs.length})
        </button>

        <button
          onClick={() => setActiveTab('calendar')}
          className={`neo-btn px-3.5 py-2 text-xs flex items-center gap-1.5 ${
            activeTab === 'calendar'
              ? 'bg-[#1A365D] text-white shadow-[2px_2px_0px_#1A1209]'
              : 'bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-[#D4C7B5]'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 text-indigo-400" /> DEADLINE CALENDAR
        </button>

        <button
          onClick={() => setActiveTab('performance')}
          className={`neo-btn px-3.5 py-2 text-xs flex items-center gap-1.5 ${
            activeTab === 'performance'
              ? 'bg-[#1F5A2E] text-white shadow-[2px_2px_0px_#1A1209]'
              : 'bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-[#D4C7B5]'
          }`}
        >
          <BarChart2 className="w-3.5 h-3.5" /> ACADEMIC PERFORMANCE
        </button>

        <button
          onClick={() => setActiveTab('portfolio')}
          className={`neo-btn px-3.5 py-2 text-xs flex items-center gap-1.5 ${
            activeTab === 'portfolio'
              ? 'bg-[#6B46C1] text-white shadow-[2px_2px_0px_#1A1209]'
              : 'bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-[#D4C7B5]'
          }`}
        >
          <Award className="w-3.5 h-3.5 text-purple-300" /> ACADEMIC PORTFOLIO
        </button>

        <button
          onClick={() => setActiveTab('electives')}
          className={`neo-btn px-3.5 py-2 text-xs flex items-center gap-1.5 ${
            activeTab === 'electives'
              ? 'bg-[#1A365D] text-white shadow-[2px_2px_0px_#1A1209]'
              : 'bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-[#D4C7B5]'
          }`}
        >
          <Share2 className="w-3.5 h-3.5" /> OPEN ELECTIVES
        </button>

        <button
          onClick={() => setActiveTab('promotion')}
          className={`neo-btn px-3.5 py-2 text-xs flex items-center gap-1.5 ${
            activeTab === 'promotion'
              ? 'bg-[#B84915] text-white shadow-[2px_2px_0px_#1A1209]'
              : 'bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-[#D4C7B5]'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" /> PROMOTION
        </button>
      </div>

      {/* ---------------------------------------------------- */}
      {/* TAB 1: OVERVIEW & MANUSCRIPTS */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* ROLE-BASED ACADEMIC WORKSPACE FOLDERS */}
          <StudentAcademicFolderWorkspace
            workspace={workspaceFolders}
            loading={loading}
            onRefresh={loadStudentData}
            onOpenEditor={onOpenEditor}
            onStartTask={handleStartTaskWriteUp}
            showToast={showToast}
          />

          {/* Summary KPIs */}
          {analytics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="bg-white dark:bg-[#1D1814] p-4 border-2 border-[#1A1209] shadow-[3.5px_3.5px_0px_#1A1209]">
                <span className="text-[10px] font-bold uppercase text-[#786958]">Draft Manuscripts</span>
                <span className="text-2xl font-black text-[#1A1209] dark:text-white mt-1 block">
                  {analytics.summary?.draft_count || 0}
                </span>
              </div>

              <div className="bg-white dark:bg-[#1D1814] p-4 border-2 border-[#1A1209] shadow-[3.5px_3.5px_0px_#1A1209]">
                <span className="text-[10px] font-bold uppercase text-[#B84915]">Pending Faculty Review</span>
                <span className="text-2xl font-black text-[#B84915] mt-1 block">
                  {analytics.summary?.submitted_count || 0}
                </span>
              </div>

              <div className="bg-white dark:bg-[#1D1814] p-4 border-2 border-[#1A1209] shadow-[3.5px_3.5px_0px_#1A1209]">
                <span className="text-[10px] font-bold uppercase text-[#1F5A2E]">Graded & Signed</span>
                <span className="text-2xl font-black text-[#1F5A2E] dark:text-[#48BB78] mt-1 block">
                  {analytics.summary?.graded_count || 0}
                </span>
              </div>

              <div className="bg-white dark:bg-[#1D1814] p-4 border-2 border-[#1A1209] shadow-[3.5px_3.5px_0px_#1A1209]">
                <span className="text-[10px] font-bold uppercase text-[#1A365D]">Assignment Average</span>
                <span className="text-2xl font-black text-[#1A365D] dark:text-[#63B3ED] mt-1 block">
                  {analytics.averages?.assignment_avg ? `${analytics.averages.assignment_avg}/10` : '9.5/10'}
                </span>
              </div>
            </div>
          )}

          {/* Quick Tasks Alert */}
          <div className="p-4 bg-[#FFFAF1] dark:bg-[#231C17] border-2 border-[#1A1209] shadow-[3px_3px_0px_#1A1209] flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#B84915] block">
                ACTIVE ACADEMIC ASSESSMENT WORKFLOWS
              </span>
              <p className="text-xs text-[#1A1209] dark:text-[#D4C7B5] mt-0.5">
                You have <strong>{tasks.length} total active tasks</strong> across Theory Assignments ({assignmentTasks.length}), Lab Experiments ({experimentTasks.length}), and Special Submissions ({specialTasks.length}).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('assignments')}
                className="px-3 py-1.5 bg-[#B84915] text-white font-bold text-[10px] border border-[#1A1209]"
              >
                VIEW ASSIGNMENTS &rarr;
              </button>
              <button
                onClick={() => setActiveTab('experiments')}
                className="px-3 py-1.5 bg-[#1F5A2E] text-white font-bold text-[10px] border border-[#1A1209]"
              >
                VIEW LAB EXPERIMENTS &rarr;
              </button>
            </div>
          </div>

          {/* Documents Table */}
          <div className="bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[4px_4px_0px_#1A1209] overflow-x-auto">
            <div className="p-3 bg-[#FAF6EE] dark:bg-[#26201B] border-b-2 border-[#1A1209] flex items-center justify-between">
              <span className="font-bold text-xs uppercase text-[#1A1209] dark:text-white flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#1A365D]" /> All Authored Manuscripts & Working Drafts
              </span>
              <span className="text-[10px] text-[#786958]">Total: {documents.length}</span>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F4EFE6] dark:bg-[#26201B] border-b-2 border-[#1A1209] uppercase text-[10px]">
                <tr>
                  <th className="p-3">Title / Objective</th>
                  <th className="p-3">Subject</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Word Count</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0D8C8] dark:divide-[#332A24]">
                {documents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-[#786958]">
                      No documents created yet. Click 'NEW ACADEMIC MANUSCRIPT' to start authoring.
                    </td>
                  </tr>
                ) : (
                  documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-[#FAF6EE] dark:hover:bg-[#231C17]">
                      <td className="p-3">
                        <span className="font-bold text-[#1A1209] dark:text-white block">{doc.title}</span>
                        {doc.submission_code && (
                          <span className="text-[10px] text-[#B84915] font-bold">{doc.submission_code}</span>
                        )}
                      </td>
                      <td className="p-3 text-[#786958]">{doc.subject_name}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 bg-[#E8EFF8] text-[#1A365D] border border-[#1A365D] text-[10px]">
                          {doc.doc_type} #{doc.doc_number}
                        </span>
                      </td>
                      <td className="p-3">{doc.word_count || 180} words</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 text-[9px] uppercase font-bold border ${
                            doc.status === 'graded'
                              ? 'bg-[#EBF8EE] text-[#1F5A2E] border-[#1F5A2E]'
                              : doc.status === 'submitted'
                              ? 'bg-[#FFF8E7] text-[#B84915] border-[#B84915]'
                              : 'bg-white text-gray-700 border-gray-400'
                          }`}
                        >
                          {doc.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenDocument(doc)}
                            className="px-2 py-1 bg-[#1A365D] text-white text-[10px] hover:bg-[#12243F] flex items-center gap-1"
                          >
                            <Edit3 className="w-3 h-3" /> {doc.status === 'draft' ? 'EDIT' : 'VIEW'}
                          </button>

                          <button
                            onClick={() => handleDuplicate(doc.id)}
                            className="px-2 py-1 bg-[#FAF6EE] text-[#1A1209] text-[10px] hover:bg-[#E0D8C8] border border-[#1A1209] flex items-center gap-1"
                            title="Duplicate as new draft"
                          >
                            <Copy className="w-3 h-3" />
                          </button>

                          {doc.status === 'draft' && (
                            <button
                              onClick={() => handleDeleteDraft(doc.id)}
                              className="px-2 py-1 bg-[#FFF5F5] text-[#8B1A1A] text-[10px] hover:bg-[#FDE8E8] border border-[#8B1A1A]"
                              title="Delete draft"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}

                          {doc.status === 'graded' && (
                            <button
                              onClick={async () => {
                                try {
                                  showToast('Downloading authenticated PDF copy...', 'info');
                                  await api.exports.downloadPdf(doc.id, doc.title);
                                  showToast('PDF downloaded successfully.', 'success');
                                } catch (err: any) {
                                  showToast(err.message || 'Failed to download PDF', 'error');
                                }
                              }}
                              className="px-2 py-1 bg-[#1F5A2E] text-white text-[10px] hover:bg-[#164422] flex items-center gap-1"
                              title="Download official PDF record with digital stamp"
                            >
                              <Download className="w-3 h-3" /> PDF
                            </button>
                          )}
                        </div>
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
      {/* TAB 2: ENROLLED SUBJECTS */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'subjects' && (
        <div className="space-y-4">
          <div className="p-4 bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[3.5px_3.5px_0px_#1A1209]">
            <h3 className="text-base font-black text-[#1A1209] dark:text-white uppercase flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#1A365D]" /> Enrolled Academic Courses (Mumbai University Rev-2019 'C' Scheme)
            </h3>
            <p className="text-xs text-[#786958] mt-0.5">
              Official compulsory and elective courses allotted to your academic group ({profile.branch_code} Semester {profile.semester_number} {profile.division_name}).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {enrolledSubjects.map((sub) => (
              <div
                key={sub.id}
                className="p-4 bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[3px_3px_0px_#1A1209] space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#B84915] text-xs">{sub.code}</span>
                  <span className="px-2 py-0.5 bg-[#E8EFF8] text-[#1A365D] border border-[#1A365D] text-[9px] uppercase font-bold">
                    {sub.category || 'Core'}
                  </span>
                </div>
                <h4 className="font-bold text-sm text-[#1A1209] dark:text-white">{sub.name}</h4>
                <div className="flex items-center justify-between text-[11px] pt-2 border-t border-[#E0D8C8]">
                  <span className="text-[#1F5A2E] font-bold">{sub.credits} {sub.credits === 1 ? 'Credit' : 'Credits'}</span>
                  <span className="text-[#786958]">{sub.subject_type || 'Theory'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 3: ASSIGNMENTS (STANDARD ASSIGNMENTS) */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'assignments' && (
        <div className="space-y-4">
          <div className="p-4 bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[3.5px_3.5px_0px_#1A1209] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-[#1A1209] dark:text-white uppercase flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-[#B84915]" /> Theory Assignments (Max 10 Marks Standard Rubric)
                </h3>
                <p className="text-xs text-[#786958] mt-0.5">
                  Curriculum-aligned write-up assignments evaluated against Knowledge (4), Content (3), and Punctuality (3).
                </p>
              </div>

              {/* Search & Filter Bar */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#786958]" />
                  <input
                    type="text"
                    placeholder="Search assignments..."
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-[#FFFAF1] dark:bg-[#26201B] border border-[#1A1209] text-xs font-mono"
                  />
                </div>

                <select
                  value={taskStatusFilter}
                  onChange={(e) => setTaskStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-[#FFFAF1] dark:bg-[#26201B] border border-[#1A1209] text-xs font-mono font-bold"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="OPEN">Open / Upcoming</option>
                  <option value="SUBMITTED">Submitted</option>
                  <option value="EVALUATED">Evaluated</option>
                  <option value="MISSING">Missing / Overdue</option>
                </select>
              </div>
            </div>
          </div>

          {filterTaskList(assignmentTasks).length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] text-[#786958]">
              No assignments matching filter criteria.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filterTaskList(assignmentTasks).map((task) => {
                const statusBadge = getTaskStatus(task);
                return (
                  <div
                    key={task.id}
                    className="p-5 bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[3.5px_3.5px_0px_#1A1209] space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[#B84915] text-xs">
                          {task.subject_code} • Assignment #{task.task_number}
                        </span>
                        <span className={`px-2 py-0.5 text-[9px] font-bold border ${statusBadge.color}`}>
                          {statusBadge.label}
                        </span>
                      </div>

                      <h4 className="text-sm font-black text-[#1A1209] dark:text-white">{task.title}</h4>
                      <p className="text-[11px] text-[#5C4D3C] dark:text-[#A89886] line-clamp-2">
                        {task.description || 'Complete the assignment write-up as instructed by the faculty course coordinator.'}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-[#E0D8C8] dark:border-[#332A24] space-y-2">
                      <div className="flex items-center justify-between text-[10px] text-[#786958]">
                        <span>Due: <strong>{task.due_date || 'Standard Academic Cycle'}</strong></span>
                        <span className="font-bold text-[#1A1209] dark:text-white">Max: {task.max_marks || 10} M</span>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <button
                          onClick={() => setSelectedTask(task)}
                          className="px-2.5 py-1.5 bg-[#FAF6EE] dark:bg-[#26201B] hover:bg-[#E0D8C8] text-[#1A1209] dark:text-white text-[10px] font-bold border border-[#1A1209] flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" /> DETAILS
                        </button>

                        <button
                          onClick={() => handleStartTaskWriteUp(task)}
                          className="px-3 py-1.5 bg-[#B84915] hover:bg-[#963A0F] text-white font-bold text-[10px] flex items-center gap-1 border border-[#1A1209]"
                        >
                          {task.student_doc_id ? 'OPEN WRITE-UP' : 'START WRITE-UP'} &rarr;
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 4: EXPERIMENTS (LABORATORY PRACTICALS) */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'experiments' && (
        <div className="space-y-4">
          <div className="p-4 bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[3.5px_3.5px_0px_#1A1209] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-[#1F5A2E] uppercase flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#1F5A2E]" /> Laboratory Experiments (Max 15 Marks Lab Rubric)
                </h3>
                <p className="text-xs text-[#786958] mt-0.5">
                  Hands-on practical experiments with batch targeting, evaluated against Knowledge (4), Performance (5), Content (3), and Punctuality (3).
                </p>
              </div>

              {/* Search & Filter Bar */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#786958]" />
                  <input
                    type="text"
                    placeholder="Search experiments..."
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-[#FFFAF1] dark:bg-[#26201B] border border-[#1A1209] text-xs font-mono"
                  />
                </div>

                <select
                  value={taskStatusFilter}
                  onChange={(e) => setTaskStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-[#FFFAF1] dark:bg-[#26201B] border border-[#1A1209] text-xs font-mono font-bold"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="OPEN">Open / Upcoming</option>
                  <option value="SUBMITTED">Submitted</option>
                  <option value="EVALUATED">Evaluated</option>
                  <option value="MISSING">Missing / Overdue</option>
                </select>
              </div>
            </div>
          </div>

          {filterTaskList(experimentTasks).length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] text-[#786958]">
              No laboratory experiments allocated for your current batch.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filterTaskList(experimentTasks).map((task) => {
                const statusBadge = getTaskStatus(task);
                return (
                  <div
                    key={task.id}
                    className="p-5 bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[3.5px_3.5px_0px_#1A1209] space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[#1F5A2E] text-xs">
                          {task.subject_code} • Experiment #{task.task_number}
                        </span>
                        <span className={`px-2 py-0.5 text-[9px] font-bold border ${statusBadge.color}`}>
                          {statusBadge.label}
                        </span>
                      </div>

                      <h4 className="text-sm font-black text-[#1A1209] dark:text-white">{task.title}</h4>
                      <p className="text-[11px] text-[#5C4D3C] dark:text-[#A89886] line-clamp-2">
                        {task.description || 'Perform the laboratory experiment, document apparatus, procedure, observation table, and conclusions.'}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-[#E0D8C8] dark:border-[#332A24] space-y-2">
                      <div className="flex items-center justify-between text-[10px] text-[#786958]">
                        <span>Batch: <strong>{task.batch_name || 'All Batches'}</strong></span>
                        <span>Due: <strong>{task.due_date || 'Lab Schedule'}</strong></span>
                        <span className="font-bold text-[#1F5A2E]">Max: {task.max_marks || 15} M</span>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <button
                          onClick={() => setSelectedTask(task)}
                          className="px-2.5 py-1.5 bg-[#FAF6EE] dark:bg-[#26201B] hover:bg-[#E0D8C8] text-[#1A1209] dark:text-white text-[10px] font-bold border border-[#1A1209] flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" /> OBJECTIVE & RUBRIC
                        </button>

                        <button
                          onClick={() => handleStartTaskWriteUp(task)}
                          className="px-3 py-1.5 bg-[#1F5A2E] hover:bg-[#164422] text-white font-bold text-[10px] flex items-center gap-1 border border-[#1A1209]"
                        >
                          {task.student_doc_id ? 'OPEN WRITE-UP' : 'START WRITE-UP'} &rarr;
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 5: SPECIAL DOCUMENTS (PROJECTS, PAPERS, INTERNSHIPS) */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'special_documents' && (
        <div className="space-y-4">
          <div className="p-4 bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[3.5px_3.5px_0px_#1A1209] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-[#6B46C1] uppercase flex items-center gap-2">
                  <Award className="w-4 h-4 text-[#6B46C1]" /> Special Document Submissions & Capstone Rubrics
                </h3>
                <p className="text-xs text-[#786958] mt-0.5">
                  Mini Project, Major Project, Internship, Research Paper, and Seminar submissions evaluated against dedicated institutional custom rubrics.
                </p>
              </div>

              {/* Search & Filter Bar */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#786958]" />
                  <input
                    type="text"
                    placeholder="Search special documents..."
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-[#FFFAF1] dark:bg-[#26201B] border border-[#1A1209] text-xs font-mono"
                  />
                </div>

                <select
                  value={taskStatusFilter}
                  onChange={(e) => setTaskStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-[#FFFAF1] dark:bg-[#26201B] border border-[#1A1209] text-xs font-mono font-bold"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="OPEN">Open / Upcoming</option>
                  <option value="SUBMITTED">Submitted</option>
                  <option value="EVALUATED">Evaluated</option>
                  <option value="MISSING">Missing / Overdue</option>
                </select>
              </div>
            </div>
          </div>

          {filterTaskList(specialTasks).length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] text-[#786958]">
              No special documents or capstone projects assigned currently.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filterTaskList(specialTasks).map((task) => {
                const statusBadge = getTaskStatus(task);
                const rubricCriteriaCount = task.rubric ? task.rubric.length : 0;
                return (
                  <div
                    key={task.id}
                    className="p-5 bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[3.5px_3.5px_0px_#1A1209] space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[#6B46C1] text-xs">
                          {task.subject_code} • {task.title}
                        </span>
                        <span className={`px-2 py-0.5 text-[9px] font-bold border ${statusBadge.color}`}>
                          {statusBadge.label}
                        </span>
                      </div>

                      <h4 className="text-sm font-black text-[#1A1209] dark:text-white">{task.title}</h4>
                      <p className="text-[11px] text-[#5C4D3C] dark:text-[#A89886] line-clamp-2">
                        {task.description || 'Submit comprehensive institutional dossier, project documentation, literature survey, and methodology.'}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-[#E0D8C8] dark:border-[#332A24] space-y-2">
                      <div className="flex items-center justify-between text-[10px] text-[#786958]">
                        <span>Rubric: <strong>{rubricCriteriaCount} Custom Criteria</strong></span>
                        <span>Due: <strong>{task.due_date || 'Term End'}</strong></span>
                        <span className="font-bold text-[#6B46C1]">Max: {task.max_marks} M</span>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <button
                          onClick={() => setSelectedTask(task)}
                          className="px-2.5 py-1.5 bg-[#FAF6EE] dark:bg-[#26201B] hover:bg-[#E0D8C8] text-[#1A1209] dark:text-white text-[10px] font-bold border border-[#1A1209] flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" /> CUSTOM RUBRIC
                        </button>

                        <button
                          onClick={() => handleStartTaskWriteUp(task)}
                          className="px-3 py-1.5 bg-[#6B46C1] hover:bg-[#553C9A] text-white font-bold text-[10px] flex items-center gap-1 border border-[#1A1209]"
                        >
                          {task.student_doc_id ? 'OPEN DOSSIER' : 'AUTHOR DOSSIER'} &rarr;
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 6: MY SUBMISSIONS & EVALUATED DOSSIERS */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'submissions' && (
        <div className="space-y-4">
          <div className="p-4 bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[3.5px_3.5px_0px_#1A1209]">
            <h3 className="text-base font-black text-[#1A365D] uppercase flex items-center gap-2">
              <Clock className="w-4 h-4" /> My Submissions, Digital Approvals & Official Records
            </h3>
            <p className="text-xs text-[#786958] mt-0.5">
              Immutable institutional submission log. Evaluated manuscripts include verified faculty digital signatures, awarded rubrics, and downloadable official PDFs.
            </p>
          </div>

          <div className="bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[4px_4px_0px_#1A1209] overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F4EFE6] dark:bg-[#26201B] border-b-2 border-[#1A1209] uppercase text-[10px]">
                <tr>
                  <th className="p-3">Submission Code</th>
                  <th className="p-3">Title / Subject</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Punctuality / Delay</th>
                  <th className="p-3">Awarded Marks</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Official Copy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0D8C8] dark:divide-[#332A24]">
                {submittedDocs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-[#786958]">
                      No final submissions made yet. Complete and submit write-ups to view evaluated records.
                    </td>
                  </tr>
                ) : (
                  submittedDocs.map((doc) => (
                    <tr key={doc.id} className="hover:bg-[#FAF6EE] dark:hover:bg-[#231C17]">
                      <td className="p-3 font-bold text-[#B84915]">
                        {doc.submission_code || 'SUB-2026-RECORD'}
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-[#1A1209] dark:text-white block">{doc.title}</span>
                        <span className="text-[10px] text-[#786958]">{doc.subject_name} ({doc.subject_code})</span>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 bg-[#FAF6EE] text-[#1A1209] border border-[#1A1209] text-[10px]">
                          {doc.doc_type} #{doc.doc_number}
                        </span>
                      </td>
                      <td className="p-3">
                        {doc.is_late ? (
                          <span className="text-[#8B1A1A] font-bold text-[10px]">
                            Late: {doc.delay_text || 'Submitted after deadline'}
                          </span>
                        ) : (
                          <span className="text-[#1F5A2E] font-bold text-[10px]">
                            On-Time Submission
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {doc.status === 'graded' ? (
                          <span className="text-sm font-black text-[#1F5A2E]">
                            {doc.total_marks ?? '-'} / {doc.doc_type === 'Experiment' ? 15 : 10} M
                          </span>
                        ) : (
                          <span className="text-[#786958] text-[10px]">Pending Evaluation</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 text-[9px] uppercase font-bold border ${
                            doc.status === 'graded'
                              ? 'bg-[#EBF8EE] text-[#1F5A2E] border-[#1F5A2E]'
                              : 'bg-[#FFF8E7] text-[#B84915] border-[#B84915]'
                          }`}
                        >
                          {doc.status === 'graded' ? 'DIGITALLY APPROVED' : 'UNDER FACULTY REVIEW'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenDocument(doc)}
                            className="px-2.5 py-1 bg-[#1A365D] text-white text-[10px] hover:bg-[#12243F] flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" /> DOSSIER
                          </button>

                          {doc.status === 'graded' && (
                            <button
                              onClick={async () => {
                                try {
                                  showToast('Downloading authenticated PDF copy...', 'info');
                                  await api.exports.downloadPdf(doc.id, doc.title);
                                  showToast('PDF downloaded successfully.', 'success');
                                } catch (err: any) {
                                  showToast(err.message || 'Failed to download PDF', 'error');
                                }
                              }}
                              className="px-2.5 py-1 bg-[#1F5A2E] text-white text-[10px] hover:bg-[#164422] flex items-center gap-1"
                              title="Download official PDF record with digital stamp"
                            >
                              <Download className="w-3 h-3" /> PDF
                            </button>
                          )}
                        </div>
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
      {/* TAB 7: CALENDAR & DEADLINES */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'calendar' && (
        <CalendarView role="student" />
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 8: SUBJECT-WISE ACADEMIC PERFORMANCE (MARKS BASED) */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'performance' && (
        <SubjectPerformanceView />
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 9: STUDENT ACADEMIC PORTFOLIO */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'portfolio' && (
        <PortfolioView />
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 10: OPEN ELECTIVE SELECTION */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'electives' && (
        <div className="space-y-4">
          <div className="p-4 bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[3.5px_3.5px_0px_#1A1209]">
            <h3 className="text-base font-black text-[#1A365D] uppercase flex items-center gap-2">
              <Share2 className="w-4 h-4" /> Open Elective Selection Portal (BE Final Year)
            </h3>
            <p className="text-xs text-[#786958] mt-0.5">
              Register preferences for multidisciplinary open electives. Enrollments are subject to capacity constraints and faculty approval.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableElectives.map((ec) => (
              <div
                key={ec.id}
                className="p-5 bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[3.5px_3.5px_0px_#1A1209] space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[#B84915]">{ec.subject_code}</span>
                  <span className="text-[10px] text-[#786958] font-bold">
                    Capacity: {ec.enrolled_count}/{ec.max_capacity}
                  </span>
                </div>
                <h4 className="font-black text-sm text-[#1A1209] dark:text-white">{ec.subject_name}</h4>
                <p className="text-[11px] text-[#786958]">Credits: {ec.credits} • Faculty: Prof. Elizabeth Smith</p>
                <button
                  onClick={() => handleSelectElective(ec.id, ec.subject_id)}
                  className="neo-btn w-full mt-2 py-2 bg-[#1A365D] text-white hover:bg-[#12243F] font-bold text-[10px]"
                >
                  SELECT THIS ELECTIVE
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 11: ACADEMIC PROMOTION */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'promotion' && (
        <StudentPromotionView />
      )}

      {/* ---------------------------------------------------- */}
      {/* TASK DETAIL & RUBRIC BREAKDOWN MODAL */}
      {/* ---------------------------------------------------- */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-mono text-xs animate-in fade-in duration-150">
          <div className="bg-[#FAF6EE] dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[8px_8px_0px_#1A1209] max-w-2xl w-full max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-4 bg-[#1A365D] text-white border-b-2 border-[#1A1209] flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#F4EFE6] opacity-80 block">
                  TASK SPECIFICATION // {selectedTask.task_type?.toUpperCase()} #{selectedTask.task_number}
                </span>
                <h3 className="text-base font-black tracking-tight">{selectedTask.title}</h3>
              </div>
              <button
                onClick={() => setSelectedTask(null)}
                className="text-white hover:text-white/70 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              {/* Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="p-2.5 bg-white dark:bg-[#231C17] border border-[#1A1209]">
                  <span className="text-[9px] uppercase text-[#786958] block">Subject</span>
                  <span className="font-bold text-xs text-[#1A1209] dark:text-white truncate block">
                    {selectedTask.subject_code}
                  </span>
                </div>
                <div className="p-2.5 bg-white dark:bg-[#231C17] border border-[#1A1209]">
                  <span className="text-[9px] uppercase text-[#786958] block">Target</span>
                  <span className="font-bold text-xs text-[#1A1209] dark:text-white truncate block">
                    {selectedTask.batch_name ? selectedTask.batch_name : selectedTask.division_name || 'All'}
                  </span>
                </div>
                <div className="p-2.5 bg-white dark:bg-[#231C17] border border-[#1A1209]">
                  <span className="text-[9px] uppercase text-[#786958] block">Max Marks</span>
                  <span className="font-bold text-xs text-[#B84915] block">
                    {selectedTask.max_marks} M
                  </span>
                </div>
                <div className="p-2.5 bg-white dark:bg-[#231C17] border border-[#1A1209]">
                  <span className="text-[9px] uppercase text-[#786958] block">Submission Due</span>
                  <span className="font-bold text-xs text-[#1F5A2E] block">
                    {selectedTask.due_date || 'Standard Cycle'}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div className="p-4 bg-white dark:bg-[#231C17] border border-[#1A1209] space-y-1">
                <span className="text-[10px] font-bold uppercase text-[#786958] block">
                  Problem Statement & Objectives:
                </span>
                <p className="text-xs text-[#1A1209] dark:text-[#D4C7B5] leading-relaxed">
                  {selectedTask.description || 'Follow all prescribed guidelines for documentation, code formatting, calculations, and analytical conclusions.'}
                </p>
              </div>

              {/* Rubric Criteria Matrix */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#1A1209] dark:text-white block">
                  Evaluation Rubric Criteria Matrix:
                </span>
                <div className="border border-[#1A1209] bg-white dark:bg-[#231C17] overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF6EE] dark:bg-[#1D1814] border-b border-[#1A1209] uppercase text-[10px]">
                      <tr>
                        <th className="p-2">Criterion</th>
                        <th className="p-2">Evaluation Guidance</th>
                        <th className="p-2 text-right">Max Marks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E0D8C8] dark:divide-[#332A24]">
                      {selectedTask.rubric && selectedTask.rubric.length > 0 ? (
                        selectedTask.rubric.map((crit: any, idx: number) => {
                          const critName = crit.criteria || crit.name || crit.title || `Criterion ${idx + 1}`;
                          const critGuidance = crit.guidance || crit.description || 'Institutional assessment criterion';
                          const critMax = crit.max ?? crit.max_score ?? crit.max_marks ?? '-';
                          return (
                            <tr key={idx}>
                              <td className="p-2 font-bold text-[#1A1209] dark:text-white">{critName}</td>
                              <td className="p-2 text-[#5C4D3C] dark:text-[#A89886]">{critGuidance}</td>
                              <td className="p-2 text-right font-bold text-[#B84915]">{critMax} M</td>
                            </tr>
                          );
                        })
                      ) : selectedTask.task_type === 'Experiment' ? (
                        <>
                          <tr>
                            <td className="p-2 font-bold">1. Knowledge & Conceptual Theory</td>
                            <td className="p-2 text-[#5C4D3C] dark:text-[#A89886]">Understanding of experimental principles and underlying theory</td>
                            <td className="p-2 text-right font-bold text-[#B84915]">4.0 M</td>
                          </tr>
                          <tr>
                            <td className="p-2 font-bold">2. Practical Execution & Performance</td>
                            <td className="p-2 text-[#5C4D3C] dark:text-[#A89886]">Setup, testing, algorithm execution, and valid test cases</td>
                            <td className="p-2 text-right font-bold text-[#B84915]">5.0 M</td>
                          </tr>
                          <tr>
                            <td className="p-2 font-bold">3. Content Structure & Neatness</td>
                            <td className="p-2 text-[#5C4D3C] dark:text-[#A89886]">Diagrams, observations, charts, and analysis format</td>
                            <td className="p-2 text-right font-bold text-[#B84915]">3.0 M</td>
                          </tr>
                          <tr>
                            <td className="p-2 font-bold">4. Academic Punctuality</td>
                            <td className="p-2 text-[#5C4D3C] dark:text-[#A89886]">Adherence to lab batch deadline and protocol</td>
                            <td className="p-2 text-right font-bold text-[#B84915]">3.0 M</td>
                          </tr>
                        </>
                      ) : (
                        <>
                          <tr>
                            <td className="p-2 font-bold">1. Knowledge & Conceptual Theory</td>
                            <td className="p-2 text-[#5C4D3C] dark:text-[#A89886]">Depth of conceptual theory and academic grounding</td>
                            <td className="p-2 text-right font-bold text-[#B84915]">4.0 M</td>
                          </tr>
                          <tr>
                            <td className="p-2 font-bold">2. Content Structure & Neatness</td>
                            <td className="p-2 text-[#5C4D3C] dark:text-[#A89886]">Logical progression, clarity of presentation, and technical precision</td>
                            <td className="p-2 text-right font-bold text-[#B84915]">3.0 M</td>
                          </tr>
                          <tr>
                            <td className="p-2 font-bold">3. Academic Punctuality</td>
                            <td className="p-2 text-[#5C4D3C] dark:text-[#A89886]">Submission within scheduled academic deadline window</td>
                            <td className="p-2 text-right font-bold text-[#B84915]">3.0 M</td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Status Box */}
              <div className="p-3 bg-[#FAF6EE] dark:bg-[#1D1814] border border-[#1A1209] flex items-center justify-between">
                <div>
                  <span className="text-[9px] uppercase text-[#786958] block">Current Progress Status</span>
                  <span className="font-bold text-xs text-[#1A1209] dark:text-white">
                    {selectedTask.student_doc_status === 'graded'
                      ? `Evaluated: ${selectedTask.student_marks_awarded} / ${selectedTask.max_marks} Marks Awarded`
                      : selectedTask.student_doc_status === 'submitted'
                      ? `Submitted: Under Faculty Review (${selectedTask.student_submission_code || 'Recorded'})`
                      : selectedTask.student_doc_id
                      ? 'Draft Manuscript in Progress'
                      : 'Not Started'}
                  </span>
                </div>

                {selectedTask.late_cutoff_date && (
                  <span className="text-[10px] text-[#8B1A1A]">
                    Late Cutoff: <strong>{selectedTask.late_cutoff_date}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 bg-[#FAF6EE] dark:bg-[#26201B] border-t-2 border-[#1A1209] flex items-center justify-end gap-3">
              <button
                onClick={() => setSelectedTask(null)}
                className="px-4 py-2 bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-white font-bold text-xs border border-[#1A1209]"
              >
                CLOSE
              </button>

              <button
                onClick={() => {
                  const taskToOpen = selectedTask;
                  setSelectedTask(null);
                  handleStartTaskWriteUp(taskToOpen);
                }}
                className="px-5 py-2 bg-[#B84915] hover:bg-[#963A0F] text-white font-bold text-xs border border-[#1A1209] shadow-[2px_2px_0px_#1A1209]"
              >
                {selectedTask.student_doc_id ? 'OPEN IN AUTHORING WORKSPACE' : 'START WRITE-UP NOW'} &rarr;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SPECIAL DOCUMENT FLEXIBLE SUBMISSION PORTAL */}
      {specialSubTask && (
        <SpecialDocumentSubmissionModal
          task={specialSubTask}
          existingDocId={specialDocId}
          onClose={() => {
            setSpecialSubTask(null);
            setSpecialDocId(null);
          }}
          onSubmitted={() => {
            setSpecialSubTask(null);
            setSpecialDocId(null);
            loadStudentData();
          }}
          showToast={showToast}
        />
      )}
    </div>
  );
};
