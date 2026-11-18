import { comunidadesSubgrafo, type Comunidades, type SubgrafoDocentes } from '../lib/rede'

export type WorkerRequest =
  | { type: 'init'; sub: SubgrafoDocentes }
  | { type: 'run'; id: number; w: Float64Array; resolucao: number }

export type WorkerResponse = { id: number; com: Comunidades }

export function criaHandlerLouvain() {
  let subgrafo: SubgrafoDocentes | null = null
  return (msg: WorkerRequest): WorkerResponse | null => {
    if (msg.type === 'init') {
      subgrafo = msg.sub
      return null
    }
    if (msg.type === 'run' && subgrafo) {
      return { id: msg.id, com: comunidadesSubgrafo(subgrafo, msg.w, msg.resolucao) }
    }
    return null
  }
}
