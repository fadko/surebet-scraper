// TODO tiposbet, doxxbet, synottip

import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { scrapeTipsport } from '../scrapers/tipsport.js'
import { scrapeFortuna } from '../scrapers/fortuna.js'
import { scrapeNike } from '../scrapers/nike.js'

puppeteer.use(StealthPlugin())

export const scrape = async () => {
	const now = performance.now()
	console.log('scraping starts...')

	const enabledScrapers = process.env.ENABLED_SCRAPERS?.split(',')

	if (enabledScrapers?.length) {
		const browser = await puppeteer.launch({
			devtools: false,
			headless: false,
			args: [
				'--window-size=1512,908',
				'--disable-blink-features=AutomationControlled',
			],
			defaultViewport: {
				width: 1512,
				height: 773,
			},
		})

		if (enabledScrapers.includes('tipsport')) {
			await scrapeTipsport(browser)
		}

		if (enabledScrapers.includes('fortuna')) {
			await scrapeFortuna(browser)
		}

		if (enabledScrapers.includes('nike')) {
			await scrapeNike(browser)
		}

		await browser.close()
	}

	console.log(
		`...scraping ended in ${Math.round(
			(performance.now() - now) / 1000
		)} seconds`
	)
}
