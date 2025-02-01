// TODO doxxbet, synottip

import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { scrapeTipsport } from '../scrapers/tipsport.js'
import { scrapeFortuna } from '../scrapers/fortuna.js'
import { scrapeNike } from '../scrapers/nike.js'
import { scrapeTiposbet } from '../scrapers/tiposbet.js'

puppeteer.use(StealthPlugin())

export const scrape = async () => {
	const now = performance.now()
	console.log(`scraping ${process.env.ENABLED_SCRAPERS}...`)

	const enabledScrapers = process.env.ENABLED_SCRAPERS?.split(',')

	if (enabledScrapers?.length) {
		const browser = await puppeteer.launch({
			devtools: false,
			headless: process.env.HEADLESS_BROWSER === 'true',
			args: [
				'--window-size=1512,908',
				'--disable-blink-features=AutomationControlled',
			],
			defaultViewport: {
				width: 1512,
				height: 773,
			},
		})

		let promises = []

		if (enabledScrapers.includes('tipsport')) {
			promises.push(scrapeTipsport(browser))
		}

		if (enabledScrapers.includes('fortuna')) {
			promises.push(scrapeFortuna(browser))
		}

		if (enabledScrapers.includes('nike')) {
			promises.push(scrapeNike(browser))
		}

		if (enabledScrapers.includes('tiposbet')) {
			promises.push(scrapeTiposbet(browser))
		}

		await Promise.all(promises)

		await browser.close()
	}

	console.log(
		`...scraping ended in ${Math.round(
			(performance.now() - now) / 1000
		)} seconds`
	)
	console.log('\n')
}
