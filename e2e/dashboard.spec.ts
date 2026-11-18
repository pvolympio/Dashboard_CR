import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('fluxo principal: busca D18, afasta na simulação, confere alcance 0,9554 e acessibilidade', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('2.113')).toBeVisible()

  // Busca D18
  const busca = page.getByLabel(/Buscar nó/i)
  await busca.fill('D18')
  await busca.press('Enter')

  await expect(page.getByRole('region', { name: 'Detalhes de D18' })).toBeVisible()

  // Afasta D18 na simulação
  await page.getByRole('button', { name: 'Afastar na simulação' }).click()
  await expect(page.getByText('0,9554')).toBeVisible()

  // Auditoria axe-core (ignorando o canvas WebGL)
  const axe = await new AxeBuilder({ page }).exclude('.canvas').analyze()
  const graves = axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(graves).toEqual([])
})

test.describe('Layout mobile (bottom sheets)', () => {
  for (const largura of [390, 768]) {
    test(`painéis funcionam como bottom sheet em ${largura}px`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 844 })
      await page.goto('/')
      await expect(page.getByText('2.113')).toBeVisible()

      const nav = page.getByRole('navigation', { name: 'Painéis móveis' })
      await expect(nav).toBeVisible()

      await nav.getByRole('button', { name: 'Controles' }).click()
      await expect(page.getByRole('complementary', { name: 'Controles de exploração' })).toBeVisible()

      await nav.getByRole('button', { name: 'Comunidades' }).click()
      await expect(page.getByRole('region', { name: 'Comunidades entre docentes' })).toBeVisible()

      await nav.getByRole('button', { name: 'Simulador' }).click()
      await expect(page.getByRole('region', { name: 'Simulador de afastamento' })).toBeVisible()
    })
  }
})
