import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { calculaPesos, PESOS_PADRAO, type Rede } from './rede'
import {
  calculaMetricas,
  exportaSimulacaoCSV,
  geraSequenciaCenario,
  serieSimulacao,
} from './simulacao'

const rede: Rede = JSON.parse(readFileSync('public/rede.json', 'utf-8'))
const w = calculaPesos(rede, 'M2', PESOS_PADRAO)

describe('Simulador de afastamento — valores de referência', () => {
  it('reproduz o estado inicial: S_D=0,8542, alcance=1, vínculos=4, peso=1', () => {
    const m = calculaMetricas(rede, w, new Set())
    expect(m.sd).toBeCloseTo(0.8542, 4)
    expect(m.alcance).toBe(1)
    expect(m.vinculos).toBe(4)
    expect(m.peso).toBe(1)
  })

  it('reproduz a ordem "externos exclusivos": D10, D18, D37, D34, D07', () => {
    const seq = geraSequenciaCenario(rede, 'exclusivos', [], 5).map(i => rede.nos[i][0])
    expect(seq).toEqual(['D10', 'D18', 'D37', 'D34', 'D07'])
  })

  it('reproduz a ordem "grau": D28, D20, D41, D30, D37', () => {
    const seq = geraSequenciaCenario(rede, 'grau', [], 5).map(i => rede.nos[i][0])
    expect(seq).toEqual(['D28', 'D20', 'D41', 'D30', 'D37'])
  })

  it('reproduz a ordem "intermediação": D42, D41, D10, D32, D35', () => {
    const seq = geraSequenciaCenario(rede, 'intermediacao', [], 5).map(i => rede.nos[i][0])
    expect(seq).toEqual(['D42', 'D41', 'D10', 'D32', 'D35'])
  })

  it('ao afastar só D18: alcance 0,9554 e vínculos 2', () => {
    const idxD18 = rede.nos.findIndex(n => n[0] === 'D18')
    const m = calculaMetricas(rede, w, new Set([idxD18]), 'D18')
    expect(m.alcance).toBeCloseTo(0.9554, 4)
    expect(m.vinculos).toBe(2)
  })

  it('com 12 afastamentos por externos exclusivos: alcance 0,465', () => {
    const seq = geraSequenciaCenario(rede, 'exclusivos', [], 12)
    const m = calculaMetricas(rede, w, new Set(seq))
    expect(m.alcance).toBeCloseTo(0.465, 3)
  })

  it('exporta CSV com cabeçalho e valores formatados', () => {
    const idxD18 = rede.nos.findIndex(n => n[0] === 'D18')
    const serie = serieSimulacao(rede, w, [idxD18])
    const csv = exportaSimulacaoCSV(serie)
    const linhas = csv.split('\n')
    expect(linhas[0]).toBe('passo,docente,S_D,alcance,vinculos,peso')
    expect(linhas[1]).toBe('0,,0.8542,1.0000,4,1.0000')
    expect(linhas[2]).toMatch(/^1,D18,/)
  })
})
