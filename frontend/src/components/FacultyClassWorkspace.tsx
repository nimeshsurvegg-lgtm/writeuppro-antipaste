import React, { useState, useMemo } from 'react';
import {
  Folder, FolderOpen, Clock, AlertTriangle, BookOpen, CheckCircle2,
  Search, Filter, Eye, CheckSquare, Layers, Award, ChevronRight,
  ArrowUpDown, Grid, List, RefreshCw, Users, FileCheck, BarChart2,
  Calendar, AlertCircle
} from 'lucide-react';
import {
  FacultyTeachingFolders, PendingEvaluationQueueItem, FacultyClassFolder,
  FacultySubjectSubfolder, FacultyBatchFolder, OverdueUnsubmittedTask
} from '../types';

interface FacultyClassWorkspaceProps {
  teachingFolders: FacultyTeachingFolders | null;
  loading: boolean;
  onRefresh: () => void;
  onEvaluateSubmission: (submission: any) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const FacultyClassWorkspace: React.FC<FacultyClassWorkspaceProps> = ({
  teachingFolders,
  loading,
  onRefresh,
  onEvaluateSubmission,
  showToast
}) => {
  // Navigation: 'root' | 'class_detail' | 'subject_detail' | 'batch_detail'
  const [currentNav, setCurrentNav] = useState<'root' | 'class_detail' | 'subject_detail' | 'batch_detail'>('root');
  const [selectedClass, setSelectedClass] = useState<FacultyClassFolder | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<FacultySubjectSubfolder | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<FacultyBatchFolder | null>(null);

  // Subject subfolder tab: 'assignments' | 'experiments' | 'special_docs' | 'submissions' | 'evaluations' | 'performance'
  const [subjectTab, setSubjectTab] = useState<'assignments' | 'experiments' | 'special_docs' | 'submissions' | 'evaluations' | 'performance'>('assignments');

  // Pending evaluations queue filters
  const [queueSearch, setQueueSearch] = useState<string>('');
  const [queueClassFilter, setQueueClassFilter] = useState<string>('ALL');
  const [queueSubjectFilter, setQueueSubjectFilter] = useState<string>('ALL');
  const [queueTypeFilter, setQueueTypeFilter] = useState<string>('ALL');
  const [queueLateFilter, setQueueLateFilter] = useState<string>('ALL');
  const [showOverdueTasks, setShowOverdueTasks] = useState<boolean>(false);

  // Filtered Evaluation Queue:
  // Strict sort:
  // 1. Oldest pending submission first (created_at ASC)
  // 2. Submission date
  // 3. Subject and class
  const filteredQueue = useMemo(() => {
    if (!teachingFolders?.pending_evaluations_queue) return [];
    let list = [...teachingFolders.pending_evaluations_queue];

    if (queueClassFilter !== 'ALL') {
      list = list.filter((item) => `${item.year_level} ${item.division_name}` === queueClassFilter || item.division_name === queueClassFilter);
    }
    if (queueSubjectFilter !== 'ALL') {
      list = list.filter((item) => item.subject_id === queueSubjectFilter || item.subject_name === queueSubjectFilter);
    }
    if (queueTypeFilter !== 'ALL') {
      list = list.filter((item) => item.task_type === queueTypeFilter);
    }
    if (queueLateFilter === 'late') {
      list = list.filter((item) => Boolean(item.is_late));
    } else if (queueLateFilter === 'ontime') {
      list = list.filter((item) => !item.is_late);
    }

    if (queueSearch.trim()) {
      const q = queueSearch.toLowerCase();
      list = list.filter(
        (item) =>
          item.student_name.toLowerCase().includes(q) ||
          (item.roll_number || '').toLowerCase().includes(q) ||
          item.task_title.toLowerCase().includes(q) ||
          item.subject_name.toLowerCase().includes(q)
      );
    }

    // Oldest pending submission first (created_at ASC)
    list.sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      if (ta !== tb) return ta - tb;
      return a.subject_name.localeCompare(b.subject_name);
    });

    return list;
  }, [teachingFolders, queueClassFilter, queueSubjectFilter, queueTypeFilter, queueLateFilter, queueSearch]);

  const getTaskTypeBadge = (type: string) => {
    switch (type) {
      case 'Assignment':
        return 'bg-[#B84915] text-white';
      case 'Experiment':
        return 'bg-[#1F5A2E] text-white';
      case 'Special Document':
        return 'bg-[#6B46C1] text-white';
      default:
        return 'bg-[#1A365D] text-white';
    }
  };

  return (
    <div className="space-y-6 font-mono">
      {/* ========================================================================= */}
      {/* BREADCRUMB NAVIGATION BAR                                                 */}
      {/* ========================================================================= */}
      <div className="p-3 bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[3px_3px_0px_#1A1209] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => {
              setCurrentNav('root');
              setSelectedClass(null);
              setSelectedSubject(null);
              setSelectedBatch(null);
            }}
            className={`flex items-center gap-1 px-2.5 py-1 font-bold ${
              currentNav === 'root'
                ? 'bg-[#1A365D] text-white shadow-[1.5px_1.5px_0px_#1A1209]'
                : 'bg-[#FAF6EE] dark:bg-[#12100E] text-[#1A1209] dark:text-[#D4C7B5] hover:bg-[#EAE4D5]'
            } border border-[#1A1209]`}
          >
            <Folder className="w-3.5 h-3.5 text-[#B84915]" /> My Classes
          </button>

          {selectedClass && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-[#786958]" />
              <button
                onClick={() => {
                  setCurrentNav('class_detail');
                  setSelectedSubject(null);
                  setSelectedBatch(null);
                }}
                className={`flex items-center gap-1 px-2 py-1 font-bold border border-[#1A1209] ${
                  currentNav === 'class_detail'
                    ? 'bg-[#1F5A2E] text-white shadow-[1.5px_1.5px_0px_#1A1209]'
                    : 'bg-[#FAF6EE] dark:bg-[#12100E] text-[#1A1209] dark:text-[#D4C7B5]'
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5" /> {selectedClass.class_name}
              </button>
            </>
          )}

          {selectedSubject && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-[#786958]" />
              <span className="flex items-center gap-1 px-2.5 py-1 bg-[#B84915] text-white font-bold border border-[#1A1209]">
                <BookOpen className="w-3.5 h-3.5" /> {selectedSubject.name} ({selectedSubject.code})
              </span>
            </>
          )}

          {selectedBatch && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-[#786958]" />
              <span className="flex items-center gap-1 px-2.5 py-1 bg-[#6B46C1] text-white font-bold border border-[#1A1209]">
                <Users className="w-3.5 h-3.5" /> {selectedBatch.batch_name}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {currentNav !== 'root' && (
            <button
              onClick={() => {
                if (currentNav === 'subject_detail' || currentNav === 'batch_detail') {
                  setCurrentNav('class_detail');
                  setSelectedSubject(null);
                  setSelectedBatch(null);
                } else {
                  setCurrentNav('root');
                  setSelectedClass(null);
                }
              }}
              className="px-2.5 py-1 bg-[#FAF6EE] dark:bg-[#26201B] hover:bg-[#E5DFD3] text-[#1A1209] dark:text-white font-bold border border-[#1A1209]"
            >
              &larr; UP LEVEL
            </button>
          )}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="px-2.5 py-1 bg-[#FAF6EE] dark:bg-[#26201B] hover:bg-[#E5DFD3] text-[#1A1209] dark:text-white border border-[#1A1209] flex items-center gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: FACULTY SUBMISSION PRIORITY (PENDING EVALUATIONS QUEUE)         */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[4px_4px_0px_#1A1209]">
        <div className="p-4 bg-[#FFFAF1] dark:bg-[#231C17] border-b-2 border-[#1A1209] flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 bg-[#1F5A2E] text-white font-bold text-[10px] uppercase border border-[#1A1209]">
                Evaluation Queue
              </span>
              <span className="text-[10px] text-[#786958]">
                Sorted oldest pending submission first to clear backlog
              </span>
            </div>
            <h2 className="text-sm font-black uppercase text-[#1A1209] dark:text-white flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-[#1F5A2E]" /> PENDING EVALUATIONS PRIORITY QUEUE
            </h2>
            <p className="text-xs text-[#786958] mt-0.5">
              Authorized student submissions awaiting your evaluation and rubric grading across all assigned classes.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowOverdueTasks(!showOverdueTasks)}
              className={`px-3 py-1.5 text-xs font-bold border border-[#1A1209] flex items-center gap-1.5 ${
                showOverdueTasks
                  ? 'bg-[#B91C1C] text-white shadow-[2px_2px_0px_#1A1209]'
                  : 'bg-[#FAF6EE] dark:bg-[#12100E] text-[#B91C1C]'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {showOverdueTasks ? 'Hide Overdue Missing Tasks' : 'Show Overdue Missing Tasks'}
              <span className="ml-1 px-1.5 py-0.2 bg-white text-black text-[9px] font-bold">
                {teachingFolders?.overdue_unsubmitted_tasks?.length || 0}
              </span>
            </button>
          </div>
        </div>

        {/* Overdue missing student submissions alert section */}
        {showOverdueTasks && (
          <div className="p-4 bg-[#FFF5F5] dark:bg-[#2A1515] border-b-2 border-[#1A1209] space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#B91C1C]">
              <AlertCircle className="w-4 h-4" />
              OVERDUE ASSESSMENTS AWAITING STUDENT SUBMISSIONS (PAST DEADLINE)
            </div>
            <p className="text-[11px] text-[#786958]">
              Note: Missing student submissions are NOT pending faculty evaluations. These tasks require student submission.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {teachingFolders?.overdue_unsubmitted_tasks?.map((ot, idx) => (
                <div key={ot.task_id + idx} className="p-3 bg-white dark:bg-[#1D1814] border border-[#1A1209] text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#1A1209] dark:text-white line-clamp-1">{ot.title}</span>
                    <span className="px-1.5 py-0.5 bg-[#B91C1C] text-white text-[9px] font-bold">
                      {ot.missing_count} Missing
                    </span>
                  </div>
                  <div className="text-[10px] text-[#786958] mt-1">
                    {ot.subject_name} &bull; Div: {ot.division_name} &bull; Due: {ot.due_date ? ot.due_date.replace('T', ' ').substring(0, 16) : 'N/A'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter bar */}
        <div className="p-3 bg-[#FAF6EE] dark:bg-[#1A1613] border-b-2 border-[#1A1209] flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="relative min-w-[180px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#786958]" />
              <input
                type="text"
                placeholder="Filter student or task..."
                value={queueSearch}
                onChange={(e) => setQueueSearch(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1 bg-white dark:bg-[#1D1814] border border-[#1A1209] text-xs"
              />
            </div>

            <select
              value={queueTypeFilter}
              onChange={(e) => setQueueTypeFilter(e.target.value)}
              className="px-2.5 py-1 bg-white dark:bg-[#1D1814] border border-[#1A1209] text-xs font-bold"
            >
              <option value="ALL">All Types</option>
              <option value="Assignment">Assignments</option>
              <option value="Experiment">Experiments</option>
              <option value="Special Document">Special Documents</option>
            </select>

            <select
              value={queueLateFilter}
              onChange={(e) => setQueueLateFilter(e.target.value)}
              className="px-2.5 py-1 bg-white dark:bg-[#1D1814] border border-[#1A1209] text-xs"
            >
              <option value="ALL">All Delivery Statuses</option>
              <option value="ontime">Submitted On Time</option>
              <option value="late">Late Submissions</option>
            </select>
          </div>

          <div className="text-[11px] text-[#786958]">
            Showing <strong>{filteredQueue.length}</strong> pending items
          </div>
        </div>

        {/* Queue Items Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF6EE] dark:bg-[#26201B] border-b-2 border-[#1A1209] uppercase text-[10px]">
              <tr>
                <th className="p-2.5 border-r border-[#1A1209]">Student</th>
                <th className="p-2.5 border-r border-[#1A1209]">Assessment Title</th>
                <th className="p-2.5 border-r border-[#1A1209]">Course & Group</th>
                <th className="p-2.5 border-r border-[#1A1209]">Submitted At</th>
                <th className="p-2.5 border-r border-[#1A1209]">Late / On-Time</th>
                <th className="p-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A1209]">
              {filteredQueue.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[#786958]">
                    <CheckCircle2 className="w-6 h-6 text-[#1F5A2E] mx-auto mb-1" />
                    Zero submissions waiting in evaluation queue. Evaluation backlog is fully cleared!
                  </td>
                </tr>
              ) : (
                filteredQueue.map((item, idx) => (
                  <tr key={item.submission_id + idx} className="hover:bg-[#FAF6EE] dark:hover:bg-[#26201B]">
                    <td className="p-2.5 border-r border-[#1A1209] whitespace-nowrap">
                      <div className="font-bold text-[#1A1209] dark:text-white">{item.student_name}</div>
                      <div className="text-[10px] text-[#786958]">
                        Roll: <strong>{item.roll_number || 'N/A'}</strong> {item.prn ? `(${item.prn})` : ''}
                      </div>
                    </td>
                    <td className="p-2.5 border-r border-[#1A1209]">
                      <div className="font-bold text-[#1A1209] dark:text-white line-clamp-1">{item.task_title}</div>
                      <span className={`inline-block px-1.5 py-0.2 mt-0.5 text-[9px] font-bold uppercase border border-[#1A1209] ${getTaskTypeBadge(item.task_type)}`}>
                        {item.task_type}
                      </span>
                    </td>
                    <td className="p-2.5 border-r border-[#1A1209]">
                      <div>{item.subject_name}</div>
                      <div className="text-[10px] text-[#786958]">
                        {item.year_level} &bull; {item.division_name} {item.batch_name ? `(${item.batch_name})` : ''}
                      </div>
                    </td>
                    <td className="p-2.5 border-r border-[#1A1209] whitespace-nowrap">
                      <div className="font-bold">{item.submission_date}</div>
                      <div className="text-[10px] text-[#786958]">Queued: {item.created_at.substring(0, 10)}</div>
                    </td>
                    <td className="p-2.5 border-r border-[#1A1209] whitespace-nowrap">
                      {item.is_late ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#B91C1C] text-white text-[10px] font-bold border border-[#1A1209]">
                          <AlertTriangle className="w-3 h-3" /> {item.delay_text}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#1F5A2E] text-white text-[10px] font-bold border border-[#1A1209]">
                          <CheckCircle2 className="w-3 h-3" /> ON TIME
                        </span>
                      )}
                    </td>
                    <td className="p-2.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => onEvaluateSubmission(item)}
                        className="px-3 py-1 bg-[#1F5A2E] hover:bg-[#174623] text-white text-xs font-bold border border-[#1A1209] shadow-[1.5px_1.5px_0px_#1A1209] flex items-center gap-1 ml-auto"
                      >
                        <Award className="w-3 h-3" /> GRADE & SIGN &rarr;
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: CLASS FOLDERS WORKSPACE                                        */}
      {/* ========================================================================= */}
      {currentNav === 'root' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black uppercase text-[#1A1209] dark:text-white flex items-center gap-2">
                <Folder className="w-4 h-4 text-[#1A365D]" /> AUTHORIZED CLASS FOLDERS
              </h2>
              <p className="text-xs text-[#786958]">
                Classes dynamically organized by your teaching allocations (Academic Year + Branch + Year Level + Division).
              </p>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 bg-[#FAF6EE] dark:bg-[#1D1814] border border-[#1A1209]">
              {teachingFolders?.class_folders?.length || 0} Classes Assigned
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teachingFolders?.class_folders?.map((cf) => (
              <div
                key={cf.academic_group_id}
                onClick={() => {
                  setSelectedClass(cf);
                  setCurrentNav('class_detail');
                }}
                className="group cursor-pointer bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[3.5px_3.5px_0px_#1A1209] hover:shadow-[5.5px_5.5px_0px_#1A1209] transition-all p-5 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2.5 bg-[#FAF6EE] dark:bg-[#26201B] border border-[#1A1209] group-hover:bg-[#1A365D] group-hover:text-white transition-colors">
                        <Folder className="w-6 h-6 text-[#1A365D] group-hover:text-white" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-[#B84915] uppercase tracking-wider block">
                          AY {cf.academic_year} &bull; SEM {cf.semester_number}
                        </span>
                        <h3 className="font-bold text-sm text-[#1A1209] dark:text-white group-hover:text-[#1A365D] transition-colors">
                          {cf.class_name}
                        </h3>
                      </div>
                    </div>
                  </div>

                  {/* Class Headcount and role */}
                  <div className="p-2.5 bg-[#FAF6EE] dark:bg-[#16120F] border border-[#1A1209] text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[#786958]">Enrolled Students:</span>
                      <strong className="text-[#1A1209] dark:text-white">{cf.student_count}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#786958]">Assigned Subjects:</span>
                      <strong className="text-[#B84915]">{cf.counts.subjects_count}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#786958]">Assigned Lab Batches:</span>
                      <strong className="text-[#1F5A2E]">{cf.counts.batches_count}</strong>
                    </div>
                  </div>

                  {/* Submission statistics chip */}
                  <div className="flex items-center justify-between pt-1 text-[11px]">
                    <span className="text-[#786958]">
                      Pending Review: <strong className="text-[#B84915]">{cf.counts.pending_evaluations}</strong>
                    </span>
                    <span className="text-[#786958]">
                      Total Submissions: <strong>{cf.counts.total_submissions}</strong>
                    </span>
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-[#1A1209] flex items-center justify-between text-xs font-bold text-[#1A365D]">
                  <span>OPEN CLASS FOLDER</span>
                  <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW: INSIDE A CLASS FOLDER                                               */}
      {/* ========================================================================= */}
      {currentNav === 'class_detail' && selectedClass && (
        <div className="space-y-6">
          {/* Class Banner */}
          <div className="p-5 bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[4px_4px_0px_#1A1209] flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold text-[#B84915] uppercase tracking-wider block">
                ACADEMIC GROUP &bull; AY {selectedClass.academic_year}
              </span>
              <h1 className="text-base font-black uppercase text-[#1A1209] dark:text-white">
                {selectedClass.class_name}
              </h1>
              <p className="text-xs text-[#786958] mt-0.5">
                {selectedClass.student_count} Enrolled Students &bull; {selectedClass.assigned_subjects.length} Assigned Courses &bull; {selectedClass.assigned_batches.length} Practical Batches
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-[#FAF6EE] dark:bg-[#26201B] border border-[#1A1209] text-xs font-bold">
                Pending: {selectedClass.counts.pending_evaluations}
              </span>
            </div>
          </div>

          {/* 1. Assigned Subject Folders */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase text-[#1A1209] dark:text-white flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-[#B84915]" /> ALLOTTED SUBJECT FOLDERS
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {selectedClass.assigned_subjects.map((sub) => (
                <div
                  key={sub.subject_id}
                  onClick={() => {
                    setSelectedSubject(sub);
                    setCurrentNav('subject_detail');
                    setSubjectTab('assignments');
                  }}
                  className="group cursor-pointer bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[3px_3px_0px_#1A1209] hover:shadow-[5px_5px_0px_#1A1209] transition-all p-4 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-[#FAF6EE] dark:bg-[#26201B] border border-[#1A1209]">
                        <BookOpen className="w-4 h-4 text-[#B84915]" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-[#786958] block">{sub.code}</span>
                        <h3 className="font-bold text-xs text-[#1A1209] dark:text-white line-clamp-1">{sub.name}</h3>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-1 text-center text-[10px] pt-1">
                      <div className="p-1 bg-[#FAF6EE] dark:bg-[#26201B] border border-[#1A1209]">
                        <span className="text-[#786958] block text-[9px]">ASSIGN</span>
                        <strong>{sub.assignments.length}</strong>
                      </div>
                      <div className="p-1 bg-[#FAF6EE] dark:bg-[#26201B] border border-[#1A1209]">
                        <span className="text-[#786958] block text-[9px]">EXPTS</span>
                        <strong>{sub.experiments.length}</strong>
                      </div>
                      <div className="p-1 bg-[#FAF6EE] dark:bg-[#26201B] border border-[#1A1209]">
                        <span className="text-[#786958] block text-[9px]">SPECIAL</span>
                        <strong>{sub.special_documents.length}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 mt-2 border-t border-[#1A1209] flex items-center justify-between text-[11px] font-bold text-[#B84915]">
                    <span>Pending: {sub.pending_evaluations_count}</span>
                    <span>VIEW COURSE &rarr;</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Assigned Laboratory Batches */}
          {selectedClass.assigned_batches.length > 0 && (
            <div className="space-y-3 pt-2">
              <h2 className="text-xs font-bold uppercase text-[#1A1209] dark:text-white flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[#1F5A2E]" /> LABORATORY BATCH FOLDERS (MANUALLY CONFIGURED)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedClass.assigned_batches.map((batch) => (
                  <div
                    key={batch.id}
                    onClick={() => {
                      setSelectedBatch(batch);
                      setCurrentNav('batch_detail');
                    }}
                    className="group cursor-pointer bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[3px_3px_0px_#1A1209] hover:shadow-[5px_5px_0px_#1A1209] transition-all p-4 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-[#FAF6EE] dark:bg-[#26201B] border border-[#1A1209]">
                          <Users className="w-4 h-4 text-[#1F5A2E]" />
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-[#1F5A2E] uppercase block">PRACTICAL BATCH</span>
                          <h3 className="font-bold text-xs text-[#1A1209] dark:text-white">{batch.batch_name}</h3>
                        </div>
                      </div>

                      <div className="text-[11px] text-[#786958] space-y-0.5 pt-1">
                        <div>Students Allocated: <strong>{batch.students_count}</strong> / {batch.capacity}</div>
                        <div>Assigned Experiments: <strong>{batch.experiments.length}</strong></div>
                        <div>Pending Evaluations: <strong className="text-[#B84915]">{batch.pending_evaluations_count}</strong></div>
                      </div>
                    </div>

                    <div className="pt-2 mt-2 border-t border-[#1A1209] flex items-center justify-between text-[11px] font-bold text-[#1F5A2E]">
                      <span>Average: {batch.average_score}/15M</span>
                      <span>OPEN BATCH &rarr;</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW: INSIDE A SUBJECT FOLDER                                             */}
      {/* ========================================================================= */}
      {currentNav === 'subject_detail' && selectedSubject && selectedClass && (
        <div className="space-y-4">
          <div className="p-4 bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[3px_3px_0px_#1A1209] space-y-2">
            <span className="text-[10px] font-bold text-[#B84915] uppercase tracking-wider block">
              {selectedClass.class_name} &bull; {selectedSubject.code}
            </span>
            <h1 className="text-base font-black uppercase text-[#1A1209] dark:text-white">
              {selectedSubject.name}
            </h1>

            {/* Subfolders navigation tabs: 1. Assignments, 2. Experiments, 3. Special Documents, 4. Submissions, 5. Evaluation, 6. Performance */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#1A1209] text-xs">
              <button
                onClick={() => setSubjectTab('assignments')}
                className={`px-3 py-1 font-bold border border-[#1A1209] ${
                  subjectTab === 'assignments' ? 'bg-[#B84915] text-white shadow-[1.5px_1.5px_0px_#1A1209]' : 'bg-[#FAF6EE] dark:bg-[#12100E]'
                }`}
              >
                1. Assignments ({selectedSubject.assignments.length})
              </button>
              <button
                onClick={() => setSubjectTab('experiments')}
                className={`px-3 py-1 font-bold border border-[#1A1209] ${
                  subjectTab === 'experiments' ? 'bg-[#1F5A2E] text-white shadow-[1.5px_1.5px_0px_#1A1209]' : 'bg-[#FAF6EE] dark:bg-[#12100E]'
                }`}
              >
                2. Experiments ({selectedSubject.experiments.length})
              </button>
              <button
                onClick={() => setSubjectTab('special_docs')}
                className={`px-3 py-1 font-bold border border-[#1A1209] ${
                  subjectTab === 'special_docs' ? 'bg-[#6B46C1] text-white shadow-[1.5px_1.5px_0px_#1A1209]' : 'bg-[#FAF6EE] dark:bg-[#12100E]'
                }`}
              >
                3. Special Documents ({selectedSubject.special_documents.length})
              </button>
              <button
                onClick={() => setSubjectTab('submissions')}
                className={`px-3 py-1 font-bold border border-[#1A1209] ${
                  subjectTab === 'submissions' ? 'bg-[#1A365D] text-white shadow-[1.5px_1.5px_0px_#1A1209]' : 'bg-[#FAF6EE] dark:bg-[#12100E]'
                }`}
              >
                4. Submissions ({selectedSubject.total_submissions_count})
              </button>
              <button
                onClick={() => setSubjectTab('evaluations')}
                className={`px-3 py-1 font-bold border border-[#1A1209] ${
                  subjectTab === 'evaluations' ? 'bg-[#1F5A2E] text-white shadow-[1.5px_1.5px_0px_#1A1209]' : 'bg-[#FAF6EE] dark:bg-[#12100E]'
                }`}
              >
                5. Evaluation ({selectedSubject.pending_evaluations_count} Pending)
              </button>
              <button
                onClick={() => setSubjectTab('performance')}
                className={`px-3 py-1 font-bold border border-[#1A1209] ${
                  subjectTab === 'performance' ? 'bg-[#1A365D] text-white shadow-[1.5px_1.5px_0px_#1A1209]' : 'bg-[#FAF6EE] dark:bg-[#12100E]'
                }`}
              >
                6. Performance (Avg: {selectedSubject.average_score}M)
              </button>
            </div>
          </div>

          {/* Subfolder contents */}
          <div className="bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[3px_3px_0px_#1A1209] p-4">
            {subjectTab === 'assignments' && (
              <div className="space-y-3">
                <h3 className="font-bold text-xs uppercase text-[#B84915]">Course Assignments</h3>
                {selectedSubject.assignments.length === 0 ? (
                  <p className="text-xs text-[#786958]">No assignments created for this subject yet.</p>
                ) : (
                  selectedSubject.assignments.map((t, idx) => (
                    <div key={t.id + idx} className="p-3 bg-[#FAF6EE] dark:bg-[#26201B] border border-[#1A1209] flex items-center justify-between">
                      <div>
                        <div className="font-bold text-xs text-[#1A1209] dark:text-white">{t.title}</div>
                        <div className="text-[10px] text-[#786958]">Due: {t.due_date ? t.due_date.replace('T', ' ').substring(0, 16) : 'N/A'} &bull; Max Marks: {t.max_marks}M</div>
                      </div>
                      <span className="text-xs font-bold">{t.total_submissions} Submissions</span>
                    </div>
                  ))
                )}
              </div>
            )}

            {subjectTab === 'experiments' && (
              <div className="space-y-3">
                <h3 className="font-bold text-xs uppercase text-[#1F5A2E]">Laboratory Experiments</h3>
                {selectedSubject.experiments.length === 0 ? (
                  <p className="text-xs text-[#786958]">No experiments created for this subject yet.</p>
                ) : (
                  selectedSubject.experiments.map((t, idx) => (
                    <div key={t.id + idx} className="p-3 bg-[#FAF6EE] dark:bg-[#26201B] border border-[#1A1209] flex items-center justify-between">
                      <div>
                        <div className="font-bold text-xs text-[#1A1209] dark:text-white">{t.title}</div>
                        <div className="text-[10px] text-[#786958]">Due: {t.due_date ? t.due_date.replace('T', ' ').substring(0, 16) : 'N/A'} &bull; Max Marks: {t.max_marks}M</div>
                      </div>
                      <span className="text-xs font-bold">{t.total_submissions} Submissions</span>
                    </div>
                  ))
                )}
              </div>
            )}

            {subjectTab === 'special_docs' && (
              <div className="space-y-3">
                <h3 className="font-bold text-xs uppercase text-[#6B46C1]">Special Documents & Projects</h3>
                {selectedSubject.special_documents.length === 0 ? (
                  <p className="text-xs text-[#786958]">No special documents assigned.</p>
                ) : (
                  selectedSubject.special_documents.map((t, idx) => (
                    <div key={t.id + idx} className="p-3 bg-[#FAF6EE] dark:bg-[#26201B] border border-[#1A1209] flex items-center justify-between">
                      <div>
                        <div className="font-bold text-xs text-[#1A1209] dark:text-white">{t.title}</div>
                        <div className="text-[10px] text-[#786958]">Due: {t.due_date ? t.due_date.replace('T', ' ').substring(0, 16) : 'N/A'} &bull; Max Marks: {t.max_marks}M</div>
                      </div>
                      <span className="text-xs font-bold">{t.total_submissions} Submissions</span>
                    </div>
                  ))
                )}
              </div>
            )}

            {subjectTab === 'submissions' && (
              <div className="space-y-3">
                <h3 className="font-bold text-xs uppercase text-[#1A365D]">Student Submissions Roster</h3>
                {selectedSubject.submissions.length === 0 ? (
                  <p className="text-xs text-[#786958]">No submissions logged for this subject yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#FAF6EE] dark:bg-[#26201B] border-b border-[#1A1209] uppercase text-[10px]">
                        <tr>
                          <th className="p-2 border-r border-[#1A1209]">Student</th>
                          <th className="p-2 border-r border-[#1A1209]">Assessment</th>
                          <th className="p-2 border-r border-[#1A1209]">Date</th>
                          <th className="p-2 border-r border-[#1A1209]">Status</th>
                          <th className="p-2 text-right">Marks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1A1209]">
                        {selectedSubject.submissions.map((s, idx) => (
                          <tr key={s.submission_id + idx}>
                            <td className="p-2 border-r border-[#1A1209]">{s.student_name} ({s.roll_number})</td>
                            <td className="p-2 border-r border-[#1A1209]">{s.task_title}</td>
                            <td className="p-2 border-r border-[#1A1209]">{s.submission_date}</td>
                            <td className="p-2 border-r border-[#1A1209] uppercase text-[10px]">{s.status}</td>
                            <td className="p-2 text-right font-bold">{s.marks_awarded !== null ? `${s.marks_awarded}M` : 'Pending'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {subjectTab === 'evaluations' && (
              <div className="space-y-3">
                <h3 className="font-bold text-xs uppercase text-[#1F5A2E]">Pending Evaluations</h3>
                <div className="text-xs text-[#786958]">
                  {selectedSubject.pending_evaluations_count} submissions awaiting faculty evaluation for this course.
                </div>
              </div>
            )}

            {subjectTab === 'performance' && (
              <div className="p-4 bg-[#FAF6EE] dark:bg-[#16120F] border border-[#1A1209] space-y-2">
                <h3 className="font-bold text-xs uppercase text-[#1A365D]">Subject-Wise Class Performance</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2 text-center">
                  <div className="p-3 bg-white dark:bg-[#1D1814] border border-[#1A1209]">
                    <span className="text-[10px] text-[#786958] block">AVERAGE SCORE</span>
                    <strong className="text-base text-[#1F5A2E]">{selectedSubject.average_score} Marks</strong>
                  </div>
                  <div className="p-3 bg-white dark:bg-[#1D1814] border border-[#1A1209]">
                    <span className="text-[10px] text-[#786958] block">EVALUATED SUBMISSIONS</span>
                    <strong className="text-base text-[#1A365D]">{selectedSubject.evaluated_count}</strong>
                  </div>
                  <div className="p-3 bg-white dark:bg-[#1D1814] border border-[#1A1209]">
                    <span className="text-[10px] text-[#786958] block">TOTAL SUBMISSIONS</span>
                    <strong className="text-base text-[#B84915]">{selectedSubject.total_submissions_count}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW: INSIDE A LABORATORY BATCH FOLDER                                    */}
      {/* ========================================================================= */}
      {currentNav === 'batch_detail' && selectedBatch && selectedClass && (
        <div className="space-y-4">
          <div className="p-5 bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[3px_3px_0px_#1A1209] space-y-2">
            <span className="text-[10px] font-bold text-[#1F5A2E] uppercase tracking-wider block">
              {selectedClass.class_name} &bull; LABORATORY BATCH FOLDER
            </span>
            <h1 className="text-base font-black uppercase text-[#1A1209] dark:text-white">
              {selectedBatch.batch_name}
            </h1>
            <p className="text-xs text-[#786958]">
              {selectedBatch.students_count} Students Enrolled &bull; Capacity: {selectedBatch.capacity} &bull; Average Score: {selectedBatch.average_score}/15M
            </p>
          </div>

          <div className="bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[3px_3px_0px_#1A1209] p-4 space-y-4">
            <h3 className="font-bold text-xs uppercase text-[#1F5A2E] flex items-center gap-1.5">
              <Users className="w-4 h-4" /> Allocated Batch Students Roster ({selectedBatch.students_count})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF6EE] dark:bg-[#26201B] border-b border-[#1A1209] uppercase text-[10px]">
                  <tr>
                    <th className="p-2 border-r border-[#1A1209]">Roll No</th>
                    <th className="p-2 border-r border-[#1A1209]">PRN</th>
                    <th className="p-2 border-r border-[#1A1209]">Student Name</th>
                    <th className="p-2">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A1209]">
                  {selectedBatch.students.map((st, idx) => (
                    <tr key={st.student_id + idx}>
                      <td className="p-2 border-r border-[#1A1209] font-bold">{st.roll_number || 'N/A'}</td>
                      <td className="p-2 border-r border-[#1A1209]">{st.prn || 'N/A'}</td>
                      <td className="p-2 border-r border-[#1A1209] font-bold">{st.student_name}</td>
                      <td className="p-2 text-[#786958]">{st.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
