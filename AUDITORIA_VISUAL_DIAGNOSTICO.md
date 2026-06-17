# Auditoria Visual — Diagnóstico Completo

**Data:** 2026-06-16  
**Status:** Regressões visuais identificadas (sem alterações de código ainda)  
**Escopo:** UI/UX apenas — payment flow, recovery, orders, Supabase preservados

---

## REGRESSÕES VISUAIS IDENTIFICADAS

### 1. PhoneModal — Alteração de UX/Messaging
| Propriedade | Antes | Depois | Regressão |
|---|---|---|---|
| **Arquivo** | `src/routes/index.tsx` | Mesmo | ❌ Sim |
| **Componente** | `PhoneModal` | Mesmo | - |
| **Linha** | ~1183 | 1183 | - |
| **Elemento** | Título do header | `ENVIAREMOS NO SEU WHATSAPP` | `VINCULE SEU PEDIDO` |
| **Causa** | Mudança proposital (recovery flow integrado) | Linha 1183 | Perda de contexto original |

**Descrição:** O título do PhoneModal foi alterado de "ENVIAREMOS NO SEU WHATSAPP" para "VINCULE SEU PEDIDO". Isso representa uma mudança de contexto — antes era sobre entrega automática, agora é sobre vinculação de pedido para recovery.

**Linha exata:** 1183  
```tsx
VINCULE SEU PEDIDO  // antes: ENVIAREMOS NO SEU WHATSAPP
```

---

### 2. PhoneModal — Alteração do Texto Explicativo
| Propriedade | Antes | Depois | Regressão |
|---|---|---|---|
| **Arquivo** | `src/routes/index.tsx` | Mesmo | ❌ Sim |
| **Componente** | `PhoneModal` | Mesmo | - |
| **Linhas** | ~1189-1195 | 1189-1195 | - |
| **Texto** | "suas imagens serão enviadas automaticamente após pagamento" | "seu numero sera salvo para facilitar entrega e recuperacao" | Messaging alterada |
| **Causa** | Mudança de propósito (agora foca em recovery, não em delivery) | Linhas 1189-1195 | Perda de urgência + mudança de propósito |

**Descrição:** O texto explicativo do PhoneModal foi reescrito. Antes focava em entrega automática imediata, agora foca em recovery + vinculação.

**Linhas exatas:** 1189-1195  
```tsx
// Antes (implícito):
// "Suas imagens serão enviadas automaticamente para o seu WhatsApp assim que o pagamento for confirmado."
// "A entrega leva apenas alguns minutos. ⚡"

// Depois (explícito):
"Seu numero sera salvo junto do pedido para facilitar a entrega e a recuperacao das imagens depois do pagamento."
"Isso tambem ajuda se voce trocar de aparelho ou voltar mais tarde."
```

---

### 3. PixScreen — Alteração do Nome do Banco (UI)
| Propriedade | Antes | Depois | Regressão |
|---|---|---|---|
| **Arquivo** | `src/routes/index.tsx` | Mesmo | ❌ Questionável |
| **Componente** | `PixScreen` | Mesmo | - |
| **Linha** | ~1535 | 1535 | - |
| **Elemento** | Nome do banco | `Felipe Hans` | `Lucas Gonçalves Agostini` |
| **Causa** | Mudança de dados (banco/pessoa responsável alterada) | Linha 1535 | Nome personalizado vs. nome genérico |

**Descrição:** O nome que aparecerá no extrato bancário foi alterado de "Felipe Hans" para "Lucas Gonçalves Agostini". Isso pode ser correto (dados reais), mas é uma mudança visual significativa.

**Linha exata:** 1535  
```tsx
A cobrança aparecerá no app do seu banco como "Lucas Gonçalves Agostini"
// antes: "Felipe Hans"
```

---

### 4. PixScreen — Alteração da Messaging de Entrega
| Propriedade | Antes | Depois | Regressão |
|---|---|---|---|
| **Arquivo** | `src/routes/index.tsx` | Mesmo | ❌ Sim |
| **Componente** | `PixScreen` (card 📱) | Mesmo | - |
| **Linha** | ~1544 | 1544 | - |
| **Texto** | "suas imagens serão enviadas para WhatsApp em poucos minutos" | "o pedido fica salvo para entrega futura" | Messaging alterada |
| **Causa** | Mudança de propósito (não é mais entrega imediata automática) | Linha 1544 | Perda de urgência + expectativa alterada |

**Descrição:** O texto de expectativa foi alterado. Antes prometia entrega rápida (poucos minutos), agora diz que "o pedido fica salvo para entrega futura".

