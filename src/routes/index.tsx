import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { Camera, Image as ImageIcon, XCircle, Check, Heart, ShieldCheck, Clock, Copy, ChevronRight, X } from "lucide-react";

export const Route = createFileRoute("/")({
  component: AppFlow,
});

type Step = 'landing' | 'upload' | 'styles' | 'loading' | 'results' | 'pix';

const STYLES = [
  { id: 1, label: "Jesus te abraçando", icon: "🫂", description: "Jesus te abraçando" },
  { id: 2, label: "Jesus ao seu lado sorrindo", icon: "😊", description: "Jesus ao seu lado sorrindo" },
  { id: 3, label: "Jesus segurando sua mão", icon: "🤝", description: "Jesus segurando sua mão" },
  { id: 4, label: "Momento no campo com Jesus", icon: "🌿", description: "Momento no campo com Jesus" },
];

function AppFlow() {
  const [currentStep, setCurrentStep] = useState<Step>('landing');
  const [selectedStyles, setSelectedStyles] = useState<number[]>([]);
  const [resultsSelected, setResultsSelected] = useState<number[]>([]);
  const [showUpsell, setShowUpsell] = useState(false);
  const [pixValue, setPixValue] = useState<number>(7.90);
  const [pixLabel, setPixLabel] = useState<string>("1 imagem");
  const [pixCodePlaceholder, setPixCodePlaceholder] = useState<string>("PIX_CODE_1_IMAGE");

  const nextStep = (step: Step) => {
    window.scrollTo(0, 0);
    setCurrentStep(step);
  };

  const handleResultsContinue = () => {
    if (resultsSelected.length === 4) {
      setPixValue(31.60);
      setPixLabel("4 imagens");
      setPixCodePlaceholder("PIX_CODE_4_IMAGES");
      nextStep('pix');
    } else {
      setShowUpsell(true);
    }
  };

  return (
    <div className="app-container font-nunito">
      <div className="w-full max-w-[480px] min-h-screen relative overflow-x-hidden">
        {currentStep === 'landing' && (
          <LandingScreen onNext={() => nextStep('upload')} />
        )}
        {currentStep === 'upload' && (
          <UploadScreen onNext={() => nextStep('styles')} />
        )}
        {currentStep === 'styles' && (
          <StylesScreen 
            selectedIds={selectedStyles} 
            setSelectedIds={setSelectedStyles} 
            onNext={() => nextStep('loading')} 
          />
        )}
        {currentStep === 'loading' && (
          <LoadingScreen onFinish={() => nextStep('results')} />
        )}
        {currentStep === 'results' && (
          <ResultsScreen 
            selectedIds={resultsSelected}
            setSelectedIds={setResultsSelected}
            onContinue={handleResultsContinue}
          />
        )}
        {currentStep === 'pix' && (
          <PixScreen value={pixValue} label={pixLabel} pixCode={pixCodePlaceholder} />
        )}

        {showUpsell && (
          <UpsellModal 
            selectedIds={resultsSelected}
            onAccept={(value, label, code) => {
              setPixValue(value);
              setPixLabel(label);
              setPixCodePlaceholder(code);
              setShowUpsell(false);
              nextStep('pix');
            }}
            onDecline={(value, label, code) => {
              setPixValue(value);
              setPixLabel(label);
              setPixCodePlaceholder(code);
              setShowUpsell(false);
              nextStep('pix');
            }}
            onClose={() => setShowUpsell(false)}
          />
        )}
      </div>
    </div>
  );
}

