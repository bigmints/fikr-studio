"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Cpu,
  User,
  CreditCard,
  CalendarDays,
  ReceiptText,
  Key,
  Eye,
  EyeOff,
  Cloud,
  ExternalLink,
  LogOut,
  Zap,
  Shield,
  ArrowLeft,
  Sparkles,
  RefreshCw,
  Bot,
  ArrowUpRight,
  CheckCircle2,
  Loader2,
  Plus,
} from "lucide-react";
import { AI_PROVIDER_PRESETS, SECURE_KEY_MASK, getPreset, type AIProvider, type AISettings } from "@/lib/ai-settings";
import { signOut, onIdTokenChanged, User as FirebaseUser } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { analytics } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { ApiKeyBanner } from "@/components/api-key-banner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AgentMcpConnections } from "@/components/agent-mcp-connections";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type SettingsSection = "llm" | "tools" | "account";

interface SettingsPageProps {
  open: boolean;
  initialSection?: SettingsSection;
  aiSettings: AISettings;
  onUpdateAISettings: (patch: Partial<AISettings>) => void;
  onClose: () => void;
  /** Lifted auth state for usage polling in parent */
  onAuthChange?: (user: any, idToken: string | null, plan: string) => void;
  showApiKeyBanner?: boolean;
}

const NAV: { id: SettingsSection; label: string; description: string; Icon: React.FC<{ className?: string }> }[] = [
  { id: "llm",          label: "LLM Setup",       description: "API keys & provider",          Icon: Cpu },
  { id: "tools",        label: "Chat tools",      description: "MCP servers & permissions",    Icon: Bot },
  { id: "account",      label: "Account",          description: "Profile & billing",            Icon: User },
];

interface BillingSummary {
  plan: string;
  nextPayment: { amount: number | null; currency: string | null; date: string } | null;
  paymentMethod: {
    type: string;
    brand: string;
    last4: string | null;
    expMonth: number | null;
    expYear: number | null;
  } | null;
  invoices: Array<{
    id: string | null;
    number: string | null;
    date: string | null;
    amount: number | null;
    currency: string | null;
    status: string;
    url: string | null;
  }>;
  stripeAvailable: boolean;
}

function formatBillingDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatBillingAmount(amount: number | null | undefined, currency: string | null | undefined) {
  if (typeof amount !== "number" || !currency) return null;
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format(amount / 100);
}

