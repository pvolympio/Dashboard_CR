# Rede de cooperação científica do IMC (dashboard)

React 18 + TypeScript + Vite · Sigma.js (WebGL) · graphology · Louvain (graphology-communities-louvain) · Zustand · Vitest.

    npm ci && npm run dev      # desenvolvimento
    npm test                   # M2 contra o Python e Louvain contra a referência (Q = 0,585)
    npm run build              # typecheck + build estático em dist/ (GitHub Pages via .github/workflows/ci.yml)

Dados: `public/rede.json` é gerado por `exportar_dados.py` (a partir de `dados/rede/` do repositório da pesquisa) e traz só rótulos
D01–D48 e X00001–X02065, mais as 8 contagens por tipo de cooperação em cada aresta; o M2 é recalculado no navegador (equação 2 do artigo).

Estrutura: `src/lib/rede.ts` (M2, normalização dos pesos, Louvain) · `src/store.ts` (estado) · `src/NetworkView.tsx` (grafo) · `src/App.tsx` (interface).
Fora desta versão: simulador de afastamento (na versão HTML única), troca de visão (completa/docentes/egocêntrica), exportação PNG/CSV, Web Worker.
