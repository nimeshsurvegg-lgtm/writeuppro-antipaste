import React, { useState, useEffect } from 'react';
import {
  BookOpen, ChevronDown, ChevronRight, Award, CheckCircle2, Clock,
  AlertCircle, FileText, Beaker, FolderGit2, Star, RefreshCw
} from 'lucide-react';
import { api } from '../lib/api';

interface AssessmentItem {
  task_id: string;
  title: string;
  task_number: string;
  max_marks: number;
  due_date?: string;
  instructions?: string;
  faculty_name?: string;
  submission_status: string;
  evaluation_status: string;
  marks_obtained: number | null;
  is_evaluated: boolean;
  feedback?: string;
  submission_date?: string;
  is_late: boolean;
  delay_text?: string;
  external_link_url?: string;
}

interface SubjectPerformanceData {
  subject_id: string;
  subject_name: string;
  subject_code: string;
  credits: number;
  category: string;
  subject_type: string;
  enrollment_type: string;
  assignments: AssessmentItem[];
  assignment_total_obtained: number;
  assignment_total_max: number;
  assignment_evaluated_count: number;
  assignment_total_count: number;
  assignment_average_marks: number | null;
  assignment_average_max: number | null;
  assignment_average_display: string;
  experiments: AssessmentItem[];
  experiment_total_obtained: number;
  experiment_total_max: number;
  experiment_evaluated_count: number;
  experiment_total_count: number;
  experiment_average_marks: number | null;
  experiment_average_max: number | null;
  experiment_average_display: string;
  special_documents: AssessmentItem[];
  special_documents_count: number;
  has_assessments: boolean;
  pending_evaluations_count: number;
}

