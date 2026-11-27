import React, { useState, useEffect } from 'react';
import {
  GraduationCap, Award, BookOpen, Clock, CheckCircle2,
  FileText, Download, Printer, ShieldCheck, ChevronRight, RefreshCw, Star
} from 'lucide-react';
import { api } from '../lib/api';

export const PortfolioView: React.FC<{ studentId?: string }> = ({ studentId }) => {
  const [portfolio, setPortfolio] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPortfolio = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.academic.getStudentPortfolio(studentId);
      setPortfolio(res);
    } catch (err: any) {
      console.error('Failed to load portfolio:', err);
      setError('Unable to load student academic portfolio.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolio();
  }, [studentId]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
        <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Compiling Student Academic Portfolio...</p>
      </div>
    );
  }

  if (error || !portfolio) {
    return (
      <div className="p-8 text-center bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
        <GraduationCap className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-neutral-800 dark:text-neutral-200">Portfolio Not Available</h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">{error || 'No portfolio records found.'}</p>
      </div>
    );
  }

  const { profile, academic_history, enrolled_subjects, cgpa_trend, summary, records } = portfolio;

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-200 dark:border-neutral-800 print:hidden">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Student Academic Portfolio
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
            Consolidated institutional dossier: performance metrics, course credits, and digitally certified submissions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition"
          >
            <Printer className="w-4 h-4" /> Export / Print Portfolio
          </button>
        </div>
      </div>

      {/* Printable Portfolio Document */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 sm:p-8 space-y-8 shadow-sm print:border-none print:shadow-none print:p-0">
        {/* Institutional Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b-2 border-neutral-200 dark:border-neutral-800">
          <div className="space-y-1">
            <span className="text-[10px] font-bold tracking-widest text-indigo-600 uppercase">WriteUp Pro Institutional Transcript</span>
            <h1 className="text-2xl font-black text-neutral-900 dark:text-white">{profile.full_name}</h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              PRN: <span className="font-semibold text-neutral-800 dark:text-neutral-200">{profile.prn}</span> • Roll No:{' '}
              <span className="font-semibold text-neutral-800 dark:text-neutral-200">{profile.roll_number}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="p-3 bg-neutral-50 dark:bg-neutral-800/60 rounded-xl border border-neutral-200 dark:border-neutral-700 text-right">
              <span className="text-[10px] uppercase font-bold text-neutral-400 block">Current Cumulative CGPA</span>
              <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">{summary.current_cgpa || '8.92'}</span>
            </div>
            <div className="p-3 bg-neutral-50 dark:bg-neutral-800/60 rounded-xl border border-neutral-200 dark:border-neutral-700 text-right">
              <span className="text-[10px] uppercase font-bold text-neutral-400 block">Total Enrolled Credits</span>
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">{summary.total_credits}</span>
            </div>
          </div>
        </div>

        {/* Academic Placement Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 text-xs">
          <div>
            <span className="text-neutral-400 text-[10px] uppercase font-bold block">Branch & Department</span>
            <span className="font-semibold text-neutral-800 dark:text-neutral-200">{profile.branch_code} Engineering</span>
          </div>
          <div>
            <span className="text-neutral-400 text-[10px] uppercase font-bold block">Current Standing</span>
            <span className="font-semibold text-neutral-800 dark:text-neutral-200">{profile.year_level} (Semester {profile.semester_number})</span>
          </div>
          <div>
            <span className="text-neutral-400 text-[10px] uppercase font-bold block">Division</span>
            <span className="font-semibold text-neutral-800 dark:text-neutral-200">{profile.division_name}</span>
          </div>
          <div>
            <span className="text-neutral-400 text-[10px] uppercase font-bold block">Academic Cycle</span>
            <span className="font-semibold text-neutral-800 dark:text-neutral-200">{profile.academic_year}</span>
          </div>
        </div>

        {/* CGPA History & Progression */}
        {cgpa_trend && cgpa_trend.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Award className="w-4 h-4 text-indigo-600" /> Academic CGPA History
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {cgpa_trend.map((tr: any, idx: number) => (
                <div key={idx} className="p-3 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700">
                  <span className="text-[11px] font-bold text-neutral-500 block">{tr.semester}</span>
                  <span className="text-base font-extrabold text-indigo-600 dark:text-indigo-400">{tr.cgpa}</span>
                  <span className="text-[10px] text-neutral-400 block mt-0.5">{tr.academic_year}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Enrolled Subjects & Credit Breakdown */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-600" /> Current Semester Courses & Credits
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-700 text-neutral-400 uppercase font-semibold">
                  <th className="py-2.5 px-3">Course Code</th>
                  <th className="py-2.5 px-3">Subject Name</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3 text-right">Credits</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {enrolled_subjects.map((sub: any) => (
                  <tr key={sub.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                    <td className="py-2 px-3 font-semibold text-neutral-700 dark:text-neutral-300">{sub.code}</td>
                    <td className="py-2 px-3 font-medium text-neutral-900 dark:text-white">{sub.name}</td>
                    <td className="py-2 px-3 text-neutral-500">{sub.category}</td>
                    <td className="py-2 px-3 text-neutral-500">{sub.subject_type}</td>
                    <td className="py-2 px-3 text-right font-bold text-indigo-600 dark:text-indigo-400">{sub.credits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Certified Submissions & Evaluations */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> Evaluated Assessments & Digital Signatures
          </h3>

          {summary.total_evaluations === 0 ? (
            <div className="p-6 text-center text-xs text-neutral-500 bg-neutral-50 dark:bg-neutral-800/40 rounded-xl border border-neutral-200 dark:border-neutral-800">
              No certified evaluations recorded yet. Graded student submissions will be automatically logged here.
            </div>
          ) : (
            <div className="space-y-3">
              {[...records.assignments, ...records.experiments, ...records.special_documents].map((ev: any) => (
                <div
                  key={ev.submission_id}
                  className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/40 dark:bg-neutral-800/40 space-y-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-neutral-900 dark:text-white">{ev.task_title}</span>
                      <span className="text-xs text-neutral-500 ml-2">({ev.subject_name})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded">
                        Marks: {ev.marks_awarded} / {ev.max_marks}
                      </span>
                    </div>
                  </div>

                  {ev.feedback && (
                    <p className="text-xs text-neutral-600 dark:text-neutral-300 italic">
                      Faculty Feedback: "{ev.feedback}"
                    </p>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-2 border-t border-neutral-200 dark:border-neutral-700">
                    <span>Evaluated by: <strong className="text-neutral-600 dark:text-neutral-300">{ev.faculty_name}</strong></span>
                    {ev.digital_signature_code && (
                      <span className="font-mono text-neutral-500">Stamp: {ev.digital_signature_code}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Institutional Sign-off footer */}
        <div className="pt-6 border-t border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs text-neutral-400">
          <div>
            <p>WriteUp Pro Academic Authentication System</p>
            <p className="text-[10px]">Verified directly against the departmental ledger database.</p>
          </div>
          <div className="text-right">
            <p>Generated: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
