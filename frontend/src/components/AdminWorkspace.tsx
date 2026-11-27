import React, { useState, useEffect } from 'react';
import {
  Users, ShieldAlert, GraduationCap, FileCheck, Download, Check, X,
  AlertTriangle, Filter, Search, RotateCcw, Ban, CheckCircle, RefreshCw,
  Calendar, BookOpen, Layers, UserCheck, Plus, ArrowRight, Share2, Copy,
  CheckSquare, UserMinus, UserPlus, Folder
} from 'lucide-react';
import { api } from '../lib/api';
import {
  StudentProfile, IntegrityEvent, User, AcademicCalendar, Subject,
  CurriculumVersion, SubjectAllotment, LabBatch, OpenElectiveConfig,
  OpenElectiveSelection, PromotionWindow, PromotionRequest
} from '../types';
import { AdminAcademicClassesWorkspace } from './AdminAcademicClassesWorkspace';
import { AdminPromotionManagement } from './AdminPromotionManagement';

interface AdminWorkspaceProps {
  currentUser: User;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  activeTab?: string;
  setActiveTab?: (tab: any) => void;
}

export const AdminWorkspace: React.FC<AdminWorkspaceProps> = ({
  currentUser,
  showToast,
  activeTab: propActiveTab,
  setActiveTab: propSetActiveTab,
}) => {
  const [internalTab, setInternalTab] = useState<
    'academic_classes' | 'registrations' | 'academic_structure' | 'allotment_wizard' | 'batches' | 'electives' | 'promotions' | 'integrity' | 'ledger'
  >('academic_classes');

  const activeTab = (propActiveTab as any) || internalTab;
  const setActiveTab = (tab: any) => {
    setInternalTab(tab);
    if (propSetActiveTab) {
      propSetActiveTab(tab);
    }
  };

  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // 1. Registrations State
  const [profiles, setProfiles] = useState<StudentProfile[]>([]);
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [yearFilter, setYearFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // 2. Academic Structure State
  const [academicYears, setAcademicYears] = useState<AcademicCalendar[]>([]);
  const [curricula, setCurricula] = useState<CurriculumVersion[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectBranch, setSubjectBranch] = useState('CE');
  const [subjectSem, setSubjectSem] = useState<number>(3);
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneSourceYear, setCloneSourceYear] = useState('2026-27');
  const [cloneTargetYear, setCloneTargetYear] = useState('2027-28');
  const [cloneBranch, setCloneBranch] = useState('CE');

  // New Subject Form
  const [newSubName, setNewSubName] = useState('');
  const [newSubCode, setNewSubCode] = useState('');
  const [newSubBranch, setNewSubBranch] = useState('CE');
  const [newSubSem, setNewSubSem] = useState(3);
  const [newSubCredits, setNewSubCredits] = useState(3.0);
  const [newSubCategory, setNewSubCategory] = useState('Core');
  const [newSubType, setNewSubType] = useState('Theory');

  // 3. Allotment Wizard State (10-Step Wizard)
  const [allotYear, setAllotYear] = useState('2026-27');
  const [allotBranch, setAllotBranch] = useState('CE');
  const [allotYearLevel, setAllotYearLevel] = useState('SE');
  const [allotSem, setAllotSem] = useState(3);
  const [allotDiv, setAllotDiv] = useState('Div A');
  const [previewData, setPreviewData] = useState<any>(null);
  const [selectedFacultyMap, setSelectedFacultyMap] = useState<Record<string, string>>({});
  const [publishedAllotments, setPublishedAllotments] = useState<SubjectAllotment[]>([]);

  // 4. Laboratory Batches & Allocation Matrix State
  const [batches, setBatches] = useState<LabBatch[]>([]);
  const [batchBranch, setBatchBranch] = useState('CE');
  const [batchDiv, setBatchDiv] = useState('Div A');
  const [batchYearLevel, setBatchYearLevel] = useState('SE');
  const [batchSem, setBatchSem] = useState(3);
  const [batchSubjectId, setBatchSubjectId] = useState('');
  const [matrixData, setMatrixData] = useState<any>(null);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [targetBatchId, setTargetBatchId] = useState('');
  const [showCreateBatchModal, setShowCreateBatchModal] = useState(false);
  const [newBatchName, setNewBatchName] = useState('Batch A1');
  const [newBatchCapacity, setNewBatchCapacity] = useState(20);

  // 5. Open Electives State
  const [electiveConfigs, setElectiveConfigs] = useState<OpenElectiveConfig[]>([]);
  const [electiveSelections, setElectiveSelections] = useState<OpenElectiveSelection[]>([]);

  // 6. Promotion Windows & Requests State
  const [promotionWindows, setPromotionWindows] = useState<PromotionWindow[]>([]);
  const [promotionRequests, setPromotionRequests] = useState<PromotionRequest[]>([]);
  const [showNewWindowModal, setShowNewWindowModal] = useState(false);
  const [newWinTitle, setNewWinTitle] = useState('SE to TE Academic Promotion');
  const [newWinSrcYear, setNewWinSrcYear] = useState('2026-27');
  const [newWinTgtYear, setNewWinTgtYear] = useState('2027-28');
  const [newWinSrcLevel, setNewWinSrcLevel] = useState('SE');
  const [newWinTgtLevel, setNewWinTgtLevel] = useState('TE');
  const [newWinSrcSem, setNewWinSrcSem] = useState(3);
  const [newWinTgtSem, setNewWinTgtSem] = useState(5);
  const [newWinBranch, setNewWinBranch] = useState('CE');

  // 7. Integrity Telemetry State
  const [integrityEvents, setIntegrityEvents] = useState<IntegrityEvent[]>([]);

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    if (activeTab === 'batches') {
      loadBatchAllocationMatrix();
    }
  }, [activeTab, batchBranch, batchDiv, batchYearLevel, batchSem, batchSubjectId]);

  const loadBatchAllocationMatrix = async () => {
    try {
      setMatrixLoading(true);
      const res = await api.academic.getBatchAllocationMatrix({
        branch: batchBranch,
        branch_code: batchBranch,
        division: batchDiv,
        division_name: batchDiv,
        academic_year: '2026-27',
        year_level: batchYearLevel,
        semester: Number(batchSem),
        semester_number: Number(batchSem),
        subject_id: batchSubjectId || undefined,
      });
      setMatrixData(res);
      if (res.batches && res.batches.length > 0) {
        setBatches(res.batches);
        if (!targetBatchId || !res.batches.find((b: any) => b.id === targetBatchId)) {
          setTargetBatchId(res.batches[0].id);
        }
      } else {
        setBatches([]);
      }
    } catch (err: any) {
      console.error('Failed to load batch matrix', err);
    } finally {
      setMatrixLoading(false);
    }
  };

  const loadAllData = async () => {
    try {
      setLoading(true);
      const results = await Promise.allSettled([
        api.analytics.getAdminAnalytics(),
        api.academic.listStudentProfiles(),
        api.integrity.listEvents(),
        api.academic.listAcademicYears(),
        api.academic.listCurricula(),
        api.academic.listSubjects({ branch: subjectBranch, semester: subjectSem }),
        api.academic.listAllotments({ academic_year: '2026-27' }),
        api.academic.listLabBatches({ branch: batchBranch, division: batchDiv }),
        api.academic.listOpenElectives(),
        api.academic.listOpenElectiveSelections(),
        api.academic.listPromotionWindows(),
        api.academic.listPromotionRequests(),
      ]);

      if (results[0].status === 'fulfilled') setAnalytics(results[0].value);
      if (results[1].status === 'fulfilled') setProfiles(results[1].value || []);
      if (results[2].status === 'fulfilled') setIntegrityEvents(results[2].value || []);
      if (results[3].status === 'fulfilled') setAcademicYears(results[3].value || []);
      if (results[4].status === 'fulfilled') setCurricula(results[4].value || []);
      if (results[5].status === 'fulfilled') setSubjects(results[5].value || []);
      if (results[6].status === 'fulfilled') setPublishedAllotments(results[6].value || []);
      if (results[7].status === 'fulfilled') setBatches(results[7].value || []);
      if (results[8].status === 'fulfilled') setElectiveConfigs(results[8].value || []);
      if (results[9].status === 'fulfilled') setElectiveSelections(results[9].value || []);
      if (results[10].status === 'fulfilled') setPromotionWindows(results[10].value || []);
      if (results[11].status === 'fulfilled') setPromotionRequests(results[11].value || []);
    } catch (err: any) {
      showToast(err.message || 'Failed to load administrator data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------------
  // Handlers
  // ----------------------------------------------------
  const handleUpdateProfileStatus = async (userId: string, newStatus: string) => {
    let remarks = '';
    if (newStatus === 'rejected') {
      const input = prompt('Enter discrepancy remarks for reverting this profile:', 'Incomplete roll number or branch verification.');
      if (input === null) return;
      remarks = input;
    }
    try {
      await api.academic.updateProfileStatus(userId, newStatus, remarks);
      showToast(`Student profile status updated to ${newStatus}.`, 'success');
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to update profile status', 'error');
    }
  };

  const handleReviewIntegrityEvent = async (eventId: string, newStatus: string) => {
    const remarks = prompt('Enter administrative review notes (optional):', 'Reviewed and resolved by administrator.');
    if (remarks === null) return;
    try {
      await api.integrity.reviewEvent(eventId, newStatus, remarks);
      showToast(`Event marked as ${newStatus}.`, 'success');
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to review event', 'error');
    }
  };

  const handleFilterSubjects = async (b: string, s: number) => {
    setSubjectBranch(b);
    setSubjectSem(s);
    try {
      const data = await api.academic.listSubjects({ branch: b, semester: s });
      setSubjects(data || []);
    } catch (err: any) {
      showToast(err.message || 'Failed to filter subjects', 'error');
    }
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubName.trim() || !newSubCode.trim()) {
      showToast('Subject Name and Code are required.', 'error');
      return;
    }
    try {
      await api.academic.createSubject({
        branch_code: newSubBranch,
        semester_number: Number(newSubSem),
        name: newSubName.trim(),
        code: newSubCode.trim().toUpperCase(),
        credits: Number(newSubCredits),
        category: newSubCategory,
        subject_type: newSubType,
        teaching_hours: 4,
        academic_year: '2026-27',
        is_elective: newSubCategory === 'Elective' || newSubCategory === 'Open Elective' ? 1 : 0
      });
      showToast(`Subject ${newSubCode} created successfully in master catalog.`, 'success');
      setShowAddSubjectModal(false);
      setNewSubName('');
      setNewSubCode('');
      handleFilterSubjects(newSubBranch, newSubSem);
    } catch (err: any) {
      showToast(err.message || 'Failed to create subject', 'error');
    }
  };

  const handleCloneCurriculum = async () => {
    try {
      await api.academic.cloneCurriculum({
        source_academic_year: cloneSourceYear,
        target_academic_year: cloneTargetYear,
        branch_code: cloneBranch
      });
      showToast(`Successfully cloned ${cloneBranch} curriculum from ${cloneSourceYear} to ${cloneTargetYear}.`, 'success');
      setShowCloneModal(false);
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to clone curriculum', 'error');
    }
  };

  const handlePreviewAllotment = async () => {
    try {
      setLoading(true);
      const res = await api.academic.previewBulkAllotment({
        academic_year: allotYear,
        branch_code: allotBranch,
        year_level: allotYearLevel,
        semester_number: Number(allotSem),
        division_name: allotDiv
      });
      setPreviewData(res);
      // Initialize faculty mapping defaults
      const fMap: Record<string, string> = {};
      const defaultFac = res.eligible_faculty?.[0]?.id || '';
      res.subjects?.forEach((s: any) => {
        fMap[s.id] = defaultFac;
      });
      setSelectedFacultyMap(fMap);
      showToast(`Preview generated: ${res.affected_students_count} students identified in ${allotDiv}.`, 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to generate allotment preview', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePublishAllotment = async () => {
    if (!previewData || !previewData.subjects?.length) {
      showToast('No subjects available to publish.', 'error');
      return;
    }
    const allotments = previewData.subjects.map((s: any) => ({
      subject_id: s.id,
      faculty_id: selectedFacultyMap[s.id] || previewData.eligible_faculty?.[0]?.id
    }));

    try {
      setLoading(true);
      const res = await api.academic.publishBulkAllotment({
        academic_year: allotYear,
        branch_code: allotBranch,
        year_level: allotYearLevel,
        semester_number: Number(allotSem),
        division_name: allotDiv,
        allotments
      });
      showToast(`Allotments published! ${res.enrolled_students_count} students auto-enrolled.`, 'success');
      setPreviewData(null);
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to publish bulk allotments', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.academic.createLabBatch({
        batch_name: newBatchName,
        academic_year: '2026-27',
        branch_code: batchBranch,
        year_level: batchYearLevel,
        semester_number: Number(batchSem),
        division_name: batchDiv,
        capacity: Number(newBatchCapacity),
        subject_id: batchSubjectId || undefined,
      });
      showToast(`Lab batch ${newBatchName} created.`, 'success');
      setShowCreateBatchModal(false);
      loadBatchAllocationMatrix();
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to create lab batch', 'error');
    }
  };

  const handleBatchManualAssign = async (batchId: string, studentIds: string[]) => {
    if (!studentIds.length) {
      showToast('Select at least one student to assign.', 'error');
      return;
    }
    try {
      setMatrixLoading(true);
      await api.academic.manualAssignBatch({
        batch_id: batchId,
        student_ids: studentIds,
      });
      showToast(`Successfully assigned ${studentIds.length} student(s) to lab batch.`, 'success');
      setSelectedStudentIds([]);
      await loadBatchAllocationMatrix();
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to assign students to batch', 'error');
    } finally {
      setMatrixLoading(false);
    }
  };

  const handleBatchUnassign = async (batchId: string | null, studentIds: string[]) => {
    if (!studentIds.length) {
      showToast('Select at least one student to remove.', 'error');
      return;
    }
    try {
      setMatrixLoading(true);
      await api.academic.unassignBatchStudents({
        batch_id: batchId || undefined,
        student_ids: studentIds,
      });
      showToast(`Successfully returned ${studentIds.length} student(s) to unassigned pool.`, 'success');
      setSelectedStudentIds([]);
      await loadBatchAllocationMatrix();
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to unassign students', 'error');
    } finally {
      setMatrixLoading(false);
    }
  };

  const handleReviewElective = async (selectionId: string, status: 'approved' | 'rejected') => {
    try {
      await api.academic.reviewOpenElectiveSelection(selectionId, status, 'Approved by academic board.');
      showToast(`Open elective selection ${status}.`, 'success');
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to review elective selection', 'error');
    }
  };

  const handleCreatePromotionWindow = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.academic.createPromotionWindow({
        title: newWinTitle,
        source_academic_year: newWinSrcYear,
        target_academic_year: newWinTgtYear,
        source_year_level: newWinSrcLevel,
        target_year_level: newWinTgtLevel,
        source_semester: Number(newWinSrcSem),
        target_semester: Number(newWinTgtSem),
        branch_code: newWinBranch
      });
      showToast(`Promotion window '${newWinTitle}' opened.`, 'success');
      setShowNewWindowModal(false);
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to create promotion window', 'error');
    }
  };

  const handleReviewPromotion = async (reqId: string, status: 'approved' | 'rejected') => {
    try {
      await api.academic.reviewPromotionRequest(reqId, status, undefined, undefined, 'Academic upgrade approved.');
      showToast(`Student promotion request ${status}.`, 'success');
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to review promotion request', 'error');
    }
  };

  const handleResetDemo = async () => {
    if (!window.confirm("WARNING: This will reset all demo data to exactly 10 students, 3 faculty, 1 admin, with 0 assessments/submissions. All created test tasks will be cleared. Continue?")) return;
    try {
      setLoading(true);
      await api.academic.resetDemoData();
      showToast("Demo environment safely reset to 10 students, 3 faculty, 0 tasks!", "success");
      await loadAllData();
    } catch (e: any) {
      showToast("Failed to reset demo: " + (e.message || "Unknown error"), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleBackupDatabase = async () => {
    try {
      const res = await api.academic.backupDatabase();
      showToast(`Database backup snapshot created: ${res.backup_file || 'writeuppro_backup.db'}`, "success");
    } catch (e: any) {
      showToast("Backup failed: " + (e.message || "Unknown error"), "error");
    }
  };

  const handleExportCsv = async () => {
    try {
      const blob = await api.academic.exportStudentsCsv();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `student_roster_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast("Student roster exported successfully as CSV!", "success");
    } catch (e: any) {
      showToast("Export failed: " + (e.message || "Unknown error"), "error");
    }
  };

  // Filtered registrations
  const filteredProfiles = profiles.filter((p) => {
    const matchesSearch =
      !search ||
      p.roll_number.toLowerCase().includes(search.toLowerCase()) ||
      (p.name && p.name.toLowerCase().includes(search.toLowerCase())) ||
      (p.prn && p.prn.toLowerCase().includes(search.toLowerCase()));

    const matchesBranch = branchFilter === 'ALL' || p.branch_code === branchFilter;
    const matchesYear = yearFilter === 'ALL' || p.year_level === yearFilter;
    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;

    return matchesSearch && matchesBranch && matchesYear && matchesStatus;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Overview Header */}
      <div className="p-6 bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[4px_4px_0px_#1A1209] flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#B84915] block mb-1">
            ACADEMIC GOVERNANCE & TELEMETRY // CENTRALIZED CONTROLLER
          </span>
          <h1 className="text-2xl font-black text-[#1A1209] dark:text-white tracking-tight">
            Institutional Administration Workspace.
          </h1>
          <p className="text-xs text-[#5C4D3C] dark:text-[#B8A99A] font-mono mt-1">
            Centralized academic structure, Mumbai University Rev-2019 C Scheme syllabi, bulk allotment wizards, laboratory batches, and promotion windows.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="neo-btn px-3 py-1.5 bg-[#FAF6EE] dark:bg-[#26201B] hover:bg-[#1A365D] hover:text-white text-[#1A365D] dark:text-blue-300 text-xs font-mono flex items-center gap-1.5 border border-[#1A1209]"
            title="Download CSV of all enrolled students"
          >
            <Download className="w-3.5 h-3.5" />
            <span>EXPORT ROSTER (CSV)</span>
          </button>
          <button
            onClick={handleBackupDatabase}
            className="neo-btn px-3 py-1.5 bg-[#FAF6EE] dark:bg-[#26201B] hover:bg-[#1F5A2E] hover:text-white text-[#1F5A2E] dark:text-green-400 text-xs font-mono flex items-center gap-1.5 border border-[#1A1209]"
            title="Snapshot current database state"
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>BACKUP DB</span>
          </button>
          <button
            onClick={handleResetDemo}
            disabled={loading}
            className="neo-btn px-3 py-1.5 bg-[#FFF5F5] dark:bg-[#331818] hover:bg-[#8B1A1A] hover:text-white text-[#8B1A1A] dark:text-red-300 text-xs font-mono flex items-center gap-1.5 border border-[#8B1A1A]"
            title="Reset to 10 students, 3 faculty, 0 assessments"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>RESET DEMO DATA</span>
          </button>
          <button
            onClick={loadAllData}
            disabled={loading}
            className="neo-btn px-3.5 py-1.5 bg-[#F4EFE6] dark:bg-[#26201B] hover:bg-[#B84915] hover:text-white text-[#1A1209] dark:text-white text-xs font-mono flex items-center gap-1.5 border border-[#1A1209]"
            title="Refresh All Institutional Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'REFRESHING...' : 'REFRESH'}</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Ribbon */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 font-mono text-center">
          <div className="bg-white dark:bg-[#1D1814] p-3 border-2 border-[#1A1209] shadow-[3px_3px_0px_#1A1209]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#786958] dark:text-[#A89886] block">
              Students
            </span>
            <span className="text-xl font-black text-[#1A1209] dark:text-white mt-1 block">
              {analytics.total_students}
            </span>
          </div>

          <div className="bg-white dark:bg-[#1D1814] p-3 border-2 border-[#1A1209] shadow-[3px_3px_0px_#1A1209]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#B84915] block">
              Pending
            </span>
            <span className="text-xl font-black text-[#B84915] mt-1 block">
              {analytics.pending_registrations}
            </span>
          </div>

          <div className="bg-white dark:bg-[#1D1814] p-3 border-2 border-[#1A1209] shadow-[3px_3px_0px_#1A1209]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#786958] dark:text-[#A89886] block">
              Faculty
            </span>
            <span className="text-xl font-black text-[#1A1209] dark:text-white mt-1 block">
              {analytics.total_faculty}
            </span>
          </div>

          <div className="bg-white dark:bg-[#1D1814] p-3 border-2 border-[#1A1209] shadow-[3px_3px_0px_#1A1209]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#1A365D] block">
              Subjects
            </span>
            <span className="text-xl font-black text-[#1A365D] dark:text-[#63B3ED] mt-1 block">
              {analytics.total_subjects || 81}
            </span>
          </div>

          <div className="bg-white dark:bg-[#1D1814] p-3 border-2 border-[#1A1209] shadow-[3px_3px_0px_#1A1209]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#1F5A2E] block">
              Lab Batches
            </span>
            <span className="text-xl font-black text-[#1F5A2E] dark:text-[#48BB78] mt-1 block">
              {analytics.total_lab_batches || batches.length}
            </span>
          </div>

          <div className="bg-white dark:bg-[#1D1814] p-3 border-2 border-[#1A1209] shadow-[3px_3px_0px_#1A1209]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#B84915] block">
              Promotions
            </span>
            <span className="text-xl font-black text-[#B84915] mt-1 block">
              {analytics.pending_promotions || 1}
            </span>
          </div>

          <div className="bg-white dark:bg-[#1D1814] p-3 border-2 border-[#1A1209] shadow-[3px_3px_0px_#1A1209]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B1A1A] block">
              Integrity
            </span>
            <span className="text-xl font-black text-[#8B1A1A] mt-1 block">
              {analytics.total_integrity_events}
            </span>
          </div>
        </div>
      )}

      {/* Primary Navigation Tabs */}
      <div className="flex flex-wrap items-center border-b-2 border-[#1A1209] gap-2 pb-0">
        <button
          onClick={() => setActiveTab('academic_classes')}
          className={`neo-btn px-3.5 py-2 text-xs flex items-center gap-1.5 font-mono ${
            activeTab === 'academic_classes'
              ? 'bg-[#1A365D] text-white shadow-[2px_2px_0px_#1A1209]'
              : 'bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-[#D4C7B5]'
          }`}
        >
          <Folder className="w-3.5 h-3.5 text-[#B84915]" /> ACADEMIC CLASSES
        </button>

        <button
          onClick={() => setActiveTab('registrations')}
          className={`neo-btn px-3.5 py-2 text-xs flex items-center gap-1.5 font-mono ${
            activeTab === 'registrations'
              ? 'bg-[#1A365D] text-white shadow-[2px_2px_0px_#1A1209]'
              : 'bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-[#D4C7B5]'
          }`}
        >
          <GraduationCap className="w-3.5 h-3.5" /> REGISTRATIONS
        </button>

        <button
          onClick={() => setActiveTab('academic_structure')}
          className={`neo-btn px-3.5 py-2 text-xs flex items-center gap-1.5 font-mono ${
            activeTab === 'academic_structure'
              ? 'bg-[#1A365D] text-white shadow-[2px_2px_0px_#1A1209]'
              : 'bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-[#D4C7B5]'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" /> SYLLABI & SUBJECTS
        </button>

        <button
          onClick={() => setActiveTab('allotment_wizard')}
          className={`neo-btn px-3.5 py-2 text-xs flex items-center gap-1.5 font-mono ${
            activeTab === 'allotment_wizard'
              ? 'bg-[#B84915] text-white shadow-[2px_2px_0px_#1A1209]'
              : 'bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-[#D4C7B5]'
          }`}
        >
          <Layers className="w-3.5 h-3.5" /> ALLOTMENT WIZARD
        </button>

        <button
          onClick={() => setActiveTab('batches')}
          className={`neo-btn px-3.5 py-2 text-xs flex items-center gap-1.5 font-mono ${
            activeTab === 'batches'
              ? 'bg-[#1F5A2E] text-white shadow-[2px_2px_0px_#1A1209]'
              : 'bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-[#D4C7B5]'
          }`}
        >
          <Users className="w-3.5 h-3.5" /> LAB BATCHES
        </button>

        <button
          onClick={() => setActiveTab('electives')}
          className={`neo-btn px-3.5 py-2 text-xs flex items-center gap-1.5 font-mono ${
            activeTab === 'electives'
              ? 'bg-[#1A365D] text-white shadow-[2px_2px_0px_#1A1209]'
              : 'bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-[#D4C7B5]'
          }`}
        >
          <Share2 className="w-3.5 h-3.5" /> OPEN ELECTIVES
        </button>

        <button
          onClick={() => setActiveTab('promotions')}
          className={`neo-btn px-3.5 py-2 text-xs flex items-center gap-1.5 font-mono ${
            activeTab === 'promotions'
              ? 'bg-[#B84915] text-white shadow-[2px_2px_0px_#1A1209]'
              : 'bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-[#D4C7B5]'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" /> PROMOTIONS
        </button>

        <button
          onClick={() => setActiveTab('integrity')}
          className={`neo-btn px-3.5 py-2 text-xs flex items-center gap-1.5 font-mono ${
            activeTab === 'integrity'
              ? 'bg-[#8B1A1A] text-white shadow-[2px_2px_0px_#1A1209]'
              : 'bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-[#D4C7B5]'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" /> INTEGRITY
        </button>

        <button
          onClick={() => setActiveTab('ledger')}
          className={`neo-btn px-3.5 py-2 text-xs flex items-center gap-1.5 font-mono ${
            activeTab === 'ledger'
              ? 'bg-[#1F5A2E] text-white shadow-[2px_2px_0px_#1A1209]'
              : 'bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-[#D4C7B5]'
          }`}
        >
          <FileCheck className="w-3.5 h-3.5" /> LEDGER & REPORTS
        </button>
      </div>

      {/* ---------------------------------------------------- */}
      {/* TAB 0: ROLE-BASED ACADEMIC CLASSES WORKSPACE */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'academic_classes' && (
        <AdminAcademicClassesWorkspace
          onNavigateTab={(tabName) => setActiveTab(tabName as any)}
          showToast={showToast}
        />
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 1: REGISTRATIONS */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'registrations' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#1D1814] p-4 border-2 border-[#1A1209] shadow-[3.5px_3.5px_0px_#1A1209]">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#786958]" />
                <input
                  type="text"
                  placeholder="Filter name, roll, PRN..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209] text-xs font-mono"
                />
              </div>

              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209] text-xs font-mono"
              >
                <option value="ALL">All Branches</option>
                <option value="CE">Computer Engg (CE)</option>
                <option value="IT">Info Tech (IT)</option>
                <option value="EXTC">Electronics & Telecom (EXTC)</option>
                <option value="AIDS">AI & Data Science (AIDS)</option>
                <option value="MECH">Mechanical Engg (MECH)</option>
                <option value="CIVIL">Civil Engg (CIVIL)</option>
              </select>

              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209] text-xs font-mono"
              >
                <option value="ALL">All Year Levels</option>
                <option value="FE">First Year (FE)</option>
                <option value="SE">Second Year (SE)</option>
                <option value="TE">Third Year (TE)</option>
                <option value="BE">Final Year (BE)</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209] text-xs font-mono"
              >
                <option value="ALL">All Statuses</option>
                <option value="pending">Pending Approval</option>
                <option value="approved">Approved & Verified</option>
                <option value="rejected">Reverted / Rejected</option>
              </select>
            </div>

            <span className="text-xs font-mono text-[#5C4D3C] dark:text-[#A89886]">
              Showing {filteredProfiles.length} of {profiles.length} student profiles
            </span>
          </div>

          <div className="bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[4px_4px_0px_#1A1209] overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#F4EFE6] dark:bg-[#26201B] border-b-2 border-[#1A1209] uppercase text-[10px] tracking-wider text-[#1A1209] dark:text-white">
                <tr>
                  <th className="p-3">Roll No</th>
                  <th className="p-3">Full Student Name</th>
                  <th className="p-3">PRN Number</th>
                  <th className="p-3">Group / Div</th>
                  <th className="p-3">CGPA</th>
                  <th className="p-3">Academic Year</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Verification Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0D8C8] dark:divide-[#332A24]">
                {filteredProfiles.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-[#786958]">
                      No student registration records match the active filters.
                    </td>
                  </tr>
                ) : (
                  filteredProfiles.map((p) => (
                    <tr key={p.user_id} className="hover:bg-[#FAF6EE] dark:hover:bg-[#231C17]">
                      <td className="p-3 font-bold text-[#B84915]">{p.roll_number}</td>
                      <td className="p-3 text-[#1A1209] dark:text-white font-medium">{p.name || 'Student User'}</td>
                      <td className="p-3 text-[#786958]">{p.prn || 'PRN-PENDING'}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 bg-[#E8EFF8] dark:bg-[#1A2636] text-[#1A365D] dark:text-[#90CDF4] border border-[#1A365D]">
                          {p.year_level}-{p.branch_code} ({p.division_name})
                        </span>
                      </td>
                      <td className="p-3 font-bold text-[#1F5A2E] dark:text-[#48BB78]">
                        {p.cgpa ? p.cgpa.toFixed(2) : '8.45'}
                      </td>
                      <td className="p-3 text-[#786958]">{p.academic_year || '2026-27'}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 text-[10px] uppercase font-bold border ${
                            p.status === 'approved'
                              ? 'bg-[#EBF8EE] text-[#1F5A2E] border-[#1F5A2E]'
                              : p.status === 'pending'
                              ? 'bg-[#FFF8E7] text-[#B84915] border-[#B84915]'
                              : 'bg-[#FFF5F5] text-[#8B1A1A] border-[#8B1A1A]'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {p.status !== 'approved' && (
                            <button
                              onClick={() => handleUpdateProfileStatus(p.user_id, 'approved')}
                              className="px-2 py-1 bg-[#1F5A2E] text-white text-[10px] hover:bg-[#164422] flex items-center gap-1 border border-[#1A1209]"
                              title="Approve profile and auto-enroll into subjects"
                            >
                              <Check className="w-3 h-3" /> APPROVE
                            </button>
                          )}
                          {p.status !== 'rejected' && (
                            <button
                              onClick={() => handleUpdateProfileStatus(p.user_id, 'rejected')}
                              className="px-2 py-1 bg-[#8B1A1A] text-white text-[10px] hover:bg-[#681313] flex items-center gap-1 border border-[#1A1209]"
                              title="Revert profile with remarks"
                            >
                              <X className="w-3 h-3" /> REVERT
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
      {/* TAB 2: ACADEMIC STRUCTURE & SYLLABI MASTER */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'academic_structure' && (
        <div className="space-y-6">
          {/* Multi-Year Academic Calendars */}
          <div className="bg-white dark:bg-[#1D1814] p-5 border-2 border-[#1A1209] shadow-[3.5px_3.5px_0px_#1A1209] space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-[#E0D8C8] dark:border-[#332A24]">
              <div>
                <h3 className="text-base font-black text-[#1A1209] dark:text-white font-mono flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#B84915]" /> Multi-Year Academic Cycles Registry
                </h3>
                <p className="text-xs text-[#5C4D3C] dark:text-[#A89886] font-mono mt-0.5">
                  Academic cycles define syllabus versioning, grade ledgers, and promotion windows.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
              {academicYears.map((ay) => (
                <div
                  key={ay.id}
                  className={`p-4 border-2 ${
                    ay.is_current
                      ? 'border-[#1F5A2E] bg-[#F7FBF8] dark:bg-[#1A261D] shadow-[3px_3px_0px_#1F5A2E]'
                      : 'border-[#1A1209] bg-[#FAF6EE] dark:bg-[#231C17]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base font-black text-[#1A1209] dark:text-white">{ay.code}</span>
                    <span
                      className={`px-2 py-0.5 text-[9px] uppercase font-bold border ${
                        ay.is_current
                          ? 'bg-[#1F5A2E] text-white border-[#1F5A2E]'
                          : 'bg-white text-[#786958] border-[#1A1209]'
                      }`}
                    >
                      {ay.is_current ? 'ACTIVE CURRENT' : ay.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#5C4D3C] dark:text-[#A89886] mt-2">{ay.name}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Mumbai University Rev-2019 C Scheme Curricula */}
          <div className="bg-white dark:bg-[#1D1814] p-5 border-2 border-[#1A1209] shadow-[3.5px_3.5px_0px_#1A1209] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 border-[#E0D8C8] dark:border-[#332A24]">
              <div>
                <h3 className="text-base font-black text-[#1A1209] dark:text-white font-mono flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#1A365D]" /> Mumbai University Engineering Syllabi Master (Rev-2019 'C' Scheme / NEP 2020)
                </h3>
                <p className="text-xs text-[#5C4D3C] dark:text-[#A89886] font-mono mt-0.5">
                  Course catalog with exact credits, lecture contact hours, and syllabus category definitions.
                </p>
              </div>

              <div className="flex items-center gap-2 font-mono text-xs">
                <button
                  onClick={() => setShowCloneModal(true)}
                  className="px-3 py-1.5 bg-[#FAF6EE] dark:bg-[#26201B] hover:bg-[#B84915] hover:text-white border border-[#1A1209] flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" /> CLONE SYLLABUS
                </button>
                <button
                  onClick={() => setShowAddSubjectModal(true)}
                  className="px-3 py-1.5 bg-[#1A365D] text-white hover:bg-[#12243F] border border-[#1A1209] flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> ADD SUBJECT
                </button>
              </div>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
              <span className="text-[10px] font-bold uppercase text-[#786958]">Select Branch & Sem:</span>
              {['CE', 'IT', 'EXTC', 'AIDS', 'MECH', 'CIVIL', 'ASH'].map((b) => (
                <button
                  key={b}
                  onClick={() => handleFilterSubjects(b, subjectSem)}
                  className={`px-2.5 py-1 text-xs border ${
                    subjectBranch === b
                      ? 'bg-[#1A365D] text-white border-[#1A1209] font-bold'
                      : 'bg-[#FAF6EE] dark:bg-[#231C17] text-[#1A1209] dark:text-[#D4C7B5] border-[#1A1209]'
                  }`}
                >
                  {b}
                </button>
              ))}

              <div className="h-4 w-[1px] bg-[#1A1209] mx-1" />

              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                <button
                  key={s}
                  onClick={() => handleFilterSubjects(subjectBranch, s)}
                  className={`px-2 py-0.5 text-xs border ${
                    subjectSem === s
                      ? 'bg-[#B84915] text-white border-[#1A1209] font-bold'
                      : 'bg-[#FAF6EE] dark:bg-[#231C17] text-[#1A1209] dark:text-[#D4C7B5] border-[#1A1209]'
                  }`}
                >
                  Sem {s}
                </button>
              ))}
            </div>

            {/* Subjects Table */}
            <div className="border border-[#1A1209] overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#F4EFE6] dark:bg-[#26201B] border-b border-[#1A1209] text-[10px] uppercase text-[#1A1209] dark:text-white">
                  <tr>
                    <th className="p-2.5">Code</th>
                    <th className="p-2.5">Course Name</th>
                    <th className="p-2.5">Category</th>
                    <th className="p-2.5">Type</th>
                    <th className="p-2.5">Credits</th>
                    <th className="p-2.5">Weekly Hours</th>
                    <th className="p-2.5">Scheme</th>
                    <th className="p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E0D8C8] dark:divide-[#332A24]">
                  {subjects.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-[#786958]">
                        No courses recorded for {subjectBranch} Semester {subjectSem}.
                      </td>
                    </tr>
                  ) : (
                    subjects.map((s) => (
                      <tr key={s.id} className="hover:bg-[#FAF6EE] dark:hover:bg-[#231C17]">
                        <td className="p-2.5 font-bold text-[#B84915]">{s.code}</td>
                        <td className="p-2.5 font-medium text-[#1A1209] dark:text-white">{s.name}</td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 bg-[#E8EFF8] dark:bg-[#1A2636] text-[#1A365D] border border-[#1A365D] text-[10px]">
                            {s.category || 'Core'}
                          </span>
                        </td>
                        <td className="p-2.5">{s.subject_type || 'Theory'}</td>
                        <td className="p-2.5 font-bold text-[#1F5A2E]">{s.credits} {s.credits === 1 ? 'Credit' : 'Credits'}</td>
                        <td className="p-2.5">{s.teaching_hours || 4} hrs/wk</td>
                        <td className="p-2.5 text-[10px] text-[#786958]">{s.syllabus_scheme?.substring(0, 24)}...</td>
                        <td className="p-2.5">
                          <span className="px-1.5 py-0.5 bg-[#EBF8EE] text-[#1F5A2E] text-[9px] uppercase font-bold border border-[#1F5A2E]">
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 3: BULK ALLOTMENT 10-STEP WIZARD */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'allotment_wizard' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#1D1814] p-5 border-2 border-[#1A1209] shadow-[3.5px_3.5px_0px_#1A1209] space-y-4">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#B84915] block">
                MODULE 2C // 10-STEP FACULTY SUBJECT ALLOTMENT WIZARD
              </span>
              <h2 className="text-xl font-black text-[#1A1209] dark:text-white tracking-tight mt-0.5">
                Bulk Subject Allotment & Student Enrollment Engine.
              </h2>
              <p className="text-xs text-[#5C4D3C] dark:text-[#A89886] font-mono mt-1">
                Configure academic group allotments, assign designated professors, and automatically enroll all division students with atomic transactional integrity.
              </p>
            </div>

            {/* Wizard Config Form */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209] font-mono text-xs">
              <div>
                <label className="block text-[10px] uppercase font-bold mb-1">1. Academic Cycle</label>
                <select
                  value={allotYear}
                  onChange={(e) => setAllotYear(e.target.value)}
                  className="w-full p-2 bg-white dark:bg-[#1D1814] border border-[#1A1209]"
                >
                  <option value="2026-27">2026-27 (Current)</option>
                  <option value="2027-28">2027-28 (Upcoming)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold mb-1">2. Branch</label>
                <select
                  value={allotBranch}
                  onChange={(e) => setAllotBranch(e.target.value)}
                  className="w-full p-2 bg-white dark:bg-[#1D1814] border border-[#1A1209]"
                >
                  <option value="CE">Computer Engg (CE)</option>
                  <option value="IT">Info Tech (IT)</option>
                  <option value="EXTC">Electronics (EXTC)</option>
                  <option value="AIDS">AI & Data Science (AIDS)</option>
                  <option value="MECH">Mechanical (MECH)</option>
                  <option value="CIVIL">Civil Engg (CIVIL)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold mb-1">3. Year Level</label>
                <select
                  value={allotYearLevel}
                  onChange={(e) => setAllotYearLevel(e.target.value)}
                  className="w-full p-2 bg-white dark:bg-[#1D1814] border border-[#1A1209]"
                >
                  <option value="FE">First Year (FE)</option>
                  <option value="SE">Second Year (SE)</option>
                  <option value="TE">Third Year (TE)</option>
                  <option value="BE">Final Year (BE)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold mb-1">4. Semester</label>
                <select
                  value={allotSem}
                  onChange={(e) => setAllotSem(Number(e.target.value))}
                  className="w-full p-2 bg-white dark:bg-[#1D1814] border border-[#1A1209]"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                    <option key={s} value={s}>
                      Semester {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold mb-1">5. Division</label>
                <select
                  value={allotDiv}
                  onChange={(e) => setAllotDiv(e.target.value)}
                  className="w-full p-2 bg-white dark:bg-[#1D1814] border border-[#1A1209]"
                >
                  <option value="Div A">Division A</option>
                  <option value="Div B">Division B</option>
                </select>
              </div>
            </div>

            <button
              onClick={handlePreviewAllotment}
              disabled={loading}
              className="neo-btn px-4 py-2 bg-[#1A365D] text-white hover:bg-[#12243F] font-mono text-xs flex items-center gap-2"
            >
              <ArrowRight className="w-4 h-4" /> STEP 6: PREVIEW AFFECTED STUDENTS & SUBJECTS
            </button>

            {/* Preview & Faculty Assignment Matrix */}
            {previewData && (
              <div className="space-y-4 pt-4 border-t-2 border-[#1A1209] font-mono">
                <div className="p-3 bg-[#EBF8EE] border border-[#1F5A2E] text-xs text-[#1F5A2E] flex items-center justify-between">
                  <span>
                    Verified Group: <strong>{previewData.academic_group_id}</strong> // {previewData.affected_students_count} verified students identified in {allotDiv}.
                  </span>
                  <span className="font-bold">Ready for Allotment</span>
                </div>

                <h4 className="text-sm font-black text-[#1A1209] dark:text-white uppercase">
                  STEP 7 & 8: Assign Faculty Members to Curriculum Courses
                </h4>

                <div className="border border-[#1A1209] overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F4EFE6] dark:bg-[#26201B] border-b border-[#1A1209] text-[10px] uppercase">
                      <tr>
                        <th className="p-2.5">Course Code</th>
                        <th className="p-2.5">Subject Name</th>
                        <th className="p-2.5">Credits</th>
                        <th className="p-2.5">Assigned Subject Teacher (Faculty)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E0D8C8] dark:divide-[#332A24]">
                      {previewData.subjects?.map((s: any) => (
                        <tr key={s.id}>
                          <td className="p-2.5 font-bold text-[#B84915]">{s.code}</td>
                          <td className="p-2.5 font-medium">{s.name}</td>
                          <td className="p-2.5 font-bold text-[#1F5A2E]">{s.credits} Cr</td>
                          <td className="p-2.5">
                            <select
                              value={selectedFacultyMap[s.id] || ''}
                              onChange={(e) =>
                                setSelectedFacultyMap({
                                  ...selectedFacultyMap,
                                  [s.id]: e.target.value,
                                })
                              }
                              className="p-1.5 bg-white dark:bg-[#12100E] border border-[#1A1209] text-xs w-full max-w-xs"
                            >
                              {previewData.eligible_faculty?.map((f: any) => (
                                <option key={f.id} value={f.id}>
                                  {f.full_name} ({f.department_code || 'FAC'})
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handlePublishAllotment}
                    disabled={loading}
                    className="neo-btn px-6 py-2.5 bg-[#B84915] text-white hover:bg-[#963A0F] font-bold text-xs flex items-center gap-2 shadow-[3px_3px_0px_#1A1209]"
                  >
                    <CheckCircle className="w-4 h-4" /> STEP 10: CONFIRM & PUBLISH ALLOTMENTS (AUTO-ENROLL STUDENTS)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Existing Allotments Table */}
          <div className="bg-white dark:bg-[#1D1814] p-5 border-2 border-[#1A1209] shadow-[3.5px_3.5px_0px_#1A1209] space-y-3 font-mono text-xs">
            <h3 className="text-sm font-black text-[#1A1209] dark:text-white uppercase flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#1F5A2E]" /> Currently Published Allotments ({publishedAllotments.length})
            </h3>
            <div className="border border-[#1A1209] overflow-x-auto max-h-96">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F4EFE6] dark:bg-[#26201B] border-b border-[#1A1209] text-[10px] uppercase sticky top-0">
                  <tr>
                    <th className="p-2">Academic Group</th>
                    <th className="p-2">Course Code</th>
                    <th className="p-2">Subject Name</th>
                    <th className="p-2">Faculty Member</th>
                    <th className="p-2">Enrolled Students</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E0D8C8] dark:divide-[#332A24]">
                  {publishedAllotments.slice(0, 25).map((alt) => (
                    <tr key={alt.id} className="hover:bg-[#FAF6EE] dark:hover:bg-[#231C17]">
                      <td className="p-2 text-[#786958]">{alt.academic_group_id}</td>
                      <td className="p-2 font-bold text-[#B84915]">{alt.subject_code}</td>
                      <td className="p-2 font-medium">{alt.subject_name}</td>
                      <td className="p-2 text-[#1A365D] font-bold">{alt.faculty_name}</td>
                      <td className="p-2 font-bold text-[#1F5A2E]">{alt.allotted_students_count || 10} Enrolled</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 4: LABORATORY BATCH MANAGEMENT & ALLOCATION MATRIX */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'batches' && (
        <div className="space-y-6 font-mono text-xs">
          {/* Header Banner & Academic Filter Bar */}
          <div className="bg-white dark:bg-[#1D1814] p-5 border-2 border-[#1A1209] shadow-[3.5px_3.5px_0px_#1A1209] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 border-[#E0D8C8] dark:border-[#332A24]">
              <div>
                <h3 className="text-base font-black text-[#1A1209] dark:text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#1F5A2E]" /> Laboratory Batch Allocation Workspace
                </h3>
                <p className="text-xs text-[#5C4D3C] dark:text-[#A89886] mt-0.5">
                  Interactive matrix to manually allocate arbitrary students to laboratory practical batches (A1, A2, A3). Roll numbers do not dictate batches; any student can be moved or switched flexibly.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={loadBatchAllocationMatrix}
                  disabled={matrixLoading}
                  className="px-3 py-1.5 bg-[#FAF6EE] dark:bg-[#26201B] hover:bg-[#E0D8C8] text-[#1A1209] dark:text-white border border-[#1A1209] flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${matrixLoading ? 'animate-spin' : ''}`} /> REFRESH MATRIX
                </button>

                <button
                  onClick={() => setShowCreateBatchModal(true)}
                  className="px-3.5 py-1.5 bg-[#1F5A2E] text-white hover:bg-[#164422] border border-[#1A1209] flex items-center gap-1.5 font-bold"
                >
                  <Plus className="w-3.5 h-3.5" /> CREATE LAB BATCH
                </button>
              </div>
            </div>

            {/* Filter Controls Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
              <div>
                <label className="block text-[10px] uppercase font-bold text-[#786958] mb-1">Branch / Dept:</label>
                <select
                  value={batchBranch}
                  onChange={(e) => setBatchBranch(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#FFFAF1] dark:bg-[#26201B] border border-[#1A1209] font-bold text-xs"
                >
                  <option value="CE">Computer (CE)</option>
                  <option value="IT">Information Tech (IT)</option>
                  <option value="EXTC">Electronics (EXTC)</option>
                  <option value="AIDS">AI & Data Sci (AIDS)</option>
                  <option value="MECH">Mechanical (MECH)</option>
                  <option value="CIVIL">Civil (CIVIL)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-[#786958] mb-1">Year Level:</label>
                <select
                  value={batchYearLevel}
                  onChange={(e) => {
                    const yl = e.target.value;
                    setBatchYearLevel(yl);
                    if (yl === 'FE') setBatchSem(1);
                    else if (yl === 'SE') setBatchSem(3);
                    else if (yl === 'TE') setBatchSem(5);
                    else if (yl === 'BE') setBatchSem(7);
                  }}
                  className="w-full px-2.5 py-1.5 bg-[#FFFAF1] dark:bg-[#26201B] border border-[#1A1209] font-bold text-xs"
                >
                  <option value="FE">FE (First Year)</option>
                  <option value="SE">SE (Second Year)</option>
                  <option value="TE">TE (Third Year)</option>
                  <option value="BE">BE (Final Year)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-[#786958] mb-1">Semester:</label>
                <select
                  value={batchSem}
                  onChange={(e) => setBatchSem(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-[#FFFAF1] dark:bg-[#26201B] border border-[#1A1209] font-bold text-xs"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                    <option key={s} value={s}>Semester {s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-[#786958] mb-1">Division:</label>
                <select
                  value={batchDiv}
                  onChange={(e) => setBatchDiv(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#FFFAF1] dark:bg-[#26201B] border border-[#1A1209] font-bold text-xs"
                >
                  <option value="Div A">Division A</option>
                  <option value="Div B">Division B</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-[#786958] mb-1">Laboratory Subject:</label>
                <select
                  value={batchSubjectId}
                  onChange={(e) => setBatchSubjectId(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#FFFAF1] dark:bg-[#26201B] border border-[#1A1209] font-bold text-xs"
                >
                  <option value="">All Laboratory Courses</option>
                  {subjects
                    .filter((s) => s.branch_code === batchBranch || !s.branch_code)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} - {s.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Matrix Metrics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center pt-2">
              <div className="p-3 bg-[#FAF6EE] dark:bg-[#26201B] border border-[#1A1209]">
                <span className="text-[9px] uppercase font-bold text-[#786958] block">Division Roster</span>
                <span className="text-xl font-black text-[#1A1209] dark:text-white mt-0.5 block">
                  {matrixData?.total_students || 0} Students
                </span>
              </div>

              <div className="p-3 bg-[#FAF6EE] dark:bg-[#26201B] border border-[#1A1209]">
                <span className="text-[9px] uppercase font-bold text-[#1F5A2E] block">Assigned to Batches</span>
                <span className="text-xl font-black text-[#1F5A2E] dark:text-[#48BB78] mt-0.5 block">
                  {matrixData?.assigned_count || 0}
                </span>
              </div>

              <div className="p-3 bg-[#FAF6EE] dark:bg-[#26201B] border border-[#1A1209]">
                <span className="text-[9px] uppercase font-bold text-[#B84915] block">Unassigned Pool</span>
                <span className="text-xl font-black text-[#B84915] mt-0.5 block">
                  {matrixData?.unassigned_count || 0}
                </span>
              </div>

              <div className="p-3 bg-[#FAF6EE] dark:bg-[#26201B] border border-[#1A1209]">
                <span className="text-[9px] uppercase font-bold text-[#1A365D] block">Active Batches</span>
                <span className="text-xl font-black text-[#1A365D] dark:text-[#63B3ED] mt-0.5 block">
                  {matrixData?.batches?.length || batches.length}
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Batch Allocation Workbench */}
          <div className="bg-white dark:bg-[#1D1814] p-5 border-2 border-[#1A1209] shadow-[3.5px_3.5px_0px_#1A1209] space-y-4">
            {/* Toolbar: Search, Filter Unassigned, Bulk Selection, Assign Button */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#FAF6EE] dark:bg-[#26201B] border border-[#1A1209]">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#786958]" />
                  <input
                    type="text"
                    placeholder="Search name, roll, or PRN..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="pl-8 pr-3 py-1 bg-white dark:bg-[#1D1814] border border-[#1A1209] text-xs font-mono w-56"
                  />
                </div>

                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-[#1A1209] dark:text-white select-none">
                  <input
                    type="checkbox"
                    checked={unassignedOnly}
                    onChange={(e) => setUnassignedOnly(e.target.checked)}
                    className="cursor-pointer"
                  />
                  <span>Show Unassigned Only</span>
                </label>
              </div>

              {/* Bulk Allocation Action Bar */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-[#1A1209] dark:text-white">
                  <strong>{selectedStudentIds.length}</strong> selected
                </span>

                <select
                  value={targetBatchId}
                  onChange={(e) => setTargetBatchId(e.target.value)}
                  className="px-2.5 py-1 bg-white dark:bg-[#1D1814] border border-[#1A1209] text-xs font-bold font-mono"
                >
                  {(matrixData?.batches || batches).map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.batch_name} ({b.student_count || 0}/{b.capacity})
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => handleBatchManualAssign(targetBatchId, selectedStudentIds)}
                  disabled={selectedStudentIds.length === 0 || !(matrixData?.batches || batches).length}
                  className="px-3 py-1 bg-[#1F5A2E] hover:bg-[#164422] disabled:opacity-50 text-white font-bold text-xs border border-[#1A1209] flex items-center gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" /> ASSIGN SELECTED &rarr;
                </button>

                <button
                  onClick={() => handleBatchUnassign(null, selectedStudentIds)}
                  disabled={selectedStudentIds.length === 0}
                  className="px-2.5 py-1 bg-[#FAF6EE] dark:bg-[#1D1814] hover:bg-[#E0D8C8] disabled:opacity-50 text-[#8B1A1A] font-bold text-xs border border-[#8B1A1A] flex items-center gap-1"
                  title="Remove selected students from their current batch"
                >
                  <UserMinus className="w-3.5 h-3.5" /> UNASSIGN
                </button>
              </div>
            </div>

            {/* Dual Matrix Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Panel: Division Student Roster (7 cols) */}
              <div className="lg:col-span-7 border border-[#1A1209] bg-white dark:bg-[#1D1814] flex flex-col">
                <div className="p-3 bg-[#F4EFE6] dark:bg-[#26201B] border-b border-[#1A1209] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const studentsList = (matrixData?.students || []).filter((s: any) => {
                          if (unassignedOnly && s.assigned_batch_id) return false;
                          if (studentSearch.trim()) {
                            const term = studentSearch.toLowerCase();
                            return (
                              s.full_name?.toLowerCase().includes(term) ||
                              s.roll_number?.toLowerCase().includes(term) ||
                              s.prn?.toLowerCase().includes(term)
                            );
                          }
                          return true;
                        });
                        if (selectedStudentIds.length === studentsList.length) {
                          setSelectedStudentIds([]);
                        } else {
                          setSelectedStudentIds(studentsList.map((s: any) => s.user_id));
                        }
                      }}
                      className="px-2 py-0.5 bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-white border border-[#1A1209] text-[10px] font-bold"
                    >
                      Toggle All
                    </button>
                    <span className="font-bold text-xs uppercase text-[#1A1209] dark:text-white">
                      Division Student Roster ({batchBranch} {batchDiv})
                    </span>
                  </div>
                  <span className="text-[10px] text-[#786958]">
                    Click row to select, or switch batch via dropdown
                  </span>
                </div>

                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF6EE] dark:bg-[#1D1814] border-b border-[#1A1209] text-[10px] uppercase sticky top-0">
                      <tr>
                        <th className="p-2.5 w-8 text-center">
                          <CheckSquare className="w-3.5 h-3.5 mx-auto text-[#786958]" />
                        </th>
                        <th className="p-2.5">Roll No.</th>
                        <th className="p-2.5">Student Name / PRN</th>
                        <th className="p-2.5">Batch Status</th>
                        <th className="p-2.5 text-right">Quick Switch</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E0D8C8] dark:divide-[#332A24]">
                      {(() => {
                        const filtered = (matrixData?.students || []).filter((s: any) => {
                          if (unassignedOnly && s.assigned_batch_id) return false;
                          if (studentSearch.trim()) {
                            const term = studentSearch.toLowerCase();
                            return (
                              s.full_name?.toLowerCase().includes(term) ||
                              s.roll_number?.toLowerCase().includes(term) ||
                              s.prn?.toLowerCase().includes(term)
                            );
                          }
                          return true;
                        });

                        if (filtered.length === 0) {
                          return (
                            <tr>
                              <td colSpan={5} className="p-8 text-center text-[#786958]">
                                No students found for this division / filter criteria.
                              </td>
                            </tr>
                          );
                        }

                        return filtered.map((s: any) => {
                          const isSelected = selectedStudentIds.includes(s.user_id);
                          return (
                            <tr
                              key={s.user_id}
                              className={`hover:bg-[#FAF6EE] dark:hover:bg-[#231C17] cursor-pointer ${
                                isSelected ? 'bg-[#FFF8E7] dark:bg-[#2A231C]' : ''
                              }`}
                              onClick={(e) => {
                                if ((e.target as HTMLElement).tagName === 'SELECT') return;
                                setSelectedStudentIds((prev) =>
                                  isSelected ? prev.filter((id) => id !== s.user_id) : [...prev, s.user_id]
                                );
                              }}
                            >
                              <td className="p-2.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {}}
                                  className="cursor-pointer"
                                />
                              </td>
                              <td className="p-2.5 font-bold text-[#B84915]">{s.roll_number}</td>
                              <td className="p-2.5">
                                <span className="font-bold text-[#1A1209] dark:text-white block">{s.full_name}</span>
                                <span className="text-[10px] text-[#786958]">{s.prn || 'No PRN recorded'}</span>
                              </td>
                              <td className="p-2.5">
                                {s.assigned_batch_name ? (
                                  <span className="px-2 py-0.5 bg-[#EBF8EE] text-[#1F5A2E] border border-[#1F5A2E] text-[10px] font-bold">
                                    {s.assigned_batch_name}
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-[#FFF5F5] text-[#8B1A1A] border border-[#8B1A1A] text-[10px] font-bold">
                                    UNASSIGNED
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 text-right">
                                <select
                                  value={s.assigned_batch_id || ''}
                                  onChange={(e) => {
                                    const newBatchId = e.target.value;
                                    if (newBatchId) {
                                      handleBatchManualAssign(newBatchId, [s.user_id]);
                                    } else {
                                      handleBatchUnassign(s.assigned_batch_id, [s.user_id]);
                                    }
                                  }}
                                  className="px-2 py-1 bg-white dark:bg-[#1D1814] border border-[#1A1209] text-[10px] font-bold font-mono"
                                >
                                  <option value="">(Unassign)</option>
                                  {(matrixData?.batches || batches).map((b: any) => (
                                    <option key={b.id} value={b.id}>
                                      {b.batch_name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right Panel: Active Laboratory Batches Pods (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="p-3 bg-[#F4EFE6] dark:bg-[#26201B] border border-[#1A1209] flex items-center justify-between">
                  <span className="font-bold text-xs uppercase text-[#1A1209] dark:text-white flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#1F5A2E]" /> Active Laboratory Practical Pods
                  </span>
                  <span className="text-[10px] text-[#786958]">
                    {(matrixData?.batches || batches).length} Batches
                  </span>
                </div>

                {!(matrixData?.batches || batches).length ? (
                  <div className="p-8 text-center bg-[#FAF6EE] dark:bg-[#231C17] border border-[#1A1209] text-[#786958]">
                    No lab batches configured for this division. Click 'CREATE LAB BATCH' above.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(matrixData?.batches || batches).map((b: any) => {
                      const studentCount = b.student_count || (b.student_ids ? b.student_ids.length : 0);
                      const percent = Math.min(100, Math.round((studentCount / (b.capacity || 20)) * 100));
                      // Find students enrolled in this batch
                      const enrolledInThisBatch = (matrixData?.students || []).filter(
                        (s: any) => s.assigned_batch_id === b.id
                      );

                      return (
                        <div
                          key={b.id}
                          className="p-4 bg-[#FAF6EE] dark:bg-[#231C17] border-2 border-[#1A1209] shadow-[3px_3px_0px_#1A1209] space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-black text-sm text-[#1A1209] dark:text-white">
                                {b.batch_name}
                              </span>
                              <span className="text-[10px] text-[#786958] block">
                                {b.branch_code} {b.division_name} ({b.year_level})
                              </span>
                            </div>

                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold border ${
                                studentCount > b.capacity
                                  ? 'bg-[#FFF5F5] text-[#8B1A1A] border-[#8B1A1A]'
                                  : studentCount === b.capacity
                                  ? 'bg-[#FFF8E7] text-[#B84915] border-[#B84915]'
                                  : 'bg-[#EBF8EE] text-[#1F5A2E] border-[#1F5A2E]'
                              }`}
                            >
                              {studentCount} / {b.capacity} Enrolled
                            </span>
                          </div>

                          {/* Capacity Progress Bar */}
                          <div className="w-full bg-[#E0D8C8] dark:bg-[#332A24] h-2 border border-[#1A1209] overflow-hidden">
                            <div
                              className={`h-full ${
                                percent > 100 ? 'bg-[#8B1A1A]' : percent >= 80 ? 'bg-[#B84915]' : 'bg-[#1F5A2E]'
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>

                          {/* Enrolled Students Roster with Remove Button */}
                          <div className="pt-2 border-t border-[#E0D8C8] dark:border-[#332A24] space-y-1.5">
                            <span className="text-[9px] uppercase font-bold text-[#786958] block">
                              Enrolled Members ({enrolledInThisBatch.length}):
                            </span>
                            {enrolledInThisBatch.length === 0 ? (
                              <p className="text-[10px] text-[#786958] italic">No students allocated yet.</p>
                            ) : (
                              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                                {enrolledInThisBatch.map((stu: any) => (
                                  <div
                                    key={stu.user_id}
                                    className="px-2 py-1 bg-white dark:bg-[#1D1814] border border-[#1A1209] text-[10px] flex items-center gap-1.5"
                                  >
                                    <span className="font-bold text-[#B84915]">{stu.roll_number}</span>
                                    <span className="truncate max-w-[90px]">{stu.full_name}</span>
                                    <button
                                      onClick={() => handleBatchUnassign(b.id, [stu.user_id])}
                                      className="text-[#8B1A1A] hover:text-black font-bold p-0.5"
                                      title="Remove from batch"
                                    >
                                      &times;
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 5: OPEN ELECTIVES */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'electives' && (
        <div className="space-y-6 font-mono text-xs">
          <div className="bg-white dark:bg-[#1D1814] p-5 border-2 border-[#1A1209] shadow-[3.5px_3.5px_0px_#1A1209] space-y-4">
            <div>
              <h3 className="text-base font-black text-[#1A1209] dark:text-white flex items-center gap-2">
                <Share2 className="w-4 h-4 text-[#1A365D]" /> Open Elective Offerings & Student Preference Registrations
              </h3>
              <p className="text-xs text-[#5C4D3C] dark:text-[#A89886] mt-0.5">
                Manage interdisciplinary institute-level open electives, monitor capacity constraints, and approve student selections.
              </p>
            </div>

            {/* Offerings Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {electiveConfigs.map((ec) => (
                <div key={ec.id} className="p-4 bg-[#FAF6EE] dark:bg-[#231C17] border-2 border-[#1A1209] space-y-2">
                  <span className="text-xs font-bold text-[#B84915]">{ec.subject_code}</span>
                  <h4 className="text-sm font-black text-[#1A1209] dark:text-white">{ec.subject_name}</h4>
                  <div className="flex items-center justify-between text-[11px] pt-2 border-t border-[#E0D8C8] dark:border-[#332A24]">
                    <span>Credits: {ec.credits}</span>
                    <span className="text-[#1F5A2E] font-bold">Capacity: {ec.enrolled_count}/{ec.max_capacity}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Student Selections Table */}
            <h4 className="text-sm font-black text-[#1A1209] dark:text-white uppercase pt-4 border-t border-[#E0D8C8]">
              Student Elective Selections & Review Panel ({electiveSelections.length})
            </h4>

            <div className="border border-[#1A1209] overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F4EFE6] dark:bg-[#26201B] border-b border-[#1A1209] text-[10px] uppercase">
                  <tr>
                    <th className="p-2.5">Roll No</th>
                    <th className="p-2.5">Student Name</th>
                    <th className="p-2.5">Selected Elective</th>
                    <th className="p-2.5">Code</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5 text-right">Approval Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E0D8C8] dark:divide-[#332A24]">
                  {electiveSelections.map((sel) => (
                    <tr key={sel.id} className="hover:bg-[#FAF6EE] dark:hover:bg-[#231C17]">
                      <td className="p-2.5 font-bold text-[#B84915]">{sel.roll_number}</td>
                      <td className="p-2.5 font-medium">{sel.student_name}</td>
                      <td className="p-2.5">{sel.subject_name}</td>
                      <td className="p-2.5 text-[#786958]">{sel.subject_code}</td>
                      <td className="p-2.5">
                        <span
                          className={`px-2 py-0.5 text-[9px] uppercase font-bold border ${
                            sel.status === 'approved'
                              ? 'bg-[#EBF8EE] text-[#1F5A2E] border-[#1F5A2E]'
                              : 'bg-[#FFF8E7] text-[#B84915] border-[#B84915]'
                          }`}
                        >
                          {sel.status}
                        </span>
                      </td>
                      <td className="p-2.5 text-right">
                        {sel.status === 'pending' && (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleReviewElective(sel.id, 'approved')}
                              className="px-2 py-1 bg-[#1F5A2E] text-white text-[10px] hover:bg-[#164422]"
                            >
                              APPROVE
                            </button>
                            <button
                              onClick={() => handleReviewElective(sel.id, 'rejected')}
                              className="px-2 py-1 bg-[#8B1A1A] text-white text-[10px] hover:bg-[#681313]"
                            >
                              REJECT
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 6: ACADEMIC YEAR PROMOTIONS */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'promotions' && (
        <AdminPromotionManagement />
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 7: INTEGRITY & SECURITY MONITORING */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'integrity' && (
        <div className="space-y-4 font-mono text-xs">
          <div className="bg-white dark:bg-[#1D1814] p-4 border-2 border-[#1A1209] shadow-[3.5px_3.5px_0px_#1A1209] flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-[#8B1A1A] flex items-center gap-2 uppercase">
                <ShieldAlert className="w-4 h-4" /> Academic Integrity & Anti-Paste Telemetry Ledger
              </h3>
              <p className="text-xs text-[#5C4D3C] dark:text-[#A89886] mt-0.5">
                Real-time capture of external copy-paste attempts, browser window blur events, and unnatural typing cadence anomalies.
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[4px_4px_0px_#1A1209] overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F4EFE6] dark:bg-[#26201B] border-b-2 border-[#1A1209] uppercase text-[10px]">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Student Name</th>
                  <th className="p-3">Roll No</th>
                  <th className="p-3">Event Anomaly</th>
                  <th className="p-3">Severity</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Review Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0D8C8] dark:divide-[#332A24]">
                {integrityEvents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-[#786958]">
                      No security or academic integrity anomalies logged.
                    </td>
                  </tr>
                ) : (
                  integrityEvents.map((ev) => (
                    <tr key={ev.id} className="hover:bg-[#FAF6EE] dark:hover:bg-[#231C17]">
                      <td className="p-3 text-[#786958]">{ev.timestamp.substring(0, 19).replace('T', ' ')}</td>
                      <td className="p-3 font-medium">{ev.student_name || 'Demo Student'}</td>
                      <td className="p-3 font-bold text-[#B84915]">{ev.roll_number || '21CE104'}</td>
                      <td className="p-3 font-mono font-bold text-[#8B1A1A]">
                        {ev.event_type.replace('_', ' ').toUpperCase()}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 text-[9px] uppercase font-bold border ${
                            ev.severity === 'high'
                              ? 'bg-[#FFF5F5] text-[#8B1A1A] border-[#8B1A1A]'
                              : 'bg-[#FFF8E7] text-[#B84915] border-[#B84915]'
                          }`}
                        >
                          {ev.severity}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-[9px] font-bold uppercase border">
                          {ev.review_status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleReviewIntegrityEvent(ev.id, 'reviewed')}
                            className="px-2 py-1 bg-[#1A365D] text-white text-[10px] hover:bg-[#12243F]"
                          >
                            CONFIRM VIOLATION
                          </button>
                          <button
                            onClick={() => handleReviewIntegrityEvent(ev.id, 'dismissed')}
                            className="px-2 py-1 bg-[#FAF6EE] text-[#1A1209] text-[10px] hover:bg-[#E0D8C8] border border-[#1A1209]"
                          >
                            DISMISS
                          </button>
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
      {/* TAB 8: GRADING LEDGER & EXPORTS */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'ledger' && (
        <div className="space-y-6 font-mono text-xs">
          <div className="bg-white dark:bg-[#1D1814] p-5 border-2 border-[#1A1209] shadow-[3.5px_3.5px_0px_#1A1209] space-y-4">
            <div>
              <h3 className="text-base font-black text-[#1F5A2E] flex items-center gap-2 uppercase">
                <FileCheck className="w-4 h-4" /> Institutional Grading Ledger & Accreditation Reports
              </h3>
              <p className="text-xs text-[#5C4D3C] dark:text-[#A89886] mt-0.5">
                Download verified academic records, criteria-by-criteria scores, digital stamp signatures, and anti-paste integrity logs.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 bg-[#FAF6EE] dark:bg-[#231C17] border-2 border-[#1A1209] space-y-2">
                <h4 className="font-bold text-[#1A1209] dark:text-white text-sm">Grading Ledger CSV Export</h4>
                <p className="text-[11px] text-[#786958]">
                  Complete roster of submissions, rubrics, digital stamp hashes, and marks awarded across all departments.
                </p>
                <button
                  onClick={() => api.exports.downloadGradingLedgerCsv()}
                  className="neo-btn px-4 py-2 bg-[#1F5A2E] text-white hover:bg-[#164422] flex items-center gap-2 text-xs"
                >
                  <Download className="w-3.5 h-3.5" /> DOWNLOAD GRADING LEDGER (.CSV)
                </button>
              </div>

              <div className="p-4 bg-[#FAF6EE] dark:bg-[#231C17] border-2 border-[#1A1209] space-y-2">
                <h4 className="font-bold text-[#1A1209] dark:text-white text-sm">Integrity Audit Telemetry CSV Export</h4>
                <p className="text-[11px] text-[#786958]">
                  Export of security events, clipboard interception records, and typing anomaly metrics.
                </p>
                <button
                  onClick={() => api.exports.downloadIntegrityLedgerCsv()}
                  className="neo-btn px-4 py-2 bg-[#8B1A1A] text-white hover:bg-[#681313] flex items-center gap-2 text-xs"
                >
                  <Download className="w-3.5 h-3.5" /> DOWNLOAD INTEGRITY LEDGER (.CSV)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODALS: ADD SUBJECT, CLONE, CREATE BATCH, PROMOTION WINDOW */}
      {/* ---------------------------------------------------- */}
      {showAddSubjectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[6px_6px_0px_#1A1209] p-6 max-w-md w-full font-mono text-xs space-y-4">
            <div className="flex items-center justify-between border-b pb-2 border-[#E0D8C8]">
              <h3 className="text-base font-black uppercase text-[#1A1209] dark:text-white">Add Subject to Master Catalog</h3>
              <button onClick={() => setShowAddSubjectModal(false)} className="text-[#786958] hover:text-black">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubject} className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase font-bold mb-1">Subject Name:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Distributed Computing"
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] uppercase font-bold mb-1">Subject Code:</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CSC703"
                    value={newSubCode}
                    onChange={(e) => setNewSubCode(e.target.value)}
                    className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold mb-1">Branch:</label>
                  <select
                    value={newSubBranch}
                    onChange={(e) => setNewSubBranch(e.target.value)}
                    className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]"
                  >
                    <option value="CE">CE</option>
                    <option value="IT">IT</option>
                    <option value="EXTC">EXTC</option>
                    <option value="AIDS">AIDS</option>
                    <option value="MECH">MECH</option>
                    <option value="CIVIL">CIVIL</option>
                    <option value="ASH">ASH</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] uppercase font-bold mb-1">Semester:</label>
                  <select
                    value={newSubSem}
                    onChange={(e) => setNewSubSem(Number(e.target.value))}
                    className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={s}>
                        Sem {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold mb-1">Credits:</label>
                  <input
                    type="number"
                    step="0.5"
                    value={newSubCredits}
                    onChange={(e) => setNewSubCredits(Number(e.target.value))}
                    className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold mb-1">Category:</label>
                  <select
                    value={newSubCategory}
                    onChange={(e) => setNewSubCategory(e.target.value)}
                    className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]"
                  >
                    <option value="Core">Core</option>
                    <option value="Elective">Elective</option>
                    <option value="Open Elective">Open Elective</option>
                    <option value="Lab">Lab</option>
                    <option value="Project">Project</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddSubjectModal(false)}
                  className="px-3 py-1.5 bg-gray-200 text-[#1A1209] hover:bg-gray-300"
                >
                  CANCEL
                </button>
                <button type="submit" className="px-4 py-1.5 bg-[#1A365D] text-white hover:bg-[#12243F]">
                  SAVE SUBJECT
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCloneModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[6px_6px_0px_#1A1209] p-6 max-w-md w-full font-mono text-xs space-y-4">
            <div className="flex items-center justify-between border-b pb-2 border-[#E0D8C8]">
              <h3 className="text-base font-black uppercase text-[#1A1209] dark:text-white">Clone Curriculum to Academic Year</h3>
              <button onClick={() => setShowCloneModal(false)} className="text-[#786958] hover:text-black">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[#786958] text-[11px]">
              Safely duplicates an existing academic cycle's syllabi into a target cycle without altering historical document or evaluation records.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase font-bold mb-1">Source Academic Year:</label>
                <input
                  type="text"
                  value={cloneSourceYear}
                  onChange={(e) => setCloneSourceYear(e.target.value)}
                  className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold mb-1">Target Academic Year:</label>
                <input
                  type="text"
                  value={cloneTargetYear}
                  onChange={(e) => setCloneTargetYear(e.target.value)}
                  className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold mb-1">Branch:</label>
                <select
                  value={cloneBranch}
                  onChange={(e) => setCloneBranch(e.target.value)}
                  className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]"
                >
                  <option value="CE">Computer Engg (CE)</option>
                  <option value="IT">Info Tech (IT)</option>
                  <option value="EXTC">Electronics (EXTC)</option>
                  <option value="AIDS">AI & Data Science (AIDS)</option>
                  <option value="MECH">Mechanical (MECH)</option>
                  <option value="CIVIL">Civil Engg (CIVIL)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCloneModal(false)}
                className="px-3 py-1.5 bg-gray-200 text-[#1A1209]"
              >
                CANCEL
              </button>
              <button onClick={handleCloneCurriculum} className="px-4 py-1.5 bg-[#B84915] text-white">
                EXECUTE CLONE
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateBatchModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[6px_6px_0px_#1A1209] p-6 max-w-md w-full font-mono text-xs space-y-4">
            <div className="flex items-center justify-between border-b pb-2 border-[#E0D8C8]">
              <h3 className="text-base font-black uppercase text-[#1A1209] dark:text-white">Create Laboratory Batch</h3>
              <button onClick={() => setShowCreateBatchModal(false)} className="text-[#786958] hover:text-black">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBatch} className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase font-bold mb-1">Batch Identifier Name:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Batch A3"
                  value={newBatchName}
                  onChange={(e) => setNewBatchName(e.target.value)}
                  className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] uppercase font-bold mb-1">Branch:</label>
                  <select
                    value={batchBranch}
                    onChange={(e) => setBatchBranch(e.target.value)}
                    className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]"
                  >
                    <option value="CE">CE</option>
                    <option value="IT">IT</option>
                    <option value="EXTC">EXTC</option>
                    <option value="AIDS">AIDS</option>
                    <option value="MECH">MECH</option>
                    <option value="CIVIL">CIVIL</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold mb-1">Division:</label>
                  <select
                    value={batchDiv}
                    onChange={(e) => setBatchDiv(e.target.value)}
                    className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]"
                  >
                    <option value="Div A">Div A</option>
                    <option value="Div B">Div B</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold mb-1">Student Capacity Limit:</label>
                <input
                  type="number"
                  value={newBatchCapacity}
                  onChange={(e) => setNewBatchCapacity(Number(e.target.value))}
                  className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateBatchModal(false)}
                  className="px-3 py-1.5 bg-gray-200 text-[#1A1209]"
                >
                  CANCEL
                </button>
                <button type="submit" className="px-4 py-1.5 bg-[#1F5A2E] text-white">
                  CONFIRM BATCH
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showNewWindowModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[6px_6px_0px_#1A1209] p-6 max-w-md w-full font-mono text-xs space-y-4">
            <div className="flex items-center justify-between border-b pb-2 border-[#E0D8C8]">
              <h3 className="text-base font-black uppercase text-[#1A1209] dark:text-white">Open Academic Promotion Window</h3>
              <button onClick={() => setShowNewWindowModal(false)} className="text-[#786958] hover:text-black">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePromotionWindow} className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase font-bold mb-1">Window Title:</label>
                <input
                  type="text"
                  required
                  value={newWinTitle}
                  onChange={(e) => setNewWinTitle(e.target.value)}
                  className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] uppercase font-bold mb-1">Source Cycle:</label>
                  <input
                    type="text"
                    value={newWinSrcYear}
                    onChange={(e) => setNewWinSrcYear(e.target.value)}
                    className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold mb-1">Target Cycle:</label>
                  <input
                    type="text"
                    value={newWinTgtYear}
                    onChange={(e) => setNewWinTgtYear(e.target.value)}
                    className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] uppercase font-bold mb-1">Source Level:</label>
                  <select
                    value={newWinSrcLevel}
                    onChange={(e) => setNewWinSrcLevel(e.target.value)}
                    className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]"
                  >
                    <option value="FE">FE</option>
                    <option value="SE">SE</option>
                    <option value="TE">TE</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold mb-1">Target Level:</label>
                  <select
                    value={newWinTgtLevel}
                    onChange={(e) => setNewWinTgtLevel(e.target.value)}
                    className="w-full p-2 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209]"
                  >
                    <option value="SE">SE</option>
                    <option value="TE">TE</option>
                    <option value="BE">BE</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewWindowModal(false)}
                  className="px-3 py-1.5 bg-gray-200 text-[#1A1209]"
                >
                  CANCEL
                </button>
                <button type="submit" className="px-4 py-1.5 bg-[#B84915] text-white">
                  OPEN WINDOW
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
