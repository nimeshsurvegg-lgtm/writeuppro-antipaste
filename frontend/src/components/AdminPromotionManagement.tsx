import React, { useState, useEffect } from 'react';
import {
  Sparkles, Plus, ToggleLeft, ToggleRight, CheckCircle2, XCircle,
  Clock, Download, Filter, Search, UserCheck, AlertCircle, RefreshCw
} from 'lucide-react';
import { api } from '../lib/api';

export const AdminPromotionManagement: React.FC = () => {
  const [windows, setWindows] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Review modal state
  const [reviewReq, setReviewReq] = useState<any | null>(null);
  const [reviewStatus, setReviewStatus] = useState<'approved' | 'rejected'>('approved');
  const [approvedDiv, setApprovedDiv] = useState('');
  const [approvedRoll, setApprovedRoll] = useState('');
  const [adminRemarks, setAdminRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // New Window Form
  const [title, setTitle] = useState('');
  const [sourceAY, setSourceAY] = useState('2025-26');
  const [targetAY, setTargetAY] = useState('2026-27');
  const [sourceYear, setSourceYear] = useState('SE');
  const [targetYear, setTargetYear] = useState('TE');
  const [sourceSem, setSourceSem] = useState(4);
  const [targetSem, setTargetSem] = useState(5);
  const [branchCode, setBranchCode] = useState('CE');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [wins, reqs] = await Promise.all([
        api.academic.listPromotionWindows(),
        api.academic.listPromotionRequests(),
      ]);
      setWindows(wins || []);
      setRequests(reqs || []);
    } catch (err: any) {
      console.error('Failed to load promotion data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggle = async (winId: string) => {
    try {
      await api.academic.togglePromotionWindow(winId);
      loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to toggle promotion window.');
    }
  };

  const handleManualClose = async (winId: string) => {
    try {
      await api.academic.updatePromotionStatus(winId, 'closed');
      loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to close window.');
    }
  };

  const handleManualReopen = async (winId: string) => {
    try {
      await api.academic.updatePromotionStatus(winId, 'open');
      loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to reopen window.');
    }
  };

  const handleExportCsv = async (winId: string) => {
    try {
      await api.academic.exportPromotionCsv(winId);
    } catch (err: any) {
      alert('Failed to export promotion records.');
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      await api.academic.createPromotionWindow({
        title,
        source_academic_year: sourceAY,
        target_academic_year: targetAY,
        source_year_level: sourceYear,
        target_year_level: targetYear,
        source_semester: Number(sourceSem),
        target_semester: Number(targetSem),
        branch_code: branchCode,
        start_date: startDate ? new Date(startDate).toISOString() : undefined,
        end_date: endDate ? new Date(endDate).toISOString() : undefined,
        is_open: true,
        status: 'open',
      });
      setShowCreateModal(false);
      loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to create promotion window.');
    } finally {
      setActionLoading(false);
    }
  };

  const openReviewModal = (req: any, status: 'approved' | 'rejected') => {
    setReviewReq(req);
    setReviewStatus(status);
    setApprovedDiv(req.requested_division || 'Div A');
    setApprovedRoll(req.requested_roll_number || req.current_roll_number);
    setAdminRemarks(status === 'approved' ? 'Eligible and verified for promotion.' : 'Prerequisites not met.');
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewReq) return;
    try {
      setActionLoading(true);
      await api.academic.reviewPromotionRequest(
        reviewReq.id,
        reviewStatus,
        reviewStatus === 'approved' ? approvedDiv : undefined,
        reviewStatus === 'approved' ? approvedRoll : undefined,
        adminRemarks
      );
      setReviewReq(null);
      loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to review promotion request.');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredRequests = requests.filter((r) => {
    if (statusFilter === 'ALL') return true;
    return r.status === statusFilter;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Student Promotion & Upgrade Management
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
            Configure promotion windows, manually control window states, review student requests, and approve upgrades.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition"
          >
            <Plus className="w-4 h-4" /> Open New Promotion Window
          </button>
          <button
            onClick={loadData}
            className="p-2 text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Configured Promotion Windows Card List */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
          Configured Promotion Windows
        </h3>

        {windows.length === 0 ? (
          <div className="p-6 text-center text-xs text-neutral-500 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
            No promotion windows configured. Click "Open New Promotion Window" to create one.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {windows.map((w) => {
              const isOpen = w.effective_status === 'open' && w.is_open;

              return (
                <div
                  key={w.id}
                  className={`p-5 rounded-xl border transition bg-white dark:bg-neutral-900 ${
                    isOpen ? 'border-emerald-300 dark:border-emerald-800 shadow-sm' : 'border-neutral-200 dark:border-neutral-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isOpen
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400'
                          }`}
                        >
                          {w.effective_status || (w.is_open ? 'Open' : 'Closed')}
                        </span>
                        <span className="text-xs font-semibold text-neutral-500">Branch: {w.branch_code}</span>
                      </div>
                      <h4 className="text-base font-bold text-neutral-900 dark:text-white mt-1.5">{w.title}</h4>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                        {w.source_year_level} (AY {w.source_academic_year}) → {w.target_year_level} Sem {w.target_semester} (AY {w.target_academic_year})
                      </p>
                    </div>

                    {/* Window Controls */}
                    <div className="flex flex-col items-end gap-1.5">
                      {isOpen ? (
                        <button
                          onClick={() => handleManualClose(w.id)}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400 hover:bg-red-100 border border-red-200 dark:border-red-800 transition"
                        >
                          Close Window
                        </button>
                      ) : (
                        <button
                          onClick={() => handleManualReopen(w.id)}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 transition"
                        >
                          Reopen Window
                        </button>
                      )}

                      <button
                        onClick={() => handleExportCsv(w.id)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-600 dark:text-neutral-400 hover:text-indigo-600 transition"
                      >
                        <Download className="w-3 h-3" /> Export CSV
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Applications Review Section */}
      <div className="space-y-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
              Student Promotion Applications ({filteredRequests.length})
            </h3>
          </div>

          <div className="flex items-center gap-1 text-xs">
            {['ALL', 'pending', 'approved', 'rejected'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg capitalize font-medium transition ${
                  statusFilter === st
                    ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {filteredRequests.length === 0 ? (
          <div className="p-8 text-center text-xs text-neutral-500 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
            No promotion applications matching the current filter.
          </div>
        ) : (
          <div className="overflow-x-auto bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-700 text-neutral-400 font-semibold uppercase">
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Current Standing</th>
                  <th className="py-3 px-4">CGPA</th>
                  <th className="py-3 px-4">Requested Div / Roll</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-neutral-900 dark:text-white">{req.student_name}</div>
                      <div className="text-[11px] text-neutral-400">PRN: {req.prn}</div>
                    </td>
                    <td className="py-3 px-4 text-neutral-700 dark:text-neutral-300">
                      {req.branch_code} {req.current_year_level} ({req.current_division}, Roll: {req.current_roll_number})
                    </td>
                    <td className="py-3 px-4 font-bold text-indigo-600 dark:text-indigo-400">
                      {req.cgpa}
                    </td>
                    <td className="py-3 px-4 text-neutral-700 dark:text-neutral-300">
                      {req.requested_division} / {req.requested_roll_number}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize ${
                          req.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                            : req.status === 'rejected'
                            ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1">
                      {req.status === 'pending' ? (
                        <>
                          <button
                            onClick={() => openReviewModal(req, 'approved')}
                            className="px-2.5 py-1 text-xs font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-700 transition"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => openReviewModal(req, 'rejected')}
                            className="px-2.5 py-1 text-xs font-semibold rounded bg-red-600 text-white hover:bg-red-700 transition"
                          >
                            Reject
                          </button>
                        </>
                      ) : (
                        <span className="text-[11px] text-neutral-400">Reviewed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Promotion Window Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 max-w-lg w-full space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-neutral-900 dark:text-white">Configure New Promotion Window</h3>
            <form onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Window Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                  placeholder="e.g. SE to TE Academic Promotion (2026-27)"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Source Academic Year</label>
                  <input
                    type="text"
                    required
                    value={sourceAY}
                    onChange={(e) => setSourceAY(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Destination Academic Year</label>
                  <input
                    type="text"
                    required
                    value={targetAY}
                    onChange={(e) => setTargetAY(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Branch Code</label>
                  <input
                    type="text"
                    required
                    value={branchCode}
                    onChange={(e) => setBranchCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">From Year Level</label>
                  <input
                    type="text"
                    required
                    value={sourceYear}
                    onChange={(e) => setSourceYear(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">To Year Level</label>
                  <input
                    type="text"
                    required
                    value={targetYear}
                    onChange={(e) => setTargetYear(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition"
                >
                  {actionLoading ? 'Creating...' : 'Create & Open Window'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-neutral-900 dark:text-white capitalize">
              {reviewStatus} Promotion Application
            </h3>
            <p className="text-xs text-neutral-500">
              Student: <strong>{reviewReq.student_name}</strong> (PRN: {reviewReq.prn}, CGPA: {reviewReq.cgpa})
            </p>

            <form onSubmit={handleReviewSubmit} className="space-y-3 text-xs">
              {reviewStatus === 'approved' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">Assigned Division *</label>
                    <input
                      type="text"
                      required
                      value={approvedDiv}
                      onChange={(e) => setApprovedDiv(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Assigned Roll No *</label>
                    <input
                      type="text"
                      required
                      value={approvedRoll}
                      onChange={(e) => setApprovedRoll(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold mb-1">Administrative Remarks</label>
                <textarea
                  rows={2}
                  value={adminRemarks}
                  onChange={(e) => setAdminRemarks(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                  placeholder="Official remark logged in promotion history..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setReviewReq(null)}
                  className="px-4 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className={`px-4 py-2 rounded-lg text-white font-semibold transition ${
                    reviewStatus === 'approved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {actionLoading ? 'Processing...' : `Confirm ${reviewStatus}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
