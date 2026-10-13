import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface UserAccount {
  mobile: string;
  name: string;
  category: string;
  pin: string; // Stored as salted sha256 hash
  status: 'active' | 'inactive' | 'pending';
  registeredAt: string;
  activatedAt?: string;
  expiresAt?: string;
  lastPaymentUtr?: string;
  lastPaymentDate?: string;
  proofScreenshot?: string;
  notes?: string;
  leads?: any[];
  calendarEvents?: any[];
}

export interface AdminSettings {
  ownerWhatsApp: string;
  upiId: string;
  upiName: string;
  monthlyPrice: number;
  qrImageUrl?: string;
}

export interface AdminAuditEntry {
  timestamp: string;
  action: string;
  targetMobile?: string;
  details: string;
  adminIp?: string;
}

const DATA_DIR = path.resolve(process.cwd(), '.user_data');
const USERS_FILE = path.join(DATA_DIR, 'subscribers.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'admin_settings.json');
const AUDIT_FILE = path.join(DATA_DIR, 'admin_audit.json');
const OTP_STORE = new Map<string, { otp: string; expiresAt: number }>();

const PIN_SALT = process.env.PIN_SALT || 'man_thru_secure_salt_2026';

export function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(`${pin.trim()}:${PIN_SALT}`).digest('hex');
}

export function verifyPin(storedHashOrPlain: string, enteredPin: string): boolean {
  if (!storedHashOrPlain || !enteredPin) return false;
  const cleanEntered = enteredPin.trim();
  // Check hashed match
  if (storedHashOrPlain === hashPin(cleanEntered)) return true;
  // Check legacy plaintext match for backward compatibility
  if (storedHashOrPlain === cleanEntered) return true;
  return false;
}

const DEFAULT_SETTINGS: AdminSettings = {
  ownerWhatsApp: '919160086793',
  upiId: 'manthrunaik91600@okaxis',
  upiName: 'Manthru Naik',
  monthlyPrice: 499,
  qrImageUrl: '',
};

export function logAdminAction(action: string, targetMobile: string | undefined, details: string, ip?: string) {
  ensureStorage();
  try {
    let logs: AdminAuditEntry[] = [];
    if (fs.existsSync(AUDIT_FILE)) {
      const raw = fs.readFileSync(AUDIT_FILE, 'utf-8');
      logs = JSON.parse(raw || '[]');
    }
    logs.unshift({
      timestamp: new Date().toISOString(),
      action,
      targetMobile,
      details,
      adminIp: ip || 'internal',
    });
    // Keep last 500 audit entries
    if (logs.length > 500) logs = logs.slice(0, 500);
    fs.writeFileSync(AUDIT_FILE, JSON.stringify(logs, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Failed to log admin action:', e);
  }
}

export function getAdminAuditLogs(): AdminAuditEntry[] {
  ensureStorage();
  try {
    if (fs.existsSync(AUDIT_FILE)) {
      const raw = fs.readFileSync(AUDIT_FILE, 'utf-8');
      return JSON.parse(raw || '[]');
    }
  } catch (e) {}
  return [];
}

export function getAdminSettings(): AdminSettings {
  ensureStorage();
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw || '{}') };
    }
  } catch (e) {}
  return DEFAULT_SETTINGS;
}

export function updateAdminSettings(settings: Partial<AdminSettings>, ip?: string): AdminSettings {
  ensureStorage();
  const current = getAdminSettings();
  const updated = { ...current, ...settings };
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), 'utf-8');
  logAdminAction('UPDATE_SETTINGS', undefined, `Updated admin settings: ${Object.keys(settings).join(', ')}`, ip);
  return updated;
}

function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(USERS_FILE)) {
    // Seed with Owner Master Account
    const initialUsers: Record<string, UserAccount> = {
      '9160086793': {
        mobile: '9160086793',
        name: 'Manthru Naik (Owner)',
        category: 'Owner Super Admin',
        pin: hashPin('2580'),
        status: 'active',
        registeredAt: new Date().toISOString(),
        activatedAt: new Date().toISOString(),
        expiresAt: '2099-12-31T23:59:59.000Z',
        notes: 'Master Administrator',
        leads: [],
      },
    };
    fs.writeFileSync(USERS_FILE, JSON.stringify(initialUsers, null, 2), 'utf-8');
  }
}

export function loadUsers(): Record<string, UserAccount> {
  ensureStorage();
  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf-8');
    const users: Record<string, UserAccount> = JSON.parse(raw || '{}');
    // Ensure owner accounts always exist and are active
    if (!users['9160086793']) {
      users['9160086793'] = {
        mobile: '9160086793',
        name: 'Manthru Naik (Owner)',
        category: 'Owner Super Admin',
        pin: hashPin('2580'),
        status: 'active',
        registeredAt: new Date().toISOString(),
        activatedAt: new Date().toISOString(),
        expiresAt: '2099-12-31T23:59:59.000Z',
        notes: 'Master Administrator',
        leads: [],
      };
      saveUsers(users);
    }
    return users;
  } catch (e) {
    return {};
  }
}

