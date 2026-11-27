"use client";

import React, { useState, useEffect } from "react";
import {
  MessageSquarePlus,
  Sparkles,
  Send,
  CheckCircle2,
  Clock,
  AlertTriangle,
  CheckCircle,
  MessageCircle,
  FileText,
  Lightbulb,
  Zap,
  Bug,
  HelpCircle,
  RefreshCw,
  ShieldCheck,
  Trash2,
  ExternalLink,
  Share2,
  Smartphone,
  Laptop,
  ChevronRight,
  Filter,
  Info,
} from "lucide-react";
import { FeedbackItem } from "@/app/api/feedback/route";

type CategoryType = "FEATURE_REQUEST" | "APP_IMPROVEMENT" | "BUG_REPORT" | "GENERAL_FEEDBACK";
type PriorityType = "HIGH" | "MEDIUM" | "LOW";
type StatusType = "NEW" | "IN_PROGRESS" | "RESOLVED" | "ARCHIVED";

const CATEGORIES: {
  id: CategoryType;
  label: string;
  subLabel: string;
  icon: any;
  color: string;
  bgLight: string;
  border: string;
}[] = [
  {
    id: "FEATURE_REQUEST",
    label: "નવું ફીચર સૂચન",
    subLabel: "કોઈ નવી સુવિધા કે રિપોર્ટ ઉમેરવા",
    icon: Lightbulb,
    color: "text-amber-600",
    bgLight: "bg-amber-50 hover:bg-amber-100/80",
    border: "border-amber-200",
  },
  {
    id: "APP_IMPROVEMENT",
    label: "એપ સુધારો & સ્પીડ",
    subLabel: "હાલની સ્ક્રીન કે કામ વધુ ઝડપી બનાવવા",
    icon: Zap,
    color: "text-blue-600",
    bgLight: "bg-blue-50 hover:bg-blue-100/80",
    border: "border-blue-200",
  },
  {
    id: "BUG_REPORT",
    label: "ભૂલ / ખામી રિપોર્ટ",
    subLabel: "સિસ્ટમમાં કોઈ સમસ્યા કે ભૂલ જણાય તો",
    icon: Bug,
    color: "text-rose-600",
    bgLight: "bg-rose-50 hover:bg-rose-100/80",
    border: "border-rose-200",
  },
  {
    id: "GENERAL_FEEDBACK",
    label: "સામાન્ય અભિપ્રાય",
    subLabel: "સિસ્ટમ વિશે ટ્રસ્ટી મંડળનો પ્રતિભાવ",
    icon: MessageCircle,
    color: "text-emerald-600",
    bgLight: "bg-emerald-50 hover:bg-emerald-100/80",
    border: "border-emerald-200",
  },
];

