// TODO scrapers wrapper - performance logging etc
// TODO v scraperoch zapisovat bets do samostatnych fileov

import 'dotenv/config'
import { scrape } from './modules/scrape.js'
import { findSameMatches } from './modules/findSameMatches.js'
import { findSameBets } from './modules/findSameBets.js'

const init = async () => {
	await scrape()
	const sameMatches = findSameMatches()
	const sameBets = findSameBets(sameMatches)
}

init()