function readablePaymentBrand(brand: string) {
  return brand.replace(/_/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
}

export function SettingsPage({
  open,
  initialSection = "account",
  aiSettings,
  onUpdateAISettings,
  onClose,
  onAuthChange,
  showApiKeyBanner = false,
}: SettingsPageProps) {
  const [section, setSection] = useState<SettingsSection>(initialSection);
  const [draft, setDraft] = useState<AISettings>(aiSettings);
  const [showKey, setShowKey] = useState(false);
  const [providerDialogOpen, setProviderDialogOpen] = useState(false);
  const [isVerifyingProvider, setIsVerifyingProvider] = useState(false);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userPlan, setUserPlan] = useState("Free");
  const [billing, setBilling] = useState<BillingSummary | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const isPro = userPlan.toLowerCase().includes("pro");
  const isPlus = userPlan.toLowerCase().includes("plus");
  const isManagedPlan = isPro || isPlus;
  const currentPreset = getPreset(draft.provider);
  const configuredPreset = getPreset(aiSettings.provider);
  const hasConfiguredProvider = Boolean(aiSettings.apiKey);

  // Jump to correct section when opened from different menu items
  useEffect(() => {
    if (open) {
      setSection(initialSection);
      setDraft(aiSettings);
      setProviderDialogOpen(false);
      setProviderError(null);
      setIsVerifyingProvider(false);
    }
  }, [open, initialSection, aiSettings]);

  // Firebase authentication; account authority comes from verified fikr.one APIs.
  useEffect(() => {
    const auth = getFirebaseAuth();
    // onIdTokenChanged fires for sign-in, sign-out, and automatic Firebase ID
    // token refreshes. Relay polling must not silently expire after one hour.
    const unsub = onIdTokenChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        setBillingLoading(true);
        const token = await u.getIdToken().catch(() => null);
        const ipc = (window as any).fikrStudio;
        const verified = token && ipc?.setUser
          ? await ipc.setUser(u.uid, token).catch(() => null)
          : null;
        const planRaw = verified?.plan || "free";
        const plan = planRaw.charAt(0).toUpperCase() + planRaw.slice(1);
        setUserPlan(plan);
        onAuthChange?.(u, token, plan);

        const account = verified && ipc?.getAccount
          ? await ipc.getAccount().catch(() => verified)
          : verified;
        setBilling(account?.billing ?? null);
        setBillingLoading(false);
      } else {
        const ipc = (window as any).fikrStudio;
        if (ipc?.setUser) await ipc.setUser(null, null).catch(() => null);
        setUserPlan("Free");
        setBilling(null);
        setBillingLoading(false);
        onAuthChange?.(null, null, "Free");
      }
    });
    return () => unsub();
  }, [onAuthChange]);

  const openProviderDialog = () => {
    setDraft({ ...aiSettings, apiKey: "" });
    setShowKey(false);
    setProviderError(null);
    setIsVerifyingProvider(false);
    setProviderDialogOpen(true);
  };

  const handleProviderDialogChange = (nextOpen: boolean) => {
    if (!nextOpen && isVerifyingProvider) return;
    setProviderDialogOpen(nextOpen);
    if (!nextOpen) {
      setProviderError(null);
      setIsVerifyingProvider(false);
      setShowKey(false);
    }
  };

  const handleVerifyAndSaveProvider = async () => {
    const apiKey = draft.apiKey.trim();
    if (!apiKey) {
      setProviderError("Enter an API key.");
      return;
    }

    const ipc = typeof window !== "undefined" ? (window as any).fikrStudio : null;
    if (!ipc?.verifyAndSetAiKey) {
      setProviderError("Open Fikr Studio desktop to verify and save this provider.");
      return;
    }

    setProviderError(null);
    setIsVerifyingProvider(true);
    try {
      const result = await ipc.verifyAndSetAiKey(draft.provider, apiKey);
      if (!result?.ok) {
        if (result?.status === 401 || result?.status === 403) {
          setProviderError("This API key was not accepted. Check it and try again.");
        } else {
          setProviderError("Fikr couldn’t verify this provider. Try again.");
        }
        return;
      }

      onUpdateAISettings({ ...draft, apiKey: SECURE_KEY_MASK });
      analytics.track("settings_save", { provider: draft.provider });
      setProviderDialogOpen(false);
      toast.success(`${currentPreset.label} connected`);
    } catch (error) {
      setProviderError(error instanceof Error ? error.message : "Fikr couldn’t verify this provider. Try again.");
    } finally {
      setIsVerifyingProvider(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent
        showCloseButton={false}
        className="inset-0 left-0 top-0 z-[300] flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 p-0 shadow-none sm:max-w-none"
        style={{ WebkitAppRegion: "no-drag" } as any}
      >
        {showApiKeyBanner && <ApiKeyBanner onAddKey={() => { setSection("llm"); openProviderDialog(); }} />}

        <div className="flex min-h-0 flex-1 flex-col md:flex-row" data-testid="settings-layout">
          {/* ── Left sidebar ────────────────────────────────── */}
          <aside className="flex h-auto w-full shrink-0 flex-col border-b border-border/50 bg-sidebar md:h-full md:w-[var(--fikr-context-sidebar-width)] md:border-b-0 md:border-r">
            <header className="flex h-14 shrink-0 items-center border-b border-border px-3">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                className="group -ml-1 h-8 gap-2 px-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
                Back to workspace
              </Button>
            </header>

            <div className="hidden px-4 pb-2 pt-4 md:block">
              <p className="text-xs font-bold uppercase tracking-wider text-primary">
                Settings
              </p>
            </div>

            <nav className="flex flex-1 gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:gap-0.5 md:overflow-visible md:px-2 md:pb-0">
              {NAV.map(({ id, label, description, Icon }) => (
                <Button
                  key={id}
                  type="button"
                  variant="ghost"
                  onClick={() => { analytics.track("settings_nav", { section: id }); setSection(id); }}
                  className={`group flex min-h-11 min-w-max items-center justify-start gap-2 rounded-md px-3 text-left transition-colors duration-100 md:w-full md:gap-3 ${
                    section === id
                      ? "bg-primary/12 text-primary"
                      : "text-foreground/70 hover:bg-primary/8 hover:text-primary"
                  }`}
                >
                  <Icon className="size-5 shrink-0 text-primary/75 group-hover:text-primary" />
                  <div className="flex flex-col leading-none gap-0.5">
                    <span className="text-sm font-semibold">{label}</span>
                    <span className="hidden text-xs text-muted-foreground/70 md:block">{description}</span>
                  </div>
                </Button>
              ))}
            </nav>

          </aside>

          {/* ── Main content ────────────────────────────────── */}
          <div className="flex-1 flex flex-col min-w-0">
            <header className="flex h-14 shrink-0 items-center border-b border-border px-5 sm:px-8">
              <div className="min-w-0">
                <DialogTitle className="truncate text-lg font-bold leading-tight tracking-tight">{NAV.find(n => n.id === section)?.label}</DialogTitle>
                <DialogDescription className="text-xs">{NAV.find(n => n.id === section)?.description}</DialogDescription>
              </div>
            </header>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="mx-auto w-full max-w-[720px] space-y-7 px-5 py-6 sm:px-8 md:py-8">

                {/* ── LLM Setup ── */}
                {section === "llm" && (
                  <Dialog open={providerDialogOpen} onOpenChange={handleProviderDialogChange}>
                    <section aria-labelledby="ai-providers-heading">
                      <div className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center">
                        <div>
                          <h2 id="ai-providers-heading" className="text-lg font-semibold text-foreground">AI provider</h2>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">Connect a provider to use AI across Fikr Studio.</p>
                        </div>
                        <Button type="button" size="sm" onClick={openProviderDialog} className="w-full shrink-0 sm:w-auto">
                          <Plus className="size-4" />
                          {hasConfiguredProvider ? "Change provider" : "Add provider"}
                        </Button>
                      </div>

                      {hasConfiguredProvider ? (
                        <Card className="mt-6 gap-0 border-0 bg-muted/20 py-0 shadow-none">
                          <CardContent className="flex min-h-20 items-center gap-3 px-4 py-4">
                            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-background text-muted-foreground shadow-xs">
                              <Cpu className="size-[18px]" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-foreground">{configuredPreset.label}</p>
                              <p className="text-xs text-muted-foreground">API key saved on this Mac</p>
                            </div>
                            <span className="hidden items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 sm:flex">
                              <CheckCircle2 className="size-3.5" /> Saved
                            </span>
                            <Button type="button" size="sm" variant="outline" onClick={openProviderDialog}>Change</Button>
                          </CardContent>
                        </Card>
                      ) : (
                        <Card className="mt-6 gap-0 border-dashed bg-muted/20 py-0 shadow-none">
                          <CardContent className="flex min-h-44 flex-col items-center justify-center px-6 py-8 text-center">
                            <span className="grid size-10 place-items-center rounded-xl bg-background text-muted-foreground shadow-xs">
                              <Cpu className="size-[18px]" />
                            </span>
                            <p className="mt-4 text-sm font-semibold text-foreground">No AI provider added</p>
                            <p className="mt-1 max-w-sm text-sm leading-5 text-muted-foreground">Add a provider, verify your API key, and start using AI.</p>
                          </CardContent>
                        </Card>
                      )}

                      <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                          <DialogTitle>{hasConfiguredProvider ? "Change AI provider" : "Add AI provider"}</DialogTitle>
                          <DialogDescription>Choose a provider and enter its API key. Fikr will verify it before saving.</DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-5">
                          <div className="grid gap-2">
                            <label className="text-sm font-medium text-foreground" htmlFor="provider-setup-provider">Provider</label>
                            <Select
                              value={draft.provider}
                              disabled={isVerifyingProvider}
                              onValueChange={(value) => setDraft((current) => {
                                const provider = value as AIProvider;
                                if (current.provider === provider) return current;
                                return {
                                  ...current,
                                  provider,
                                  apiKey: "",
                                  taskModels: { analysis: null, tools: null, transcription: null, vision: null, embedding: null },
                                };
                              })}
                            >
                              <SelectTrigger id="provider-setup-provider" aria-label="AI provider" className="min-h-11 w-full bg-background px-3.5">
                                <span className="flex min-w-0 items-center gap-2.5">
                                  <Cpu className="size-4 shrink-0 text-muted-foreground" />
                                  <SelectValue />
                                </span>
                              </SelectTrigger>
                              <SelectContent>
                                {AI_PROVIDER_PRESETS.map((preset) => (
                                  <SelectItem key={preset.id} value={preset.id}>{preset.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="grid gap-2">
                            <div className="flex items-center justify-between gap-3">
                              <label htmlFor="provider-setup-key" className="text-sm font-medium text-foreground">API key</label>
                              {currentPreset.keyUrl && currentPreset.keyUrl !== "#" && (
                                <a href={currentPreset.keyUrl} target="_blank" rel="noopener noreferrer" className="flex shrink-0 items-center gap-1 text-xs text-primary hover:underline">
                                  Get a key <ExternalLink className="size-3" />
                                </a>
                              )}
                            </div>
                            <div className="relative">
                              <Key className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                id="provider-setup-key"
                                type={showKey ? "text" : "password"}
                                value={draft.apiKey}
                                onChange={(event) => { setDraft((current) => ({ ...current, apiKey: event.target.value })); setProviderError(null); }}
                                placeholder={currentPreset.keyPlaceholder || "Paste your API key"}
                                className="h-11 pl-10 pr-11"
                                autoComplete="off"
                                spellCheck={false}
                                disabled={isVerifyingProvider}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={showKey ? "Hide API key" : "Show API key"}
                                onClick={() => setShowKey((visible) => !visible)}
                                disabled={isVerifyingProvider}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                              >
                                {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                              </Button>
                            </div>
                            <p className="text-xs leading-5 text-muted-foreground">Verified securely, then stored only on this Mac.</p>
                          </div>

                          {providerError && (
                            <p role="alert" className="rounded-md bg-destructive/8 px-3 py-2.5 text-sm text-destructive">{providerError}</p>
                          )}
                        </div>

                        <DialogFooter>
                          <DialogClose asChild>
                            <Button type="button" variant="outline" disabled={isVerifyingProvider}>Cancel</Button>
                          </DialogClose>
                          <Button type="button" onClick={() => void handleVerifyAndSaveProvider()} disabled={isVerifyingProvider || !draft.apiKey.trim()}>
                            {isVerifyingProvider && <Loader2 className="size-4 animate-spin" />}
                            {isVerifyingProvider ? "Verifying…" : "Verify and save"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </section>
                  </Dialog>
                )}

                {/* ── Chat tools ── */}
                {section === "tools" && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <AgentMcpConnections embedded />
                  </motion.div>
                )}

                {/* ── Account ── */}
                {section === "account" && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col gap-8"
                  >
                    {user ? (
                      <>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                          <div className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-lg font-semibold text-foreground">
                            {user.photoURL
                              ? <img src={user.photoURL} alt="" className="h-full w-full object-cover" />
                              : (user.displayName?.charAt(0) || user.email?.charAt(0) || "U").toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-base font-semibold text-foreground">{user.displayName || "Fikr User"}</p>
                            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => window.open("https://fikr.one/dashboard/billing", "_blank")}
                            className="w-full sm:w-auto"
                          >
                            View billing on fikr.one
                            <ArrowUpRight className="size-4" />
                          </Button>
                        </div>

                        {billingLoading ? (
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="h-36 animate-pulse rounded-xl border border-border bg-muted/30 sm:col-span-2" />
                            <div className="h-28 animate-pulse rounded-xl border border-border bg-muted/30" />
                            <div className="h-28 animate-pulse rounded-xl border border-border bg-muted/30" />
                          </div>
                        ) : (
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Card className="gap-4 overflow-hidden border-primary/20 bg-primary/[0.055] py-5 shadow-none sm:col-span-2">
                              <CardHeader className="flex-row items-start justify-between gap-4 px-5">
                                <div className="space-y-1.5">
                                  <CardDescription>Current plan</CardDescription>
                                  <CardTitle className="text-2xl">{userPlan}</CardTitle>
                                </div>
                                <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                                  isPro
                                    ? "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                    : isPlus
                                      ? "border-teal-500/25 bg-teal-500/10 text-teal-700 dark:text-teal-300"
                                      : "border-border bg-background text-muted-foreground"
                                }`}>
                                  {isManagedPlan ? "Active" : "Local"}
                                </span>
                              </CardHeader>
                              <CardContent className="px-5">
                                <p className="max-w-lg text-sm leading-6 text-muted-foreground">
                                  {isPro
                                    ? "Managed AI, cloud sync, and 1.5 million words each month."
                                    : isPlus
                                      ? "Managed AI, cloud sync, and 500,000 words each month."
                                      : "Use your own AI key and keep your workspace on this computer."}
                                </p>
                              </CardContent>
                            </Card>

                            <Card className="gap-4 py-5 shadow-none">
                              <CardHeader className="flex-row items-center gap-3 px-5">
                                <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                                  <CalendarDays className="size-4" />
                                </div>
                                <div className="space-y-1">
                                  <CardDescription>Next payment</CardDescription>
                                  <CardTitle className="text-base">
                                    {formatBillingAmount(billing?.nextPayment?.amount, billing?.nextPayment?.currency)
                                      ?? (billing?.nextPayment ? "Scheduled" : "None scheduled")}
                                  </CardTitle>
                                </div>
                              </CardHeader>
                              <CardContent className="px-5 text-sm text-muted-foreground">
                                {formatBillingDate(billing?.nextPayment?.date)
                                  ?? (isManagedPlan ? "Check fikr.one for renewal details" : "Free plan")}
                              </CardContent>
                            </Card>

                            <Card className="gap-4 py-5 shadow-none">
                              <CardHeader className="flex-row items-center gap-3 px-5">
                                <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                                  <CreditCard className="size-4" />
                                </div>
                                <div className="min-w-0 space-y-1">
                                  <CardDescription>Payment method</CardDescription>
                                  <CardTitle className="truncate text-base">
                                    {billing?.paymentMethod
                                      ? `${readablePaymentBrand(billing.paymentMethod.brand)}${billing.paymentMethod.last4 ? ` •••• ${billing.paymentMethod.last4}` : ""}`
                                      : "Not available"}
                                  </CardTitle>
                                </div>
                              </CardHeader>
                              <CardContent className="px-5 text-sm text-muted-foreground">
                                {billing?.paymentMethod?.expMonth && billing.paymentMethod.expYear
                                  ? `Expires ${String(billing.paymentMethod.expMonth).padStart(2, "0")}/${String(billing.paymentMethod.expYear).slice(-2)}`
                                  : (isManagedPlan ? "Managed securely on fikr.one" : "No card required")}
                              </CardContent>
                            </Card>
                          </div>
                        )}

                        <Card className="gap-0 overflow-hidden py-0 shadow-none">
                          <CardHeader className="flex-row items-center gap-3 border-b border-border px-5 py-4">
                            <ReceiptText className="size-4 text-muted-foreground" />
                            <div className="space-y-0.5">
                              <CardTitle className="text-sm">Invoice history</CardTitle>
                              <CardDescription className="text-xs">Your latest billing receipts</CardDescription>
                            </div>
                          </CardHeader>
                          <CardContent className="p-0">
                            {billingLoading ? (
                              <div className="space-y-3 p-5">
                                <div className="h-10 animate-pulse rounded-md bg-muted/40" />
                                <div className="h-10 animate-pulse rounded-md bg-muted/40" />
                              </div>
                            ) : billing?.invoices?.length ? (
                              <div className="divide-y divide-border">
                                {billing.invoices.map((invoice, index) => {
                                  const invoiceAmount = formatBillingAmount(invoice.amount, invoice.currency);
                                  const invoiceDate = formatBillingDate(invoice.date);
                                  return (
                                    <div key={invoice.id ?? `${invoice.date}-${index}`} className="flex items-center gap-3 px-5 py-3.5">
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-foreground">{invoice.number || "Invoice"}</p>
                                        <p className="text-xs text-muted-foreground">{invoiceDate || "Date unavailable"}</p>
                                      </div>
                                      <div className="shrink-0 text-right">
                                        <p className="text-sm font-medium tabular-nums">{invoiceAmount || "—"}</p>
                                        <p className="text-xs capitalize text-muted-foreground">{invoice.status}</p>
                                      </div>
                                      {invoice.url && (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon-sm"
                                          aria-label={`Open ${invoice.number || "invoice"}`}
                                          onClick={() => window.open(invoice.url!, "_blank")}
                                        >
                                          <ArrowUpRight className="size-4" />
                                        </Button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="px-5 py-8 text-center">
                                <p className="text-sm font-medium text-foreground">No invoices yet</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {isManagedPlan ? "New receipts will appear here after payment." : "Invoices appear after you subscribe on fikr.one."}
                                </p>
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        <div className="flex items-center justify-between gap-4 border-t border-border pt-5">
                          <div>
                            <p className="text-sm font-medium text-foreground">Sign out of Fikr Studio</p>
                            <p className="text-xs text-muted-foreground">Your local workspace stays on this computer.</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => signOut(getFirebaseAuth())}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <LogOut className="size-4" />
                            Sign out
                          </Button>
                        </div>
                      </>
                    ) : (
                      <Card className="gap-0 overflow-hidden border-0 bg-transparent py-0 shadow-none">
                        <div className="bg-gradient-to-br from-primary/16 via-primary/7 to-background px-6 py-7 sm:px-8 sm:py-9">
                          <span className="mb-4 flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm"><Cloud className="size-5" /></span>
                          <CardTitle className="max-w-md text-xl">Your Fikr account, in one place</CardTitle>
                          <CardDescription className="mt-2 max-w-lg leading-6">Sign in to see your plan, next payment, payment method, and invoice history.</CardDescription>
                        </div>
                        <CardContent className="px-6 py-6 sm:px-8">

                          <div className="grid w-full gap-x-8 gap-y-5 text-left sm:grid-cols-2">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 rounded-md bg-muted p-1.5 text-foreground">
                                <RefreshCw className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="font-semibold text-sm text-foreground">Cloud Sync</p>
                                <p className="text-xs text-muted-foreground mt-0.5">Account-scoped workspace mirror</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 rounded-md bg-muted p-1.5 text-foreground">
                                <Sparkles className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="font-semibold text-sm text-foreground">Managed AI</p>
                                <p className="text-xs text-muted-foreground mt-0.5">Verified Plus or Pro access</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 rounded-md bg-muted p-1.5 text-foreground">
                                <Zap className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="font-semibold text-sm text-foreground">Messenger Notes</p>
                                <p className="text-xs text-muted-foreground mt-0.5">Remote note delivery while Studio is closed</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 rounded-md bg-muted p-1.5 text-foreground">
                                <Shield className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="font-semibold text-sm text-foreground">Private & Secure</p>
                                <p className="text-xs text-muted-foreground mt-0.5">Your data is yours</p>
                              </div>
                            </div>
                          </div>

                          {loginError && <p className="text-sm font-bold text-destructive mb-4 px-4 py-2 bg-destructive/10 rounded-lg">{loginError}</p>}
                          
                          <Button
                            type="button"
                            onClick={() => { setLoginError(""); (window as any).fikrStudio?.openAuth(); }}
                            className="mt-6"
                          >
                            Sign in with Fikr Cloud
                          </Button>
                          
                          <p className="text-xs font-medium text-muted-foreground mt-4">
                            Free plan available. No credit card required.
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </motion.div>
                )}

              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