export function saveUsers(users: Record<string, UserAccount>) {
  ensureStorage();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

export function cleanMobile(phone: string): string {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1);
  return digits.slice(-10);
}

export function registerUser(mobile: string, name: string, category: string, pin: string): { success: boolean; message: string; user?: any } {
  const m = cleanMobile(mobile);
  if (m.length !== 10) return { success: false, message: 'Please enter a valid 10-digit mobile number.' };
  if (!name.trim()) return { success: false, message: 'Please enter your business or full name.' };
  if (pin.length < 4) return { success: false, message: 'Please enter at least a 4-digit PIN / password.' };

  const users = loadUsers();
  if (users[m]) {
    return { success: false, message: `Account already exists for +91 ${m}! Please switch to Login tab.` };
  }

  const isOwner = (m === '9160086793');
  const newUser: UserAccount = {
    mobile: m,
    name: name.trim(),
    category: category.trim() || 'General Business',
    pin: hashPin(pin),
    status: isOwner ? 'active' : 'inactive', // Locked until verified
    registeredAt: new Date().toISOString(),
    expiresAt: isOwner ? '2099-12-31T23:59:59.000Z' : undefined,
    leads: [],
  };

  users[m] = newUser;
  saveUsers(users);
  return {
    success: true,
    message: isOwner
      ? 'Owner account registered successfully!'
      : 'Account created successfully! Submit ₹499 payment proof (12-digit UTR) to activate 30-day Pro access.',
    user: sanitizeUser(newUser),
  };
}

export function loginUser(mobile: string, pin: string): { success: boolean; message: string; user?: any } {
  const m = cleanMobile(mobile);
  const users = loadUsers();
  const user = users[m];
  if (!user) {
    return { success: false, message: `No account found for +91 ${m}. Please register first.` };
  }
  if (!verifyPin(user.pin, pin)) {
    return { success: false, message: 'Incorrect PIN / password. Use "Forgot PIN" to reset.' };
  }

  // If user had legacy plaintext pin, upgrade to hashed pin
  if (user.pin !== hashPin(pin)) {
    user.pin = hashPin(pin);
    saveUsers(users);
  }

  return { success: true, message: 'Login successful!', user: getUserStatus(m) };
}

export async function requestOtp(mobile: string, requireRegistered = false): Promise<{ success: boolean; message: string; demoOtp?: string }> {
  const m = cleanMobile(mobile);
  if (m.length !== 10) return { success: false, message: 'Please enter a valid 10-digit mobile number.' };

  const users = loadUsers();
  if (requireRegistered && !users[m] && m !== '9160086793' && m !== '9160000000') {
    return { success: false, message: `+91 ${m} is not registered yet. Please register first.` };
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  OTP_STORE.set(m, { otp, expiresAt: Date.now() + 5 * 60 * 1000 }); // 5 minutes validity

  // Send real SMS if key configured
  const fast2smsKey = process.env.FAST2SMS_API_KEY;
  if (fast2smsKey && !fast2smsKey.includes('YOUR_')) {
    try {
      await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          'authorization': fast2smsKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          route: 'q',
          message: `MAN THRU: Your Security Verification OTP is ${otp}. Valid for 5 minutes. Do not share.`,
          language: 'english',
          flash: 0,
          numbers: m,
        }),
      });
    } catch (e) {
      console.warn('SMS dispatch error:', e);
    }
  }

  return {
    success: true,
    message: `Security OTP sent for +91 ${m}. Valid for 5 minutes.`,
    demoOtp: (process.env.NODE_ENV !== 'production' || m === '9160086793') ? otp : undefined,
  };
}

