import { ehDocente, type Rede } from './rede'

export type Cenario = 'grau' | 'exclusivos' | 'intermediacao'

export interface MetricasSimulacao {
  k: number
  docente: string | null
  sd: number
  alcance: number
  vinculos: number
  peso: number
}

export interface CurvaFaixa {
  p025: number[]
  p50: number[]
  p975: number[]
}

export interface ReferenciaAleatoria {
  k: number[]
  sd: CurvaFaixa
  alcance: CurvaFaixa
}

export const LIMIAR_SD = 0.427
export const LIMIAR_ALCANCE = 0.5

/** Calcula S_D, alcance externo, vínculos entre áreas e peso retido na rede completa (sem filtros visuais). */
export function calculaMetricas(
  r: Rede,
  w: ArrayLike<number>,
  afastados: ReadonlySet<number>,
  docente: string | null = null,
): MetricasSimulacao {
  const N = r.nos.length,
    E = r.arestas.length
  const isDoc = new Uint8Array(N)
  const isMat = new Uint8Array(N)
  const isComp = new Uint8Array(N)
  let totalDoc = 0,
    totalExt = 0

  for (let i = 0; i < N; i++) {
    const cam = r.camadas[r.nos[i][1]]
    if (cam === 'Externo') {
      totalExt++
    } else {
      isDoc[i] = 1
      totalDoc++
      if (cam === 'Matemática') isMat[i] = 1
      else if (cam === 'Computação') isComp[i] = 1
    }
  }

  const adjDoc: number[][] = Array.from({ length: N }, () => [])
  const extAtivo = new Uint8Array(N)
  let vinculos = 0,
    pesoSob = 0,
    pesoTot = 0

  for (let k = 0; k < E; k++) {
    const a = r.arestas[k],
      u = a[0],
      v = a[1],
      wk = w[k]
    pesoTot += wk
    if (afastados.has(u) || afastados.has(v)) continue
    pesoSob += wk

    if (isDoc[u] && isDoc[v]) {
      adjDoc[u].push(v)
      adjDoc[v].push(u)
      if ((isMat[u] && isComp[v]) || (isComp[u] && isMat[v])) vinculos++
    } else if (isDoc[u] && !isDoc[v]) {
      extAtivo[v] = 1
    } else if (!isDoc[u] && isDoc[v]) {
      extAtivo[u] = 1
    }
  }

  let extSob = 0
  for (let i = 0; i < N; i++) if (!isDoc[i] && extAtivo[i]) extSob++

  // Maior componente conexa entre docentes sobreviventes
  const vis = new Uint8Array(N)
  let maiorComp = 0
  const fila: number[] = []
  for (let i = 0; i < N; i++) {
    if (!isDoc[i] || afastados.has(i) || vis[i]) continue
    vis[i] = 1
    fila.length = 0
    fila.push(i)
    let head = 0
    while (head < fila.length) {
      const u = fila[head++]
      const viz = adjDoc[u]
      for (let j = 0; j < viz.length; j++) {
        const v = viz[j]
        if (!vis[v]) {
          vis[v] = 1
          fila.push(v)
        }
      }
    }
    if (fila.length > maiorComp) maiorComp = fila.length
  }

  return {
    k: afastados.size,
    docente,
    sd: totalDoc > 0 ? maiorComp / totalDoc : 0,
    alcance: totalExt > 0 ? extSob / totalExt : 0,
    vinculos,
    peso: pesoTot > 0 ? pesoSob / pesoTot : 1,
  }
}

/** Centralidade de intermediação (Brandes) não ponderada no grafo não direcionado especificado. */
function brandesBetweenness(nos: number[], adj: Map<number, number[]>): Map<number, number> {
  const cb = new Map<number, number>()
  for (const v of nos) cb.set(v, 0)

  const S: number[] = []
  const P = new Map<number, number[]>()
  const sigma = new Map<number, number>()
  const dist = new Map<number, number>()
  const delta = new Map<number, number>()
  const Q: number[] = []

  for (const s of nos) {
    S.length = 0
    for (const w of nos) {
      P.set(w, [])
      sigma.set(w, 0)
      dist.set(w, -1)
      delta.set(w, 0)
    }
    sigma.set(s, 1)
    dist.set(s, 0)
    Q.length = 0
    Q.push(s)
    let head = 0

    while (head < Q.length) {
      const v = Q[head++]
      S.push(v)
      const dv = dist.get(v)!
      const sv = sigma.get(v)!
      const viz = adj.get(v) ?? []
      for (let i = 0; i < viz.length; i++) {
        const w = viz[i]
        const dw = dist.get(w)!
        if (dw < 0) {
          Q.push(w)
          dist.set(w, dv + 1)
        }
        if (dist.get(w) === dv + 1) {
          sigma.set(w, sigma.get(w)! + sv)
          P.get(w)!.push(v)
        }
      }
    }

    while (S.length > 0) {
      const w = S.pop()!
      const sw = sigma.get(w)!
      const dw = delta.get(w)!
      const pw = P.get(w)!
      for (let i = 0; i < pw.length; i++) {
        const v = pw[i]
        delta.set(v, delta.get(v)! + (sigma.get(v)! / sw) * (1 + dw))
      }
      if (w !== s) cb.set(w, cb.get(w)! + dw)
    }
  }

  for (const v of nos) cb.set(v, cb.get(v)! / 2)
  return cb
}