const QUICK_TEMPLATES = [
  {
    title: "બુકિંગ કન્ફર્મેશનનો WhatsApp મેસેજ ઓટોમેટિક મોકલવો",
    category: "FEATURE_REQUEST" as CategoryType,
    priority: "HIGH" as PriorityType,
    desc: "નવું બુકિંગ થાય અથવા એડવાન્સ રકમ જમા થાય ત્યારે અરજદારના મોબાઇલ પર ટ્રસ્ટની સત્તાવાર વિગત અને સ્લિપ લિંક સાથેનો ઓટોમેટિક WhatsApp મેસેજ જવો જોઈએ.",
  },
  {
    title: "રસીદમાં ટ્રસ્ટનું સત્તાવાર લેટરહેડ અને QR કોડ",
    category: "FEATURE_REQUEST" as CategoryType,
    priority: "MEDIUM" as PriorityType,
    desc: "પ્રિન્ટ સ્લિપમાં ઉપર શ્રી સૌરાષ્ટ્ર પટેલ સમાજનું સત્તાવાર પ્રતીક, રજિસ્ટ્રેશન નંબર અને ઓનલાઇન વેરિફિકેશન માટે સ્કેનેબલ QR કોડ પ્રિન્ટ થવો જોઈએ.",
  },
  {
    title: "માસિક આવક-જાવક અને ડિપોઝિટ રીફંડનો નવો રિપોર્ટ",
    category: "FEATURE_REQUEST" as CategoryType,
    priority: "HIGH" as PriorityType,
    desc: "દરેક મહિનાના અંતે કેટલું ભાડું આવ્યું, કેટલી ડિપોઝિટ જમા થઈ અને કેટલી પરત કરી તેનો એક પીડીએફ / એક્સેલ રિપોર્ટ 1-ક્લિકમાં ડાઉનલોડ થવો જોઈએ.",
  },
  {
    title: "મોબાઈલ ફોનમાં પેજનું લોડિંગ હજુ વધુ ઝડપી કરવું",
    category: "APP_IMPROVEMENT" as CategoryType,
    priority: "MEDIUM" as PriorityType,
    desc: "મોબાઈલ ડેટા પર જ્યારે ટ્રસ્ટી બુકિંગ ચેક કરે ત્યારે પેજ 1-2 સેકન્ડમાં ખુલી જાય તેવું સુપરફાસ્ટ કેશિંગ કરવું.",
  },
  {
    title: "પ્રસંગના 3 દિવસ પહેલા SMS / WhatsApp રીમાઇન્ડર",
    category: "FEATURE_REQUEST" as CategoryType,
    priority: "MEDIUM" as PriorityType,
    desc: "પાર્ટીનો જે તારીખે પ્રસંગ હોય તેના 3 દિવસ પહેલા બાકી રકમ જમા કરાવવા અને સમયપત્રકની યાદ અપાવતી આપોઆપ સૂચના જવી જોઈએ.",
  },
  {
    title: "જૂની રદ થયેલી પાર્ટીઓ માટે અલગ આર્કાઇવ સેક્શન",
    category: "APP_IMPROVEMENT" as CategoryType,
    priority: "LOW" as PriorityType,
    desc: "જે બુકિંગ રદ થયા હોય તે મુખ્ય કેલેન્ડરમાં ન દેખાય પરંતુ એક અલગ રદ થયેલ યાદીમાં સંગ્રહિત રહે.",
  },
];

export default function AdminFeedbackPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"NEW" | "LIST">("NEW");

  // Form states
  const [category, setCategory] = useState<CategoryType>("FEATURE_REQUEST");
  const [priority, setPriority] = useState<PriorityType>("MEDIUM");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deviceInfo, setDeviceInfo] = useState("");

  // History Filter states
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [successTicket, setSuccessTicket] = useState<string | null>(null);

  // Status updating state
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    // Detect Device Info
    if (typeof window !== "undefined") {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const devType = isMobile ? "Mobile Device" : "Desktop PC / Laptop";
      const browser = navigator.userAgent.includes("Chrome")
        ? "Chrome"
        : navigator.userAgent.includes("Safari")
        ? "Safari"
        : "Browser";
      setDeviceInfo(`${devType} (${browser}, Screen: ${window.innerWidth}x${window.innerHeight})`);
    }

    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [userRes, feedRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/feedback"),
      ]);

      if (userRes.ok) {
        const uData = await userRes.json();
        setCurrentUser(uData.user);
      }

      if (feedRes.ok) {
        const fData = await feedRes.json();
        if (fData.feedbacks) {
          setFeedbacks(fData.feedbacks);
        }
      }
    } catch (err) {
      console.error("Initial load error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyTemplate = (tmpl: typeof QUICK_TEMPLATES[0]) => {
    setTitle(tmpl.title);
    setDescription(tmpl.desc);
    setCategory(tmpl.category);
    setPriority(tmpl.priority);
  };

  const handleSubmitSystem = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim() || !description.trim()) {
      alert("મહેરબાની કરીને વિષય અને વર્ણન બંને લખો.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          category,
          priority,
          deviceInfo,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "સૂચન નોંધવામાં ભૂલ આવી");
      }

      setSuccessTicket(data.ticketNo || "સફળતાપૂર્વક નોંધાયું");
      setTitle("");
      setDescription("");

      // Refresh list
      const feedRes = await fetch("/api/feedback");
      if (feedRes.ok) {
        const fData = await feedRes.json();
        if (fData.feedbacks) setFeedbacks(fData.feedbacks);
      }
    } catch (err: any) {
      alert(err.message || "Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendViaWhatsApp = async () => {
    if (!title.trim() || !description.trim()) {
      alert("મહેરબાની કરીને વિષય અને વર્ણન બંને લખો જેથી WhatsApp પર સંપૂર્ણ મેસેજ બની શકે.");
      return;
    }

    // Also auto-save to system in background if not already saved
    if (!successTicket) {
      try {
        const res = await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description,
            category,
            priority,
            deviceInfo,
          }),
        });
        const data = await res.json();
        if (res.ok && data.ticketNo) {
          setSuccessTicket(data.ticketNo);
          // Refresh list
          const feedRes = await fetch("/api/feedback");
          if (feedRes.ok) {
            const fData = await feedRes.json();
            if (fData.feedbacks) setFeedbacks(fData.feedbacks);
          }
        }
      } catch (err) {
        console.error("Auto-save error before WhatsApp:", err);
      }
    }

    const catObj = CATEGORIES.find((c) => c.id === category);
    const catName = catObj ? catObj.label : category;
    const prioLabel = priority === "HIGH" ? "🔴 તાત્કાલિક (Urgent)" : priority === "MEDIUM" ? "🟡 મહત્વનું (Important)" : "🟢 સામાન્ય (Normal)";
    const trusteeName = currentUser?.name || "ટ્રસ્ટી શ્રી";
    const trusteeRole = currentUser?.role === "SUPER_ADMIN" ? "Super Admin (ટ્રસ્ટી)" : "Admin (વહીવટકર્તા)";

    const message = 
