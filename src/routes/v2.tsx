import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import { Camera, Image as ImageIcon, XCircle, Check, ShieldCheck, Clock, Copy, ChevronRight, ChevronLeft, X, Phone } from "lucide-react";
import {
  getBaseTotalForCount,
  getCheckoutQuote,
  getUpsellPriceKey,
  type CheckoutPriceKey,
} from "../lib/checkout-pricing";
import type { OrderAccessResponse, OrderSummary, StoredOrderSession } from "../lib/order-contract";
import {
  clearStoredOrderSession,
  loadStoredOrderSession,
  pruneExpiredScopeSession,
  saveStoredOrderSession,
} from "../lib/order-session";

// ── Assets ──────────────────────────────────────────────────────────────────
import hugImg               from "../assets/jesus-moments/hug.png";
import smilingImg           from "../assets/jesus-moments/smiling.png";
import holdingHandsImg      from "../assets/jesus-moments/holding-hands.png";
import fieldImg             from "../assets/jesus-moments/field.png";

import hugPixeladoImg          from "../assets/jesus-moments/hug-pixelado.jpeg";
import smilingPixeladoImg      from "../assets/jesus-moments/smiling-pielado.jpeg";
import holdingHandsPixeladoImg from "../assets/jesus-moments/holding-hands-pixelado.jpeg";
import fieldPixeladoImg        from "../assets/jesus-moments/field-pixelado.jpeg";

import uploadErradoImg from "../assets/upload/upload-exemplo-ruim.jpeg";
import uploadIdealImg  from "../assets/upload/upload-foto-ideal.png";

import larBannerImg    from "../assets/institucional/lar-aconchego-banner.png";
import larLogoImg      from "../assets/institucional/lar-aconchego-logo.png";
import mpLogoImg       from "../assets/pagamento/mercado-pago-logo.png";

import dep1 from "../assets/depoimentos/depoimento-1.jpeg";
import dep2 from "../assets/depoimentos/depoimento-2.jpeg";
import dep3 from "../assets/depoimentos/depoimento-3.jpeg";
import dep4 from "../assets/depoimentos/depoimento-4.jpeg";
import dep5 from "../assets/depoimentos/depoimento-5.jpeg";

export const Route = createFileRoute("/v2")({
  component: AppFlowV2,
});

type Step = 'landing' | 'upload' | 'styles' | 'loading' | 'results' | 'phone' | 'pix';

const STYLES = [
  { id: 1, label: "Jesus te abraçando",         img: hugImg,          imgPixelado: hugPixeladoImg,          description: "Jesus te abraçando" },
  { id: 2, label: "Jesus ao seu lado sorrindo", img: smilingImg,      imgPixelado: smilingPixeladoImg,      description: "Jesus ao seu lado sorrindo" },
  { id: 3, label: "Jesus segurando sua mão",    img: holdingHandsImg, imgPixelado: holdingHandsPixeladoImg, description: "Jesus segurando sua mão" },
  { id: 4, label: "Momento no campo com Jesus", img: fieldImg,        imgPixelado: fieldPixeladoImg,        description: "Momento no campo com Jesus" },
];

const DEPOIMENTOS = [dep1, dep2, dep3, dep4, dep5];

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2)  return `(${digits}`;
  if (digits.length <= 7)  return `(${digits.slice(0,2)}) ${digits.slice(2)}`;
  if (digits.length <= 11) return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
  return value;
}

const PIX_RECOVERABLE_STATUSES = new Set([
  "payment_pending",
  "payment_approved",
  "processing",
  "partially_completed",
  "completed",
  "delivery_pending",
  "delivery_retry_requested",
  "delivery_sent",
  "processing_failed",
  "delivery_failed",
]);

function isCheckoutPriceKey(value: string | null): value is CheckoutPriceKey {
  return [
    "single",
    "double",
    "triple",
    "quad",
    "upsell_1_to_4",
    "upsell_2_to_4",
    "upsell_3_to_4",
  ].includes(value ?? "");
}

async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file);

  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Nao foi possivel ler a imagem"));
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function scaleDimensions(width: number, height: number, maxSize: number) {
  const scale = Math.min(1, maxSize / Math.max(width, height));
  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  };
}

function canvasToBase64(canvas: HTMLCanvasElement, quality: number) {
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  const base64 = dataUrl.split(",")[1];
  if (!base64) {
    throw new Error("Falha ao preparar a imagem");
  }

  return base64;
}

async function prepareUploadPayload(file: File) {
  const image = await loadImageFromFile(file);
  const originalSize = scaleDimensions(image.naturalWidth, image.naturalHeight, 1600);
  const previewSize = scaleDimensions(image.naturalWidth, image.naturalHeight, 512);

  const originalCanvas = document.createElement("canvas");
  originalCanvas.width = originalSize.width;
  originalCanvas.height = originalSize.height;
  const originalContext = originalCanvas.getContext("2d");
  if (!originalContext) {
    throw new Error("Falha ao preparar a imagem");
  }
  originalContext.drawImage(image, 0, 0, originalSize.width, originalSize.height);

  const previewCanvas = document.createElement("canvas");
  previewCanvas.width = previewSize.width;
  previewCanvas.height = previewSize.height;
  const previewContext = previewCanvas.getContext("2d");
  if (!previewContext) {
    throw new Error("Falha ao preparar a imagem");
  }
  previewContext.drawImage(image, 0, 0, previewSize.width, previewSize.height);

  return {
    mimeType: "image/jpeg",
    originalBase64: canvasToBase64(originalCanvas, 0.86),
    previewBase64: canvasToBase64(previewCanvas, 0.74),
  };
}

// Isolamento de sessão: esta rota ("/v2") usa exclusivamente as chaves *_v2.
const SESSION_SCOPE = "v2" as const;

function persistOrderSession(summary: OrderSummary): StoredOrderSession {
  const session = {
    accessToken: summary.accessToken,
    orderId: summary.id,
    recoveryCode: summary.recoveryCode,
  };

  saveStoredOrderSession(SESSION_SCOPE, session);
  return session;
}

