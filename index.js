import 'dotenv/config'
import { scrape } from './modules/scrape.js'
import { findSameMatches } from './modules/findSameMatches.js'

const init = async () => {
	await scrape()
	findSameMatches()
}

init()
