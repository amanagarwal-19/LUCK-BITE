import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ShieldCheck, FileText, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import type { Business, BusinessStatus } from '@/types';
import Logo from '@/components/Logo';
import { Badge } from '@/components/Badge';
import AuthModal from '@/components/AuthModal';
import { SUPPORT_TOPICS } from '@/components/InfoPages';

interface AdminBusiness extends Business {
  owner_email: string | null;
  similar_count: number;
}

interface SupportRequest {
  id: string;
  created_at: string;
  name: string;
  email: string;
  topic: string;
  message: string;
  pickup_code: string | null;
  status: 'open' | 'resolved';
}

interface AuditEntry {
  log_id: number;
  occurred_at: string;
  actor_email: string | null;
  actor_role: string;
  table_name: string;
  business_name: string | null;
  action: string;
  changes: Record<string, { old: unknown; new: unknown }> | null;
}

const STATUS_VARIANT = {
  pending: 'warning',
  approved: 'green',
  rejected: 'error',
  suspended: 'error',
} as const;

const FILTERS: (BusinessStatus | 'all')[] = ['pending', 'approved', 'rejected', 'suspended', 'all'];

function show(v: unknown): string {
  if (v === null || v === undefined) return '—';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > 60 ? s.slice(0, 57) + '…' : s;
}

