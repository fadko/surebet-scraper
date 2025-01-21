import puppeteer from 'puppeteer'
import { scrapeTipsport } from '../scrapers/tipsport.js'
import { scrapeFortuna } from '../scrapers/fortuna.js'

export const scrape = async () => {
	const now = performance.now()
	console.log('scraping starts...')

	const enabledScrapers = process.env.ENABLED_SCRAPERS?.split(',')

	if (enabledScrapers?.length) {
		const browser = await puppeteer.launch({
			devtools: false,
			headless: true,
			args: [
				'--window-size=1920,1080',
				'--disable-blink-features=AutomationControlled',
			],
		})

		if (enabledScrapers.includes('tipsport')) {
			await scrapeTipsport(browser)
		}

		if (enabledScrapers.includes('fortuna')) {
			await scrapeFortuna(browser)
		}

		await browser.close()
	}

	console.log(
		`...scraping ended in ${Math.round(
			(performance.now() - now) / 1000
		)} seconds`
	)
}
