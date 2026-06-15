import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import { Camera, Image as ImageIcon, XCircle, Check, ShieldCheck, Clock, Copy, ChevronRight, ChevronLeft, X, Phone } from "lucide-react";

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

// ── AppFlowV2 ─────────────────────────────────────────────────────────────────
function AppFlowV2() {
  const [currentStep, setCurrentStep]           = useState<Step>('landing');
  const [selectedStyles, setSelectedStyles]     = useState<number[]>([]);
  const [resultsSelected, setResultsSelected]   = useState<number[]>([]);
  const [showUpsell, setShowUpsell]             = useState(false);
  const [pixValue, setPixValue]                 = useState<number>(10.90);
  const [pixLabel, setPixLabel]                 = useState<string>("1 imagem");
  const [pixCodePlaceholder, setPixCodePlaceholder] = useState<string>("PIX_CODE_1_IMAGE");
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null);
  const [showPhotoConfirm, setShowPhotoConfirm] = useState(false);
  const [phoneNumber, setPhoneNumber]           = useState<string>("");

  const nextStep = (step: Step) => { window.scrollTo(0, 0); setCurrentStep(step); };

  const handleFileSelect = (url: string) => { setUploadedPhotoUrl(url); setShowPhotoConfirm(true); };
  const handlePhotoConfirm = () => { setShowPhotoConfirm(false); nextStep('styles'); };
  const handlePhotoRetry   = () => {
    setShowPhotoConfirm(false);
    if (uploadedPhotoUrl) URL.revokeObjectURL(uploadedPhotoUrl);
    setUploadedPhotoUrl(null);
  };

  const goToPhone = (value: number, label: string, code: string) => {
    setPixValue(value); setPixLabel(label); setPixCodePlaceholder(code);
    nextStep('phone');
  };

  const handleResultsContinue = () => {
    if (resultsSelected.length === 4) {
      goToPhone(43.60, "4 imagens", "PIX_CODE_4_IMAGES");
    } else {
      setShowUpsell(true);
    }
  };

  return (
    <>
      <div className="theme-v2">
        <div className="app-container">
          <div className="w-full max-w-[480px] min-h-screen relative overflow-x-hidden">
            {currentStep === 'landing'  && <LandingScreenV2  onNext={() => nextStep('upload')} />}
            {currentStep === 'upload'   && <UploadScreenV2   onFileSelect={handleFileSelect} />}
            {currentStep === 'styles'   && (
              <StylesScreenV2 selectedIds={selectedStyles} setSelectedIds={setSelectedStyles} onNext={() => nextStep('loading')} />
            )}
            {currentStep === 'loading'  && <LoadingScreenV2  onFinish={() => nextStep('results')} />}
            {currentStep === 'results'  && (
              <ResultsScreenV2 selectedIds={resultsSelected} setSelectedIds={setResultsSelected} onContinue={handleResultsContinue} />
            )}
            {currentStep === 'phone'    && (
              <PhoneScreenV2 phone={phoneNumber} setPhone={setPhoneNumber} onNext={() => nextStep('pix')} />
            )}
            {currentStep === 'pix'      && (
              <PixScreenV2 value={pixValue} label={pixLabel} pixCode={pixCodePlaceholder} phoneNumber={phoneNumber} />
            )}
          </div>
        </div>
      </div>

      {/* Modals fora do overflow-x-hidden para fixed funcionar corretamente */}
      {showPhotoConfirm && uploadedPhotoUrl && (
        <PhotoConfirmModalV2 photoUrl={uploadedPhotoUrl} onConfirm={handlePhotoConfirm} onRetry={handlePhotoRetry} />
      )}
      {showUpsell && (
        <UpsellModalV2
          selectedIds={resultsSelected}
          onAccept={(v, l, c) => { setShowUpsell(false); goToPhone(v, l, c); }}
          onDecline={(v, l, c) => { setShowUpsell(false); goToPhone(v, l, c); }}
          onClose={() => setShowUpsell(false)}
        />
      )}
    </>
  );
}

