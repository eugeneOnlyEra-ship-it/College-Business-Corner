// Development: the API runs on localhost:3000. A production build with no VITE_API_URL is served by the API itself
// (see the Dockerfile), so it talks to the address it was loaded from.
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? (import.meta.env.PROD ? '' : 'http://localhost:3000');
const WHERE = BASE || window.location.origin;

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
  /** The real listings the assistant found, shown as cards. */
  listings?: ListingView[];
  /** Which of them went into the cart. */
  selectedIds?: string[];
}

export interface OrderView {
  id: string;
  status: string;
  failureReason?: string | null;
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

// Most calls should answer quickly. The assistant may make several AI calls (and wait out rate limits), so it gets longer.
const timeoutFor = (path: string) => (path.startsWith('/agent/') ? 120_000 : 20_000);

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getSession()?.token;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutFor(path));
  const tooSlow = () =>
    new ApiError(`The server at ${WHERE} did not answer in time. Check that the backend is running and that VITE_API_URL points to it.`, 0, null);
  try {
    let res: Response;
    try {
      res = await fetch(`${BASE}${path}`, {
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...init,
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted) throw tooSlow();
      throw new ApiError(
        `Could not reach the server at ${WHERE}. Check that the backend is running, that VITE_API_URL is correct, and that the backend allows this page's address.`,
        0,
        null,
      );
    }
    const data = await res.json().catch(() => null);
    if (controller.signal.aborted) throw tooSlow();
    if (res.status === 401 && token) setSession(null); // expired or invalid: back to the sign-in screen
    if (!res.ok) {
      const raw = (data as { message?: string | string[] } | null)?.message;
      const message = Array.isArray(raw) ? raw.join(' ') : (raw ?? 'Something went wrong. Please try again.');
      throw new ApiError(message, res.status, data);
    }
    return data as T;
  } finally {
    clearTimeout(timer);
  }
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
  business: { id: string; name: string; category: string; description?: string; canReceivePayments: boolean };
}

export interface BusinessProfile {
  id: string;
  name: string;
  category: string;
  description: string;
  memberSince: string;
  canReceivePayments: boolean;
  listings: Omit<ListingView, 'business'>[];
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
export const getBusiness = (id: string) => request<BusinessProfile>(`/listings/businesses/${encodeURIComponent(id)}`);
export const getAudit = () => request<AuditEntry[]>('/policy/audit');

export type Onboarding = 'NOT_STARTED' | 'PENDING' | 'READY';

export interface OwnedBusiness {
  id: string;
  name: string;
  category: string;
  description: string;
  onboarding: Onboarding;
  /** Closed by the owner: hidden from shoppers and closed to orders. History is kept. */
  closed: boolean;
  /** Something was ordered from it at some point, so it can be closed but not deleted. */
  hasOrders: boolean;
  listings: { id: string; title: string; description?: string; priceCents: number; kind: string; unit: string | null; active: boolean; imageUrl?: string }[];
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
export interface ListingChanges { title?: string; description?: string; kind?: string; priceCents?: number; unit?: string; active?: boolean }
export const updateListing = (businessId: string, listingId: string, changes: ListingChanges) =>
  request<{ id: string }>(`/businesses/${businessId}/listings/${listingId}`, { method: 'PATCH', body: JSON.stringify(changes) });
export const updateBusiness = (id: string, changes: { name?: string; category?: string; description?: string }) =>
  request<{ id: string }>(`/businesses/${id}`, { method: 'PATCH', body: JSON.stringify(changes) });
export const closeBusiness = (id: string) => request<{ id: string; closed: boolean }>(`/businesses/${id}/close`, { method: 'POST' });
export const reopenBusiness = (id: string) => request<{ id: string; closed: boolean }>(`/businesses/${id}/reopen`, { method: 'POST' });
export const deleteBusiness = (id: string) => request<{ id: string; deleted: boolean }>(`/businesses/${id}`, { method: 'DELETE' });
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

export interface StarterPack {
  tips: { title: string; text: string }[];
  books: { title: string; author: string; why: string; findUrl: string }[];
  websites: { name: string; url: string; why: string }[];
  note: string;
}
export const getStarterPack = () => request<StarterPack>('/insights/starter-pack');
export const ownerChat = (message: string, history: ChatTurn[]) =>
  post<{ reply: string; proposals: Proposal[]; resources?: StarterPack }>('/agent/owner/chat', { message, history });

// ---- Anonymous campus demand (what is searched, never who searched) ----
export interface DemandTerm { term: string; searches: number; listingsAvailable: number }
export interface DemandInsights { periodDays: number; searchesCounted: number; topSearches: DemandTerm[]; unmetDemand: DemandTerm[]; lowSupply: DemandTerm[]; note: string }
export const getDemandInsights = () => request<DemandInsights>('/insights/demand');

// ---- Buyer: order history and personal spending limits ----
export interface MyOrder {
  id: string;
  status: 'CREATED' | 'AWAITING_APPROVAL' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  totalCents: number;
  createdAt: string;
  items: { title: string; quantity: number; business: string }[];
}
export const getMyOrders = () => request<MyOrder[]>('/orders/mine');

export interface Limits {
  maxOrderCents: number | null;
  confirmAboveCents: number | null;
  effective: { maxOrderCents: number; confirmAboveCents: number };
  system: { maxOrderCents: number; confirmAboveCents: number };
}
export const getLimits = () => request<Limits>('/buyers/me/limits');
export const setLimits = (body: { maxOrderCents: number | null; confirmAboveCents: number | null }) =>
  request<Limits>('/buyers/me/limits', { method: 'PUT', body: JSON.stringify(body) });

// ---- Seller: what has been sold ----
export interface BusinessSales {
  summary: { orders: number; grossCents: number; platformFeeCents: number; paypalFeeCents: number; netCents: number };
  recent: {
    orderId: string;
    date: string;
    buyerName: string;
    grossCents: number;
    platformFeeCents: number;
    paypalFeeCents: number | null;
    netCents: number | null;
    items: { title: string; quantity: number }[];
  }[];
}
export const getSales = (businessId: string) => request<BusinessSales>(`/businesses/${businessId}/sales`);
