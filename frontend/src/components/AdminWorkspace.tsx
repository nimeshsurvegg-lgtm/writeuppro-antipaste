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
      {/* Overview Header */}
      <div className="p-6 bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[4px_4px_0px_#1A1209]">
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#B84915] block mb-1">
          GOVERNANCE & TELEMETRY REGISTRY // INSTITUTIONAL AUDIT LEDGER
        </span>
        <h1 className="text-2xl font-black text-[#1A1209] dark:text-white tracking-tight">
          Administrator Control Center.
        </h1>
        <p className="text-xs text-[#5C4D3C] dark:text-[#B8A99A] font-mono mt-1">
          Institutional oversight for student onboarding verification, academic security telemetry, and grading ledgers.
        </p>
      </div>

      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 font-mono">
          <div className="bg-white dark:bg-[#1D1814] p-4 border-2 border-[#1A1209] shadow-[3.5px_3.5px_0px_#1A1209]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#786958] dark:text-[#A89886] block">
              Total Students
            </span>
            <span className="text-2xl font-black text-[#1A1209] dark:text-white mt-1 block">
              {analytics.total_students}
            </span>
          </div>

          <div className="bg-white dark:bg-[#1D1814] p-4 border-2 border-[#1A1209] shadow-[3.5px_3.5px_0px_#1A1209]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#B84915] block">
              Pending Verify
            </span>
            <span className="text-2xl font-black text-[#B84915] mt-1 block">
              {analytics.pending_registrations}
            </span>
          </div>

          <div className="bg-white dark:bg-[#1D1814] p-4 border-2 border-[#1A1209] shadow-[3.5px_3.5px_0px_#1A1209]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#786958] dark:text-[#A89886] block">
              Total Faculty
            </span>
            <span className="text-2xl font-black text-[#1A1209] dark:text-white mt-1 block">
              {analytics.total_faculty}
            </span>
          </div>

          <div className="bg-white dark:bg-[#1D1814] p-4 border-2 border-[#1A1209] shadow-[3.5px_3.5px_0px_#1A1209]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#786958] dark:text-[#A89886] block">
              Authored Docs
            </span>
            <span className="text-2xl font-black text-[#1A1209] dark:text-white mt-1 block">
              {analytics.total_documents}
            </span>
          </div>

          <div className="bg-white dark:bg-[#1D1814] p-4 border-2 border-[#1A1209] shadow-[3.5px_3.5px_0px_#1A1209]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#1F5A2E] block">
              Graded & Appr.
            </span>
            <span className="text-2xl font-black text-[#1F5A2E] dark:text-[#48BB78] mt-1 block">
              {analytics.graded_submissions}
            </span>
          </div>

          <div className="bg-white dark:bg-[#1D1814] p-4 border-2 border-[#1A1209] shadow-[3.5px_3.5px_0px_#1A1209]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B1A1A] block">
              Integrity Flags
            </span>
            <span className="text-2xl font-black text-[#8B1A1A] mt-1 block">
              {analytics.total_integrity_events}
            </span>
          </div>
        </div>
      )}

      {/* Tabs Bar */}
      <div className="flex flex-wrap items-center justify-between border-b-2 border-[#1A1209] pb-0 gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('registrations')}
            className={`neo-btn px-4 py-2 text-xs flex items-center gap-2 ${
              activeTab === 'registrations'
                ? 'bg-[#1A365D] text-white shadow-[2px_2px_0px_#1A1209]'
                : 'bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-[#D4C7B5]'
            }`}
          >
            <GraduationCap className="w-4 h-4" /> STUDENT REGISTRATIONS
          </button>

          <button
            onClick={() => setActiveTab('integrity')}
            className={`neo-btn px-4 py-2 text-xs flex items-center gap-2 ${
              activeTab === 'integrity'
                ? 'bg-[#8B1A1A] text-white shadow-[2px_2px_0px_#1A1209]'
                : 'bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-[#D4C7B5]'
            }`}
          >
            <ShieldAlert className="w-4 h-4" /> INTEGRITY TELEMETRY
          </button>

          <button
            onClick={() => setActiveTab('ledger')}
            className={`neo-btn px-4 py-2 text-xs flex items-center gap-2 ${
              activeTab === 'ledger'
                ? 'bg-[#1F5A2E] text-white shadow-[2px_2px_0px_#1A1209]'
                : 'bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-[#D4C7B5]'
            }`}
          >
            <FileCheck className="w-4 h-4" /> GRADING LEDGER
          </button>
        </div>

        {/* Global Export Buttons */}
        <div className="flex items-center gap-2 pb-2">
          {activeTab === 'integrity' && (
            <a
              href={api.exports.getIntegrityLedgerCsvUrl()}
              target="_blank"
              rel="noreferrer"
              className="neo-btn px-3.5 py-1.5 text-xs bg-[#1A1209] text-white flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-[#B84915]" /> EXPORT INTEGRITY CSV
            </a>
          )}
          {activeTab === 'ledger' && (
            <a
              href={api.exports.getGradingLedgerCsvUrl()}
              target="_blank"
              rel="noreferrer"
              className="neo-btn px-3.5 py-1.5 text-xs bg-[#B84915] hover:bg-[#A03D0E] text-white flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> EXPORT GRADING CSV
            </a>
          )}
        </div>
      </div>

      {/* Tab 1: Student Registrations Management */}
      {activeTab === 'registrations' && (
        <div className="bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[4px_4px_0px_#1A1209] overflow-hidden">
          <div className="p-4 bg-[#F4EFE6] dark:bg-[#26201B] border-b-2 border-[#1A1209] flex items-center justify-between font-mono">
            <span className="font-bold text-xs uppercase text-[#1A1209] dark:text-white">
              REGISTERED STUDENT PROFILES
            </span>
            <span className="stamp-badge bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-white">
              {profiles.length} REGISTRATIONS
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="bg-[#FAF6EE] dark:bg-[#26201B] text-[#1A1209] dark:text-[#D4C7B5] uppercase border-b-2 border-[#1A1209]">
                  <th className="py-3 px-6 font-bold font-sans">Student Name</th>
                  <th className="py-3 px-6 font-bold">Roll Number</th>
                  <th className="py-3 px-6 font-bold">Class & Branch</th>
                  <th className="py-3 px-6 font-bold">Division</th>
                  <th className="py-3 px-6 font-bold">Open Elective</th>
                  <th className="py-3 px-6 font-bold">Status</th>
                  <th className="py-3 px-6 font-bold text-right font-sans">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y border-b border-[#1A1209]/20">
                {profiles.map((p) => (
                  <tr key={p.user_id} className="hover:bg-[#FAF6EE] dark:hover:bg-[#26201B] transition-colors">
                    <td className="py-3.5 px-6 font-bold font-sans text-[#1A1209] dark:text-white">{p.name || 'Student'}</td>
                    <td className="py-3.5 px-6 font-bold">{p.roll_number}</td>
                    <td className="py-3.5 px-6">{`${p.year_level} - ${p.branch_code}`}</td>
                    <td className="py-3.5 px-6">{p.division_name}</td>
                    <td className="py-3.5 px-6 text-[#786958]">{p.elective_subject || 'None'}</td>
                    <td className="py-3.5 px-6">
                      <span
                        className={`stamp-badge ${
                          p.status === 'approved'
                            ? 'bg-[#1F5A2E]/10 text-[#1F5A2E] border-[#1F5A2E]'
                            : p.status === 'pending'
                            ? 'bg-[#C27D0E]/10 text-[#C27D0E] border-[#C27D0E]'
                            : 'bg-[#8B1A1A]/10 text-[#8B1A1A] border-[#8B1A1A]'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-right space-x-2">
                      {p.status !== 'approved' && (
                        <button
                          onClick={() => handleUpdateProfileStatus(p.user_id, 'approved')}
                          className="neo-btn px-2.5 py-1 bg-[#1F5A2E] hover:bg-[#164423] text-white text-[11px]"
                        >
                          Approve
                        </button>
                      )}
                      {p.status === 'pending' && (
                        <button
                          onClick={() => handleUpdateProfileStatus(p.user_id, 'rejected')}
                          className="neo-btn px-2.5 py-1 bg-[#B84915] hover:bg-[#94380E] text-white text-[11px]"
                        >
                          Revert
                        </button>
                      )}
                      {p.status === 'approved' && (
                        <button
                          onClick={() => handleUpdateProfileStatus(p.user_id, 'blocked')}
                          className="neo-btn px-2.5 py-1 bg-[#8B1A1A] hover:bg-[#6D1212] text-white text-[11px]"
                        >
                          Block
                        </button>
                      )}
                      {p.status === 'blocked' && (
                        <button
                          onClick={() => handleUpdateProfileStatus(p.user_id, 'approved')}
                          className="neo-btn px-2.5 py-1 bg-[#1A365D] text-white text-[11px]"
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
        <div className="bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[4px_4px_0px_#1A1209] overflow-hidden">
          <div className="p-4 bg-[#F4EFE6] dark:bg-[#26201B] border-b-2 border-[#1A1209] flex items-center justify-between font-mono">
            <span className="font-bold text-xs uppercase text-[#1A1209] dark:text-white">
              SECURITY & ANTI-CHEAT TELEMETRY LEDGER
            </span>
            <span className="stamp-badge bg-[#8B1A1A]/10 text-[#8B1A1A] border-[#8B1A1A]">
              {integrityEvents.length} INCIDENTS
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="bg-[#FAF6EE] dark:bg-[#26201B] text-[#1A1209] dark:text-[#D4C7B5] uppercase border-b-2 border-[#1A1209]">
                  <th className="py-3 px-6 font-bold">Timestamp</th>
                  <th className="py-3 px-6 font-bold font-sans">Student</th>
                  <th className="py-3 px-6 font-bold">Roll No</th>
                  <th className="py-3 px-6 font-bold">Event Type</th>
                  <th className="py-3 px-6 font-bold">Severity</th>
                  <th className="py-3 px-6 font-bold">Telemetry Data</th>
                  <th className="py-3 px-6 font-bold">Review Status</th>
                  <th className="py-3 px-6 font-bold text-right font-sans">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y border-b border-[#1A1209]/20">
                {integrityEvents.map((e) => (
                  <tr key={e.id} className="hover:bg-[#FAF6EE] dark:hover:bg-[#26201B] transition-colors">
                    <td className="py-3.5 px-6 text-[#786958]">{new Date(e.timestamp).toLocaleTimeString()}</td>
                    <td className="py-3.5 px-6 font-bold font-sans text-[#1A1209] dark:text-white">{e.student_name || 'Student'}</td>
                    <td className="py-3.5 px-6 font-semibold">{e.roll_number || '-'}</td>
                    <td className="py-3.5 px-6 font-semibold text-[#8B1A1A] capitalize">
                      {e.event_type.replace('_', ' ')}
                    </td>
                    <td className="py-3.5 px-6 uppercase font-bold text-[10px]">
                      <span
                        className={`stamp-badge py-0 ${
                          e.severity === 'high'
                            ? 'bg-[#8B1A1A] text-white border-[#8B1A1A]'
                            : e.severity === 'medium'
                            ? 'bg-[#C27D0E] text-white border-[#C27D0E]'
                            : 'bg-[#F4EFE6] text-[#1A1209] border-[#1A1209]'
                        }`}
                      >
                        {e.severity}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-[10px] text-[#5C4D3C] max-w-[200px] truncate">
                      {e.metadata_json}
                    </td>
                    <td className="py-3.5 px-6 capitalize font-semibold">{e.review_status}</td>
                    <td className="py-3.5 px-6 text-right space-x-2">
                      <button
                        onClick={() => handleReviewIntegrityEvent(e.id, 'dismissed')}
                        className="neo-btn px-2.5 py-1 bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-white text-[11px]"
                      >
                        Dismiss
                      </button>
                      <button
                        onClick={() => handleReviewIntegrityEvent(e.id, 'investigating')}
                        className="neo-btn px-2.5 py-1 bg-[#1A365D] text-white text-[11px]"
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
        <div className="bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[4px_4px_0px_#1A1209] p-6 space-y-4">
          <div className="flex items-center justify-between pb-4 border-b-2 border-[#1A1209]">
            <div>
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#B84915] block mb-1">
                IMMUTABLE AUDIT LOG // DIGITALLY SIGNED
              </span>
              <h3 className="font-extrabold text-lg text-[#1A1209] dark:text-white tracking-tight">Institutional Grade Archive.</h3>
              <p className="text-xs font-mono text-[#5C4D3C] dark:text-[#B8A99A]">
                Official institutional grade book with immutable digital signature hashes.
              </p>
            </div>
            <a
              href={api.exports.getGradingLedgerCsvUrl()}
              target="_blank"
              rel="noreferrer"
              className="neo-btn px-4 py-2 bg-[#B84915] hover:bg-[#A03D0E] text-white text-xs flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> DOWNLOAD COMPLETE CSV →
            </a>
          </div>

          <div className="p-4 bg-[#FAF6EE] dark:bg-[#26201B] border-2 border-[#1A1209] text-xs font-mono text-[#1A1209] dark:text-[#D4C7B5] leading-relaxed shadow-[2px_2px_0px_#1A1209]">
            All records in this ledger have been evaluated and digitally signed by authorized faculty. You can export the ledger in CSV or XLSX format for integration with university ERP systems or academic accreditation audits.
          </div>
        </div>
      )}
    </div>
  );
};
