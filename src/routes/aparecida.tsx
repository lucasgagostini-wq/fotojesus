import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import { Camera, Image as ImageIcon, XCircle, Check, ShieldCheck, Clock, Copy, ChevronRight, ChevronLeft, X } from "lucide-react";
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
  saveStoredOrderSession,
} from "../lib/order-session";
import { pixelTrack } from "../lib/pixel";

// ── Assets ──────────────────────────────────────────────────────────────────
import aparecidaAbracImg      from "../assets/aparecida-moments/aparecida-abraco.png";
import aparecidaSantuarioImg  from "../assets/aparecida-moments/aparecida-santuario.png";
import aparecidaMaosDadasImg  from "../assets/aparecida-moments/aparecida-maos-dadas.png";
import aparecidaBencaoImg     from "../assets/aparecida-moments/aparecida-bencao.png";

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

export const Route = createFileRoute("/aparecida")({
  component: AppFlowAparecida,
});

type Step = 'landing' | 'upload' | 'styles' | 'loading' | 'results' | 'pix';

const STYLES = [
  { id: 1, label: "Nossa Senhora te abraçando",      img: aparecidaAbracImg,     imgPixelado: aparecidaAbracImg,     description: "Nossa Senhora te abraçando" },
  { id: 2, label: "Nossa Senhora ao seu lado",        img: aparecidaSantuarioImg, imgPixelado: aparecidaSantuarioImg, description: "Nossa Senhora ao seu lado" },
  { id: 3, label: "Nossa Senhora segurando sua mão",  img: aparecidaMaosDadasImg, imgPixelado: aparecidaMaosDadasImg, description: "Nossa Senhora segurando sua mão" },
  { id: 4, label: "Um momento de graça com Ela",      img: aparecidaBencaoImg,    imgPixelado: aparecidaBencaoImg,    description: "Um momento de graça com Ela" },
];

const DEPOIMENTOS = [dep1, dep2, dep3, dep4, dep5];

// ── Phone mask ───────────────────────────────────────────────────────────────
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

function persistOrderSession(summary: OrderSummary): StoredOrderSession {
  const session = {
    accessToken: summary.accessToken,
    orderId: summary.id,
    recoveryCode: summary.recoveryCode,
  };

  saveStoredOrderSession(session);
  return session;
}

