import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Phone, Lock, Key, RefreshCw, Send, CheckCircle2, UserCheck, AlertTriangle } from 'lucide-react';

interface Props {
  currentUserStatus: any;
  activeUserMobile: string;
  onUserLogin: (user: any) => void;
  onUserLogout: () => void;
  showAuthModal: boolean;
  setShowAuthModal: (v: boolean) => void;
  showSubscriptionModal: boolean;
  setShowSubscriptionModal: (v: boolean) => void;
  showOwnerModal: boolean;
  setShowOwnerModal: (v: boolean) => void;
  triggerToast: (msg: string) => void;
  onRefreshStatus: () => void;
}

export function SubscriptionAndAuthModals({
  currentUserStatus,
  activeUserMobile,
  onUserLogin,
  onUserLogout,
  showAuthModal,
  setShowAuthModal,
  showSubscriptionModal,
  setShowSubscriptionModal,
  showOwnerModal,
  setShowOwnerModal,
  triggerToast,
  onRefreshStatus,
}: Props) {
  // Auth Tab State
  const [authTab, setAuthTab] = useState<'login' | 'otp' | 'register' | 'reset'>('login');
  const [mobileInput, setMobileInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [categoryInput, setCategoryInput] = useState('Kirana / Retail');
  const [otpInput, setOtpInput] = useState('');
  const [simulatedOtp, setSimulatedOtp] = useState<string | null>(null);
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');

  // UTR and Screenshot submission
  const [utrInput, setUtrInput] = useState('');
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);
  const [previewingProofImg, setPreviewingProofImg] = useState<string | null>(null);

  // Dynamic Public & Admin Settings
  const [publicSettings, setPublicSettings] = useState({
    ownerWhatsApp: '919160000000',
    upiId: 'manthrunaik91600@upi',
    upiName: 'Man Thru',
    monthlyPrice: 499,
    qrImageUrl: '',
  });

  // Owner Panel State
  const [ownerPin, setOwnerPin] = useState('');
  const [isOwnerAuthorized, setIsOwnerAuthorized] = useState(false);
  const [adminTab, setAdminTab] = useState<'subscribers' | 'settings'>('subscribers');
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [generatedKey, setGeneratedKey] = useState('');
  const [adminSearch, setAdminSearch] = useState('');
  const [editOwnerWhatsApp, setEditOwnerWhatsApp] = useState('');
  const [editUpiId, setEditUpiId] = useState('');
  const [editQrImage, setEditQrImage] = useState('');

  // Fetch Public Settings on mount
  useEffect(() => {
    fetch('/api/settings/public')
      .then((r) => r.json())
      .then((data) => {
        if (data && data.ownerWhatsApp) {
          setPublicSettings(data);
          setEditOwnerWhatsApp(data.ownerWhatsApp);
          setEditUpiId(data.upiId);
          setEditQrImage(data.qrImageUrl || '');
        }
      })
      .catch(() => {});
  }, []);

  // 1-Click WhatsApp payment screenshot sender
  const handleSendPaymentScreenshotWhatsApp = () => {
    const mobile = activeUserMobile || mobileInput || 'Customer';
    const cleanOwnerNum = (publicSettings.ownerWhatsApp || '919160000000').replace(/\D/g, '');
    const text = encodeURIComponent(
      `హలో అడ్మిన్! నా మొబైల్ నంబర్: +91 ${mobile}.\nనేను Man Thru B2B Lead Tool 30-రోజుల సబ్‌స్క్రిప్షన్ కోసం ₹${publicSettings.monthlyPrice} పే చేశాను.\nపేమెంట్ స్క్రీన్‌షాట్ ఇక్కడ అటాచ్ చేస్తున్నాను.\nదయచేసి నా అకౌంట్ త్వరగా 30 రోజులు యాక్టివేట్ చేయండి! 🙏`
    );
    window.open(`https://api.whatsapp.com/send?phone=${cleanOwnerNum}&text=${text}`, '_blank');
    triggerToast(`Opening WhatsApp to send payment screenshot to Admin (+${cleanOwnerNum})...`);
  };

  const handleScreenshotFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      triggerToast('Image size should be under 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setScreenshotDataUrl(reader.result as string);
      triggerToast('✓ Screenshot attached! Ready to submit.');
    };
    reader.readAsDataURL(file);
  };

  // Auth actions
  const handleLoginWithPin = async () => {
    if (!mobileInput.trim() || !pinInput.trim()) {
      triggerToast('Please enter your 10-digit mobile number and PIN.');
      return;
    }
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: mobileInput, pin: pinInput }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        onUserLogin(data.user);
        setShowAuthModal(false);
        triggerToast('✓ లాగిన్ విజయవంతమైంది! Welcome back.');
      } else {
        triggerToast(data.message || 'Login failed. Please check your credentials.');
      }
    } catch (e: any) {
      triggerToast('Network error during login.');
    }
  };

  const handleRequestOtp = async () => {
    if (!mobileInput.trim() || mobileInput.replace(/\D/g, '').length < 10) {
      triggerToast('Please enter a valid 10-digit mobile number.');
      return;
    }
    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: mobileInput }),
      });
      const data = await res.json();
      if (data.success) {
        setSimulatedOtp(data.otp);
        setOtpInput(data.otp);
        triggerToast(`OTP Generated: ${data.otp}`);
      } else {
        triggerToast(data.message || 'Failed to generate OTP.');
      }
    } catch (e) {
      triggerToast('Error generating OTP.');
    }
  };

  const handleVerifyOtp = async () => {
    if (!mobileInput.trim() || !otpInput.trim()) {
      triggerToast('Please enter mobile number and 6-digit OTP.');
      return;
    }
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: mobileInput, otp: otpInput }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        onUserLogin(data.user);
        setShowAuthModal(false);
        triggerToast('✓ OTP Verified! Successfully logged in.');
      } else {
        triggerToast(data.message || 'Invalid or expired OTP.');
      }
    } catch (e) {
      triggerToast('Error verifying OTP.');
    }
  };

  const handleRegisterNewAccount = async () => {
    if (!mobileInput.trim() || !nameInput.trim() || pinInput.length < 4) {
      triggerToast('Please fill mobile number, business name and 4-digit PIN.');
      return;
    }
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: mobileInput,
          name: nameInput,
          category: categoryInput,
          pin: pinInput,
        }),
      });
      const data = await res.json();
      if (data.success) {
        triggerToast(data.message);
        setAuthTab('login');
      } else {
        triggerToast(data.message || 'Registration failed.');
      }
    } catch (e) {
      triggerToast('Error during registration.');
    }
  };

  const handleResetPin = async () => {
    if (!mobileInput.trim() || newPinInput.length < 4 || newPinInput !== confirmPinInput) {
      triggerToast('Please enter mobile and matching 4-digit PINs.');
      return;
    }
    try {
      const res = await fetch('/api/auth/reset-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: mobileInput, newPin: newPinInput }),
      });
      const data = await res.json();
      triggerToast(data.message);
      if (data.success) setAuthTab('login');
    } catch (e) {
      triggerToast('Error resetting PIN.');
    }
  };

  const handleSubmitUtr = async () => {
    if (!utrInput.trim() && !screenshotDataUrl) {
      triggerToast('Please upload payment screenshot or enter UPI UTR number.');
      return;
    }
    try {
      const res = await fetch('/api/payment/submit-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: activeUserMobile,
          utr: utrInput || 'Attached Screenshot',
          screenshot: screenshotDataUrl || undefined,
        }),
      });
      const data = await res.json();
      triggerToast(data.message || 'Payment proof submitted for Admin approval!');
      setShowSubscriptionModal(false);
      onRefreshStatus();
    } catch (e) {
      triggerToast('Error submitting payment proof.');
    }
  };

  const handleSaveAdminSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPin: ownerPin || '9160',
          settings: {
            ownerWhatsApp: editOwnerWhatsApp,
            upiId: editUpiId,
            qrImageUrl: editQrImage,
          },
        }),
      });
      const data = await res.json();
      setPublicSettings(data);
      triggerToast('✓ Admin QR & WhatsApp Settings Saved!');
    } catch (e) {
      triggerToast('Failed to save admin settings.');
    }
  };

  const handleAdminQrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setEditQrImage(reader.result as string);
      triggerToast('Custom QR image loaded. Click "Save Settings" to apply.');
    };
    reader.readAsDataURL(file);
  };

  // Owner admin actions
  const fetchSubscribers = async () => {
    try {
      const res = await fetch('/api/admin/subscribers?adminPin=9160');
      if (res.ok) {
        const data = await res.json();
        setSubscribers(data.subscribers || []);
      }
    } catch (e) {}
  };

  const handleVerifyOwnerPin = () => {
    if (ownerPin === '9160' || ownerPin === 'admin') {
      setIsOwnerAuthorized(true);
      fetchSubscribers();
      triggerToast('👑 Master Owner Access Verified!');
    } else {
      triggerToast('Invalid Owner PIN! Default is 9160');
    }
  };

  const handleAdminActivate = async (mobile: string, days: number = 30) => {
    try {
      const res = await fetch('/api/admin/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, days, adminPin: '9160' }),
      });
      const data = await res.json();
      triggerToast(data.message || `Activated +91 ${mobile} for ${days} days!`);
      fetchSubscribers();
      onRefreshStatus();
    } catch (e) {
      triggerToast('Error activating user.');
    }
  };

  const handleAdminDeactivate = async (mobile: string) => {
    try {
      const res = await fetch('/api/admin/deactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, adminPin: '9160' }),
      });
      const data = await res.json();
      triggerToast(data.message || `Deactivated +91 ${mobile}`);
      fetchSubscribers();
      onRefreshStatus();
    } catch (e) {
      triggerToast('Error deactivating user.');
    }
  };

  const handleGenerateKey = () => {
    const randHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    const key = `MT-30D-${randHex}`;
    setGeneratedKey(key);
    triggerToast(`Generated 30-Day Key: ${key}`);
  };

  const filteredSubscribers = subscribers.filter(s => {
    if (!adminSearch) return true;
    const q = adminSearch.toLowerCase();
    return s.mobile.includes(q) || (s.name && s.name.toLowerCase().includes(q));
  });

  return (
    <>
      {/* 1. Mobile Authentication & Registration Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border max-w-md w-full p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
                  <Phone className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Mobile Account Portal</h3>
                  <p className="text-[11px] text-slate-500">Permanent CRM Data • Lead Sync</p>
                </div>
              </div>
              {activeUserMobile ? (
                <button
                  onClick={() => setShowAuthModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              ) : (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                  Required Login
                </span>
              )}
            </div>

            {/* Current Logged In Info */}
            {activeUserMobile ? (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-950">Active Logged In:</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200 text-emerald-900">
                    +91 {activeUserMobile}
                  </span>
                </div>
                <div className="text-slate-700">
                  Business: <strong>{currentUserStatus?.name || 'My Store'}</strong>
                </div>
                <div className="text-slate-700">
                  Status:{' '}
                  {currentUserStatus?.isSubscribed ? (
                    <strong className="text-emerald-700">🟢 Active ({currentUserStatus.daysLeft}d left)</strong>
                  ) : (
                    <strong className="text-rose-700">🔴 Unpaid / Inactive</strong>
                  )}
                </div>
                <div className="flex gap-2 pt-2 border-t border-emerald-200">
                  <button
                    onClick={() => {
                      onUserLogout();
                      triggerToast('Logged out.');
                    }}
                    className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl cursor-pointer"
                  >
                    Logout
                  </button>
                  <button
                    onClick={() => {
                      setShowAuthModal(false);
                      setShowSubscriptionModal(true);
                    }}
                    className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl cursor-pointer"
                  >
                    Manage ₹499 Plan
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Auth Tabs */}
                <div className="grid grid-cols-4 p-1 bg-slate-100 rounded-xl border font-bold text-[10px] text-center">
                  <button
                    onClick={() => setAuthTab('login')}
                    className={`py-1.5 rounded-lg cursor-pointer ${
                      authTab === 'login' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    1. Login
                  </button>
                  <button
                    onClick={() => setAuthTab('otp')}
                    className={`py-1.5 rounded-lg cursor-pointer ${
                      authTab === 'otp' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    2. OTP
                  </button>
                  <button
                    onClick={() => setAuthTab('register')}
                    className={`py-1.5 rounded-lg cursor-pointer ${
                      authTab === 'register' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    3. Register
                  </button>
                  <button
                    onClick={() => setAuthTab('reset')}
                    className={`py-1.5 rounded-lg cursor-pointer ${
                      authTab === 'reset' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    4. Reset
                  </button>
                </div>

                {/* Tab 1: PIN Login */}
                {authTab === 'login' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Mobile Number:</label>
                      <input
                        type="text"
                        placeholder="10-digit mobile (e.g. 9848012345)"
                        value={mobileInput}
                        onChange={(e) => setMobileInput(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">4-Digit PIN / Password:</label>
                      <input
                        type="password"
                        placeholder="Enter 4-digit PIN"
                        value={pinInput}
                        onChange={(e) => setPinInput(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl font-bold"
                      />
                    </div>
                    <button
                      onClick={handleLoginWithPin}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition cursor-pointer"
                    >
                      Login to Account
                    </button>
                  </div>
                )}

                {/* Tab 2: Instant OTP Login */}
                {authTab === 'otp' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Mobile Number:</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="10-digit mobile"
                          value={mobileInput}
                          onChange={(e) => setMobileInput(e.target.value)}
                          className="flex-1 px-3 py-2 bg-slate-50 border rounded-xl font-bold"
                        />
                        <button
                          onClick={handleRequestOtp}
                          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl cursor-pointer"
                        >
                          Get OTP
                        </button>
                      </div>
                    </div>
                    {simulatedOtp && (
                      <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 font-mono text-[11px]">
                        ⚡ Simulated SMS OTP: <strong>{simulatedOtp}</strong>
                      </div>
                    )}
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Enter 6-Digit OTP:</label>
                      <input
                        type="text"
                        placeholder="Enter OTP received"
                        value={otpInput}
                        onChange={(e) => setOtpInput(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl font-mono font-bold text-center text-sm"
                      />
                    </div>
                    <button
                      onClick={handleVerifyOtp}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition cursor-pointer"
                    >
                      Verify OTP &amp; Login
                    </button>
                  </div>
                )}

                {/* Tab 3: Register */}
                {authTab === 'register' && (
                  <div className="space-y-2.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-0.5">Mobile Number *:</label>
                      <input
                        type="text"
                        placeholder="10-digit mobile"
                        value={mobileInput}
                        onChange={(e) => setMobileInput(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border rounded-xl font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-0.5">Business / Store Name *:</label>
                      <input
                        type="text"
                        placeholder="e.g. Sri Balaji Traders"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border rounded-xl font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-0.5">Category:</label>
                      <input
                        type="text"
                        placeholder="e.g. Spices Wholesale, Kirana"
                        value={categoryInput}
                        onChange={(e) => setCategoryInput(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border rounded-xl font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-0.5">Set 4-Digit PIN *:</label>
                      <input
                        type="password"
                        placeholder="e.g. 1234"
                        value={pinInput}
                        onChange={(e) => setPinInput(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border rounded-xl font-bold"
                      />
                    </div>
                    <button
                      onClick={handleRegisterNewAccount}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition cursor-pointer"
                    >
                      Create Account
                    </button>
                  </div>
                )}

                {/* Tab 4: Reset PIN */}
                {authTab === 'reset' && (
                  <div className="space-y-2.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-0.5">Registered Mobile:</label>
                      <input
                        type="text"
                        placeholder="10-digit mobile"
                        value={mobileInput}
                        onChange={(e) => setMobileInput(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border rounded-xl font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-0.5">New 4-Digit PIN:</label>
                      <input
                        type="password"
                        placeholder="New PIN"
                        value={newPinInput}
                        onChange={(e) => setNewPinInput(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border rounded-xl font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-0.5">Confirm New PIN:</label>
                      <input
                        type="password"
                        placeholder="Confirm PIN"
                        value={confirmPinInput}
                        onChange={(e) => setConfirmPinInput(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border rounded-xl font-bold"
                      />
                    </div>
                    <button
                      onClick={handleResetPin}
                      className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl shadow-md cursor-pointer"
                    >
                      Reset PIN &amp; Save
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. ₹499/Month Subscription & QR Modal with Direct WhatsApp Screenshot Link */}
      {showSubscriptionModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border-2 border-indigo-500 max-w-lg w-full p-6 space-y-4 text-xs my-auto max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-900 border border-indigo-300">
                  ₹499 / 30 CALENDAR DAYS
                </span>
                <h3 className="text-base font-black text-slate-900 mt-1">
                  Activate Subscription (₹499 / Month)
                </h3>
              </div>
              <button
                onClick={() => setShowSubscriptionModal(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-2xl space-y-1.5 text-indigo-950">
              <div className="flex items-center justify-between font-bold">
                <span>Account Mobile:</span>
                <span className="text-emerald-800 font-mono">+91 {activeUserMobile || 'Not Logged In'}</span>
              </div>
              <p className="text-[11px] leading-relaxed text-indigo-900">
                లీడ్స్ శోధించడం, AI ఆటోపైలట్ మరియు వాట్సాప్ ఔట్‌రీచ్ అన్‌లాక్ చేయడానికి క్రింది QR కోడ్ స్కాన్ చేసి ₹499 పేమెంట్ చేయండి.
              </p>
            </div>

            {/* UPI QR Code Container */}
            <div className="p-4 bg-gradient-to-br from-slate-900 to-indigo-950 rounded-2xl border border-indigo-900/60 text-white space-y-3 text-center shadow-lg">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-indigo-300">Scan QR Code via PhonePe / GPay / Paytm:</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px]">
                  ₹499 Auto-Fill
                </span>
              </div>

              <div className="bg-white p-2 rounded-2xl max-w-[180px] mx-auto shadow-md">
                <img
                  src={
                    publicSettings.qrImageUrl ||
                    `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                      `upi://pay?pa=${publicSettings.upiId}&pn=${encodeURIComponent(publicSettings.upiName)}&am=${publicSettings.monthlyPrice}&cu=INR&tn=ManThru_Lead_Tool`
                    )}`
                  }
                  alt="Pay ₹499 via UPI QR Code"
                  className="w-full aspect-square rounded-xl object-contain bg-white"
                />
              </div>

              <div className="flex items-center justify-center gap-1.5 font-mono font-bold text-amber-300 text-xs">
                <span>UPI ID:</span>
                <span className="bg-black/40 px-2 py-1 rounded-lg border border-slate-700">
                  {publicSettings.upiId}
                </span>
              </div>

              {/* 1-Click Pay Buttons */}
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                <button
                  onClick={() => window.open(`upi://pay?pa=${publicSettings.upiId}&pn=${encodeURIComponent(publicSettings.upiName)}&am=${publicSettings.monthlyPrice}&cu=INR`, '_blank')}
                  className="py-2 px-1 bg-purple-700 hover:bg-purple-800 text-white font-black rounded-xl text-[10px] shadow-xs cursor-pointer"
                >
                  📱 PhonePe
                </button>
                <button
                  onClick={() => window.open(`upi://pay?pa=${publicSettings.upiId}&pn=${encodeURIComponent(publicSettings.upiName)}&am=${publicSettings.monthlyPrice}&cu=INR`, '_blank')}
                  className="py-2 px-1 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-[10px] shadow-xs cursor-pointer"
                >
                  📱 Google Pay
                </button>
                <button
                  onClick={() => window.open(`upi://pay?pa=${publicSettings.upiId}&pn=${encodeURIComponent(publicSettings.upiName)}&am=${publicSettings.monthlyPrice}&cu=INR`, '_blank')}
                  className="py-2 px-1 bg-sky-600 hover:bg-sky-700 text-white font-black rounded-xl text-[10px] shadow-xs cursor-pointer"
                >
                  📱 Paytm
                </button>
              </div>
            </div>

            {/* Direct WhatsApp Screenshot Button as Requested */}
            <div className="space-y-3 pt-1">
              <button
                onClick={handleSendPaymentScreenshotWhatsApp}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4 text-emerald-200" />
                <span>📱 Send Payment Screenshot on WhatsApp (+{publicSettings.ownerWhatsApp.replace(/\D/g, '')})</span>
              </button>

              <div className="space-y-2 text-left pt-2 border-t border-slate-200">
                <label className="block font-bold text-slate-800 text-[11px]">
                  లేదా పేమెంట్ స్క్రీన్‌షాట్ ఇక్కడే అప్‌లోడ్ చేయండి (Upload Screenshot Here):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleScreenshotFileChange}
                    className="block w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                  />
                  {screenshotDataUrl && (
                    <img
                      src={screenshotDataUrl}
                      alt="Proof Preview"
                      className="w-10 h-10 rounded-lg object-cover border border-emerald-500 shrink-0"
                    />
                  )}
                </div>

                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="12-digit UPI UTR / Transaction ID (Optional)"
                    value={utrInput}
                    onChange={(e) => setUtrInput(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 bg-slate-50 border rounded-xl font-bold text-xs"
                  />
                  <button
                    onClick={handleSubmitUtr}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs shadow-md transition cursor-pointer shrink-0"
                  >
                    Submit Proof
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Owner / Master Admin Control Panel (Live Subscriber Manager) */}
      {showOwnerModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border-2 border-rose-500 max-w-2xl w-full p-6 space-y-4 text-xs max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <span className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-black text-base shadow-xs">
                  👑
                </span>
                <div>
                  <h3 className="text-base font-black text-slate-900">Owner Admin: Live Subscriber Manager</h3>
                  <p className="text-[11px] text-slate-500">
                    Verify WhatsApp Payment Proofs &amp; 1-Click Activate +30 Days
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowOwnerModal(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            {!isOwnerAuthorized ? (
              <div className="space-y-3">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
                  🔒 Enter Owner Master PIN to view all registered users and activate accounts:
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Master PIN:</label>
                  <input
                    type="password"
                    placeholder="Default PIN: 9160"
                    value={ownerPin}
                    onChange={(e) => setOwnerPin(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl font-bold text-xs"
                  />
                </div>
                <button
                  onClick={handleVerifyOwnerPin}
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs shadow-md transition cursor-pointer"
                >
                  Verify Master Access
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Admin Tab Switcher */}
                <div className="flex items-center gap-2 border-b pb-2">
                  <button
                    onClick={() => setAdminTab('subscribers')}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs cursor-pointer transition ${
                      adminTab === 'subscribers'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    👥 Subscribers &amp; Proofs ({subscribers.length})
                  </button>
                  <button
                    onClick={() => setAdminTab('settings')}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs cursor-pointer transition ${
                      adminTab === 'settings'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    ⚙️ QR &amp; WhatsApp Settings
                  </button>
                </div>

                {adminTab === 'subscribers' ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="relative min-w-[200px]">
                        <input
                          type="text"
                          placeholder="Search mobile or name..."
                          value={adminSearch}
                          onChange={(e) => setAdminSearch(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-50 border rounded-xl text-xs font-semibold"
                        />
                      </div>
                      <button
                        onClick={fetchSubscribers}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs cursor-pointer flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Refresh Subscribers
                      </button>
                    </div>

                    {/* Subscribers Table */}
                    <div className="border rounded-2xl overflow-hidden bg-white shadow-xs">
                      <div className="overflow-x-auto max-h-64 overflow-y-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-100 text-slate-700 font-bold border-b text-[11px]">
                              <th className="p-2.5">Mobile</th>
                              <th className="p-2.5">Business Name</th>
                              <th className="p-2.5">Status</th>
                              <th className="p-2.5">Proof / UTR</th>
                              <th className="p-2.5">Validity</th>
                              <th className="p-2.5 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredSubscribers.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="text-center py-6 text-slate-400">
                                  No subscribers found.
                                </td>
                              </tr>
                            ) : (
                              filteredSubscribers.map((s) => (
                                <tr key={s.mobile} className="hover:bg-slate-50 transition">
                                  <td className="p-2.5 font-bold text-slate-900">+91 {s.mobile}</td>
                                  <td className="p-2.5 text-slate-700 font-semibold">{s.name}</td>
                                  <td className="p-2.5">
                                    {s.isSubscribed ? (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                        🟢 Active
                                      </span>
                                    ) : s.status === 'pending' ? (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                        🟡 Pending Verification
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                                        🔴 Inactive
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-2.5">
                                    <div className="space-y-1">
                                      <span className="text-[11px] font-mono text-slate-600 block">
                                        {s.lastPaymentUtr || 'No UTR'}
                                      </span>
                                      {s.proofScreenshot && (
                                        <button
                                          onClick={() => setPreviewingProofImg(s.proofScreenshot)}
                                          className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-md font-bold text-[10px] cursor-pointer"
                                        >
                                          📷 View Screenshot
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-2.5 font-bold text-emerald-700">{s.daysLeft || 0}d left</td>
                                  <td className="p-2.5 text-right space-x-1">
                                    <button
                                      onClick={() => handleAdminActivate(s.mobile, 30)}
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[10px] cursor-pointer"
                                      title="Activate for 30 Calendar Days"
                                    >
                                      ✓ 30 Days
                                    </button>
                                    <button
                                      onClick={() => handleAdminActivate(s.mobile, 60)}
                                      className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-[10px] cursor-pointer"
                                      title="Activate for 60 Calendar Days"
                                    >
                                      +60D
                                    </button>
                                    <button
                                      onClick={() => handleAdminDeactivate(s.mobile)}
                                      className="px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-lg font-bold text-[10px] cursor-pointer"
                                      title="Lock Account"
                                    >
                                      Lock
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Key Generator */}
                    <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-2xl space-y-2">
                      <div className="font-bold text-indigo-950 flex items-center justify-between">
                        <span>Generate 30-Day License Token for Buyer:</span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          value={generatedKey}
                          placeholder="Click Generate Key..."
                          className="flex-1 px-3 py-2 bg-white border border-indigo-300 rounded-xl font-mono font-black text-xs text-indigo-950"
                        />
                        <button
                          onClick={handleGenerateKey}
                          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs"
                        >
                          Generate Key
                        </button>
                        <button
                          onClick={() => {
                            if (generatedKey) {
                              navigator.clipboard.writeText(generatedKey);
                              triggerToast('Copied key to clipboard!');
                            }
                          }}
                          className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs cursor-pointer"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Admin Settings Tab: QR Code and WhatsApp Number */
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                    <h4 className="font-black text-slate-900 text-sm">
                      Owner Payment QR &amp; WhatsApp Configuration
                    </h4>
                    <p className="text-slate-600 text-[11px]">
                      యూజర్లు ₹499 పే చేయడానికి మీ సొంత UPI QR కోడ్ మరియు వాట్సాప్ నంబర్‌ను ఇక్కడ అప్‌లోడ్ చేయండి.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          Owner WhatsApp Number (for Proofs):
                        </label>
                        <input
                          type="text"
                          value={editOwnerWhatsApp}
                          onChange={(e) => setEditOwnerWhatsApp(e.target.value)}
                          placeholder="e.g. 919160000000"
                          className="w-full px-3 py-2 bg-white border rounded-xl font-bold text-xs"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          Owner UPI ID:
                        </label>
                        <input
                          type="text"
                          value={editUpiId}
                          onChange={(e) => setEditUpiId(e.target.value)}
                          placeholder="e.g. manthrunaik91600@upi"
                          className="w-full px-3 py-2 bg-white border rounded-xl font-bold text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Upload Your Own QR Code Image (File):
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAdminQrUpload}
                        className="block w-full text-xs text-slate-600 file:mr-2 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-rose-50 file:text-rose-700 hover:file:bg-rose-100 cursor-pointer"
                      />
                      {editQrImage && (
                        <div className="mt-2 flex items-center gap-3 p-2 bg-white rounded-xl border">
                          <img
                            src={editQrImage}
                            alt="Custom QR Preview"
                            className="w-16 h-16 rounded-lg object-contain border"
                          />
                          <span className="text-[11px] text-emerald-700 font-bold">
                            ✓ Custom QR loaded and ready!
                          </span>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={handleSaveAdminSettings}
                      className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs shadow-md transition cursor-pointer"
                    >
                      Save QR &amp; WhatsApp Settings
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Proof Screenshot Inspector Modal */}
      {previewingProofImg && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-4 space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <h4 className="font-bold text-slate-900 text-sm">Customer Payment Screenshot</h4>
              <button
                onClick={() => setPreviewingProofImg(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto rounded-xl border">
              <img src={previewingProofImg} alt="Proof Full" className="w-full object-contain" />
            </div>
            <button
              onClick={() => setPreviewingProofImg(null)}
              className="w-full py-2 bg-slate-900 text-white font-bold rounded-xl text-xs cursor-pointer"
            >
              Close Preview
            </button>
          </div>
        </div>
      )}
    </>
  );
}
