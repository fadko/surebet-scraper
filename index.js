import puppeteer from 'puppeteer'
import { scrapeTipsport } from './scrapers/tipsport.js'

const init = async () => {
	const browser = await puppeteer.launch()

	await Promise.all([scrapeTipsport(browser)])

	await browser.close()
}

init()
