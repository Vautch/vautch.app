# Roadmap

Plano de trabalho do Vautch — bugs confirmados, dívida técnica e features por fase.
Atualizar a cada sessão de desenvolvimento. Itens concluídos vão para o [CHANGELOG](CHANGELOG.md).

> **Como ler:** cada item tem um código (`B` bug · `P` performance · `U` UX · `S` segurança · `E` email · `F` feature · `A` AI).
> Status: ✅ feito · 🔄 em andamento · ⬜ pendente. A ordem dentro de cada bloco é a prioridade sugerida.
>
> **Sessão 2026-06-25:** Fase 1 inteira + Fase 2 (P2) + Fase 3 (F1/F2/F3) entregues e verificadas
> localmente (harness estático + testes de lógica). Aguardando review do Paulo p/ deploy.

---

## Fase 1 — Estabilização ✅ (concluída em 2026-06-25)

| Status | # | Tipo | Descrição |
|--------|---|------|-----------|
| ✅ | B5 | Bug | **"Guardado agora mesmo" em todos os itens.** Resolvido: `created_at` real exposto no `GET /api/items`; `createdAt` gravado em cada save; `relativeTime()` exibe "agora/há X min/há X h/ontem/há X dias/data absoluta". Fallback pro epoch do id em itens legados. |
| ✅ | B1 | Bug | **Ordem dos cards embaralhada** após sync. Resolvido: ordenação canônica estável (época desc + desempate por id) em `currentItems()` — itens importados com `created_at` igual desempatam por id e recuperam a cronologia. Religado o `vault.order` (drag-reorder) que era código morto. Tie-break por id também no servidor. |
| ✅ | B2 | Bug | **Expand/collapse scrolla pro topo.** Resolvido: `toggleExpand()` salva `scrollY` e restaura com `scroll-behavior:auto` após o reflow grid→block; `overflow-anchor:none` no card em animação. Verificado: drift = 0. |
| ✅ | B6 | Bug | **Links com UTM/boost quebram embed.** Resolvido: `stripTracking` virou híbrido — allowlist por plataforma (remove todo param de boost: mibextid/rdid/eav…) preservando funcionais (YT `v/t`, FB `watch?v`, IG `img_index`); denylist em hosts genéricos (preserva `?id=` de links comuns). Fallback de mensagem quando o embed social falha. |
| ✅ | P1 | Perf | **Skeleton loading.** Resolvido: `renderSkeletons()` mostra placeholders com shimmer antes do `loadFromServer`; somem sozinhos quando o feed monta. |
| ✅ | B3 | Bug | **Ellipsis quebrado no modo compacto.** Resolvido: `title=` com o conteúdo completo (tooltip), instrução movida pra `aria-label`; edição do título no compacto agora destrava o truncamento (`.is-editing`). |
| ✅ | U1 | UX  | **Botão × de limpar (mobile).** Resolvido: × no campo principal (reusa `is-typing`) + utilitária `attachClear()` aplicada ao editor de nota. Aparece com conteúdo, limpa e dispara `input`. |

---

## Fase 2 — Escalabilidade

| Status | # | Tipo | Descrição |
|--------|---|------|-----------|
| ✅ | P2 | Perf | **Paginação / infinite scroll (10 + 10).** Resolvido: `buildFeed` renderiza 10 cards e carrega +10 via `IntersectionObserver` (sentinel). Filtro/busca renderizam tudo antes de filtrar; drag-reorder também. Verificado: 10→14 ao rolar. |
| ⬜ | IMG | Perf | **Imagens base64 → Supabase Storage.** Prints/uploads viram base64 dentro do `data` jsonb → linhas gigantes, GET pesado. **Plano (próximo passo focado):** `POST /api/media` sobe o blob pro bucket `media` (já existe, privado, RLS por `{user_id}/`), guarda só o path; GET assina URL (`createSignedUrl`) em `item.imageUrl`; render prefere `imageUrl`, cai no base64 legado; fallback offline + migração oportunista dos legados. **Por que não nesta sessão:** muda o save de offline→rede e exige verificação logada (não dá pra testar no local por causa do trava-TLS do proxy). P1+P2 já entregam o "levinho" no render; este é o ganho de rede. |
| ⬜ | E1 | Email | **SMTP customizado (Resend).** Resolve o `Email rate limit exceeded` do Supabase free. Resend free: 3k emails/mês. Depende do Paulo criar a conta Resend. |
| ⬜ | B4 | Bug | **Safari: vídeo Instagram/Facebook não toca.** Safari bloqueia autoplay e alguns embeds. Investigar política de autoplay + ITP. |

