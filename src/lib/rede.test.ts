import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  calculaM2,
  calculaPesos,
  comunidades,
  detalhesNo,
  ehDocente,
  exportaComunidadesCSV,
  filtraRede,
  layoutEgocentrico,
  normaliza,
  PESOS_PADRAO,
  type Rede,
} from './rede'

const rede: Rede = JSON.parse(readFileSync('public/rede.json', 'utf-8'))

describe('Modelos de peso (M1, M2, M3)', () => {
  it('reproduz a coluna M1 do JSON', () => {
    const w = calculaPesos(rede, 'M1', PESOS_PADRAO)
    rede.arestas.forEach((a, k) => expect(w[k]).toBe(a[2]))
  })
  it('reproduz a coluna M2 do pipeline Python com os pesos do artigo', () => {
    const w = calculaM2(rede, PESOS_PADRAO)
    rede.arestas.forEach((a, k) => expect(Math.abs(w[k] - a[3])).toBeLessThan(1e-3))
  })
  it('reproduz a coluna M3 do JSON', () => {
    const w = calculaPesos(rede, 'M3', PESOS_PADRAO)
    rede.arestas.forEach((a, k) => expect(w[k]).toBe(a[4]))
  })
  it('mantém a soma dos pesos em 1', () => {
    const p = normaliza(PESOS_PADRAO, 'P', 0.8)
    expect(p.P + p.F + p.J).toBeCloseTo(1, 12)
    expect(p.P).toBe(0.8)
  })
})

describe('Filtros e detalhes', () => {
  const w = calculaPesos(rede, 'M2', PESOS_PADRAO)

  it('tem contagens iniciais exatas de 2.113 nós, 48 docentes e 3.028 arestas', () => {
    const f = filtraRede(rede, w, { mat: true, comp: true, ext: true, percentil: 0 })
    expect(f.contagens).toEqual({ nos: 2113, docentes: 48, arestas: 3028 })
  })

  it('esconde externos órfãos quando filtrados por percentil', () => {
    const f = filtraRede(rede, w, { mat: true, comp: true, ext: true, percentil: 80 })
    expect(f.contagens.arestas).toBeLessThan(3028)
    expect(f.contagens.nos).toBeLessThan(2113)
    for (let i = 0; i < rede.nos.length; i++) {
      if (f.nosVisiveis[i] && !ehDocente(rede, i)) {
        expect(f.grauVisivel[i]).toBeGreaterThan(0)
      }
    }
  })

  it('extrai os 8 vínculos mais fortes em ordem decrescente', () => {
    const f = filtraRede(rede, w, { mat: true, comp: true, ext: true, percentil: 0 })
    const idxD18 = rede.nos.findIndex(n => n[0] === 'D18')
    const d = detalhesNo(rede, w, f.arestasVisiveis, null, idxD18)
    expect(d.codigo).toBe('D18')
    expect(d.vinculos.length).toBe(8)
    for (let i = 1; i < d.vinculos.length; i++) {
      expect(d.vinculos[i - 1].peso).toBeGreaterThanOrEqual(d.vinculos[i].peso)
    }
  })

  it('visão só docentes mostra apenas os 48 docentes e layout egocêntrico centraliza o nó', () => {
    const fDoc = filtraRede(rede, w, { mat: true, comp: true, ext: true, percentil: 0 }, undefined, 'docentes')
    expect(fDoc.contagens.nos).toBe(48)
    expect(fDoc.contagens.docentes).toBe(48)

    const idxD18 = rede.nos.findIndex(n => n[0] === 'D18')
    const fEgo = filtraRede(rede, w, { mat: true, comp: true, ext: true, percentil: 0 }, undefined, 'ego', idxD18)
    const pos = layoutEgocentrico(rede, fEgo.nosVisiveis, idxD18)
    expect(pos.get(idxD18)).toEqual([0, 0])
    expect(pos.size).toBe(fEgo.contagens.nos)
  })
})

describe('Louvain', () => {
  const c = comunidades(rede, calculaM2(rede, PESOS_PADRAO))
  it('classifica os 48 docentes e nenhum externo', () => {
    expect(c.particao.size).toBe(48)
    expect([...c.particao.keys()].every(i => ehDocente(rede, i))).toBe(true)
  })
  it('chega perto da modularidade de referência do Python (0,585)', () => expect(Math.abs(c.Q - 0.585)).toBeLessThan(0.05))
  it('exporta CSV de comunidades somente com códigos de docentes', () => {
    const csv = exportaComunidadesCSV(rede, c)
    const linhas = csv.split('\n')
    expect(linhas[0]).toBe('docente,area,comunidade')
    expect(linhas.length).toBe(49)
    expect(linhas[1]).toMatch(/^D\d{2},/)
  })
})