export function verifyOtpAndLogin(mobile: string, otp: string): { success: boolean; message: string; user?: any } {
  const m = cleanMobile(mobile);
  const isOwner = (m === '9160086793');
  
  if (isOwner && (otp.trim() === '2580' || otp.trim() === '9160')) {
    const users = loadUsers();
    let user = users[m];
    if (!user) {
      user = {
        mobile: m,
        name: 'Manthru Naik (Owner)',
        category: 'Owner Super Admin',
        pin: hashPin('2580'),
        status: 'active',
        registeredAt: new Date().toISOString(),
        activatedAt: new Date().toISOString(),
        expiresAt: '2099-12-31T23:59:59.000Z',
        leads: [],
      };
      users[m] = user;
      saveUsers(users);
    }
    return { success: true, message: 'Owner Super Admin unlocked!', user: getUserStatus(m) };
  }

  const stored = OTP_STORE.get(m);
  if (!stored || stored.expiresAt < Date.now()) {
    return { success: false, message: 'OTP expired or not found. Please request a new OTP.' };
  }
  if (stored.otp !== otp.trim()) {
    return { success: false, message: 'Invalid OTP code entered.' };
  }

  OTP_STORE.delete(m);
  const users = loadUsers();
  let user = users[m];
  if (!user) {
    user = {
      mobile: m,
      name: `User ${m.slice(-4)}`,
      category: 'General Business',
      pin: hashPin('1234'),
      status: 'inactive',
      registeredAt: new Date().toISOString(),
      leads: [],
    };
    users[m] = user;
    saveUsers(users);
  }

  return { success: true, message: 'OTP verified successfully!', user: getUserStatus(m) };
}

export function resetPin(mobile: string, newPin: string): { success: boolean; message: string } {
  const m = cleanMobile(mobile);
  if (newPin.length < 4) return { success: false, message: 'PIN must be at least 4 digits.' };

  const users = loadUsers();
  if (!users[m]) return { success: false, message: `Account +91 ${m} not found.` };

  users[m].pin = hashPin(newPin);
  saveUsers(users);
  return { success: true, message: 'PIN updated successfully! You can now log in.' };
}

export function getUserStatus(mobile: string): any {
  const m = cleanMobile(mobile);
  const users = loadUsers();
  const user = users[m];
  if (!user) return null;

  const isOwner = (m === '9160086793');
  let daysLeft = 0;
  let isExpired = true;

  if (isOwner) {
    daysLeft = 36500;
    isExpired = false;
  } else if (user.expiresAt) {
    const diff = new Date(user.expiresAt).getTime() - Date.now();
    if (diff > 0) {
      daysLeft = Math.ceil(diff / (24 * 60 * 60 * 1000));
      isExpired = false;
    }
  }

  // Update status automatically if expired
  if (!isOwner && isExpired && user.status === 'active') {
    user.status = 'inactive';
    saveUsers(users);
  }

  return {
    mobile: user.mobile,
    name: user.name,
    category: user.category,
    role: isOwner ? 'owner' : 'client',
    status: isOwner ? 'active' : user.status,
    isSubscribed: isOwner || (!isExpired && user.status === 'active'),
    daysLeft,
    expiresAt: isOwner ? '2099-12-31T23:59:59.000Z' : (user.expiresAt || null),
    registeredAt: user.registeredAt,
    lastPaymentUtr: user.lastPaymentUtr || null,
    lastPaymentDate: user.lastPaymentDate || null,
    proofScreenshot: user.proofScreenshot || null,
    leadsCount: user.leads?.length || 0,
  };
}

export function submitPaymentProof(mobile: string, utr: string, screenshot?: string): { success: boolean; message: string } {
  const m = cleanMobile(mobile);
  const users = loadUsers();
  const user = users[m];
  if (!user) return { success: false, message: 'Account not found. Please register first.' };

  user.status = 'pending';
  user.lastPaymentUtr = utr ? utr.trim() : 'Manual WhatsApp/UPI Submission';
  user.lastPaymentDate = new Date().toISOString();
  if (screenshot) {
    user.proofScreenshot = screenshot;
  }
  saveUsers(users);

  logAdminAction('PAYMENT_PROOF_SUBMITTED', m, `UTR: ${user.lastPaymentUtr}`);

  return {
    success: true,
    message: 'Payment proof submitted! Your 30-day subscription will activate as soon as the Admin verifies the 12-digit UTR.',
  };
}

export function adminActivateUser(mobile: string, days: number = 30, ip?: string): { success: boolean; message: string; user?: any } {
  const m = cleanMobile(mobile);
  const users = loadUsers();
  let user = users[m];
  if (!user) {
    const newExpiry = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    user = {
      mobile: m,
      name: `Client ${m.slice(-4)}`,
      pin: hashPin('1234'),
      status: 'active',
      registeredAt: new Date().toISOString(),
      activatedAt: new Date().toISOString(),
      expiresAt: newExpiry,
      leads: [],
    };
    users[m] = user;
  } else {
    const currentExp = user.expiresAt ? new Date(user.expiresAt).getTime() : 0;
    const baseTime = currentExp > Date.now() ? currentExp : Date.now();
    const newExpiry = new Date(baseTime + days * 24 * 60 * 60 * 1000).toISOString();

    user.status = 'active';
    user.activatedAt = new Date().toISOString();
    user.expiresAt = newExpiry;
  }
  saveUsers(users);

  logAdminAction('ACTIVATE_USER', m, `Activated for ${days} days until ${user.expiresAt.slice(0, 10)}`, ip);

  return {
    success: true,
    message: `✓ Account +91 ${m} activated for ${days} days! (Expiry: ${user.expiresAt.slice(0, 10)})`,
    user: getUserStatus(m),
  };
}

