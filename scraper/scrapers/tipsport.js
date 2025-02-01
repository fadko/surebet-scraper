// TODO zamknute stavky

import { DateTime } from 'luxon'
import fs from 'fs'
import { log } from '../helpers/logger.js'
import { setPageRequestInterception } from '../helpers/setPageRequestInterception.js'

const BASE_DATA_FILE_PATH = process.cwd() + '/scraper/data/tipsport'
const MENU_ELEMENTS_SELECTOR = '[class^="Menustyled__FirstLvlTitle"]'
const MATCH_ROW_SELECTOR = '[class^="Matchstyled__Row"]'
const BETS_SELECTOR =
	'[class^="Matchstyled__Wrapper"] div[data-my-selection-id]'

const getTsFromRawDate = (rawDate) => {
	if (!rawDate?.length) {
		console.error('tipsport scraper - getTsFromRawDate rawDate param missing')
		return Date.now()
	}

	const date = DateTime.fromFormat(rawDate, 'd. M. yyyy | H:mm', {
		zone: 'Europe/Bratislava',
	})

	return date.toMillis()
}

export const scrapeTipsport = async (browser) => {
	const start = performance.now()

	fs.mkdirSync(BASE_DATA_FILE_PATH, { recursive: true })

	const page = await browser.newPage()

	await setPageRequestInterception(page)
	await page.setUserAgent(process.env.CUSTOM_UA)

	await page.emulateTimezone('Europe/Bratislava')

	await page.goto('https://www.tipsport.sk/', {
		waitUntil: 'networkidle2',
	})

	await page.waitForSelector(MENU_ELEMENTS_SELECTOR)

	const menuNames = await page.$$eval(MENU_ELEMENTS_SELECTOR, (nodes) => {
		return nodes.map((node) => node.textContent?.toLowerCase() || '')
	})

	const menuIndexes = await page.$$eval(
		MENU_ELEMENTS_SELECTOR,
		(nodes, trackedSports) => {
			return nodes
				.map((node, index) =>
					trackedSports.includes(node.textContent?.toLowerCase())
						? index
						: -1
				)
				.filter((index) => index !== -1)
		},
		process.env.TRACKED_SPORTS?.split(',')
	)

	for (const index of menuIndexes) {
		// FOR EACH TRACKED SPORT
		const sportName = menuNames[index]
		const matchesData = []

		await page.evaluate(
			(selector, i) => {
				const element = document.querySelectorAll(selector)[i]

				if (element) {
					element.click()
				}
			},
			MENU_ELEMENTS_SELECTOR,
			index
		)

		await page.waitForNetworkIdle()

		await page.waitForFunction(
			(selector) => {
				return Array.from(document.querySelectorAll(selector)).length > 0
			},
			undefined,
			MATCH_ROW_SELECTOR
		)

		let previousHeight = 0

		while (true) {
			const newHeight = await page.evaluate(() => {
				window.scrollTo(0, document.body.scrollHeight)
				return document.body.scrollHeight
			})

			// TODO speed up / randomize
			await new Promise((res) => setTimeout(res, 1000))

			if (newHeight === previousHeight) {
				break
			}

			previousHeight = newHeight
		}

		const matches = await page.$$(MATCH_ROW_SELECTOR)

		const matchNames = await page.$$eval(
			`${MATCH_ROW_SELECTOR} [class^="Matchstyled__Name"]`,
			(nameEls) => {
				return nameEls.map((el) => el.textContent?.trim() || '')
			}
		)

		const matchDates = await page.$$eval(
			`${MATCH_ROW_SELECTOR} `,
			(rowEls) => {
				return rowEls.map((el) => {
					const textContent =
						el
							.querySelector(
								'span:first-child[class^="Matchstyled__Info"]'
							)
							?.textContent?.trim() || null

					if (!textContent) {
						return null
					}

					const dateRaw = textContent.split(' | ')[0]
					const timeString = textContent.split(' | ')[1]

					let formattedDate = dateRaw

					if (dateRaw === 'Dnes' || dateRaw === 'Zajtra') {
						const currentDate = new Date()

						if (dateRaw === 'Zajtra') {
							currentDate.setDate(currentDate.getDate() + 1)
						}

						formattedDate = currentDate.toLocaleDateString('sk-SK', {
							day: 'numeric',
							month: 'numeric',
							year: 'numeric',
							timeZone: 'Europe/Bratislava',
						})
					}

					const dateTimeRaw = `${formattedDate} | ${timeString}`
					return dateTimeRaw
				})
			}
		)

		let matchId = 1

		for (let i = 0; i < matches.length; i++) {
			// MATCH ITEM
			await page.evaluate(
				(selector, matchIndex) => {
					const element = document.querySelectorAll(selector)[matchIndex]

					if (element) {
						element.click()
					}
				},
				MATCH_ROW_SELECTOR,
				i
			)

			const matchName = matchNames[i]
			const matchUrl = await page.evaluate(() => window.location.href)

			try {
				await page.waitForFunction(
					(selector) => {
						return (
							Array.from(document.querySelectorAll(selector)).length > 0
						)
					},
					undefined,
					BETS_SELECTOR
				)
			} catch {
				log(
					`tipsport scraper error in page.waitForFunction for selector ${BETS_SELECTOR}`,
					false,
					'error'
				)
				return
			}

			const betsGroups = await page.$$eval(BETS_SELECTOR, (elements) =>
				elements.map((groupEl, groupIndex) => {
					const name = groupEl.querySelector(
						'[class^="SubHeaderstyled__SubHeader"]'
					).textContent

					const gameNames = Array.from(
						groupEl.querySelectorAll(
							'[class^="EventTablestyled__Events"] [class^="EventTableBoxstyled__GameName"]'
						)
					)

					const betButtonElsArray = Array.from(
						groupEl.querySelectorAll(
							'[class^="EventTablestyled__Events"] div[class^="BetButtonstyled__BetButton"]'
						)
					)

					const options = betButtonElsArray.map((betButtonEl, index) => {
						const betName =
							betButtonEl.querySelector('span')?.textContent || null
						const finalBetName = !gameNames.length
							? betName
							: gameNames[
									Math.floor(
										index /
											(betButtonElsArray.length / gameNames.length)
									)
							  ].textContent +
							  ' - ' +
							  betName
						const value = Number(
							betButtonEl.querySelector('span:not([class])')
								?.textContent || ''
						)

						return { name: finalBetName, value }
					})

					return { id: groupIndex + 1, name, options }
				})
			)

			matchesData.push({
				id: matchId,
				name: matchName,
				url: matchUrl,
				startsAtTs: getTsFromRawDate(matchDates[i]),
				checkedAtTs: Date.now(),
				bets: betsGroups,
			})

			matchId++
		}

		await fs.writeFile(
			`${BASE_DATA_FILE_PATH}/${sportName}.json`,
			JSON.stringify(matchesData, null, 3),
			() => {}
		)
	}

	log(
		`...tipsport scraped in ${Math.round(
			(performance.now() - start) / 1000
		)} seconds`
	)
}
