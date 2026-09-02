import { AndesExpressAdapter } from './adapters/andes-express.js'
import { RutaSurAdapter } from './adapters/ruta-sur.js'
import { TransBolivarAdapter } from './adapters/trans-bolivar.js'
import { NormalizationService } from './normalization.service.js'

export const adapters = [
  new AndesExpressAdapter(),
  new TransBolivarAdapter(),
  new RutaSurAdapter(),
] as const

export const normalizationService = NormalizationService.forAdapters(adapters)
