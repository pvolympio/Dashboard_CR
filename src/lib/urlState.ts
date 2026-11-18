import type { ModeloPeso, ModoCor, ModoTamanho, Pesos, Visao } from './rede'

export interface EstadoURL {
  modelo?: ModeloPeso
  pesos?: Pesos
  resolucao?: number
  modoCor?: ModoCor
  modoTamanho?: ModoTamanho
  visao?: Visao
  selCodigo?: string | null
}

const MODELOS = new Set<ModeloPeso>(['M1', 'M2', 'M3'])
const CORES = new Set<ModoCor>(['comunidade', 'area', 'categoria'])
const TAMANHOS = new Set<ModoTamanho>(['grau', 'forca', 'fixo'])
const VISOES = new Set<Visao>(['completa', 'docentes', 'ego', 'instituto'])

/** Serializa o estado de visualização em hash de URL sem dados sensíveis. */
export function serializaHash(e: Required<Omit<EstadoURL, 'selCodigo'>> & { selCodigo: string | null }): string {
  const sp = new URLSearchParams()
  sp.set('m', e.modelo)
  sp.set('p', e.pesos.P.toFixed(2))
  sp.set('f', e.pesos.F.toFixed(2))
  sp.set('j', e.pesos.J.toFixed(2))
  sp.set('r', e.resolucao.toFixed(1))
  sp.set('c', e.modoCor)
  sp.set('t', e.modoTamanho)
  sp.set('v', e.visao)
  if (e.selCodigo && /^[DX]\d+$/i.test(e.selCodigo)) sp.set('s', e.selCodigo.toUpperCase())
  return `#${sp.toString()}`
}

/** Lê e valida parâmetros do hash da URL. */
export function parseHash(hash: string): EstadoURL {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  if (!raw) return {}
  const sp = new URLSearchParams(raw)
  const out: EstadoURL = {}

  const m = sp.get('m') as ModeloPeso | null
  if (m && MODELOS.has(m)) out.modelo = m

  const p = Number(sp.get('p')),
    f = Number(sp.get('f')),
    j = Number(sp.get('j'))
  if ([p, f, j].every((v) => Number.isFinite(v) && v >= 0 && v <= 1)) {
    const soma = p + f + j
    if (soma > 0) out.pesos = { P: p / soma, F: f / soma, J: j / soma }
  }

  const r = Number(sp.get('r'))
  if (Number.isFinite(r) && r >= 0.4 && r <= 2) out.resolucao = r

  const c = sp.get('c') as ModoCor | null
  if (c && CORES.has(c)) out.modoCor = c

  const t = sp.get('t') as ModoTamanho | null
  if (t && TAMANHOS.has(t)) out.modoTamanho = t

  const v = sp.get('v') as Visao | null
  if (v && VISOES.has(v)) out.visao = v

  const s = sp.get('s')
  if (s && /^[DX]\d+$/i.test(s)) out.selCodigo = s.toUpperCase()

  return out
}
