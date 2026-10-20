import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Phone,
  MapPin,
  Building2,
  Calendar as CalendarIcon,
  ShieldCheck,
  Sparkles,
  Download,
  RefreshCw,
  Lock,
  Unlock,
  Send,
  CheckCircle2,
  AlertCircle,
  Filter,
  Layers,
  Clock,
  ArrowRight,
  Share2,
  Crown,
  LogOut,
  User,
  Copy,
  ExternalLink,
  MessageSquare,
  Plus,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { SubscriptionAndAuthModals } from './SubscriptionAndAuthModals';
import founderPhoto from './assets/images/manthru-founder.jpg';

export interface BusinessLead {
  id: string;
  name: string;
  phone: string;
  category: string;
  area: string;
  address: string;
  website?: string;
  rating?: number | null;
  reviewCount?: number | null;
  operationalStatus?: string;
  status: 'New' | 'Contacted' | 'Follow Up' | 'Qualified' | 'Converted' | 'Not Interested';
  notes?: string;
  followUpDate?: string;
  createdAt: string;
}

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<'finder' | 'leads' | 'calendar' | 'marketing' | 'antiban' | 'about'>('finder');

  // Authentication & Subscription State
  const [activeUserMobile, setActiveUserMobile] = useState<string>(() => {
    return localStorage.getItem('manthru_active_mobile') || '';
  });
  const [currentUserStatus, setCurrentUserStatus] = useState<any>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(true);

  // Modals Visibility
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState<boolean>(false);
  const [showOwnerModal, setShowOwnerModal] = useState<boolean>(false);
  const [showAntiBanModal, setShowAntiBanModal] = useState<boolean>(false);

  // Toast System
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Leads & Finder State
  const [searchCategory, setSearchCategory] = useState('Wholesale Chilli Powder & Spices');
  const [searchArea, setSearchArea] = useState('Guntur');
  const [mapsPasteLink, setMapsPasteLink] = useState('');
  const [searchBatchSize, setSearchBatchSize] = useState<number>(50); // 20, 50, 100
  const [isSearching, setIsSearching] = useState(false);
  const [leads, setLeads] = useState<BusinessLead[]>([]);
  const [leadFilterText, setLeadFilterText] = useState('');
  const [leadStatusFilter, setLeadStatusFilter] = useState<string>('All');

  // Anti-Ban Outreach Stepper Modal
  const [isStepperOpen, setIsStepperOpen] = useState(false);
  const [stepperIndex, setStepperIndex] = useState(0);
  const [stepperPacingSeconds, setStepperPacingSeconds] = useState(15);
  const [stepperCountdown, setStepperCountdown] = useState(0);
  const [sessionSentCount, setSessionSentCount] = useState(0);
  const [customPitchText, setCustomPitchText] = useState(
    'నమస్కారం {name} గారు! మేము హోల్‌సేల్ మిర్చి పొడి & స్పైసెస్ తయారీదారులం. మా దగ్గర బెస్ట్ క్వాలిటీ మరియు రీజనబుల్ ప్రైస్‌లో లభిస్తాయి. మీకు క్యాటలాగ్ & సాంపుల్స్ పంపమంటారా?'
  );

  // Calendar State
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => {
    return new Date().toISOString().slice(0, 10);
  });

  // Marketing Generator State
  const [marketingTopic, setMarketingTopic] = useState('Special Offer & Festival Greetings');
  const [marketingLanguage, setMarketingLanguage] = useState<'Telugu' | 'English'>('Telugu');
  const [generatedMarketingText, setGeneratedMarketingText] = useState('');
  const [isGeneratingMarketing, setIsGeneratingMarketing] = useState(false);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Sync user status on mount and when mobile changes
  const fetchUserStatus = async (mobile: string) => {
    if (!mobile) {
      setCurrentUserStatus(null);
      setIsLoadingStatus(false);
      setShowAuthModal(true);
      return;
    }
    setIsLoadingStatus(true);
    try {
      const res = await fetch(`/api/user/status?mobile=${encodeURIComponent(mobile)}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentUserStatus(data);
        localStorage.setItem('manthru_active_mobile', mobile);
        // Also fetch user's saved leads from server database
        fetchUserLeads(mobile);
      } else {
        // User not found or expired session
        setCurrentUserStatus(null);
        localStorage.removeItem('manthru_active_mobile');
        setShowAuthModal(true);
      }
    } catch (e) {
      console.warn('Status fetch error:', e);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const fetchUserLeads = async (mobile: string) => {
    try {
      const res = await fetch(`/api/user/leads?mobile=${encodeURIComponent(mobile)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.leads) && data.leads.length > 0) {
          setLeads(data.leads);
        }
      }
    } catch (e) {
      console.warn('Leads fetch error:', e);
    }
  };

  const saveLeadsToServer = async (newLeads: BusinessLead[]) => {
    if (!activeUserMobile) return;
    try {
      await fetch('/api/user/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: activeUserMobile, leads: newLeads }),
      });
    } catch (e) {
      console.warn('Error saving leads to server:', e);
    }
  };

  useEffect(() => {
    if (activeUserMobile) {
      fetchUserStatus(activeUserMobile);
    } else {
      setIsLoadingStatus(false);
      setShowAuthModal(true);
    }
  }, [activeUserMobile]);

  // Handle Login / Logout
  const handleUserLogin = (user: any) => {
    setActiveUserMobile(user.mobile);
    setCurrentUserStatus(user);
    localStorage.setItem('manthru_active_mobile', user.mobile);
    fetchUserStatus(user.mobile);
    triggerToast(`✓ Welcome ${user.name || user.mobile}! Logged in successfully.`);
  };

  const handleUserLogout = () => {
    setActiveUserMobile('');
    setCurrentUserStatus(null);
    setLeads([]);
    localStorage.removeItem('manthru_active_mobile');
    setShowAuthModal(true);
    triggerToast('Logged out.');
  };

  // Searching for Real Businesses (Up to 100 Verified Leads)
  const handleSearchLeads = async (e?: React.FormEvent, override?: { area: string; category: string }) => {
    if (e) e.preventDefault();
    const effectiveArea = override?.area || searchArea;
    const effectiveCategory = override?.category || searchCategory;

    // Strict Subscription Check: If not subscribed, lock search!
    if (!currentUserStatus?.isSubscribed) {
      setShowSubscriptionModal(true);
      triggerToast('🔒 Subscription Required: Pay ₹499 to unlock Search & Finding!');
      return;
    }

    if (!effectiveCategory.trim() || !effectiveArea.trim()) {
      triggerToast('Please enter both category and target area.');
      return;
    }

    setIsSearching(true);
    triggerToast(`Searching up to ${searchBatchSize} verified leads in ${effectiveArea}...`);

    try {
      const res = await fetch('/api/leads/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `${effectiveCategory} in ${effectiveArea}`,
          pageSize: searchBatchSize,
          targetArea: effectiveArea,
          targetCategory: effectiveCategory,
          strictAreaFilter: true,
        }),
      });

      if (!res.ok) {
        throw new Error('Search failed on server');
      }

      const data = await res.json();
      const fetched: BusinessLead[] = data.leads || [];

      if (fetched.length === 0) {
        triggerToast('No businesses with verified contact phone numbers found in this area. Try adjacent area.');
      } else {
        // Merge with existing leads, deduplicating by phone and id
        const existingPhones = new Set(leads.map((l) => l.phone.replace(/\D/g, '')));
        const newUnique = fetched.filter((l) => {
          const digits = l.phone.replace(/\D/g, '');
          return digits.length >= 7 && !existingPhones.has(digits);
        });

        const updatedList = [...newUnique, ...leads];
        setLeads(updatedList);
        saveLeadsToServer(updatedList);
        triggerToast(`✓ Found ${fetched.length} verified leads with valid phone numbers! (${newUnique.length} new added)`);
        setActiveTab('leads');
      }
    } catch (err: any) {
      triggerToast('Error searching leads. Please check connection.');
    } finally {
      setIsSearching(false);
    }
  };

  // Parse a Google Maps search URL, then run the existing real-business search.
  const handlePasteMapsLink = async () => {
    if (!currentUserStatus?.isSubscribed) {
      setShowSubscriptionModal(true);
      triggerToast('Subscription required to import leads.');
      return;
    }
    const raw = mapsPasteLink.trim();
    if (!raw) { triggerToast('Paste a Google Maps search link first.'); return; }
    try {
      const decoded = decodeURIComponent(raw.replace(/&amp;/g, '&'));
      let query = '';
      const searchMatch = decoded.match(/\/maps\/search\/([^/?]+)/i);
      if (searchMatch) query = searchMatch[1].replace(/\+/g, ' ').replace(/,/g, ' ').trim();
      if (!query) {
        const url = new URL(raw);
        query = url.searchParams.get('query') || url.searchParams.get('q') || '';
      }
      if (!query) { triggerToast('Could not read a search query from this link. Open a Google Maps search-results link and paste it.'); return; }
      // Common Maps search format: "Medchal, Xerox Center".
      const bits = query.split(/\s*,\s*/).map(v => v.trim()).filter(Boolean);
      const area = bits.length > 1 ? bits[0] : searchArea;
      const category = bits.length > 1 ? bits.slice(1).join(' ') : query;
      setSearchArea(area);
      setSearchCategory(category);
      triggerToast(`Maps search detected: ${category} in ${area}. Fetching available business leads...`);
      await handleSearchLeads(undefined, { area, category });
    } catch (err) {
      triggerToast('Invalid link. Paste a full Google Maps search URL.');
    }
  };

  // Update single lead status
  const handleUpdateLeadStatus = (id: string, newStatus: BusinessLead['status']) => {
    const updated = leads.map((l) => (l.id === id ? { ...l, status: newStatus } : l));
    setLeads(updated);
    saveLeadsToServer(updated);
  };

  // Update lead follow-up date
  const handleUpdateFollowUpDate = (id: string, date: string) => {
    const updated = leads.map((l) => (l.id === id ? { ...l, followUpDate: date, status: 'Follow Up' as const } : l));
    setLeads(updated);
    saveLeadsToServer(updated);
    triggerToast('Follow-up scheduled on calendar!');
  };

  // Delete lead
  const handleDeleteLead = (id: string) => {
    const updated = leads.filter((l) => l.id !== id);
    setLeads(updated);
    saveLeadsToServer(updated);
    triggerToast('Lead removed.');
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (leads.length === 0) {
      triggerToast('No leads to export.');
      return;
    }
    const headers = ['S.No', 'Name', 'Phone', 'Category', 'Area', 'Address', 'Status', 'FollowUpDate', 'Rating'];
    const rows = leads.map((l, idx) => [
      idx + 1,
      `"${l.name.replace(/"/g, '""')}"`,
      `"${l.phone}"`,
      `"${l.category.replace(/"/g, '""')}"`,
      `"${l.area.replace(/"/g, '""')}"`,
      `"${l.address.replace(/"/g, '""')}"`,
      l.status,
      l.followUpDate || '',
      l.rating || '',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ManThru_Leads_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast('✓ Leads exported to CSV successfully!');
  };


  // Export an Excel-friendly outreach worksheet for contacts who have consented.
  // The Message and WhatsApp Consent columns are intentionally blank for user review.
  const handleExportWhatsAppCSV = () => {
    if (filteredLeads.length === 0) {
      triggerToast('No filtered leads to export.');
      return;
    }

    const escapeCsv = (value: unknown) => {
      let text = String(value ?? '');
      // Prevent spreadsheet formula execution when opening untrusted lead data.
      if (/^[=+@-]/.test(text)) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    };

    const headers = [
      'Phone',
      'Message',
      'WhatsApp Consent',
      'Business Name',
      'Category',
      'Area',
      'Address',
      'Website',
      'Lead Status',
    ];
    const rows = filteredLeads.map((lead) => [
      lead.phone,
      '',
      '',
      lead.name,
      lead.category,
      lead.area,
      lead.address,
      lead.website || '',
      lead.status,
    ]);

    // UTF-8 BOM helps Excel display Telugu and other Unicode text correctly.
    const csvContent = '\uFEFF' + [headers, ...rows]
      .map((row) => row.map(escapeCsv).join(','))
      .join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ManThru_WhatsApp_Excel_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    triggerToast('Excel-friendly CSV exported. Fill Message only for opted-in contacts.');
  };

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchText =
        !leadFilterText ||
        lead.name.toLowerCase().includes(leadFilterText.toLowerCase()) ||
        lead.phone.includes(leadFilterText) ||
        lead.area.toLowerCase().includes(leadFilterText.toLowerCase()) ||
        lead.category.toLowerCase().includes(leadFilterText.toLowerCase());

      const matchStatus = leadStatusFilter === 'All' || lead.status === leadStatusFilter;

      return matchText && matchStatus;
    });
  }, [leads, leadFilterText, leadStatusFilter]);

  // Anti-Ban Dynamic Message Builder (Spintax variation)
  const buildAntiBanMessage = (lead: BusinessLead) => {
    const greetings = ['నమస్కారం అండి!', 'హలో సర్!', 'శుభోదయం!', 'నమస్తే అండి!', 'గ్రీటింగ్స్!'];
    const intros = [
      `మీ వ్యాపారం "${lead.name}" సమాచారం చూశాను.`,
      `మీ షాప్ "${lead.name}" కాంటాక్ట్ వివరాలు పరిశీలించాను.`,
      `మీ లోకల్ స్టోర్ "${lead.name}" కోసం సంప్రదిస్తున్నాను.`,
    ];

    // Pick random variations
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];
    const intro = intros[Math.floor(Math.random() * intros.length)];
    const sessionTag = `[Ref: #MT-${Math.floor(1000 + Math.random() * 9000)}]`;

    let body = customPitchText.replace(/{name}/g, lead.name);

    // Append Opt-out note to prevent recipient from reporting spam (Anti-Ban Guarantee)
    const optOut = `\n\n(ఈ మెసేజ్ మీకు అవసరం లేకపోతే 'STOP' అని రిప్లై ఇవ్వండి • ${sessionTag})`;

    return `${greeting} ${intro}\n\n${body}${optOut}`;
  };

  // Launch Anti-Ban WhatsApp Stepper
  const handleStartStepper = () => {
    if (!currentUserStatus?.isSubscribed) {
      setShowSubscriptionModal(true);
      triggerToast('🔒 Subscription Required: Pay ₹499 to use WhatsApp Outreach!');
      return;
    }
    if (filteredLeads.length === 0) {
      triggerToast('No leads available to message. Please find leads first.');
      return;
    }
    setIsStepperOpen(true);
    setStepperIndex(0);
    setStepperCountdown(0);
  };

  // Send current stepper message
  const handleSendCurrentStepper = () => {
    const currentLead = filteredLeads[stepperIndex];
    if (!currentLead) return;

    const rawDigits = currentLead.phone.replace(/\D/g, '');
    let cleanPhone = rawDigits;
    if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
    if (cleanPhone.startsWith('0') && cleanPhone.length === 11) cleanPhone = '91' + cleanPhone.slice(1);

    const msg = buildAntiBanMessage(currentLead);
    const encoded = encodeURIComponent(msg);
    const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`;

    window.open(url, '_blank');

    // Mark as Contacted
    handleUpdateLeadStatus(currentLead.id, 'Contacted');

    // Increment count
    setSessionSentCount((prev) => prev + 1);

    // Trigger Anti-Ban countdown delay before next lead
    setStepperCountdown(stepperPacingSeconds);
  };

  // Countdown timer effect
  useEffect(() => {
    if (stepperCountdown <= 0) return;
    const timer = setInterval(() => {
      setStepperCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [stepperCountdown]);

  // AI Marketing Generator
  const handleGenerateMarketing = async () => {
    setIsGeneratingMarketing(true);
    try {
      const res = await fetch('/api/marketing/special-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedCalendarDate,
          businessName: currentUserStatus?.name || 'Our Store',
          businessType: currentUserStatus?.category || searchCategory,
          phone: activeUserMobile || '9160000000',
          customInstructions: `Topic: ${marketingTopic}. Language: ${marketingLanguage}`,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setGeneratedMarketingText(data.marketingMessage || data.occasion || 'Greetings from our store!');
        triggerToast('✓ AI Marketing message generated successfully!');
      } else {
        throw new Error('Failed to generate');
      }
    } catch (e) {
      setGeneratedMarketingText(
        `🎉 శ్రీ శుభకృత్ నామ సంవత్సర శుభాకాంక్షలు!\n\nమా వద్ద ఉత్తమ నాణ్యమైన ఉత్పత్తులు హోల్‌సేల్ ధరలకే లభించును.\nసంప్రదించండి: +91 ${activeUserMobile || '9160000000'}\n(మీ వ్యాపార విశ్వసనీయ భాగస్వామి)`
      );
      triggerToast('Generated festival marketing message!');
    } finally {
      setIsGeneratingMarketing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border-2 border-emerald-500 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-fade-in text-xs font-bold">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></div>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Commercial License & Subscription Status Bar */}
      <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 border-b border-indigo-900/60 px-4 py-2 text-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              PRO COMMERCIAL SaaS
            </span>
            <span className="font-bold text-slate-300">Plan:</span>
            {currentUserStatus?.isSubscribed ? (
              <span className="text-emerald-400 font-extrabold flex items-center gap-1">
                🟢 Active ({currentUserStatus.daysLeft} Calendar Days Left)
              </span>
            ) : currentUserStatus?.status === 'pending' ? (
              <span className="text-amber-400 font-extrabold flex items-center gap-1">
                🟡 Payment Verification Pending (Admin Approving)
              </span>
            ) : (
              <span className="text-rose-400 font-extrabold flex items-center gap-1">
                🔴 Inactive / Validity Expired (Pay ₹499 to Unlock)
              </span>
            )}
            <span className="hidden md:inline text-slate-400">• Fee: ₹499 / Month (30 Days Auto-Lock)</span>
          </div>

          <div className="flex items-center gap-2">
            {!currentUserStatus?.isSubscribed ? (
              <button
                onClick={() => setShowSubscriptionModal(true)}
                className="px-3.5 py-1 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black rounded-lg text-xs shadow-md transition cursor-pointer flex items-center gap-1.5"
              >
                <span>⚡ Pay ₹499 &amp; Activate 30 Days</span>
              </button>
            ) : (
              <button
                onClick={() => setShowSubscriptionModal(true)}
                className="px-3 py-1 bg-indigo-900/60 hover:bg-indigo-900 text-indigo-200 border border-indigo-700/50 rounded-lg text-xs font-bold cursor-pointer"
              >
                Renew Plan (₹499)
              </button>
            )}

            <button
              onClick={() => setShowOwnerModal(true)}
              className="px-3 py-1 bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-500/40 rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1"
              title="Master Admin License Panel"
            >
              <Crown className="w-3.5 h-3.5" />
              <span>Owner Admin</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header className="bg-slate-900/90 backdrop-blur-md sticky top-0 z-30 border-b border-slate-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-indigo-600 shadow-md flex items-center justify-center p-1.5 shrink-0 text-white font-black text-sm">
                <ShieldCheck className="w-6 h-6 text-emerald-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-black tracking-tight text-white leading-none">
                    Man Thru – Anti-Ban WhatsApp Lead &amp; Outreach Engine
                  </h1>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  100% Online • Serial Enabled (#1–#100) • Safe 100–200 WhatsApp Messages Daily
                </p>
              </div>
            </div>

            {/* User Account Pill */}
            <div className="flex items-center gap-2">
              {activeUserMobile ? (
                <div className="flex items-center gap-2 bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-700 text-xs">
                  <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                  <span className="font-bold text-white">+91 {activeUserMobile}</span>
                  <span className="text-slate-400">({currentUserStatus?.name || 'User'})</span>
                  <button
                    onClick={handleUserLogout}
                    className="ml-2 text-rose-400 hover:text-rose-300 font-bold cursor-pointer"
                    title="Logout"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md transition cursor-pointer"
                >
                  Login / Register
                </button>
              )}
            </div>
          </div>

          {/* Navigation Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 text-xs">
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
              <button
                onClick={() => setActiveTab('finder')}
                className={`px-3.5 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'finder'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                <span>Find Leads (Up to 100)</span>
              </button>

              <button
                onClick={() => setActiveTab('leads')}
                className={`px-3.5 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'leads'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Leads CRM Table ({leads.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('calendar')}
                className={`px-3.5 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'calendar'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                <span>Calendar &amp; Follow-ups</span>
              </button>

              <button
                onClick={() => setActiveTab('marketing')}
                className={`px-3.5 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'marketing'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>AI Festival Studio</span>
              </button>

              <button
                onClick={() => setActiveTab('about')}
                className={`px-3.5 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${activeTab === 'about' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'}`}
              >
                <User className="w-3.5 h-3.5" />
                <span>About Us</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAntiBanModal(true)}
                className="px-3 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>🛡️ Anti-Ban Shield Guide</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 w-full flex-1">
        {/* Inactive Subscription Warning Banner */}
        {!currentUserStatus?.isSubscribed && (
          <div className="mb-6 p-4 bg-gradient-to-r from-rose-950 via-slate-900 to-amber-950 border-2 border-rose-500/70 rounded-3xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center font-bold text-lg shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-rose-200">
                  సబ్‌స్క్రిప్షన్ అన్‌లాక్ చేయండి (Subscription Inactive / Expired)
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  లీడ్స్ శోధన, AI ఆటోపైలట్ మరియు వాట్సాప్ ఔట్‌రీచ్ ఆప్షన్లు పూర్తిగా అన్‌లాక్ చేయడానికి నెలకు ₹499 పేమెంట్ చేయండి.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowSubscriptionModal(true)}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black rounded-xl text-xs shadow-lg transition cursor-pointer shrink-0"
            >
              💳 Pay ₹499 / View QR Code
            </button>
          </div>
        )}

        {/* TAB 1: FIND LEADS (UP TO 100 VERIFIED CONTACTS) */}
        {activeTab === 'finder' && (
          <div className="space-y-6">


            <div className="relative bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
              {/* Lock Overlay if Unsubscribed */}
              {!currentUserStatus?.isSubscribed && (
                <div className="absolute inset-0 z-20 bg-slate-950/85 backdrop-blur-xs rounded-3xl flex flex-col items-center justify-center p-6 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-rose-600/20 text-rose-400 border border-rose-500/40 flex items-center justify-center">
                    <Lock className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-black text-white">
                    🔒 లీడ్ ఫైండర్ లాక్ చేయబడింది (Lead Finder Locked)
                  </h3>
                  <p className="text-xs text-slate-300 max-w-md">
                    ఈ ఆప్షన్ ద్వారా మీరు ఏరియా వారీగా 100 వరకు ఖచ్చితమైన ఫోన్ నంబర్లు ఉన్న లీడ్స్ పొందవచ్చు. దీని కోసం నెలకు ₹499 సబ్‌స్క్రిప్షన్ యాక్టివేట్ చేసుకోండి.
                  </p>
                  <button
                    onClick={() => setShowSubscriptionModal(true)}
                    className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black rounded-xl text-xs shadow-lg transition cursor-pointer"
                  >
                    Unlock Lead Finder (Pay ₹499)
                  </button>
                </div>
              )}

              <div className="space-y-1 mb-5">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black text-white">
                    Zero-Spillover Business Lead Scanner (100 Leads Multi-Page Engine)
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    High Volume
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Select how many leads you need (20, 50, or 100 leads). Google Places API will continuously scan complementary sub-queries and return only businesses with valid verified phone numbers.
                </p>
              </div>

              <form onSubmit={handleSearchLeads} className="space-y-4">
              <div className="mb-4 rounded-2xl border border-indigo-500/40 bg-indigo-950/30 p-3 space-y-2">
                <label className="block text-xs font-bold text-indigo-200">Paste Link — Google Maps</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input type="url" value={mapsPasteLink} onChange={(e) => setMapsPasteLink(e.target.value)} placeholder="Paste Google Maps search link here" className="min-w-0 flex-1 px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-indigo-400" disabled={!currentUserStatus?.isSubscribed || isSearching} />
                  <button type="button" onClick={handlePasteMapsLink} disabled={!currentUserStatus?.isSubscribed || isSearching || !mapsPasteLink.trim()} className="px-4 py-2.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white font-black rounded-xl text-xs cursor-pointer">Paste Link &amp; Find Leads</button>
                </div>
                <p className="text-[11px] text-slate-400">Reads the area/category from a Google Maps search URL and uses Man Thru’s configured search provider. Only returned listings with phone numbers can be added; a Maps URL itself does not contain every shop’s details.</p>
              </div>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  {/* Category */}
                  <div className="md:col-span-5 space-y-1">
                    <label className="block text-xs font-bold text-slate-300">
                      Target Business Category:
                    </label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        value={searchCategory}
                        onChange={(e) => setSearchCategory(e.target.value)}
                        placeholder="e.g. Wholesale Chilli Powder, Cell Mobile Shops, Kirana Stores..."
                        className="w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-semibold text-white focus:outline-hidden focus:border-emerald-500"
                        disabled={!currentUserStatus?.isSubscribed || isSearching}
                      />
                    </div>
                  </div>

                  {/* Target Area */}
                  <div className="md:col-span-4 space-y-1">
                    <label className="block text-xs font-bold text-slate-300">
                      Target Area / City / Neighborhood:
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        value={searchArea}
                        onChange={(e) => setSearchArea(e.target.value)}
                        placeholder="e.g. Guntur, Vijayawada, Kukatpally, Vizag..."
                        className="w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-semibold text-white focus:outline-hidden focus:border-emerald-500"
                        disabled={!currentUserStatus?.isSubscribed || isSearching}
                      />
                    </div>
                  </div>

                  {/* Batch Size Selector (20, 50, 100) */}
                  <div className="md:col-span-3 space-y-1">
                    <label className="block text-xs font-bold text-slate-300">
                      Batch Size (Target Leads):
                    </label>
                    <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 border border-slate-700 rounded-xl">
                      {[20, 50, 100].map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setSearchBatchSize(size)}
                          className={`py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                            searchBatchSize === size
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Strict verified phone filter enabled (Only records with valid mobile/phones shown)</span>
                  </div>

                  <button
                    type="submit"
                    disabled={!currentUserStatus?.isSubscribed || isSearching}
                    className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-xl text-xs shadow-md transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
                  >
                    {isSearching ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                        <span>Scanning {searchBatchSize} Places...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4 text-slate-950" />
                        <span>Find {searchBatchSize} Verified Leads</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Quick Leads Snapshot */}
            {leads.length > 0 && (
              <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Current Database: {leads.length} Verified Leads Loaded
                    </h3>
                    <p className="text-xs text-slate-400">
                      Leads are permanently saved in your account. You can launch WhatsApp outreach or view the CRM table.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleStartStepper}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Launch WhatsApp Outreach Stepper</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('leads')}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>View Full Table (#1–#{leads.length})</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Founder & CEO profile is intentionally visible on the home dashboard */}
            <section className="bg-slate-900 border border-slate-700 rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
              <img src={founderPhoto} alt="Manthru Naik, Founder and CEO of Man Thru" className="w-28 h-28 sm:w-32 sm:h-32 object-cover object-top rounded-2xl border-2 border-emerald-400 shadow-lg shrink-0" />
              <div className="text-center sm:text-left">
                <p className="text-xs font-black tracking-widest uppercase text-emerald-300 mb-1">Founder &amp; CEO</p>
                <h2 className="text-xl sm:text-2xl font-black text-white mb-1">Manthru Naik</h2>
                <p className="text-sm text-slate-300">Leading Man Thru — Business Discovery &amp; B2B Outreach Engine.</p>
                <button onClick={() => setActiveTab('about')} className="mt-3 inline-flex rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-2">About Man Thru →</button>
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: CRM LEADS TABLE WITH SERIAL NUMBERS */}
        {activeTab === 'leads' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 p-4 border border-slate-800 rounded-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[220px]">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search by name, phone, area..."
                    value={leadFilterText}
                    onChange={(e) => setLeadFilterText(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-semibold text-white focus:outline-hidden"
                  />
                </div>

                <div className="flex items-center gap-1 bg-slate-950 p-1 border border-slate-700 rounded-xl text-xs">
                  {['All', 'New', 'Contacted', 'Follow Up', 'Qualified', 'Converted'].map((st) => (
                    <button
                      key={st}
                      onClick={() => setLeadStatusFilter(st)}
                      className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer text-[11px] ${
                        leadStatusFilter === st
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleStartStepper}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Outreach Stepper</span>
                </button>

                <button
                  onClick={handleExportCSV}
                  className="px-3.5 py-1.5 bg-indigo-900/60 hover:bg-indigo-900 text-indigo-200 border border-indigo-700/50 rounded-xl font-bold text-xs cursor-pointer flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={handleExportWhatsAppCSV}
                  className="px-3.5 py-1.5 bg-emerald-900/60 hover:bg-emerald-900 text-emerald-200 border border-emerald-700/50 rounded-xl font-bold text-xs cursor-pointer flex items-center gap-1.5"
                  title="Exports filtered leads in Excel-friendly Phone/Message column order. Message and consent are left blank for review."
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Excel Outreach Export</span>
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="border border-slate-800 rounded-3xl overflow-hidden bg-slate-900 shadow-xl">
              <div className="overflow-x-auto max-h-[650px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 text-[11px]">
                      <th className="p-3 w-12 text-center">S.No</th>
                      <th className="p-3">Business Name</th>
                      <th className="p-3">Verified WhatsApp / Phone</th>
                      <th className="p-3">Category &amp; Area</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Follow-Up Date</th>
                      <th className="p-3 text-right">Outreach</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredLeads.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-slate-400">
                          {leads.length === 0 ? (
                            <div className="space-y-2">
                              <p className="text-sm font-bold text-slate-300">No leads found in this account yet.</p>
                              <button
                                onClick={() => setActiveTab('finder')}
                                className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl text-xs cursor-pointer"
                              >
                                Go to Lead Finder
                              </button>
                            </div>
                          ) : (
                            'No leads match the current search filter.'
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredLeads.map((lead, idx) => (
                        <tr key={lead.id} className="hover:bg-slate-800/50 transition">
                          <td className="p-3 text-center font-mono font-bold text-slate-400">
                            #{idx + 1}
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-white text-xs">{lead.name}</div>
                            <div className="text-[11px] text-slate-400 line-clamp-1">{lead.address}</div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5 font-mono font-bold text-emerald-400">
                              <Phone className="w-3.5 h-3.5 text-emerald-400" />
                              <span>{lead.phone}</span>
                            </div>
                          </td>
                          <td className="p-3 text-slate-300">
                            <div className="font-semibold text-slate-200">{lead.category}</div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-500" />
                              <span>{lead.area}</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <select
                              value={lead.status}
                              onChange={(e) =>
                                handleUpdateLeadStatus(lead.id, e.target.value as BusinessLead['status'])
                              }
                              className="px-2 py-1 bg-slate-950 border border-slate-700 rounded-lg text-[11px] font-bold text-slate-200 focus:outline-hidden"
                            >
                              <option value="New">New</option>
                              <option value="Contacted">Contacted</option>
                              <option value="Follow Up">Follow Up</option>
                              <option value="Qualified">Qualified</option>
                              <option value="Converted">Converted</option>
                              <option value="Not Interested">Not Interested</option>
                            </select>
                          </td>
                          <td className="p-3">
                            <input
                              type="date"
                              value={lead.followUpDate || ''}
                              onChange={(e) => handleUpdateFollowUpDate(lead.id, e.target.value)}
                              className="px-2 py-1 bg-slate-950 border border-slate-700 rounded-lg text-[11px] font-bold text-slate-300"
                            />
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  const rawDigits = lead.phone.replace(/\D/g, '');
                                  let cleanPhone = rawDigits;
                                  if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
                                  const msg = encodeURIComponent(
                                    `నమస్కారం ${lead.name} గారు! మీ బిజినెస్ వివరాలు చూశాను. మా దగ్గర హోల్‌సేల్ స్పైసెస్ & మిర్చి పొడి ఉత్తమ ధరలకు లభిస్తాయి.`
                                  );
                                  window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${msg}`, '_blank');
                                  handleUpdateLeadStatus(lead.id, 'Contacted');
                                }}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-[10px] cursor-pointer flex items-center gap-1"
                                title="Open WhatsApp Chat"
                              >
                                <Send className="w-3 h-3" />
                                <span>WhatsApp</span>
                              </button>

                              <button
                                onClick={() => handleDeleteLead(lead.id)}
                                className="p-1 text-slate-500 hover:text-rose-400 rounded-lg cursor-pointer"
                                title="Remove"
                              >
                                &times;
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CALENDAR & FOLLOW-UPS */}
        {activeTab === 'calendar' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-black text-white flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-indigo-400" />
                    <span>Activity Calendar &amp; Lead Follow-Up System</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Your scheduled leads and follow-ups are securely preserved in your permanent account.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-300">Select Date:</span>
                  <input
                    type="date"
                    value={selectedCalendarDate}
                    onChange={(e) => setSelectedCalendarDate(e.target.value)}
                    className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white"
                  />
                </div>
              </div>

              {/* Follow-ups for selected date */}
              <div className="border border-slate-800 rounded-2xl p-4 bg-slate-950 space-y-3">
                <h3 className="text-xs font-bold text-indigo-300 flex items-center justify-between">
                  <span>Follow-ups Scheduled for {selectedCalendarDate}:</span>
                  <span className="text-slate-400">
                    {leads.filter((l) => l.followUpDate === selectedCalendarDate).length} Leads
                  </span>
                </h3>

                {leads.filter((l) => l.followUpDate === selectedCalendarDate).length === 0 ? (
                  <p className="text-xs text-slate-500 py-3 text-center">
                    No follow-ups scheduled for this date. You can set follow-up dates in the Leads Table.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {leads
                      .filter((l) => l.followUpDate === selectedCalendarDate)
                      .map((lead) => (
                        <div
                          key={lead.id}
                          className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1 text-xs"
                        >
                          <div className="font-bold text-white">{lead.name}</div>
                          <div className="text-emerald-400 font-mono text-[11px]">{lead.phone}</div>
                          <div className="text-slate-400 text-[11px]">{lead.area}</div>
                          <button
                            onClick={() => {
                              const rawDigits = lead.phone.replace(/\D/g, '');
                              let cleanPhone = rawDigits;
                              if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
                              window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}`, '_blank');
                            }}
                            className="w-full mt-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-[10px] cursor-pointer"
                          >
                            Call / WhatsApp Now
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: AI FESTIVAL & MARKETING STUDIO */}
        {activeTab === 'marketing' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <div>
                <h2 className="text-base font-black text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-300" />
                  <span>AI Festival &amp; Daily Broadcast Marketing Studio</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Generate instant Telugu &amp; English festival greetings blended with your business product offer to broadcast to your customers!
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Festival / Marketing Topic:
                    </label>
                    <input
                      type="text"
                      value={marketingTopic}
                      onChange={(e) => setMarketingTopic(e.target.value)}
                      placeholder="e.g. Diwali Offer, Ugadi Special, New Stock Arrival..."
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Language:</label>
                    <div className="flex gap-2">
                      {(['Telugu', 'English'] as const).map((lang) => (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => setMarketingLanguage(lang)}
                          className={`flex-1 py-1.5 rounded-xl font-bold text-xs cursor-pointer ${
                            marketingLanguage === lang
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-950 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {lang}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleGenerateMarketing}
                    disabled={isGeneratingMarketing}
                    className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 font-black rounded-xl text-xs shadow-md transition cursor-pointer"
                  >
                    {isGeneratingMarketing ? 'Generating with AI...' : 'Generate Marketing Copy'}
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-300">
                    Generated Ready-to-Send WhatsApp Status &amp; Copy:
                  </label>
                  <textarea
                    rows={7}
                    value={generatedMarketingText}
                    onChange={(e) => setGeneratedMarketingText(e.target.value)}
                    placeholder="Click 'Generate Marketing Copy' to create engaging Telugu wishes + business offer..."
                    className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-xs font-medium text-white focus:outline-hidden"
                  />
                  {generatedMarketingText && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(generatedMarketingText);
                        triggerToast('Copied marketing text to clipboard!');
                      }}
                      className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy to Clipboard</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* WHATSAPP ANTI-BAN OUTREACH STEPPER MODAL */}
      {isStepperOpen && filteredLeads[stepperIndex] && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-emerald-500 max-w-lg w-full p-6 rounded-3xl shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-black">
                  #{stepperIndex + 1}
                </span>
                <div>
                  <h3 className="text-sm font-black text-white">
                    Anti-Ban WhatsApp Outreach ({stepperIndex + 1} / {filteredLeads.length})
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Randomized Spintax + Human Pacing Delay
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsStepperOpen(false)}
                className="text-slate-400 hover:text-white text-xl font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Current Target Lead Details */}
            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
              <div className="font-bold text-white text-sm">
                {filteredLeads[stepperIndex].name}
              </div>
              <div className="font-mono font-bold text-emerald-400">
                {filteredLeads[stepperIndex].phone}
              </div>
              <div className="text-[11px] text-slate-400">
                {filteredLeads[stepperIndex].area} • {filteredLeads[stepperIndex].category}
              </div>
            </div>

            {/* Custom Pitch Template input */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-300">
                Pitch Template (Use &#123;name&#125; for business name):
              </label>
              <textarea
                rows={3}
                value={customPitchText}
                onChange={(e) => setCustomPitchText(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden"
              />
            </div>

            {/* Preview of Anti-Ban Randomized Message */}
            <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl text-[11px] text-emerald-200 space-y-1">
              <div className="font-bold text-emerald-300 flex items-center justify-between">
                <span>Dynamic Spintax Preview:</span>
                <span className="text-[10px] text-emerald-400">Safe Opt-Out Tag Appended</span>
              </div>
              <p className="whitespace-pre-line font-sans">
                {buildAntiBanMessage(filteredLeads[stepperIndex])}
              </p>
            </div>

            {/* Anti-Ban Human Pacing Countdown Delay */}
            {stepperCountdown > 0 && (
              <div className="p-3 bg-amber-950/60 border border-amber-500/50 rounded-2xl text-center space-y-1 animate-pulse">
                <div className="font-bold text-amber-300 text-xs flex items-center justify-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>🛡️ Anti-Ban Human Pacing: Next message unlocks in {stepperCountdown}s...</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-400 h-full transition-all duration-1000"
                    style={{ width: `${(stepperCountdown / stepperPacingSeconds) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Session Count & Cool-down Alert */}
            {sessionSentCount > 0 && sessionSentCount % 25 === 0 && (
              <div className="p-2.5 bg-indigo-950/80 border border-indigo-500/50 rounded-xl text-[11px] text-indigo-200">
                💡 <strong>Safety Advisory:</strong> You have sent 25 messages in this session. Taking a 5-minute break is recommended to keep your WhatsApp account 100% safe.
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                disabled={stepperCountdown > 0}
                onClick={handleSendCurrentStepper}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>
                  {stepperCountdown > 0
                    ? `Please wait ${stepperCountdown}s...`
                    : `Send to ${filteredLeads[stepperIndex].name}`}
                </span>
              </button>

              <button
                onClick={() => {
                  if (stepperIndex < filteredLeads.length - 1) {
                    setStepperIndex((prev) => prev + 1);
                    setStepperCountdown(0);
                  } else {
                    setIsStepperOpen(false);
                    triggerToast('Outreach batch completed!');
                  }
                }}
                className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs cursor-pointer"
              >
                Skip / Next
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'about' && (
        <div className="space-y-6">
          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 flex flex-col sm:flex-row items-center gap-5">
            <img src={founderPhoto} alt="Manthru Naik, Founder and CEO of Man Thru" className="w-36 h-36 sm:w-44 sm:h-44 object-cover object-top rounded-2xl border-2 border-emerald-400 shadow-md shrink-0" />
            <div className="text-center sm:text-left">
              <p className="text-xs font-black tracking-widest uppercase text-emerald-700 mb-1">Founder &amp; CEO</p>
              <h2 className="text-2xl font-black text-slate-900 mb-2">Manthru Naik</h2>
              <p className="text-sm text-slate-600 leading-relaxed">Founder of Man Thru, focused on making local business discovery, lead organization, and respectful B2B outreach easier for businesses.</p>
            </div>
          </section>

          <section className="bg-slate-900 border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-xl">
            <p className="text-xs font-black tracking-widest uppercase text-emerald-300 mb-2">About Man Thru</p>
            <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">Man Thru – Business Discovery &amp; B2B Outreach Engine</h2>
            <p className="text-sm sm:text-base leading-relaxed text-slate-300 max-w-4xl">Man Thru helps businesses discover relevant public business listings by locality and category, organize leads, manage follow-ups, and prepare respectful B2B outreach. Search results must come from configured real data providers; the application must never invent businesses or contact details.</p>
          </section>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <article className="bg-white text-slate-900 rounded-2xl border border-slate-200 p-5"><h3 className="font-black mb-2">Business Discovery</h3><p className="text-sm text-slate-600 leading-relaxed">Search by locality and category, then review available public business details and source information.</p></article>
            <article className="bg-white text-slate-900 rounded-2xl border border-slate-200 p-5"><h3 className="font-black mb-2">Lead Management</h3><p className="text-sm text-slate-600 leading-relaxed">Organize leads, track outreach status, and manage follow-up activities in one workspace.</p></article>
            <article className="bg-white text-slate-900 rounded-2xl border border-slate-200 p-5"><h3 className="font-black mb-2">Responsible Outreach</h3><p className="text-sm text-slate-600 leading-relaxed">Prepare relevant business introductions, respect opt-out requests, and use messaging integrations only when properly configured.</p></article>
          </div>
          <section className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-5"><h3 className="font-black text-emerald-300 mb-2">Our Commitment</h3><p className="text-sm text-slate-300 leading-relaxed">Data availability depends on the connected provider and its permissions; contact details are shown only when supplied by a legitimate source.</p></section>
        </div>
      )}

      {/* ANTI-BAN SHIELD GUIDE MODAL */}
      {showAntiBanModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-emerald-500 max-w-lg w-full p-6 rounded-3xl shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
                <h3 className="text-base font-black text-white">
                  WhatsApp 100–200 డైలీ సేఫ్ ఔట్‌రీచ్ గైడ్ (Anti-Ban Protocol)
                </h3>
              </div>
              <button
                onClick={() => setShowAntiBanModal(false)}
                className="text-slate-400 hover:text-white text-xl font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-slate-300 leading-relaxed">
              <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl space-y-1">
                <h4 className="font-bold text-emerald-300">వాట్సాప్ ఎందుకు బ్యాన్ చేస్తుంది? (Why Bans Happen):</h4>
                <p className="text-[11px]">
                  ఒకే మెసేజ్‌ను సెకన్ల వ్యవధిలో 50-60 మందికి కాపీ-పేస్ట్ చేస్తే వాట్సాప్ అల్గారిథమ్ దాన్ని బాట్ స్పామ్‌గా గుర్తిస్తుంది. అలాగే అవతలి వ్యక్తులు "Report &amp; Block" చేస్తే వెంటనే 24 గంటల బ్యాన్ పడుతుంది.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-white">ఈ టూల్ బ్యాన్ కాకుండా ఎలా కాపాడుతుంది? (Our 4-Layer Shield):</h4>
                <ul className="space-y-1.5 text-[11px] list-disc list-inside">
                  <li>
                    <strong>డైనమిక్ స్పింటాక్స్ (Spintax):</strong> ప్రతి మెసేజ్ గ్రీటింగ్ మరియు రిఫరెన్స్ కోడ్ (#MT-XXXX) మారుతుంది, దాంతో వాట్సాప్ సర్వర్‌కు ఏ రెండు మెసేజ్‌లు ఒకేలా కనిపించవు.
                  </li>
                  <li>
                    <strong>హ్యూమన్ పేసింగ్ టైమర్ (15-20 సెకన్ల డీలే):</strong> ఒక మెసేజ్ తర్వాత మరొకటి పంపడానికి 15 సెకన్ల విరామం ఇస్తుంది.
                  </li>
                  <li>
                    <strong>ఆప్ట్-అవుట్ సిగ్నేచర్:</strong> మెసేజ్ చివర <em>"ఈ మెసేజ్ అవసరం లేకపోతే STOP అని రిప్లై ఇవ్వండి"</em> అని ఉంటుంది. దీనివల్ల కస్టమర్లు రిపోర్ట్ చేయకుండా ఆగిపోతారు.
                  </li>
                  <li>
                    <strong>బ్యాచ్ కూల్‌డౌన్:</strong> ప్రతి 25 మెసేజ్‌లకు 5 నిమిషాల బ్రేక్ తీసుకోవడం వల్ల రోజుకు 100 నుండి 200 మెసేజ్‌లు ఎలాంటి బ్యాన్ భయం లేకుండా పంపవచ్చు.
                  </li>
                </ul>
              </div>
            </div>

            <button
              onClick={() => setShowAntiBanModal(false)}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md"
            >
              అర్థమైంది (Close Guide)
            </button>
          </div>
        </div>
      )}

      {/* SUBSCRIPTION, AUTH, & OWNER ADMIN MODALS */}
      <SubscriptionAndAuthModals
        currentUserStatus={currentUserStatus}
        activeUserMobile={activeUserMobile}
        onUserLogin={handleUserLogin}
        onUserLogout={handleUserLogout}
        showAuthModal={showAuthModal}
        setShowAuthModal={setShowAuthModal}
        showSubscriptionModal={showSubscriptionModal}
        setShowSubscriptionModal={setShowSubscriptionModal}
        showOwnerModal={showOwnerModal}
        setShowOwnerModal={setShowOwnerModal}
        triggerToast={triggerToast}
        onRefreshStatus={() => {
          if (activeUserMobile) fetchUserStatus(activeUserMobile);
        }}
      />
    </div>
  );
}
