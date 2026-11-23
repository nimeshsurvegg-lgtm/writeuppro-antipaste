import React, { useState, useEffect } from 'react';
import {
  Folder, FileCheck, CheckCircle2, RotateCcw, Download, Eye,
  Search, Filter, AlertTriangle, ArrowLeft, ShieldCheck, Check, Clock
} from 'lucide-react';
import { api } from '../lib/api';
import { Submission, User } from '../types';

interface FacultyWorkspaceProps {
  currentUser: User;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const FacultyWorkspace: React.FC<FacultyWorkspaceProps> = ({ currentUser, showToast }) => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [activeSubmission, setActiveSubmission] = useState<Submission | null>(null);
  const [similarity, setSimilarity] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);

  // Rubric Scores State
  const [scoreK, setScoreK] = useState<number>(0);
  const [scoreC, setScoreC] = useState<number>(0);
  const [scoreP, setScoreP] = useState<number>(0);
  const [scorePerf, setScorePerf] = useState<number>(0);
  const [feedback, setFeedback] = useState('');
  const [remarks, setRemarks] = useState('Approved and verified');

  useEffect(() => {
    loadSubmissions();
  }, [statusFilter]);

  const loadSubmissions = async () => {
    try {
      setLoading(true);
      const data = await api.submissions.listSubmissions({
        status_filter: statusFilter || undefined,
      });
      setSubmissions(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to load submissions', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openEvaluation = async (sub: Submission) => {
    try {
      const [fullSub, simResult] = await Promise.all([
        api.submissions.getSubmission(sub.submission_id),
        api.evaluations.getSimilarity(sub.submission_id).catch(() => null),
      ]);
      setActiveSubmission(fullSub);
      setSimilarity(simResult);

      if (fullSub.status === 'graded') {
        const scores = fullSub.rubric_scores_json ? JSON.parse(fullSub.rubric_scores_json) : {};
        setScoreK(scores.knowledge || 0);
        setScoreC(scores.content || 0);
        setScoreP(scores.punctuality || 0);
        setScorePerf(scores.performance || 0);
        setFeedback(fullSub.feedback || '');
        setRemarks(fullSub.faculty_remarks || '');
      } else {
        // Reset defaults
        setScoreK(3);
        setScoreC(2);
        setScoreP(2);
        setScorePerf(3);
        setFeedback('');
        setRemarks('Approved and verified');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load submission details', 'error');
    }
  };

  const isAssignment = activeSubmission?.doc_type === 'Assignment';
  const maxAllowed = isAssignment ? 10 : 15;
  const currentTotal = isAssignment ? scoreK + scoreC + scoreP : scoreK + scoreC + scoreP + scorePerf;
  const isScoreInvalid =
    currentTotal > maxAllowed ||
    scoreK > 4 ||
    scoreC > 3 ||
    scoreP > 3 ||
    (!isAssignment && scorePerf > 5);

  const handleApprove = async () => {
    if (!activeSubmission) return;
    if (isScoreInvalid) {
      showToast(`Total score exceeds maximum allowed limit (${maxAllowed}). Please check rubric inputs.`, 'error');
      return;
    }

    const subId = activeSubmission.submission_id || (activeSubmission as any).id;
    if (!subId) {
      showToast('Error: Unable to identify submission ID.', 'error');
      return;
    }

    try {
      const payload = {
        submission_id: subId,
        marks_awarded: currentTotal,
        rubric_scores: isAssignment
          ? { knowledge: scoreK, content: scoreC, punctuality: scoreP }
          : { knowledge: scoreK, content: scoreC, punctuality: scoreP, performance: scorePerf },
        feedback,
        remarks,
      };

      const res = await api.evaluations.submitEvaluation(payload);
      showToast(`Evaluation Approved! Digital Stamp: ${res.digital_signature_code}`, 'success');
      loadSubmissions();
      // Update active submission state to graded
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
    if (!subId) {
      showToast('Error: Unable to identify submission ID.', 'error');
      return;
    }
    const reason = prompt('Enter specific revision notes or discrepancies for returning this submission:', 'Please improve theoretical analysis and add code comments.');
    if (!reason) return;

    try {
      await api.evaluations.returnSubmission(subId, reason);
      showToast('Document returned to student for corrections.', 'info');
      loadSubmissions();
      setActiveSubmission(null);
    } catch (err: any) {
      showToast(err.message || 'Failed to return submission', 'error');
    }
  };

  // Group submissions by classroom folder
  const filteredSubmissions = submissions.filter((s) => {
    const matchSearch =
      s.student_name.toLowerCase().includes(search.toLowerCase()) ||
      s.subject_name.toLowerCase().includes(search.toLowerCase()) ||
      s.title.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  const classroomFolders = filteredSubmissions.reduce((acc, sub) => {
    const folderKey = `${sub.year_level || 'SE'} - ${sub.branch_code || 'CE'} (${sub.division_name || 'Div A'})`;
    if (!acc[folderKey]) acc[folderKey] = [];
    acc[folderKey].push(sub);
    return acc;
  }, {} as Record<string, Submission[]>);

  if (activeSubmission) {
    return (
      <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden bg-slate-100 dark:bg-slate-950">
        {/* Top Evaluation Action Bar */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex items-center justify-between shadow-sm z-20">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveSubmission(null)}
              className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center gap-1 text-sm font-semibold"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Classroom Inbox
            </button>
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-800" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {activeSubmission.title}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Author: <span className="font-semibold">{activeSubmission.student_name}</span> • Roll:{' '}
                <span className="font-mono">{activeSubmission.roll_number}</span> • Code:{' '}
                <span className="font-mono text-indigo-600">{activeSubmission.submission_code}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={api.exports.getPdfUrl(activeSubmission.document_id)}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 rounded-xl flex items-center gap-1.5 shadow-sm"
            >
              <Download className="w-4 h-4 text-slate-500" /> PDF Copy
            </a>

            {activeSubmission.status !== 'graded' && (
              <button
                onClick={handleReturn}
                className="px-3.5 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 hover:bg-amber-100 rounded-xl flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" /> Return for Corrections
              </button>
            )}
          </div>
        </div>

        {/* Split Screen Workspace */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel: Read-Only Student Document Preview */}
          <div className="flex-1 overflow-y-auto p-8 bg-slate-200/50 dark:bg-slate-950 flex justify-center items-start">
            <div className="w-[210mm] min-h-[297mm] bg-white text-slate-900 p-[20mm] shadow-xl rounded-sm border border-slate-300 font-sans">
              {/* Cover Page */}
              <div className="border-b-2 border-indigo-600 pb-4 mb-6 text-center">
                <h1 className="text-lg font-extrabold uppercase text-slate-900">
                  Imperial Institute of Engineering & Technology
                </h1>
                <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">
                  Department of Computer Engineering • Academic Year 2026-27
                </p>
              </div>

              <table className="w-full text-xs border-collapse border border-slate-300 mb-6">
                <tbody>
                  <tr className="bg-slate-50">
                    <td className="border border-slate-300 p-2 font-bold w-1/3">Class & Division</td>
                    <td className="border border-slate-300 p-2">{`${activeSubmission.year_level} - ${activeSubmission.division_name}`}</td>
                    <td className="border border-slate-300 p-2 font-bold w-1/3">Subject Code</td>
                    <td className="border border-slate-300 p-2">{activeSubmission.subject_code}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-300 p-2 font-bold">Subject Name</td>
                    <td className="border border-slate-300 p-2" colSpan={3}>{activeSubmission.subject_name}</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="border border-slate-300 p-2 font-bold">{activeSubmission.doc_type} No.</td>
                    <td className="border border-slate-300 p-2">{activeSubmission.doc_number}</td>
                    <td className="border border-slate-300 p-2 font-bold">Roll Number</td>
                    <td className="border border-slate-300 p-2 font-mono font-bold">{activeSubmission.roll_number}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-300 p-2 font-bold">Submission Date</td>
                    <td className="border border-slate-300 p-2">{activeSubmission.submission_date}</td>
                    <td className="border border-slate-300 p-2 font-bold">Status</td>
                    <td className="border border-slate-300 p-2 font-bold text-indigo-600 uppercase">
                      {activeSubmission.status}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Evaluation Rubric Matrix */}
              <div className="mb-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Evaluation Rubric Criteria Matrix ({isAssignment ? 'Max 10 Marks' : 'Max 15 Marks'})
                </h3>
                {isAssignment ? (
                  <table className="w-full text-xs border-collapse border border-slate-300 text-center">
                    <thead>
                      <tr className="bg-slate-100 font-bold">
                        <th className="border border-slate-300 p-2 text-left">Criteria</th>
                        <th className="border border-slate-300 p-2">Below Exp.</th>
                        <th className="border border-slate-300 p-2">Average</th>
                        <th className="border border-slate-300 p-2">Good</th>
                        <th className="border border-slate-300 p-2 w-16">Awarded</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-slate-300 p-2 text-left font-semibold">Knowledge & Understanding (4)</td>
                        <td className="border border-slate-300 p-2">2</td>
                        <td className="border border-slate-300 p-2">3</td>
                        <td className="border border-slate-300 p-2">4</td>
                        <td className="border border-slate-300 p-2 font-bold text-indigo-600">{scoreK}</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 p-2 text-left font-semibold">Content & Neatness (3)</td>
                        <td className="border border-slate-300 p-2">1</td>
                        <td className="border border-slate-300 p-2">2</td>
                        <td className="border border-slate-300 p-2">3</td>
                        <td className="border border-slate-300 p-2 font-bold text-indigo-600">{scoreC}</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 p-2 text-left font-semibold">Punctuality (3)</td>
                        <td className="border border-slate-300 p-2">1</td>
                        <td className="border border-slate-300 p-2">2</td>
                        <td className="border border-slate-300 p-2">3</td>
                        <td className="border border-slate-300 p-2 font-bold text-indigo-600">{scoreP}</td>
                      </tr>
                      <tr className="bg-slate-50 font-bold">
                        <td className="border border-slate-300 p-2 text-left" colSpan={4}>
                          TOTAL MARKS (10)
                        </td>
                        <td className="border border-slate-300 p-2 text-base text-indigo-700">
                          {currentTotal}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full text-xs border-collapse border border-slate-300 text-center">
                    <thead>
                      <tr className="bg-slate-100 font-bold">
                        <th className="border border-slate-300 p-2 text-left">Criteria</th>
                        <th className="border border-slate-300 p-2">Below Exp.</th>
                        <th className="border border-slate-300 p-2">Average</th>
                        <th className="border border-slate-300 p-2">Good</th>
                        <th className="border border-slate-300 p-2 w-16">Awarded</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-slate-300 p-2 text-left font-semibold">Knowledge & Theory (4)</td>
                        <td className="border border-slate-300 p-2">2</td>
                        <td className="border border-slate-300 p-2">3</td>
                        <td className="border border-slate-300 p-2">4</td>
                        <td className="border border-slate-300 p-2 font-bold text-indigo-600">{scoreK}</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 p-2 text-left font-semibold">Performance & Implementation (5)</td>
                        <td className="border border-slate-300 p-2">2</td>
                        <td className="border border-slate-300 p-2">3</td>
                        <td className="border border-slate-300 p-2">5</td>
                        <td className="border border-slate-300 p-2 font-bold text-indigo-600">{scorePerf}</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 p-2 text-left font-semibold">Content & Observations (3)</td>
                        <td className="border border-slate-300 p-2">1</td>
                        <td className="border border-slate-300 p-2">2</td>
                        <td className="border border-slate-300 p-2">3</td>
                        <td className="border border-slate-300 p-2 font-bold text-indigo-600">{scoreC}</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 p-2 text-left font-semibold">Punctuality (3)</td>
                        <td className="border border-slate-300 p-2">1</td>
                        <td className="border border-slate-300 p-2">2</td>
                        <td className="border border-slate-300 p-2">3</td>
                        <td className="border border-slate-300 p-2 font-bold text-indigo-600">{scoreP}</td>
                      </tr>
                      <tr className="bg-slate-50 font-bold">
                        <td className="border border-slate-300 p-2 text-left" colSpan={4}>
                          TOTAL MARKS (15)
                        </td>
                        <td className="border border-slate-300 p-2 text-base text-indigo-700">
                          {currentTotal}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>

              {/* Digital Verification & Stamp Block */}
              <div className="border-t border-slate-300 pt-4 flex items-center justify-between text-xs text-slate-600 mb-6">
                <div>
                  <p>Digital Submission Verification Code:</p>
                  <p className="font-mono font-bold text-slate-900">{activeSubmission.submission_code || 'PENDING SUBMISSION'}</p>
                </div>
                <div className="text-right">
                  <p>Faculty Approval Signature:</p>
                  <div className="min-h-10 flex flex-col items-end justify-center">
                    {activeSubmission.status === 'graded' ? (
                      <>
                        <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                          DIGITALLY VERIFIED
                        </span>
                        {activeSubmission.digital_signature_code && (
                          <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                            {activeSubmission.digital_signature_code}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-400">________________________</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Rendered Document Content */}
              <div className="border-t-2 border-dashed border-slate-300 pt-6 mt-6">
                <div
                  className="prose max-w-none text-slate-800 text-[11pt] leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: activeSubmission.snapshot_html || '' }}
                />
              </div>
            </div>
          </div>

          {/* Right Panel: Faculty Evaluation & Rubric Grading */}
          <div className="w-[420px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 overflow-y-auto p-6 flex flex-col justify-between shadow-lg">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-6">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Rubric Evaluation Panel
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Maximum Permissible Score:{' '}
                    <span className="font-bold text-indigo-600">{maxAllowed} Marks</span>
                  </p>
                </div>
                {activeSubmission.status === 'graded' ? (
                  <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold text-xs rounded-full border border-emerald-300 dark:border-emerald-800">
                    GRADED
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-bold text-xs rounded-full border border-amber-300 dark:border-amber-800">
                    PENDING
                  </span>
                )}
              </div>

              {/* Cohort Similarity & Integrity Analysis */}
              {similarity && (
                <div className="mb-6 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-800 dark:text-slate-200 uppercase text-[11px] flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-indigo-500" /> Cohort Similarity Scan
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full font-extrabold text-[10px] uppercase border ${
                        similarity.score > 35
                          ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-400'
                          : similarity.score > 15
                          ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-400'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-400'
                      }`}
                    >
                      {similarity.score}% Match
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-2">
                    {similarity.message}
                  </p>

                  {similarity.highest_match && (
                    <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] space-y-1">
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        Highest Cohort Match: <span className="font-normal">{similarity.highest_match.matched_student_name} ({similarity.highest_match.matched_roll_number})</span>
                      </p>
                      <p className="text-[10px] font-mono text-slate-500">
                        Code: {similarity.highest_match.matched_submission_code}
                      </p>
                      {similarity.matching_excerpts && similarity.matching_excerpts.length > 0 && (
                        <div className="mt-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                          <span className="text-[10px] font-semibold text-slate-500 block">Common Overlap Excerpts:</span>
                          <ul className="list-disc pl-3 text-[10px] font-mono text-slate-600 dark:text-slate-400 space-y-0.5">
                            {similarity.matching_excerpts.map((ex: string, i: number) => (
                              <li key={i} className="truncate">"{ex}"</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Rubric Inputs */}
              <div className="space-y-4 mb-6">
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    <span>1. Knowledge & Conceptual Theory</span>
                    <span className="text-slate-500">Max: 4.0</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="4"
                    step="0.5"
                    value={scoreK}
                    disabled={activeSubmission.status === 'graded'}
                    onChange={(e) => setScoreK(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white"
                  />
                </div>

                {!isAssignment && (
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      <span>2. Practical Implementation & Execution</span>
                      <span className="text-slate-500">Max: 5.0</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      max="5"
                      step="0.5"
                      value={scorePerf}
                      disabled={activeSubmission.status === 'graded'}
                      onChange={(e) => setScorePerf(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                )}

                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    <span>{isAssignment ? '2. Content Structure & Neatness' : '3. Content & Observations'}</span>
                    <span className="text-slate-500">Max: 3.0</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="3"
                    step="0.5"
                    value={scoreC}
                    disabled={activeSubmission.status === 'graded'}
                    onChange={(e) => setScoreC(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    <span>{isAssignment ? '3. Academic Punctuality' : '4. Timeliness & Punctuality'}</span>
                    <span className="text-slate-500">Max: 3.0</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="3"
                    step="0.5"
                    value={scoreP}
                    disabled={activeSubmission.status === 'graded'}
                    onChange={(e) => setScoreP(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white"
                  />
                </div>

                {/* Calculated Total Box */}
                <div className={`p-4 rounded-xl border flex items-center justify-between ${isScoreInvalid ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 text-rose-700' : 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 text-indigo-900 dark:text-indigo-200'}`}>
                  <div>
                    <span className="text-xs uppercase font-bold tracking-wider block">Total Awarded Score</span>
                    <span className="text-xs opacity-75">{isScoreInvalid ? `Exceeds max allowed (${maxAllowed})` : 'Calculated sum'}</span>
                  </div>
                  <div className="text-2xl font-black">
                    {currentTotal} <span className="text-sm font-semibold opacity-60">/ {maxAllowed}</span>
                  </div>
                </div>

                {/* Qualitative Feedback */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                    Faculty Remarks & Qualitative Feedback:
                  </label>
                  <textarea
                    rows={3}
                    value={feedback}
                    disabled={activeSubmission.status === 'graded'}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Enter detailed feedback on student write-up..."
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Digital Signature Verification Reference */}
              {activeSubmission.digital_signature_code && (
                <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 p-3 rounded-xl mb-4 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300 mb-1">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" /> Digitally Signed & Approved
                  </div>
                  <p className="font-mono text-emerald-900 dark:text-emerald-200 text-[10px] break-all">
                    Verification Code: {activeSubmission.digital_signature_code}
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Approval Button */}
            {activeSubmission.status !== 'graded' && (
              <button
                onClick={handleApprove}
                disabled={isScoreInvalid}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" /> Digitally Sign & Approve
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Top Welcome Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Faculty Evaluation Workspace
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Access organized classroom folders, review submissions with split-screen viewer, and apply digital evaluation stamps.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by student, roll no, or subject..."
              className="pl-9 pr-4 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl w-64 focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-semibold text-slate-700 dark:text-slate-300"
          >
            <option value="">All Submissions</option>
            <option value="submitted">Pending Evaluation</option>
            <option value="graded">Graded & Approved</option>
          </select>
        </div>
      </div>

      {/* Classroom Folder View */}
      {Object.keys(classroomFolders).length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center shadow-sm">
          <Folder className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Student Submissions Found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Submissions submitted by students in your assigned subjects and divisions will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(classroomFolders).map(([className, subs]) => {
            const pendingCount = subs.filter((s) => s.status === 'submitted').length;
            return (
              <div
                key={className}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden"
              >
                {/* Folder Header */}
                <div className="px-6 py-4 bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 rounded-xl">
                      <Folder className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">{className}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Classroom Folder</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {pendingCount > 0 && (
                      <span className="px-3 py-1 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 font-bold text-xs rounded-full border border-amber-300 dark:border-amber-800">
                        {pendingCount} Requires Evaluation
                      </span>
                    )}
                    <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-full border border-slate-300 dark:border-slate-700">
                      {subs.length} Total Submissions
                    </span>
                  </div>
                </div>

                {/* Submissions Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50/40 dark:bg-slate-800/20 text-slate-500 uppercase border-b border-slate-200 dark:border-slate-800">
                        <th className="py-3 px-6 font-bold">Student Name</th>
                        <th className="py-3 px-6 font-bold">Roll Number</th>
                        <th className="py-3 px-6 font-bold">Subject</th>
                        <th className="py-3 px-6 font-bold">Document Title</th>
                        <th className="py-3 px-6 font-bold">Status</th>
                        <th className="py-3 px-6 font-bold">Score</th>
                        <th className="py-3 px-6 font-bold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {subs.map((sub) => (
                        <tr
                          key={sub.submission_id}
                          className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3.5 px-6 font-bold text-slate-900 dark:text-white">
                            {sub.student_name}
                          </td>
                          <td className="py-3.5 px-6 font-mono font-semibold text-slate-600 dark:text-slate-400">
                            {sub.roll_number}
                          </td>
                          <td className="py-3.5 px-6 text-slate-700 dark:text-slate-300">
                            {sub.subject_name}
                          </td>
                          <td className="py-3.5 px-6 font-medium text-slate-900 dark:text-white">
                            {sub.title}
                          </td>
                          <td className="py-3.5 px-6">
                            {sub.status === 'graded' ? (
                              <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 text-[11px]">
                                <CheckCircle2 className="w-3 h-3" /> Graded
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800 text-[11px]">
                                <Clock className="w-3 h-3" /> Pending Evaluation
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-6 font-bold text-slate-900 dark:text-white">
                            {sub.marks_awarded !== undefined && sub.marks_awarded !== null ? (
                              <span className="text-indigo-600 dark:text-indigo-400 font-extrabold text-sm">
                                {sub.marks_awarded}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-3.5 px-6 text-right">
                            <button
                              onClick={() => openEvaluation(sub)}
                              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm inline-flex items-center gap-1.5"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              {sub.status === 'graded' ? 'View Evaluation' : 'Evaluate'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
