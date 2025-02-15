import 'dotenv/config'
import { scrape } from './modules/scrape.js'
import { normalizeNames } from './modules/normalizeNames.js'
import { findSameMatches } from './modules/findSameMatches.js'
import { findSameBets } from './modules/findSameBets.js'
import { findOppositeBetOptions } from './modules/findOppositeBetOptions.js'
import { findSureBets } from './modules/findSurebets.js'

const init = async () => {
	await scrape()
	normalizeNames()
	findSameMatches()
	findSameBets()
	findOppositeBetOptions()
	findSureBets()
}

init()
