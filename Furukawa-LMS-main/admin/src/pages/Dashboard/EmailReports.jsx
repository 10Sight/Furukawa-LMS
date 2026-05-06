import React, { useState, useEffect } from 'react';
import axiosInstance from '../../Helper/axiosInstance';
import { useSelector } from 'react-redux';
import { Mail, Plus, Trash2, FileSpreadsheet, CheckCircle2, Clock } from 'lucide-react';
import { toast } from "react-hot-toast";

const EmailReports = () => {
    const { theme } = useSelector((state) => state.theme) || {
        theme: {
            card: 'bg-white',
            textMain: 'text-slate-900',
            textSub: 'text-slate-500',
            input: 'bg-white'
        }
    };

    const [recipients, setRecipients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [form, setForm] = useState({
        email: '',
        frequency: ['Daily'],
        reportTypes: ['Manpower']
    });

    const [sending, setSending] = useState(false);

    useEffect(() => {
        fetchRecipients();
    }, []);

    const fetchRecipients = async () => {
        try {
            setLoading(true);
            const res = await axiosInstance.get('/api/reports/recipients');
            const list = res?.data?.data;

            if (Array.isArray(list)) {
                // Normalize: ensure frequency is always an array on each recipient
                const normalized = list.map(r => ({
                    ...r,
                    frequency: Array.isArray(r.frequency)
                        ? r.frequency
                        : typeof r.frequency === 'string' && r.frequency.trim()
                            ? r.frequency.split(',').map(f => f.trim())
                            : []
                }));
                setRecipients(normalized);
            } else {
                console.warn("Received data is not an array:", list);
                setRecipients([]);
            }
        } catch (err) {
            console.error("Failed to fetch recipients", err);
            toast.error(err?.response?.data?.message || "Failed to load recipients");
            setRecipients([]);
        } finally {
            setLoading(false);
        }
    };

    const validateEmail = (email) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const cleanedEmail = String(form.email || '').trim().toLowerCase();

        if (!cleanedEmail) {
            return toast.error("Please enter email address");
        }

        if (!validateEmail(cleanedEmail)) {
            return toast.error("Please enter a valid email address");
        }

        if (!form.frequency || form.frequency.length === 0) {
            return toast.error("Please select at least one report frequency");
        }

        try {
            setSaving(true);

            const submission = {
                email: cleanedEmail,
                frequency: form.frequency,
                reportTypes: form.reportTypes
            };

            const res = await axiosInstance.post(`/api/reports/recipients`, submission);

            setForm({
                email: '',
                frequency: ['Daily'],
                reportTypes: ['Manpower']
            });

            toast.success(res?.data?.message || "Recipient saved successfully");
            await fetchRecipients();
        } catch (err) {
            console.error("Failed to save recipient", err);
            toast.error(err?.response?.data?.message || "Failed to save recipient");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this recipient?")) return;

        try {
            setLoading(true);
            const res = await axiosInstance.delete(`/api/reports/recipients/${id}`);
            if (res.data.success) {
                toast.success("Recipient deleted successfully");
                await fetchRecipients();
            }
        } catch (err) {
            console.error("Failed to delete recipient", err);
            toast.error(err?.response?.data?.message || "Failed to delete recipient");
        } finally {
            setLoading(false);
        }
    };

    const handleSendReport = async () => {
        setSending(true);
        try {
            const res = await axiosInstance.post(`/api/reports/send-manual`);
            toast.success(res?.data?.message || `Report sent successfully!`);
        } catch (err) {
            console.error("Failed to manual send", err);
            toast.error(err?.response?.data?.message || "Failed to send report.");
        } finally {
            setSending(false);
        }
    };

    const toggleFrequency = (freq) => {
        setForm(prev => {
            const current = prev.frequency || [];
            if (current.includes(freq)) {
                if (current.length === 1) return prev; // keep at least one selected
                return { ...prev, frequency: current.filter(f => f !== freq) };
            } else {
                return { ...prev, frequency: [...current, freq] };
            }
        });
    };

    if (loading) return (
        <div className="min-h-[400px] flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-slate-400">
                <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                <p className="text-sm font-medium">Loading settings...</p>
            </div>
        </div>
    );

    return (
        <div className="space-y-8 animate-fade-in pb-12 w-full p-6">
            {/* Header Section */}
            <div className="p-8 rounded-2xl border shadow-sm bg-white relative overflow-hidden group border-slate-200">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Mail size={120} />
                </div>
                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                            <div className="p-2 bg-blue-500/10 rounded-lg">
                                <Mail className="text-blue-500" size={24} />
                            </div>
                            Email Report Settings
                        </h2>
                        <p className="mt-2 text-base text-slate-500 max-w-xl">
                            Manage automated manpower reports. Reports are generated as{' '}
                            <span className="font-semibold text-green-600">Excel</span> files and sent to registered recipients.
                        </p>
                    </div>
                    <button
                        onClick={handleSendReport}
                        disabled={sending}
                        className={`px-6 py-3 rounded-xl font-bold text-sm shadow-xl flex items-center gap-2 transition-all transform hover:-translate-y-0.5 ${sending
                            ? 'bg-slate-400 cursor-not-allowed text-white'
                            : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white shadow-blue-600/20'
                            }`}
                    >
                        {sending ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Sending...
                            </>
                        ) : (
                            <>
                                <Mail size={18} />
                                Trigger Manual Report
                            </>
                        )}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Configuration Panel */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="p-6 rounded-2xl border shadow-sm bg-white sticky top-6 border-slate-200">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-slate-900">Add Recipient</h3>
                            <span className="text-xs font-bold px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                                New
                            </span>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Email Input */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                                    <Mail size={14} />
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    required
                                    value={form.email}
                                    onChange={e => setForm({ ...form, email: e.target.value })}
                                    placeholder="name@company.com"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900"
                                />
                            </div>

                            {/* Frequency Selection */}
                            <div className="space-y-3">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                                    <Clock size={14} />
                                    Report Frequency
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <div
                                        onClick={() => toggleFrequency('Daily')}
                                        className={`cursor-pointer p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 text-center ${form.frequency.includes('Daily')
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-transparent bg-slate-100 hover:bg-slate-200'
                                            }`}
                                    >
                                        <div className={`p-1.5 rounded-full ${form.frequency.includes('Daily') ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
                                            <Clock size={16} />
                                        </div>
                                        <span className={`text-sm font-bold ${form.frequency.includes('Daily') ? 'text-blue-700' : 'text-slate-900'}`}>Daily</span>
                                        <span className="text-[10px] text-slate-500">Manpower Report</span>
                                    </div>

                                    <div
                                        onClick={() => toggleFrequency('Management Daily')}
                                        className={`cursor-pointer p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 text-center ${form.frequency.includes('Management Daily')
                                            ? 'border-green-500 bg-green-50'
                                            : 'border-transparent bg-slate-100 hover:bg-slate-200'
                                            }`}
                                    >
                                        <div className={`p-1.5 rounded-full ${form.frequency.includes('Management Daily') ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-500'}`}>
                                            <FileSpreadsheet size={16} />
                                        </div>
                                        <span className={`text-sm font-bold ${form.frequency.includes('Management Daily') ? 'text-green-700' : 'text-slate-900'}`}>Management Daily</span>
                                        <span className="text-[10px] text-slate-500">Attendance Data</span>
                                    </div>
                                </div>
                            </div>

                            {/* Report Type Info */}
                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">
                                    Included Report(s)
                                </label>

                                {form.frequency.includes('Daily') && (
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                                            <FileSpreadsheet size={20} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-slate-900">Manpower Report</div>
                                            <div className="text-xs text-slate-500">Daily Excel Format (.xlsx)</div>
                                        </div>
                                        <div className="ml-auto">
                                            <CheckCircle2 size={18} className="text-blue-500" />
                                        </div>
                                    </div>
                                )}

                                {form.frequency.includes('Management Daily') && (
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center text-green-600">
                                            <FileSpreadsheet size={20} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-slate-900">Management Daily</div>
                                            <div className="text-xs text-slate-500">Attendance Excel Format (.xlsx)</div>
                                        </div>
                                        <div className="ml-auto">
                                            <CheckCircle2 size={18} className="text-green-500" />
                                        </div>
                                    </div>
                                )}

                                {form.frequency.includes('Daily') && form.frequency.includes('Management Daily') && (
                                    <div className="mt-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
                                        <p className="text-[11px] font-semibold text-amber-700">
                                            ✦ Both reports will be sent in a single email with 2 attachments.
                                        </p>
                                    </div>
                                )}

                                {form.frequency.length === 0 && (
                                    <div className="text-sm text-slate-500 italic py-2">
                                        Please select at least one report type above.
                                    </div>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={saving}
                                className={`w-full ${saving ? 'bg-slate-500 cursor-not-allowed' : 'bg-slate-900 hover:bg-slate-800'} text-white font-bold py-4 rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2`}
                            >
                                {saving ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Plus size={20} />
                                        Add to List
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>

                {/* List Panel */}
                <div className="lg:col-span-8">
                    <div className="rounded-2xl border shadow-sm bg-white overflow-hidden flex flex-col h-full border-slate-200">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">Active Recipients</h3>
                                <p className="text-sm text-slate-500">People currently receiving the reports</p>
                            </div>
                            <div className="px-3 py-1 rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                                Total: {recipients.length}
                            </div>
                        </div>

                        <div className="overflow-x-auto flex-1 p-2">
                            {recipients.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                                    <Mail size={48} className="mb-4 opacity-20" />
                                    <p>No recipients configured yet.</p>
                                </div>
                            ) : (
                                <div className="space-y-3 p-2">
                                    {recipients.map((r) => {
                                        // frequency is already normalized to array by fetchRecipients
                                        const freqArr = r.frequency || [];
                                        const displayEmail = (r.email || r.toEmails || '').split(',')[0]?.trim() || '-';
                                        const hasBoth = freqArr.includes('Daily') && freqArr.includes('Management Daily');

                                        return (
                                            <div
                                                key={r.id}
                                                className="group p-4 rounded-xl border border-transparent hover:border-slate-200 bg-slate-50/50 hover:bg-white transition-all flex flex-col md:flex-row items-center gap-4"
                                            >
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                                                    {(displayEmail || "?").charAt(0).toUpperCase()}
                                                </div>

                                                <div className="flex-1 text-center md:text-left">
                                                    <div className="font-bold text-slate-900">{displayEmail}</div>
                                                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-1">
                                                        {freqArr.includes('Daily') && (
                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 bg-blue-100 text-blue-700">
                                                                <Clock size={10} />
                                                                Daily Manpower
                                                            </span>
                                                        )}
                                                        {freqArr.includes('Management Daily') && (
                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 bg-green-100 text-green-700">
                                                                <FileSpreadsheet size={10} />
                                                                Management Daily
                                                            </span>
                                                        )}
                                                        {hasBoth && (
                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 bg-amber-100 text-amber-700">
                                                                ✦ Combined Email
                                                            </span>
                                                        )}
                                                        {!r.isActive && (
                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-100 text-red-700">
                                                                Inactive
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => handleDelete(r.id)}
                                                    className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all opacity-100 xl:opacity-0 xl:group-hover:opacity-100"
                                                    title="Remove Recipient"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EmailReports;