/**
 * Catálogo de estilos por oferta (source). Fonte de verdade única, compartilhada
 * entre o frontend (painel BMTH) e a API (notificações Discord).
 *
 * Os IDs 1–4 são REUTILIZADOS entre as ofertas Jesus e Aparecida — o nome de um
 * estilo só pode ser resolvido com o `source` do pedido. Nunca usar os nomes da
 * oferta Jesus para um pedido Aparecida.
 *
 * Paridade com os catálogos das telas:
 *   - Jesus:     src/routes/index.tsx / v2.tsx  (const STYLES)
 *   - Aparecida: src/routes/aparecida.tsx        (const STYLES)
 */

export type OfferSource = "aparecida" | "jesus";

const JESUS_STYLE_LABELS: Record<number, string> = {
  1: "Jesus te abraçando",
  2: "Jesus ao seu lado sorrindo",
  3: "Jesus segurando sua mão",
  4: "Momento no campo com Jesus",
};

const APARECIDA_STYLE_LABELS: Record<number, string> = {
  1: "Nossa Senhora te abraçando",
  2: "Nossa Senhora ao seu lado",
  3: "Nossa Senhora segurando sua mão",
  4: "Um momento de graça com Ela",
};

/**
 * Resolve o nome de UM estilo usando o catálogo da oferta correta.
 * `source` ausente/desconhecido → catálogo Jesus (compatível com pedidos antigos,
 * que eram todos da oferta Jesus quando `source` ainda não existia).
 */
export function styleLabel(
  source: null | string | undefined,
  styleId: number,
): string {
  const catalog =
    source === "aparecida" ? APARECIDA_STYLE_LABELS : JESUS_STYLE_LABELS;
  return catalog[styleId] ?? `Estilo ${styleId}`;
}
