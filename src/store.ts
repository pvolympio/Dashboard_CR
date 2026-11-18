import { create } from 'zustand'
import { normaliza, PESOS_PADRAO, type Pesos } from './lib/rede'
interface Estado { pesos: Pesos; resolucao: number; modo: 'comunidade' | 'area'; sel: number | null
  setPeso: (k: keyof Pesos, v: number) => void; setResolucao: (v: number) => void; setModo: (m: Estado['modo']) => void; seleciona: (i: number | null) => void; reinicia: () => void }
export const useStore = create<Estado>(set => ({ pesos: PESOS_PADRAO, resolucao: 1, modo: 'comunidade', sel: null,
  setPeso: (k, v) => set(s => ({ pesos: normaliza(s.pesos, k, v) })), setResolucao: resolucao => set({ resolucao }),
  setModo: modo => set({ modo }), seleciona: sel => set({ sel }), reinicia: () => set({ pesos: PESOS_PADRAO, resolucao: 1 }) }))
