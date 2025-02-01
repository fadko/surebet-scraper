import { DateTime } from 'luxon'
import fs from 'fs'
import { log } from '../helpers/logger.js'

const MATCHES_LIMIT = 100
const BASE_DATA_FILE_PATH = process.cwd() + '/data/tiposbet'
const BASE_URL = 'https://tipkurz.etipos.sk'
const TRACKED_SPORTS = process.env.TRACKED_SPORTS?.split(',')
const MENU_ELEMENTS_SELECTOR = '[data-test-role="sport-categories"] .nav-item'

const onInit = async (page) => {
	fs.mkdirSync(BASE_DATA_FILE_PATH, { recursive: true })

	await page.setUserAgent(process.env.CUSTOM_UA)

	await page.goto(BASE_URL + '/sk/top5', {
		waitUntil: 'networkidle2',
	})

	await page.waitForSelector(MENU_ELEMENTS_SELECTOR)
}

/**
 * @param {any} page
 * @returns {Promise<{ name: string; path: string; }[]>}
 */
const getMenuElementsData = async (page) => {
	const result = await page.$$eval(MENU_ELEMENTS_SELECTOR, (nodes) => {
		return nodes.map((node) => {
			node.querySelectorAll('.live-selection-flag').forEach((liveFlagEl) => {
				liveFlagEl.remove()
			})

			const categoryName =
				node
					.querySelector('.nav-tree-label.text-truncate')
					.textContent?.trim()
					.toLowerCase() || ''

			node.querySelector('a').click()

			return {
				name: categoryName,
				path: window.location.pathname + window.location.search,
			}
		})
	})

	return result.filter((item) => TRACKED_SPORTS?.includes(item.name))
}

/**
 * @param {{name: string; path: string;}} menuDataItem
 * @param {any} page
 */
const scrapeSport = async (menuDataItem, page) => {
	const SPORT_URL = BASE_URL + menuDataItem.path

	await page.goto(SPORT_URL)

	await page.waitForSelector(
		'.simplebar-content [data-test-role="event-list"]'
	)

	// scroll through sport league groups container
	let previousHeight = 0

	while (true) {
		const newHeight = await page.evaluate(() => {
			const scrollContainer = document.querySelector(
				'.content-container.scroll-container .simplebar-scroll-content'
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
		document
			.querySelector(
				'.content-container.scroll-container .simplebar-scroll-content'
			)
			?.scrollTo(0, 0)
	})

	// get essential matches data for each of league groups elements
	let matchesData = await page.$$eval(
		'[data-test-role="event-list__item"]:not(.live-eventlist-item)',
		(matchRows) => {
			return matchRows.map((matchRow, index) => {
				return {
					id: index + 1,
					name:
						matchRow
							.querySelector(
								'.match-label[data-test-role="event-list__item__detail-link"]'
							)
							?.textContent?.trim() || null,
					url: '',
					startsAtTs: matchRow
						.querySelector('.date-col')
						?.innerHTML.replace('<br>', ' '),
					checkedAtTs: Date.now(),
				}
			})
		}
	)

	if (matchesData.length > MATCHES_LIMIT) {
		matchesData = matchesData.splice(0, MATCHES_LIMIT)
	}

	// get startsAtTs
	matchesData.forEach((matchData) => {
		let date

		try {
			date = DateTime.fromFormat(matchData.startsAtTs, 'dd.MM.yy HH:mm', {
				zone: 'Europe/Bratislava',
			})
		} catch {
			date = DateTime.now()
		}

		const startsAtTs = date.toMillis()

		matchData['startsAtTs'] = startsAtTs
	})

	// get bets / options data
	for (const [index] of matchesData.entries()) {
		const marchUrl = await page.evaluate((i) => {
			const showMoreBtn = document
				.querySelectorAll(
					'[data-test-role="event-list__item"]:not(.live-eventlist-item)'
				)
				[i].querySelector('.other-events-col.derived-link')

			if (showMoreBtn) {
				// @ts-ignore
				showMoreBtn.click()
			}

			return window.location.href
		}, index)

		try {
			await page.waitForSelector('[data-test-role="event-game"]')

			matchesData[index]['url'] = marchUrl

			const bets = await page.evaluate(async (matchName) => {
				const normalizeOptionName = (name) => {
					if (name.includes('Pod (')) {
						return name.replace('Pod (', 'Menej ako ').replace(')', '')
					}

					if (name.includes('Nad (')) {
						return name.replace('Nad (', 'Viac ako ').replace(')', '')
					}

					const splitted = matchName.split(' - ')

					if (splitted.length === 2) {
						const team1 = splitted[0]
						const team2 = splitted[1]

						if (name === team1) {
							return '1'
						}

						if (name === team2) {
							return '2'
						}
					}

					return name
				}

				const matchBets = []

				const betTypeMenuBtns = document.querySelectorAll(
					'.event-detail-content .event-detail-tabs .w-100'
				)

				let i = 1

				for (const betTypeBtn of betTypeMenuBtns) {
					// @ts-ignore
					betTypeBtn.click()

					await new Promise((res) => setTimeout(res, 0))

					document
						.querySelectorAll(
							'.event-detail-content [data-test-role="event-game"]'
						)
						.forEach((betWrapper) => {
							matchBets.push({
								id: i,
								name:
									betWrapper
										.querySelector('.game-label')
										?.textContent?.trim() || '',
								options: Array.from(
									betWrapper.querySelectorAll('.rate-detail')
								).map((rateWrapper) => {
									return {
										name: normalizeOptionName(
											rateWrapper
												.querySelector('.tip-label')
												?.textContent?.trim() || ''
										),
										value: Number(
											rateWrapper
												.querySelector('.rate')
												?.textContent?.trim()
												?.replace(',', '.') || null
										),
									}
								}),
							})

							i++
						})
				}

				return matchBets
			}, matchesData[index].name)

			matchesData[index]['bets'] = bets
		} catch {}
	}

	await fs.writeFile(
		`${BASE_DATA_FILE_PATH}/${menuDataItem.name}.json`,
		JSON.stringify(matchesData, null, 3),
		() => {}
	)
}

export const scrapeTiposbet = async (browser) => {
	const start = performance.now()

	const page = await browser.newPage()
	await onInit(page)
	const menuData = await getMenuElementsData(page)

	for (const menuDataItem of menuData) {
		await scrapeSport(menuDataItem, page)
	}

	log(
		`...tiposbet scraped in ${Math.round(
			(performance.now() - start) / 1000
		)} seconds`
	)
}
