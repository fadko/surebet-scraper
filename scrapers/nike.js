import { DateTime } from 'luxon'
import fs from 'fs'
import { log } from '../helpers/logger.js'

const BASE_DATA_FILE_PATH = process.cwd() + '/data/nike'
const BASE_URL = 'https://www.nike.sk'
const TRACKED_SPORTS = process.env.TRACKED_SPORTS?.split(',')
const MENU_ELEMENTS_SELECTOR = '[data-atid="sports-filter"] .menu-item'
const LEAGUE_GROUP_SELECTOR = '.boxes-inner-view .boxes-view'

const onInit = async (page) => {
	fs.mkdirSync(BASE_DATA_FILE_PATH, { recursive: true })

	await page.setUserAgent(process.env.CUSTOM_UA)

	await page.goto(BASE_URL + '/tipovanie', {
		waitUntil: 'networkidle2',
	})

	await page.waitForSelector(MENU_ELEMENTS_SELECTOR)
}

/**
 * @param {any} page
 * @returns {Promise<{ name: string; url: string; }[]>}
 */
const getMenuElementsData = async (page) => {
	const result = await page.$$eval(MENU_ELEMENTS_SELECTOR, (nodes) => {
		return nodes.map((node) => {
			const name =
				node
					.querySelector('.menu-item-label')
					.textContent?.trim()
					.toLowerCase() || ''

			const url = node.querySelector('a').getAttribute('href')

			return {
				name,
				url,
			}
		})
	})

	return result.filter((item) => TRACKED_SPORTS?.includes(item.name))
}

/**
 * @param {{name: string; url: string;}} menuDataItem
 * @param {any} page
 */
const scrapeSport = async (menuDataItem, page) => {
	const SPORT_URL = BASE_URL + menuDataItem.url

	await page.goto(SPORT_URL)

	let previousHeight = 0

	// scroll through sport league groups container
	while (true) {
		const newHeight = await page.evaluate(() => {
			const scrollContainer = document.querySelector(
				'.native-scroll.optimize-scroll'
			)

			if (scrollContainer) {
				scrollContainer.scrollTo(0, scrollContainer.scrollHeight)
			}

			return scrollContainer?.scrollHeight || 0
		})

		await new Promise((res) =>
			setTimeout(res, 1000 + Math.floor(Math.random() * 200))
		)

		if (newHeight === previousHeight) {
			break
		}

		previousHeight = newHeight
	}

	await page.evaluate(() => {
		document.querySelector('.native-scroll.optimize-scroll')?.scrollTo(0, 0)
	})

	// get matches data for each of league groups elements
	const matchesData = await page.$$eval(
		LEAGUE_GROUP_SELECTOR + ' .bet-view-prematch-row',
		(matchRows) => {
			return matchRows.map((matchRow, index) => {
				return {
					id: index + 1,
					name:
						matchRow
							.querySelector('[data-atid="bet-info-time"]')
							?.getAttribute('title')
							?.split('\n')[0]
							?.split(' | ')[3]
							?.replace(' vs ', ' - ') || null,
					url: '',
					startsAtTs:
						matchRow
							.querySelector('[data-atid="bet-info-time"]')
							?.getAttribute('title')
							?.split('\n')[1]
							?.split(' | ')[1] || null,
					checkedAtTs: Date.now(),
				}
			})
		}
	)

	matchesData.forEach((matchData) => {
		let date

		try {
			date = DateTime.fromFormat(matchData.startsAtTs, 'dd.MM.yyyy HH:mm', {
				zone: 'Europe/Bratislava',
			})
		} catch {
			date = DateTime.now()
		}

		const startsAtTs = date.toMillis()

		matchData['startsAtTs'] = startsAtTs
		matchData['url'] = SPORT_URL
	})

	for (const [index] of matchesData.entries()) {
		await page.evaluate((i) => {
			const showMoreBtnEl = document.querySelectorAll(
				'.boxes-inner-view .boxes-view .bet-view-prematch-row [data-atid="show-more-bets-button"]'
			)[i]

			if (showMoreBtnEl) {
				// @ts-ignore
				showMoreBtnEl.focus()
				// @ts-ignore
				showMoreBtnEl.click()
			}
		}, index)

		await page.waitForSelector(
			'.content-box-article-content [data-atid="market-accordion"]'
		)

		const bets = await page.$$eval(
			'.content-box-article-content [data-atid="market-accordion"] ',
			(nodes) => {
				return nodes.map((node, index) => {
					const name =
						node
							.querySelector('.content-box-bets-subtitle')
							?.textContent?.trim() || ''
					const options = Array.from(
						node.nextElementSibling?.querySelectorAll('.log-bets-table a')
					)?.map((optionEl) => {
						return {
							name:
								optionEl
									.querySelector('span.ellipsis')
									?.textContent?.trim() || '',
							value:
								+optionEl
									.querySelector('[data-atid="n1-bet-odd"]')
									?.textContent?.trim() || null,
						}
					})

					return {
						id: index + 1,
						name,
						options,
					}
				})
			}
		)

		matchesData[index]['bets'] = bets
	}

	await fs.writeFile(
		`${BASE_DATA_FILE_PATH}/${menuDataItem.name}.json`,
		JSON.stringify(matchesData, null, 3),
		() => {}
	)
}

export const scrapeNike = async (browser) => {
	const start = performance.now()

	const page = await browser.newPage()
	await onInit(page)
	const menuData = await getMenuElementsData(page)

	for (const menuDataItem of menuData) {
		await scrapeSport(menuDataItem, page)
	}

	log(
		`...nike scraped in ${Math.round(
			(performance.now() - start) / 1000
		)} seconds`
	)
}
