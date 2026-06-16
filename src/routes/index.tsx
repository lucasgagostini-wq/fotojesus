import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import { Camera, Image as ImageIcon, XCircle, Check, ShieldCheck, Clock, Copy, ChevronRight, ChevronLeft, X } from "lucide-react";
import {
  getBaseTotalForCount,
  getCheckoutQuote,
  getUpsellPriceKey,
  type CheckoutPriceKey,
} from "../lib/checkout-pricing";

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

import larLogoImg      from "../assets/institucional/lar-aconchego-logo.png";
import mpLogoImg       from "../assets/pagamento/mercado-pago-logo.png";

import dep1 from "../assets/depoimentos/depoimento-1.jpeg";
import dep2 from "../assets/depoimentos/depoimento-2.jpeg";
import dep3 from "../assets/depoimentos/depoimento-3.jpeg";
import dep4 from "../assets/depoimentos/depoimento-4.jpeg";
import dep5 from "../assets/depoimentos/depoimento-5.jpeg";

export const Route = createFileRoute("/")({
  component: AppFlow,
});

type Step = 'landing' | 'upload' | 'styles' | 'loading' | 'results' | 'pix';

const STYLES = [
  { id: 1, label: "Jesus te abraçando",         img: hugImg,          imgPixelado: hugPixeladoImg,          description: "Jesus te abraçando" },
  { id: 2, label: "Jesus ao seu lado sorrindo", img: smilingImg,      imgPixelado: smilingPixeladoImg,      description: "Jesus ao seu lado sorrindo" },
  { id: 3, label: "Jesus segurando sua mão",    img: holdingHandsImg, imgPixelado: holdingHandsPixeladoImg, description: "Jesus segurando sua mão" },
  { id: 4, label: "Momento no campo com Jesus", img: fieldImg,        imgPixelado: fieldPixeladoImg,        description: "Momento no campo com Jesus" },
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

// ── AppFlow ───────────────────────────────────────────────────────────────────
function AppFlow() {
  const [currentStep, setCurrentStep]           = useState<Step>('landing');
  const [selectedStyles, setSelectedStyles]     = useState<number[]>([]);
  const [resultsSelected, setResultsSelected]   = useState<number[]>([]);
  const [showUpsell, setShowUpsell]             = useState(false);
  const [pixValue, setPixValue]                 = useState<number>(10.90);
  const [pixLabel, setPixLabel]                 = useState<string>("1 imagem");
  const [checkoutPriceKey, setCheckoutPriceKey] = useState<CheckoutPriceKey>("single");
  const [checkoutStyleIds, setCheckoutStyleIds] = useState<number[]>([]);
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null);
  const [showPhotoConfirm, setShowPhotoConfirm] = useState(false);
  const [phoneNumber, setPhoneNumber]           = useState<string>("");
  const [showPhoneModal, setShowPhoneModal]     = useState(false);
  const [pixOrderId, setPixOrderId]             = useState<string | null>(null);
  const [pixStatusToken, setPixStatusToken]     = useState<string | null>(null);
  const [pixRealCode, setPixRealCode]           = useState<string | null>(null);
  const [pixQrBase64, setPixQrBase64]           = useState<string | null>(null);
  const [pixCreating, setPixCreating]           = useState(false);
  const [pixError, setPixError]                 = useState<string | null>(null);

  const nextStep = (step: Step) => { window.scrollTo(0, 0); setCurrentStep(step); };

  const handleFileSelect = (url: string) => { setUploadedPhotoUrl(url); setShowPhotoConfirm(true); };
  const handlePhotoConfirm = () => { setShowPhotoConfirm(false); nextStep('styles'); };
  const handlePhotoRetry   = () => {
    setShowPhotoConfirm(false);
    if (uploadedPhotoUrl) URL.revokeObjectURL(uploadedPhotoUrl);
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
    setShowPhoneModal(false);
    setPixCreating(true);
    setPixOrderId(null);
    setPixStatusToken(null);
    setPixRealCode(null);
    setPixQrBase64(null);
    setPixError(null);
    nextStep('pix');

    try {
      const res = await fetch('/api/create-pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceKey: checkoutPriceKey,
          phoneNumber,
          selectedStyleIds: checkoutStyleIds,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? 'Erro ao criar cobrança');
      }

      const { orderId, paymentId, statusToken, pixCode, qrBase64 } = await res.json() as {
        orderId: string;
        paymentId: string;
        statusToken: string;
        pixCode: string | null;
        qrBase64: string | null;
      };
      setPixOrderId(orderId);
      setPixStatusToken(statusToken);
      setPixRealCode(pixCode);
      setPixQrBase64(qrBase64);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao criar cobrança PIX';
      setPixError(message);
    } finally {
      setPixCreating(false);
    }
  };

  return (
    <>
      <div className="app-container font-nunito">
        <div className="w-full max-w-[480px] min-h-screen relative overflow-x-hidden">
          {currentStep === 'landing'  && <LandingScreen  onNext={() => nextStep('upload')} />}
          {currentStep === 'upload'   && <UploadScreen   onFileSelect={handleFileSelect} />}
          {currentStep === 'styles'   && (
            <StylesScreen selectedIds={selectedStyles} setSelectedIds={setSelectedStyles} onNext={() => nextStep('loading')} />
          )}
          {currentStep === 'loading'  && <LoadingScreen  onFinish={() => nextStep('results')} />}
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
              statusToken={pixStatusToken}
              phoneNumber={phoneNumber}
              isCreating={pixCreating}
              error={pixError}
            />
          )}
        </div>
      </div>

      {/* Modals fora do overflow-x-hidden para fixed funcionar corretamente */}
      {showPhotoConfirm && uploadedPhotoUrl && (
        <PhotoConfirmModal photoUrl={uploadedPhotoUrl} onConfirm={handlePhotoConfirm} onRetry={handlePhotoRetry} />
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
    </>
  );
}

