import React, { useState, useMemo } from 'react';
import {
  Folder, FolderOpen, Clock, AlertTriangle, ArrowRight, BookOpen,
  CheckCircle2, Search, Filter, Eye, CheckSquare, Layers, Award,
  ChevronRight, ArrowUpDown, Grid, List, Download, RefreshCw, X, FileText
} from 'lucide-react';
import {
  StudentWorkspaceFolders, PrioritySubmissionItem, SubjectFolderItem,
  SubjectAssessmentItem, SubmissionHistoryItem
} from '../types';

interface StudentAcademicFolderWorkspaceProps {
  workspace: StudentWorkspaceFolders | null;
  loading: boolean;
  onRefresh: () => void;
  onOpenEditor: (docId: string | null) => void;
  onStartTask: (task: any) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const StudentAcademicFolderWorkspace: React.FC<StudentAcademicFolderWorkspaceProps> = ({
  workspace,
  loading,
  onRefresh,
  onOpenEditor,
  onStartTask,
  showToast
}) => {
  // Navigation level: 'root' | 'subject' | 'history'
  const [currentView, setCurrentView] = useState<'root' | 'subject' | 'history'>('root');
  const [selectedSubject, setSelectedSubject] = useState<SubjectFolderItem | null>(null);

  // Priority Submissions filters
  const [priorityType, setPriorityType] = useState<string>('ALL');
  const [prioritySubject, setPrioritySubject] = useState<string>('ALL');
  const [priorityStatus, setPriorityStatus] = useState<string>('ALL');
  const [prioritySort, setPrioritySort] = useState<'nearest' | 'latest' | 'subject' | 'type'>('nearest');
  const [prioritySearch, setPrioritySearch] = useState<string>('');
  const [priorityViewMode, setPriorityViewMode] = useState<'cards' | 'table'>('cards');
  const [priorityPage, setPriorityPage] = useState<number>(1);
  const itemsPerPage = 6;

  // Subject folder subfolder tab & filters
  const [subjectTab, setSubjectTab] = useState<'all' | 'Assignment' | 'Experiment' | 'Special Document'>('all');
  const [subjectSearch, setSubjectSearch] = useState<string>('');
  const [subjectSort, setSubjectSort] = useState<'nearest' | 'latest' | 'title'>('nearest');

  // History filters
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historySubjectFilter, setHistorySubjectFilter] = useState<string>('ALL');
  const [historyTypeFilter, setHistoryTypeFilter] = useState<string>('ALL');