---

## Fase 3 — Features

| Status | # | Tipo | Descrição |
|--------|---|------|-----------|
| ✅ | F1 | Feature | **Morning Reminder.** Resolvido: bloco "bem-vindo de volta" acima do feed com os itens guardados desde a última visita (usa `vault.lastSeen` + `createdAt` real). Some quando há filtro/busca. |
| ✅ | F2 | Feature | **Remember Carousel.** Bloco "relembre" com 5 itens aleatórios. **Sob demanda via botão** na filterbar (antes do compacto). **Drag-to-scroll** (mouse no desktop, dedo no mobile), **sem scrollbar** (resolvido o scroll feio no dark). Clicar num card **maximiza NO APP** (overlay read-only), não vai pro link externo. |
| ✅ | F3 | Feature | **Priority Cards (completo).** Mecanismo (★, persistência jsonb, topo do feed, anel) + **efeito React Three Fiber entregue** na rodada 2026-06-26 (ADR 0006). Spec original abaixo: <br>• **Arquitetura: opção A — 1 canvas WebGL compartilhado** (React + `@react-three/fiber`, instancing), sobreposto ao feed. NÃO um canvas por card (estoura ~16 contextos). <br>• **Efeito:** partículas/pontos acendendo e apagando aleatoriamente em **fluxo de onda**, DENTRO da zona do **degradê do topo que some no centro** do card (a área do degradê = a área do efeito). Sutil. Ref.: gastodiario.com.br/app. <br>• **Performance: só renderiza nos cards favoritos DENTRO do viewport** (IntersectionObserver) — favorito fora da tela = efeito desligado. Vale mobile e desktop. <br>• **Posicionamento:** sincroniza `getBoundingClientRect()` de cada favorito visível por frame (técnica de overlay tipo Lusion/Locomotive). <br>• Build dedicado (camada React sobre o feed vanilla) — sessão própria, provavelmente com Opus. |
| ⬜ | U2 | UX | **Sugestão da área de transferência (clipboard).** Quando o usuário copia algo (Ctrl+C / copiar no celular), o app oferece "colar o que está na sua área de transferência" — um chip/toast discreto na barra de intake, padrão dos teclados iOS/Android. **Nota técnica:** a web não tem evento de "copiou em outro lugar"; o caminho viável é ler `navigator.clipboard.readText()` ao focar a aba/janela (exige permissão + HTTPS) e, se o conteúdo parecer um link, mostrar o chip "colar?". Em PWA instalado funciona melhor. |
| ⬜ | F5 | Feature | **WhatsApp Bot.** Webhook + link `phone_number → user_id`. |

---

## Fase 4 — AI

| Status | # | Tipo | Descrição |
|--------|---|------|-----------|
| ⬜ | A1 | AI | **AI client-side (Transformers.js).** Modelo leve na GPU do device, sem servidor: limpeza de metadados, sumarização básica, enriquecimento de tags. |
| ⬜ | A2 | AI | **Busca semântica por linguagem natural com API do usuário.** Queries como "vídeo do gordinho ruivo com a receita". Usuário conecta a própria API key (Anthropic/Gemini/OpenAI-compatible — já há scaffold `vault.apikey`). Multimodal. Resultado: cards relevantes sobem no feed. |
| ⬜ | A3 | AI | **Resumo automático em nota.** A AI gera resumo de um item e cria um card de nota. Usa a API key do usuário. |