// ── AppFlowV2 ─────────────────────────────────────────────────────────────────
function AppFlowV2() {
  const [currentStep, setCurrentStep]           = useState<Step>(() => {
    // Ao abrir: expira (e limpa) a sessão desta rota se passou do TTL de 6h.
    pruneExpiredScopeSession(SESSION_SCOPE);
    return 'landing';
  });
  const [selectedStyles, setSelectedStyles]     = useState<number[]>([STYLES[0].id]);
  const [resultsSelected, setResultsSelected]   = useState<number[]>([]);
  const [showUpsell, setShowUpsell]             = useState(false);
  const [pixValue, setPixValue]                 = useState<number>(10.90);
  const [pixLabel, setPixLabel]                 = useState<string>("1 imagem");
  const [checkoutPriceKey, setCheckoutPriceKey] = useState<CheckoutPriceKey>("single");
  const [checkoutStyleIds, setCheckoutStyleIds] = useState<number[]>([]);
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null);
  const [uploadedPhotoFile, setUploadedPhotoFile] = useState<File | null>(null);
  const [showPhotoConfirm, setShowPhotoConfirm] = useState(false);
  const [phoneNumber, setPhoneNumber]           = useState<string>("");
  const [showPhoneModal, setShowPhoneModal]     = useState(false);
  const [showPixModal, setShowPixModal]         = useState(false);
  const [pixOrderId, setPixOrderId]             = useState<string | null>(null);
  const [orderAccessToken, setOrderAccessToken] = useState<string | null>(null);
  const [pixRealCode, setPixRealCode]           = useState<string | null>(null);
  const [pixQrBase64, setPixQrBase64]           = useState<string | null>(null);
  const [pixCreating, setPixCreating]           = useState(false);
  const [pixError, setPixError]                 = useState<string | null>(null);
  const [photoUploading, setPhotoUploading]     = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);
  const [recoveringOrder, setRecoveringOrder]   = useState(true);
  const [orderSession, setOrderSession]         = useState<StoredOrderSession | null>(null);
  const [orderSummary, setOrderSummary]         = useState<OrderSummary | null>(null);
  const [initialPaymentStatus, setInitialPaymentStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryPhone, setRecoveryPhone]       = useState("");
  const [recoveryCodeInput, setRecoveryCodeInput] = useState("");
  const [recoveryLoading, setRecoveryLoading]   = useState(false);
  const [recoveryError, setRecoveryError]       = useState<string | null>(null);

  const nextStep = (step: Step) => {
    window.scrollTo(0, 0);
    setCurrentStep(step);
  };

  const hydrateOrder = useCallback((summary: OrderSummary) => {
    const session = persistOrderSession(summary);
    const restoredSelection = summary.purchasedStyleIds.length > 0
      ? summary.purchasedStyleIds
      : summary.selectedStyleIds;

    setOrderSession(session);
    setOrderSummary(summary);
    setUploadedPhotoUrl(summary.sourcePreviewUrl);
    setPixOrderId(summary.id);
    setOrderAccessToken(summary.accessToken);
    setPixRealCode(summary.pixCode);
    setPixQrBase64(summary.qrBase64);
    setCheckoutStyleIds(restoredSelection);
    setResultsSelected(restoredSelection);
    if (summary.phoneNumber) setPhoneNumber(maskPhone(summary.phoneNumber));
    if (typeof summary.amount === "number") setPixValue(summary.amount);
    if (summary.label) setPixLabel(summary.label);
    if (isCheckoutPriceKey(summary.priceKey)) setCheckoutPriceKey(summary.priceKey);

    if (summary.mpStatus === "approved") {
      setInitialPaymentStatus("approved");
    } else if (summary.mpStatus === "rejected" || summary.mpStatus === "cancelled") {
      setInitialPaymentStatus("rejected");
    } else {
      setInitialPaymentStatus("pending");
    }

    if (PIX_RECOVERABLE_STATUSES.has(summary.orderStatus) || summary.mpStatus === "pending") {
      setCurrentStep("results");
      setShowPixModal(true);
      return;
    }

    if (summary.orderStatus === "photo_uploaded") {
      setCurrentStep("styles");
      return;
    }

    setCurrentStep("upload");
  }, []);

  useEffect(() => {
    let cancelled = false;

    const restoreOrder = async () => {
      const session = loadStoredOrderSession(SESSION_SCOPE);
      if (!session) {
        if (!cancelled) setRecoveringOrder(false);
        return;
      }

      try {
        const query = new URLSearchParams({
          id: session.orderId,
          token: session.accessToken,
        });
        const res = await fetch(`/api/order-access?${query.toString()}`, {
          cache: "no-store",
        });

        if (!res.ok) {
          clearStoredOrderSession(SESSION_SCOPE);
          if (!cancelled) {
            setOrderSession(null);
            setRecoveringOrder(false);
          }
          return;
        }

        const data = await res.json() as OrderAccessResponse;
        if (cancelled) return;
        hydrateOrder(data.order);
      } catch {
        clearStoredOrderSession(SESSION_SCOPE);
      } finally {
        if (!cancelled) setRecoveringOrder(false);
      }
    };

    restoreOrder();
    return () => {
      cancelled = true;
    };
  }, [hydrateOrder]);

  useEffect(() => {
    return () => {
      if (uploadedPhotoUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(uploadedPhotoUrl);
      }
    };
  }, [uploadedPhotoUrl]);

  const handleFileSelect = (file: File) => {
    if (uploadedPhotoUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(uploadedPhotoUrl);
    }

    setUploadedPhotoFile(file);
    setUploadedPhotoUrl(URL.createObjectURL(file));
    setPhotoUploadError(null);
    setShowPhotoConfirm(true);
  };

  const handlePhotoConfirm = async () => {
    if (!uploadedPhotoFile || photoUploading) return;

    setPhotoUploadError(null);
    setPhotoUploading(true);

    try {
      const payload = await prepareUploadPayload(uploadedPhotoFile);
      const res = await fetch("/api/upload-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: orderSession?.accessToken,
          mimeType: payload.mimeType,
          orderId: orderSession?.orderId,
          originalBase64: payload.originalBase64,
          previewBase64: payload.previewBase64,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Erro ao salvar sua foto");
      }

      const data = await res.json() as OrderAccessResponse;
      hydrateOrder(data.order);
      setShowPhotoConfirm(false);
      nextStep("styles");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao salvar sua foto";
      setPhotoUploadError(message);
    } finally {
      setPhotoUploading(false);
    }
  };

  const handlePhotoRetry = () => {
    setShowPhotoConfirm(false);
    setPhotoUploadError(null);
    if (uploadedPhotoUrl) URL.revokeObjectURL(uploadedPhotoUrl);
    setUploadedPhotoFile(null);
    setUploadedPhotoUrl(null);
  };

  const goToPhone = (priceKey: CheckoutPriceKey, selectedStyleIds: number[]) => {
    const quote = getCheckoutQuote(priceKey, selectedStyleIds);
    setPixValue(quote.amount);
    setPixLabel(quote.label);
    setCheckoutPriceKey(priceKey);
    setCheckoutStyleIds(quote.selectedStyleIds);
    setShowPhoneModal(true);
  };

  const handleResultsContinue = () => {
    if (resultsSelected.length === 4) {
      goToPhone("quad", resultsSelected);
    } else {
      setShowUpsell(true);
    }
  };

  const handlePhoneConfirm = async () => {
    if (!orderSession) {
      setPixError("Seu pedido precisa ser recuperado antes de gerar o PIX.");
      nextStep("upload");
      return;
    }

    setShowPhoneModal(false);
    setShowPixModal(true);
    setPixCreating(true);
    setPixOrderId(null);
    setOrderAccessToken(null);
    setPixRealCode(null);
    setPixQrBase64(null);
    setPixError(null);
    setInitialPaymentStatus("pending");

    try {
      const res = await fetch("/api/create-pix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: orderSession.accessToken,
          orderId: orderSession.orderId,
          priceKey: checkoutPriceKey,
          phoneNumber,
          selectedStyleIds: checkoutStyleIds,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Erro ao criar cobrança");
      }

      const { orderId, accessToken, pixCode, qrBase64, recoveryCode, status } = await res.json() as {
        accessToken: string;
        orderId: string;
        pixCode: string | null;
        qrBase64: string | null;
        recoveryCode: string | null;
        status: string;
      };
      setPixOrderId(orderId);
      setOrderAccessToken(accessToken);
      setPixRealCode(pixCode);
      setPixQrBase64(qrBase64);
      setInitialPaymentStatus(status === "approved" ? "approved" : status === "rejected" ? "rejected" : "pending");
      const nextSession = { accessToken, orderId, recoveryCode };
      saveStoredOrderSession(SESSION_SCOPE, nextSession);
      setOrderSession(nextSession);
      setOrderSummary((prev) => prev ? {
        ...prev,
        accessToken,
        id: orderId,
        mpStatus: status,
        phoneNumber: phoneNumber.replace(/\D/g, ""),
        pixCode,
        qrBase64,
        recoveryCode,
        selectedStyleIds: checkoutStyleIds,
      } : prev);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao criar cobrança";
      setPixError(message);
    } finally {
      setPixCreating(false);
    }
  };

  const handleRecoverOrder = async () => {
    const digits = recoveryPhone.replace(/\D/g, "");
    if (digits.length !== 11 || recoveryCodeInput.trim().length < 6) {
      setRecoveryError("Informe o telefone e o codigo de recuperacao.");
      return;
    }

    setRecoveryLoading(true);
    setRecoveryError(null);

    try {
      const res = await fetch("/api/recover-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: digits,
          recoveryCode: recoveryCodeInput,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Nao foi possivel recuperar o pedido");
      }

      const data = await res.json() as OrderAccessResponse;
      hydrateOrder(data.order);
      setShowRecoveryModal(false);
      setRecoveryCodeInput("");
      setRecoveryPhone("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Nao foi possivel recuperar o pedido";
      setRecoveryError(message);
    } finally {
      setRecoveryLoading(false);
    }
  };

  if (recoveringOrder) {
    return (
      <div className="theme-v2">
        <div className="app-container min-h-screen flex items-center justify-center px-6">
          <div className="w-full max-w-[420px] rounded-[28px] border border-brand-gold/20 bg-[#140d06]/90 px-6 py-8 text-center shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur-sm">
            <div className="mx-auto mb-4 h-10 w-10 rounded-full border-2 border-brand-gold border-t-transparent animate-spin" />
            <p className="text-sm font-semibold text-white/80">Recuperando seu pedido...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="theme-v2">
        <div className="app-container">
          <div className="w-full max-w-[480px] min-h-screen relative overflow-x-hidden">
            {currentStep === 'landing'  && <LandingScreenV2  onNext={() => nextStep('upload')} onRecover={() => setShowRecoveryModal(true)} />}
            {currentStep === 'upload'   && <UploadScreenV2   onFileSelect={handleFileSelect} />}
            {currentStep === 'styles'   && (
              <StylesScreenV2 selectedIds={selectedStyles} setSelectedIds={setSelectedStyles} onNext={() => nextStep('loading')} />
            )}
            {currentStep === 'loading'  && <LoadingScreenV2  onFinish={() => nextStep('results')} />}
            {currentStep === 'results'  && (
              <ResultsScreenV2 selectedIds={resultsSelected} setSelectedIds={setResultsSelected} onContinue={handleResultsContinue} />
            )}
          </div>
        </div>
      </div>

      {/* Modals fora do overflow-x-hidden para fixed funcionar corretamente */}
      {showPhotoConfirm && uploadedPhotoUrl && (
        <PhotoConfirmModalV2
          photoUrl={uploadedPhotoUrl}
          onConfirm={handlePhotoConfirm}
          onRetry={handlePhotoRetry}
          isUploading={photoUploading}
          error={photoUploadError}
        />
      )}
      {showRecoveryModal && (
        <RecoveryModalV2
          phone={recoveryPhone}
          setPhone={setRecoveryPhone}
          recoveryCode={recoveryCodeInput}
          setRecoveryCode={setRecoveryCodeInput}
          loading={recoveryLoading}
          error={recoveryError}
          onRecover={handleRecoverOrder}
          onClose={() => setShowRecoveryModal(false)}
        />
      )}
      {showUpsell && (
        <UpsellModalV2
          selectedIds={resultsSelected}
          onAccept={(priceKey, selectedStyleIds) => { setShowUpsell(false); goToPhone(priceKey, selectedStyleIds); }}
          onDecline={(priceKey, selectedStyleIds) => { setShowUpsell(false); goToPhone(priceKey, selectedStyleIds); }}
          onClose={() => setShowUpsell(false)}
        />
      )}
      {showPhoneModal && (
        <PhoneModalV2
          phone={phoneNumber}
          setPhone={setPhoneNumber}
          onNext={handlePhoneConfirm}
          onClose={() => setShowPhoneModal(false)}
        />
      )}
      {showPixModal && (
        <PixModalV2
          accessToken={orderAccessToken}
          error={pixError}
          initialPaymentStatus={initialPaymentStatus}
          isCreating={pixCreating}
          label={pixLabel}
          orderId={pixOrderId}
          phoneNumber={phoneNumber}
          pixCode={pixRealCode}
          qrBase64={pixQrBase64}
          recoveryCode={orderSession?.recoveryCode ?? orderSummary?.recoveryCode ?? null}
          value={pixValue}
          onClose={() => setShowPixModal(false)}
        />
      )}
    </>
  );
}

// ── LANDING ───────────────────────────────────────────────────────────────────
function LandingScreenV2({ onNext, onRecover }: { onNext: () => void; onRecover: () => void }) {
  return (
    <div className="content-wrapper animate-in fade-in duration-300 text-center pt-6 pb-12">
      <section className="relative overflow-hidden rounded-[28px] border border-brand-gold/15 bg-[radial-gradient(circle_at_top,_rgba(245,166,35,0.22),_rgba(14,10,7,0.96)_42%,_#090604_100%)] px-5 py-8 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className="absolute left-[12%] top-8 h-1.5 w-1.5 rounded-full bg-brand-gold shadow-[0_0_18px_rgba(245,166,35,0.8)]" />
          <div className="absolute right-[16%] top-12 h-2 w-2 rounded-full bg-brand-gold/80 shadow-[0_0_20px_rgba(245,166,35,0.75)]" />
          <div className="absolute left-[22%] top-28 h-1 w-1 rounded-full bg-white/70" />
          <div className="absolute right-[26%] top-36 h-1.5 w-1.5 rounded-full bg-brand-gold/70" />
          <div className="absolute left-[18%] bottom-20 h-1.5 w-1.5 rounded-full bg-brand-gold/80" />
          <div className="absolute right-[12%] bottom-28 h-1 w-1 rounded-full bg-white/60" />
        </div>

        <div className="relative">
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-brand-gold/80">
            Experiência premium com IA
          </p>
          <h1 className="mt-4 text-[31px] font-black leading-[1.06] text-white">
            Veja como seria
            <br />
            viver um momento
            <br />
            <span className="text-brand-gold drop-shadow-[0_0_18px_rgba(245,166,35,0.38)]">ao lado de Jesus</span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/72">
            Uma lembrança visual emocionante, criada em segundos e entregue direto no seu WhatsApp.
          </p>

          <div className="mt-6 grid grid-cols-3 gap-2 text-left">
            <div className="rounded-2xl border border-white/8 bg-white/6 px-3 py-3 backdrop-blur-sm">
              <p className="text-lg font-black text-brand-gold">+12 mil</p>
              <p className="text-[11px] font-semibold leading-snug text-white/70">imagens geradas</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/6 px-3 py-3 backdrop-blur-sm">
              <p className="text-lg font-black text-brand-gold">24h</p>
              <p className="text-[11px] font-semibold leading-snug text-white/70">acesso ao pedido</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/6 px-3 py-3 backdrop-blur-sm">
              <p className="text-lg font-black text-brand-gold">PIX</p>
              <p className="text-[11px] font-semibold leading-snug text-white/70">pagamento imediato</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[26px] border border-white/8 bg-black/25 p-4 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-sm">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex-1 h-px bg-brand-gold/15" />
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-brand-gold/75">Escolha seu estilo</p>
          <div className="flex-1 h-px bg-brand-gold/15" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {STYLES.map((style) => (
            <div key={style.id} className="relative aspect-[3/4] overflow-hidden rounded-[22px] border border-brand-gold/20 bg-[#120d09] shadow-[0_16px_28px_rgba(0,0,0,0.28)]">
              <img src={style.img} alt={style.label} className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/5 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 px-3 py-3 text-left">
                <p className="text-[11px] font-bold leading-snug text-white">{style.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <button onClick={onNext} className="btn-primary btn-shimmer">
        CRIAR MINHA IMAGEM
      </button>

      <section className="grid grid-cols-3 gap-3 text-left">
        <div className="rounded-2xl border border-white/8 bg-white/6 px-3 py-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-gold/75">1</p>
          <p className="mt-2 text-sm font-bold text-white">Envie sua foto</p>
          <p className="mt-1 text-[11px] leading-snug text-white/65">Use uma selfie bem iluminada.</p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/6 px-3 py-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-gold/75">2</p>
          <p className="mt-2 text-sm font-bold text-white">Escolha os estilos</p>
          <p className="mt-1 text-[11px] leading-snug text-white/65">Selecione quantas imagens quiser.</p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/6 px-3 py-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-gold/75">3</p>
          <p className="mt-2 text-sm font-bold text-white">Receba no WhatsApp</p>
          <p className="mt-1 text-[11px] leading-snug text-white/65">Pagamento via Pix e entrega rápida.</p>
        </div>
      </section>

      <section className="rounded-[26px] border border-white/8 bg-black/25 p-4 text-left backdrop-blur-sm">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex-1 h-px bg-brand-gold/15" />
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-brand-gold/75">Depoimentos</p>
          <div className="flex-1 h-px bg-brand-gold/15" />
        </div>
        <TestimonialCarouselV2 images={DEPOIMENTOS} />
      </section>

      <section className="rounded-[26px] border border-brand-gold/20 bg-[linear-gradient(180deg,rgba(245,166,35,0.14),rgba(7,6,5,0.96))] px-5 py-6 shadow-[0_20px_50px_rgba(0,0,0,0.34)]">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-brand-gold/80">Pronto para ver o resultado?</p>
        <p className="mt-3 text-2xl font-black leading-tight text-white">
          Sua imagem pode ficar pronta
          <br />
          em poucos minutos.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-white/70">
          Escolha seu estilo favorito, gere o Pix e acompanhe seu pedido com segurança.
        </p>
        <button onClick={onNext} className="btn-primary mt-5">
          QUERO COMEÇAR AGORA
        </button>
        <button onClick={onRecover} className="mt-4 text-sm font-bold text-white/60 underline underline-offset-4">
          Recuperar pedido existente
        </button>
      </section>
    </div>
  );
}

// ── UPLOAD ────────────────────────────────────────────────────────────────────
function UploadScreenV2({ onFileSelect }: { onFileSelect: (file: File) => void }) {
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div className="content-wrapper animate-in fade-in duration-300">
      <header className="text-center">
        <h1 className="text-2xl text-foreground">Envie sua foto</h1>
        <p className="text-sm text-gray-400 mt-1">Passo 1 de 2</p>
      </header>

      <div className="border-2 border-red-400 bg-red-50/80 rounded-2xl p-4 flex flex-col items-center text-center gap-1 text-red-600">
        <p className="font-bold text-sm flex items-center gap-1.5"><XCircle size={16} className="shrink-0" /> IMPORTANTE</p>
        <p className="font-extrabold text-xs uppercase">NÃO FUNCIONA COM FOTOS DE CRIANÇAS!</p>
      </div>

      <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-brand-gold/20 flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-gray-600 text-center">
          A sua imagem ao lado de Jesus é criada com uma{" "}
          <strong className="text-foreground">Inteligência Artificial ultra realista</strong>.
          Para que fique parecida com você, a foto precisa seguir as orientações abaixo:
        </p>
        <p className="font-semibold text-foreground text-center text-sm">
          Uma <em>selfie do seu rosto</em>, bem iluminada.
        </p>

        <div className="flex gap-2 items-end">
          <div className="flex flex-col gap-2 flex-1">
            <div className="rounded-2xl overflow-hidden border-2 border-gray-200">
              <img src={uploadErradoImg} alt="Exemplo errado" className="w-full object-contain" />
            </div>
            <span className="text-[11px] text-gray-400 font-bold text-center">Tire assim</span>
          </div>
          <div className="flex flex-col items-center justify-center shrink-0 pb-6">
            <ChevronRight size={22} className="text-brand-gold" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col gap-2 flex-1">
            <div className="rounded-2xl overflow-hidden border-2 border-brand-gold">
              <img src={uploadIdealImg} alt="Foto ideal" className="w-full object-contain" />
            </div>
            <span className="text-[11px] text-brand-gold font-bold text-center">Foto ideal ✓</span>
          </div>
        </div>
      </div>

      <div className="bg-amber-50/80 rounded-2xl p-4 border border-amber-200/60">
        <p className="text-sm font-bold text-amber-800 flex items-center gap-2 mb-2">
          💡 Para melhores resultados:
        </p>
        <ul className="text-xs text-amber-700 space-y-1.5 list-none pl-1">
          <li>• Apenas <strong>1 pessoa</strong> na foto</li>
          <li>• Rosto <strong>próximo da câmera</strong> (evite corpo inteiro de longe)</li>
          <li>• Sem óculos escuros, boné ou chapéu</li>
          <li>• Não envie prints de tela com outras informações além da foto</li>
        </ul>
      </div>

      <div className="flex flex-col gap-3">
        <label className="btn-primary cursor-pointer flex items-center justify-center gap-2">
          <Camera size={20} /> TIRAR FOTO AGORA
          <input type="file" accept="image/*" capture="user" className="hidden" onChange={handleFile} />
        </label>
        <label className="btn-secondary cursor-pointer flex items-center justify-center gap-2">
          <ImageIcon size={20} /> ESCOLHER DA GALERIA
          <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </label>
      </div>

    </div>
  );
}

// ── PHOTO CONFIRM MODAL ───────────────────────────────────────────────────────
function PhotoConfirmModalV2({ photoUrl, onConfirm, onRetry, isUploading, error }: {
  photoUrl: string;
  onConfirm: () => void;
  onRetry: () => void;
  isUploading: boolean;
  error: string | null;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-[420px] rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-y-auto" style={{ maxHeight: '90dvh' }}>
        <div className="p-5 relative">
          <button onClick={onRetry} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600" disabled={isUploading}>
            <X size={24} />
          </button>

          <div className="border-2 border-red-400 bg-red-50/80 rounded-2xl p-3 flex flex-col items-center text-center gap-1 text-red-600 mb-5">
            <p className="font-bold text-sm flex items-center gap-1.5"><XCircle size={16} className="shrink-0" /> IMPORTANTE</p>
            <p className="font-extrabold text-xs uppercase">NÃO FUNCIONA COM FOTOS DE CRIANÇAS!</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="flex flex-col gap-1.5">
              <div className="rounded-2xl overflow-hidden border-2 border-gray-200 aspect-[3/4]">
                <img src={photoUrl} alt="Sua foto" className="w-full h-full object-cover" />
              </div>
              <p className="text-[11px] text-gray-500 font-bold text-center">Sua foto</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="rounded-2xl overflow-hidden border-2 border-brand-gold aspect-[3/4]">
                <img src={uploadIdealImg} alt="Foto ideal" className="w-full h-full object-cover" />
              </div>
              <p className="text-[11px] text-brand-gold font-bold text-center">Foto ideal ✓</p>
            </div>
          </div>

          <h3 className="text-xl text-foreground text-center mb-2">
            A sua foto segue as orientações?
          </h3>
          <p className="text-[11px] text-gray-400 text-center mb-6 px-2">
            Não nos responsabilizamos por resultados insatisfatórios causados pelo envio de fotos de baixa qualidade ou fora das orientações.
          </p>

          {error && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-600">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-3 pb-2">
            <button
              onClick={onConfirm}
              className={`flex items-center justify-center gap-2 rounded-[12px] py-[18px] font-extrabold uppercase shadow-md transition-all ${
                isUploading
                  ? "w-full cursor-not-allowed bg-gray-300 text-white"
                  : "btn-primary"
              }`}
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-white/80 border-t-transparent animate-spin" />
                  SALVANDO FOTO...
                </>
              ) : (
                <>
                  SIM, AVANÇAR <ChevronRight size={18} strokeWidth={3} />
                </>
              )}
            </button>
            <button onClick={onRetry} disabled={isUploading} className="text-sm text-gray-400 font-bold text-center py-2 disabled:opacity-60">
              Escolher outra foto
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────
function StylesScreenV2({ selectedIds, setSelectedIds, onNext }: {
  selectedIds: number[]; setSelectedIds: React.Dispatch<React.SetStateAction<number[]>>; onNext: () => void;
}) {
  useEffect(() => {
    if (selectedIds.length === 0) {
      setSelectedIds([STYLES[0].id]);
    }
  }, [selectedIds, setSelectedIds]);

  const toggleSelection = (id: number) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.length === 1 ? prev : prev.filter((item) => item !== id);
      }

      return [...prev, id];
    });
  };

  return (
    <div className="content-wrapper animate-in fade-in duration-300 text-center">
      <header>
        <p className="text-xs font-bold tracking-[0.2em] uppercase text-brand-gold/70 mb-1">Passo 2 de 2</p>
        <h1 className="text-2xl text-foreground">Escolha os estilos</h1>
        <p className="text-gray-500 mt-2 text-sm">
          Clique nas imagens que você mais gostou. Se gostou das 4, selecione as 4.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 mt-2">
        {STYLES.map((style) => {
          const isSelected = selectedIds.includes(style.id);
          return (
            <div
              key={style.id}
              onClick={() => toggleSelection(style.id)}
              className={`card-style relative aspect-[3/4] transition-all cursor-pointer overflow-hidden ${
                isSelected ? "border-[3px] border-brand-gold scale-[1.02]" : "border-[3px] border-transparent"
              }`}
            >
              <img src={style.img} alt={style.label} className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

              {isSelected && (
                <div className="absolute top-2 right-2 bg-brand-gold text-white rounded-full p-0.5 z-10 shadow-md">
                  <Check size={14} strokeWidth={4} />
                </div>
              )}

              <div className="absolute bottom-0 inset-x-0 bg-white/90 py-2 px-2 text-[10px] font-semibold text-foreground text-center border-t border-brand-gold/15">
                {style.label}
              </div>
            </div>
          );
        })}
      </div>

      <button
        className="btn-primary mt-6"
        onClick={onNext}
      >
        CONTINUAR
      </button>
    </div>
  );
}

// ── LOADING ───────────────────────────────────────────────────────────────────
function LoadingScreenV2({ onFinish }: { onFinish: () => void }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const duration = 3800;
    const interval = 20;
    const steps = duration / interval;
    const increment = 90 / steps;
    const timer = setInterval(() => {
      setProgress((prev) => { if (prev >= 90) { clearInterval(timer); return 90; } return prev + increment; });
    }, interval);
    const finishTimer = setTimeout(() => onFinish(), duration);
    return () => { clearInterval(timer); clearTimeout(finishTimer); };
  }, [onFinish]);

  return (
    <div className="content-wrapper animate-in fade-in duration-300 flex flex-col items-center justify-center min-h-[80vh] text-center">
      <div className="text-[72px] mb-6" style={{ animation: 'pulse 2s ease-in-out infinite' }}>🙏</div>
      <h2 className="text-2xl text-foreground mb-1">Criando sua imagem...</h2>
      <p className="text-gray-400 text-sm mb-8">Processando com IA · Aguarde</p>
      <div className="w-[70%] h-3 bg-[#E8D5A8] rounded-full overflow-hidden mb-4">
        <div
          className="h-full progress-bar-v2 rounded-full transition-all ease-in-out duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-gray-400 font-medium">Isso pode levar alguns segundos</p>
    </div>
  );
}

