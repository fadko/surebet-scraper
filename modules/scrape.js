// TODO doxxbet, synottip

import fs from 'fs'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { scrapeTipsport } from '../scrapers/tipsport.js'
import { scrapeFortuna } from '../scrapers/fortuna.js'
import { scrapeNike } from '../scrapers/nike.js'
import { scrapeTiposbet } from '../scrapers/tiposbet.js'
import { log } from '../helpers/logger.js'

puppeteer.use(StealthPlugin())

export const scrape = async () => {
	const now = performance.now()

	log(
		`scraping ${process.env.ENABLED_SCRAPERS?.split(',').join(
			', '
		)} for ${process.env.TRACKED_SPORTS?.split(',').join(', ')}...`
	)

	const enabledScrapers = process.env.ENABLED_SCRAPERS?.split(',')

	if (enabledScrapers?.length) {
		let promises = []

		enabledScrapers.forEach((scraper) => {
			const dir = process.cwd() + '/data/' + scraper
			fs.rmSync(dir, { recursive: true, force: true })
			fs.mkdirSync(dir, { recursive: true })
		})

		if (enabledScrapers.includes('fortuna')) {
			promises.push(scrapeFortuna())
		}

		if (enabledScrapers.includes('nike')) {
			promises.push(scrapeNike())
		}

		if (enabledScrapers.includes('tiposbet')) {
			promises.push(scrapeTiposbet())
		}

		if (enabledScrapers.includes('tipsport')) {
			promises.push(scrapeTipsport())
		}

		await Promise.all(promises)
	}

	log(
		`...scraping ended in ${Math.round(
			(performance.now() - now) / 1000
		)} seconds`,
		true
	)
}
