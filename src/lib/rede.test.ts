import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { calculaM2, comunidades, ehDocente, normaliza, PESOS_PADRAO, type Rede } from './rede'

const rede: Rede = JSON.parse(readFileSync('public/rede.json', 'utf-8'))
describe('M2', () => {
  it('reproduz a coluna M2 do pipeline Python com os pesos do artigo', () => {
    const w = calculaM2(rede, PESOS_PADRAO)
    rede.arestas.forEach((a, k) => expect(Math.abs(w[k] - a[3])).toBeLessThan(1e-3))
  })
  it('mantém a soma dos pesos em 1', () => {
    const p = normaliza(PESOS_PADRAO, 'P', 0.8)
    expect(p.P + p.F + p.J).toBeCloseTo(1, 12); expect(p.P).toBe(0.8)
  })
})
describe('Louvain', () => {
  const c = comunidades(rede, calculaM2(rede, PESOS_PADRAO))
  it('classifica os 48 docentes e nenhum externo', () => {
    expect(c.particao.size).toBe(48)
    expect([...c.particao.keys()].every(i => ehDocente(rede, i))).toBe(true)
  })
  it('chega perto da modularidade de referência do Python (0,585)', () => expect(Math.abs(c.Q - 0.585)).toBeLessThan(0.05))
})