// ── AppFlowAparecida ──────────────────────────────────────────────────────────
function AppFlowAparecida() {
  const [currentStep, setCurrentStep]           = useState<Step>('landing');
  const [selectedStyles, setSelectedStyles]     = useState<number[]>([]);
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

  const nextStep = (step: Step) => { window.scrollTo(0, 0); setCurrentStep(step); };

  const hydrateOrder = useCallback((summary: OrderSummary, options?: { navigate?: boolean }) => {
    const shouldNavigate = options?.navigate ?? true;

    const session = persistOrderSession(summary);
    setOrderSession(session);
    setOrderSummary(summary);
    setUploadedPhotoUrl(summary.sourcePreviewUrl);
    setPixOrderId(summary.id);
    setOrderAccessToken(summary.accessToken);
    setPixRealCode(summary.pixCode);
    setPixQrBase64(summary.qrBase64);
    setCheckoutStyleIds(summary.selectedStyleIds);
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

    // Hidratação em segundo plano (ex.: upload pós-confirmação) apenas atualiza os
    // dados do pedido — nunca redireciona o usuário pelo funil.
    if (!shouldNavigate) {
      return;
    }

    // Só reabrir o checkout PIX se houver evidência REAL de PIX criado.
    // mpStatus === "pending" sozinho NÃO conta: todo pedido recém-criado nasce
    // "pending" no banco, mesmo sem nenhum PIX gerado.
    const hasRealPix = Boolean(summary.pixCode) || Boolean(summary.qrBase64);
    const checkoutAlreadyStarted = PIX_RECOVERABLE_STATUSES.has(summary.orderStatus);

    if (checkoutAlreadyStarted || hasRealPix) {
      setCurrentStep("pix");
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
      const session = loadStoredOrderSession();
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
          clearStoredOrderSession();
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
        clearStoredOrderSession();
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

    // Navegar imediatamente — upload continua em segundo plano sem bloquear o usuário
    setShowPhotoConfirm(false);
    nextStep("styles");
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
          source: "aparecida",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Erro ao salvar sua foto");
      }

      const data = await res.json() as OrderAccessResponse;
      // Upload roda em segundo plano: hidrata os dados sem mexer no passo atual
      // do funil (o usuário já avançou para "styles" e segue o fluxo normal).
      hydrateOrder(data.order, { navigate: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao salvar sua foto";
      setPhotoUploadError(message);
    } finally {
      setPhotoUploading(false);
    }
  };

  const handlePhotoRetry   = () => {
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
    setPixCreating(true);
    setPixOrderId(null);
    setOrderAccessToken(null);
    setPixRealCode(null);
    setPixQrBase64(null);
    setPixError(null);
    setInitialPaymentStatus("pending");
    pixelTrack('Lead');
    pixelTrack('InitiateCheckout');
    nextStep('pix');

    try {
      const res = await fetch('/api/create-pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        throw new Error(err.error ?? 'Erro ao criar cobrança');
      }

      const { orderId, paymentId, accessToken, pixCode, qrBase64, recoveryCode, status } = await res.json() as {
        orderId: string;
        paymentId: string;
        accessToken: string;
        pixCode: string | null;
        qrBase64: string | null;
        recoveryCode: string | null;
        status: string;
      };
      setPixOrderId(orderId);
      setOrderAccessToken(accessToken);
      setPixRealCode(pixCode);
      setPixQrBase64(qrBase64);
      setInitialPaymentStatus(status === "approved" ? "approved" : "pending");
      const nextSession = { accessToken, orderId, recoveryCode };
      saveStoredOrderSession(nextSession);
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
      const message = err instanceof Error ? err.message : 'Erro ao criar cobrança PIX';
      setPixError(message);
    } finally {
      setPixCreating(false);
    }
  };

  const handleRecoverOrder = async () => {
    setRecoveryLoading(true);
    setRecoveryError(null);

    try {
      const res = await fetch("/api/recover-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: recoveryPhone,
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
      setRecoveryPhone("");
      setRecoveryCodeInput("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Nao foi possivel recuperar o pedido";
      setRecoveryError(message);
    } finally {
      setRecoveryLoading(false);
    }
  };

  if (recoveringOrder) {
    return (
      <div className="app-container font-nunito">
        <div className="w-full max-w-[480px] min-h-screen flex items-center justify-center px-6">
          <div className="text-center flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-[3px] border-brand-gold border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500 font-semibold">
              Recuperando seu pedido salvo...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="app-container font-nunito">
        <div className="w-full max-w-[480px] min-h-screen relative overflow-x-hidden">
          {currentStep === 'landing'  && (
            <LandingScreen
              onNext={() => nextStep('upload')}
              onRecover={() => setShowRecoveryModal(true)}
            />
          )}
          {currentStep === 'upload'   && <UploadScreen   onFileSelect={handleFileSelect} />}
          {currentStep === 'styles'   && (
            <StylesScreen selectedIds={selectedStyles} setSelectedIds={setSelectedStyles} onNext={() => nextStep('loading')} />
          )}
          {currentStep === 'loading'  && <LoadingScreen  onFinish={() => { nextStep('results'); pixelTrack('ViewContent'); }} />}
          {currentStep === 'results'  && (
            <ResultsScreen selectedIds={resultsSelected} setSelectedIds={setResultsSelected} onContinue={handleResultsContinue} />
          )}
          {currentStep === 'pix'      && (
            <PixScreen
              value={pixValue}
              label={pixLabel}
              pixCode={pixRealCode}
              qrBase64={pixQrBase64}
              orderId={pixOrderId}
              accessToken={orderAccessToken}
              phoneNumber={phoneNumber}
              isCreating={pixCreating}
              error={pixError}
              initialPaymentStatus={initialPaymentStatus}
              recoveryCode={orderSummary?.recoveryCode ?? orderSession?.recoveryCode ?? null}
            />
          )}
        </div>
      </div>

      {/* Modals fora do overflow-x-hidden para fixed funcionar corretamente */}
      {showPhotoConfirm && uploadedPhotoUrl && (
        <PhotoConfirmModal
          photoUrl={uploadedPhotoUrl}
          onConfirm={handlePhotoConfirm}
          onRetry={handlePhotoRetry}
          isUploading={photoUploading}
          error={photoUploadError}
        />
      )}
      {showUpsell && (
        <UpsellModal
          selectedIds={resultsSelected}
          onAccept={(priceKey, selectedStyleIds) => { setShowUpsell(false); goToPhone(priceKey, selectedStyleIds); }}
          onDecline={(priceKey, selectedStyleIds) => { setShowUpsell(false); goToPhone(priceKey, selectedStyleIds); }}
          onClose={() => setShowUpsell(false)}
        />
      )}
      {showPhoneModal && (
        <PhoneModal
          phone={phoneNumber}
          setPhone={setPhoneNumber}
          onNext={handlePhoneConfirm}
          onClose={() => setShowPhoneModal(false)}
        />
      )}
      {showRecoveryModal && (
        <RecoveryModal
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
    </>
  );
}

// ── LANDING ───────────────────────────────────────────────────────────────────
function LandingScreen({ onNext, onRecover }: { onNext: () => void; onRecover: () => void }) {
  return (
    <div className="content-wrapper animate-in fade-in duration-300 text-center">
      <header className="mb-2">
        <h1 className="text-[28px] font-black text-foreground leading-tight">
          🙏 Veja como seria um momento seu ao lado de
          <br />
          <span
            style={{
              background: "linear-gradient(135deg, #F5A623 0%, #E8960A 55%, #F5A623 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Nossa Senhora Aparecida
          </span>
        </h1>
        <p className="text-gray-700 mt-2 text-base font-medium px-4">
          Crie uma imagem emocionante e única com Nossa Senhora em poucos segundos
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        {STYLES.map((style) => (
          <div key={style.id} className="card-style relative aspect-[3/4] overflow-hidden">
            <img src={style.img} alt={style.label} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute bottom-0 inset-x-0 bg-white/95 py-2 px-2 text-[10px] font-semibold text-foreground text-center">
              {style.label}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2">
        <button onClick={onNext} className="btn-primary btn-shimmer">
          CRIAR MINHA IMAGEM
        </button>
      </div>
    </div>
  );
}

// ── UPLOAD ────────────────────────────────────────────────────────────────────
function UploadScreen({ onFileSelect }: { onFileSelect: (file: File) => void }) {
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div className="w-full max-w-[480px] px-4 py-5 flex flex-col gap-5 animate-in fade-in duration-300">
      <header className="text-center">
        <h1 className="text-2xl font-bold text-black">📷 Envie sua foto</h1>
      </header>

      <div className="border-2 border-red-500 bg-red-50 rounded-xl p-4 flex flex-col items-center text-center gap-1 text-red-600">
        <p className="font-bold text-sm flex items-center gap-1.5"><XCircle size={16} className="shrink-0" /> IMPORTANTE</p>
        <p className="font-extrabold text-sm uppercase">NÃO FUNCIONA COM FOTOS DE CRIANÇAS!</p>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <p className="text-base leading-relaxed text-gray-800 font-medium text-center">
          A sua imagem ao lado de Nossa Senhora Aparecida é criada com uma{" "}
          <strong className="text-black">Inteligência Artificial ultra realista</strong>. Por isso, para criarmos
          uma imagem que <strong className="text-black">realmente seja parecida com você</strong>, precisamos que a
          sua foto siga as orientações abaixo:
        </p>
      </div>

      <p className="text-black text-center text-base font-semibold">
        Uma <strong>selfie do seu rosto</strong>, bem iluminada.
      </p>

      <div className="flex gap-3 items-center justify-center px-6">
        <div className="flex flex-col gap-2 flex-1 max-w-[42%]">
          <div className="rounded-2xl overflow-hidden border-2 border-gray-200">
            <img src={uploadErradoImg} alt="Exemplo errado" className="w-full object-contain" />
          </div>
          <span className="text-sm text-gray-600 font-bold text-center uppercase tracking-tight">Tire assim</span>
        </div>
        <div className="shrink-0">
          <span className="text-2xl text-brand-gold font-bold">→</span>
        </div>
        <div className="flex flex-col gap-2 flex-1 max-w-[42%]">
          <div className="rounded-2xl overflow-hidden border-2 border-brand-gold">
            <img src={uploadIdealImg} alt="Foto ideal" className="w-full object-contain" />
          </div>
          <span className="text-sm text-brand-gold font-bold text-center uppercase tracking-tight">Foto ideal ✓</span>
        </div>
      </div>

      <div className="bg-yellow-50 rounded-2xl p-5 border border-yellow-200">
        <p className="text-base font-bold text-yellow-900 flex items-start gap-2 mb-3">
          💡 Para que as imagens fiquem parecidas com você, siga as orientações abaixo:
        </p>
        <ul className="text-sm text-yellow-800 space-y-2 list-none pl-1">
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
function PhotoConfirmModal({ photoUrl, onConfirm, onRetry, isUploading, error }: {
  photoUrl: string;
  onConfirm: () => void;
  onRetry: () => void;
  isUploading: boolean;
  error: string | null;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-[420px] rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-y-auto" style={{ maxHeight: '90dvh' }}>
        <div className="p-5 relative">
          <button onClick={onRetry} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>

          <div className="border-2 border-red-400 bg-red-50 rounded-xl p-3 flex flex-col items-center text-center gap-1 text-red-600 mb-5">
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

          <h3 className="text-xl font-black text-black text-center mb-2">
            A sua foto segue as orientações?
          </h3>
          <p className="text-sm text-gray-500 text-center mb-6 px-2">
            Não nos responsabilizamos por resultados insatisfatórios causados pelo envio de fotos
            de baixa qualidade ou fora das orientações.
          </p>

          {error && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-600">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-3 pb-2">
            <button
              onClick={onConfirm}
              className="btn-primary flex items-center justify-center gap-2"
            >
              SIM, AVANÇAR <ChevronRight size={18} strokeWidth={3} />
            </button>
            <button onClick={onRetry} className="w-full bg-gray-100 text-gray-600 font-bold text-center py-3 rounded-xl active:scale-[0.98] transition-all">
              Escolher outra foto
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────
function StylesScreen({ selectedIds, setSelectedIds, onNext }: {
  selectedIds: number[]; setSelectedIds: React.Dispatch<React.SetStateAction<number[]>>; onNext: () => void;
}) {
  const toggleSelection = (id: number) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  };

  return (
    <div className="content-wrapper animate-in fade-in duration-300 text-center">
      <header>
        <h1 className="text-2xl font-bold text-foreground">🎨 Passo 2: Escolha os estilos</h1>
        <p className="text-gray-500 mt-2 text-sm">
          Clique nas imagens que você mais gostou. Se gostou das 4, selecione as 4.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 mt-4">
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

              <div className="absolute bottom-0 inset-x-0 bg-black/55 py-2 px-1 text-[10px] font-bold text-white text-center">
                {style.label}
              </div>
            </div>
          );
        })}
      </div>

      <button
        className={`btn-primary mt-8 flex items-center justify-center gap-2 transition-opacity ${selectedIds.length === 0 ? "opacity-50" : "opacity-100"}`}
        disabled={selectedIds.length === 0}
        onClick={onNext}
      >
        AVANÇAR <ChevronRight size={18} strokeWidth={3} />
      </button>
    </div>
  );
}

// ── LOADING ───────────────────────────────────────────────────────────────────
const LOADING_MESSAGES = [
  "Preparando seu momento especial...",
  "Adicionando detalhes divinos...",
  "Criando uma lembrança única...",
  "Ajustando cada detalhe com carinho...",
  "Sua imagem está quase pronta...",
];

function LoadingScreen({ onFinish }: { onFinish: () => void }) {
  const [progress, setProgress] = useState(0);
  const [msgIdx, setMsgIdx] = useState(0);

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

  useEffect(() => {
    const msgTimer = setInterval(() => {
      setMsgIdx((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 1400);
    return () => clearInterval(msgTimer);
  }, []);

  return (
    <div className="content-wrapper animate-in fade-in duration-300 flex flex-col items-center justify-center min-h-[80vh] text-center">
      <div className="text-[80px] mb-6">🙏</div>
      <h2 className="text-2xl font-bold text-black mb-3">Analisando sua foto...</h2>
      <p className="text-gray-700 text-base font-semibold mb-8 min-h-[1.5rem] transition-all duration-500">
        {LOADING_MESSAGES[msgIdx]}
      </p>
      <div className="w-[70%] h-4 bg-[#e0e0e0] rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-brand-gold transition-all ease-in-out duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-sm text-gray-500 font-medium">Isso pode levar alguns segundos</p>
    </div>
  );
}

// ── RESULTS ───────────────────────────────────────────────────────────────────
function ResultsScreen({ selectedIds, setSelectedIds, onContinue }: {
  selectedIds: number[]; setSelectedIds: React.Dispatch<React.SetStateAction<number[]>>; onContinue: () => void;
}) {
  const [hasEverSelected, setHasEverSelected] = useState(false);

  const toggleSelection = (id: number) => {
    const next = selectedIds.includes(id) ? selectedIds.filter((i) => i !== id) : [...selectedIds, id];
    setSelectedIds(next);
    if (next.length > 0) setHasEverSelected(true);
  };

  const hasSelection = selectedIds.length > 0;
  const totalPrice = getBaseTotalForCount(selectedIds.length);

  return (
    <div className="w-full max-w-[480px] px-5 py-4 flex flex-col gap-3 animate-in fade-in duration-300">
      <header className="text-center">
        <h1 className="text-[22px] font-extrabold text-black leading-[1.08]">
          🙏 Veja como ficou seu<br />momento com Nossa Senhora
        </h1>
        <p className="text-gray-600 italic mt-1.5 text-sm leading-snug">
          "Um momento especial que você pode guardar para sempre"
        </p>
      </header>

      {/* Lar Aconchego Banner */}
      <div className="rounded-2xl overflow-hidden shadow-lg bg-[#0a2d6e]">
        <div className="p-2.5">
          <img src={larBannerImg} alt="Lar Aconchego & Fé" className="w-full rounded-xl object-contain" />
        </div>
        <div className="px-4 pb-4 pt-1 text-center">
          <p className="text-white font-bold text-base leading-snug">
            💛 100% dos valores arrecadados serão doados para o{" "}
            <span className="underline font-extrabold">Lar Aconchego &amp; Fé</span>
          </p>
        </div>
      </div>

      <div className="text-center mt-0.5">
        <p className="text-base font-bold text-black leading-snug">
          👇 Toque em <span className="text-brand-gold font-extrabold uppercase">CADA</span> imagem que você quer liberar
        </p>
        <p className="text-[13px] text-gray-600 font-medium mt-0.5 leading-tight">
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
              className={`relative aspect-[3/4] cursor-pointer overflow-hidden rounded-xl bg-white shadow-sm transition-all duration-200 border ${
                isSelected ? "border-brand-gold ring-2 ring-brand-gold shadow-md" : "border-dashed border-brand-gold/60"
              }`}
            >
              <img
                src={style.imgPixelado}
                alt={style.label}
                className="absolute inset-0 w-full h-full object-cover"
              />

              <div className="absolute top-1.5 left-1.5 z-10">
                <div className="bg-white rounded-lg shadow-md px-2 py-1 leading-tight">
                  <p className="text-[12px] font-black text-gray-900 leading-none">Apenas R$ 10,90</p>
                  <p className="text-[9px] font-semibold text-gray-500 leading-none mt-0.5">Alta qualidade para baixar</p>
                </div>
              </div>

              {!isSelected && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <div className="bg-brand-gold text-white text-[12px] font-black px-3.5 py-1.5 rounded-full shadow-md tracking-wide">
                    💛 TOQUE
                  </div>
                </div>
              )}

              <div className={`absolute bottom-0 inset-x-0 z-10 transition-colors duration-200 ${
                isSelected ? "bg-[#1e293b]/95" : "bg-[#4da8da]/95"
              }`}>
                <p className={`text-[12px] font-black text-center uppercase tracking-wide py-1 ${
                  isSelected ? "text-brand-gold" : "text-white"
                }`}>
                  {isSelected ? "SUA ESCOLHA" : "💛 LEVE TAMBÉM"}
                </p>
                <p className="text-[11px] text-white font-semibold text-center pb-1 -mt-0.5 leading-tight px-1">
                  {style.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {hasEverSelected && (
        <div className="animate-in fade-in duration-500">
          {/* 1. Urgência  ·  2. Emocional */}
          <div className="max-w-sm mx-auto flex flex-col gap-2 mt-3">
            <div className="flex items-center justify-center gap-2">
              <span className="text-[16px] leading-none">⏳</span>
              <p className="text-[15px] text-gray-700 font-semibold leading-snug">Sua imagem fica disponível por tempo limitado</p>
            </div>
            <div className="flex items-center justify-center gap-2">
              <span className="text-[16px] leading-none">🙏</span>
              <p className="text-[15px] text-gray-800 font-semibold leading-snug">Imagem pronta para você guardar para sempre</p>
            </div>
          </div>

          <div className="mt-4">
            {/* 3. Resumo da seleção  ·  4. Valor */}
            {hasSelection && (
              <div className="bg-white border border-gray-200 rounded-2xl px-4 py-4 text-center shadow-sm mb-4">
                <p className="text-[15px] font-bold text-gray-700 leading-tight">
                  {selectedIds.length} {selectedIds.length === 1 ? "imagem selecionada" : "imagens selecionadas"}
                </p>
                <p className="text-[16px] font-bold text-gray-600 leading-tight mt-1.5">
                  Total para liberar:
                </p>
                <p className="text-[30px] font-black text-brand-gold leading-none mt-1">
                  R$ {totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            )}

            {/* 5. CTA */}
            <button
              className={`btn-primary pulse-glow w-full flex flex-col items-center py-3.5 gap-0.5 ${!hasSelection ? 'opacity-50' : ''}`}
              onClick={hasSelection ? onContinue : undefined}
              disabled={!hasSelection}
            >
              <span className="font-extrabold text-base leading-tight">LIBERAR MINHA IMAGEM AGORA</span>
              <span className="text-[13px] font-medium leading-tight opacity-90 normal-case">Pagamento rápido e seguro via Pix</span>
            </button>

            <p className="text-center text-[15px] text-gray-700 font-semibold mt-2">Acesso imediato após o pagamento</p>
          </div>

          <div className="mt-4 mb-20">
            <div className="text-center mb-1.5">
              <h3 className="font-black text-black text-base leading-tight">💬 Veja o que outras pessoas estão sentindo</h3>
              <p className="text-sm font-bold text-gray-500 mt-0.5 leading-tight">Centenas de famílias já guardaram seu momento com Nossa Senhora</p>
            </div>
            <TestimonialCarousel images={DEPOIMENTOS} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── UPSELL MODAL ──────────────────────────────────────────────────────────────
function UpsellModal({ selectedIds, onAccept, onDecline, onClose }: {
  selectedIds: number[];
  onAccept:  (priceKey: CheckoutPriceKey, selectedStyleIds: number[]) => void;
  onDecline: (priceKey: CheckoutPriceKey, selectedStyleIds: number[]) => void;
  onClose: () => void;
}) {
  const count = selectedIds.length;
  const selectedStyles = STYLES.filter(s => selectedIds.includes(s.id));
  const upsellPriceKey = getUpsellPriceKey(count);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

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
      declineValue: getBaseTotalForCount(count),
      upsellText: "",
      offerPrice: 0,
      economy: 0,
    };
    if (count === 1) return { ...base, upsellText: "Acrescente as outras 3 fotos com Nossa Senhora que você não selecionou por apenas", offerPrice: 22.60, economy: 21.00 };
    if (count === 2) return { ...base, upsellText: "Acrescente as outras 2 fotos com Nossa Senhora que você não selecionou por apenas", offerPrice: 29.60, economy: 14.00 };
    return { ...base, upsellText: "Acrescente a outra foto com Nossa Senhora que você não selecionou por apenas", offerPrice: 36.60, economy: 7.00 };
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-[400px] rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Cabeçalho — destaque forte */}
        <div className="bg-gradient-to-r from-orange-500 to-brand-gold px-5 py-4 relative text-center">
          <h3 className="text-white font-black text-xl tracking-tight drop-shadow-sm">{popupData.title}</h3>
          <button onClick={onClose} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/90 hover:text-white">
            <X size={24} strokeWidth={3} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-5 text-center">
          {/* Você está levando */}
          <div className="text-left">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 text-center">Você está levando</p>
            <div className="flex flex-col gap-2">
              {selectedStyles.map(s => (
                <div key={s.id} className="flex justify-between items-center text-sm font-bold text-foreground bg-blue-50/70 px-3 py-2.5 rounded-lg">
                  <span>✓ {s.label}</span>
                  <span className="shrink-0 ml-2">R$ 10,90</span>
                </div>
              ))}
            </div>
          </div>

          {/* Oferta — informação principal */}
          <div className="border-2 border-brand-gold border-dashed bg-yellow-50/60 rounded-2xl p-5">
            <p className="text-sm font-bold text-gray-700 leading-snug mb-2">{popupData.upsellText}</p>
            <p className="text-[40px] font-black text-brand-gold leading-none">R$ 3,90 <span className="text-[26px]">cada!</span></p>
          </div>

          {/* Total + economia */}
          <div className="flex flex-col items-center gap-1">
            <p className="text-sm font-medium text-gray-500">Aceitando agora você paga só</p>
            <p className="text-base text-gray-400 line-through font-bold">De {popupData.strikethrough}</p>
            <p className="text-[34px] font-black text-brand-gold leading-none">
              por R$ {popupData.offerPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs font-bold text-gray-400 italic mb-1">pelas 4 imagens</p>
            <span className="inline-flex items-center gap-1.5 bg-green-100 text-green-700 font-black text-sm px-4 py-1.5 rounded-full">
              👍 Economia de R$ {popupData.economy.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* CTAs */}
          <div className="flex flex-col gap-3 mt-1">
            <button onClick={() => onAccept(popupData.acceptPriceKey, selectedIds)} className="btn-primary pulse-glow py-[18px] text-base font-black normal-case">
              Sim, quero todas! 💕
            </button>
            <button onClick={() => onDecline(popupData.declinePriceKey, selectedIds)} className="text-[13px] text-gray-400 underline font-semibold">
              Não, obrigado (continuar com R$ {popupData.declineValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── RECOVERY MODAL ────────────────────────────────────────────────────────────
function RecoveryModal({
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
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const digits = phone.replace(/\D/g, "");
  const isValid = digits.length === 11 && recoveryCode.trim().length >= 6;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-[480px] rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom duration-300">
        <div className="relative px-5 py-5 rounded-t-3xl text-center bg-gray-900">
          <button
            onClick={onClose}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white"
          >
            <X size={22} />
          </button>
          <p className="text-2xl mb-1">🔎</p>
          <h3 className="text-white font-black text-base uppercase tracking-tight leading-tight">
            RECUPERAR PEDIDO
          </h3>
        </div>

        <div className="p-5 flex flex-col gap-4 pb-8">
          <p className="text-sm text-gray-600 text-center leading-relaxed">
            Informe o mesmo numero usado no pedido e o codigo de recuperacao mostrado
            apos o pagamento.
          </p>

          <div className="flex items-stretch rounded-xl border-2 overflow-hidden border-gray-200">
            <div className="flex items-center gap-1.5 px-3 bg-gray-50 border-r border-gray-200 shrink-0">
              <span className="text-base">🇧🇷</span>
              <span className="text-sm font-black text-gray-700">+55</span>
            </div>
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(maskPhone(e.target.value))}
              placeholder="(00) 00000-0000"
              className="flex-1 px-3 py-4 text-base font-bold text-foreground placeholder:text-gray-300 outline-none bg-white"
            />
          </div>

          <input
            type="text"
            inputMode="numeric"
            value={recoveryCode}
            onChange={(e) => setRecoveryCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder="Codigo de recuperacao"
            className="w-full rounded-xl border-2 border-gray-200 px-4 py-4 text-base font-bold text-foreground placeholder:text-gray-300 outline-none bg-white"
          />

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-600">
              {error}
            </div>
          )}

          <button
            onClick={isValid ? onRecover : undefined}
            disabled={!isValid || loading}
            className={`btn-primary flex items-center justify-center gap-2 transition-opacity ${
              isValid ? "opacity-100" : "opacity-40"
            }`}
          >
            {loading ? "RECUPERANDO..." : "Recuperar pedido"} <ChevronRight size={18} strokeWidth={3} />
          </button>
        </div>
      </div>
    </div>
  );
}

function PhoneModal({ phone, setPhone, onNext, onClose }: {
  phone: string;
  setPhone: React.Dispatch<React.SetStateAction<string>>;
  onNext: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(maskPhone(e.target.value));
  };

  const digits = phone.replace(/\D/g, "");
  const isValid = digits.length === 11;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-[420px] rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200" style={{ border: "2.5px solid #F5A623" }}>

        {/* Header dourado */}
        <div className="relative px-5 py-5 text-center" style={{ background: "linear-gradient(135deg, #F6C346 0%, #F5A623 50%, #D4810A 100%)" }}>
          <button
            onClick={onClose}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors"
          >
            <X size={22} />
          </button>
          <div className="mx-auto mb-2.5 w-12 h-12 rounded-full bg-white/25 flex items-center justify-center shadow-inner">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z"/>
            </svg>
          </div>
          <h3 className="text-white font-black text-xl uppercase tracking-wide leading-tight drop-shadow-sm">
            ENVIAREMOS NO SEU<br/>WHATSAPP
          </h3>
        </div>

        <div className="px-5 pt-5 pb-6 flex flex-col gap-4">
          <div className="text-center">
            <p className="text-[17px] font-black text-gray-900 leading-snug">
              Para garantir que você receba suas imagens, digite seu WhatsApp:
            </p>
            <p className="text-[14px] font-semibold text-[#2563EB] leading-snug mt-2">
              Logo após confirmar o pagamento as suas imagens serão criadas e em menos de{" "}
              <span className="font-black">5 minutinhos</span> enviamos diretamente no seu Whatsapp 😊
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-gray-700">Seu WhatsApp (com DDD)</label>
            <div className={`flex items-stretch rounded-xl border-2 overflow-hidden transition-colors ${
              isValid ? "border-[#F5A623]" : "border-gray-300 focus-within:border-[#F5A623]"
            }`}>
              <div className="flex items-center gap-1.5 px-3.5 bg-amber-50 border-r-2 border-gray-200 shrink-0">
                <span className="text-base font-black text-gray-800">+55</span>
              </div>
              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={handleChange}
                placeholder="(00) 00000-0000"
                className="flex-1 px-3 py-4 text-lg font-bold text-foreground placeholder:text-gray-400 outline-none bg-white"
              />
            </div>
          </div>

          <button
            onClick={isValid ? onNext : undefined}
            disabled={!isValid}
            className={`w-full py-[18px] rounded-[12px] font-black text-white text-[16px] tracking-wide uppercase shadow-md transition-all duration-200 cursor-pointer ${
              isValid
                ? "opacity-100 hover:-translate-y-0.5 hover:shadow-xl hover:brightness-105 active:scale-[0.98] pulse-glow"
                : "opacity-40 cursor-not-allowed"
            }`}
            style={{ background: isValid ? "linear-gradient(135deg, #F6C346 0%, #F5A623 50%, #D4810A 100%)" : "#ccc" }}
          >
            CONTINUAR PARA PAGAMENTO
          </button>

          <div className="flex items-start gap-2.5 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
            <ShieldCheck size={18} className="text-[#F5A623] shrink-0 mt-0.5" />
            <p className="text-[13px] text-gray-600 leading-snug">
              Usaremos apenas para entregar suas imagens. Não enviamos spam nem promoções.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── TESTIMONIAL CAROUSEL ─────────────────────────────────────────────────────
function TestimonialCarousel({ images }: { images: string[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(0);
  const [containerW, setContainerW] = useState(0);
  const busy = useRef(false);
  const posRef = useRef(0);
  const total = images.length;
  const CLONE = 2;

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
      applyTranslate(CLONE + posRef.current, w, false);
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
    const extIdx = CLONE + pos + dir;
    applyTranslate(extIdx, containerW, true);
    posRef.current = nextPos;
    setPos(nextPos);
    setTimeout(() => {
      if (extIdx < CLONE || extIdx >= CLONE + total) {
        applyTranslate(CLONE + nextPos, containerW, false);
      }
      busy.current = false;
    }, 700);
  };

  const jumpTo = (i: number) => {
    if (busy.current || !containerW) return;
    busy.current = true;
    posRef.current = i;
    setPos(i);
    applyTranslate(CLONE + i, containerW, true);
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
              className="w-full aspect-[9/16] rounded-2xl shadow-xl object-cover object-top"
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

// ── PIX SCREEN ────────────────────────────────────────────────────────────────
function PixScreen({ value, label, pixCode, qrBase64, orderId, accessToken, phoneNumber, isCreating, error, initialPaymentStatus, recoveryCode }: {
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
}) {
  const [timeLeft, setTimeLeft]       = useState(15 * 60);
  const [showToast, setShowToast]     = useState(false);
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
        // silently ignore — keep polling
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
    pixelTrack('AddPaymentInfo');
  };

  if (paymentStatus === 'approved') {
    return (
      <div className="content-wrapper animate-in fade-in duration-500 text-center flex flex-col items-center gap-6 pt-10">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
          <Check size={40} className="text-green-500" strokeWidth={2.5} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-foreground">Pagamento confirmado! 🎉</h2>
          <p className="text-gray-500 mt-2 text-sm leading-relaxed">
            Seu pedido foi salvo com seguranca e esta pronto para seguir para processamento.
          </p>
          {phoneNumber && (
            <p className="text-brand-gold font-black text-base mt-3">📲 {phoneNumber}</p>
          )}
        </div>
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 w-full text-left">
          <p className="text-sm font-bold text-green-700 leading-snug">
            Fechou o navegador, trocou de aparelho ou voltou horas depois? Seu pedido continua recuperavel.
          </p>
        </div>
        {recoveryCode && (
          <div className="bg-white border border-gray-200 rounded-2xl p-4 w-full text-left">
            <p className="text-xs font-bold text-gray-500">Codigo de recuperacao do pedido</p>
            <p className="text-2xl font-black text-foreground tracking-wide mt-1">{recoveryCode}</p>
            <p className="text-[11px] text-gray-400 mt-2">
              Guarde este codigo junto do numero informado para recuperar a entrega depois.
            </p>
          </div>
        )}
        <div className="flex items-center gap-3 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 w-full">
          <img src={larLogoImg} alt="Lar Aconchego & Fé" className="w-12 h-12 rounded-lg object-cover shrink-0" />
          <p className="text-xs text-gray-600 text-left leading-snug font-medium">
            💛 Obrigado por ajudar o <strong>Lar Aconchego & Fé</strong>!<br />
            Sua generosidade leva amor a quem mais precisa.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="content-wrapper animate-in fade-in duration-300">
      <div className="flex flex-col items-center mb-2">
        <img src={mpLogoImg} alt="Mercado Pago" className="h-[72px] max-w-full object-contain mb-4" />
        <h1 className="text-xl font-black text-foreground tracking-tight">PAGAMENTO VIA PIX</h1>
      </div>

      <div className="bg-white rounded-2xl p-4 flex items-center gap-4 shadow-sm border border-gray-100">
        <img src={larLogoImg} alt="Lar Aconchego & Fé" className="w-14 h-14 rounded-lg object-cover shrink-0" />
        <p className="text-sm leading-snug text-gray-700 font-medium">
          💛 Obrigado por ajudar! Sua compra leva amor e acolhimento aos idosos do{" "}
          <span className="underline font-bold">Lar Aconchego &amp; Fé</span>
        </p>
      </div>

      <div className="text-center">
        <p className="text-xl font-bold text-gray-700">
          {label} — <span className="text-brand-gold font-black">R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-full bg-green-100 flex items-center justify-center shrink-0">
            <ShieldCheck className="text-green-600" size={24} />
          </div>
          <p className="text-sm font-bold text-green-800 leading-snug">
            Pagamento processado com segurança pelo <span className="font-black">Mercado Pago</span>
          </p>
        </div>
        {!isCreating && pixCode && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
              <Clock className="text-orange-500" size={24} />
            </div>
            <p className="text-sm font-bold text-gray-700 leading-snug">
              Este Pix expira em <span className="text-orange-600 font-black">{formatTime(timeLeft)}</span>
            </p>
          </div>
        )}
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
          <p className="text-sm font-bold text-red-600">❌ {error}</p>
          <p className="text-xs text-red-400 mt-2">Volte e tente novamente, ou entre em contato pelo WhatsApp.</p>
        </div>
      ) : isCreating ? (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="w-10 h-10 border-[3px] border-brand-gold border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-bold text-gray-500">Gerando cobrança PIX...</p>
        </div>
      ) : (
        <>
          <div>
            <button onClick={copyPix} className="btn-primary flex items-center justify-center gap-2">
              <Copy size={20} /> COPIAR CÓDIGO PIX
            </button>
          </div>

          <div className="text-center">
            <p className="text-base font-bold text-gray-600">Ou escaneie o QR Code:</p>
            <div className="mt-4 mx-auto w-48 h-48 bg-white border-4 border-white shadow-lg rounded-xl flex items-center justify-center">
              {qrBase64 ? (
                <img
                  src={`data:image/png;base64,${qrBase64}`}
                  alt="QR Code PIX"
                  className="w-40 h-40 rounded-lg"
                />
              ) : (
                <div className="w-40 h-40 bg-gray-100 rounded-lg flex items-center justify-center">
                  <p className="text-gray-400 text-[10px] text-center font-medium px-3">QR Code<br />disponível em breve</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <div className="flex flex-col gap-3">
        <div className="bg-white rounded-2xl p-4 flex items-start gap-3.5 shadow-sm border border-gray-100">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
            <Check className="text-green-600" size={20} strokeWidth={3} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-700 leading-snug">
              A cobrança aparecerá no app do seu banco como:
            </p>
            <p className="text-lg font-black text-gray-900 leading-tight mt-1">Lucas Gonçalves Agostini</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 flex items-start gap-4 shadow-sm border border-gray-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-[#25D366]" />
          <div className="text-2xl mt-0.5 shrink-0">📲</div>
          <div>
            <p className="text-sm font-bold text-gray-700 leading-snug">
              Após o pagamento, sua imagem será enviada automaticamente para o seu WhatsApp
              {phoneNumber ? (
                <> <span className="font-black text-gray-900">{phoneNumber}</span></>
              ) : ""}.
            </p>
            <p className="text-sm font-bold text-gray-700 leading-snug mt-2">
              <span className="font-black">A entrega acontece em poucos minutos.</span> Basta abrir o WhatsApp e conferir!
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 mb-28">
        <div className="text-center mb-2">
          <h3 className="text-brand-gold font-black">💛 Quem já guardou seu momento com Nossa Senhora</h3>
          <p className="text-[11px] font-bold text-gray-400 mt-1">Veja mensagens de quem recebeu suas imagens</p>
        </div>
        <TestimonialCarousel images={DEPOIMENTOS} />
      </div>

      {!isCreating && pixCode && paymentStatus === 'pending' && (
        <div className="fixed bottom-0 inset-x-0 bg-white/90 backdrop-blur-md border-t border-gray-100 flex items-center justify-center gap-3" style={{ paddingTop: '12px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          <div className="w-5 h-5 border-2 border-brand-gold border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-bold text-gray-600">Aguardando confirmação do pagamento...</span>
        </div>
      )}

      {showToast && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-6 py-2 rounded-full text-sm font-bold animate-in fade-in slide-in-from-top-4 duration-300 z-[60]">
          Código copiado! ✓
        </div>
      )}
    </div>
  );
}
