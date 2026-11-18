import { create } from 'zustand'
import {
  normaliza,
  PESOS_PADRAO,
  type Filtros,
  type ModeloPeso,
  type ModoCor,
  type ModoTamanho,
  type Pesos,
  type Visao,
} from './lib/rede'
import type { Cenario } from './lib/simulacao'
import type { EstadoURL } from './lib/urlState'

const FILTROS_PADRAO: Filtros = { mat: true, comp: true, ext: true, percentil: 0 }

interface Estado {
  modelo: ModeloPeso
  pesos: Pesos
  resolucao: number
  modoCor: ModoCor
  modoTamanho: ModoTamanho
  visao: Visao
  apresentacao: boolean
  filtros: Filtros
  sel: number | null
  grupoRealcado: number | null
  simAberto: boolean
  afastados: number[]
  cenarioAtivo: Cenario | null
  animando: boolean
  setModelo: (m: ModeloPeso) => void
  setPeso: (k: keyof Pesos, v: number) => void
  setResolucao: (v: number) => void
  setModoCor: (m: ModoCor) => void
  setModoTamanho: (m: ModoTamanho) => void
  setVisao: (v: Visao) => void
  toggleApresentacao: (b?: boolean) => void
  aplicaEstadoURL: (e: Omit<EstadoURL, 'selCodigo'> & { sel?: number | null }) => void
  setFiltro: <K extends keyof Filtros>(k: K, v: Filtros[K]) => void
  seleciona: (i: number | null) => void
  realcaGrupo: (g: number | null) => void
  toggleSim: (aberto?: boolean) => void
  afastaDocente: (idx: number) => void
  reintegraDocente: (idx: number) => void
  limpaSimulacao: () => void
  setCenarioAtivo: (c: Cenario | null) => void
  setAnimando: (b: boolean) => void
  reinicia: () => void
}

export const useStore = create<Estado>((set) => ({
  modelo: 'M2',
  pesos: PESOS_PADRAO,
  resolucao: 1,
  modoCor: 'comunidade',
  modoTamanho: 'grau',
  visao: 'completa',
  apresentacao: false,
  filtros: FILTROS_PADRAO,
  sel: null,
  grupoRealcado: null,
  simAberto: false,
  afastados: [],
  cenarioAtivo: null,
  animando: false,
  setModelo: (modelo) => set({ modelo }),
  setPeso: (k, v) => set((s) => ({ pesos: normaliza(s.pesos, k, v) })),
  setResolucao: (resolucao) => set({ resolucao }),
  setModoCor: (modoCor) => set({ modoCor }),
  setModoTamanho: (modoTamanho) => set({ modoTamanho }),
  setVisao: (visao) => set({ visao }),
  toggleApresentacao: (b) => set((s) => ({ apresentacao: b ?? !s.apresentacao })),
  aplicaEstadoURL: (e) =>
    set((s) => ({
      modelo: e.modelo ?? s.modelo,
      pesos: e.pesos ?? s.pesos,
      resolucao: e.resolucao ?? s.resolucao,
      modoCor: e.modoCor ?? s.modoCor,
      modoTamanho: e.modoTamanho ?? s.modoTamanho,
      visao: e.visao ?? s.visao,
      sel: e.sel !== undefined ? e.sel : s.sel,
    })),
  setFiltro: (k, v) => set((s) => ({ filtros: { ...s.filtros, [k]: v } })),
  seleciona: (sel) => set({ sel, grupoRealcado: null }),
  realcaGrupo: (g) => set((s) => ({ grupoRealcado: s.grupoRealcado === g ? null : g, sel: null })),
  toggleSim: (aberto) => set((s) => ({ simAberto: aberto ?? !s.simAberto })),
  afastaDocente: (idx) =>
    set((s) =>
      s.afastados.includes(idx) ? s : { afastados: [...s.afastados, idx], sel: s.sel === idx ? null : s.sel },
    ),
  reintegraDocente: (idx) => set((s) => ({ afastados: s.afastados.filter((x) => x !== idx) })),
  limpaSimulacao: () => set({ afastados: [], cenarioAtivo: null, animando: false }),
  setCenarioAtivo: (cenarioAtivo) => set({ cenarioAtivo }),
  setAnimando: (animando) => set({ animando }),
  reinicia: () =>
    set({ modelo: 'M2', pesos: PESOS_PADRAO, resolucao: 1, filtros: FILTROS_PADRAO, grupoRealcado: null }),
}))