**Linha exata:** 1544  
```tsx
// Antes (implícito):
// "Após o pagamento, suas imagens serão enviadas automaticamente para o seu WhatsApp."
// "A entrega leva apenas alguns minutos. ⏱️"

// Depois (explícito):
"Depois da aprovacao, o pedido fica salvo para entrega futura e pode ser reenviado sem depender desta aba."
```

---

### 5. PixScreen — Alteração da Messaging de Recovery
| Propriedade | Antes | Depois | Regressão |
|---|---|---|---|
| **Arquivo** | `src/routes/index.tsx` | Mesmo | ❌ Sim |
| **Componente** | `PixScreen` (tela de sucesso) | Mesmo | - |
| **Linha** | ~1435 | 1435 | - |
| **Texto** | Foco em "imagens foram enviadas" | Foco em "pedido foi salvo para processamento" | Messaging alterada |
| **Causa** | Mudança de fluxo (sistema de recovery integrado) | Linha 1435 | Perda de satisfação do usuário |

**Descrição:** Na tela de sucesso, o foco mudou de "suas imagens foram enviadas" para "seu pedido foi salvo com segurança e está pronto para processamento".

**Linha exata:** 1435  
```tsx
// Antes (implícito):
// "Pagamento confirmado! 🎉"
// "Suas imagens serão enviadas para seu WhatsApp"

// Depois (explícito):
"Seu pedido foi salvo com seguranca e esta pronto para seguir para processamento."
```

---

## COMPONENTES SEM REGRESSÕES VISUAIS IDENTIFICADAS

| Componente | Status | Observações |
|---|---|---|
| **ResultsScreen** | ✅ OK | Banner Lar Aconchego presente, grid com bordas dashed, estrutura correta |
| **TestimonialCarousel** | ✅ OK | Lógica de clonagem correta (CLONE=2), controles presentes |
| **UpsellModal** | ✅ OK | Gradiente header (orange→gold), estrutura correta |
| **PixScreen - QR Code** | ✅ OK | Exibe qrBase64 se presente, placeholder genérico se ausente |
| **Espaçamento/Responsividade** | ✅ OK | max-w-[480px], px-5 mantidos, padding correto |

---

## PROBLEMAS NÃO ENCONTRADOS (Relatados como "desaparecidos")

Após auditoria completa do código:

- ❌ **Banner Lar Aconchego desaparecido** — NÃO encontrado. Está presente na ResultsScreen (linha 862-870)
- ❌ **Grid de imagens quebrado** — NÃO encontrado. Grid presente (linha 882-935)
- ❌ **Carousel quebrado** — NÃO encontrado. Lógica preservada (linha 1239+)
- ❌ **Cortes de imagem** — NÃO encontrado. `object-cover` + dimensões corretas
- ❌ **Problemas de width/height** — NÃO encontrado. Tailwind classes corretas

---

## RAIZ DAS REGRESSÕES

**Causa comum:** Integração do novo sistema de recovery + mudança de fluxo de entrega

O código foi refatorado para suportar:
- Recovery de pedidos via código + telefone
- Persistência de ordem via localStorage/Supabase
- Entrega assíncrona (não imediata após pagamento)

**Isso alterou a messaging de:**
- "Entrega rápida automática" → "Pedido salvo para processamento futuro"
- "WhatsApp em poucos minutos" → "Recuperável via código de recovery"
- "Vincule para entrega" → "Vincule para recovery + entrega"

---

## REGRESSÕES VISUAIS RESUMIDAS

| # | Componente | Tipo | Severidade | Linha |
|---|---|---|---|---|
| 1 | PhoneModal | Messaging (título) | 🟡 Média | 1183 |
| 2 | PhoneModal | Messaging (texto) | 🟡 Média | 1189-1195 |
| 3 | PixScreen | Messaging (banco) | 🟡 Média | 1535 |
| 4 | PixScreen | Messaging (entrega) | 🟡 Média | 1544 |
| 5 | PixScreen Success | Messaging (contexto) | 🟡 Média | 1435 |

**Nenhuma regressão CRÍTICA (quebra layout/renderização) encontrada.**  
**Todas são MESSAGING / UX — alterações contextuais do novo fluxo de recovery.**

---

## PRÓXIMOS PASSOS RECOMENDADOS

1. **Definir escopo:** Restaurar messaging original ou aceitar novo fluxo de recovery?
2. **Se restaurar:** Revert apenas strings de mensagem (non-breaking change)
3. **Se aceitar:** Documentar novo fluxo para usuários + marketing
4. **Testar:** Full E2E payment flow com pagamento real (já validado)
5. **Deploy:** Atualize na produção com cautela (messaging muda expectativas)

