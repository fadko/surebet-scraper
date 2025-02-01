// TODO scrapers wrapper - performance logging etc
// TODO v scraperoch zapisovat bets do samostatnych fileov

import 'dotenv/config'
import { scrape } from './modules/scrape.js'
import { findSameMatches } from './modules/findSameMatches.js'
import { findSameBets } from './modules/findSameBets.js'
import { findOppositeBetOptions } from './modules/findOppositeBetOptions.js'
import { findSureBets } from './modules/findSurebets.js'

const init = async () => {
	await scrape()
	findSameMatches()
	findSameBets()
	findOppositeBetOptions()
	findSureBets()
}

init()