// ── LANDING ───────────────────────────────────────────────────────────────────
function LandingScreen({ onNext }: { onNext: () => void }) {
  return (
    <div className="content-wrapper animate-in fade-in duration-300 text-center">
      <header className="mb-2">
        <h1 className="text-[28px] font-black text-foreground leading-tight">
          ✝️ Veja como seria um momento seu ao lado de{" "}
          <span
            style={{
              background: "linear-gradient(135deg, #F5A623 0%, #E8960A 55%, #F5A623 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Jesus
          </span>
        </h1>
        <p className="text-gray-500 mt-2 text-sm px-4">
          Crie uma imagem emocionante e única em poucos segundos
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
function UploadScreen({ onFileSelect }: { onFileSelect: (url: string) => void }) {
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(URL.createObjectURL(e.target.files[0]));
    }
  };

  return (
    <div className="content-wrapper animate-in fade-in duration-300">
      <header className="text-center">
        <h1 className="text-2xl font-bold text-foreground">📷 Envie sua foto</h1>
      </header>

      <div className="border-2 border-red-500 bg-red-50 rounded-xl p-4 flex flex-col items-center text-center gap-1 text-red-600">
        <p className="font-bold text-sm flex items-center gap-1.5"><XCircle size={16} className="shrink-0" /> IMPORTANTE</p>
        <p className="font-extrabold text-xs uppercase">NÃO FUNCIONA COM FOTOS DE CRIANÇAS!</p>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <p className="text-sm leading-relaxed text-gray-700 text-center">
          A sua imagem ao lado de Jesus é criada com uma{" "}
          <strong>Inteligência Artificial ultra realista</strong>. Por isso, para criarmos
          uma imagem que <strong>realmente seja parecida com você</strong>, precisamos que a
          sua foto siga as orientações abaixo:
        </p>
      </div>

      <p className="text-foreground text-center text-sm">
        Uma <strong>selfie do seu rosto</strong>, bem iluminada.
      </p>

      <div className="flex gap-2 items-end">
        <div className="flex flex-col gap-2 flex-1">
          <div className="rounded-2xl overflow-hidden border-2 border-gray-200">
            <img src={uploadErradoImg} alt="Exemplo errado" className="w-full object-contain" />
          </div>
          <span className="text-[11px] text-gray-500 font-bold text-center uppercase tracking-tight">Tire assim</span>
        </div>
        <div className="flex flex-col items-center justify-center shrink-0 pb-6">
          <ChevronRight size={22} className="text-brand-gold" strokeWidth={2.5} />
        </div>
        <div className="flex flex-col gap-2 flex-1">
          <div className="rounded-2xl overflow-hidden border-2 border-brand-gold">
            <img src={uploadIdealImg} alt="Foto ideal" className="w-full object-contain" />
          </div>
          <span className="text-[11px] text-brand-gold font-bold text-center uppercase tracking-tight">Foto ideal ✓</span>
        </div>
      </div>

      <div className="bg-yellow-50 rounded-2xl p-4 border border-yellow-200">
        <p className="text-sm font-bold text-yellow-800 flex items-start gap-2 mb-2">
          💡 Para que as imagens fiquem parecidas com você, siga as orientações abaixo:
        </p>
        <ul className="text-xs text-yellow-700 space-y-1.5 list-none pl-1">
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
function PhotoConfirmModal({ photoUrl, onConfirm, onRetry }: {
  photoUrl: string; onConfirm: () => void; onRetry: () => void;
}) {
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

          <h3 className="text-lg font-black text-foreground text-center mb-2">
            A sua foto segue as orientações?
          </h3>
          <p className="text-[11px] text-gray-400 text-center mb-6 px-2">
            Não nos responsabilizamos por resultados insatisfatórios causados pelo envio de fotos
            de baixa qualidade ou fora das orientações.
          </p>

          <div className="flex flex-col gap-3 pb-2">
            <button onClick={onConfirm} className="btn-primary flex items-center justify-center gap-2">
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
function LoadingScreen({ onFinish }: { onFinish: () => void }) {
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
      <div className="text-[80px] mb-6">🙏</div>
      <h2 className="text-2xl font-bold text-foreground mb-2">Analisando sua foto...</h2>
      <p className="text-gray-500 mb-8">Criando sua imagem com IA...</p>
      <div className="w-[70%] h-4 bg-[#e0e0e0] rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-brand-gold transition-all ease-in-out duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-sm text-gray-400 font-medium">Isso pode levar alguns segundos</p>
    </div>
  );
}

// ── RESULTS ───────────────────────────────────────────────────────────────────
function ResultsScreen({ selectedIds, setSelectedIds, onContinue }: {
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
    <div className="w-full max-w-[480px] px-5 py-4 flex flex-col gap-3 animate-in fade-in duration-300">
      <header className="text-center">
        <h1 className="text-[22px] font-extrabold text-foreground leading-[1.08]">
          ✝️ Veja como ficou seu<br />momento com Jesus
        </h1>
        <p className="text-gray-500 italic mt-1.5 text-[13px] leading-snug">
          "Um momento especial que você pode guardar para sempre"
        </p>
      </header>

      {/* Lar Aconchego Banner */}
      <div className="rounded-xl overflow-hidden bg-[#4da8da] px-4 py-3 text-center shadow-sm">
        <p className="text-white font-extrabold text-[13px] leading-snug">
          💛 100% dos valores arrecadados serão doados para o{" "}
          <span className="underline">Lar Aconchego & Fé</span>
        </p>
      </div>

      <div className="text-center mt-0.5">
        <p className="text-[13px] font-bold text-foreground leading-snug">
          👇 Toque em <span className="text-brand-gold font-extrabold uppercase">CADA</span> imagem que você quer liberar
        </p>
        <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">
          Você pode escolher <strong>mais de uma</strong> — toque em todas que quiser
        </p>
      </div>

      {/* Image Grid */}
      <div className="grid grid-cols-2 gap-2.5 mt-0.5 mx-auto w-full max-w-[392px]">
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
              {/* Foto pixelada — revelação via WhatsApp após pagamento */}
              <img
                src={style.imgPixelado}
                alt={style.label}
                className="absolute inset-0 w-full h-full object-contain bg-gray-900"
              />

              {/* Badge preço — canto superior esquerdo */}
              <div className="absolute top-0 left-0 right-0 z-10 flex flex-col items-start gap-0 px-1.5 pt-1.5">
                <span className="bg-black/70 text-white text-[7px] font-extrabold px-1.5 py-[2px] rounded-sm leading-tight backdrop-blur-[1px]">
                  Apenas R$ 10,90
                </span>
                <span className="bg-black/50 text-white/90 text-[5.5px] font-semibold px-1.5 py-[1px] rounded-sm leading-tight mt-[1px] backdrop-blur-[1px]">
                  Alta qualidade para baixar
                </span>
              </div>

              {/* Botão TOQUE — centro, só quando não selecionado */}
              {!isSelected && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <div className="bg-brand-gold text-white text-[9px] font-black px-3 py-1 rounded-full shadow-md tracking-wide">
                    💛 TOQUE
                  </div>
                </div>
              )}

              {/* Rótulo inferior — translúcido com nome do estilo */}
              <div className={`absolute bottom-0 inset-x-0 z-10 transition-colors duration-200 ${
                isSelected ? "bg-[#1e293b]/95" : "bg-[#4da8da]/95"
              }`}>
                <p className={`text-[7.5px] font-black text-center uppercase tracking-wider py-1 ${
                  isSelected ? "text-brand-gold" : "text-white"
                }`}>
                  {isSelected ? "SUA ESCOLHA" : "💛 LEVE TAMBÉM"}
                </p>
                <p className="text-[7px] text-white/80 font-semibold text-center pb-1 -mt-0.5 leading-none px-1">
                  {style.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {hasEverSelected && (
        <div className="animate-in fade-in duration-500">
          <div className="flex flex-col gap-1 mt-2">
            <p className="text-[11px] text-gray-400 font-medium leading-tight">⏳ Sua imagem fica disponível por tempo limitado</p>
            <p className="text-[11px] text-gray-700 font-medium leading-tight">✝️ Imagem pronta para você guardar para sempre</p>
          </div>

          <div className="mt-3">
            {hasSelection && (
              <div className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-center shadow-sm mb-3">
                <p className="text-[12px] font-bold text-gray-600 leading-tight">
                  {selectedIds.length} {selectedIds.length === 1 ? "imagem selecionada" : "imagens selecionadas"}
                </p>
                <p className="text-[18px] font-black text-brand-gold leading-tight mt-0.5">
                  Total para liberar: R$ {totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            )}

            <button
              className={`btn-primary pulse-glow w-full flex flex-col items-center py-3 gap-0 transition-opacity ${!hasSelection ? 'opacity-50' : ''}`}
              onClick={hasSelection ? onContinue : undefined}
              disabled={!hasSelection}
            >
              <span className="font-extrabold text-sm leading-tight">LIBERAR MINHA IMAGEM AGORA</span>
              <span className="text-[10px] font-medium leading-tight opacity-90">Pagamento rápido e seguro via Pix</span>
            </button>

            <p className="text-center text-[11px] text-gray-400 font-medium mt-1.5">Acesso imediato após o pagamento</p>
          </div>

          <div className="mt-4 mb-20 [&_img]:max-h-[116px] [&_img]:object-cover [&_img]:rounded-xl">
            <div className="text-center mb-1.5">
              <h3 className="font-black text-foreground text-[14px] leading-tight">💬 Veja o que outras pessoas estão sentindo</h3>
              <p className="text-[10px] font-bold text-gray-400 mt-0.5 leading-tight">Centenas de famílias já guardaram seu momento com Jesus</p>
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
    if (count === 1) return { ...base, upsellText: "Acrescente as outras 3 fotos com Jesus que você não selecionou por apenas", offerPrice: 22.60, economy: 21.00 };
    if (count === 2) return { ...base, upsellText: "Acrescente as outras 2 fotos com Jesus que você não selecionou por apenas", offerPrice: 29.60, economy: 14.00 };
    return { ...base, upsellText: "Acrescente a outra foto com Jesus que você não selecionou por apenas", offerPrice: 36.60, economy: 7.00 };
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-[400px] rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="bg-gradient-to-r from-orange-500 to-brand-gold p-4 relative text-center">
          <h3 className="text-white font-black text-lg tracking-tight">{popupData.title}</h3>
          <button onClick={onClose} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white">
            <X size={24} strokeWidth={3} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-5 text-center">
          <div className="text-left">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 text-center">Você está levando</p>
            <div className="flex flex-col gap-2">
              {selectedStyles.map(s => (
                <div key={s.id} className="flex justify-between items-center text-sm font-bold text-foreground bg-gray-50 px-3 py-2 rounded-lg">
                  <span>✓ {s.label}</span>
                  <span>R$ 10,90</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-2 border-brand-gold border-dashed bg-yellow-50/50 rounded-2xl p-4">
            <p className="text-xs font-bold text-gray-600 leading-tight mb-1">{popupData.upsellText}</p>
            <p className="text-2xl font-black text-brand-gold">R$ 3,90 cada!</p>
          </div>

          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-gray-500">Aceitando agora você paga só</p>
            <p className="text-sm text-gray-400 line-through font-bold">De {popupData.strikethrough}</p>
            <p className="text-2xl font-black text-brand-gold">
              R$ {popupData.offerPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs font-bold text-gray-400 italic">pelas 4 imagens</p>
            <p className="text-brand-gold font-bold text-sm mt-1">
              👍 Economia de R$ {popupData.economy.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div className="flex flex-col gap-4 mt-2">
            <button onClick={() => onAccept(popupData.acceptPriceKey, selectedIds)} className="btn-primary py-4 text-base font-extrabold">
              Sim, quero todas! 💕
            </button>
            <button onClick={() => onDecline(popupData.declinePriceKey, selectedIds)} className="text-sm text-gray-400 underline font-bold">
              Não, obrigado (continuar com R$ {popupData.declineValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PHONE MODAL ───────────────────────────────────────────────────────────────
function PhoneModal({ phone, setPhone, onNext, onClose }: {
  phone: string;
  setPhone: React.Dispatch<React.SetStateAction<string>>;
  onNext: () => void;
  onClose: () => void;
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(maskPhone(e.target.value));
  };

  const digits = phone.replace(/\D/g, "");
  const isValid = digits.length === 11;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-[480px] rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom duration-300">

        {/* Cabeçalho verde WhatsApp */}
        <div className="relative bg-[#25D366] px-5 py-5 rounded-t-3xl text-center">
          <button
            onClick={onClose}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white"
          >
            <X size={22} />
          </button>
          <p className="text-2xl mb-1">💬</p>
          <h3 className="text-white font-black text-base uppercase tracking-tight leading-tight">
            ENVIAREMOS NO SEU WHATSAPP
          </h3>
        </div>

        <div className="p-5 flex flex-col gap-4 pb-8">
          <div className="text-center">
            <p className="text-sm text-gray-600 leading-relaxed">
              Suas imagens serão enviadas automaticamente para o seu{" "}
              <strong>WhatsApp</strong> assim que o pagamento for confirmado.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              A entrega leva apenas alguns minutos. ⚡
            </p>
          </div>

          {/* Input com prefixo +55 fixo */}
          <div className={`flex items-stretch rounded-xl border-2 overflow-hidden transition-colors ${
            isValid ? "border-[#25D366]" : "border-gray-200"
          }`}>
            <div className="flex items-center gap-1.5 px-3 bg-gray-50 border-r border-gray-200 shrink-0">
              <span className="text-base">🇧🇷</span>
              <span className="text-sm font-black text-gray-700">+55</span>
            </div>
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={handleChange}
              placeholder="(00) 00000-0000"
              className="flex-1 px-3 py-4 text-base font-bold text-foreground placeholder:text-gray-300 outline-none bg-white"
            />
          </div>

          <button
            onClick={isValid ? onNext : undefined}
            disabled={!isValid}
            className={`btn-primary flex items-center justify-center gap-2 transition-opacity ${
              isValid ? "opacity-100 pulse-glow" : "opacity-40"
            }`}
          >
            Continuar para pagamento <ChevronRight size={18} strokeWidth={3} />
          </button>

          <div className="flex items-center justify-center gap-1.5">
            <ShieldCheck size={13} className="text-gray-400 shrink-0" />
            <p className="text-[11px] text-gray-400">
              Seus dados são usados apenas para entrega das imagens.
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

  // [tail-2, tail-1, img0..imgN-1, head0, head1]
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
              className="w-full rounded-2xl shadow-xl object-cover"
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
function PixScreen({ value, label, pixCode, qrBase64, orderId, statusToken, phoneNumber, isCreating, error }: {
  value: number;
  label: string;
  pixCode: string | null;
  qrBase64: string | null;
  orderId: string | null;
  statusToken: string | null;
  phoneNumber: string;
  isCreating: boolean;
  error: string | null;
}) {
  const [timeLeft, setTimeLeft]       = useState(15 * 60);
  const [showToast, setShowToast]     = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');

  useEffect(() => {
    if (isCreating || !pixCode) return;
    const timer = setInterval(() => setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [isCreating, pixCode]);

  useEffect(() => {
    if (!orderId || !statusToken || paymentStatus !== 'pending') return;
    const interval = setInterval(async () => {
      try {
        const query = new URLSearchParams({ id: orderId, token: statusToken });
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
  }, [orderId, paymentStatus, statusToken]);

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

  // ── Success screen
  if (paymentStatus === 'approved') {
    return (
      <div className="content-wrapper animate-in fade-in duration-500 text-center flex flex-col items-center gap-6 pt-10">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
          <Check size={40} className="text-green-500" strokeWidth={2.5} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-foreground">Pagamento confirmado! 🎉</h2>
          <p className="text-gray-500 mt-2 text-sm leading-relaxed">
            Suas imagens estão sendo enviadas para o seu WhatsApp.
          </p>
          {phoneNumber && (
            <p className="text-brand-gold font-black text-base mt-3">📲 {phoneNumber}</p>
          )}
        </div>
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 w-full text-left">
          <p className="text-sm font-bold text-green-700 leading-snug">
            ⏱️ A entrega acontece em poucos minutos. Basta abrir o WhatsApp e conferir!
          </p>
        </div>
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
        <img src={mpLogoImg} alt="Mercado Pago" className="h-10 object-contain mb-4" />
        <h1 className="text-xl font-black text-foreground tracking-tight">PAGAMENTO VIA PIX</h1>
      </div>

      <div className="bg-white rounded-2xl p-4 flex items-center gap-4 shadow-sm border border-gray-100">
        <img src={larLogoImg} alt="Lar Aconchego & Fé" className="w-12 h-12 rounded-lg object-cover shrink-0" />
        <p className="text-[11px] leading-tight text-gray-600 font-medium">
          💛 Obrigado por ajudar! Sua compra leva amor e acolhimento aos idosos do{" "}
          <span className="underline font-bold">Lar Aconchego & Fé</span>
        </p>
      </div>

      <div className="text-center">
        <p className="text-lg font-bold text-gray-600">
          {label} — <span className="text-brand-gold font-black">R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex items-center gap-3">
          <ShieldCheck className="text-green-500 shrink-0" size={20} />
          <p className="text-xs font-bold text-gray-600">Pagamento processado com segurança pelo Mercado Pago</p>
        </div>
        {!isCreating && pixCode && (
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex items-center gap-3">
            <Clock className="text-orange-400 shrink-0" size={20} />
            <p className="text-xs font-bold text-gray-600">
              Este Pix expira em <span className="text-orange-500 font-black">{formatTime(timeLeft)}</span>
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
            <p className="text-sm font-bold text-gray-500">Ou escaneie o QR Code:</p>
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
        <div className="bg-white rounded-2xl p-4 flex items-start gap-3 shadow-sm border border-gray-50">
          <Check className="text-green-500 mt-1 shrink-0" size={18} />
          <p className="text-xs font-bold text-gray-500 leading-snug">
            A cobrança aparecerá no app do seu banco como "Felipe Hans"
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 flex items-start gap-4 shadow-sm border border-gray-50 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-green-500" />
          <div className="text-2xl mt-1 shrink-0">📱</div>
          <div>
            <p className="text-xs font-bold text-gray-600 leading-snug">
              Após o pagamento, suas imagens serão enviadas automaticamente para o seu WhatsApp.
            </p>
            {phoneNumber && (
              <p className="text-xs font-black text-brand-gold mt-1">
                📲 {phoneNumber}
              </p>
            )}
            <p className="text-[11px] font-bold text-gray-400 mt-2 leading-snug">
              ⏱️ A entrega acontece em poucos minutos. Basta abrir o WhatsApp e conferir!
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 mb-28">
        <div className="text-center mb-2">
          <h3 className="text-brand-gold font-black">💛 Quem já guardou seu momento com Jesus</h3>
          <p className="text-[11px] font-bold text-gray-400 mt-1">Veja mensagens de quem recebeu suas imagens</p>
        </div>
        <TestimonialCarousel images={DEPOIMENTOS} />
      </div>

      {!isCreating && pixCode && paymentStatus === 'pending' && (
        <div className="fixed bottom-0 inset-x-0 bg-white/90 backdrop-blur-md border-t border-gray-100 flex items-center justify-center gap-3" style={{ paddingTop: '12px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          <div className="w-5 h-5 border-2 border-brand-gold border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold text-gray-500">Aguardando confirmação do pagamento...</span>
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
