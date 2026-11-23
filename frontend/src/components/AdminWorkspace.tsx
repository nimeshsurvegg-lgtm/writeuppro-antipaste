import React, { useState, useEffect } from 'react';
import {
  Users, ShieldAlert, GraduationCap, FileCheck, Download, Check, X,
  AlertTriangle, Filter, Search, RotateCcw, Ban, CheckCircle, RefreshCw
} from 'lucide-react';
import { api } from '../lib/api';
import { StudentProfile, IntegrityEvent, User } from '../types';

interface AdminWorkspaceProps {
  currentUser: User;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const AdminWorkspace: React.FC<AdminWorkspaceProps> = ({ currentUser, showToast }) => {
  const [activeTab, setActiveTab] = useState<'registrations' | 'integrity' | 'ledger'>('registrations');
  const [analytics, setAnalytics] = useState<any>(null);
  const [profiles, setProfiles] = useState<StudentProfile[]>([]);
  const [integrityEvents, setIntegrityEvents] = useState<IntegrityEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadAllData();
  }, [activeTab]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [stats, profs, events] = await Promise.all([
        api.analytics.getAdminAnalytics(),
        api.academic.listStudentProfiles(),
        api.integrity.listEvents(),
      ]);
      setAnalytics(stats);
      setProfiles(profs);
      setIntegrityEvents(events);
    } catch (err: any) {
      showToast(err.message || 'Failed to load administrator data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfileStatus = async (userId: string, newStatus: string) => {
    let remarks = '';
    if (newStatus === 'rejected') {
      const input = prompt('Enter discrepancy remarks for reverting this profile:', 'Incomplete roll number or branch information provided.');
      if (input === null) return;
      remarks = input;
    }

    try {
      await api.academic.updateProfileStatus(userId, newStatus, remarks);
      showToast(`Student profile marked as ${newStatus}.`, 'success');
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to update profile status', 'error');
    }
  };

  const handleReviewIntegrityEvent = async (eventId: string, newStatus: string) => {
    const remarks = prompt('Enter administrative review notes (optional):', 'Reviewed and dismissed as accidental keystroke.');
    if (remarks === null) return;

    try {
      await api.integrity.reviewEvent(eventId, newStatus, remarks);
      showToast(`Event marked as ${newStatus}.`, 'success');
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to review event', 'error');
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Overview Stat Cards */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Administrator Control Center
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Institutional oversight for student onboarding verification, academic security telemetry, and grading ledgers.
        </p>
      </div>

      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Total Students</span>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1 block">
              {analytics.total_students}
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Pending Verification</span>
            <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1 block">
              {analytics.pending_registrations}
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Total Faculty</span>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1 block">
              {analytics.total_faculty}
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Authored Docs</span>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1 block">
              {analytics.total_documents}
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Graded & Approved</span>
            <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 block">
              {analytics.graded_submissions}
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Integrity Flags</span>
            <span className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-1 block">
              {analytics.total_integrity_events}
            </span>
          </div>
        </div>
      )}

      {/* Tabs Bar */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('registrations')}
            className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'registrations'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <GraduationCap className="w-4 h-4" /> Student Registrations
          </button>

          <button
            onClick={() => setActiveTab('integrity')}
            className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'integrity'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-4 h-4" /> Integrity & Cheat Ledger
          </button>

          <button
            onClick={() => setActiveTab('ledger')}
            className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'ledger'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <FileCheck className="w-4 h-4" /> Institutional Grading Ledger
          </button>
        </div>

        {/* Global Export Buttons */}
        <div className="flex items-center gap-2 pb-3">
          {activeTab === 'integrity' && (
            <a
              href={api.exports.getIntegrityLedgerCsvUrl()}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-xl flex items-center gap-1.5 shadow-sm"
            >
              <Download className="w-3.5 h-3.5" /> Export Integrity CSV
            </a>
          )}
          {activeTab === 'ledger' && (
            <a
              href={api.exports.getGradingLedgerCsvUrl()}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center gap-1.5 shadow-sm"
            >
              <Download className="w-3.5 h-3.5" /> Export Grading CSV
            </a>
          )}
        </div>
      </div>

      {/* Tab 1: Student Registrations Management */}
      {activeTab === 'registrations' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Registered Student Profiles</h3>
            <span className="text-xs text-slate-500">{profiles.length} Total Registrations</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 uppercase border-b border-slate-200 dark:border-slate-800">
                  <th className="py-3 px-6 font-bold">Student Name</th>
                  <th className="py-3 px-6 font-bold">Roll Number</th>
                  <th className="py-3 px-6 font-bold">Class & Branch</th>
                  <th className="py-3 px-6 font-bold">Division</th>
                  <th className="py-3 px-6 font-bold">Open Elective</th>
                  <th className="py-3 px-6 font-bold">Status</th>
                  <th className="py-3 px-6 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {profiles.map((p) => (
                  <tr key={p.user_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 px-6 font-bold text-slate-900 dark:text-white">{p.name || 'Student'}</td>
                    <td className="py-3.5 px-6 font-mono font-semibold">{p.roll_number}</td>
                    <td className="py-3.5 px-6 font-medium">{`${p.year_level} - ${p.branch_code}`}</td>
                    <td className="py-3.5 px-6">{p.division_name}</td>
                    <td className="py-3.5 px-6 text-slate-500">{p.elective_subject || 'None'}</td>
                    <td className="py-3.5 px-6">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase border ${
                          p.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                            : p.status === 'pending'
                            ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800'
                            : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-right space-x-2">
                      {p.status !== 'approved' && (
                        <button
                          onClick={() => handleUpdateProfileStatus(p.user_id, 'approved')}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold"
                        >
                          Approve
                        </button>
                      )}
                      {p.status === 'pending' && (
                        <button
                          onClick={() => handleUpdateProfileStatus(p.user_id, 'rejected')}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold"
                        >
                          Revert / Reject
                        </button>
                      )}
                      {p.status === 'approved' && (
                        <button
                          onClick={() => handleUpdateProfileStatus(p.user_id, 'blocked')}
                          className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold"
                        >
                          Block Access
                        </button>
                      )}
                      {p.status === 'blocked' && (
                        <button
                          onClick={() => handleUpdateProfileStatus(p.user_id, 'approved')}
                          className="px-2.5 py-1 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
                        >
                          Unblock
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Integrity & Security Ledger */}
      {activeTab === 'integrity' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Security & Anti-Cheat Telemetry Ledger</h3>
            <span className="text-xs text-slate-500">{integrityEvents.length} Recorded Incidents</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 uppercase border-b border-slate-200 dark:border-slate-800">
                  <th className="py-3 px-6 font-bold">Timestamp</th>
                  <th className="py-3 px-6 font-bold">Student</th>
                  <th className="py-3 px-6 font-bold">Roll No</th>
                  <th className="py-3 px-6 font-bold">Event Type</th>
                  <th className="py-3 px-6 font-bold">Severity</th>
                  <th className="py-3 px-6 font-bold">Telemetry Data</th>
                  <th className="py-3 px-6 font-bold">Review Status</th>
                  <th className="py-3 px-6 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {integrityEvents.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 px-6 font-mono text-slate-500">{new Date(e.timestamp).toLocaleString()}</td>
                    <td className="py-3.5 px-6 font-bold text-slate-900 dark:text-white">{e.student_name || 'Student'}</td>
                    <td className="py-3.5 px-6 font-mono font-semibold">{e.roll_number || '-'}</td>
                    <td className="py-3.5 px-6 font-semibold text-rose-600 dark:text-rose-400 capitalize">
                      {e.event_type.replace('_', ' ')}
                    </td>
                    <td className="py-3.5 px-6 uppercase font-bold text-[10px]">
                      <span
                        className={`px-2 py-0.5 rounded ${
                          e.severity === 'high'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400'
                            : e.severity === 'medium'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400'
                            : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {e.severity}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 font-mono text-[10px] text-slate-500 max-w-[200px] truncate">
                      {e.metadata_json}
                    </td>
                    <td className="py-3.5 px-6 capitalize font-semibold">{e.review_status}</td>
                    <td className="py-3.5 px-6 text-right space-x-2">
                      <button
                        onClick={() => handleReviewIntegrityEvent(e.id, 'dismissed')}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-xs font-semibold"
                      >
                        Dismiss
                      </button>
                      <button
                        onClick={() => handleReviewIntegrityEvent(e.id, 'investigating')}
                        className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded text-xs font-semibold"
                      >
                        Investigate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Institutional Grading Ledger */}
      {activeTab === 'ledger' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Institutional Grade Archive</h3>
              <p className="text-xs text-slate-500">
                Official institutional grade book with immutable digital signature hashes.
              </p>
            </div>
            <a
              href={api.exports.getGradingLedgerCsvUrl()}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm"
            >
              <Download className="w-4 h-4" /> Download Complete CSV
            </a>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            All records in this ledger have been evaluated and digitally signed by authorized faculty. You can export the ledger in CSV or XLSX format for integration with university ERP systems or academic accreditation audits.
          </div>
        </div>
      )}
    </div>
  );
};
