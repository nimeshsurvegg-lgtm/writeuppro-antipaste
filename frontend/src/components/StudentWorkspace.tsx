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
      <div className="max-w-2xl mx-auto p-8 my-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">
            Academic Profile Registration
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Complete your institutional academic configuration before accessing the authoring workspace.
          </p>
        </div>

        {isRejected && (
          <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 p-4 rounded-2xl mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-rose-800 dark:text-rose-300">
                Application Reverted by Administrator
              </h4>
              <p className="text-xs text-rose-700 dark:text-rose-400 mt-0.5">
                Remarks: {profile.admin_remarks || 'Please verify your details and resubmit.'}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase block mb-1">
              Roll Number:
            </label>
            <input
              type="text"
              required
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value)}
              placeholder="e.g. 21CE104"
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase block mb-1">
                Year Level:
              </label>
              <select
                value={yearLevel}
                onChange={(e) => setYearLevel(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-semibold text-slate-900 dark:text-white"
              >
                <option value="FE">First Year (FE)</option>
                <option value="SE">Second Year (SE)</option>
                <option value="TE">Third Year (TE)</option>
                <option value="BE">Final Year (BE)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase block mb-1">
                Department / Branch:
              </label>
              <select
                value={branchCode}
                onChange={(e) => setBranchCode(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-semibold text-slate-900 dark:text-white"
              >
                <option value="CE">Computer Engineering (CE)</option>
                <option value="IT">Information Technology (IT)</option>
                <option value="ASH">Applied Science & Humanities (ASH)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase block mb-1">
                Semester:
              </label>
              <select
                value={semNumber}
                onChange={(e) => setSemNumber(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-semibold text-slate-900 dark:text-white"
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
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase block mb-1">
                Division:
              </label>
              <select
                value={division}
                onChange={(e) => setDivision(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-semibold text-slate-900 dark:text-white"
              >
                <option value="Div A">Division A</option>
                <option value="Div B">Division B</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase block mb-1">
              Open Elective Subject (Optional):
            </label>
            <select
              value={elective}
              onChange={(e) => setElective(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            >
              <option value="">No Elective / Standard Course</option>
              <option value="Beginner French">Beginner French (OE-FRN1)</option>
              <option value="Beginner Germany">Beginner Germany (OE-GER1)</option>
              <option value="Digital Video Recording">Digital Video Recording (OE-DVR1)</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/25 mt-4"
          >
            Submit for Administrator Verification
          </button>
        </form>
      </div>
    );
  }

  // If pending approval
  if (isPending) {
    return (
      <div className="max-w-xl mx-auto p-12 my-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm text-center space-y-4">
        <Clock className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Profile Pending Administrator Verification
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Your profile (Roll: <span className="font-mono font-bold">{profile.roll_number}</span>, {profile.year_level}{' '}
          {profile.branch_code} {profile.division_name}) has been submitted. You will be unlocked to author and submit write-ups once verified by the administrator.
        </p>
      </div>
    );
  }

  // If blocked
  if (isBlocked) {
    return (
      <div className="max-w-xl mx-auto p-12 my-12 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 rounded-3xl shadow-sm text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-rose-600 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Account Access Suspended</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Your student account has been temporarily restricted by the institution administrator. Please contact your department coordinator.
        </p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white p-8 rounded-3xl shadow-xl">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-300">
            Student Academic Workspace
          </span>
          <h1 className="text-2xl font-black mt-1">Welcome back, {currentUser.full_name}</h1>
          <p className="text-xs text-indigo-200 mt-1">
            Roll No: <span className="font-mono font-bold text-white">{profile.roll_number}</span> •{' '}
            {profile.year_level} - {profile.branch_code} ({profile.division_name}) • Semester {profile.semester_number}
          </p>
        </div>

        <button
          onClick={() => onOpenEditor(null)}
          className="px-5 py-3 bg-white text-indigo-900 hover:bg-indigo-50 font-extrabold text-xs rounded-2xl shadow-md flex items-center gap-2"
        >
          <Plus className="w-4 h-4 text-indigo-700" /> + Create Academic Document
        </button>
      </div>

      {/* Analytics & Performance Score Cards */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Total Authored</span>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1 block">
              {analytics.summary?.total_docs || 0}
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Assignment Average</span>
            <span className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1 block">
              {analytics.averages?.assignment_avg !== null ? `${analytics.averages.assignment_avg} / 10` : '--'}
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Experiment Average</span>
            <span className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1 block">
              {analytics.averages?.experiment_avg !== null ? `${analytics.averages.experiment_avg} / 15` : '--'}
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Approved & Graded</span>
            <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 block">
              {analytics.summary?.graded_count || 0}
            </span>
          </div>
        </div>
      )}

      {/* Authored Documents Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">My Academic Documents</h3>
            <p className="text-xs text-slate-500">
              Drafts, submissions, and evaluated write-ups with rubric scores.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500">{documents.length} Total</span>
        </div>

        {documents.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">No documents authored yet</p>
            <p className="text-xs mt-1">Click "+ Create Academic Document" to start writing.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 uppercase border-b border-slate-200 dark:border-slate-800">
                  <th className="py-3.5 px-6 font-bold">Document Title</th>
                  <th className="py-3.5 px-6 font-bold">Subject</th>
                  <th className="py-3.5 px-6 font-bold">Type</th>
                  <th className="py-3.5 px-6 font-bold">Status</th>
                  <th className="py-3.5 px-6 font-bold">Marks Scored</th>
                  <th className="py-3.5 px-6 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {documents.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-4 px-6 font-bold text-slate-900 dark:text-white">
                      {d.title}
                      {d.status === 'returned' && (
                        <span className="block text-[11px] text-amber-600 font-normal mt-0.5">
                          Requires corrections: {d.faculty_remarks}
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-slate-700 dark:text-slate-300">{d.subject_name}</td>
                    <td className="py-4 px-6 font-semibold">{d.doc_type}</td>
                    <td className="py-4 px-6">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase border ${
                          d.status === 'graded'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : d.status === 'submitted'
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400'
                            : d.status === 'returned'
                            ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400'
                            : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-bold text-slate-900 dark:text-white">
                      {d.marks !== undefined && d.marks !== null ? (
                        <span className="text-indigo-600 dark:text-indigo-400 font-extrabold text-sm">
                          {d.marks}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right space-x-2">
                      <button
                        onClick={() => onOpenEditor(d.id)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1 shadow-sm"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        {d.status === 'submitted' || d.status === 'graded' ? 'View' : 'Open Workspace'}
                      </button>

                      <button
                        onClick={() => handleDuplicate(d.id)}
                        className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold inline-flex items-center gap-1"
                        title="Duplicate as new draft"
                      >
                        <Copy className="w-3 h-3 text-slate-400" />
                      </button>

                      {d.status === 'draft' && (
                        <button
                          onClick={() => handleDeleteDraft(d.id)}
                          className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-rose-50 hover:text-rose-600 text-slate-400 rounded-xl text-xs font-semibold inline-flex items-center gap-1 transition-colors"
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
                          className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold inline-flex items-center gap-1"
                          title="Download PDF"
                        >
                          <Download className="w-3 h-3 text-indigo-500" />
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
