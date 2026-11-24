import React, { useState, useEffect } from 'react';
import {
  Plus, FileText, CheckCircle2, Clock, AlertTriangle, Download, Copy,
  ArrowRight, BookOpen, Award, Check, AlertCircle, Edit3, Trash2
} from 'lucide-react';
import { api } from '../lib/api';
import { AcademicDocument, User, StudentProfile } from '../types';

interface StudentWorkspaceProps {
  currentUser: User;
  onOpenEditor: (docId: string | null) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onProfileUpdated: () => void;
}

export const StudentWorkspace: React.FC<StudentWorkspaceProps> = ({
  currentUser,
  onOpenEditor,
  showToast,
  onProfileUpdated,
}) => {
  const [profile, setProfile] = useState<StudentProfile | null>(
    (currentUser.profile as StudentProfile) || null
  );
  const [documents, setDocuments] = useState<AcademicDocument[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

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
      const [docs, stats, taskList] = await Promise.all([
        api.documents.listDocuments(),
        api.analytics.getStudentAnalytics(),
        api.tasks.listTasks(),
      ]);
      setDocuments(docs);
      setAnalytics(stats);
      setTasks(taskList);
    } catch (err: any) {
      console.error(err);
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

  const isPending = profile?.status === 'pending';
  const isRejected = profile?.status === 'rejected';
  const isBlocked = profile?.status === 'blocked';
  const isApproved = profile?.status === 'approved';

  // If student needs initial setup or has rejected status
  if (!profile || isRejected) {
    return (
      <div className="max-w-2xl mx-auto p-8 my-8 bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[6px_6px_0px_#1A1209]">
        <div className="text-center mb-8">
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#B84915] block mb-1">
            MANDATORY ONBOARDING // PROTOCOL 01
          </span>
          <h2 className="text-xl font-bold tracking-tight text-[#1A1209] dark:text-white">
            Academic Profile Registration
          </h2>
          <p className="text-xs text-[#5C4D3C] dark:text-[#B8A99A] mt-1 font-mono">
            Complete institutional academic configuration before accessing the authoring workspace.
          </p>
        </div>

        {isRejected && (
          <div className="bg-[#FFF5F5] dark:bg-[#2A1515] border-2 border-[#8B1A1A] p-4 mb-6 flex items-start gap-3 shadow-[3px_3px_0px_#8B1A1A]">
            <AlertCircle className="w-5 h-5 text-[#8B1A1A] mt-0.5 shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-[#8B1A1A] font-mono uppercase">
                Application Reverted by Administrator
              </h4>
              <p className="text-xs text-[#5C4D3C] dark:text-[#D4C7B5] mt-0.5 font-mono">
                Remarks: {profile.admin_remarks || 'Please verify your details and resubmit.'}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div>
            <label className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#1A1209] dark:text-[#D4C7B5] block mb-1">
              Roll Number:
            </label>
            <input
              type="text"
              required
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value)}
              placeholder="e.g. 21CE104"
              className="w-full px-4 py-2.5 bg-[#FFFAF1] dark:bg-[#26201B] border-2 border-[#1A1209] font-mono font-bold text-xs text-[#1A1209] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#B84915]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#1A1209] dark:text-[#D4C7B5] block mb-1">
                Year Level:
              </label>
              <select
                value={yearLevel}
                onChange={(e) => setYearLevel(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#FFFAF1] dark:bg-[#26201B] border-2 border-[#1A1209] font-mono font-semibold text-xs text-[#1A1209] dark:text-white focus:outline-none"
              >
                <option value="FE">First Year (FE)</option>
                <option value="SE">Second Year (SE)</option>
                <option value="TE">Third Year (TE)</option>
                <option value="BE">Final Year (BE)</option>
              </select>
            </div>

            <div>
              <label className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#1A1209] dark:text-[#D4C7B5] block mb-1">
                Department / Branch:
              </label>
              <select
                value={branchCode}
                onChange={(e) => setBranchCode(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#FFFAF1] dark:bg-[#26201B] border-2 border-[#1A1209] font-mono font-semibold text-xs text-[#1A1209] dark:text-white focus:outline-none"
              >
                <option value="CE">Computer Engineering (CE)</option>
                <option value="IT">Information Technology (IT)</option>
                <option value="ASH">Applied Science & Humanities (ASH)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#1A1209] dark:text-[#D4C7B5] block mb-1">
                Semester:
              </label>
              <select
                value={semNumber}
                onChange={(e) => setSemNumber(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-[#FFFAF1] dark:bg-[#26201B] border-2 border-[#1A1209] font-mono font-semibold text-xs text-[#1A1209] dark:text-white focus:outline-none"
              >
                <option value={1}>Semester 1</option>
                <option value={2}>Semester 2</option>
                <option value={3}>Semester 3</option>
                <option value={4}>Semester 4</option>
                <option value={5}>Semester 5</option>
                <option value={6}>Semester 6</option>
                <option value={7}>Semester 7</option>
                <option value={8}>Semester 8</option>
              </select>
            </div>

            <div>
              <label className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#1A1209] dark:text-[#D4C7B5] block mb-1">
                Division:
              </label>
              <select
                value={division}
                onChange={(e) => setDivision(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#FFFAF1] dark:bg-[#26201B] border-2 border-[#1A1209] font-mono font-semibold text-xs text-[#1A1209] dark:text-white focus:outline-none"
              >
                <option value="Div A">Division A</option>
                <option value="Div B">Division B</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#1A1209] dark:text-[#D4C7B5] block mb-1">
              Open Elective Subject (Optional):
            </label>
            <select
              value={elective}
              onChange={(e) => setElective(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#FFFAF1] dark:bg-[#26201B] border-2 border-[#1A1209] font-mono text-xs text-[#1A1209] dark:text-white focus:outline-none"
            >
              <option value="">No Elective / Standard Course</option>
              <option value="Beginner French">Beginner French (OE-FRN1)</option>
              <option value="Beginner Germany">Beginner Germany (OE-GER1)</option>
              <option value="Digital Video Recording">Digital Video Recording (OE-DVR1)</option>
            </select>
          </div>

          <button
            type="submit"
            className="neo-btn w-full py-3.5 bg-[#B84915] hover:bg-[#A03D0E] text-[#FBF9F3] text-xs mt-4"
          >
            Submit for Administrator Verification →
          </button>
        </form>
      </div>
    );
  }

  // If pending approval
  if (isPending) {
    return (
      <div className="max-w-xl mx-auto p-12 my-12 bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[6px_6px_0px_#1A1209] text-center space-y-4">
        <Clock className="w-12 h-12 text-[#B84915] mx-auto" />
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#B84915] block">
          STATUS // VERIFICATION IN PROGRESS
        </span>
        <h2 className="text-xl font-bold tracking-tight text-[#1A1209] dark:text-white">
          Profile Pending Administrator Verification
        </h2>
        <p className="text-xs text-[#5C4D3C] dark:text-[#B8A99A] font-mono leading-relaxed">
          Your profile (Roll: <span className="font-bold text-[#1A1209] dark:text-white">{profile.roll_number}</span>, {profile.year_level}{' '}
          {profile.branch_code} {profile.division_name}) has been lodged with the academic registry. You will be unlocked to author and submit write-ups once verified.
        </p>
      </div>
    );
  }

  // If blocked
  if (isBlocked) {
    return (
      <div className="max-w-xl mx-auto p-12 my-12 bg-white dark:bg-[#1D1814] border-2 border-[#8B1A1A] shadow-[6px_6px_0px_#8B1A1A] text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-[#8B1A1A] mx-auto" />
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#8B1A1A] block">
          RESTRICTION NOTICE // SECTION 14
        </span>
        <h2 className="text-xl font-bold tracking-tight text-[#8B1A1A]">Account Access Suspended</h2>
        <p className="text-xs text-[#5C4D3C] dark:text-[#B8A99A] font-mono">
          Your student account has been temporarily restricted by the institution administrator. Please contact your department coordinator.
        </p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Welcome Dossier Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#1A365D] dark:bg-[#1D1814] text-white p-8 border-2 border-[#1A1209] shadow-[5px_5px_0px_#1A1209]">
        <div>
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#F4EFE6] opacity-80 block">
            STUDENT ACADEMIC DOSSIER // ROLL NO. {profile.roll_number}
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight mt-1">
            Welcome back, {currentUser.full_name}
          </h1>
          <p className="text-xs font-mono text-[#D4C7B5] mt-1">
            Registry Code: <span className="font-bold text-white">{profile.roll_number}</span> •{' '}
            {profile.year_level} - {profile.branch_code} ({profile.division_name}) • Semester {profile.semester_number}
          </p>
        </div>

        <button
          onClick={() => onOpenEditor(null)}
          className="neo-btn px-5 py-3 bg-[#B84915] hover:bg-[#A03D0E] text-[#FBF9F3] text-xs flex items-center gap-2"
        >
          <Plus className="w-4 h-4 text-white" /> + CREATE ACADEMIC DOCUMENT
        </button>
      </div>

      {/* Analytics & Performance Score Cards */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-[#1D1814] p-5 border-2 border-[#1A1209] shadow-[3.5px_3.5px_0px_#1A1209]">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#786958] dark:text-[#A89886] block">
              Total Authored
            </span>
            <span className="text-2xl font-black text-[#1A1209] dark:text-white mt-1 block font-mono">
              {analytics.summary?.total_docs || 0}
            </span>
          </div>

          <div className="bg-white dark:bg-[#1D1814] p-5 border-2 border-[#1A1209] shadow-[3.5px_3.5px_0px_#1A1209]">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#786958] dark:text-[#A89886] block">
              Assignment Average
            </span>
            <span className="text-2xl font-black text-[#1A365D] dark:text-[#63B3ED] mt-1 block font-mono">
              {analytics.averages?.assignment_avg !== null ? `${analytics.averages.assignment_avg} / 10` : '--'}
            </span>
          </div>

          <div className="bg-white dark:bg-[#1D1814] p-5 border-2 border-[#1A1209] shadow-[3.5px_3.5px_0px_#1A1209]">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#786958] dark:text-[#A89886] block">
              Experiment Average
            </span>
            <span className="text-2xl font-black text-[#1A365D] dark:text-[#63B3ED] mt-1 block font-mono">
              {analytics.averages?.experiment_avg !== null ? `${analytics.averages.experiment_avg} / 15` : '--'}
            </span>
          </div>

          <div className="bg-white dark:bg-[#1D1814] p-5 border-2 border-[#1A1209] shadow-[3.5px_3.5px_0px_#1A1209]">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#786958] dark:text-[#A89886] block">
              Approved & Graded
            </span>
            <span className="text-2xl font-black text-[#1F5A2E] dark:text-[#48BB78] mt-1 block font-mono">
              {analytics.summary?.graded_count || 0}
            </span>
          </div>
        </div>
      )}

      {/* Authored Documents Ledger Table */}
      <div className="bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[4px_4px_0px_#1A1209] overflow-hidden">
        <div className="p-5 bg-[#F4EFE6] dark:bg-[#26201B] border-b-2 border-[#1A1209] flex items-center justify-between">
          <div>
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#B84915] block">
              LEDGER // ARCHIVE DOSSIER
            </span>
            <h3 className="font-bold tracking-tight text-base text-[#1A1209] dark:text-white">
              My Academic Documents
            </h3>
            <p className="text-xs text-[#5C4D3C] dark:text-[#B8A99A] font-mono mt-0.5">
              Drafts, submissions, and evaluated write-ups with rubric breakdown.
            </p>
          </div>
          <span className="stamp-badge bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-white font-mono">
            {documents.length} MANUSCRIPTS
          </span>
        </div>

        {documents.length === 0 ? (
          <div className="p-12 text-center text-[#786958]">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-40 text-[#1A1209]" />
            <p className="text-sm font-bold text-[#1A1209] dark:text-white">No documents authored yet</p>
            <p className="text-xs font-mono mt-1">Click "+ CREATE ACADEMIC DOCUMENT" to start authoring.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#FAF6EE] dark:bg-[#26201B] text-[#1A1209] dark:text-[#D4C7B5] font-mono uppercase border-b-2 border-[#1A1209]">
                  <th className="py-3 px-6 font-bold">Document Title</th>
                  <th className="py-3 px-6 font-bold">Subject</th>
                  <th className="py-3 px-6 font-bold">Type</th>
                  <th className="py-3 px-6 font-bold">Status</th>
                  <th className="py-3 px-6 font-bold">Marks Scored</th>
                  <th className="py-3 px-6 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y border-b border-[#1A1209]/20 font-mono">
                {documents.map((d) => (
                  <tr key={d.id} className="hover:bg-[#FAF6EE] dark:hover:bg-[#26201B] transition-colors">
                    <td className="py-3.5 px-6 font-bold text-[#1A1209] dark:text-white">
                      <span className="font-sans font-bold">{d.title}</span>
                      {d.status === 'returned' && (
                        <span className="block text-[11px] text-[#8B1A1A] font-mono font-normal mt-0.5">
                          Requires corrections: {d.faculty_remarks}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-6 text-[#5C4D3C] dark:text-[#B8A99A]">{d.subject_name}</td>
                    <td className="py-3.5 px-6 font-semibold">{d.doc_type}</td>
                    <td className="py-3.5 px-6">
                      <span
                        className={`stamp-badge ${
                          d.status === 'graded'
                            ? 'bg-[#1F5A2E]/10 text-[#1F5A2E] border-[#1F5A2E]'
                            : d.status === 'submitted'
                            ? 'bg-[#1A365D]/10 text-[#1A365D] border-[#1A365D]'
                            : d.status === 'returned'
                            ? 'bg-[#8B1A1A]/10 text-[#8B1A1A] border-[#8B1A1A]'
                            : 'bg-[#F4EFE6] text-[#786958] border-[#1A1209]'
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 font-bold text-[#1A1209] dark:text-white">
                      {d.marks !== undefined && d.marks !== null ? (
                        <span className="text-[#1F5A2E] dark:text-[#48BB78] font-bold text-sm">
                          {d.marks}
                        </span>
                      ) : (
                        <span className="text-[#786958]">-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-6 text-right space-x-2">
                      <button
                        onClick={() => onOpenEditor(d.id)}
                        className="neo-btn px-3 py-1.5 bg-[#1A365D] hover:bg-[#12243F] text-white text-[11px]"
                      >
                        <Edit3 className="w-3.5 h-3.5 mr-1 inline" />
                        {d.status === 'submitted' || d.status === 'graded' ? 'View' : 'Open'}
                      </button>

                      <button
                        onClick={() => handleDuplicate(d.id)}
                        className="neo-btn px-2.5 py-1.5 bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-white text-[11px]"
                        title="Duplicate as new draft"
                      >
                        <Copy className="w-3 h-3 text-[#786958]" />
                      </button>

                      {d.status === 'draft' && (
                        <button
                          onClick={() => handleDeleteDraft(d.id)}
                          className="neo-btn px-2.5 py-1.5 bg-white dark:bg-[#1D1814] hover:bg-[#8B1A1A] hover:text-white text-[#786958] text-[11px]"
                          title="Delete draft"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}

                      {(d.status === 'submitted' || d.status === 'graded') && (
                        <a
                          href={api.exports.getPdfUrl(d.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="neo-btn px-2.5 py-1.5 bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-white text-[11px]"
                          title="Download PDF"
                        >
                          <Download className="w-3 h-3 text-[#B84915]" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