export const SubjectPerformanceView: React.FC = () => {
  const [data, setData] = useState<SubjectPerformanceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});

  const fetchPerformance = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.academic.getStudentAcademicPerformance();
      setData(res || []);
      // Auto-expand all subjects by default for convenience
      const initialExpanded: Record<string, boolean> = {};
      (res || []).forEach((s: SubjectPerformanceData) => {
        initialExpanded[s.subject_id] = true;
      });
      setExpandedSubjects(initialExpanded);
    } catch (err: any) {
      console.error('Failed to load performance data:', err);
      setError('Unable to load subject-wise performance records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformance();
  }, []);

  const toggleExpand = (subjectId: string) => {
    setExpandedSubjects((prev) => ({
      ...prev,
      [subjectId]: !prev[subjectId],
    }));
  };

  const getStatusBadge = (status: string, isEvaluated: boolean) => {
    if (isEvaluated) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="w-3 h-3" /> Evaluated
        </span>
      );
    }
    if (status === 'submitted') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
          <Clock className="w-3 h-3" /> Pending Evaluation
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
        Not Submitted
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
        <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Loading subject-wise academic performance...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
        <button
          onClick={fetchPerformance}
          className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="p-12 text-center bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
        <BookOpen className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-neutral-800 dark:text-neutral-200">No Allotted Subjects Found</h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md mx-auto mt-1">
          Your academic enrollment is being verified by administration. Allotted subjects will appear here once finalized.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <Award className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Subject-wise Academic Performance
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
            Verified marks representation for all currently allotted academic subjects.
          </p>
        </div>
        <button
          onClick={fetchPerformance}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Records
        </button>
      </div>

      {/* Subject Cards List */}
      <div className="space-y-4">
        {data.map((sub) => {
          const isExpanded = !!expandedSubjects[sub.subject_id];

          return (
            <div
              key={sub.subject_id}
              className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden transition-all duration-200"
            >
              {/* Subject Card Header */}
              <button
                type="button"
                onClick={() => toggleExpand(sub.subject_id)}
                className="w-full px-5 py-4 flex items-center justify-between bg-neutral-50/70 dark:bg-neutral-800/40 hover:bg-neutral-100/70 dark:hover:bg-neutral-800/70 text-left transition border-b border-neutral-200 dark:border-neutral-800"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-bold text-neutral-900 dark:text-white uppercase tracking-wide">
                        {sub.subject_name}
                      </span>
                      <span className="px-2 py-0.5 text-xs font-semibold rounded bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300">
                        {sub.subject_code}
                      </span>
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                        {sub.credits} Credits
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                      <span>Category: {sub.category}</span>
                      <span>•</span>
                      <span>Type: {sub.subject_type}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Summary marks pill */}
                  <div className="hidden sm:flex items-center gap-3 text-xs">
                    <div className="text-right">
                      <span className="text-neutral-500 dark:text-neutral-400 block text-[10px] uppercase font-bold">Assignment Avg</span>
                      <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                        {sub.assignment_average_display}
                      </span>
                    </div>
                    <div className="text-right pl-3 border-l border-neutral-200 dark:border-neutral-700">
                      <span className="text-neutral-500 dark:text-neutral-400 block text-[10px] uppercase font-bold">Experiment Avg</span>
                      <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                        {sub.experiment_average_display}
                      </span>
                    </div>
                  </div>

                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-neutral-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-neutral-400" />
                  )}
                </div>
              </button>

              {/* Subject Card Body (Sections A, B, C) */}
              {isExpanded && (
                <div className="p-5 space-y-6">
                  {/* -------------------------------------------------------- */}
                  {/* SECTION A: ASSIGNMENT PERFORMANCE */}
                  {/* -------------------------------------------------------- */}
                  <div className="bg-neutral-50/50 dark:bg-neutral-900/40 rounded-xl p-4 border border-neutral-200/80 dark:border-neutral-800">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-3 border-b border-neutral-200 dark:border-neutral-800 gap-2">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <h4 className="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
                          Assignment Performance
                        </h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-neutral-500 dark:text-neutral-400">
                          Assignment Average:
                        </span>
                        <span className="text-sm font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800">
                          {sub.assignment_average_display}
                        </span>
                      </div>
                    </div>

                    {sub.assignments.length === 0 ? (
                      <div className="text-center py-6 text-xs text-neutral-500 dark:text-neutral-400 bg-white dark:bg-neutral-800/40 rounded-lg border border-neutral-200/60 dark:border-neutral-700/60">
                        <p className="font-medium">No assignments created yet.</p>
                        <p className="text-[11px] text-neutral-400 mt-0.5">Faculty will publish assignments for this subject here.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400">
                              <th className="py-2.5 px-3 font-semibold">Assessment</th>
                              <th className="py-2.5 px-3 font-semibold">Status</th>
                              <th className="py-2.5 px-3 font-semibold text-right">Marks Obtained</th>
                              <th className="py-2.5 px-3 font-semibold text-right">Maximum Marks</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                            {sub.assignments.map((item, idx) => (
                              <tr key={item.task_id} className="hover:bg-neutral-100/40 dark:hover:bg-neutral-800/40 transition">
                                <td className="py-2.5 px-3 font-medium text-neutral-900 dark:text-white">
                                  {item.title}
                                </td>
                                <td className="py-2.5 px-3">
                                  {getStatusBadge(item.submission_status, item.is_evaluated)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-neutral-900 dark:text-white">
                                  {item.is_evaluated && item.marks_obtained !== null ? item.marks_obtained : '—'}
                                </td>
                                <td className="py-2.5 px-3 text-right text-neutral-500 dark:text-neutral-400">
                                  {item.max_marks}
                                </td>
                              </tr>
                            ))}
                            {/* Total Row */}
                            <tr className="bg-neutral-100/70 dark:bg-neutral-800/60 font-bold border-t-2 border-neutral-300 dark:border-neutral-700">
                              <td className="py-2.5 px-3 text-neutral-900 dark:text-white" colSpan={2}>
                                Total (Evaluated Assessments)
                              </td>
                              <td className="py-2.5 px-3 text-right text-indigo-700 dark:text-indigo-400">
                                {sub.assignment_evaluated_count > 0 ? sub.assignment_total_obtained : '—'}
                              </td>
                              <td className="py-2.5 px-3 text-right text-neutral-700 dark:text-neutral-300">
                                {sub.assignment_evaluated_count > 0 ? sub.assignment_total_max : '—'}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* -------------------------------------------------------- */}
                  {/* SECTION B: EXPERIMENT PERFORMANCE */}
                  {/* -------------------------------------------------------- */}
                  <div className="bg-neutral-50/50 dark:bg-neutral-900/40 rounded-xl p-4 border border-neutral-200/80 dark:border-neutral-800">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-3 border-b border-neutral-200 dark:border-neutral-800 gap-2">
                      <div className="flex items-center gap-2">
                        <Beaker className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <h4 className="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
                          Experiment Performance
                        </h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-neutral-500 dark:text-neutral-400">
                          Experiment Average:
                        </span>
                        <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                          {sub.experiment_average_display}
                        </span>
                      </div>
                    </div>

                    {sub.experiments.length === 0 ? (
                      <div className="text-center py-6 text-xs text-neutral-500 dark:text-neutral-400 bg-white dark:bg-neutral-800/40 rounded-lg border border-neutral-200/60 dark:border-neutral-700/60">
                        <p className="font-medium">No experiments created yet.</p>
                        <p className="text-[11px] text-neutral-400 mt-0.5">Laboratory experiments will be populated by your assigned batch faculty.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400">
                              <th className="py-2.5 px-3 font-semibold">Assessment</th>
                              <th className="py-2.5 px-3 font-semibold">Status</th>
                              <th className="py-2.5 px-3 font-semibold text-right">Marks Obtained</th>
                              <th className="py-2.5 px-3 font-semibold text-right">Maximum Marks</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                            {sub.experiments.map((item) => (
                              <tr key={item.task_id} className="hover:bg-neutral-100/40 dark:hover:bg-neutral-800/40 transition">
                                <td className="py-2.5 px-3 font-medium text-neutral-900 dark:text-white">
                                  {item.title}
                                </td>
                                <td className="py-2.5 px-3">
                                  {getStatusBadge(item.submission_status, item.is_evaluated)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-neutral-900 dark:text-white">
                                  {item.is_evaluated && item.marks_obtained !== null ? item.marks_obtained : '—'}
                                </td>
                                <td className="py-2.5 px-3 text-right text-neutral-500 dark:text-neutral-400">
                                  {item.max_marks}
                                </td>
                              </tr>
                            ))}
                            {/* Total Row */}
                            <tr className="bg-neutral-100/70 dark:bg-neutral-800/60 font-bold border-t-2 border-neutral-300 dark:border-neutral-700">
                              <td className="py-2.5 px-3 text-neutral-900 dark:text-white" colSpan={2}>
                                Total (Evaluated Experiments)
                              </td>
                              <td className="py-2.5 px-3 text-right text-emerald-700 dark:text-emerald-400">
                                {sub.experiment_evaluated_count > 0 ? sub.experiment_total_obtained : '—'}
                              </td>
                              <td className="py-2.5 px-3 text-right text-neutral-700 dark:text-neutral-300">
                                {sub.experiment_evaluated_count > 0 ? sub.experiment_total_max : '—'}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* -------------------------------------------------------- */}
                  {/* SECTION C: SPECIAL DOCUMENT SUBMISSIONS (SEPARATELY BELOW) */}
                  {/* -------------------------------------------------------- */}
                  <div className="bg-neutral-50/50 dark:bg-neutral-900/40 rounded-xl p-4 border border-neutral-200/80 dark:border-neutral-800">
                    <div className="flex items-center gap-2 pb-3 mb-3 border-b border-neutral-200 dark:border-neutral-800">
                      <FolderGit2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <h4 className="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
                        Special Document Submissions
                      </h4>
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400 italic">
                        (Evaluated separately, excluded from assignment & experiment averages)
                      </span>
                    </div>

                    {sub.special_documents.length === 0 ? (
                      <div className="text-center py-6 text-xs text-neutral-500 dark:text-neutral-400 bg-white dark:bg-neutral-800/40 rounded-lg border border-neutral-200/60 dark:border-neutral-700/60">
                        <p className="font-medium">No special submissions assigned yet.</p>
                        <p className="text-[11px] text-neutral-400 mt-0.5">Mini-projects, research papers, and technical reports will appear here.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400">
                              <th className="py-2.5 px-3 font-semibold">Special Document Title</th>
                              <th className="py-2.5 px-3 font-semibold">Status</th>
                              <th className="py-2.5 px-3 font-semibold text-right">Marks Obtained / Max</th>
                              <th className="py-2.5 px-3 font-semibold">Faculty Feedback</th>
                              <th className="py-2.5 px-3 font-semibold text-right">Deadline</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                            {sub.special_documents.map((item) => (
                              <tr key={item.task_id} className="hover:bg-neutral-100/40 dark:hover:bg-neutral-800/40 transition">
                                <td className="py-2.5 px-3 font-medium text-neutral-900 dark:text-white">
                                  {item.title}
                                </td>
                                <td className="py-2.5 px-3">
                                  {getStatusBadge(item.submission_status, item.is_evaluated)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-neutral-900 dark:text-white">
                                  {item.is_evaluated && item.marks_obtained !== null
                                    ? `${item.marks_obtained} / ${item.max_marks}`
                                    : `— / ${item.max_marks}`}
                                </td>
                                <td className="py-2.5 px-3 text-neutral-600 dark:text-neutral-300 italic">
                                  {item.feedback || 'No feedback yet'}
                                </td>
                                <td className="py-2.5 px-3 text-right text-neutral-500 dark:text-neutral-400">
                                  {item.due_date ? new Date(item.due_date).toLocaleDateString() : 'N/A'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