  // Filter & sort priority submissions
  const filteredPriority = useMemo(() => {
    if (!workspace?.priority_submissions) return [];
    let list = [...workspace.priority_submissions];

    if (priorityType !== 'ALL') {
      list = list.filter((p) => p.task_type === priorityType);
    }
    if (prioritySubject !== 'ALL') {
      list = list.filter((p) => p.subject_id === prioritySubject || p.subject_name === prioritySubject);
    }
    if (priorityStatus === 'overdue') {
      list = list.filter((p) => p.is_overdue);
    } else if (priorityStatus === 'due_today') {
      list = list.filter((p) => p.deadline_indicator === 'Due today');
    } else if (priorityStatus === 'due_soon') {
      list = list.filter((p) => p.deadline_indicator === 'Due soon' || p.deadline_indicator === 'Due tomorrow');
    } else if (priorityStatus === 'returned') {
      list = list.filter((p) => p.submission_status === 'returned');
    }

    if (prioritySearch.trim()) {
      const q = prioritySearch.toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.subject_name.toLowerCase().includes(q) ||
          p.subject_code.toLowerCase().includes(q) ||
          p.faculty_name.toLowerCase().includes(q)
      );
    }

    // Strict sorting rules:
    // 1. The nearest upcoming deadline appears first.
    // 2. A submission due sooner must appear above one due later.
    // 3. If multiple submissions have exactly the same deadline, show ALL of them together.
    // 4. Do not hide, overwrite, or arbitrarily prioritize submissions sharing a deadline.
    // 5. Within the same deadline group, use a consistent secondary order: subject name and title.
    list.sort((a, b) => {
      if (prioritySort === 'nearest') {
        const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
        const db = b.due_date ? new Date(b.due_date).getTime() : Infinity;
        if (da !== db) return da - db;
        const sComp = a.subject_name.localeCompare(b.subject_name);
        return sComp !== 0 ? sComp : a.title.localeCompare(b.title);
      } else if (prioritySort === 'latest') {
        const da = a.due_date ? new Date(a.due_date).getTime() : -Infinity;
        const db = b.due_date ? new Date(b.due_date).getTime() : -Infinity;
        if (da !== db) return db - da;
        return a.title.localeCompare(b.title);
      } else if (prioritySort === 'subject') {
        const sComp = a.subject_name.localeCompare(b.subject_name);
        return sComp !== 0 ? sComp : a.title.localeCompare(b.title);
      } else {
        const tComp = a.task_type.localeCompare(b.task_type);
        return tComp !== 0 ? tComp : a.title.localeCompare(b.title);
      }
    });

    return list;
  }, [workspace, priorityType, prioritySubject, priorityStatus, prioritySearch, prioritySort]);

  // Paginated Priority Items
  const paginatedPriority = useMemo(() => {
    const start = (priorityPage - 1) * itemsPerPage;
    return filteredPriority.slice(start, start + itemsPerPage);
  }, [filteredPriority, priorityPage]);

  const totalPriorityPages = Math.ceil(filteredPriority.length / itemsPerPage) || 1;

  // Filter & sort assessments in selected subject folder
  const filteredSubjectAssessments = useMemo(() => {
    if (!selectedSubject?.assessments) return [];
    let list = [...selectedSubject.assessments];

    if (subjectTab !== 'all') {
      list = list.filter((a) => a.task_type === subjectTab);
    }
    if (subjectSearch.trim()) {
      const q = subjectSearch.toLowerCase();
      list = list.filter((a) => a.title.toLowerCase().includes(q) || (a.description || '').toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      if (subjectSort === 'nearest') {
        const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
        const db = b.due_date ? new Date(b.due_date).getTime() : Infinity;
        return da - db;
      } else if (subjectSort === 'latest') {
        const da = a.due_date ? new Date(a.due_date).getTime() : -Infinity;
        const db = b.due_date ? new Date(b.due_date).getTime() : -Infinity;
        return db - da;
      } else {
        return a.title.localeCompare(b.title);
      }
    });

    return list;
  }, [selectedSubject, subjectTab, subjectSearch, subjectSort]);

  // Filter history
  const filteredHistory = useMemo(() => {
    if (!workspace?.submission_history) return [];
    let list = [...workspace.submission_history];

    if (historySubjectFilter !== 'ALL') {
      list = list.filter((h) => h.subject_name === historySubjectFilter || h.subject_code === historySubjectFilter);
    }
    if (historyTypeFilter !== 'ALL') {
      list = list.filter((h) => h.task_type === historyTypeFilter);
    }
    if (historySearch.trim()) {
      const q = historySearch.toLowerCase();
      list = list.filter((h) => h.title.toLowerCase().includes(q) || h.subject_name.toLowerCase().includes(q));
    }
    return list;
  }, [workspace, historySubjectFilter, historyTypeFilter, historySearch]);

  const renderDeadlineBadge = (item: PrioritySubmissionItem) => {
    if (item.is_overdue) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#B91C1C] text-white font-mono font-bold text-[10px] border border-[#1A1209]">
          <AlertTriangle className="w-3 h-3" /> {item.delay_text || 'OVERDUE'}
        </span>
      );
    }
    if (item.deadline_indicator === 'Due today') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#D97706] text-white font-mono font-bold text-[10px] border border-[#1A1209]">
          <Clock className="w-3 h-3" /> DUE TODAY
        </span>
      );
    }
    if (item.deadline_indicator === 'Due tomorrow') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#F59E0B] text-black font-mono font-bold text-[10px] border border-[#1A1209]">
          <Clock className="w-3 h-3" /> DUE TOMORROW
        </span>
      );
    }
    if (item.deadline_indicator === 'Due soon') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#E11D48] text-white font-mono font-bold text-[10px] border border-[#1A1209]">
          <Clock className="w-3 h-3" /> DUE SOON
        </span>
      );
    }
    if (item.submission_status === 'returned') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#7C3AED] text-white font-mono font-bold text-[10px] border border-[#1A1209]">
          <RefreshCw className="w-3 h-3" /> RESUBMISSION REQUIRED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#1A365D] text-white font-mono font-bold text-[10px] border border-[#1A1209]">
        <Clock className="w-3 h-3" /> {item.deadline_indicator || item.time_remaining}
      </span>
    );
  };

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
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* BREADCRUMB NAVIGATION BAR                                                 */}
      {/* ========================================================================= */}
      <div className="p-3 bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[3px_3px_0px_#1A1209] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-mono text-xs">
          <button
            onClick={() => {
              setCurrentView('root');
              setSelectedSubject(null);
            }}
            className={`flex items-center gap-1 px-2 py-1 font-bold ${
              currentView === 'root'
                ? 'bg-[#1A365D] text-white'
                : 'bg-[#FAF6EE] dark:bg-[#12100E] text-[#1A1209] dark:text-[#D4C7B5] hover:bg-[#EAE4D5]'
            } border border-[#1A1209]`}
          >
            <Folder className="w-3.5 h-3.5 text-[#B84915]" /> My Workspace
          </button>

          {currentView === 'subject' && selectedSubject && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-[#786958]" />
              <span className="flex items-center gap-1 px-2 py-1 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209] text-[#786958]">
                <Folder className="w-3.5 h-3.5" /> My Subjects
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-[#786958]" />
              <span className="flex items-center gap-1 px-2.5 py-1 bg-[#1F5A2E] text-white font-bold border border-[#1A1209]">
                <FolderOpen className="w-3.5 h-3.5" /> {selectedSubject.name} ({selectedSubject.code})
              </span>
            </>
          )}

          {currentView === 'history' && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-[#786958]" />
              <span className="flex items-center gap-1 px-2.5 py-1 bg-[#B84915] text-white font-bold border border-[#1A1209]">
                <BookOpen className="w-3.5 h-3.5" /> Submission History
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {currentView !== 'root' && (
            <button
              onClick={() => {
                setCurrentView('root');
                setSelectedSubject(null);
              }}
              className="px-3 py-1 bg-[#FAF6EE] dark:bg-[#26201B] hover:bg-[#E5DFD3] text-[#1A1209] dark:text-white text-xs font-bold font-mono border border-[#1A1209]"
            >
              &larr; BACK TO WORKSPACE
            </button>
          )}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="px-2.5 py-1 bg-[#FAF6EE] dark:bg-[#26201B] hover:bg-[#E5DFD3] text-[#1A1209] dark:text-white text-xs font-mono border border-[#1A1209] flex items-center gap-1"
            title="Refresh folder data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: ROOT WORKSPACE (PRIORITY SUBMISSIONS + SUBJECT FOLDERS + HISTORY)   */}
      {/* ========================================================================= */}
      {currentView === 'root' && (
        <div className="space-y-6">
          {/* SECTION A: PRIORITY SUBMISSIONS (HIGHEST PRIORITY) */}
          <div className="bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[4px_4px_0px_#1A1209]">
            {/* Header with mandatory <badge>Highest priority</badge> */}
            <div className="p-4 bg-[#FFFAF1] dark:bg-[#231C17] border-b-2 border-[#1A1209] flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 bg-[#B84915] text-white font-mono font-bold text-[10px] uppercase border border-[#1A1209] shadow-[1px_1px_0px_#1A1209]">
                    Highest priority
                  </span>
                  <span className="text-[10px] font-mono text-[#786958]">
                    {filteredPriority.length} pending deadline{filteredPriority.length === 1 ? '' : 's'}
                  </span>
                </div>
                <h2 className="text-sm font-black uppercase tracking-wider text-[#1A1209] dark:text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#B84915]" /> PRIORITY SUBMISSIONS
                </h2>
                <p className="text-xs text-[#786958] mt-0.5">
                  Ordered strictly by upcoming deadline. Tasks due sooner appear above those due later; shared deadlines are grouped together.
                </p>
              </div>

              {/* View mode toggle */}
              <div className="flex items-center gap-1 bg-[#FAF6EE] dark:bg-[#12100E] p-1 border border-[#1A1209]">
                <button
                  onClick={() => setPriorityViewMode('cards')}
                  className={`p-1 text-xs ${priorityViewMode === 'cards' ? 'bg-[#1A365D] text-white' : 'text-[#786958]'}`}
                  title="Card Grid View"
                >
                  <Grid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setPriorityViewMode('table')}
                  className={`p-1 text-xs ${priorityViewMode === 'table' ? 'bg-[#1A365D] text-white' : 'text-[#786958]'}`}
                  title="Compact Table View"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Filter and Sorting Toolbar */}
            <div className="p-3 bg-[#FAF6EE] dark:bg-[#1A1613] border-b-2 border-[#1A1209] flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                {/* Search */}
                <div className="relative min-w-[180px]">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#786958]" />
                  <input
                    type="text"
                    placeholder="Search pending tasks..."
                    value={prioritySearch}
                    onChange={(e) => {
                      setPrioritySearch(e.target.value);
                      setPriorityPage(1);
                    }}
                    className="w-full pl-8 pr-2.5 py-1 bg-white dark:bg-[#1D1814] border border-[#1A1209] text-xs"
                  />
                </div>

                {/* Type Filter */}
                <select
                  value={priorityType}
                  onChange={(e) => {
                    setPriorityType(e.target.value);
                    setPriorityPage(1);
                  }}
                  className="px-2.5 py-1 bg-white dark:bg-[#1D1814] border border-[#1A1209] text-xs font-bold"
                >
                  <option value="ALL">All Assessment Types</option>
                  <option value="Assignment">Assignments Only</option>
                  <option value="Experiment">Experiments Only</option>
                  <option value="Special Document">Special Documents Only</option>
                </select>

                {/* Subject Filter */}
                <select
                  value={prioritySubject}
                  onChange={(e) => {
                    setPrioritySubject(e.target.value);
                    setPriorityPage(1);
                  }}
                  className="px-2.5 py-1 bg-white dark:bg-[#1D1814] border border-[#1A1209] text-xs"
                >
                  <option value="ALL">All Subjects</option>
                  {workspace?.subject_folders?.map((sf) => (
                    <option key={sf.subject_id} value={sf.subject_id}>
                      {sf.name} ({sf.code})
                    </option>
                  ))}
                </select>

                {/* Status Filter */}
                <select
                  value={priorityStatus}
                  onChange={(e) => {
                    setPriorityStatus(e.target.value);
                    setPriorityPage(1);
                  }}
                  className="px-2.5 py-1 bg-white dark:bg-[#1D1814] border border-[#1A1209] text-xs"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="overdue">Overdue Deadlines</option>
                  <option value="due_today">Due Today</option>
                  <option value="due_soon">Due Soon (&le;3 Days)</option>
                  <option value="returned">Resubmission Required</option>
                </select>
              </div>

              {/* Sort By */}
              <div className="flex items-center gap-1">
                <span className="text-[#786958] text-[11px] flex items-center gap-1">
                  <ArrowUpDown className="w-3 h-3" /> Sort:
                </span>
                <select
                  value={prioritySort}
                  onChange={(e: any) => setPrioritySort(e.target.value)}
                  className="px-2 py-1 bg-white dark:bg-[#1D1814] border border-[#1A1209] text-xs font-bold"
                >
                  <option value="nearest">Nearest Deadline First</option>
                  <option value="latest">Latest Deadline First</option>
                  <option value="subject">Subject Name</option>
                  <option value="type">Assessment Type</option>
                </select>
              </div>
            </div>

            {/* Submissions List / Grid */}
            <div className="p-4">
              {filteredPriority.length === 0 ? (
                <div className="p-8 text-center bg-[#FAF6EE] dark:bg-[#16120F] border-2 border-dashed border-[#1A1209] space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-[#1F5A2E] mx-auto" />
                  <p className="font-mono font-bold text-xs uppercase text-[#1A1209] dark:text-white">
                    Zero Pending Submissions in Priority Queue
                  </p>
                  <p className="font-mono text-xs text-[#786958]">
                    All assigned assignments, lab experiments, and special write-ups have been submitted on time.
                  </p>
                </div>
              ) : priorityViewMode === 'cards' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {paginatedPriority.map((item, idx) => (
                    <div
                      key={item.task_id + idx}
                      className={`p-4 border-2 border-[#1A1209] shadow-[3px_3px_0px_#1A1209] flex flex-col justify-between ${
                        item.is_overdue
                          ? 'bg-[#FFF5F5] dark:bg-[#251515]'
                          : 'bg-white dark:bg-[#1D1814]'
                      }`}
                    >
                      <div className="space-y-2">
                        {/* Type & Deadline Indicators */}
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <span
                            className={`px-2 py-0.5 text-[9px] font-mono font-black uppercase border border-[#1A1209] ${getTaskTypeBadge(
                              item.task_type
                            )}`}
                          >
                            {item.task_type}
                          </span>
                          {renderDeadlineBadge(item)}
                        </div>

                        {/* Title */}
                        <h3 className="font-bold text-xs text-[#1A1209] dark:text-white line-clamp-2">
                          {item.title}
                        </h3>

                        {/* Subject & Faculty info */}
                        <div className="text-[11px] font-mono text-[#786958] space-y-0.5 border-t border-dashed border-[#1A1209] pt-1.5">
                          <div>
                            Subject: <strong className="text-[#1A1209] dark:text-white">{item.subject_name}</strong> ({item.subject_code})
                          </div>
                          <div>
                            Faculty: <span>{item.faculty_name}</span>
                          </div>
                          <div className="flex items-center justify-between pt-1 text-[10px]">
                            <span>
                              Due: <strong className="text-[#B84915]">{item.due_date ? item.due_date.replace('T', ' ').substring(0, 16) : 'No due date'}</strong>
                            </span>
                            <span>
                              Max Score: <strong>{item.max_marks}M</strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="pt-3 mt-2 border-t border-[#1A1209] flex items-center justify-between">
                        <span className="text-[10px] font-mono text-[#786958]">
                          {item.time_remaining}
                        </span>
                        <button
                          onClick={() => {
                            if (item.task_type === 'Special Document') {
                              onStartTask({
                                id: item.task_id,
                                student_doc_id: item.document_id,
                                title: item.title,
                                task_type: 'Special Document',
                                subject_name: item.subject_name,
                                subject_code: item.subject_code,
                                description: item.description,
                                due_date: item.due_date,
                              });
                            } else if (item.document_id) {
                              onOpenEditor(item.document_id);
                            } else {
                              onStartTask({
                                id: item.task_id,
                                title: item.title,
                                task_type: item.task_type,
                                subject_name: item.subject_name,
                                subject_code: item.subject_code,
                                description: item.description
                              });
                            }
                          }}
                          className={`px-3 py-1.5 text-xs font-mono font-bold border border-[#1A1209] shadow-[1.5px_1.5px_0px_#1A1209] flex items-center gap-1 ${
                            item.submission_status === 'returned'
                              ? 'bg-[#7C3AED] text-white hover:bg-[#6D28D9]'
                              : item.is_overdue
                              ? 'bg-[#B91C1C] text-white hover:bg-[#991B1B]'
                              : 'bg-[#B84915] text-white hover:bg-[#9C3E12]'
                          }`}
                        >
                          {item.submission_status === 'returned' ? (
                            <>
                              <RefreshCw className="w-3 h-3" /> RESUBMIT WORK &rarr;
                            </>
                          ) : item.document_id ? (
                            <>
                              <Eye className="w-3 h-3" /> RESUME DRAFT &rarr;
                            </>
                          ) : (
                            <>
                              <CheckSquare className="w-3 h-3" /> START WRITE-UP &rarr;
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Compact Table View */
                <div className="overflow-x-auto border border-[#1A1209]">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-[#FAF6EE] dark:bg-[#26201B] border-b-2 border-[#1A1209] uppercase text-[10px]">
                      <tr>
                        <th className="p-2 border-r border-[#1A1209]">Type</th>
                        <th className="p-2 border-r border-[#1A1209]">Title & Subject</th>
                        <th className="p-2 border-r border-[#1A1209]">Faculty</th>
                        <th className="p-2 border-r border-[#1A1209]">Deadline</th>
                        <th className="p-2 border-r border-[#1A1209]">Indicator</th>
                        <th className="p-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1A1209]">
                      {paginatedPriority.map((item, idx) => (
                        <tr
                          key={item.task_id + idx}
                          className={`hover:bg-[#FAF6EE] dark:hover:bg-[#26201B] ${
                            item.is_overdue ? 'bg-[#FFF5F5] dark:bg-[#251515]' : ''
                          }`}
                        >
                          <td className="p-2 border-r border-[#1A1209] whitespace-nowrap">
                            <span
                              className={`px-1.5 py-0.5 text-[9px] font-bold uppercase border border-[#1A1209] ${getTaskTypeBadge(
                                item.task_type
                              )}`}
                            >
                              {item.task_type}
                            </span>
                          </td>
                          <td className="p-2 border-r border-[#1A1209]">
                            <div className="font-bold text-[#1A1209] dark:text-white line-clamp-1">{item.title}</div>
                            <div className="text-[10px] text-[#786958]">
                              {item.subject_name} ({item.subject_code})
                            </div>
                          </td>
                          <td className="p-2 border-r border-[#1A1209] text-[11px] text-[#786958] whitespace-nowrap">
                            {item.faculty_name}
                          </td>
                          <td className="p-2 border-r border-[#1A1209] whitespace-nowrap">
                            <div className="text-[11px] font-bold text-[#B84915]">
                              {item.due_date ? item.due_date.replace('T', ' ').substring(0, 16) : 'No due date'}
                            </div>
                            <div className="text-[10px] text-[#786958]">{item.time_remaining}</div>
                          </td>
                          <td className="p-2 border-r border-[#1A1209] whitespace-nowrap">
                            {renderDeadlineBadge(item)}
                          </td>
                          <td className="p-2 text-right whitespace-nowrap">
                            <button
                              onClick={() => {
                                if (item.task_type === 'Special Document') {
                                  onStartTask({
                                    id: item.task_id,
                                    student_doc_id: item.document_id,
                                    title: item.title,
                                    task_type: 'Special Document',
                                    subject_name: item.subject_name,
                                    subject_code: item.subject_code,
                                    description: item.description,
                                    due_date: item.due_date,
                                  });
                                } else if (item.document_id) {
                                  onOpenEditor(item.document_id);
                                } else {
                                  onStartTask({
                                    id: item.task_id,
                                    title: item.title,
                                    task_type: item.task_type,
                                    subject_name: item.subject_name,
                                    subject_code: item.subject_code,
                                    description: item.description
                                  });
                                }
                              }}
                              className="px-2.5 py-1 bg-[#B84915] text-white hover:bg-[#9C3E12] font-bold text-[10px] border border-[#1A1209]"
                            >
                              {item.submission_status === 'returned'
                                ? 'RESUBMIT'
                                : item.document_id
                                ? 'RESUME'
                                : 'START'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {totalPriorityPages > 1 && (
                <div className="flex items-center justify-between border-t border-[#1A1209] pt-3 mt-4 text-xs font-mono">
                  <span className="text-[#786958]">
                    Showing {(priorityPage - 1) * itemsPerPage + 1} -{' '}
                    {Math.min(priorityPage * itemsPerPage, filteredPriority.length)} of {filteredPriority.length} items
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPriorityPage((p) => Math.max(1, p - 1))}
                      disabled={priorityPage === 1}
                      className="px-2 py-1 bg-white dark:bg-[#1D1814] border border-[#1A1209] disabled:opacity-40"
                    >
                      &larr; Prev
                    </button>
                    <span className="px-2 py-1 font-bold">
                      {priorityPage} / {totalPriorityPages}
                    </span>
                    <button
                      onClick={() => setPriorityPage((p) => Math.min(totalPriorityPages, p + 1))}
                      disabled={priorityPage === totalPriorityPages}
                      className="px-2 py-1 bg-white dark:bg-[#1D1814] border border-[#1A1209] disabled:opacity-40"
                    >
                      Next &rarr;
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ===================================================================== */}
          {/* SECTION B: SUBJECT-WISE FOLDERS GRID                                  */}
          {/* ===================================================================== */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-[#1A1209] dark:text-white flex items-center gap-2">
                  <Folder className="w-4 h-4 text-[#1A365D]" /> SUBJECT-WISE FOLDERS
                </h2>
                <p className="text-xs text-[#786958]">
                  Dedicated workspaces for each allotted course with isolated subfolders for assignments, experiments, and projects.
                </p>
              </div>
              <span className="text-xs font-mono font-bold px-2 py-1 bg-[#FAF6EE] dark:bg-[#26201B] border border-[#1A1209]">
                {workspace?.subject_folders?.length || 0} Allotted Subjects
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workspace?.subject_folders?.map((sf) => (
                <div
                  key={sf.subject_id}
                  onClick={() => {
                    setSelectedSubject(sf);
                    setCurrentView('subject');
                    setSubjectTab('all');
                  }}
                  className="group cursor-pointer bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[3.5px_3.5px_0px_#1A1209] hover:shadow-[5px_5px_0px_#1A1209] transition-all p-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-[#FAF6EE] dark:bg-[#26201B] border border-[#1A1209] group-hover:bg-[#1A365D] group-hover:text-white transition-colors">
                          <Folder className="w-5 h-5 text-[#B84915] group-hover:text-white" />
                        </div>
                        <div>
                          <span className="text-[10px] font-mono font-bold text-[#786958] block">
                            {sf.code} &bull; {sf.category} ({sf.credits} Credits)
                          </span>
                          <h3 className="font-bold text-xs text-[#1A1209] dark:text-white group-hover:text-[#B84915] transition-colors line-clamp-1">
                            {sf.name}
                          </h3>
                        </div>
                      </div>
                    </div>

                    {/* Faculty & Batch metadata */}
                    <div className="text-[11px] font-mono text-[#786958] bg-[#FAF6EE] dark:bg-[#16120F] p-2 border border-[#1A1209] space-y-0.5">
                      <div>
                        Faculty: <strong className="text-[#1A1209] dark:text-white">{sf.faculty_name}</strong>
                      </div>
                      {sf.lab_batch_name && (
                        <div>
                          Lab Batch: <strong className="text-[#1F5A2E]">{sf.lab_batch_name}</strong>
                        </div>
                      )}
                    </div>

                    {/* Counts Chips */}
                    <div className="grid grid-cols-3 gap-1.5 text-center font-mono text-[10px]">
                      <div className="p-1.5 bg-[#FAF6EE] dark:bg-[#26201B] border border-[#1A1209]">
                        <span className="text-[#786958] block text-[9px]">ASSIGN</span>
                        <strong className="text-xs text-[#B84915]">{sf.counts.assignments}</strong>
                      </div>
                      <div className="p-1.5 bg-[#FAF6EE] dark:bg-[#26201B] border border-[#1A1209]">
                        <span className="text-[#786958] block text-[9px]">EXPTS</span>
                        <strong className="text-xs text-[#1F5A2E]">{sf.counts.experiments}</strong>
                      </div>
                      <div className="p-1.5 bg-[#FAF6EE] dark:bg-[#26201B] border border-[#1A1209]">
                        <span className="text-[#786958] block text-[9px]">SPECIAL</span>
                        <strong className="text-xs text-[#6B46C1]">{sf.counts.special_documents}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Footer status */}
                  <div className="pt-3 mt-3 border-t border-[#1A1209] flex items-center justify-between text-xs font-mono">
                    <span className="text-[10px] text-[#786958]">
                      {sf.counts.pending > 0 ? (
                        <span className="text-[#B84915] font-bold">{sf.counts.pending} pending</span>
                      ) : (
                        <span className="text-[#1F5A2E] font-bold">All caught up &check;</span>
                      )}
                    </span>
                    <span className="text-[11px] font-bold text-[#1A365D] group-hover:translate-x-1 transition-transform flex items-center gap-0.5">
                      OPEN FOLDER &rarr;
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ===================================================================== */}
          {/* SECTION C: SUBMISSION HISTORY FOLDER                                  */}
          {/* ===================================================================== */}
          <div
            onClick={() => setCurrentView('history')}
            className="group cursor-pointer p-5 bg-[#FAF6EE] dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[4px_4px_0px_#1A1209] hover:shadow-[6px_6px_0px_#1A1209] transition-all flex flex-wrap items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#B84915] text-white border-2 border-[#1A1209] shadow-[2px_2px_0px_#1A1209]">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-[#B84915] block">
                  ARCHIVED & COMPLETED REPOSITORY
                </span>
                <h3 className="font-black text-sm uppercase text-[#1A1209] dark:text-white group-hover:text-[#B84915] transition-colors">
                  SUBMISSION HISTORY FOLDER
                </h3>
                <p className="text-xs font-mono text-[#786958] mt-0.5">
                  Browse {workspace?.submission_history?.length || 0} completed academic submissions, official evaluator scores, and faculty digital signatures.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 font-mono">
              <div className="text-right">
                <span className="text-xs font-bold text-[#1F5A2E] block">
                  {workspace?.summary_counts?.evaluated_count || 0} Evaluated & Graded
                </span>
                <span className="text-[10px] text-[#786958]">
                  Across all active & past semesters
                </span>
              </div>
              <span className="px-3 py-1.5 bg-[#1A365D] text-white font-bold text-xs border border-[#1A1209] flex items-center gap-1 group-hover:bg-[#12243F]">
                OPEN HISTORY &rarr;
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: DEDICATED SUBJECT FOLDER WORKSPACE                                */}
      {/* ========================================================================= */}
      {currentView === 'subject' && selectedSubject && (
        <div className="space-y-4">
          {/* Subject Metadata Header */}
          <div className="p-5 bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[4px_4px_0px_#1A1209] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1A1209] pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold text-[#B84915] uppercase tracking-wider block">
                  {selectedSubject.code} &bull; {selectedSubject.category} ({selectedSubject.credits} CREDITS)
                </span>
                <h1 className="text-base font-black uppercase text-[#1A1209] dark:text-white">
                  {selectedSubject.name}
                </h1>
              </div>
              <div className="text-right font-mono text-xs">
                <div>Faculty: <strong>{selectedSubject.faculty_name}</strong></div>
                {selectedSubject.lab_batch_name && (
                  <div className="text-[#1F5A2E]">Allotted Batch: <strong>{selectedSubject.lab_batch_name}</strong></div>
                )}
              </div>
            </div>

            {/* Subfolders Navigation Tabs */}
            <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-xs">
              <button
                onClick={() => setSubjectTab('all')}
                className={`px-3 py-1.5 font-bold border border-[#1A1209] flex items-center gap-1 ${
                  subjectTab === 'all' ? 'bg-[#1A365D] text-white shadow-[2px_2px_0px_#1A1209]' : 'bg-[#FAF6EE] dark:bg-[#12100E]'
                }`}
              >
                <Folder className="w-3.5 h-3.5" /> All Assessments ({selectedSubject.counts.total})
              </button>
              <button
                onClick={() => setSubjectTab('Assignment')}
                className={`px-3 py-1.5 font-bold border border-[#1A1209] flex items-center gap-1 ${
                  subjectTab === 'Assignment' ? 'bg-[#B84915] text-white shadow-[2px_2px_0px_#1A1209]' : 'bg-[#FAF6EE] dark:bg-[#12100E]'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" /> Assignments ({selectedSubject.counts.assignments})
              </button>
              <button
                onClick={() => setSubjectTab('Experiment')}
                className={`px-3 py-1.5 font-bold border border-[#1A1209] flex items-center gap-1 ${
                  subjectTab === 'Experiment' ? 'bg-[#1F5A2E] text-white shadow-[2px_2px_0px_#1A1209]' : 'bg-[#FAF6EE] dark:bg-[#12100E]'
                }`}
              >
                <Clock className="w-3.5 h-3.5" /> Experiments ({selectedSubject.counts.experiments})
              </button>
              <button
                onClick={() => setSubjectTab('Special Document')}
                className={`px-3 py-1.5 font-bold border border-[#1A1209] flex items-center gap-1 ${
                  subjectTab === 'Special Document' ? 'bg-[#6B46C1] text-white shadow-[2px_2px_0px_#1A1209]' : 'bg-[#FAF6EE] dark:bg-[#12100E]'
                }`}
              >
                <Layers className="w-3.5 h-3.5" /> Special Documents ({selectedSubject.counts.special_documents})
              </button>
            </div>
          </div>

          {/* Search & Sort inside subject folder */}
          <div className="p-3 bg-[#FAF6EE] dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[3px_3px_0px_#1A1209] flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
            <div className="relative min-w-[200px] flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#786958]" />
              <input
                type="text"
                placeholder="Search assessments in this subject..."
                value={subjectSearch}
                onChange={(e) => setSubjectSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1 bg-white dark:bg-[#12100E] border border-[#1A1209] text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#786958] text-xs">Sort:</span>
              <select
                value={subjectSort}
                onChange={(e: any) => setSubjectSort(e.target.value)}
                className="px-2 py-1 bg-white dark:bg-[#12100E] border border-[#1A1209] text-xs font-bold"
              >
                <option value="nearest">Nearest Deadline</option>
                <option value="latest">Latest Deadline</option>
                <option value="title">Alphabetical Title</option>
              </select>
            </div>
          </div>

          {/* Assessments list */}
          <div className="space-y-3">
            {filteredSubjectAssessments.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-[#1D1814] border-2 border-dashed border-[#1A1209]">
                <p className="font-mono text-xs text-[#786958]">
                  No {subjectTab === 'all' ? 'assessments' : subjectTab.toLowerCase() + 's'} found matching current filter.
                </p>
              </div>
            ) : (
              filteredSubjectAssessments.map((a, idx) => (
                <div
                  key={a.task_id + idx}
                  className="p-4 bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[3px_3px_0px_#1A1209] flex flex-wrap items-center justify-between gap-3 font-mono text-xs"
                >
                  <div className="space-y-1 flex-1 min-w-[240px]">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-[9px] font-bold uppercase border border-[#1A1209] ${getTaskTypeBadge(a.task_type)}`}>
                        {a.task_type}
                      </span>
                      {renderDeadlineBadge(a)}
                      {a.submission_status === 'graded' && (
                        <span className="px-2 py-0.5 bg-[#1F5A2E] text-white text-[9px] font-bold border border-[#1A1209]">
                          GRADED: {a.marks_awarded} / {a.max_marks}M
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-xs text-[#1A1209] dark:text-white">{a.title}</h3>
                    {a.description && <p className="text-[11px] text-[#786958] line-clamp-2">{a.description}</p>}
                    <div className="text-[10px] text-[#786958] flex items-center gap-3">
                      <span>Assigned: {a.assigned_date ? a.assigned_date.substring(0, 10) : 'N/A'}</span>
                      <span>Due: <strong className="text-[#B84915]">{a.due_date ? a.due_date.replace('T', ' ').substring(0, 16) : 'N/A'}</strong></span>
                      {a.feedback && <span className="text-[#1F5A2E]">&bull; Feedback: "{a.feedback}"</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {a.task_type === 'Special Document' ? (
                      <button
                        onClick={() =>
                          onStartTask({
                            id: a.task_id,
                            student_doc_id: a.document_id,
                            title: a.title,
                            task_type: 'Special Document',
                            subject_name: a.subject_name,
                            subject_code: a.subject_code,
                            description: a.description,
                            due_date: a.due_date,
                          })
                        }
                        className="px-3 py-1.5 bg-[#6B46C1] hover:bg-[#553C9A] text-white text-xs font-bold border border-[#1A1209] shadow-[1.5px_1.5px_0px_#1A1209] flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" /> {a.document_id ? 'OPEN SPECIAL DOSSIER' : 'SUBMIT SPECIAL DOCUMENT'}
                      </button>
                    ) : a.document_id ? (
                      <button
                        onClick={() => onOpenEditor(a.document_id)}
                        className="px-3 py-1.5 bg-[#1A365D] hover:bg-[#12243F] text-white text-xs font-bold border border-[#1A1209] shadow-[1.5px_1.5px_0px_#1A1209] flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" /> OPEN DOSSIER
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          onStartTask({
                            id: a.task_id,
                            title: a.title,
                            task_type: a.task_type,
                            subject_name: a.subject_name,
                            subject_code: a.subject_code,
                            description: a.description
                          })
                        }
                        className="px-3 py-1.5 bg-[#B84915] hover:bg-[#963A0F] text-white text-xs font-bold border border-[#1A1209] shadow-[1.5px_1.5px_0px_#1A1209] flex items-center gap-1"
                      >
                        <CheckSquare className="w-3.5 h-3.5" /> START WRITE-UP &rarr;
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: SUBMISSION HISTORY FOLDER                                         */}
      {/* ========================================================================= */}
      {currentView === 'history' && (
        <div className="space-y-4">
          <div className="p-4 bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[4px_4px_0px_#1A1209] space-y-3 font-mono text-xs">
            <div>
              <span className="text-[10px] font-bold text-[#B84915] uppercase tracking-wider block">
                COMPLETED ARCHIVES
              </span>
              <h2 className="text-sm font-black uppercase text-[#1A1209] dark:text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#B84915]" /> OFFICIAL SUBMISSION HISTORY
              </h2>
              <p className="text-xs text-[#786958]">
                Every completed submission with immutable cryptographic snapshots, evaluator marks, and digital verification signatures.
              </p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#1A1209]">
              <div className="relative min-w-[180px] flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#786958]" />
                <input
                  type="text"
                  placeholder="Filter submissions by title or subject..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209] text-xs"
                />
              </div>

              <select
                value={historyTypeFilter}
                onChange={(e) => setHistoryTypeFilter(e.target.value)}
                className="px-2.5 py-1 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209] text-xs"
              >
                <option value="ALL">All Types</option>
                <option value="Assignment">Assignments</option>
                <option value="Experiment">Experiments</option>
                <option value="Special Document">Special Documents</option>
              </select>

              <select
                value={historySubjectFilter}
                onChange={(e) => setHistorySubjectFilter(e.target.value)}
                className="px-2.5 py-1 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209] text-xs"
              >
                <option value="ALL">All Subjects</option>
                {workspace?.subject_folders?.map((s) => (
                  <option key={s.subject_id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* History table */}
          <div className="bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[4px_4px_0px_#1A1209] overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#FAF6EE] dark:bg-[#26201B] border-b-2 border-[#1A1209] uppercase text-[10px]">
                <tr>
                  <th className="p-3 border-r border-[#1A1209]">Submitted Document</th>
                  <th className="p-3 border-r border-[#1A1209]">Course & AY</th>
                  <th className="p-3 border-r border-[#1A1209]">Submission Date</th>
                  <th className="p-3 border-r border-[#1A1209]">On-Time / Late Status</th>
                  <th className="p-3 border-r border-[#1A1209]">Evaluation & Marks</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A1209]">
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-[#786958]">
                      No completed submissions found matching current criteria.
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((h, idx) => (
                    <tr key={h.submission_id + idx} className="hover:bg-[#FAF6EE] dark:hover:bg-[#26201B]">
                      <td className="p-3 border-r border-[#1A1209]">
                        <div className="font-bold text-[#1A1209] dark:text-white">{h.title}</div>
                        <span
                          className={`inline-block px-1.5 py-0.5 mt-1 text-[9px] uppercase font-bold border border-[#1A1209] ${getTaskTypeBadge(
                            h.task_type
                          )}`}
                        >
                          {h.task_type}
                        </span>
                      </td>
                      <td className="p-3 border-r border-[#1A1209]">
                        <div>{h.subject_name}</div>
                        <div className="text-[10px] text-[#786958]">
                          {h.academic_year} &bull; Sem {h.semester_number}
                        </div>
                      </td>
                      <td className="p-3 border-r border-[#1A1209] whitespace-nowrap">
                        <div>{h.submission_date}</div>
                      </td>
                      <td className="p-3 border-r border-[#1A1209] whitespace-nowrap">
                        {h.is_late ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#B91C1C] text-white text-[10px] font-bold border border-[#1A1209]">
                            <AlertTriangle className="w-3 h-3" /> {h.delay_text}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#1F5A2E] text-white text-[10px] font-bold border border-[#1A1209]">
                            <CheckCircle2 className="w-3 h-3" /> ON TIME
                          </span>
                        )}
                      </td>
                      <td className="p-3 border-r border-[#1A1209]">
                        {h.marks_awarded !== null && h.marks_awarded !== undefined ? (
                          <div>
                            <span className="font-bold text-xs text-[#1F5A2E]">
                              {h.marks_awarded} / {h.max_marks} Marks
                            </span>
                            {h.feedback && (
                              <div className="text-[10px] text-[#786958] truncate max-w-[200px]" title={h.feedback}>
                                Feedback: "{h.feedback}"
                              </div>
                            )}
                            {h.digital_signature_code && (
                              <div className="text-[9px] text-[#1A365D] mt-0.5">
                                Verified: {h.digital_signature_code.substring(0, 12)}...
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 bg-[#FFFAF1] text-[#B84915] text-[10px] font-bold border border-[#1A1209]">
                            AWAITING EVALUATION
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => onOpenEditor(h.document_id)}
                          className="px-2.5 py-1 bg-[#1A365D] text-white text-[10px] font-bold border border-[#1A1209] hover:bg-[#12243F]"
                        >
                          VIEW DOSSIER
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
    </div>
  );
};