export default function AdminPanel({ onBack }: { onBack: () => void }) {
  const { user, loading: authLoading, signOut } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<'businesses' | 'audit' | 'support'>('businesses');
  const [support, setSupport] = useState<SupportRequest[]>([]);
  const [supportFilter, setSupportFilter] = useState<'open' | 'resolved'>('open');
  const [filter, setFilter] = useState<BusinessStatus | 'all'>('pending');
  const [businesses, setBusinesses] = useState<AdminBusiness[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setIsAdmin(null);
      return;
    }
    supabase.rpc('is_admin').then(({ data }) => setIsAdmin(data === true));
  }, [user]);

  const loadBusinesses = useCallback(async () => {
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.rpc('admin_list_businesses', {
      p_status: filter === 'all' ? null : filter,
    });
    if (error) setError(error.message);
    else setBusinesses((data ?? []) as AdminBusiness[]);
    setBusy(false);
  }, [filter]);

  const loadAudit = useCallback(async () => {
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.rpc('admin_audit_log', { p_limit: 200 });
    if (error) setError(error.message);
    else setAudit((data ?? []) as AuditEntry[]);
    setBusy(false);
  }, []);

  const loadSupport = useCallback(async () => {
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.rpc('admin_list_support_requests', { p_status: supportFilter });
    if (error) setError(error.message);
    else setSupport((data ?? []) as SupportRequest[]);
    setBusy(false);
  }, [supportFilter]);

  const resolveRequest = async (id: string, resolved: boolean) => {
    const { error } = await supabase.rpc('admin_resolve_support_request', { p_id: id, p_resolved: resolved });
    if (error) {
      setError(error.message);
      return;
    }
    loadSupport();
  };

  useEffect(() => {
    if (!isAdmin) return;
    if (tab === 'businesses') loadBusinesses();
    else if (tab === 'audit') loadAudit();
    else loadSupport();
  }, [isAdmin, tab, loadBusinesses, loadAudit, loadSupport]);

  const setStatus = async (b: AdminBusiness, status: BusinessStatus) => {
    let note: string | null = null;
    if (status === 'rejected' || status === 'suspended') {
      note = window.prompt(`Reason for ${status === 'rejected' ? 'rejecting' : 'suspending'} "${b.name}" (shown to the business):`);
      if (!note || note.trim().length < 3) return;
    } else if (!window.confirm(`Mark "${b.name}" as ${status}?`)) {
      return;
    }
    const { error } = await supabase.rpc('admin_set_business_status', {
      p_business_id: b.id,
      p_status: status,
      p_note: note,
    });
    if (error) {
      setError(error.message);
      return;
    }
    loadBusinesses();
  };

  const viewEvidence = async (b: AdminBusiness) => {
    if (!b.evidence_path) return;
    const { data, error } = await supabase.storage.from('verification-docs').createSignedUrl(b.evidence_path, 300);
    if (error || !data) {
      setError('Could not open the document.');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  const header = (
    <header className="sticky top-0 z-30 bg-cream-50/90 backdrop-blur border-b border-ink-900/5">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-3.5 flex items-center gap-4">
        <button onClick={onBack} className="btn-ghost -ml-2">
          <ArrowLeft size={18} /> <span className="hidden sm:inline">Home</span>
        </button>
        <Logo size="sm" />
        <div className="ml-auto flex items-center gap-2">
          <span className="badge bg-ink-900 text-white">Admin</span>
          {user && (
            <button onClick={() => signOut()} className="btn-ghost">Sign out</button>
          )}
        </div>
      </div>
    </header>
  );

  if (authLoading || (user && isAdmin === null)) {
    return (
      <div className="min-h-screen bg-cream-100">
        {header}
        <p className="text-center text-ink-500 py-24 text-sm">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-cream-100">
        {header}
        <div className="max-w-md mx-auto px-5 py-16 text-center">
          <ShieldCheck size={36} className="mx-auto text-ink-400 mb-3" />
          <h1 className="text-2xl font-bold text-ink-900 mb-2">Administrator sign in</h1>
          <p className="text-ink-600 text-sm mb-5">Sign in with an administrator account to review businesses.</p>
          <button onClick={() => setAuthOpen(true)} className="btn-primary">Sign in</button>
        </div>
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-cream-100">
        {header}
        <div className="max-w-md mx-auto px-5 py-16 text-center">
          <h1 className="text-2xl font-bold text-ink-900 mb-2">No admin access</h1>
          <p className="text-ink-600 text-sm">This account is not an administrator.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-100">
      {header}
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-6">
        <h1 className="text-2xl font-bold text-ink-900 mb-4">Administration</h1>

        <div className="flex gap-1 mb-6 border-b border-ink-900/5">
          {(['businesses', 'audit', 'support'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 font-semibold text-sm border-b-2 -mb-px transition-colors ${
                tab === t ? 'border-orange-500 text-orange-600' : 'border-transparent text-ink-500 hover:text-ink-900'
              }`}
            >
              {t === 'businesses' ? 'Businesses' : t === 'audit' ? 'Audit log' : 'Support'}
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-xl bg-error-100 border border-error-500/20 p-3 mb-4">
            <p className="text-sm text-error-700">{error}</p>
          </div>
        )}

        {tab === 'businesses' && (
          <div>
            <div className="flex gap-2 flex-wrap mb-5">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`badge capitalize transition-all ${
                    filter === f ? 'bg-orange-500 text-white' : 'bg-cream-200 text-ink-600 hover:bg-cream-100'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {busy && businesses.length === 0 ? (
              <p className="text-sm text-ink-500">Loading…</p>
            ) : businesses.length === 0 ? (
              <div className="card p-8 text-center text-ink-500 text-sm">No businesses in this list.</div>
            ) : (
              <div className="space-y-4">
                {businesses.map((b) => (
                  <div key={b.id} className="card p-5">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <h2 className="font-bold text-ink-900 text-lg">{b.name}</h2>
                        <p className="text-sm text-ink-500">{b.business_type} · {b.location}</p>
                      </div>
                      <Badge variant={STATUS_VARIANT[b.status]}>{b.status}</Badge>
                    </div>

                    <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm mt-4">
                      <Row label="Account email" value={b.owner_email} />
                      <Row label="Contact" value={b.contact_name} />
                      <Row label="Business email" value={b.email} />
                      <Row label="Phone" value={b.phone} />
                      <div className="flex gap-2">
                        <dt className="text-ink-500 shrink-0">Map pin:</dt>
                        <dd>
                          {b.latitude != null && b.longitude != null ? (
                            <a
                              href={`https://www.openstreetmap.org/?mlat=${b.latitude}&mlon=${b.longitude}#map=18/${b.latitude}/${b.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-orange-600 hover:underline"
                            >
                              View on map
                            </a>
                          ) : (
                            '—'
                          )}
                        </dd>
                      </div>
                      <Row label="FSSAI number" value={b.licence_number} />
                      <Row label="Submitted" value={new Date(b.created_at).toLocaleString()} />
                      {b.review_note && <Row label="Review note" value={b.review_note} />}
                    </dl>

                    {!b.licence_number && !b.evidence_path && (
                      <p className="mt-3 flex items-center gap-2 text-sm text-warning-700">
                        <AlertTriangle size={16} />
                        No FSSAI number or document was provided. Verify this business another way before approving.
                      </p>
                    )}

                    {b.similar_count > 0 && (
                      <p className="mt-3 flex items-center gap-2 text-sm text-warning-700">
                        <AlertTriangle size={16} />
                        {b.similar_count} other registration(s) with the same name and location. Check for duplicates.
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2 mt-4">
                      {b.evidence_path && (
                        <button onClick={() => viewEvidence(b)} className="btn-secondary">
                          <FileText size={16} /> View document
                        </button>
                      )}
                      {b.status !== 'approved' && (
                        <button onClick={() => setStatus(b, 'approved')} className="btn-primary">Approve</button>
                      )}
                      {b.status === 'pending' && (
                        <button onClick={() => setStatus(b, 'rejected')} className="btn-secondary">Reject</button>
                      )}
                      {b.status === 'approved' && (
                        <button onClick={() => setStatus(b, 'suspended')} className="btn-secondary">Suspend</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'audit' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-ink-600">Latest 200 changes. Entries cannot be edited or deleted.</p>
              <button onClick={loadAudit} className="btn-secondary">Refresh</button>
            </div>
            {audit.length === 0 ? (
              <div className="card p-8 text-center text-ink-500 text-sm">{busy ? 'Loading…' : 'No changes recorded yet.'}</div>
            ) : (
              <div className="space-y-2">
                {audit.map((a) => (
                  <div key={a.log_id} className="card p-4 text-sm">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-semibold text-ink-900">
                        {a.action === 'INSERT' ? 'Created' : a.action === 'DELETE' ? 'Deleted' : 'Changed'} {a.table_name === 'businesses' ? 'business' : a.table_name === 'listings' ? 'listing' : 'reservation'}
                      </span>
                      {a.business_name && <span className="text-ink-600">{a.business_name}</span>}
                      <span className="text-ink-400 ml-auto">{new Date(a.occurred_at).toLocaleString()}</span>
                    </div>
                    <p className="text-ink-500 mt-0.5">
                      By {a.actor_email ?? 'system'} ({a.actor_role})
                    </p>
                    {a.changes && (
                      <ul className="mt-2 space-y-0.5 text-ink-700">
                        {Object.entries(a.changes).map(([key, v]) => (
                          <li key={key}>
                            <span className="font-medium">{key}:</span> {show(v.old)} → {show(v.new)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'support' && (
          <div>
            <div className="flex gap-2 mb-5">
              {(['open', 'resolved'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setSupportFilter(f)}
                  className={`badge capitalize transition-all ${
                    supportFilter === f ? 'bg-orange-500 text-white' : 'bg-cream-200 text-ink-600 hover:bg-cream-100'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            {support.length === 0 ? (
              <div className="card p-8 text-center text-ink-500 text-sm">
                {busy ? 'Loading…' : 'No support requests in this list.'}
              </div>
            ) : (
              <div className="space-y-3">
                {support.map((s) => (
                  <div key={s.id} className="card p-5">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="font-bold text-ink-900">{s.name}</p>
                        <a href={`mailto:${s.email}`} className="text-sm text-orange-600 hover:underline">{s.email}</a>
                      </div>
                      <div className="text-right text-xs text-ink-500">
                        <p>{new Date(s.created_at).toLocaleString()}</p>
                        <p className="mt-1">
                          <Badge variant="neutral">
                            {SUPPORT_TOPICS.find((t) => t.value === s.topic)?.label ?? s.topic}
                          </Badge>
                        </p>
                      </div>
                    </div>
                    {s.pickup_code && (
                      <p className="text-sm text-ink-600 mt-2">
                        Pickup code: <span className="font-semibold">{s.pickup_code}</span>
                      </p>
                    )}
                    <p className="text-sm text-ink-800 mt-3 whitespace-pre-wrap break-words">{s.message}</p>
                    <div className="mt-4">
                      {s.status === 'open' ? (
                        <button onClick={() => resolveRequest(s.id, true)} className="btn-primary">Mark resolved</button>
                      ) : (
                        <button onClick={() => resolveRequest(s.id, false)} className="btn-secondary">Reopen</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex gap-2">
      <dt className="text-ink-500 shrink-0">{label}:</dt>
      <dd className="text-ink-900 break-words min-w-0">{value || '—'}</dd>
    </div>
  );
}
