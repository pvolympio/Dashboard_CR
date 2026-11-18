import Graph from 'graphology'
import louvain from 'graphology-communities-louvain'

export interface ConfigInstituto {
  instituto: string
  nomeCompleto: string
  camadasDocentes: string[]
  coresCamadas: Record<string, string>
}

export const CONFIG_PADRAO: ConfigInstituto = {
  instituto: 'IMC',
  nomeCompleto: 'UNIFEI · Instituto de Matemática e Computação',
  camadasDocentes: ['Matemática', 'Computação'],
  coresCamadas: { Matemática: '#3ea3af', Computação: '#ff1d44', Externo: '#9fb4b1' },
}

export interface Rede {
  instituto?: string
  institutos?: string[]
  camadas: string[]
  categorias: string[]
  tipos: string[]
  nos: ([string, number, number, number, number] | [string, number, number, number, number, number])[]
  arestas: number[][]
}
export type Pesos = { P: number; F: number; J: number }
export type ModeloPeso = 'M1' | 'M2' | 'M3'
export type ModoCor = 'comunidade' | 'area' | 'categoria'
export type ModoTamanho = 'grau' | 'forca' | 'fixo'
export type Visao = 'completa' | 'docentes' | 'ego' | 'instituto'
export interface Filtros {
  mat: boolean
  comp: boolean
  ext: boolean
  percentil: number
}

export const PESOS_PADRAO: Pesos = { P: 0.5, F: 0.3, J: 0.2 }
/** índices dos 8 tipos (colunas 5..12 de cada aresta) por grupo: publicação, formação, projeto */
const GRUPOS: [keyof Pesos, number[]][] = [
  ['P', [0, 1, 2]],
  ['F', [3, 4, 5]],
  ['J', [6, 7]],
]

export const ehDocente = (r: Rede, i: number) => r.camadas[r.nos[i][1]] !== 'Externo'

/** Muda um peso e redistribui o restante, mantendo a soma em 1. */
export function normaliza(p: Pesos, chave: keyof Pesos, valor: number): Pesos {
  const outras = (Object.keys(p) as (keyof Pesos)[]).filter((k) => k !== chave)
  const soma = outras.reduce((s, k) => s + p[k], 0),
    resto = 1 - valor
  const novo = { ...p, [chave]: valor }
  outras.forEach((k) => {
    novo[k] = soma === 0 ? resto / outras.length : (p[k] / soma) * resto
  })
  return novo
}

/** Intensidade M2 (equação 2 do artigo) para cada aresta, dado o peso de cada grupo. */
export function calculaM2(r: Rede, p: Pesos): Float64Array {
  const T = r.tipos.length,
    N = r.nos.length,
    E = r.arestas.length
  const tot = new Float64Array(N * T)
  for (let k = 0; k < E; k++) {
    const a = r.arestas[k],
      u = a[0] * T,
      v = a[1] * T
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
    const a = r.arestas[k],
      u = a[0] * T,
      v = a[1] * T
    let w = 0
    for (let t = 0; t < T; t++) {
      const d = tot[u + t] + tot[v + t]
      if (d > 0) w += (tipoPeso[t] * (2 * a[5 + t])) / d
    }
    out[k] = w
  }
  return out
}

