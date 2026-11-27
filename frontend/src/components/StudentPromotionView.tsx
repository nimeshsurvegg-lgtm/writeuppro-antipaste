import React, { useState, useEffect } from 'react';
import {
  Sparkles, CheckCircle2, Clock, AlertTriangle, Send, XCircle,
  HelpCircle, ArrowRight, ShieldAlert, RefreshCw
} from 'lucide-react';
import { api } from '../lib/api';

export const StudentPromotionView: React.FC = () => {
  const [eligibility, setEligibility] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [cgpa, setCgpa] = useState<string>('');
  const [requestedDivision, setRequestedDivision] = useState<string>('Div A');
  const [requestedRoll, setRequestedRoll] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const fetchEligibility = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.academic.getStudentPromotionEligibility();
      setEligibility(res);
      if (res?.current_profile?.cgpa) {
        setCgpa(String(res.current_profile.cgpa));
      }
      if (res?.current_profile?.roll_number) {
        setRequestedRoll(res.current_profile.roll_number);
      }
    } catch (err: any) {
      console.error('Failed to check promotion eligibility:', err);
      setError('Unable to load promotion window status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEligibility();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eligibility?.window?.id) return;

    try {
      setSubmitting(true);
      setError(null);
      setSuccessMsg(null);
      await api.academic.submitPromotionRequest({
        promotion_window_id: eligibility.window.id,
        cgpa: parseFloat(cgpa) || 8.5,
        requested_division: requestedDivision,
        requested_roll_number: requestedRoll.trim(),
      });
      setSuccessMsg('Academic upgrade application submitted successfully for administrator review!');
      fetchEligibility();
    } catch (err: any) {
      console.error('Promotion submission error:', err);
      setError(err?.message || 'Failed to submit promotion application.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
        <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Checking academic promotion window...</p>
      </div>
    );
  }

  const window = eligibility?.window;
  const existingReq = eligibility?.existing_request;
  const profile = eligibility?.current_profile;
  const isWindowActive = window?.is_active_open;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Academic Promotion & Upgrade Portal
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
            Submit your application for transition to the upcoming academic year and semester.
          </p>
        </div>
        <button
          onClick={fetchEligibility}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Status
        </button>
      </div>

      {/* Existing Application Banner */}
      {existingReq && (
        <div
          className={`p-5 rounded-xl border transition ${
            existingReq.status === 'approved'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : existingReq.status === 'rejected'
              ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-800 dark:text-red-300'
              : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300'
          }`}
        >
          <div className="flex items-start gap-3">
            {existingReq.status === 'approved' ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
            ) : existingReq.status === 'rejected' ? (
              <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            ) : (
              <Clock className="w-5 h-5 flex-shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <h4 className="text-sm font-bold capitalize">
                Application Status: {existingReq.status}
              </h4>
              <p className="text-xs leading-relaxed">
                {existingReq.status === 'approved' &&
                  `Congratulations! Your promotion to ${existingReq.target_year_level || 'the next year'} for Academic Year ${existingReq.target_academic_year || '2026-27'} was approved by administration.`}
                {existingReq.status === 'rejected' &&
                  `Your promotion application was reviewed: Rejected. Remarks: ${existingReq.admin_remarks || 'Please contact academic administration.'}`}
                {existingReq.status === 'pending' &&
                  `Your academic promotion application is submitted and pending administrative review (Applied on ${new Date(existingReq.submitted_at).toLocaleDateString()}).`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Window Info Card */}
      {!window ? (
        <div className="p-8 text-center bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
          <Clock className="w-10 h-10 text-neutral-400 mx-auto mb-2" />
          <h3 className="text-base font-semibold text-neutral-800 dark:text-neutral-200">No Promotion Window Configured</h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md mx-auto mt-1">
            There is currently no academic promotion window scheduled for your department ({profile?.branch_code}) and standing ({profile?.year_level}).
          </p>
        </div>
      ) : !isWindowActive ? (
        <div className="p-6 bg-neutral-50 dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-3">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-neutral-500 dark:text-neutral-400" />
            <div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">{window.title}</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Target: {window.source_year_level} → {window.target_year_level} (Academic Year {window.target_academic_year})
              </p>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-xs font-medium text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
            {window.status_message || 'The promotion window is currently closed. New applications cannot be submitted.'}
          </div>
        </div>
      ) : existingReq && existingReq.status in { pending: 1, approved: 1 } ? null : (
        /* Active Application Form */
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6 space-y-6">
          <div className="border-b border-neutral-200 dark:border-neutral-800 pb-4">
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">Window Open</span>
            <h3 className="text-base font-bold text-neutral-900 dark:text-white mt-0.5">{window.title}</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Promoting eligible students from <strong>{window.source_year_level}</strong> (AY {window.source_academic_year}) to{' '}
              <strong>{window.target_year_level} Semester {window.target_semester}</strong> (AY {window.target_academic_year}).
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 text-xs rounded-lg border border-red-200 dark:border-red-900">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-xs rounded-lg border border-emerald-200 dark:border-emerald-900">
              {successMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Cumulative Grade Point Average (CGPA) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.0"
                  max="10.0"
                  required
                  value={cgpa}
                  onChange={(e) => setCgpa(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. 8.92"
                />
                <span className="text-[10px] text-neutral-400 mt-0.5 block">As recorded in your official grade sheet.</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Requested Division Preference
                </label>
                <select
                  value={requestedDivision}
                  onChange={(e) => setRequestedDivision(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Div A">Division A</option>
                  <option value="Div B">Division B</option>
                  <option value="Div C">Division C</option>
                </select>
                <span className="text-[10px] text-neutral-400 mt-0.5 block">Final division allotment is subject to institutional batch sizing.</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Current / Proposed Roll Number
                </label>
                <input
                  type="text"
                  required
                  value={requestedRoll}
                  onChange={(e) => setRequestedRoll(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. 21CE104"
                />
                <span className="text-[10px] text-neutral-400 mt-0.5 block">Administrator validates and assigns official roll numbers upon approval.</span>
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition disabled:opacity-50"
              >
                {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                {submitting ? 'Submitting Application...' : 'Submit Academic Upgrade Application'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
