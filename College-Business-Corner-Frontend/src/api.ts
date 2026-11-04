const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

export const assetUrl = (path?: string | null) => (path ? `${BASE}${path}` : undefined);

export const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export interface PolicyReason {
  code: string;
  severity: 'BLOCK' | 'ASK';
  message: string;
}

export interface CheckoutLine {
  title: string;
  quantity: number;
  totalCents: number;
  business: string;
}

export interface CheckoutRequest {
  items: { listingId: string; quantity: number }[];
  budgetCents?: number;
}

export interface Checkout {
  decision: 'ALLOW' | 'ASK' | 'BLOCK';
  reasons: PolicyReason[];
  orderId?: string;
  approveUrl?: string;
  totalCents?: number;
  platformFeeCents?: number;
  lines?: CheckoutLine[];
  request?: CheckoutRequest;
}

export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

export interface ChatResponse {
  reply: string;
  checkout: Checkout | null;
}

export interface OrderView {
  id: string;
  status: string;
  totalCents: number;
  items: {
    quantity: number;
    unitPriceCents: number;
    listing: { title: string };
    business: { name: string };
  }[];
  payouts: {
    grossCents: number;
    platformFeeCents: number;
    paypalFeeCents: number | null;
    netCents: number | null;
    captureStatus: string | null;
    business: { name: string };
  }[];
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data: unknown,
  ) {
    super(message);
  }
}

export type Role = 'OWNER' | 'BUYER';
export interface Session {
  token: string;
  email: string;
  role: Role;
}

const SESSION_KEY = 'cbc.session';
export const SESSION_EVENT = 'cbc-session';

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function setSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch { /* storage unavailable */ }
  window.dispatchEvent(new Event(SESSION_EVENT));
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  const token = getSession()?.token;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...init,
    });
  } catch {
    throw new ApiError('Could not reach the server. Check that the backend is running.', 0, null);
  }
  const data = await res.json().catch(() => null);
  if (res.status === 401 && token) setSession(null); // expired or invalid: back to the sign-in screen
  if (!res.ok) {
    const raw = (data as { message?: string | string[] } | null)?.message;
    const message = Array.isArray(raw) ? raw.join(' ') : (raw ?? 'Something went wrong. Please try again.');
    throw new ApiError(message, res.status, data);
  }
  return data as T;
}

export const chat = (message: string, history: ChatTurn[]) =>
  request<ChatResponse>('/agent/chat', { method: 'POST', body: JSON.stringify({ message, history }) });

/** The buyer pressed Confirm on an ASK. Same cart, now with the buyer's approval. */
export const confirmCheckout = (req: CheckoutRequest) =>
  request<Checkout>('/orders', { method: 'POST', body: JSON.stringify({ ...req, confirmed: true }) });

export const getOrder = (id: string) => request<OrderView>(`/orders/${encodeURIComponent(id)}`);

export interface ListingView {
  id: string;
  title: string;
  description: string;
  kind: 'PRODUCT' | 'SERVICE';
  priceCents: number;
  unit: string | null;
  imageUrl?: string;
  business: { id: string; name: string; category: string; canReceivePayments: boolean };
}

export interface AuditEntry {
  id: string;
  createdAt: string;
  actor: string;
  action: string;
  decision: 'ALLOW' | 'ASK' | 'BLOCK';
  reason: string;
  orderId: string | null;
}

export const getListings = (q?: string) => request<ListingView[]>(`/listings${q ? `?q=${encodeURIComponent(q)}` : ''}`);
export const getAudit = () => request<AuditEntry[]>('/policy/audit');

export type Onboarding = 'NOT_STARTED' | 'PENDING' | 'READY';

export interface OwnedBusiness {
  id: string;
  name: string;
  category: string;
  description: string;
  onboarding: Onboarding;
  listings: { id: string; title: string; priceCents: number; kind: string; unit: string | null; active: boolean; imageUrl?: string }[];
}

export interface PaypalStatus {
  onboarding: Onboarding;
  checks: { paymentsReceivable: boolean; emailConfirmed: boolean; permissionsGranted: boolean } | null;
  fixes: string[];
}

const post = <T,>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) });

export const login = (email: string, role: Role) =>
  post<{ token: string; user: { email: string; role: Role } }>('/auth/login', { email, role });

// Owner endpoints: the backend knows who you are from the sign-in token.
export const getMyBusinesses = () => request<OwnedBusiness[]>('/businesses');
export const createBusiness = (b: { name: string; category: string; description: string }) => post<{ id: string }>('/businesses', b);
export const addListing = (
  id: string,
  l: { title: string; description: string; kind: string; priceCents: number; unit: string },
) => post<{ id: string }>(`/businesses/${id}/listings`, l);
export const connectPaypal = (id: string) => post<{ onboardingUrl: string }>(`/businesses/${id}/paypal/connect`, {});
export const uploadListingImage = (businessId: string, listingId: string, data: string) =>
  post<{ imageUrl?: string }>(`/businesses/${businessId}/listings/${listingId}/image`, { data });
export const getPaypalStatus = (id: string) => request<PaypalStatus>(`/businesses/${id}/paypal/status`);

// ---- Owner assistant: it only PROPOSES; each card is confirmed by the owner ----
export interface ListingDraft { title: string; description: string; kind: 'PRODUCT' | 'SERVICE'; priceCents: number; unit: string }
export type Proposal =
  | { id: string; type: 'business'; summary: string; data: { name: string; category: string; description: string } }
  | { id: string; type: 'listings'; summary: string; businessId: string; businessName: string; data: { listings: ListingDraft[] } }
  | {
      id: string; type: 'tip'; summary: string; businessId: string; businessName: string;
      data: { term: string; searches: number; listingsAvailable: number; periodDays: number; fit: string; costLevel: 'none' | 'low' | 'medium' | 'high' | 'unknown' };
    }
  | { id: string; type: 'paypal'; summary: string; businessId: string; businessName: string; data: Record<string, never> };

export const ownerChat = (message: string, history: ChatTurn[]) =>
  post<{ reply: string; proposals: Proposal[] }>('/agent/owner/chat', { message, history });

// ---- Anonymous campus demand (what is searched, never who searched) ----
export interface DemandTerm { term: string; searches: number; listingsAvailable: number }
export interface DemandInsights { periodDays: number; searchesCounted: number; topSearches: DemandTerm[]; unmetDemand: DemandTerm[]; lowSupply: DemandTerm[]; note: string }
export const getDemandInsights = () => request<DemandInsights>('/insights/demand');