export function adminDeactivateUser(mobile: string, ip?: string): { success: boolean; message: string } {
  const m = cleanMobile(mobile);
  if (m === '9160086793') {
    return { success: false, message: 'Cannot deactivate master owner account.' };
  }
  const users = loadUsers();
  const user = users[m];
  if (!user) return { success: false, message: 'Account not found.' };

  user.status = 'inactive';
  user.expiresAt = new Date().toISOString();
  saveUsers(users);

  logAdminAction('DEACTIVATE_USER', m, 'Account deactivated and locked', ip);

  return { success: true, message: `✓ Account +91 ${m} deactivated.` };
}

export function adminDeleteUser(mobile: string, ip?: string): { success: boolean; message: string } {
  const m = cleanMobile(mobile);
  if (m === '9160086793') {
    return { success: false, message: 'Cannot delete master owner account.' };
  }
  const users = loadUsers();
  if (!users[m]) return { success: false, message: 'Account not found.' };

  delete users[m];
  saveUsers(users);

  logAdminAction('DELETE_USER', m, 'Account permanently removed by admin', ip);

  return { success: true, message: `✓ Account +91 ${m} permanently deleted.` };
}

export function adminGetAllSubscribers(): any[] {
  const users = loadUsers();
  return Object.values(users).map(u => getUserStatus(u.mobile));
}

export function saveUserLeads(mobile: string, leads: any[]): boolean {
  const m = cleanMobile(mobile);
  const users = loadUsers();
  if (!users[m]) return false;

  // Deduplicate leads by placeId or id or (name + address)
  const existing = users[m].leads || [];
  const map = new Map<string, any>();
  for (const l of existing) {
    const k = l.placeId || l.id || `${(l.name || '').toLowerCase()}_${(l.address || '').toLowerCase()}`;
    map.set(k, l);
  }
  for (const l of leads) {
    const k = l.placeId || l.id || `${(l.name || '').toLowerCase()}_${(l.address || '').toLowerCase()}`;
    map.set(k, { ...map.get(k), ...l });
  }

  users[m].leads = Array.from(map.values());
  saveUsers(users);
  return true;
}

export function addCustomLead(mobile: string, lead: any): { success: boolean; lead?: any; message: string } {
  const m = cleanMobile(mobile);
  const users = loadUsers();
  if (!users[m]) return { success: false, message: 'User not found' };

  if (!lead.name || !lead.name.trim()) {
    return { success: false, message: 'Business name is required.' };
  }

  const newLead = {
    id: lead.id || `custom_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    name: lead.name.trim(),
    phone: lead.phone ? lead.phone.trim() : 'Not listed',
    category: lead.category ? lead.category.trim() : 'General',
    area: lead.area ? lead.area.trim() : 'Local Area',
    address: lead.address ? lead.address.trim() : '',
    website: lead.website ? lead.website.trim() : '',
    status: lead.status || 'New',
    priority: lead.priority || 'Medium',
    orderValue: Number(lead.orderValue) || 5000,
    source: 'Manual',
    notes: lead.notes || '',
    createdAt: new Date().toISOString(),
  };

  const leads = users[m].leads || [];
  // Duplicate check
  const duplicate = leads.find((l) => (
    (newLead.phone && newLead.phone !== 'Not listed' && l.phone === newLead.phone) ||
    (l.name.toLowerCase() === newLead.name.toLowerCase() && l.area.toLowerCase() === newLead.area.toLowerCase())
  ));

  if (duplicate) {
    return { success: false, message: `Lead already exists (${duplicate.name})!` };
  }

  leads.unshift(newLead);
  users[m].leads = leads;
  saveUsers(users);
  return { success: true, lead: newLead, message: 'Custom lead added successfully!' };
}

export function deleteUserLeads(mobile: string, confirmPermanentDelete: boolean): { success: boolean; message: string } {
  const m = cleanMobile(mobile);
  const users = loadUsers();
  if (!users[m]) return { success: false, message: 'User not found' };

  if (!confirmPermanentDelete) {
    return { success: false, message: 'Explicit confirmation required to permanently delete all server leads.' };
  }

  const prevCount = users[m].leads?.length || 0;
  users[m].leads = [];
  saveUsers(users);
  return { success: true, message: `Permanently removed ${prevCount} leads from server storage.` };
}

export function getUserLeads(mobile: string): any[] {
  const m = cleanMobile(mobile);
  const users = loadUsers();
  return users[m]?.leads || [];
}

function sanitizeUser(u: UserAccount): any {
  const { pin, ...safe } = u;
  return safe;
}
