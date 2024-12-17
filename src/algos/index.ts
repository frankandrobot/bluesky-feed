import { AppContext } from '../config'
import {
  QueryParams,
  OutputSchema as AlgoOutput,
} from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import * as aiVideoArt from './ai-video-art'

type AlgoHandler = (ctx: AppContext, params: QueryParams) => Promise<AlgoOutput>

const algos: Record<string, AlgoHandler> = {
  [aiVideoArt.feedShortName]: aiVideoArt.handler,
}

export const feedShortNames = [aiVideoArt.feedShortName] as const

export default algos
