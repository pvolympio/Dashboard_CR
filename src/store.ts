import { create } from 'zustand'
import {
  normaliza,
  PESOS_PADRAO,
  type Filtros,
  type ModeloPeso,
  type ModoCor,
  type ModoTamanho,
  type Pesos,
} from './lib/rede'

const FILTROS_PADRAO: Filtros = { mat: true, comp: true, ext: true, percentil: 0 }

interface Estado {
  modelo: ModeloPeso
  pesos: Pesos
  resolucao: number
  modoCor: ModoCor
  modoTamanho: ModoTamanho
  filtros: Filtros
  sel: number | null
  grupoRealcado: number | null
  setModelo: (m: ModeloPeso) => void
  setPeso: (k: keyof Pesos, v: number) => void
  setResolucao: (v: number) => void
  setModoCor: (m: ModoCor) => void
  setModoTamanho: (m: ModoTamanho) => void
  setFiltro: <K extends keyof Filtros>(k: K, v: Filtros[K]) => void
  seleciona: (i: number | null) => void
  realcaGrupo: (g: number | null) => void
  reinicia: () => void
}

export const useStore = create<Estado>(set => ({
  modelo: 'M2',
  pesos: PESOS_PADRAO,
  resolucao: 1,
  modoCor: 'comunidade',
  modoTamanho: 'grau',
  filtros: FILTROS_PADRAO,
  sel: null,
  grupoRealcado: null,
  setModelo: modelo => set({ modelo }),
  setPeso: (k, v) => set(s => ({ pesos: normaliza(s.pesos, k, v) })),
  setResolucao: resolucao => set({ resolucao }),
  setModoCor: modoCor => set({ modoCor }),
  setModoTamanho: modoTamanho => set({ modoTamanho }),
  setFiltro: (k, v) => set(s => ({ filtros: { ...s.filtros, [k]: v } })),
  seleciona: sel => set({ sel, grupoRealcado: null }),
  realcaGrupo: g => set(s => ({ grupoRealcado: s.grupoRealcado === g ? null : g, sel: null })),
  reinicia: () => set({ modelo: 'M2', pesos: PESOS_PADRAO, resolucao: 1, filtros: FILTROS_PADRAO, grupoRealcado: null }),
}))