/** Escolhe o próximo docente a afastar segundo o critério do cenário e desempate idêntico ao Python. */
export function proximoAfastamento(r: Rede, afastados: ReadonlySet<number>, cenario: Cenario): number | null {
  const N = r.nos.length,
    E = r.arestas.length
  const docentes: number[] = []
  const isDoc = new Uint8Array(N)
  for (let i = 0; i < N; i++) {
    if (ehDocente(r, i)) {
      isDoc[i] = 1
      if (!afastados.has(i)) docentes.push(i)
    }
  }
  if (docentes.length === 0) return null

  const grauDD = new Int32Array(N)
  const grauExt = new Int32Array(N)
  const extVizDoc: number[][] = Array.from({ length: N }, () => [])
  const ddEdges: [number, number][] = []

  for (let k = 0; k < E; k++) {
    const a = r.arestas[k],
      u = a[0],
      v = a[1]
    if (afastados.has(u) || afastados.has(v)) continue
    if (isDoc[u] && isDoc[v]) {
      grauDD[u]++
      grauDD[v]++
      ddEdges.push([u, v])
    } else if (isDoc[u] && !isDoc[v]) {
      grauExt[u]++
      extVizDoc[v].push(u)
    } else if (!isDoc[u] && isDoc[v]) {
      grauExt[v]++
      extVizDoc[u].push(v)
    }
  }

  const score = new Float64Array(N)
  if (cenario === 'grau') {
    for (const d of docentes) score[d] = grauDD[d]
  } else if (cenario === 'exclusivos') {
    for (let i = 0; i < N; i++) {
      if (!isDoc[i] && extVizDoc[i].length === 1) score[extVizDoc[i][0]]++
    }
  } else {
    const nos: number[] = [...docentes]
    const adj = new Map<number, number[]>()
    for (const d of docentes) adj.set(d, [])
    for (const [u, v] of ddEdges) {
      adj.get(u)!.push(v)
      adj.get(v)!.push(u)
    }
    for (let i = 0; i < N; i++) {
      if (!isDoc[i] && extVizDoc[i].length >= 2) {
        nos.push(i)
        const docs = extVizDoc[i]
        adj.set(i, [...docs])
        for (const d of docs) adj.get(d)!.push(i)
      }
    }
    const cb = brandesBetweenness(nos, adj)
    for (const d of docentes) score[d] = cb.get(d) ?? 0
  }

  let melhor = docentes[0]
  for (let idx = 1; idx < docentes.length; idx++) {
    const d = docentes[idx]
    const diff = score[d] - score[melhor]
    if (diff > 1e-12) {
      melhor = d
    } else if (Math.abs(diff) <= 1e-12) {
      const desD = grauDD[d] + grauExt[d]
      const desM = grauDD[melhor] + grauExt[melhor]
      if (desD > desM || (desD === desM && d < melhor)) melhor = d
    }
  }
  return melhor
}

/** Calcula a série de métricas passo a passo para uma sequência de afastamentos. */
export function serieSimulacao(r: Rede, w: ArrayLike<number>, seq: readonly number[]): MetricasSimulacao[] {
  const af = new Set<number>()
  const out: MetricasSimulacao[] = [calculaMetricas(r, w, af, null)]
  for (let i = 0; i < seq.length; i++) {
    const idx = seq[i]
    af.add(idx)
    out.push(calculaMetricas(r, w, af, r.nos[idx][0]))
  }
  return out
}

/** Gera a sequência completa de afastamentos para um cenário (usado em testes e exportação). */
export function geraSequenciaCenario(
  r: Rede,
  cenario: Cenario,
  iniciais: readonly number[] = [],
  passos?: number,
): number[] {
  const af = new Set<number>(iniciais)
  const seq: number[] = [...iniciais]
  const limite = passos ?? Number.POSITIVE_INFINITY
  while (seq.length - iniciais.length < limite) {
    const prox = proximoAfastamento(r, af, cenario)
    if (prox === null) break
    af.add(prox)
    seq.push(prox)
  }
  return seq
}

/** Exporta a série da simulação em formato CSV. */
export function exportaSimulacaoCSV(serie: readonly MetricasSimulacao[]): string {
  const linhas = ['passo,docente,S_D,alcance,vinculos,peso']
  for (const m of serie) {
    linhas.push(
      `${m.k},${m.docente ?? ''},${m.sd.toFixed(4)},${m.alcance.toFixed(4)},${m.vinculos},${m.peso.toFixed(4)}`,
    )
  }
  return linhas.join('\n')
}
