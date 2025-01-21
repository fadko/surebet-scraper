import 'dotenv/config'
import { scrape } from './modules/scrape.js'

const init = async () => {
	await scrape()
}

init()
