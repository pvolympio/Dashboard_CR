import Graph from 'graphology'
import louvain from 'graphology-communities-louvain'

export interface Rede { camadas: string[]; categorias: string[]; tipos: string[]; nos: [string, number, number, number, number][]; arestas: number[][] }
export type Pesos = { P: number; F: number; J: number }
export const PESOS_PADRAO: Pesos = { P: 0.5, F: 0.3, J: 0.2 }
/** índices dos 8 tipos (colunas 5..12 de cada aresta) por grupo: publicação, formação, projeto */
const GRUPOS: [keyof Pesos, number[]][] = [['P', [0, 1, 2]], ['F', [3, 4, 5]], ['J', [6, 7]]]

export const ehDocente = (r: Rede, i: number) => r.camadas[r.nos[i][1]] !== 'Externo'

/** Muda um peso e redistribui o restante, mantendo a soma em 1. */
export function normaliza(p: Pesos, chave: keyof Pesos, valor: number): Pesos {
  const outras = (Object.keys(p) as (keyof Pesos)[]).filter(k => k !== chave)
  const soma = outras.reduce((s, k) => s + p[k], 0), resto = 1 - valor
  const novo = { ...p, [chave]: valor }
  outras.forEach(k => { novo[k] = soma === 0 ? resto / outras.length : (p[k] / soma) * resto })
  return novo
}

/** Intensidade M2 (equação 2 do artigo) para cada aresta, dado o peso de cada grupo. */
export function calculaM2(r: Rede, p: Pesos): Float64Array {
  const T = r.tipos.length, N = r.nos.length, E = r.arestas.length
  const tot = new Float64Array(N * T)
  for (let k = 0; k < E; k++) {
    const a = r.arestas[k], u = a[0] * T, v = a[1] * T
    for (let t = 0; t < T; t++) {
      const val = a[5 + t]
      tot[u + t] += val
      tot[v + t] += val
    }
  }
  const tipoPeso = new Float64Array(T)
  for (const [g, ts] of GRUPOS) {
    const w = p[g] / ts.length
    for (const t of ts) tipoPeso[t] = w
  }
  const out = new Float64Array(E)
  for (let k = 0; k < E; k++) {
    const a = r.arestas[k], u = a[0] * T, v = a[1] * T
    let w = 0
    for (let t = 0; t < T; t++) {
      const d = tot[u + t] + tot[v + t]
      if (d > 0) w += tipoPeso[t] * (2 * a[5 + t]) / d
    }
    out[k] = w
  }
  return out
}

const mulberry32 = (s: number) => () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }

export interface Comunidades { particao: Map<number, number>; Q: number; tamanhos: number[] }
export interface SubgrafoDocentes { nos: string[]; arestas: [string, string, number][] }

/** Pré-filtra nós e arestas entre docentes para evitar varrer colaboradores externos a cada execução. */
export function preparaSubgrafoDocentes(r: Rede): SubgrafoDocentes {
  const nos: string[] = []
  const doc = new Uint8Array(r.nos.length)
  for (let i = 0; i < r.nos.length; i++) {
    if (ehDocente(r, i)) { doc[i] = 1; nos.push(String(i)) }
  }
  const arestas: [string, string, number][] = []
  for (let k = 0; k < r.arestas.length; k++) {
    const a = r.arestas[k]
    if (doc[a[0]] && doc[a[1]]) arestas.push([String(a[0]), String(a[1]), k])
  }
  return { nos, arestas }
}

/** Executa Louvain sobre o subgrafo pré-filtrado de docentes. */
export function comunidadesSubgrafo(sub: SubgrafoDocentes, w: ArrayLike<number>, resolucao = 1, execucoes = 20): Comunidades {
  const g = new Graph({ type: 'undirected' })
  for (let i = 0; i < sub.nos.length; i++) g.addNode(sub.nos[i])
  for (let i = 0; i < sub.arestas.length; i++) {
    const [u, v, k] = sub.arestas[i]
    if (w[k] > 0) g.addEdge(u, v, { weight: w[k] })
  }
  let melhor: { c: Record<string, number>; Q: number } | null = null
  for (let s = 0; s < execucoes; s++) {
    const d = louvain.detailed(g, { getEdgeWeight: 'weight', resolution: resolucao, rng: mulberry32(s) })
    if (!melhor || d.modularity > melhor.Q) melhor = { c: d.communities, Q: d.modularity }
  }
  const part = new Map<number, number>(Object.entries(melhor!.c).map(([k, v]) => [+k, v]))
  const cont = new Map<number, number>(); part.forEach(c => cont.set(c, (cont.get(c) ?? 0) + 1))
  const ordem = [...cont.entries()].sort((a, b) => b[1] - a[1]); const remap = new Map(ordem.map(([c], i) => [c, i]))
  return { particao: new Map([...part].map(([k, c]) => [k, remap.get(c)!])), Q: melhor!.Q, tamanhos: ordem.map(([, n]) => n) }
}

/** Louvain na rede entre docentes ponderada por w; melhor modularidade em `execucoes` sementes (20 no artigo). */
export function comunidades(r: Rede, w: ArrayLike<number>, resolucao = 1, execucoes = 20): Comunidades {
  return comunidadesSubgrafo(preparaSubgrafoDocentes(r), w, resolucao, execucoes)
}