const mulberry32 = (s: number) => () => {
  s |= 0
  s = (s + 0x6d2b79f5) | 0
  let t = Math.imul(s ^ (s >>> 15), 1 | s)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export interface Comunidades {
  particao: Map<number, number>
  Q: number
  tamanhos: number[]
  nmi: number
}
export interface SubgrafoDocentes {
  nos: string[]
  arestas: [string, string, number][]
}

/** Informação Mútua Normalizada (NMI) entre duas partições sobre o mesmo conjunto de chaves. */
export function calculaNMI(a: Record<string, number>, b: Record<string, number>): number {
  const chaves = Object.keys(a)
  const N = chaves.length
  if (N === 0) return 1
  const contA = new Map<number, number>()
  const contB = new Map<number, number>()
  const par = new Map<string, number>()
  for (let i = 0; i < N; i++) {
    const k = chaves[i],
      ca = a[k],
      cb = b[k]
    contA.set(ca, (contA.get(ca) ?? 0) + 1)
    contB.set(cb, (contB.get(cb) ?? 0) + 1)
    const pk = `${ca}:${cb}`
    par.set(pk, (par.get(pk) ?? 0) + 1)
  }
  let ha = 0,
    hb = 0,
    mi = 0
  contA.forEach((c) => {
    const p = c / N
    ha -= p * Math.log(p)
  })
  contB.forEach((c) => {
    const p = c / N
    hb -= p * Math.log(p)
  })
  if (ha + hb === 0) return 1
  par.forEach((nij, pk) => {
    const [ca, cb] = pk.split(':').map(Number)
    const na = contA.get(ca)!,
      nb = contB.get(cb)!
    mi += (nij / N) * Math.log((N * nij) / (na * nb))
  })
  return (2 * mi) / (ha + hb)
}

/** Pré-filtra nós e arestas entre docentes para evitar varrer colaboradores externos a cada execução. */
export function preparaSubgrafoDocentes(r: Rede): SubgrafoDocentes {
  const nos: string[] = []
  const doc = new Uint8Array(r.nos.length)
  for (let i = 0; i < r.nos.length; i++) {
    if (ehDocente(r, i)) {
      doc[i] = 1
      nos.push(String(i))
    }
  }
  const arestas: [string, string, number][] = []
  for (let k = 0; k < r.arestas.length; k++) {
    const a = r.arestas[k]
    if (doc[a[0]] && doc[a[1]]) arestas.push([String(a[0]), String(a[1]), k])
  }
  return { nos, arestas }
}

/** Executa Louvain sobre o subgrafo pré-filtrado de docentes. */
export function comunidadesSubgrafo(
  sub: SubgrafoDocentes,
  w: ArrayLike<number>,
  resolucao = 1,
  execucoes = 20,
): Comunidades {
  const g = new Graph({ type: 'undirected' })
  for (let i = 0; i < sub.nos.length; i++) g.addNode(sub.nos[i])
  for (let i = 0; i < sub.arestas.length; i++) {
    const [u, v, k] = sub.arestas[i]
    if (w[k] > 0) g.addEdge(u, v, { weight: w[k] })
  }
  let melhor: { c: Record<string, number>; Q: number } | null = null
  const execs: Record<string, number>[] = []
  for (let s = 0; s < execucoes; s++) {
    const d = louvain.detailed(g, { getEdgeWeight: 'weight', resolution: resolucao, rng: mulberry32(s) })
    execs.push(d.communities)
    if (!melhor || d.modularity > melhor.Q) melhor = { c: d.communities, Q: d.modularity }
  }
  let nmi = 1
  if (execs.length > 1) {
    let soma = 0,
      pares = 0
    for (let i = 0; i < execs.length; i++) {
      for (let j = i + 1; j < execs.length; j++) {
        soma += calculaNMI(execs[i], execs[j])
        pares++
      }
    }
    nmi = pares > 0 ? soma / pares : 1
  }
  const part = new Map<number, number>(Object.entries(melhor!.c).map(([k, v]) => [+k, v]))
  const cont = new Map<number, number>()
  part.forEach((c) => cont.set(c, (cont.get(c) ?? 0) + 1))
  const ordem = [...cont.entries()].sort((a, b) => b[1] - a[1])
  const remap = new Map(ordem.map(([c], i) => [c, i]))
  return {
    particao: new Map([...part].map(([k, c]) => [k, remap.get(c)!])),
    Q: melhor!.Q,
    tamanhos: ordem.map(([, n]) => n),
    nmi,
  }
}

/** Louvain na rede entre docentes ponderada por w; melhor modularidade em `execucoes` sementes (20 no artigo). */
export function comunidades(r: Rede, w: ArrayLike<number>, resolucao = 1, execucoes = 20): Comunidades {
  return comunidadesSubgrafo(preparaSubgrafoDocentes(r), w, resolucao, execucoes)
}

/** Calcula o vetor de pesos das arestas conforme o modelo selecionado (M1, M2 ou M3). */
export function calculaPesos(r: Rede, modelo: ModeloPeso, p: Pesos): Float64Array {
  if (modelo === 'M2') return calculaM2(r, p)
  const col = modelo === 'M1' ? 2 : 4
  const E = r.arestas.length,
    out = new Float64Array(E)
  for (let k = 0; k < E; k++) out[k] = r.arestas[k][col]
  return out
}

export interface RedeFiltrada {
  nosVisiveis: Uint8Array
  arestasVisiveis: Uint8Array
  grauVisivel: Uint32Array
  forcaVisivel: Float64Array
  contagens: { nos: number; docentes: number; arestas: number }
  limiarPeso: number
}

/** Aplica filtros de camada, visão, percentil mínimo de peso e remove externos órfãos. */
export function filtraRede(
  r: Rede,
  w: ArrayLike<number>,
  f: Filtros,
  afastados?: ReadonlySet<number>,
  visao: Visao = 'completa',
  sel: number | null = null,
): RedeFiltrada {
  const N = r.nos.length,
    E = r.arestas.length
  const camadaOk = new Uint8Array(N)
  const isDoc = new Uint8Array(N)
  for (let i = 0; i < N; i++) {
    if (afastados?.has(i)) continue
    const cam = r.camadas[r.nos[i][1]]
    const doc = cam !== 'Externo'
    if (doc) isDoc[i] = 1
    if (visao === 'docentes' && !doc) continue
    if ((cam === 'Matemática' && f.mat) || (cam === 'Computação' && f.comp) || (cam === 'Externo' && f.ext)) {
      camadaOk[i] = 1
    }
  }

  let limiarPeso = 0
  if (f.percentil > 0 && E > 0) {
    const ord = Float64Array.from(w).sort()
    const idx = Math.min(E - 1, Math.floor((f.percentil / 100) * (E - 1)))
    limiarPeso = ord[idx]
  }

  const egoSet = visao === 'ego' && sel !== null && camadaOk[sel] ? new Set<number>([sel]) : null
  if (egoSet && sel !== null) {
    for (let k = 0; k < E; k++) {
      const a = r.arestas[k],
        u = a[0],
        v = a[1]
      if (!camadaOk[u] || !camadaOk[v]) continue
      if (f.percentil > 0 && w[k] < limiarPeso) continue
      if (u === sel) egoSet.add(v)
      else if (v === sel) egoSet.add(u)
    }
  }

  const arestasVisiveis = new Uint8Array(E)
  const grauVisivel = new Uint32Array(N)
  const forcaVisivel = new Float64Array(N)
  let contArestas = 0

  for (let k = 0; k < E; k++) {
    const a = r.arestas[k],
      u = a[0],
      v = a[1]
    if (!camadaOk[u] || !camadaOk[v]) continue
    if (f.percentil > 0 && w[k] < limiarPeso) continue
    if (egoSet && (!egoSet.has(u) || !egoSet.has(v))) continue
    arestasVisiveis[k] = 1
    contArestas++
    grauVisivel[u]++
    grauVisivel[v]++
    forcaVisivel[u] += w[k]
    forcaVisivel[v] += w[k]
  }

  const nosVisiveis = new Uint8Array(N)
  let contNos = 0,
    contDocentes = 0
  for (let i = 0; i < N; i++) {
    if (!camadaOk[i]) continue
    if (egoSet && !egoSet.has(i)) continue
    if (!isDoc[i] && grauVisivel[i] === 0) continue
    nosVisiveis[i] = 1
    contNos++
    if (isDoc[i]) contDocentes++
  }

  return {
    nosVisiveis,
    arestasVisiveis,
    grauVisivel,
    forcaVisivel,
    contagens: { nos: contNos, docentes: contDocentes, arestas: contArestas },
    limiarPeso,
  }
}

/** Calcula posições radiais para a visão egocêntrica centrada no nó `sel`. */
export function layoutEgocentrico(r: Rede, nosVisiveis: Uint8Array, sel: number): Map<number, [number, number]> {
  const pos = new Map<number, [number, number]>()
  pos.set(sel, [0, 0])
  const docs: number[] = []
  const exts: number[] = []
  for (let i = 0; i < r.nos.length; i++) {
    if (i === sel || !nosVisiveis[i]) continue
    if (ehDocente(r, i)) docs.push(i)
    else exts.push(i)
  }
  docs.forEach((id, idx) => {
    const ang = (2 * Math.PI * idx) / Math.max(1, docs.length)
    pos.set(id, [0.45 * Math.cos(ang), 0.45 * Math.sin(ang)])
  })
  exts.forEach((id, idx) => {
    const ang = (2 * Math.PI * idx) / Math.max(1, exts.length)
    pos.set(id, [0.9 * Math.cos(ang), 0.9 * Math.sin(ang)])
  })
  return pos
}

/** Exporta a lista de docentes com sua comunidade (somente códigos, sem nomes). */
export function exportaComunidadesCSV(r: Rede, com: Comunidades): string {
  const linhas = ['docente,area,comunidade']
  const docs: { codigo: string; area: string; grupo: number }[] = []
  com.particao.forEach((g, idx) => {
    docs.push({ codigo: r.nos[idx][0], area: r.camadas[r.nos[idx][1]], grupo: g + 1 })
  })
  docs.sort((a, b) => a.codigo.localeCompare(b.codigo))
  for (const d of docs) linhas.push(`${d.codigo},${d.area},${d.grupo}`)
  return linhas.join('\n')
}

/** Retorna a sigla do instituto de um nó (ou 'Externo' quando colaborador externo). */
export function institutoDoNo(r: Rede, i: number, config: ConfigInstituto = CONFIG_PADRAO): string {
  const n = r.nos[i]
  if (r.institutos && n.length >= 6 && typeof n[5] === 'number') {
    return r.institutos[n[5]] ?? config.instituto
  }
  return ehDocente(r, i) ? (r.instituto ?? config.instituto) : 'Externo'
}

export interface RedeInstitutos {
  nos: { id: string; docentes: number; externos: number; pesoInterno: number }[]
  arestas: { origem: string; destino: string; peso: number; quantidade: number }[]
}

/** Agrega a rede por instituto (cada instituto como nó agregado com arestas ponderadas). */
export function agregaPorInstituto(
  r: Rede,
  w: ArrayLike<number>,
  config: ConfigInstituto = CONFIG_PADRAO,
): RedeInstitutos {
  const mapaNos = new Map<string, { id: string; docentes: number; externos: number; pesoInterno: number }>()
  const instPorNo = new Array<string>(r.nos.length)

  for (let i = 0; i < r.nos.length; i++) {
    const inst = institutoDoNo(r, i, config)
    instPorNo[i] = inst
    let entry = mapaNos.get(inst)
    if (!entry) {
      entry = { id: inst, docentes: 0, externos: 0, pesoInterno: 0 }
      mapaNos.set(inst, entry)
    }
    if (ehDocente(r, i)) entry.docentes++
    else entry.externos++
  }

  const mapaArestas = new Map<string, { origem: string; destino: string; peso: number; quantidade: number }>()
  for (let k = 0; k < r.arestas.length; k++) {
    const a = r.arestas[k]
    const ia = instPorNo[a[0]], ib = instPorNo[a[1]]
    const wk = w[k]
    if (ia === ib) {
      mapaNos.get(ia)!.pesoInterno += wk
    } else {
      const [u, v] = ia < ib ? [ia, ib] : [ib, ia]
      const chave = `${u}::${v}`
      let e = mapaArestas.get(chave)
      if (!e) {
        e = { origem: u, destino: v, peso: 0, quantidade: 0 }
        mapaArestas.set(chave, e)
      }
      e.peso += wk
      e.quantidade++
    }
  }

  return {
    nos: [...mapaNos.values()].sort((a, b) => b.docentes - a.docentes || a.id.localeCompare(b.id)),
    arestas: [...mapaArestas.values()],
  }
}

export interface DetalhesNo {
  idx: number
  codigo: string
  ehDoc: boolean
  camada: string
  categoria: string
  comunidade: number | null
  grau: number
  forca: number
  porTipo: { tipo: string; total: number }[]
  vinculos: { idx: number; codigo: string; peso: number; ehDoc: boolean }[]
}

/** Extrai métricas e os 8 vínculos mais fortes de um nó nas arestas visíveis. */
export function detalhesNo(
  r: Rede,
  w: ArrayLike<number>,
  arestasVisiveis: Uint8Array,
  com: Comunidades | null,
  idx: number,
): DetalhesNo {
  const n = r.nos[idx]
  const ehDoc = ehDocente(r, idx)
  const T = r.tipos.length
  const somaTipos = new Float64Array(T)
  const viz: { idx: number; codigo: string; peso: number; ehDoc: boolean }[] = []
  let forca = 0

  for (let k = 0; k < r.arestas.length; k++) {
    if (!arestasVisiveis[k]) continue
    const a = r.arestas[k]
    if (a[0] !== idx && a[1] !== idx) continue
    const outro = a[0] === idx ? a[1] : a[0]
    const peso = w[k]
    forca += peso
    for (let t = 0; t < T; t++) somaTipos[t] += a[5 + t]
    viz.push({ idx: outro, codigo: r.nos[outro][0], peso, ehDoc: ehDocente(r, outro) })
  }
  viz.sort((a, b) => b.peso - a.peso || a.idx - b.idx)

  return {
    idx,
    codigo: n[0],
    ehDoc,
    camada: r.camadas[n[1]],
    categoria: r.categorias[n[2]],
    comunidade: ehDoc && com ? (com.particao.get(idx) ?? null) : null,
    grau: viz.length,
    forca,
    porTipo: r.tipos.map((tipo, t) => ({ tipo, total: somaTipos[t] })),
    vinculos: viz.slice(0, 8),
  }
}
