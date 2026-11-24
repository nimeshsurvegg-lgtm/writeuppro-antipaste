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
      <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden bg-[#FBF9F3] dark:bg-[#14110E]">
        {/* Top Evaluation Action Bar */}
        <div className="bg-white dark:bg-[#1D1814] border-b-2 border-[#1A1209] px-6 py-2.5 flex items-center justify-between shadow-sm z-20">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveSubmission(null)}
              className="neo-btn px-3 py-1.5 bg-[#F4EFE6] dark:bg-[#26201B] text-[#1A1209] dark:text-[#F7F3E9] text-xs flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" /> ← BACK TO INBOX
            </button>
            <div className="h-5 w-0.5 bg-[#1A1209]" />
            <div>
              <h2 className="text-sm font-extrabold text-[#1A1209] dark:text-white tracking-tight">
                {activeSubmission.title}
              </h2>
              <p className="text-xs text-[#786958] dark:text-[#A89886] font-mono">
                Author: <span className="font-bold text-[#1A1209] dark:text-white">{activeSubmission.student_name}</span> • Roll:{' '}
                <span className="font-bold">{activeSubmission.roll_number}</span> • Code:{' '}
                <span className="text-[#B84915] font-bold">{activeSubmission.submission_code}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={api.exports.getPdfUrl(activeSubmission.document_id)}
              target="_blank"
              rel="noreferrer"
              className="neo-btn px-3.5 py-1.5 bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-[#F7F3E9] text-xs flex items-center gap-1.5"
            >
              <Download className="w-4 h-4 text-[#B84915]" /> PDF Copy
            </a>

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
              <div className="border-b-2 border-[#1A1209] pb-4 mb-6 text-center">
                <span className="font-mono text-[9px] uppercase tracking-widest text-[#B84915] font-bold block mb-1">
                  OFFICIAL INSTITUTIONAL SUBMISSION RECORD // DISPATCH NO. {activeSubmission.submission_code}
                </span>
                <h1 className="text-lg font-extrabold uppercase tracking-tight text-[#1A1209]">
                  Imperial Institute of Engineering & Technology
                </h1>
                <p className="text-xs text-[#5C4D3C] uppercase tracking-widest mt-1 font-mono">
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
                    <td className="border-2 border-[#1A1209] p-2 font-sans font-bold" colSpan={3}>{activeSubmission.subject_name}</td>
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
                      <span className="stamp-badge py-0 bg-white text-[#1A1209]">
                        {activeSubmission.status}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Evaluation Rubric Matrix */}
              <div className="mb-6 font-mono">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A1209] mb-2">
                  Evaluation Rubric Criteria Matrix ({isAssignment ? 'Max 10 Marks' : 'Max 15 Marks'})
                </h3>
                {isAssignment ? (
                  <table className="w-full text-xs border-collapse border-2 border-[#1A1209] text-center">
                    <thead>
                      <tr className="bg-[#FAF6EE] font-bold border-b-2 border-[#1A1209]">
                        <th className="border-2 border-[#1A1209] p-2 text-left font-sans">Criteria</th>
                        <th className="border-2 border-[#1A1209] p-2">Below Exp.</th>
                        <th className="border-2 border-[#1A1209] p-2">Average</th>
                        <th className="border-2 border-[#1A1209] p-2">Good</th>
                        <th className="border-2 border-[#1A1209] p-2 w-16">Awarded</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border-2 border-[#1A1209] p-2 text-left font-sans font-semibold">Knowledge & Understanding (4)</td>
                        <td className="border-2 border-[#1A1209] p-2">2</td>
                        <td className="border-2 border-[#1A1209] p-2">3</td>
                        <td className="border-2 border-[#1A1209] p-2">4</td>
                        <td className="border-2 border-[#1A1209] p-2 font-bold text-[#1F5A2E]">{scoreK}</td>
                      </tr>
                      <tr>
                        <td className="border-2 border-[#1A1209] p-2 text-left font-sans font-semibold">Content & Neatness (3)</td>
                        <td className="border-2 border-[#1A1209] p-2">1</td>
                        <td className="border-2 border-[#1A1209] p-2">2</td>
                        <td className="border-2 border-[#1A1209] p-2">3</td>
                        <td className="border-2 border-[#1A1209] p-2 font-bold text-[#1F5A2E]">{scoreC}</td>
                      </tr>
                      <tr>
                        <td className="border-2 border-[#1A1209] p-2 text-left font-sans font-semibold">Punctuality (3)</td>
                        <td className="border-2 border-[#1A1209] p-2">1</td>
                        <td className="border-2 border-[#1A1209] p-2">2</td>
                        <td className="border-2 border-[#1A1209] p-2">3</td>
                        <td className="border-2 border-[#1A1209] p-2 font-bold text-[#1F5A2E]">{scoreP}</td>
                      </tr>
                      <tr className="bg-[#FAF6EE] font-bold border-t-2 border-[#1A1209]">
                        <td className="border-2 border-[#1A1209] p-2 text-left font-sans" colSpan={4}>
                          TOTAL MARKS (10)
                        </td>
                        <td className="border-2 border-[#1A1209] p-2 text-base text-[#1F5A2E]">
                          {currentTotal}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full text-xs border-collapse border-2 border-[#1A1209] text-center">
                    <thead>
                      <tr className="bg-[#FAF6EE] font-bold border-b-2 border-[#1A1209]">
                        <th className="border-2 border-[#1A1209] p-2 text-left font-sans">Criteria</th>
                        <th className="border-2 border-[#1A1209] p-2">Below Exp.</th>
                        <th className="border-2 border-[#1A1209] p-2">Average</th>
                        <th className="border-2 border-[#1A1209] p-2">Good</th>
                        <th className="border-2 border-[#1A1209] p-2 w-16">Awarded</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border-2 border-[#1A1209] p-2 text-left font-sans font-semibold">Knowledge & Theory (4)</td>
                        <td className="border-2 border-[#1A1209] p-2">2</td>
                        <td className="border-2 border-[#1A1209] p-2">3</td>
                        <td className="border-2 border-[#1A1209] p-2">4</td>
                        <td className="border-2 border-[#1A1209] p-2 font-bold text-[#1F5A2E]">{scoreK}</td>
                      </tr>
                      <tr>
                        <td className="border-2 border-[#1A1209] p-2 text-left font-sans font-semibold">Performance & Implementation (5)</td>
                        <td className="border-2 border-[#1A1209] p-2">2</td>
                        <td className="border-2 border-[#1A1209] p-2">3</td>
                        <td className="border-2 border-[#1A1209] p-2">5</td>
                        <td className="border-2 border-[#1A1209] p-2 font-bold text-[#1F5A2E]">{scorePerf}</td>
                      </tr>
                      <tr>
                        <td className="border-2 border-[#1A1209] p-2 text-left font-sans font-semibold">Content & Observations (3)</td>
                        <td className="border-2 border-[#1A1209] p-2">1</td>
                        <td className="border-2 border-[#1A1209] p-2">2</td>
                        <td className="border-2 border-[#1A1209] p-2">3</td>
                        <td className="border-2 border-[#1A1209] p-2 font-bold text-[#1F5A2E]">{scoreC}</td>
                      </tr>
                      <tr>
                        <td className="border-2 border-[#1A1209] p-2 text-left font-sans font-semibold">Punctuality (3)</td>
                        <td className="border-2 border-[#1A1209] p-2">1</td>
                        <td className="border-2 border-[#1A1209] p-2">2</td>
                        <td className="border-2 border-[#1A1209] p-2">3</td>
                        <td className="border-2 border-[#1A1209] p-2 font-bold text-[#1F5A2E]">{scoreP}</td>
                      </tr>
                      <tr className="bg-[#FAF6EE] font-bold border-t-2 border-[#1A1209]">
                        <td className="border-2 border-[#1A1209] p-2 text-left font-sans" colSpan={4}>
                          TOTAL MARKS (15)
                        </td>
                        <td className="border-2 border-[#1A1209] p-2 text-base text-[#1F5A2E]">
                          {currentTotal}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>

              {/* Digital Verification & Stamp Block */}
              <div className="border-t-2 border-[#1A1209] pt-4 flex items-center justify-between text-xs text-[#5C4D3C] mb-6 font-mono">
                <div>
                  <p>Digital Submission Verification Code:</p>
                  <p className="font-bold text-[#1A1209]">{activeSubmission.submission_code || 'PENDING SUBMISSION'}</p>
                </div>
                <div className="text-right">
                  <p>Faculty Approval Signature:</p>
                  <div className="min-h-10 flex flex-col items-end justify-center">
                    {activeSubmission.status === 'graded' ? (
                      <>
                        <span className="stamp-badge bg-[#1F5A2E]/10 text-[#1F5A2E] border-[#1F5A2E] text-xs">
                          DIGITALLY VERIFIED
                        </span>
                        {activeSubmission.digital_signature_code && (
                          <span className="text-[10px] text-[#5C4D3C] mt-0.5">
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
              <div className="border-t-2 border-dashed border-[#1A1209] pt-6 mt-6">
                <div
                  className="prose max-w-none text-[#1A1209] text-[11pt] leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: activeSubmission.snapshot_html || '' }}
                />
              </div>
            </div>
          </div>

          {/* Right Panel: Faculty Evaluation & Rubric Grading */}
          <div className="w-[420px] bg-white dark:bg-[#1D1814] border-l-2 border-[#1A1209] overflow-y-auto p-6 flex flex-col justify-between shadow-lg">
            <div>
              <div className="flex items-center justify-between pb-3 border-b-2 border-[#1A1209] mb-5">
                <div>
                  <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#B84915] block">
                    RUBRIC SCORING CONSOLE
                  </span>
                  <h3 className="text-base font-extrabold tracking-tight text-[#1A1209] dark:text-white">
                    Evaluation Matrix.
                  </h3>
                  <p className="text-xs font-mono text-[#786958]">
                    Max Allowed: <span className="font-bold text-[#1A1209] dark:text-white">{maxAllowed} Marks</span>
                  </p>
                </div>
                <span className={`stamp-badge ${activeSubmission.status === 'graded' ? 'bg-[#1F5A2E]/10 text-[#1F5A2E] border-[#1F5A2E]' : 'bg-[#C27D0E]/10 text-[#C27D0E] border-[#C27D0E]'}`}>
                  {activeSubmission.status === 'graded' ? 'GRADED' : 'PENDING'}
                </span>
              </div>

              {/* Cohort Similarity & Integrity Analysis */}
              {similarity && (
                <div className="mb-5 p-3.5 border-2 border-[#1A1209] bg-[#FAF6EE] dark:bg-[#26201B] shadow-[3px_3px_0px_#1A1209] text-xs font-mono">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-[#1A1209] dark:text-white uppercase text-[10px] flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#B84915]" /> COHORT SIMILARITY SCAN
                    </span>
                    <span
                      className={`stamp-badge py-0 text-[10px] font-bold ${
                        similarity.score > 35
                          ? 'bg-[#8B1A1A] text-white border-[#8B1A1A]'
                          : similarity.score > 15
                          ? 'bg-[#C27D0E] text-white border-[#C27D0E]'
                          : 'bg-[#1F5A2E] text-white border-[#1F5A2E]'
                      }`}
                    >
                      {similarity.score}% MATCH
                    </span>
                  </div>

                  <p className="text-[10px] text-[#5C4D3C] dark:text-[#B8A99A] mb-2 leading-relaxed">
                    {similarity.message}
                  </p>

                  {similarity.highest_match && (
                    <div className="bg-white dark:bg-[#1D1814] p-2.5 border border-[#1A1209] text-[10px] space-y-1">
                      <p className="font-bold text-[#1A1209] dark:text-white">
                        Overlap: {similarity.highest_match.matched_student_name} ({similarity.highest_match.matched_roll_number})
                      </p>
                      <p className="text-[9px] text-[#786958]">
                        Ref Code: {similarity.highest_match.matched_submission_code}
                      </p>
                      {similarity.matching_excerpts && similarity.matching_excerpts.length > 0 && (
                        <div className="mt-1 pt-1 border-t border-[#1A1209]/20">
                          <span className="text-[9px] font-bold text-[#786958] block">Matched N-Gram Excerpt:</span>
                          <p className="text-[9px] italic text-[#8B1A1A] truncate">
                            "{similarity.matching_excerpts[0]}"
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Rubric Inputs */}
              <div className="space-y-3.5 mb-5 font-mono">
                <div>
                  <div className="flex justify-between text-xs font-bold text-[#1A1209] dark:text-[#D4C7B5] mb-1">
                    <span>1. Knowledge & Conceptual Theory</span>
                    <span className="text-[#786958]">Max: 4.0</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="4"
                    step="0.5"
                    value={scoreK}
                    disabled={activeSubmission.status === 'graded'}
                    onChange={(e) => setScoreK(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-[#FFFAF1] dark:bg-[#26201B] border-2 border-[#1A1209] font-bold text-[#1A1209] dark:text-white focus:outline-none"
                  />
                </div>

                {!isAssignment && (
                  <div>
                    <div className="flex justify-between text-xs font-bold text-[#1A1209] dark:text-[#D4C7B5] mb-1">
                      <span>2. Practical Implementation & Execution</span>
                      <span className="text-[#786958]">Max: 5.0</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      max="5"
                      step="0.5"
                      value={scorePerf}
                      disabled={activeSubmission.status === 'graded'}
                      onChange={(e) => setScorePerf(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm bg-[#FFFAF1] dark:bg-[#26201B] border-2 border-[#1A1209] font-bold text-[#1A1209] dark:text-white focus:outline-none"
                    />
                  </div>
                )}

                <div>
                  <div className="flex justify-between text-xs font-bold text-[#1A1209] dark:text-[#D4C7B5] mb-1">
                    <span>{isAssignment ? '2. Content Structure & Neatness' : '3. Content & Observations'}</span>
                    <span className="text-[#786958]">Max: 3.0</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="3"
                    step="0.5"
                    value={scoreC}
                    disabled={activeSubmission.status === 'graded'}
                    onChange={(e) => setScoreC(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-[#FFFAF1] dark:bg-[#26201B] border-2 border-[#1A1209] font-bold text-[#1A1209] dark:text-white focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold text-[#1A1209] dark:text-[#D4C7B5] mb-1">
                    <span>{isAssignment ? '3. Academic Punctuality' : '4. Timeliness & Punctuality'}</span>
                    <span className="text-[#786958]">Max: 3.0</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="3"
                    step="0.5"
                    value={scoreP}
                    disabled={activeSubmission.status === 'graded'}
                    onChange={(e) => setScoreP(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-[#FFFAF1] dark:bg-[#26201B] border-2 border-[#1A1209] font-bold text-[#1A1209] dark:text-white focus:outline-none"
                  />
                </div>

                {/* Calculated Total Box */}
                <div className={`p-4 border-2 border-[#1A1209] shadow-[3px_3px_0px_#1A1209] flex items-center justify-between ${isScoreInvalid ? 'bg-[#FFF5F5] text-[#8B1A1A]' : 'bg-[#FAF6EE] dark:bg-[#26201B] text-[#1A1209] dark:text-white'}`}>
                  <div>
                    <span className="text-xs uppercase font-bold tracking-wider block font-mono">Total Awarded Score</span>
                    <span className="text-[10px] font-mono text-[#786958]">{isScoreInvalid ? `Exceeds max allowed (${maxAllowed})` : 'Calculated sum'}</span>
                  </div>
                  <div className="text-2xl font-black font-mono">
                    {currentTotal} <span className="text-sm font-bold opacity-60">/ {maxAllowed}</span>
                  </div>
                </div>

                {/* Qualitative Feedback */}
                <div>
                  <label className="text-xs font-bold font-mono uppercase tracking-wider text-[#1A1209] dark:text-[#D4C7B5] mb-1 block">
                    Faculty Remarks & Qualitative Feedback:
                  </label>
                  <textarea
                    rows={3}
                    value={feedback}
                    disabled={activeSubmission.status === 'graded'}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Enter detailed feedback on student write-up..."
                    className="w-full p-2.5 text-xs bg-[#FFFAF1] dark:bg-[#26201B] border-2 border-[#1A1209] text-[#1A1209] dark:text-white font-mono focus:outline-none"
                  />
                </div>
              </div>

              {/* Digital Signature Verification Reference */}
              {activeSubmission.digital_signature_code && (
                <div className="bg-[#FAF6EE] dark:bg-[#26201B] border-2 border-[#1F5A2E] p-3 mb-4 text-xs font-mono shadow-[2.5px_2.5px_0px_#1F5A2E]">
                  <div className="flex items-center gap-1.5 font-bold text-[#1F5A2E] mb-1 uppercase">
                    <ShieldCheck className="w-4 h-4 text-[#1F5A2E]" /> Digitally Signed & Approved
                  </div>
                  <p className="text-[#1A1209] dark:text-[#D4C7B5] text-[10px] break-all">
                    Code: {activeSubmission.digital_signature_code}
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Approval Button */}
            {activeSubmission.status !== 'graded' && (
              <button
                onClick={handleApprove}
                disabled={isScoreInvalid}
                className="neo-btn w-full py-3.5 px-4 bg-[#B84915] hover:bg-[#A03D0E] disabled:opacity-50 text-white text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4" /> DIGITALLY SIGN & APPROVE →
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Welcome Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-6 bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[4px_4px_0px_#1A1209]">
        <div>
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#B84915] block mb-1">
            FACULTY ASSESSMENT DESK // DEPARTMENT OF COMPUTER ENGINEERING
          </span>
          <h1 className="text-2xl font-black text-[#1A1209] dark:text-white tracking-tight">
            Classroom Evaluation Desk.
          </h1>
          <p className="text-xs text-[#5C4D3C] dark:text-[#B8A99A] font-mono mt-1">
            Access organized classroom folders, review submissions with split-screen viewer, and apply digital evaluation stamps.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#786958]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student, roll, or subject..."
              className="pl-9 pr-4 py-2 text-xs bg-[#FFFAF1] dark:bg-[#26201B] border-2 border-[#1A1209] font-mono w-64 text-[#1A1209] dark:text-white focus:outline-none"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-[#FFFAF1] dark:bg-[#26201B] border-2 border-[#1A1209] font-mono font-bold text-[#1A1209] dark:text-white focus:outline-none"
          >
            <option value="">All Submissions</option>
            <option value="submitted">Pending Evaluation</option>
            <option value="graded">Graded & Approved</option>
          </select>
        </div>
      </div>

      {/* Classroom Folder View */}
      {Object.keys(classroomFolders).length === 0 ? (
        <div className="bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] p-12 text-center shadow-[4px_4px_0px_#1A1209]">
          <Folder className="w-12 h-12 text-[#786958] mx-auto mb-3 opacity-50" />
          <h3 className="text-base font-bold tracking-tight text-[#1A1209] dark:text-white">No Student Submissions Found.</h3>
          <p className="text-xs font-mono text-[#786958] mt-1">
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
                className="bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[4px_4px_0px_#1A1209] overflow-hidden"
              >
                {/* Folder Header */}
                <div className="px-6 py-4 bg-[#F4EFE6] dark:bg-[#26201B] border-b-2 border-[#1A1209] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#1A365D] text-white border border-[#1A1209]">
                      <Folder className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-[#1A1209] dark:text-white font-mono">{className}</h3>
                      <p className="text-[10px] font-mono text-[#786958]">Classroom Folder</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {pendingCount > 0 && (
                      <span className="stamp-badge bg-[#C27D0E]/15 text-[#C27D0E] border-[#C27D0E]">
                        {pendingCount} REQUIRES EVALUATION
                      </span>
                    )}
                    <span className="stamp-badge bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-white">
                      {subs.length} TOTAL SUBMISSIONS
                    </span>
                  </div>
                </div>

                {/* Submissions Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#FAF6EE] dark:bg-[#26201B] text-[#1A1209] dark:text-[#D4C7B5] font-mono uppercase border-b-2 border-[#1A1209]">
                        <th className="py-3 px-6 font-bold">Student Name</th>
                        <th className="py-3 px-6 font-bold">Roll Number</th>
                        <th className="py-3 px-6 font-bold">Subject</th>
                        <th className="py-3 px-6 font-bold">Document Title</th>
                        <th className="py-3 px-6 font-bold">Status</th>
                        <th className="py-3 px-6 font-bold">Score</th>
                        <th className="py-3 px-6 font-bold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y border-b border-[#1A1209]/20 font-mono">
                      {subs.map((sub) => (
                        <tr
                          key={sub.submission_id}
                          className="hover:bg-[#FAF6EE] dark:hover:bg-[#26201B] transition-colors"
                        >
                          <td className="py-3.5 px-6 font-bold font-sans text-[#1A1209] dark:text-white">
                            {sub.student_name}
                          </td>
                          <td className="py-3.5 px-6 font-semibold text-[#5C4D3C] dark:text-[#B8A99A]">
                            {sub.roll_number}
                          </td>
                          <td className="py-3.5 px-6 text-[#5C4D3C] dark:text-[#B8A99A]">
                            {sub.subject_name}
                          </td>
                          <td className="py-3.5 px-6 font-medium text-[#1A1209] dark:text-white">
                            {sub.title}
                          </td>
                          <td className="py-3.5 px-6">
                            {sub.status === 'graded' ? (
                              <span className="stamp-badge bg-[#1F5A2E]/10 text-[#1F5A2E] border-[#1F5A2E]">
                                <CheckCircle2 className="w-3 h-3 mr-1 inline" /> GRADED
                              </span>
                            ) : (
                              <span className="stamp-badge bg-[#C27D0E]/10 text-[#C27D0E] border-[#C27D0E]">
                                <Clock className="w-3 h-3 mr-1 inline" /> PENDING
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-6 font-bold text-[#1A1209] dark:text-white">
                            {sub.marks_awarded !== undefined && sub.marks_awarded !== null ? (
                              <span className="text-[#1F5A2E] dark:text-[#48BB78] font-bold text-sm">
                                {sub.marks_awarded}
                              </span>
                            ) : (
                              <span className="text-[#786958]">-</span>
                            )}
                          </td>
                          <td className="py-3.5 px-6 text-right">
                            <button
                              onClick={() => openEvaluation(sub)}
                              className="neo-btn px-3.5 py-1.5 text-xs text-white bg-[#1A365D] hover:bg-[#12243F] inline-flex items-center gap-1.5"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              {sub.status === 'graded' ? 'VIEW' : 'EVALUATE'}
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
