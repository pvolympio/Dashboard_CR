# Rede de cooperação científica do IMC/UNIFEI (dashboard)

Dashboard interativo da rede de cooperação científica do Instituto de Matemática e Computação (IMC/UNIFEI), abrangendo docentes de Matemática e Computação e seus colaboradores diretos (2020–2025).

**Stack:** React 18 · TypeScript (estrito) · Vite · Sigma.js 2.4 (WebGL) · graphology · Louvain · Zustand · Vitest · Playwright.

## Scripts

```bash
npm run dev        # servidor de desenvolvimento
npm run lint       # ESLint (typescript-eslint + react-hooks)
npm run format     # formatação com Prettier
npm run typecheck  # verificação de tipos (tsc --noEmit)
npm test           # testes unitários e de componentes (Vitest)
npm run test:e2e   # teste ponta a ponta + acessibilidade (Playwright + axe-core)
npm run build      # typecheck + build estático em dist/
```

## Como regenerar os dados

1. **`public/rede.json`**: gerado a partir de `dados/rede/nos.csv` e `dados/rede/arestas.csv` do repositório da pesquisa usando:
   ```bash
   python exportar_dados.py
   ```
   O script calcula o layout `spring_layout`, preserva apenas os rótulos pseudonimizados (`D01`–`D48` e `X00001`–`X02065`), as métricas `M1`, `M2` e `M3`, e as 8 contagens por tipo de cooperação. Há uma asserção explícita para impedir vazamento de identificadores numéricos longos (id Lattes).
2. **`public/referencia_aleatoria.json`**: gerado a partir das 1.000 simulações aleatórias em `resultados/at4/curvas.npz` (`arr_SD`, `arr_cob`), armazenando os percentis 2,5, 50 e 97,5 para os 49 pontos (`k = 0..48`).

## Privacidade, LGPD e limites de interpretação

- **Base legal (LGPD, art. 7º, IV):** o tratamento de dados origina-se de pesquisa científica conduzida por órgão de pesquisa/instituição de ensino superior a partir de registros públicos (Plataforma Lattes e bases institucionais), observando a minimização e a pseudonimização.
- **Pseudonimização:** nenhum nome, CPF ou id Lattes é incluído no bundle ou nos arquivos públicos (`public/rede.json`, CSVs exportados ou hash de URL). Todos os nós são identificados exclusivamente por códigos (`D01`–`D48` para docentes e `X00001`–`X02065` para colaboradores externos).
- **Limites de interpretação:** _Evidência relacional; não mede mérito nem desempenho._ A estrutura da rede reflete vínculos registrados de coautoria, orientação, bancas e projetos no recorte 2020–2025, não devendo ser utilizada como ranking individual ou métrica de avaliação docente.

### Expansão para outros institutos

- O esquema suporta configuração por instituto em `public/config/<sigla>.json` (ex.: `public/config/imc.json`) e exportação parametrizada via:
  ```bash
  python exportar_dados.py --instituto IMC --entrada dados/rede --saida public/rede.json
  ```
- **Revisão obrigatória de privacidade (LGPD) antes de publicar novos institutos:** antes de disponibilizar a rede de qualquer outro instituto, verificar (1) que todos os rótulos são códigos pseudonimizados sem vínculo com nomes ou ids Lattes na saída pública, (2) que institutos ou subgrupos com número muito reduzido de docentes não permitem reidentificação indireta por combinação de área/categoria/grau, e (3) que o tratamento segue enquadrado na base legal de pesquisa científica (LGPD, art. 7º, IV) com aprovação/ciência institucional pertinente.

## Publicação no GitHub Pages

O repositório inclui o workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml), que executa `npm ci`, `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` em cada push/PR, e publica automaticamente o diretório `dist/` no GitHub Pages quando há push na branch `main`.

Para ativar no GitHub:

1. Acesse **Settings → Pages** do repositório.
2. Em **Build and deployment → Source**, selecione **GitHub Actions**.
3. Faça push para `main` e aguarde o job `deploy` concluir.