> **Nota A2:** o vault do usuário como contexto de AI é o diferencial do Vautch — "procure nas coisas que você mesmo salvou". A AI não busca na web, busca no que é seu. Privacidade + utilidade ao mesmo tempo.

---

## Backlog de Segurança (não urgente)

| Status | # | Tipo | Descrição |
|--------|---|------|-----------|
| ⬜ | S1 | Seg | **2FA (TOTP).** Supabase tem suporte nativo (Google Authenticator / Authy). Config + UI de setup. |
| ⬜ | S2 | Seg | **Reconhecimento de device novo.** Fingerprint + e-mail de alerta ao login em device desconhecido. Tabela `trusted_devices` + webhook. |

---

## Rodada 2026-06-26 ✅ (concluída — pendente de review/deploy)

| Status | # | Tipo | Descrição |
|--------|---|------|-----------|
| ✅ | F1b | UX | **"Bem-vindo de volta" como pílula de notificação.** Resolvido: pílula terracota (texto + **"visualizar"** + **×**) substitui o bloco-carrossel; "visualizar" liga o período de filtro **"última visita"** (corte absoluto em `_lastSeenAtLoad`); × descarta na sessão. |
| ✅ | F2b | UX | **Relembre paginado.** Resolvido: pool com teto 20, renderiza 5 e revela +5 ao arrastar/rolar até o fim (`appendRememberPage` + scroll no track). |
| ✅ | F2c | UX | **Relembre navegável no maximizado.** Resolvido: `openCardMax` virou **deck** — slide ativo centralizado, vizinhos espiando esmaecidos; **arraste em qualquer lugar + setas ←/→ + roda do mouse** (desktop), teclado, sem scroll lateral; sempre cheio mesmo com timeline compacta. Lista = cards revelados. |
| ✅ | F2d | Feature | **Relembre = "esquecidos" de verdade.** Resolvido: store device-local `vault.seen` (`opens`/`lastSeen`), `markSeen` em maximizar/navegar, expandir e **dwell >1min** (IO). `rememberCandidates` ordena por menos visto / mais antigo. |
| ⬜ | B7 | Bug | **Instagram embed bloqueado — EM ABERTO.** Tentativa de facade (pôster + "ver aqui") foi **revertida**: aplicava em todos os posts IG (fricção) e não há como detectar cross-origin se o embed quebrou. Precisa de um sinal real de falha antes de degradar. Embed IG direto restaurado. |
| ✅ | F3 | Feature | **Efeito React Three Fiber.** Resolvido: camada React (`favorite-particles.tsx`), 1 canvas WebGL compartilhado (instancing), **campo denso de pontos terracota nítidos (sem glow)** em onda na zona do degradê dos favoritos, confinados ao card, só no viewport (IO), canvas só monta com favorito, rect sync por frame, `pointer-events:none` (não bloqueia a UI), respeita `prefers-reduced-motion`. |
| ✅ | FILT | UX | **Período "última visita" nos filtros.** Resolvido (concreto): entrou no dropdown de período quando há visita anterior. Reorg visual ampla da filterbar = dívida leve. |

Ver [ADR 0006](docs/decisions/0006-rodada-relembre-facade-r3f.md) e [CHANGELOG](CHANGELOG.md).

## Histórico de fases concluídas

- **Rodada 2026-06-26** (acima): F1b, F2b, F2c, F2d, B7, F3, FILT. Ver [ADR 0006](docs/decisions/0006-rodada-relembre-facade-r3f.md).
- **Fase 1/2/3** (2026-06-25): B1, B2, B3, B5, B6, P1, P2, U1 + F1, F2, F3 (mecanismo). Ver [CHANGELOG](CHANGELOG.md) e [ADR 0005](docs/decisions/0005-fase1-estabilizacao-perf.md).
- **Fase 0** (2026-06-24): scaffold Next.js, Supabase auth (email + Google OAuth), RLS, feed conectado, XSS corrigido, cookie httpOnly. Ver [ADR 0004](docs/decisions/0004-auth-schema-fase0.md).
