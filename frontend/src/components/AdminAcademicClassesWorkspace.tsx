import React, { useState, useEffect, useMemo } from 'react';
import {
  Folder, FolderOpen, Search, Filter, Users, BookOpen, Layers,
  CheckSquare, Award, Clock, AlertTriangle, ArrowRight, ChevronRight,
  Download, RefreshCw, Eye, Plus, ShieldCheck, Lock, ExternalLink
} from 'lucide-react';
import { api } from '../lib/api';
import {
  AdminClassFoldersResponse, AdminClassFolderItem, AdminClassFolderDetail,
  AcademicCalendar
} from '../types';

interface AdminAcademicClassesWorkspaceProps {
  onNavigateTab: (tabName: string) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const AdminAcademicClassesWorkspace: React.FC<AdminAcademicClassesWorkspaceProps> = ({
  onNavigateTab,
  showToast,
}) => {
  const [academicYear, setAcademicYear] = useState<string>('2026-27');
  const [branchFilter, setBranchFilter] = useState<string>('All');
  const [yearLevelFilter, setYearLevelFilter] = useState<string>('All');
  const [divisionFilter, setDivisionFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [foldersData, setFoldersData] = useState<AdminClassFoldersResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Drill-down into a specific class folder
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [classDetail, setClassDetail] = useState<AdminClassFolderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [detailTab, setDetailTab] = useState<'students' | 'faculty' | 'subjects' | 'batches' | 'tasks' | 'stats' | 'performance'>('students');

  useEffect(() => {
    loadClasses();
  }, [academicYear, branchFilter, yearLevelFilter, divisionFilter]);

  const loadClasses = async () => {
    try {
      setLoading(true);
      const res = await api.academic.getAdminClassFolders({
        academic_year: academicYear,
        branch_code: branchFilter !== 'All' ? branchFilter : undefined,
        year_level: yearLevelFilter !== 'All' ? yearLevelFilter : undefined,
        division_name: divisionFilter !== 'All' ? divisionFilter : undefined,
      });
      setFoldersData(res);
    } catch (err: any) {
      showToast(err.message || 'Failed to load class folders', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenClass = async (classItem: AdminClassFolderItem) => {
    try {
      setSelectedClassId(classItem.id);
      setDetailLoading(true);
      const detail = await api.academic.getAdminClassFolderDetail(classItem.id);
      setClassDetail(detail);
      setDetailTab('students');
    } catch (err: any) {
      showToast(err.message || 'Failed to open class folder', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const filteredClasses = useMemo(() => {
    if (!foldersData?.classes) return [];
    let list = [...foldersData.classes];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (c) =>
          c.class_name.toLowerCase().includes(q) ||
          c.branch_name.toLowerCase().includes(q) ||
          c.branch_code.toLowerCase().includes(q) ||
          c.division_name.toLowerCase().includes(q)
      );
    }

    return list;
  }, [foldersData, searchQuery]);

  // Export class data to CSV
  const handleExportClassCsv = () => {
    if (!classDetail) return;
    const { academic_group, students, submission_stats } = classDetail;
    const lines = [
      `WriteUp Pro Institutional Class Dossier`,
      `Class: ${academic_group.year_level} ${academic_group.branch_name} ${academic_group.division_name}`,
      `Academic Year: ${academic_group.academic_year} (${academic_group.is_archived ? 'Archived' : 'Active'})`,
      `Total Students: ${submission_stats.students_count}`,
      `Total Submissions: ${submission_stats.total_submissions}`,
      `Graded & Signed: ${submission_stats.graded_count}`,
      ``,
      `Roll Number,PRN,Student Name,Email,Status,Batch`,
    ];

    students.forEach((s) => {
      lines.push(`${s.roll_number || 'N/A'},${s.prn || 'N/A'},"${s.name || s.full_name || 'N/A'}",${s.email || ''},${s.status || 'active'},${s.batch_name || 'Unassigned'}`);
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Class_Dossier_${academic_group.academic_year}_${academic_group.branch_code}_${academic_group.year_level}_${academic_group.division_name.replace(' ', '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Class dossier exported to CSV', 'success');
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* ========================================================================= */}
      {/* BREADCRUMB NAVIGATION                                                     */}
      {/* ========================================================================= */}
      <div className="p-3 bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[3px_3px_0px_#1A1209] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => {
              setSelectedClassId(null);
              setClassDetail(null);
            }}
            className={`flex items-center gap-1 px-2.5 py-1 font-bold ${
              !selectedClassId
                ? 'bg-[#1A365D] text-white shadow-[1.5px_1.5px_0px_#1A1209]'
                : 'bg-[#FAF6EE] dark:bg-[#12100E] text-[#1A1209] dark:text-[#D4C7B5]'
            } border border-[#1A1209]`}
          >
            <Folder className="w-3.5 h-3.5 text-[#B84915]" /> Academic Classes
          </button>

          <ChevronRight className="w-3.5 h-3.5 text-[#786958]" />
          <span className="px-2 py-0.5 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209] font-bold text-[#1A1209] dark:text-white">
            {academicYear} {foldersData?.is_archived ? '(Archived)' : ''}
          </span>

          {classDetail && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-[#786958]" />
              <span className="px-2.5 py-1 bg-[#1F5A2E] text-white font-bold border border-[#1A1209] flex items-center gap-1">
                <FolderOpen className="w-3.5 h-3.5" />
                {classDetail.academic_group.year_level} {classDetail.academic_group.branch_name} - {classDetail.academic_group.division_name}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {selectedClassId && (
            <button
              onClick={() => {
                setSelectedClassId(null);
                setClassDetail(null);
              }}
              className="px-2.5 py-1 bg-[#FAF6EE] dark:bg-[#26201B] hover:bg-[#E5DFD3] text-[#1A1209] dark:text-white font-bold border border-[#1A1209]"
            >
              &larr; BACK TO CLASS TREE
            </button>
          )}
          <button
            onClick={loadClasses}
            disabled={loading}
            className="px-2.5 py-1 bg-[#FAF6EE] dark:bg-[#26201B] hover:bg-[#E5DFD3] text-[#1A1209] dark:text-white border border-[#1A1209] flex items-center gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: INSTITUTIONAL CLASS BROWSING TREE & FOLDERS                       */}
      {/* ========================================================================= */}
      {!selectedClassId && (
        <div className="space-y-5">
          {/* Historical / Archived Notice Banner */}
          {foldersData?.is_archived && (
            <div className="p-4 bg-[#FFFAF1] dark:bg-[#231C17] border-2 border-[#1A1209] shadow-[3.5px_3.5px_0px_#1A1209] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#B84915] text-white border border-[#1A1209]">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold uppercase text-[#B84915] text-[10px] tracking-wider block">
                    ARCHIVED ACADEMIC CYCLE &bull; READ-ONLY MODE
                  </span>
                  <h3 className="font-bold text-xs text-[#1A1209] dark:text-white">
                    Historical classes for Academic Year {academicYear} are locked for modification.
                  </h3>
                  <p className="text-[11px] text-[#786958]">
                    Past student records, syllabi allotments, evaluations, and laboratory batches are preserved for institutional audit.
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-[#B84915] text-white font-bold text-[10px] border border-[#1A1209] uppercase">
                READ-ONLY
              </span>
            </div>
          )}

          {/* Academic Tree Filter Bar */}
          <div className="p-4 bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[3.5px_3.5px_0px_#1A1209] flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              {/* Academic Year Selector */}
              <div className="flex items-center gap-1">
                <span className="text-[#786958] font-bold">Academic Year:</span>
                <select
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  className="px-2.5 py-1 bg-[#FAF6EE] dark:bg-[#12100E] border-2 border-[#1A1209] font-bold text-xs"
                >
                  {foldersData?.academic_years?.map((ay) => (
                    <option key={ay.code} value={ay.code}>
                      AY {ay.code} {ay.is_current ? '(Current Active)' : `(${ay.status})`}
                    </option>
                  )) || (
                    <>
                      <option value="2026-27">AY 2026-27 (Current Active)</option>
                      <option value="2025-26">AY 2025-26 (Archived)</option>
                      <option value="2027-28">AY 2027-28 (Upcoming)</option>
                    </>
                  )}
                </select>
              </div>

              {/* Branch Filter */}
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="px-2.5 py-1 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209] text-xs font-bold"
              >
                <option value="All">All Branches</option>
                <option value="CE">Computer Engineering (CE)</option>
                <option value="IT">Information Technology (IT)</option>
                <option value="EXTC">Electronics & Telecom (EXTC)</option>
                <option value="AIDS">AI & Data Science (AIDS)</option>
                <option value="MECH">Mechanical Engineering (MECH)</option>
                <option value="CIVIL">Civil Engineering (CIVIL)</option>
              </select>

              {/* Year Level Filter */}
              <select
                value={yearLevelFilter}
                onChange={(e) => setYearLevelFilter(e.target.value)}
                className="px-2.5 py-1 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209] text-xs"
              >
                <option value="All">All Year Levels</option>
                <option value="FE">First Year (FE)</option>
                <option value="SE">Second Year (SE)</option>
                <option value="TE">Third Year (TE)</option>
                <option value="BE">Final Year (BE)</option>
              </select>

              {/* Division Filter */}
              <select
                value={divisionFilter}
                onChange={(e) => setDivisionFilter(e.target.value)}
                className="px-2.5 py-1 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209] text-xs"
              >
                <option value="All">All Divisions</option>
                <option value="Div A">Division A</option>
                <option value="Div B">Division B</option>
              </select>
            </div>

            {/* Search */}
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#786958]" />
              <input
                type="text"
                placeholder="Search class groups..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209] text-xs"
              />
            </div>
          </div>

          {/* Class Folder Cards Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-[#786958]">
              <span>SHOWING {filteredClasses.length} ACADEMIC GROUPS</span>
              <span>ACADEMIC CYCLE: {academicYear}</span>
            </div>

            {filteredClasses.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-[#1D1814] border-2 border-dashed border-[#1A1209] text-[#786958]">
                No class groups found matching selected filter criteria.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredClasses.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleOpenClass(item)}
                    className="group cursor-pointer bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[3.5px_3.5px_0px_#1A1209] hover:shadow-[5.5px_5.5px_0px_#1A1209] transition-all p-4 flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-[#FAF6EE] dark:bg-[#26201B] border border-[#1A1209] group-hover:bg-[#1A365D] group-hover:text-white transition-colors">
                            <Folder className="w-5 h-5 text-[#B84915] group-hover:text-white" />
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-[#B84915] uppercase tracking-wider block">
                              {item.branch_code} &bull; SEM {item.semester_number}
                            </span>
                            <h3 className="font-bold text-xs text-[#1A1209] dark:text-white group-hover:text-[#1A365D] transition-colors line-clamp-1">
                              {item.class_name}
                            </h3>
                          </div>
                        </div>

                        {item.is_archived && (
                          <span className="px-1.5 py-0.5 bg-[#FAF6EE] text-[#B84915] text-[9px] font-bold border border-[#1A1209]">
                            ARCHIVED
                          </span>
                        )}
                      </div>

                      {/* Headcount metrics */}
                      <div className="grid grid-cols-3 gap-1 text-center text-[10px] bg-[#FAF6EE] dark:bg-[#16120F] p-2 border border-[#1A1209]">
                        <div>
                          <span className="text-[#786958] block text-[9px]">STUDENTS</span>
                          <strong className="text-[#1A1209] dark:text-white text-xs">{item.student_count}</strong>
                        </div>
                        <div>
                          <span className="text-[#786958] block text-[9px]">SUBJECTS</span>
                          <strong className="text-[#B84915] text-xs">{item.subject_count}</strong>
                        </div>
                        <div>
                          <span className="text-[#786958] block text-[9px]">BATCHES</span>
                          <strong className="text-[#1F5A2E] text-xs">{item.batch_count}</strong>
                        </div>
                      </div>

                      <div className="text-[11px] text-[#786958] space-y-0.5 pt-1">
                        <div>Faculty Allocations: <strong>{item.faculty_count} professors</strong></div>
                        <div>Tasks Created: <strong>{item.tasks_count}</strong></div>
                        <div>Total Submissions: <strong>{item.total_submissions}</strong> ({item.pending_evaluations} pending)</div>
                      </div>
                    </div>

                    <div className="pt-3 mt-3 border-t border-[#1A1209] flex items-center justify-between font-bold text-xs text-[#1A365D]">
                      <span>EXPLORE CLASS FOLDER</span>
                      <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: CLASS FOLDER DRILL-DOWN WORKSPACE                                 */}
      {/* ========================================================================= */}
      {selectedClassId && classDetail && (
        <div className="space-y-4">
          {/* Header Banner */}
          <div className="p-5 bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[4px_4px_0px_#1A1209] flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 bg-[#1A365D] text-white text-[10px] font-bold uppercase border border-[#1A1209]">
                  Institutional Class Workspace
                </span>
                {classDetail.academic_group.is_archived && (
                  <span className="px-2 py-0.5 bg-[#B84915] text-white text-[10px] font-bold uppercase border border-[#1A1209]">
                    Read-Only Archive
                  </span>
                )}
              </div>
              <h1 className="text-base font-black uppercase text-[#1A1209] dark:text-white">
                {classDetail.academic_group.year_level} {classDetail.academic_group.branch_name} &bull; {classDetail.academic_group.division_name}
              </h1>
              <p className="text-xs text-[#786958] mt-0.5">
                Academic Year {classDetail.academic_group.academic_year} &bull; Semester {classDetail.academic_group.semester_number} &bull; {classDetail.students.length} Enrolled Students
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportClassCsv}
                className="px-3 py-1.5 bg-[#1F5A2E] text-white font-bold text-xs border border-[#1A1209] shadow-[2px_2px_0px_#1A1209] flex items-center gap-1.5 hover:bg-[#174623]"
              >
                <Download className="w-3.5 h-3.5" /> EXPORT CLASS DOSSIER (CSV)
              </button>
            </div>
          </div>

          {/* Subfolder tabs: Students, Faculty Allocations, Subject Allotments, Laboratory Batches, Tasks, Stats */}
          <div className="flex flex-wrap items-center gap-2 border-b-2 border-[#1A1209] pb-0">
            <button
              onClick={() => setDetailTab('students')}
              className={`px-3 py-1.5 text-xs font-bold border border-[#1A1209] flex items-center gap-1 ${
                detailTab === 'students' ? 'bg-[#1A365D] text-white shadow-[2px_2px_0px_#1A1209]' : 'bg-white dark:bg-[#1D1814]'
              }`}
            >
              <Users className="w-3.5 h-3.5" /> 1. Students ({classDetail.students.length})
            </button>
            <button
              onClick={() => setDetailTab('faculty')}
              className={`px-3 py-1.5 text-xs font-bold border border-[#1A1209] flex items-center gap-1 ${
                detailTab === 'faculty' ? 'bg-[#B84915] text-white shadow-[2px_2px_0px_#1A1209]' : 'bg-white dark:bg-[#1D1814]'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" /> 2. Faculty Allocations ({classDetail.faculty_allocations.length})
            </button>
            <button
              onClick={() => setDetailTab('subjects')}
              className={`px-3 py-1.5 text-xs font-bold border border-[#1A1209] flex items-center gap-1 ${
                detailTab === 'subjects' ? 'bg-[#1F5A2E] text-white shadow-[2px_2px_0px_#1A1209]' : 'bg-white dark:bg-[#1D1814]'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" /> 3. Subject Allotments ({classDetail.faculty_allocations.length})
            </button>
            <button
              onClick={() => setDetailTab('batches')}
              className={`px-3 py-1.5 text-xs font-bold border border-[#1A1209] flex items-center gap-1 ${
                detailTab === 'batches' ? 'bg-[#6B46C1] text-white shadow-[2px_2px_0px_#1A1209]' : 'bg-white dark:bg-[#1D1814]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> 4. Laboratory Batches ({classDetail.batches.length})
            </button>
            <button
              onClick={() => setDetailTab('tasks')}
              className={`px-3 py-1.5 text-xs font-bold border border-[#1A1209] flex items-center gap-1 ${
                detailTab === 'tasks' ? 'bg-[#1A365D] text-white shadow-[2px_2px_0px_#1A1209]' : 'bg-white dark:bg-[#1D1814]'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" /> 5. Tasks & Assessments ({classDetail.tasks.length})
            </button>
            <button
              onClick={() => setDetailTab('stats')}
              className={`px-3 py-1.5 text-xs font-bold border border-[#1A1209] flex items-center gap-1 ${
                detailTab === 'stats' ? 'bg-[#B84915] text-white shadow-[2px_2px_0px_#1A1209]' : 'bg-white dark:bg-[#1D1814]'
              }`}
            >
              <Award className="w-3.5 h-3.5" /> 6. Submission Stats
            </button>
          </div>

          {/* Subfolder Contents */}
          <div className="bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[3.5px_3.5px_0px_#1A1209] p-4">
            {/* 1. Students Subfolder */}
            {detailTab === 'students' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs uppercase text-[#1A1209] dark:text-white">
                    Class Enrolled Students Roster ({classDetail.students.length})
                  </h3>
                  {!classDetail.academic_group.is_archived && (
                    <button
                      onClick={() => onNavigateTab('registrations')}
                      className="px-2.5 py-1 bg-[#1A365D] text-white font-bold text-[10px] border border-[#1A1209]"
                    >
                      MANAGE REGISTRATIONS &rarr;
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto border border-[#1A1209]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF6EE] dark:bg-[#26201B] border-b border-[#1A1209] uppercase text-[10px]">
                      <tr>
                        <th className="p-2.5 border-r border-[#1A1209]">Roll No</th>
                        <th className="p-2.5 border-r border-[#1A1209]">PRN</th>
                        <th className="p-2.5 border-r border-[#1A1209]">Student Name</th>
                        <th className="p-2.5 border-r border-[#1A1209]">Email</th>
                        <th className="p-2.5 border-r border-[#1A1209]">Batch</th>
                        <th className="p-2.5 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1A1209]">
                      {classDetail.students.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-[#786958]">
                            No students registered in this class group.
                          </td>
                        </tr>
                      ) : (
                        classDetail.students.map((st, idx) => (
                          <tr key={st.user_id || st.student_id || idx} className="hover:bg-[#FAF6EE] dark:hover:bg-[#26201B]">
                            <td className="p-2.5 border-r border-[#1A1209] font-bold">{st.roll_number || 'N/A'}</td>
                            <td className="p-2.5 border-r border-[#1A1209]">{st.prn || 'N/A'}</td>
                            <td className="p-2.5 border-r border-[#1A1209] font-bold text-[#1A1209] dark:text-white">
                              {st.name || st.full_name}
                            </td>
                            <td className="p-2.5 border-r border-[#1A1209] text-[#786958]">{st.email}</td>
                            <td className="p-2.5 border-r border-[#1A1209]">
                              <span className="px-1.5 py-0.5 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209] font-bold text-[10px]">
                                {st.batch_name || 'Unassigned'}
                              </span>
                            </td>
                            <td className="p-2.5 text-right font-bold uppercase text-[10px]">
                              <span className="px-1.5 py-0.5 bg-[#1F5A2E] text-white border border-[#1A1209]">
                                {st.status || 'Active'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 2. Faculty Allocations */}
            {detailTab === 'faculty' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs uppercase text-[#B84915]">
                    Faculty Subject Allocations ({classDetail.faculty_allocations.length})
                  </h3>
                  {!classDetail.academic_group.is_archived && (
                    <button
                      onClick={() => onNavigateTab('allotment_wizard')}
                      className="px-2.5 py-1 bg-[#B84915] text-white font-bold text-[10px] border border-[#1A1209]"
                    >
                      ALLOTMENT WIZARD &rarr;
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {classDetail.faculty_allocations.map((fa, idx) => (
                    <div key={fa.allotment_id + idx} className="p-3 bg-[#FAF6EE] dark:bg-[#26201B] border border-[#1A1209] space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-[#1A1209] dark:text-white">{fa.subject_name}</span>
                        <span className="px-1.5 py-0.5 bg-white dark:bg-[#1D1814] text-[9px] font-bold border border-[#1A1209]">
                          {fa.subject_code}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#786958]">
                        Assigned Faculty: <strong className="text-[#1A1209] dark:text-white">{fa.faculty_name}</strong> ({fa.faculty_email})
                      </div>
                      <div className="text-[10px] text-[#786958]">
                        Course Type: {fa.subject_type || 'Theory'} &bull; Credits: {fa.credits || 3.0}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Subject Allotments */}
            {detailTab === 'subjects' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs uppercase text-[#1F5A2E]">
                    Curriculum Allotted Courses
                  </h3>
                </div>
                <div className="space-y-2">
                  {classDetail.faculty_allocations.map((fa, idx) => (
                    <div key={fa.subject_id + idx} className="p-3 border border-[#1A1209] flex items-center justify-between">
                      <div>
                        <div className="font-bold text-xs text-[#1A1209] dark:text-white">{fa.subject_name} ({fa.subject_code})</div>
                        <div className="text-[10px] text-[#786958]">Scheme: {fa.syllabus_scheme || 'Mumbai University Rev-2019 C Scheme'}</div>
                      </div>
                      <div className="text-right">
                        <span className="px-2 py-0.5 bg-[#FAF6EE] dark:bg-[#12100E] border border-[#1A1209] font-bold text-[10px]">
                          {fa.credits || 3.0} Credits
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Laboratory Batches */}
            {detailTab === 'batches' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs uppercase text-[#6B46C1]">
                    Laboratory Batches ({classDetail.batches.length})
                  </h3>
                  {!classDetail.academic_group.is_archived && (
                    <button
                      onClick={() => onNavigateTab('batches')}
                      className="px-2.5 py-1 bg-[#6B46C1] text-white font-bold text-[10px] border border-[#1A1209]"
                    >
                      MANAGE LAB BATCHES &rarr;
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {classDetail.batches.map((b, idx) => (
                    <div key={b.id + idx} className="p-3 bg-[#FAF6EE] dark:bg-[#26201B] border border-[#1A1209] space-y-1">
                      <div className="flex items-center justify-between">
                        <strong className="text-xs text-[#1A1209] dark:text-white">{b.batch_name}</strong>
                        <span className="px-1.5 py-0.5 bg-white dark:bg-[#1D1814] text-[9px] font-bold border border-[#1A1209]">
                          {b.student_count || 0} / {b.capacity} Students
                        </span>
                      </div>
                      <div className="text-[10px] text-[#786958]">Faculty: {b.faculty_name || 'Prof. Elizabeth Smith'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. Tasks */}
            {detailTab === 'tasks' && (
              <div className="space-y-3">
                <h3 className="font-bold text-xs uppercase text-[#1A365D]">
                  Assignments & Experiments ({classDetail.tasks.length})
                </h3>
                <div className="space-y-2">
                  {classDetail.tasks.length === 0 ? (
                    <p className="text-xs text-[#786958]">No assignments created in this group.</p>
                  ) : (
                    classDetail.tasks.map((t, idx) => (
                      <div key={t.id + idx} className="p-3 border border-[#1A1209] flex items-center justify-between">
                        <div>
                          <div className="font-bold text-xs text-[#1A1209] dark:text-white">{t.title}</div>
                          <div className="text-[10px] text-[#786958]">{t.subject_name} &bull; Due: {t.due_date ? t.due_date.replace('T', ' ').substring(0, 16) : 'N/A'}</div>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-xs text-[#1F5A2E]">{t.submissions_count} Submissions</span>
                          <div className="text-[10px] text-[#786958]">{t.graded_count} Graded</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* 6. Stats */}
            {detailTab === 'stats' && (
              <div className="space-y-4">
                <h3 className="font-bold text-xs uppercase text-[#B84915]">
                  Submission & Evaluation Statistics
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                  <div className="p-3 bg-[#FAF6EE] dark:bg-[#26201B] border border-[#1A1209]">
                    <span className="text-[10px] text-[#786958] block">TOTAL TASKS</span>
                    <strong className="text-base text-[#1A1209] dark:text-white">{classDetail.submission_stats.total_tasks}</strong>
                  </div>
                  <div className="p-3 bg-[#FAF6EE] dark:bg-[#26201B] border border-[#1A1209]">
                    <span className="text-[10px] text-[#786958] block">TOTAL SUBMISSIONS</span>
                    <strong className="text-base text-[#1A365D]">{classDetail.submission_stats.total_submissions}</strong>
                  </div>
                  <div className="p-3 bg-[#FAF6EE] dark:bg-[#26201B] border border-[#1A1209]">
                    <span className="text-[10px] text-[#786958] block">GRADED & APPROVED</span>
                    <strong className="text-base text-[#1F5A2E]">{classDetail.submission_stats.graded_count}</strong>
                  </div>
                  <div className="p-3 bg-[#FAF6EE] dark:bg-[#26201B] border border-[#1A1209]">
                    <span className="text-[10px] text-[#786958] block">PENDING EVALUATION</span>
                    <strong className="text-base text-[#B84915]">{classDetail.submission_stats.pending_evaluations}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