// ── RESULTS ───────────────────────────────────────────────────────────────────
function ResultsScreenV2({ selectedIds, setSelectedIds, onContinue }: {
  selectedIds: number[]; setSelectedIds: React.Dispatch<React.SetStateAction<number[]>>; onContinue: () => void;
}) {
  const [hasEverSelected, setHasEverSelected] = useState(false);

  const toggleSelection = (id: number) => {
    setSelectedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id];
      if (next.length > 0) setHasEverSelected(true);
      return next;
    });
  };

  const hasSelection = selectedIds.length > 0;
  const totalPrice = getBaseTotalForCount(selectedIds.length);

  return (
    <div className="content-wrapper animate-in fade-in duration-300">
      <header className="text-center">
        <h1 className="text-2xl text-foreground leading-tight">
          ✝️ Veja como ficou seu<br />momento com Jesus
        </h1>
        <p className="text-gray-400 italic mt-2 text-sm">
          "Um momento especial que você pode guardar para sempre"
        </p>
      </header>

      {/* Lar Aconchego Banner */}
      <div className="rounded-2xl overflow-hidden border-2 border-[#4da8da] shadow-sm">
        <img src={larBannerImg} alt="Lar Aconchego & Fé" className="w-full h-40 object-cover object-center" />
        <div className="bg-white/80 p-3 text-center">
          <p className="text-brand-gold font-bold text-sm leading-snug">
            💛 100% dos valores arrecadados serão doados para o{" "}
            <span className="underline">Lar Aconchego & Fé</span>
          </p>
        </div>
      </div>

      <div className="text-center">
        <p className="text-sm font-bold text-foreground">
          👇 Toque em <span className="text-brand-gold font-extrabold uppercase">CADA</span> imagem que você quer liberar
        </p>
        <p className="text-[11px] text-gray-400 mt-1">
          Você pode escolher <strong>mais de uma</strong> — toque em todas que quiser
        </p>
      </div>

      {/* Image Grid */}
      <div className="grid grid-cols-2 gap-3 mt-2">
        {STYLES.map((style) => {
          const isSelected = selectedIds.includes(style.id);
          return (
            <div
              key={style.id}
              onClick={() => toggleSelection(style.id)}
              className={`card-style relative aspect-[3/4] cursor-pointer overflow-hidden transition-all duration-200 ${
                isSelected ? "ring-[3px] ring-brand-gold shadow-lg" : "ring-0"
              }`}
            >
              {/* Foto pixelada — revelação via WhatsApp após pagamento */}
              <img
                src={style.imgPixelado}
                alt={style.label}
                className="absolute inset-0 w-full h-full object-contain bg-gray-900"
              />

              {/* Badge preço — canto superior esquerdo */}
              <div className="absolute top-0 left-0 right-0 z-10 flex flex-col items-start gap-0 px-2 pt-2">
                <span className="bg-black/70 text-white text-[8px] font-extrabold px-2 py-[3px] rounded-sm leading-tight backdrop-blur-[1px]">
                  Apenas R$ 10,90
                </span>
                <span className="bg-black/50 text-white/90 text-[6px] font-semibold px-2 py-[2px] rounded-sm leading-tight mt-[2px] backdrop-blur-[1px]">
                  Alta qualidade para baixar
                </span>
              </div>

              {/* Botão TOQUE — centro, só quando não selecionado */}
              {!isSelected && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <div className="bg-brand-gold text-white text-[11px] font-black px-4 py-1.5 rounded-full shadow-lg tracking-wide">
                    💛 TOQUE
                  </div>
                </div>
              )}

              {/* Rótulo inferior translúcido — v2 cores quentes */}
              <div className={`absolute bottom-0 inset-x-0 z-10 transition-colors duration-200 ${
                isSelected ? "bg-[#2C1A0E]/95" : "bg-[#8B6914]/95"
              }`}>
                <p className={`text-[9px] font-black text-center uppercase tracking-widest py-1.5 ${
                  isSelected ? "text-brand-gold" : "text-white"
                }`}>
                  {isSelected ? "SUA ESCOLHA" : "💛 LEVE TAMBÉM"}
                </p>
                <p className="text-[8px] text-white/80 font-semibold text-center pb-1.5 -mt-1 leading-tight px-1">
                  {style.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {hasEverSelected && (
        <div className="animate-in fade-in duration-500">
          <div className="flex flex-col gap-1.5 bg-amber-50/60 rounded-xl p-3 border border-amber-100 mt-4">
            <p className="text-xs text-amber-700 font-medium">⏳ Sua imagem fica disponível por tempo limitado</p>
            <p className="text-xs text-foreground font-medium">✝️ Imagem pronta para você guardar para sempre</p>
          </div>

          <div className="mt-6">
            {hasSelection && (
              <div className="bg-white/80 border border-brand-gold/30 rounded-2xl p-4 text-center shadow-sm mb-4">
                <p className="text-sm font-bold text-gray-500">
                  {selectedIds.length} {selectedIds.length === 1 ? "imagem selecionada" : "imagens selecionadas"}
                </p>
                <p className="text-2xl font-black text-brand-gold mt-1">
                  Total: R$ {totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            )}

            <button
              className={`btn-primary pulse-glow w-full flex flex-col items-center py-4 gap-0.5 transition-opacity ${!hasSelection ? 'opacity-50' : ''}`}
              onClick={hasSelection ? onContinue : undefined}
              disabled={!hasSelection}
            >
              <span className="font-extrabold text-base tracking-wide">LIBERAR MINHA IMAGEM AGORA</span>
              <span className="text-[11px] font-medium opacity-90">Pagamento rápido e seguro via Pix</span>
            </button>

            <p className="text-center text-xs text-gray-400 font-medium mt-2">Acesso imediato após o pagamento</p>
          </div>

          <div className="mt-6 mb-24">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex-1 h-px bg-brand-gold/20" />
              <h3 className="text-sm font-black text-foreground whitespace-nowrap">💬 O que as pessoas estão sentindo</h3>
              <div className="flex-1 h-px bg-brand-gold/20" />
            </div>
            <p className="text-[11px] font-medium text-gray-400 text-center mb-1">Centenas de famílias já guardaram seu momento com Jesus</p>
            <TestimonialCarouselV2 images={DEPOIMENTOS} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── UPSELL MODAL ──────────────────────────────────────────────────────────────
function UpsellModalV2({ selectedIds, onAccept, onDecline, onClose }: {
  selectedIds: number[];
  onAccept:  (priceKey: CheckoutPriceKey, selectedStyleIds: number[]) => void;
  onDecline: (priceKey: CheckoutPriceKey, selectedStyleIds: number[]) => void;
  onClose: () => void;
}) {
  const count = selectedIds.length;
  const selectedStyles = STYLES.filter(s => selectedIds.includes(s.id));
  const upsellPriceKey = getUpsellPriceKey(count);
  const declinePriceKey = getCheckoutQuote(
    count === 1 ? "single" : count === 2 ? "double" : "triple",
    selectedIds,
  ).priceKey;

  const popupData = (() => {
    const base = {
      title: "🔥 PROMOÇÃO RELÂMPAGO!",
      strikethrough: "R$ 43,60",
      acceptPriceKey: upsellPriceKey,
      declinePriceKey,
      upsellText: "",
      offerPrice: 0,
      economy: 0,
    };
    if (count === 1) return { ...base, upsellText: "Acrescente as outras 3 fotos com Jesus que você não selecionou por apenas", offerPrice: 22.60, economy: 21.00 };
    if (count === 2) return { ...base, upsellText: "Acrescente as outras 2 fotos com Jesus que você não selecionou por apenas", offerPrice: 29.60, economy: 14.00 };
    return { ...base, upsellText: "Acrescente a outra foto com Jesus que você não selecionou por apenas", offerPrice: 36.60, economy: 7.00 };
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/65 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-[400px] rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="p-4 relative text-center" style={{ background: 'linear-gradient(135deg, #F5A623 0%, #C8860A 100%)' }}>
          <h3 className="text-white font-black text-lg tracking-tight">{popupData.title}</h3>
          <button onClick={onClose} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white">
            <X size={24} strokeWidth={3} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 text-center">
          <div className="text-left">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 text-center">Você está levando</p>
            <div className="flex flex-col gap-1.5">
              {selectedStyles.map(s => (
                <div key={s.id} className="flex justify-between items-center text-sm font-bold text-foreground bg-amber-50/70 px-3 py-2 rounded-xl border border-amber-100">
                  <span>✓ {s.label}</span>
                  <span className="text-brand-gold">R$ 10,90</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-2 border-brand-gold/40 border-dashed bg-amber-50/50 rounded-2xl p-4">
            <p className="text-xs font-bold text-gray-600 leading-relaxed mb-1">{popupData.upsellText}</p>
            <p className="text-2xl font-black text-brand-gold">R$ 3,90 cada!</p>
          </div>

          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium text-gray-400">Aceitando agora você paga só</p>
            <p className="text-sm text-gray-300 line-through font-bold">De {popupData.strikethrough}</p>
            <p className="text-3xl font-black text-brand-gold">
              R$ {popupData.offerPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs font-bold text-gray-400 italic">pelas 4 imagens</p>
            <p className="text-brand-gold font-bold text-sm mt-1">
              👍 Economia de R$ {popupData.economy.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button onClick={() => onAccept(popupData.acceptPriceKey, selectedIds)} className="btn-primary py-4 text-base">
              Sim, quero todas! 💕
            </button>
            <button
              onClick={() => onDecline(popupData.declinePriceKey, selectedIds)}
              className="text-sm text-gray-400 underline font-bold"
            >
              Não, obrigado (continuar com R$ {getCheckoutQuote(popupData.declinePriceKey, selectedIds).amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── RECOVERY MODAL ────────────────────────────────────────────────────────────
function RecoveryModalV2({
  phone,
  setPhone,
  recoveryCode,
  setRecoveryCode,
  loading,
  error,
  onRecover,
  onClose,
}: {
  phone: string;
  setPhone: React.Dispatch<React.SetStateAction<string>>;
  recoveryCode: string;
  setRecoveryCode: React.Dispatch<React.SetStateAction<string>>;
  loading: boolean;
  error: string | null;
  onRecover: () => void;
  onClose: () => void;
}) {
  const digits = phone.replace(/\D/g, "");
  const isValid = digits.length === 11 && recoveryCode.trim().length >= 6;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/72 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-[420px] rounded-[28px] border border-white/8 bg-[#0f0a07] shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
        <div className="relative rounded-t-[28px] border-b border-white/8 bg-[linear-gradient(180deg,#1e160f_0%,#120d09_100%)] px-5 py-5 text-center">
          <button
            onClick={onClose}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
          >
            <X size={22} />
          </button>
          <p className="text-2xl mb-1">✦</p>
          <h3 className="text-sm font-black uppercase tracking-[0.22em] text-brand-gold">Recuperar pedido</h3>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <p className="text-sm leading-relaxed text-white/72 text-center">
            Informe o mesmo numero usado no pedido e o codigo de recuperacao exibido apos o pagamento.
          </p>

          <div className="flex items-stretch overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <div className="flex items-center gap-1.5 border-r border-white/10 bg-white/6 px-3">
              <span className="text-base">🇧🇷</span>
              <span className="text-sm font-black text-white">+55</span>
            </div>
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(maskPhone(e.target.value))}
              placeholder="(00) 00000-0000"
              className="flex-1 bg-transparent px-3 py-4 text-base font-bold text-white placeholder:text-white/28 outline-none"
            />
          </div>

          <input
            type="text"
            inputMode="numeric"
            value={recoveryCode}
            onChange={(e) => setRecoveryCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder="Codigo de recuperacao"
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-base font-bold text-white placeholder:text-white/28 outline-none"
          />

          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm font-semibold text-red-300">
              {error}
            </div>
          )}

          <button
            onClick={isValid ? onRecover : undefined}
            disabled={!isValid || loading}
            className={`btn-primary flex items-center justify-center gap-2 transition-opacity ${isValid ? "opacity-100" : "opacity-40"}`}
          >
            {loading ? "RECUPERANDO..." : "Recuperar pedido"} <ChevronRight size={18} strokeWidth={3} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PHONE MODAL ───────────────────────────────────────────────────────────────
function PhoneModalV2({ phone, setPhone, onNext, onClose }: {
  phone: string;
  setPhone: React.Dispatch<React.SetStateAction<string>>;
  onNext: () => void;
  onClose: () => void;
}) {
  const digits = phone.replace(/\D/g, "");
  const isValid = digits.length === 11;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/72 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-[420px] rounded-[28px] border border-white/8 bg-[#0f0a07] shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
        <div className="relative rounded-t-[28px] border-b border-white/8 bg-[linear-gradient(180deg,#1e160f_0%,#120d09_100%)] px-5 py-5 text-center">
          <button
            onClick={onClose}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
          >
            <X size={22} />
          </button>
          <p className="text-2xl mb-1">📲</p>
          <h3 className="text-sm font-black uppercase tracking-[0.22em] text-brand-gold">Vincule seu WhatsApp</h3>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <p className="text-sm leading-relaxed text-white/72 text-center">
            Seu numero sera vinculado ao pedido para entrega automatica e recuperacao posterior das imagens.
          </p>

          <div className="flex items-stretch overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <div className="flex items-center gap-1.5 border-r border-white/10 bg-white/6 px-3">
              <span className="text-base">🇧🇷</span>
              <span className="text-sm font-black text-white">+55</span>
            </div>
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(maskPhone(e.target.value))}
              placeholder="(00) 00000-0000"
              className="flex-1 bg-transparent px-3 py-4 text-base font-bold text-white placeholder:text-white/28 outline-none"
            />
          </div>

          <div className="rounded-2xl border border-brand-gold/15 bg-brand-gold/8 px-4 py-3 text-left">
            <p className="text-[11px] leading-relaxed text-white/70">
              A entrega acontece pelo WhatsApp assim que o pagamento for confirmado.
            </p>
          </div>

          <button
            onClick={isValid ? onNext : undefined}
            disabled={!isValid}
            className={`btn-primary flex items-center justify-center gap-2 transition-opacity ${isValid ? "opacity-100" : "opacity-40"}`}
          >
            Continuar para o pagamento <ChevronRight size={18} strokeWidth={3} />
          </button>

          <div className="flex items-center justify-center gap-2 text-white/50">
            <ShieldCheck size={14} className="shrink-0" />
            <p className="text-[11px]">Seus dados sao usados apenas para entrega das imagens.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── TESTIMONIAL CAROUSEL (V2) ─────────────────────────────────────────────────
function TestimonialCarouselV2({ images }: { images: string[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(0);
  const [containerW, setContainerW] = useState(0);
  const busy = useRef(false);
  const posRef = useRef(0);
  const total = images.length;

  const extended = [
    images[(total - 2 + total) % total],
    images[(total - 1 + total) % total],
    ...images,
    images[0],
    images[1 % total],
  ];

  const applyTranslate = (extIdx: number, w: number, animate: boolean) => {
    const track = trackRef.current;
    if (!track || !w) return;
    track.style.transition = animate ? 'transform 0.65s ease-in-out' : 'none';
    track.style.transform = `translateX(-${extIdx * (w / 2)}px)`;
  };

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const measure = () => {
      const w = wrap.clientWidth;
      setContainerW(w);
      applyTranslate(2 + posRef.current, w, false);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  const navigate = (dir: 1 | -1) => {
    if (busy.current || !containerW) return;
    busy.current = true;
    const nextPos = ((pos + dir) % total + total) % total;
    const extIdx = 2 + pos + dir;
    applyTranslate(extIdx, containerW, true);
    posRef.current = nextPos;
    setPos(nextPos);
    setTimeout(() => {
      if (extIdx < 2 || extIdx >= 2 + total) {
        applyTranslate(2 + nextPos, containerW, false);
      }
      busy.current = false;
    }, 700);
  };

  const jumpTo = (i: number) => {
    if (busy.current || !containerW) return;
    busy.current = true;
    posRef.current = i;
    setPos(i);
    applyTranslate(2 + i, containerW, true);
    setTimeout(() => { busy.current = false; }, 700);
  };

  return (
    <div className="relative overflow-hidden" ref={wrapRef}>
      <div ref={trackRef} className="flex will-change-transform">
        {extended.map((src, i) => (
          <div
            key={i}
            className="shrink-0 px-1.5"
            style={{ width: containerW > 0 ? `${containerW / 2}px` : '50%' }}
          >
            <img
              src={src}
              alt={`Depoimento ${(i % total) + 1}`}
              className="w-full rounded-2xl object-cover shadow-xl"
              loading="lazy"
            />
          </div>
        ))}
      </div>

      <button
        onClick={() => navigate(-1)}
        className="absolute left-0 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 backdrop-blur-sm shadow-md rounded-full flex items-center justify-center text-gray-600 z-10"
        aria-label="Anterior"
      >
        <ChevronLeft size={20} />
      </button>
      <button
        onClick={() => navigate(1)}
        className="absolute right-0 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 backdrop-blur-sm shadow-md rounded-full flex items-center justify-center text-gray-600 z-10"
        aria-label="Próximo"
      >
        <ChevronRight size={20} />
      </button>

      <div className="flex justify-center items-center gap-2 mt-3">
        {images.map((_, i) => (
          <button
            key={i}
            onClick={() => jumpTo(i)}
            className={`transition-all duration-300 rounded-full h-2 ${
              i === pos ? 'w-6 bg-brand-gold' : 'w-2 bg-gray-200'
            }`}
            aria-label={`Ir para depoimento ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

// ── PIX MODAL ─────────────────────────────────────────────────────────────────
function PixModalV2({
  value,
  label,
  pixCode,
  qrBase64,
  orderId,
  accessToken,
  phoneNumber,
  isCreating,
  error,
  initialPaymentStatus,
  recoveryCode,
  onClose,
}: {
  value: number;
  label: string;
  pixCode: string | null;
  qrBase64: string | null;
  orderId: string | null;
  accessToken: string | null;
  phoneNumber: string;
  isCreating: boolean;
  error: string | null;
  initialPaymentStatus: 'pending' | 'approved' | 'rejected';
  recoveryCode: string | null;
  onClose: () => void;
}) {
  const [timeLeft, setTimeLeft] = useState(15 * 60);
  const [showToast, setShowToast] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'approved' | 'rejected'>(initialPaymentStatus);

  useEffect(() => {
    setPaymentStatus(initialPaymentStatus);
  }, [initialPaymentStatus]);

  useEffect(() => {
    if (isCreating || !pixCode) return;
    const timer = setInterval(() => setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [isCreating, pixCode]);

  useEffect(() => {
    if (!orderId || !accessToken || paymentStatus !== 'pending') return;
    const interval = setInterval(async () => {
      try {
        const query = new URLSearchParams({ id: orderId, token: accessToken });
        const res = await fetch(`/api/payment-status?${query.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json() as { status: string };
        if (data.status === 'approved') {
          setPaymentStatus('approved');
        } else if (data.status === 'rejected' || data.status === 'cancelled') {
          setPaymentStatus('rejected');
        }
      } catch {
        // keep polling
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [accessToken, orderId, paymentStatus]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const copyPix = () => {
    if (!pixCode) return;
    navigator.clipboard.writeText(pixCode);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  if (paymentStatus === 'approved') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/78 backdrop-blur-md animate-in fade-in duration-200">
        <div className="w-full max-w-[430px] rounded-[30px] border border-brand-gold/15 bg-[#0f0a07] p-6 text-center shadow-[0_30px_90px_rgba(0,0,0,0.6)]">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/12">
            <Check size={38} className="text-green-400" strokeWidth={2.5} />
          </div>
          <h2 className="text-2xl font-black text-white">Pagamento confirmado</h2>
          <p className="mt-3 text-sm leading-relaxed text-white/72">
            Seu pedido esta salvo com seguranca e pronto para seguir para processamento.
          </p>
          {phoneNumber && (
            <p className="mt-4 text-base font-black text-brand-gold">📲 {phoneNumber}</p>
          )}
          {recoveryCode && (
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/6 p-4 text-left">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">Codigo de recuperacao</p>
              <p className="mt-2 text-2xl font-black tracking-[0.18em] text-white">{recoveryCode}</p>
            </div>
          )}
          <button onClick={onClose} className="btn-primary mt-6">
            FECHAR
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/78 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-[430px] overflow-hidden rounded-[30px] border border-brand-gold/15 bg-[#0f0a07] shadow-[0_30px_90px_rgba(0,0,0,0.6)]">
        <div className="relative border-b border-white/8 bg-[linear-gradient(180deg,#1b130d_0%,#100a06_100%)] px-5 py-5 text-center">
          <button
            onClick={onClose}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
          >
            <X size={22} />
          </button>
          <img src={mpLogoImg} alt="Mercado Pago" className="mx-auto mb-4 h-8 object-contain" />
          <h2 className="text-lg font-black uppercase tracking-[0.14em] text-white">Pagamento via Pix</h2>
          <p className="mt-2 text-sm font-medium text-brand-gold">{label} - R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>

        <div className="max-h-[76dvh] overflow-y-auto p-5 flex flex-col gap-4">
          <div className="rounded-2xl border border-brand-gold/12 bg-brand-gold/8 p-4">
            <p className="text-xs font-semibold leading-relaxed text-white/72">
              Sua cobranca sera gerada com seguranca pelo Mercado Pago e vinculada ao seu pedido.
            </p>
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-center">
              <p className="text-sm font-bold text-red-300">{error}</p>
            </div>
          ) : isCreating ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="h-10 w-10 rounded-full border-[3px] border-brand-gold border-t-transparent animate-spin" />
              <p className="text-sm font-bold text-white/72">Gerando cobranca PIX...</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/8 bg-white/6 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">Status</p>
                  <p className="mt-2 text-sm font-black text-brand-gold">Aguardando pagamento</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/6 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">Expira em</p>
                  <p className="mt-2 text-sm font-black text-brand-gold">{formatTime(timeLeft)}</p>
                </div>
              </div>

              <button onClick={copyPix} className="btn-primary flex items-center justify-center gap-2">
                <Copy size={18} /> COPIAR CODIGO PIX
              </button>

              <div className="rounded-2xl border border-white/8 bg-white/6 p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45 mb-2">Codigo copia e cola</p>
                <p className="break-all text-[11px] leading-relaxed text-white/70">{pixCode}</p>
              </div>

              <div className="text-center">
                <p className="text-sm font-semibold text-white/60 mb-4">Ou escaneie o QR Code</p>
                <div className="mx-auto flex h-52 w-52 items-center justify-center rounded-[24px] border-4 border-brand-gold/15 bg-white shadow-[0_20px_40px_rgba(0,0,0,0.22)]">
                  {qrBase64 ? (
                    <img
                      src={`data:image/png;base64,${qrBase64}`}
                      alt="QR Code PIX"
                      className="h-44 w-44 rounded-2xl"
                    />
                  ) : (
                    <div className="flex h-44 w-44 items-center justify-center rounded-2xl bg-gray-100 px-4 text-center text-[10px] font-medium text-gray-400">
                      QR Code indisponivel no momento
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          <div className="rounded-2xl border border-white/8 bg-white/6 p-4 flex items-start gap-3">
            <ShieldCheck size={18} className="text-green-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-white">Entrega via WhatsApp</p>
              <p className="mt-1 text-[11px] leading-relaxed text-white/65">
                Assim que o pagamento for confirmado, o pedido segue com o numero informado: {phoneNumber || "nao informado"}.
              </p>
            </div>
          </div>
        </div>

        {paymentStatus === 'pending' && !isCreating && !error && (
          <div className="border-t border-white/8 bg-white/5 px-4 py-3 text-center">
            <span className="text-xs font-bold text-white/62">Aguardando confirmacao do pagamento...</span>
          </div>
        )}
      </div>

      {showToast && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 rounded-full bg-black px-6 py-2 text-sm font-bold text-white animate-in fade-in slide-in-from-top-4 duration-300 z-[60]">
          Codigo copiado!
        </div>
      )}
    </div>
  );
}