// ── LANDING ───────────────────────────────────────────────────────────────────
function LandingScreenV2({ onNext }: { onNext: () => void }) {
  return (
    <div className="content-wrapper animate-in fade-in duration-300 text-center">
      <header className="mb-2">
        <p className="text-xs font-bold tracking-[0.25em] uppercase text-brand-gold mb-2 opacity-70">
          Experiência exclusiva com IA
        </p>
        <h1 className="text-[28px] font-black leading-tight text-foreground">
          Veja como seria
        </h1>
        <h2
          className="text-[28px] font-black leading-tight mt-0.5"
          style={{
            background: "linear-gradient(135deg, #F5A623 0%, #C8860A 55%, #F5A623 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          ao lado de Jesus ✝️
        </h2>
        <p className="text-gray-500 mt-2 text-sm px-4 leading-relaxed">
          Crie uma imagem emocionante e única em poucos segundos
        </p>
      </header>

      <div className="flex items-center gap-3 px-4">
        <div className="flex-1 h-px bg-brand-gold/20" />
        <span className="text-brand-gold/40 text-xs">✦</span>
        <div className="flex-1 h-px bg-brand-gold/20" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {STYLES.map((style) => (
          <div key={style.id} className="card-style relative aspect-[3/4] overflow-hidden">
            <img src={style.img} alt={style.label} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="absolute bottom-0 inset-x-0 bg-white/90 py-2 px-2 text-[10px] font-semibold text-foreground text-center border-t border-brand-gold/20">
              {style.label}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2">
        <button onClick={onNext} className="btn-primary btn-shimmer">
          ✨ CRIAR MINHA IMAGEM
        </button>
        <p className="text-[11px] text-gray-400 mt-3 font-medium">
          🔒 Seguro · Rápido · Entregue no WhatsApp
        </p>
      </div>
    </div>
  );
}

// ── UPLOAD ────────────────────────────────────────────────────────────────────
function UploadScreenV2({ onFileSelect }: { onFileSelect: (url: string) => void }) {
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(URL.createObjectURL(e.target.files[0]));
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
function PhotoConfirmModalV2({ photoUrl, onConfirm, onRetry }: {
  photoUrl: string; onConfirm: () => void; onRetry: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-[420px] rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-y-auto" style={{ maxHeight: '90dvh' }}>
        <div className="p-5 relative">
          <button onClick={onRetry} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600">
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

          <div className="flex flex-col gap-3 pb-2">
            <button onClick={onConfirm} className="btn-primary flex items-center justify-center gap-2">
              SIM, AVANÇAR <ChevronRight size={18} strokeWidth={3} />
            </button>
            <button onClick={onRetry} className="text-sm text-gray-400 font-bold text-center py-2">
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
  const toggleSelection = (id: number) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
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
        className={`btn-primary mt-6 transition-opacity ${selectedIds.length === 0 ? "opacity-40" : "opacity-100"}`}
        disabled={selectedIds.length === 0}
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
  const toggleSelection = (id: number) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  };

  const hasSelection = selectedIds.length > 0;
  const totalPrice = selectedIds.length * 10.90;

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

      <div className="flex flex-col gap-1.5 bg-amber-50/60 rounded-xl p-3 border border-amber-100">
        <p className="text-xs text-amber-700 font-medium">⏳ Sua imagem fica disponível por tempo limitado</p>
        <p className="text-xs text-foreground font-medium">✝️ Imagem pronta para você guardar para sempre</p>
      </div>

      {hasSelection && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white/80 border border-brand-gold/30 rounded-2xl p-4 text-center shadow-sm">
            <p className="text-sm font-bold text-gray-500">
              {selectedIds.length} {selectedIds.length === 1 ? "imagem selecionada" : "imagens selecionadas"}
            </p>
            <p className="text-2xl font-black text-brand-gold mt-1">
              Total: R$ {totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>

          <button
            className="btn-primary mt-4 pulse-glow w-full flex flex-col items-center py-4 gap-0.5"
            onClick={onContinue}
          >
            <span className="font-extrabold text-base tracking-wide">LIBERAR MINHA IMAGEM AGORA</span>
            <span className="text-[11px] font-medium opacity-90">Pagamento rápido e seguro via Pix</span>
          </button>

          <p className="text-center text-xs text-gray-400 font-medium mt-2">Acesso imediato após o pagamento</p>
        </div>
      )}

      {/* Social Proof — carousel com rotação */}
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
  );
}

// ── UPSELL MODAL ──────────────────────────────────────────────────────────────
function UpsellModalV2({ selectedIds, onAccept, onDecline, onClose }: {
  selectedIds: number[];
  onAccept:  (value: number, label: string, code: string) => void;
  onDecline: (value: number, label: string, code: string) => void;
  onClose: () => void;
}) {
  const count = selectedIds.length;
  const selectedStyles = STYLES.filter(s => selectedIds.includes(s.id));

  const popupData = (() => {
    const base = {
      title: "🔥 PROMOÇÃO RELÂMPAGO!",
      strikethrough: "R$ 43,60",
      acceptLabel: "4 imagens",
      acceptCode: "PIX_CODE_4_IMAGES",
      declineValue: count * 10.90,
      declineLabel: `${count} imagem(ns)`,
      declineCode: `PIX_CODE_${count}_IMAGES`,
      upsellText: "",
      offerPrice: 0,
      economy: 0,
      acceptValue: 0,
    };
    if (count === 1) return { ...base, upsellText: "Acrescente as outras 3 fotos com Jesus que você não selecionou por apenas", offerPrice: 22.60, economy: 21.00, acceptValue: 22.60 };
    if (count === 2) return { ...base, upsellText: "Acrescente as outras 2 fotos com Jesus que você não selecionou por apenas", offerPrice: 29.60, economy: 14.00, acceptValue: 29.60 };
    return { ...base, upsellText: "Acrescente a outra foto com Jesus que você não selecionou por apenas", offerPrice: 36.60, economy: 7.00, acceptValue: 36.60 };
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
            <button onClick={() => onAccept(popupData.acceptValue, popupData.acceptLabel, popupData.acceptCode)} className="btn-primary py-4 text-base">
              Sim, quero todas! 💕
            </button>
            <button onClick={() => onDecline(popupData.declineValue, popupData.declineLabel, popupData.declineCode)} className="text-sm text-gray-400 underline font-bold">
              Não, obrigado (continuar com R$ {popupData.declineValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PHONE SCREEN ──────────────────────────────────────────────────────────────
function PhoneScreenV2({ phone, setPhone, onNext }: {
  phone: string;
  setPhone: React.Dispatch<React.SetStateAction<string>>;
  onNext: () => void;
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(maskPhone(e.target.value));
  };

  const digits = phone.replace(/\D/g, "");
  const isValid = digits.length === 11;

  return (
    <div className="content-wrapper animate-in fade-in duration-300">
      <div className="flex flex-col items-center text-center gap-3">
        <div className="w-20 h-20 bg-brand-gold/10 rounded-full flex items-center justify-center border border-brand-gold/20">
          <Phone size={36} className="text-brand-gold" />
        </div>
        <h1 className="text-2xl text-foreground leading-tight">Quase lá! 🙌</h1>
        <p className="text-gray-500 text-sm leading-relaxed px-2">
          Informe seu WhatsApp para receber suas imagens automaticamente após o pagamento.
        </p>
      </div>

      <div className="bg-white/70 rounded-2xl p-5 border border-brand-gold/20 flex flex-col gap-3">
        <label className="text-sm font-bold text-foreground">Seu número de WhatsApp:</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">📱</span>
          <input
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={handleChange}
            placeholder="(11) 99999-9999"
            className={`w-full pl-10 pr-4 py-4 rounded-xl border-2 text-base font-bold text-foreground placeholder:text-gray-300 outline-none transition-colors bg-white ${
              isValid ? "border-brand-gold bg-amber-50/30" : "border-gray-200"
            }`}
          />
        </div>
        <p className="text-[11px] text-gray-400 font-medium">Inclua o DDD (ex: 11 para São Paulo)</p>
      </div>

      <div className="bg-amber-50/80 rounded-2xl p-4 border border-amber-200/60 flex items-start gap-3">
        <span className="text-xl shrink-0">📲</span>
        <p className="text-xs font-medium text-gray-600 leading-relaxed">
          Após confirmar o pagamento via PIX, suas imagens serão enviadas automaticamente para este número no WhatsApp.{" "}
          <strong className="text-gray-700">A entrega leva apenas alguns minutos.</strong>
        </p>
      </div>

      <div className="bg-white/60 rounded-2xl p-4 border border-brand-gold/15 flex items-start gap-3">
        <ShieldCheck size={18} className="text-green-500 shrink-0 mt-0.5" />
        <p className="text-[11px] text-gray-500 leading-relaxed">
          Seus dados são usados apenas para entrega das imagens e nunca serão compartilhados com terceiros.
        </p>
      </div>

      <button
        onClick={onNext}
        disabled={!isValid}
        className={`btn-primary flex items-center justify-center gap-2 transition-opacity ${
          isValid ? "opacity-100" : "opacity-40"
        }`}
      >
        CONTINUAR PARA O PAGAMENTO <ChevronRight size={18} strokeWidth={3} />
      </button>
    </div>
  );
}

// ── TESTIMONIAL CAROUSEL (V2) ─────────────────────────────────────────────────
function TestimonialCarouselV2({ images }: { images: string[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setActive(Math.round(el.scrollLeft / el.clientWidth));
  }, []);

  const goTo = (i: number) => {
    const target = Math.max(0, Math.min(images.length - 1, i));
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: target * el.clientWidth, behavior: 'smooth' });
    setActive(target);
  };

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto no-scrollbar snap-x-mandatory"
      >
        {images.map((src, i) => (
          <div key={i} className="snap-center w-full shrink-0 flex justify-center items-center py-2 px-2">
            <img
              src={src}
              alt={`Depoimento ${i + 1}`}
              className="w-full rounded-2xl shadow-xl object-cover"
              loading="lazy"
            />
          </div>
        ))}
      </div>

      {active > 0 && (
        <button
          onClick={() => goTo(active - 1)}
          className="absolute left-1 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 backdrop-blur-sm shadow-md rounded-full flex items-center justify-center text-gray-600 z-10"
          aria-label="Anterior"
        >
          <ChevronLeft size={20} />
        </button>
      )}
      {active < images.length - 1 && (
        <button
          onClick={() => goTo(active + 1)}
          className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 backdrop-blur-sm shadow-md rounded-full flex items-center justify-center text-gray-600 z-10"
          aria-label="Próximo"
        >
          <ChevronRight size={20} />
        </button>
      )}

      <div className="flex justify-center items-center gap-2 mt-3">
        {images.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`transition-all duration-300 rounded-full h-2 ${
              i === active ? 'w-6 bg-brand-gold' : 'w-2 bg-gray-200'
            }`}
            aria-label={`Ir para depoimento ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

// ── PIX SCREEN ────────────────────────────────────────────────────────────────
function PixScreenV2({ value, label, pixCode, phoneNumber }: {
  value: number; label: string; pixCode: string; phoneNumber: string;
}) {
  const [timeLeft, setTimeLeft] = useState(15 * 60);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const copyPix = () => {
    navigator.clipboard.writeText(pixCode);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  return (
    <div className="content-wrapper animate-in fade-in duration-300">
      <div className="flex flex-col items-center mb-2">
        <img src={mpLogoImg} alt="Mercado Pago" className="h-10 object-contain mb-4" />
        <h1 className="text-xl text-foreground tracking-tight">Pagamento via Pix</h1>
      </div>

      <div className="bg-white/70 rounded-2xl p-4 flex items-center gap-4 border border-brand-gold/20 shadow-sm">
        <img src={larLogoImg} alt="Lar Aconchego & Fé" className="w-12 h-12 rounded-xl object-cover shrink-0 border border-brand-gold/20" />
        <p className="text-[11px] leading-relaxed text-gray-600 font-medium">
          💛 Obrigado por ajudar! Sua compra leva amor e acolhimento aos idosos do{" "}
          <span className="underline font-bold">Lar Aconchego & Fé</span>
        </p>
      </div>

      <div className="text-center py-2">
        <p className="text-base font-bold text-gray-500">{label}</p>
        <p className="text-3xl font-black text-brand-gold mt-0.5">
          R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="bg-white/70 border border-green-100 rounded-2xl p-3.5 flex items-center gap-3">
          <ShieldCheck className="text-green-500 shrink-0" size={18} />
          <p className="text-xs font-bold text-gray-600">Pagamento processado com segurança pelo Mercado Pago</p>
        </div>
        <div className="bg-white/70 border border-amber-100 rounded-2xl p-3.5 flex items-center gap-3">
          <Clock className="text-brand-gold shrink-0" size={18} />
          <p className="text-xs font-bold text-gray-600">
            Este Pix expira em <span className="text-brand-gold font-black">{formatTime(timeLeft)}</span>
          </p>
        </div>
      </div>

      <div>
        <button onClick={copyPix} className="btn-primary flex items-center justify-center gap-2">
          <Copy size={18} /> COPIAR CÓDIGO PIX
        </button>
        <p className="text-[10px] text-gray-300 text-center mt-2 font-mono">[{pixCode}]</p>
      </div>

      <div className="text-center">
        <p className="text-sm font-semibold text-gray-400 mb-4">Ou escaneie o QR Code:</p>
        <div className="mx-auto w-48 h-48 bg-white border-4 border-brand-gold/20 shadow-md rounded-2xl flex items-center justify-center text-gray-300 font-bold text-[10px] text-center p-4">
          [QR code — {pixCode}]
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="bg-white/70 rounded-2xl p-4 flex items-start gap-3 border border-gray-100">
          <Check className="text-green-500 mt-0.5 shrink-0" size={16} />
          <p className="text-xs font-bold text-gray-600 leading-snug">
            A cobrança aparecerá no app do seu banco como "Felipe Hans"
          </p>
        </div>

        <div className="bg-white/70 rounded-2xl p-4 flex items-start gap-4 border border-gray-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-green-400 rounded-l-2xl" />
          <div className="text-xl mt-0.5 shrink-0">📱</div>
          <div>
            <p className="text-xs font-bold text-gray-600 leading-snug">
              Após o pagamento, suas imagens serão enviadas automaticamente para o seu WhatsApp.
            </p>
            {phoneNumber && (
              <p className="text-xs font-black text-brand-gold mt-1">📲 {phoneNumber}</p>
            )}
            <p className="text-[11px] font-medium text-gray-400 mt-1.5 leading-snug">
              ⏱️ A entrega acontece em poucos minutos. Basta abrir o WhatsApp e conferir!
            </p>
          </div>
        </div>
      </div>

      {/* Social proof — carousel com rotação */}
      <div className="mb-28">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex-1 h-px bg-brand-gold/20" />
          <p className="text-xs font-black text-foreground whitespace-nowrap">💛 Quem já guardou seu momento</p>
          <div className="flex-1 h-px bg-brand-gold/20" />
        </div>
        <TestimonialCarouselV2 images={DEPOIMENTOS} />
      </div>

      <div className="fixed bottom-0 inset-x-0 bg-white/90 backdrop-blur-md border-t border-brand-gold/20 flex items-center justify-center gap-3" style={{ paddingTop: '12px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <div className="w-4 h-4 border-2 border-brand-gold border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-bold text-gray-500">Aguardando confirmação do pagamento...</span>
      </div>

      {showToast && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 bg-foreground text-white px-6 py-2 rounded-full text-sm font-bold animate-in fade-in slide-in-from-top-4 duration-300 z-[60]">
          Código copiado! ✓
        </div>
      )}
    </div>
  );
}