function LandingScreen({ onNext }: { onNext: () => void }) {
  return (
    <div className="content-wrapper animate-in fade-in duration-300 text-center">
      <header className="mb-4">
        <h1 className="text-[22px] font-bold text-foreground leading-tight">
          ✝️ Veja como seria um momento seu
        </h1>
        <h2 className="text-[22px] font-bold text-brand-gold leading-tight">
          ao lado de Jesus
        </h2>
        <p className="text-gray-500 mt-2 text-sm px-4">
          Crie uma imagem emocionante e única em poucos segundos
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4">
        {STYLES.map((style) => (
          <div key={style.id} className="card-style relative aspect-[3/4] bg-[#FDF8F0] border border-orange-50">
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <span className="text-4xl filter grayscale-[0.2]">{style.icon}</span>
              <div className="w-12 h-1 bg-brand-gold/20 rounded-full" />
            </div>
            <div className="absolute bottom-0 inset-x-0 bg-white/95 py-2.5 px-2 text-[10px] font-extrabold text-foreground uppercase tracking-wider">
              {style.label}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <button onClick={onNext} className="btn-primary">
          CRIAR MINHA IMAGEM
        </button>
      </div>
    </div>
  );
}

function UploadScreen({ onNext }: { onNext: () => void }) {
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onNext();
    }
  };

  return (
    <div className="content-wrapper animate-in fade-in duration-300">
      <header className="text-center">
        <h1 className="text-2xl font-bold text-foreground">
          📷 Envie sua foto
        </h1>
      </header>

      <div className="border-2 border-red-500 bg-red-50 rounded-xl p-4 flex flex-col items-center gap-1 text-red-600">
        <span className="font-bold flex items-center gap-2 text-lg">
          <XCircle size={20} /> IMPORTANTE
        </span>
        <p className="font-extrabold text-sm uppercase">
          NÃO FUNCIONA COM FOTOS DE CRIANÇAS!
        </p>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm text-center flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-gray-700">
          A sua imagem ao lado de Jesus é criada com uma Inteligência Artificial ultra realista. Por isso, para criarmos uma imagem que realmente seja parecida com você, precisamos que a sua foto siga as orientações abaixo:
        </p>
        
        <p className="font-bold text-foreground">
          Uma selfie do seu rosto, bem iluminada.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <div className="aspect-square bg-gray-100 rounded-2xl flex items-center justify-center border-2 border-transparent overflow-hidden">
               <div className="text-gray-400 text-[10px] font-bold uppercase text-center px-4 leading-tight">
                 Tirar foto de costas ou longe
               </div>
            </div>
            <span className="text-[11px] text-gray-500 font-bold uppercase tracking-tight">Tire assim</span>
          </div>
          <div className="flex flex-col gap-2">
            <div className="aspect-square bg-brand-blue-light/30 rounded-2xl flex items-center justify-center border-2 border-brand-gold overflow-hidden">
               <div className="text-brand-gold text-[10px] font-bold uppercase text-center px-4 leading-tight">
                 Selfie de frente bem iluminada
               </div>
            </div>
            <span className="text-[11px] text-brand-gold font-bold uppercase tracking-tight">Foto ideal ✓</span>
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 rounded-2xl p-4 border border-yellow-200">
        <p className="text-sm font-bold text-yellow-800 flex items-center gap-2 mb-2">
          💡 Para que as imagens fiquem parecidas com você, siga as orientações abaixo:
        </p>
        <ul className="text-xs text-yellow-700 space-y-1.5 list-none pl-1">
          <li>• Apenas 1 pessoa na foto</li>
          <li>• Rosto próximo da câmera (evite corpo inteiro de longe)</li>
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

function StylesScreen({ selectedIds, setSelectedIds, onNext }: { selectedIds: number[], setSelectedIds: React.Dispatch<React.SetStateAction<number[]>>, onNext: () => void }) {
  const toggleSelection = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="content-wrapper animate-in fade-in duration-300 text-center">
      <header>
        <h1 className="text-2xl font-bold text-foreground">
          🎨 Passo 2: Escolha os estilos
        </h1>
        <p className="text-gray-500 mt-2 text-sm">
          Clique em cima das imagens que você mais gostou. Se gostou das 4, selecione as 4.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 mt-4">
        {STYLES.map((style) => {
          const isSelected = selectedIds.includes(style.id);
          return (
            <div
              key={style.id}
              onClick={() => toggleSelection(style.id)}
              className={`card-style relative aspect-[3/4] bg-[#f5f5dc] transition-all cursor-pointer ${
                isSelected ? "border-[3px] border-brand-gold scale-[1.02]" : "border-[3px] border-transparent"
              }`}
            >
              {isSelected && (
                <div className="absolute top-2 right-2 bg-brand-gold text-white rounded-full p-0.5 z-10">
                  <Check size={14} strokeWidth={4} />
                </div>
              )}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <span className="text-4xl filter grayscale-[0.2]">{style.icon}</span>
                <div className="w-12 h-1 bg-brand-gold/20 rounded-full" />
              </div>
              <div className="absolute bottom-0 inset-x-0 bg-white/90 py-2 px-1 text-[10px] font-bold text-foreground">
                {style.label}
              </div>
            </div>
          );
        })}
      </div>

      <button 
        className={`btn-primary mt-8 transition-opacity ${selectedIds.length === 0 ? "opacity-50" : "opacity-100"}`}
        disabled={selectedIds.length === 0}
        onClick={onNext}
      >
        CONTINUAR
      </button>
    </div>
  );
}

function LoadingScreen({ onFinish }: { onFinish: () => void }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const duration = 3800;
    const interval = 20;
    const steps = duration / interval;
    const increment = 90 / steps;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(timer);
          return 90;
        }
        return prev + increment;
      });
    }, interval);

    const finishTimer = setTimeout(() => {
      onFinish();
    }, duration);

    return () => {
      clearInterval(timer);
      clearTimeout(finishTimer);
    };
  }, [onFinish]);

  return (
    <div className="content-wrapper animate-in fade-in duration-300 flex flex-col items-center justify-center min-h-[80vh] text-center">
      <div className="text-[80px] mb-6 animate-bounce">🙏</div>
      <h2 className="text-2xl font-bold text-foreground mb-2">Criando sua imagem...</h2>
      <p className="text-gray-500 mb-8">Quase pronto...</p>
      
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

function ResultsScreen({ selectedIds, setSelectedIds, onContinue }: { selectedIds: number[], setSelectedIds: React.Dispatch<React.SetStateAction<number[]>>, onContinue: () => void }) {
  const toggleSelection = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const hasSelection = selectedIds.length > 0;
  const totalPrice = selectedIds.length * 7.90;

  return (
    <div className="content-wrapper animate-in fade-in duration-300">
      <header className="text-center">
        <h1 className="text-2xl font-bold text-foreground leading-tight">
          ✝️ Veja como ficou seu<br />momento com Jesus
        </h1>
        <p className="text-gray-500 italic mt-2 text-sm">
          "Um momento especial que você pode guardar para sempre"
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 mt-6">
        {STYLES.map((style) => {
          const isSelected = selectedIds.includes(style.id);
          return (
            <div key={style.id} className="flex flex-col gap-2">
              <div 
                onClick={() => toggleSelection(style.id)}
                className={`card-style relative aspect-square transition-all cursor-pointer overflow-hidden ${
                  isSelected ? "border-[3px] border-brand-gold border-dashed scale-[1.02]" : "border-3 border-transparent"
                }`}
              >
                {/* Blurred/Warm Placeholder */}
                <div className="absolute inset-0 bg-[#f5f5dc] blur-sm opacity-60" />
                <div className="absolute inset-0 bg-gradient-to-tr from-orange-100/50 to-yellow-50/30" />
                
                {/* Badges */}
                <div className="absolute top-2 left-2 flex flex-col gap-0.5 z-10">
                  <span className="bg-black/70 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-sm">
                    Apenas R$ 7,90
                  </span>
                  <span className="text-[6px] text-gray-600 font-bold uppercase tracking-tighter">
                    Alta qualidade para baixar
                  </span>
                </div>

                {/* Center Button */}
                {!isSelected && (
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="bg-brand-gold text-white text-[10px] font-black px-3 py-1 rounded-full flex items-center gap-1 shadow-md">
                      TOQUE 👆
                    </div>
                  </div>
                )}

                {/* Bottom Bar */}
                <div className={`absolute bottom-0 inset-x-0 py-1.5 text-[9px] font-black text-center uppercase tracking-wide transition-colors ${
                  isSelected ? "bg-[#1e293b] text-brand-gold" : "bg-[#4da8da] text-white"
                }`}>
                  {isSelected ? "SUA ESCOLHA 💛" : "💛 LEVE TAMBÉM"}
                </div>
              </div>
              <p className="text-[10px] text-center font-bold text-gray-600 uppercase">
                {style.description}
              </p>
            </div>
          );
        })}
      </div>

      {hasSelection && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="mt-6 text-center">
            <p className="text-xl font-black text-gray-700">
              Total: <span className="text-brand-gold">R$ {totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </p>
          </div>

          <button 
            className="btn-primary mt-6 pulse-glow w-full"
            onClick={onContinue}
          >
            ✨ Quero liberar minha imagem agora
          </button>

          <div className="text-center mt-6">
            <p className="text-sm font-medium">
              👉 Toque em <span className="text-brand-gold font-extrabold uppercase">CADA</span> imagem que você quer liberar
            </p>
            <p className="text-[11px] text-gray-400 mt-1">
              Você pode escolher mais de uma — toque em todas que quiser
            </p>
          </div>

          {/* Info Card */}
          <div className="bg-white border-2 border-brand-blue-light rounded-2xl p-4 flex items-center gap-4 shadow-sm mt-6">
            <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center text-[10px] text-gray-400 font-bold text-center leading-tight">
              [IMAGE PLACEHOLDER: Lar Aconchego]
            </div>
            <div className="flex-1">
              <p className="text-brand-gold font-bold text-xs leading-tight">
                💛 100% dos valores arrecadados serão doados para o <span className="underline cursor-pointer">Lar Aconchego & Fé</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UpsellModal({ selectedIds, onAccept, onDecline, onClose }: { 
  selectedIds: number[], 
  onAccept: (value: number, label: string, code: string) => void, 
  onDecline: (value: number, label: string, code: string) => void,
  onClose: () => void 
}) {
  const count = selectedIds.length;
  const selectedStyles = STYLES.filter(s => selectedIds.includes(s.id));
  
  let popupData = {
    title: "🔥 PROMOÇÃO RELÂMPAGO!",
    carrying: selectedStyles,
    upsellText: "",
    strikethrough: "R$ 43,60",
    offerPrice: 0,
    economy: 0,
    acceptValue: 0,
    acceptLabel: "4 imagens",
    acceptCode: "PIX_CODE_4_IMAGES",
    declineValue: count * 7.90,
    declineLabel: `${count} imagem(ns)`,
    declineCode: `PIX_CODE_${count}_IMAGES`
  };

  if (count === 1) {
    popupData.upsellText = "Acrescente as outras 3 fotos com Jesus que você não selecionou por apenas R$ 3,90 cada!";
    popupData.offerPrice = 22.60;
    popupData.economy = 21.00;
    popupData.acceptValue = 22.60;
  } else if (count === 2) {
    popupData.upsellText = "Acrescente as outras 2 fotos com Jesus que você não selecionou por apenas R$ 3,90 cada!";
    popupData.offerPrice = 29.60;
    popupData.economy = 14.00;
    popupData.acceptValue = 29.60;
  } else if (count === 3) {
    popupData.upsellText = "Acrescente a outra 1 foto com Jesus que você não selecionou por apenas R$ 3,90 cada!";
    popupData.offerPrice = 36.60;
    popupData.economy = 7.00;
    popupData.acceptValue = 36.60;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-[400px] rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="bg-brand-gold p-4 relative text-center">
          <h3 className="text-white font-black text-lg tracking-tight">
            {popupData.title}
          </h3>
          <button 
            onClick={onClose}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white"
          >
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
                  <span>R$ 7,90</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-2 border-brand-gold border-dashed bg-yellow-50/50 rounded-2xl p-4">
            <p className="text-xs font-bold text-gray-600 leading-tight">
              {popupData.upsellText}
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-gray-500">Aceitando agora você paga só</p>
            <p className="text-sm text-gray-400 line-through font-bold">De {popupData.strikethrough}</p>
            <p className="text-2xl font-black text-brand-gold">por R$ {popupData.offerPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <p className="text-xs font-bold text-gray-400 italic">pelas 4 imagens</p>
            <p className="text-brand-gold font-bold text-sm mt-1">👍 Economia de R$ {popupData.economy.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>

          <div className="flex flex-col gap-4 mt-2">
            <button 
              onClick={() => onAccept(popupData.acceptValue, popupData.acceptLabel, popupData.acceptCode)} 
              className="btn-primary py-4 text-base font-extrabold"
            >
              Sim, quero todas! 💕
            </button>
            <button 
              onClick={() => onDecline(popupData.declineValue, popupData.declineLabel, popupData.declineCode)} 
              className="text-sm text-gray-400 underline font-bold"
            >
              Não, obrigado (continuar com R$ {popupData.declineValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PixScreen({ value, label, pixCode }: { value: number, label: string, pixCode: string }) {
  const [timeLeft, setTimeLeft] = useState(15 * 60);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
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
      <div className="flex flex-col items-center mb-6">
        <div className="w-48 h-12 bg-gray-100 rounded flex items-center justify-center text-[10px] text-gray-400 font-bold mb-4">
          [IMAGE: Mercado Pago logo]
        </div>
        <h1 className="text-xl font-black text-foreground tracking-tight">
          PAGAMENTO VIA PIX
        </h1>
      </div>

      <div className="bg-white rounded-2xl p-4 flex items-center gap-4 shadow-sm border border-gray-100">
        <div className="w-12 h-12 bg-gray-100 rounded-lg shrink-0 flex items-center justify-center text-[8px] text-gray-400 font-bold text-center leading-tight">
          [IMAGE: Lar Aconchego]
        </div>
        <div>
          <p className="text-[11px] leading-tight text-gray-600 font-medium">
            💛 Obrigado por ajudar! Sua compra leva amor e acolhimento aos idosos do <span className="underline font-bold">Lar Aconchego & Fé</span>
          </p>
        </div>
      </div>

      <div className="text-center mt-6 mb-4">
        <p className="text-lg font-bold text-gray-600">
          {label} — <span className="text-brand-gold font-black">R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex items-center gap-3">
          <ShieldCheck className="text-green-500" size={20} />
          <p className="text-xs font-bold text-gray-600">Pagamento processado com segurança pelo Mercado Pago</p>
        </div>
        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex items-center gap-3">
          <Clock className="text-orange-400" size={20} />
          <p className="text-xs font-bold text-gray-600">Este Pix expira em <span className="text-orange-500">{formatTime(timeLeft)}</span></p>
        </div>
      </div>

      <div className="mt-8">
        <button onClick={copyPix} className="btn-primary flex items-center justify-center gap-2">
          <Copy size={20} /> COPIAR CÓDIGO PIX
        </button>
        <p className="text-[10px] text-gray-400 text-center mt-2 font-mono">[{pixCode}]</p>
      </div>

      <div className="text-center mt-8 mb-4">
        <p className="text-sm font-bold text-gray-500">Ou escaneie o QR Code:</p>
        <div className="mt-4 mx-auto w-48 h-48 bg-white border-4 border-white shadow-lg rounded-xl flex items-center justify-center text-gray-400 font-bold text-[10px] text-center p-4">
          [IMAGE PLACEHOLDER: QR code square for {pixCode}]
        </div>
      </div>

      <div className="flex flex-col gap-3 mt-8">
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
              Após o pagamento, suas imagens serão enviadas automaticamente para o seu WhatsApp <span className="text-green-600">(19) 99826-6668</span>.
            </p>
            <p className="text-[11px] font-bold text-gray-400 mt-2 leading-snug">
              ⏱️ A entrega acontece em poucos minutos. Basta abrir o WhatsApp e conferir!
            </p>
          </div>
        </div>
      </div>

      <div className="mt-12 mb-20">
        <div className="text-center mb-6">
          <h3 className="text-brand-gold font-black">💛 Quem já guardou seu momento com Jesus</h3>
          <p className="text-[11px] font-bold text-gray-400">Veja mensagens de quem recebeu suas imagens</p>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar px-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="min-w-[280px] aspect-[4/3] bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400 font-bold text-[10px] shadow-md">
              [IMAGE: WhatsApp chat screenshot {i}]
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-1.5 mt-2">
          <div className="w-2 h-2 bg-brand-gold rounded-full" />
          <div className="w-2 h-2 bg-gray-200 rounded-full" />
          <div className="w-2 h-2 bg-gray-200 rounded-full" />
        </div>
      </div>

      <div className="fixed bottom-0 inset-x-0 bg-white/80 backdrop-blur-md border-t border-gray-100 py-4 flex items-center justify-center gap-3">
        <div className="w-5 h-5 border-3 border-brand-gold border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-bold text-gray-500">Aguardando confirmação do pagamento...</span>
      </div>

      {showToast && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-6 py-2 rounded-full text-sm font-bold animate-in fade-in slide-in-from-top-4 duration-300 z-[60]">
          Código copiado!
        </div>
      )}
    </div>
  );
}
