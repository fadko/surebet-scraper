import 'dotenv/config'
import puppeteer from 'puppeteer'
import { scrapeTipsport } from './scrapers/tipsport.js'
import { scrapeFortuna } from './scrapers/fortuna.js'

const init = async () => {
	const browser = await puppeteer.launch({
		devtools: false,
		headless: true,
		args: [
			'--window-size=1920,1080',
			'--disable-blink-features=AutomationControlled',
		],
	})

	await scrapeTipsport(browser)
	await scrapeFortuna(browser)

	await browser.close()
}

init()