`🏛️ *શ્રી સૌરાષ્ટ્ર પટેલ સમાજ - એપ સુધારા / ફીડબેક*
──────────────────────────
📌 *કેટેગરી:* ${catName}
⚡ *અગ્રતા (Priority):* ${prioLabel}
👤 *સૂચનકર્તા:* ${trusteeName} (${trusteeRole})
📱 *ડિવાઇસ:* ${deviceInfo || "Admin Web Portal"}

📝 *વિષય:*
${title.trim()}

📋 *વિગતવાર વર્ણન:*
${description.trim()}
──────────────────────────
_શ્રી સૌરાષ્ટ્ર પટેલ સમાજ નિકોલ-નરોડા ખાનગી એડમિન સિસ્ટમ_`;

    const encoded = encodeURIComponent(message);
    const waUrl = `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(waUrl, "_blank");
  };

  const handleUpdateStatus = async (id: string, newStatus: StatusType) => {
    try {
      setUpdatingId(id);
      const res = await fetch("/api/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (res.ok) {
        setFeedbacks((prev) =>
          prev.map((f) => (f.id === id ? { ...f, status: newStatus } : f))
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteFeedback = async (id: string) => {
    if (!confirm("શું તમે આ સૂચન ડિલીટ કરવા માંગો છો?")) return;
    try {
      const res = await fetch(`/api/feedback?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setFeedbacks((prev) => prev.filter((f) => f.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredFeedbacks = feedbacks.filter((item) => {
    if (filterCategory !== "ALL" && item.category !== filterCategory) return false;
    if (filterStatus !== "ALL" && item.status !== filterStatus) return false;
    return true;
  });

  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";

  // Stats counters
  const totalCount = feedbacks.length;
  const newCount = feedbacks.filter((f) => f.status === "NEW").length;
  const inProgressCount = feedbacks.filter((f) => f.status === "IN_PROGRESS").length;
  const resolvedCount = feedbacks.filter((f) => f.status === "RESOLVED").length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-200 text-xs font-semibold mb-3 border border-blue-400/30">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>સ્માર્ટ વહીવટ સહાયક (Smart Trustee Feedback)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <MessageSquarePlus className="w-8 h-8 text-amber-400" />
              <span>ફીડબેક અને સિસ્ટમ સુધારા સૂચન</span>
            </h1>
            <p className="text-blue-100/90 text-xs sm:text-sm mt-2 max-w-2xl leading-relaxed">
              શ્રી સૌરાષ્ટ્ર પટેલ સમાજ બુકિંગ પોર્ટલને વધુ સરળ, ઝડપી અને સુવિધાજનક બનાવવા માટે તમારા અમૂલ્ય સૂચનો, નવી જરૂરિયાતો અથવા કોઈપણ સુધારા અહીં સીધા નોંધો.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/15 text-xs text-white">
              <div className="text-[10px] text-blue-200 uppercase font-bold">સૂચનકર્તા (Logged In)</div>
              <div className="font-extrabold flex items-center gap-1.5 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>{currentUser?.name || "ટ્રસ્ટી મંડળ"}</span>
              </div>
              <div className="text-[10px] text-blue-200">
                {currentUser?.role === "SUPER_ADMIN" ? "Super Admin (ટ્રસ્ટી)" : "Admin"}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mt-6 pt-5 border-t border-white/10 text-xs sm:text-sm font-bold">
          <button
            type="button"
            onClick={() => setActiveTab("NEW")}
            className={`px-4 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer ${
              activeTab === "NEW"
                ? "bg-white text-blue-900 shadow-md font-black"
                : "text-blue-100 hover:bg-white/10"
            }`}
          >
            <Send className="w-4 h-4" />
            <span>✍️ નવું સૂચન / ફીચર ઉમેરો</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("LIST")}
            className={`px-4 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer ${
              activeTab === "LIST"
                ? "bg-white text-blue-900 shadow-md font-black"
                : "text-blue-100 hover:bg-white/10"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>📋 અગાઉના સૂચનો અને સ્ટેટસ ({totalCount})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: NEW FEEDBACK / FEATURE REQUEST */}
      {activeTab === "NEW" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Success Banner if submitted */}
            {successTicket && (
              <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-5 shadow-sm animate-in fade-in duration-200 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-emerald-900 text-base">
                      તમારું સૂચન સિસ્ટમમાં સફળતાપૂર્વક નોંધાઈ ગયું છે!
                    </h3>
                    <p className="text-emerald-700 text-xs mt-1">
                      ટિકિટ નંબર: <strong className="font-mono bg-white px-2 py-0.5 rounded border border-emerald-300">{successTicket}</strong>
                    </p>
                    <p className="text-emerald-600 text-[11px] mt-1.5">
                      આ સૂચન ટ્રસ્ટ ડેવલપમેન્ટ ટીમ અને બોર્ડ સમક્ષ રજૂ થશે. તમે નીચેના બટનથી આને સીધા WhatsApp પર પણ મોકલી શકો છો.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSuccessTicket(null)}
                  className="text-emerald-600 hover:text-emerald-900 text-xs font-bold underline"
                >
                  નવું સૂચન લખો
                </button>
              </div>
            )}

            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-6">
              {/* Step 1: Select Category */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2.5">
                  ૧. સૂચનનો પ્રકાર પસંદ કરો (Select Category) <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    const isSelected = category === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategory(cat.id)}
                        className={`text-left p-3.5 rounded-2xl border-2 transition-all flex items-start gap-3 cursor-pointer ${
                          isSelected
                            ? `border-blue-600 bg-blue-50/70 shadow-sm ring-2 ring-blue-500/20`
                            : `border-slate-200 hover:border-slate-300 bg-white`
                        }`}
                      >
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isSelected ? "bg-blue-600 text-white" : `${cat.bgLight} ${cat.color}`
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="leading-tight">
                          <div className={`font-black text-xs sm:text-sm ${isSelected ? "text-blue-900" : "text-slate-800"}`}>
                            {cat.label}
                          </div>
                          <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5">
                            {cat.subLabel}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Priority Selector */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                  ૨. અગ્રતા પસંદ કરો (Priority Level)
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPriority("LOW")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      priority === "LOW"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>સામાન્ય (Normal)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriority("MEDIUM")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      priority === "MEDIUM"
                        ? "bg-amber-50 border-amber-500 text-amber-800 ring-2 ring-amber-500/20"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span>મહત્વનું (Important)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriority("HIGH")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      priority === "HIGH"
                        ? "bg-rose-50 border-rose-500 text-rose-800 ring-2 ring-rose-500/20"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    <span>તાત્કાલિક (Urgent)</span>
                  </button>
                </div>
              </div>

              {/* Step 3: Title */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                  ૩. વિષય / ટૂંકી વિગત (Title / Summary) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="દા.ત. WhatsApp ઓટોમેટિક રિમાઇન્ડર અથવા રસીદમાં GST વિગત"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-semibold text-slate-800"
                />
              </div>

              {/* Step 4: Detailed Description */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                  ૪. વિગતવાર વર્ણન (Detailed Description) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="ક્યા પેજ પર સુધારો જોઈએ છે, કેવો નવો નિયમ કે રિપોર્ટ જોઈએ છે તેની સ્પષ્ટ વિગત અહીં લખો..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-normal text-slate-800"
                />
              </div>

              {/* Smart Auto Context Info Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-center justify-between text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-slate-400" />
                  <span className="text-[11px]">
                    આપોઆપ જોડાતી વિગત: <strong>{currentUser?.name || "Admin"}</strong> ({currentUser?.email || ""}) • {deviceInfo || "Web Browser"}
                  </span>
                </div>
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-full">
                  Verified
                </span>
              </div>

              {/* Action Buttons: 2 Smart Options */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                {/* 1. Save in System */}
                <button
                  type="button"
                  onClick={() => handleSubmitSystem()}
                  disabled={submitting || !title.trim() || !description.trim()}
                  className="w-full sm:flex-1 py-3 px-5 rounded-2xl bg-blue-700 hover:bg-blue-800 active:scale-[0.98] text-white font-extrabold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>{submitting ? "નોંધાઈ રહ્યું છે..." : "સિસ્ટમમાં સેવ કરો (Save to System)"}</span>
                </button>

                {/* 2. Direct WhatsApp to Developer */}
                <button
                  type="button"
                  onClick={handleSendViaWhatsApp}
                  disabled={!title.trim() || !description.trim()}
                  className="w-full sm:flex-1 py-3 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-extrabold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4 text-white" />
                  <span>વોટ્સએપ દ્વારા ડેવલપરને મોકલો</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Smart Quick Templates */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-slate-800 text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>ઝડપી વિષય સૂચનો (Quick Templates)</span>
                </h3>
              </div>
              <p className="text-slate-500 text-xs">
                ટાઈપિંગ કર્યા વગર સામાન્ય જરૂરિયાતો ૧-ક્લિકમાં ફોર્મમાં ભરો:
              </p>

              <div className="space-y-2.5">
                {QUICK_TEMPLATES.map((tmpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyTemplate(tmpl)}
                    className="w-full text-left p-3 rounded-2xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all flex items-start justify-between gap-2 text-xs group cursor-pointer"
                  >
                    <div>
                      <div className="font-bold text-slate-800 group-hover:text-blue-700 leading-snug">
                        {tmpl.title}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-2">
                        <span>{tmpl.category === "FEATURE_REQUEST" ? "💡 નવું ફીચર" : "⚡ એપ સુધારો"}</span>
                        <span>•</span>
                        <span>{tmpl.priority === "HIGH" ? "🔴 તાત્કાલિક" : "🟡 મહત્વનું"}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 shrink-0 mt-0.5" />
                  </button>
                ))}
              </div>
            </div>

            {/* Smart Tips Card */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl p-5 border border-amber-200 text-xs text-amber-900 space-y-2">
              <div className="font-extrabold flex items-center gap-1.5 text-amber-900">
                <Info className="w-4 h-4 text-amber-600" />
                <span>ટ્રસ્ટી સહાય માર્ગદર્શિકા</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                આ સૂચનો સીધા સોફ્ટવેર એન્જિનિયરિંગ ટીમ સુધી પહોંચે છે. જો કોઈ ગંભીર ભૂલ હોય તો 'તાત્કાલિક' પસંદ કરો અને વોટ્સએપ બટન દબાવીને તુરંત ફોરવર્ડ કરો.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FEEDBACK HISTORY & STATUS BOARD */}
      {activeTab === "LIST" && (
        <div className="space-y-5">
          {/* Summary Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase">કુલ સૂચનો (Total)</div>
              <div className="text-2xl font-black text-slate-800 mt-1">{totalCount}</div>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-blue-200 shadow-2xs bg-blue-50/30">
              <div className="text-[10px] font-bold text-blue-600 uppercase">નવા મળેલા (New)</div>
              <div className="text-2xl font-black text-blue-700 mt-1">{newCount}</div>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-amber-200 shadow-2xs bg-amber-50/30">
              <div className="text-[10px] font-bold text-amber-600 uppercase">વિચારણા હેઠળ (Review)</div>
              <div className="text-2xl font-black text-amber-700 mt-1">{inProgressCount}</div>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-emerald-200 shadow-2xs bg-emerald-50/30">
              <div className="text-[10px] font-bold text-emerald-600 uppercase">અમલમાં મુકેલ (Done)</div>
              <div className="text-2xl font-black text-emerald-700 mt-1">{resolvedCount}</div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-500 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" />
                <span>ફિલ્ટર:</span>
              </span>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-700 focus:outline-none"
              >
                <option value="ALL">બધી કેટેગરી (All Types)</option>
                <option value="FEATURE_REQUEST">💡 નવું ફીચર સૂચન</option>
                <option value="APP_IMPROVEMENT">⚡ એપ સુધારો</option>
                <option value="BUG_REPORT">🐛 ભૂલ / ખામી</option>
                <option value="GENERAL_FEEDBACK">💬 સામાન્ય અભિપ્રાય</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-700 focus:outline-none"
              >
                <option value="ALL">બધા સ્ટેટસ (All Status)</option>
                <option value="NEW">🔵 નવું (New)</option>
                <option value="IN_PROGRESS">🟡 વિચારણા હેઠળ (Under Review)</option>
                <option value="RESOLVED">🟢 અમલમાં મુકેલ (Done)</option>
              </select>
            </div>

            <button
              type="button"
              onClick={loadInitialData}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>રિફ્રેશ</span>
            </button>
          </div>

          {/* Feedbacks List */}
          {loading ? (
            <div className="bg-white rounded-3xl p-12 text-center text-slate-400 border border-slate-200">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
              <span>સૂચનો લોડ થઈ રહ્યા છે...</span>
            </div>
          ) : filteredFeedbacks.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center text-slate-500 border border-slate-200 space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <MessageSquarePlus className="w-6 h-6" />
              </div>
              <div className="font-bold text-slate-700">કોઈ સૂચન મળ્યું નથી</div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                હજુ સુધી કોઈ ફીડબેક નોંધાયો નથી. તમે પ્રથમ ટૅબમાંથી નવું ફીચર કે સુધારો સૂચવી શકો છો.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab("NEW")}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow hover:bg-blue-700"
              >
                + નવું સૂચન ઉમેરો
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFeedbacks.map((item) => {
                const catObj = CATEGORIES.find((c) => c.id === item.category);
                const Icon = catObj ? catObj.icon : MessageCircle;

                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs hover:shadow-md transition-all space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-mono text-xs font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {item.ticketNo}
                        </span>

                        {/* Category Badge */}
                        <span
                          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                            catObj ? `${catObj.bgLight} ${catObj.color}` : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{catObj?.label || item.category}</span>
                        </span>

                        {/* Priority Badge */}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            item.priority === "HIGH"
                              ? "bg-rose-100 text-rose-800"
                              : item.priority === "MEDIUM"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {item.priority === "HIGH" ? "🔴 તાત્કાલિક" : item.priority === "MEDIUM" ? "🟡 મહત્વનું" : "🟢 સામાન્ય"}
                        </span>

                        {/* Status Badge */}
                        <span
                          className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border ${
                            item.status === "RESOLVED"
                              ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                              : item.status === "IN_PROGRESS"
                              ? "bg-amber-50 border-amber-300 text-amber-800"
                              : "bg-blue-50 border-blue-300 text-blue-800"
                          }`}
                        >
                          {item.status === "RESOLVED"
                            ? "✓ અમલમાં મુકેલ (Done)"
                            : item.status === "IN_PROGRESS"
                            ? "⏳ વિચારણા હેઠળ (In Review)"
                            : "🔵 નવું (New)"}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-400">
                        {new Date(item.createdAt).toLocaleDateString("gu-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>

                    {/* Title & Description */}
                    <div>
                      <h4 className="font-black text-slate-900 text-sm sm:text-base">
                        {item.title}
                      </h4>
                      <p className="text-slate-600 text-xs sm:text-sm mt-1 whitespace-pre-wrap leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    {/* Submitter details & Super Admin Actions */}
                    <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="text-slate-500 text-[11px] flex items-center gap-2 flex-wrap">
                        <span>સૂચનકર્તા: <strong>{item.userName}</strong> ({item.userRole})</span>
                        {item.deviceInfo && (
                          <>
                            <span>•</span>
                            <span className="text-slate-400">{item.deviceInfo}</span>
                          </>
                        )}
                      </div>

                      {/* Super Admin Status Toggles */}
                      {isSuperAdmin && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] text-slate-400 font-bold uppercase">સ્ટેટસ બદલો:</span>
                          <button
                            type="button"
                            disabled={updatingId === item.id || item.status === "IN_PROGRESS"}
                            onClick={() => handleUpdateStatus(item.id, "IN_PROGRESS")}
                            className="px-2 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold hover:bg-amber-100 disabled:opacity-40 cursor-pointer"
                          >
                            વિચારણા હેઠળ
                          </button>
                          <button
                            type="button"
                            disabled={updatingId === item.id || item.status === "RESOLVED"}
                            onClick={() => handleUpdateStatus(item.id, "RESOLVED")}
                            className="px-2 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold hover:bg-emerald-100 disabled:opacity-40 cursor-pointer"
                          >
                            લાગુ કરેલ
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteFeedback(item.id)}
                            className="p-1 rounded text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition cursor-pointer"
                            title="ડિલીટ કરો"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
