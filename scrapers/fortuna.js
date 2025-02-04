import { DateTime } from 'luxon'
import fs from 'fs'
import { log } from '../helpers/logger.js'
import { setPageRequestInterception } from '../helpers/setPageRequestInterception.js'

const BASE_DATA_FILE_PATH = process.cwd() + '/data/fortuna'
const MENU_ELEMENTS_SELECTOR = '.sport-tree:nth-child(1) .btn-sport'

const getTsFromRawDate = (rawDate) => {
	if (!rawDate?.length) {
		log(
			'fortuna scraper - getTsFromRawDate rawDate param missing',
			false,
			'warn'
		)
		return Date.now()
	}

	let date

	try {
		date = DateTime.fromFormat(rawDate, 'dd.MM. HH:mm', {
			zone: 'Europe/Bratislava',
		})
	} catch {
	} finally {
		date = DateTime.fromFormat(rawDate, 'd.M. HH:mm', {
			zone: 'Europe/Bratislava',
		})
	}

	return date.toMillis()
}

export const scrapeFortuna = async (browser) => {
	const start = performance.now()
	const page = await browser.newPage()

	await setPageRequestInterception(page)

	await page.setUserAgent(process.env.CUSTOM_UA)

	await page.goto('https://www.ifortuna.sk/', {
		waitUntil: 'networkidle2',
	})

	await page.waitForSelector(MENU_ELEMENTS_SELECTOR)

	// page.evaluate(() => {
	// 	if (document.querySelector('#cookie-consent-button-accept')) {
	// 		// @ts-ignore
	// 		document.querySelector('#cookie-consent-button-accept').click()
	// 	}
	// })

	const menuNames = await page.$$eval(MENU_ELEMENTS_SELECTOR, (nodes) => {
		return nodes.map(
			(node) =>
				node
					.querySelector('.sport-name')
					.textContent?.trim()
					.toLowerCase() || ''
		)
	})

	const menuIndexes = await page.$$eval(
		MENU_ELEMENTS_SELECTOR,
		(nodes, trackedSports) => {
			return nodes
				.map((node, index) =>
					trackedSports.includes(
						node
							.querySelector('.sport-name')
							.textContent?.trim()
							.toLowerCase()
					)
						? index
						: -1
				)
				.filter((index) => index !== -1)
		},
		process.env.TRACKED_SPORTS?.split(',')
	)

	const foundMatchesCounts = {}

	for (const index of menuIndexes) {
		// FOR EACH TRACKED SPORT
		const sportName = menuNames[index]

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

		await page.$$('section.competition-box')

		await page.evaluate(() => {
			window.scrollTo(
				0,
				document.body.scrollHeight -
					// @ts-ignore
					document.querySelector('#footer')?.offsetHeight || 0
			)
		})

		await page.waitForNetworkIdle()

		await page.evaluate(() => {
			document
				.querySelectorAll('section.competition-box')
				.forEach((sectionEl) => {
					const expandButton = sectionEl.querySelector(
						'a.name[title="Všetko"]'
					)

					if (expandButton) {
						// @ts-ignore
						expandButton?.click()
					}
				})
		})

		await page.waitForNetworkIdle()

		let matchesData = await page.evaluate(() => {
			const data = []
			let matchId = 1

			document
				.querySelectorAll('section.competition-box')
				.forEach((sectionEl) => {
					const expandButton = sectionEl.querySelector(
						'a.name[title="Všetko"]'
					)

					if (expandButton) {
						const mainEventsColNames = Array.from(
							sectionEl.querySelectorAll(
								'.events-table-box--main-market thead th.col-odds .odds-name'
							)
						).map((col) => col.textContent?.trim() || '')

						const mainEvents = Array.from(
							sectionEl.querySelectorAll(
								'.events-table-box--main-market .tablesorter-hasChildRow'
							)
						)?.map((mainEventsRow, mainEventIndex) => {
							const mainEventName =
								mainEventsRow
									.querySelector('td.col-title span.market-name')
									?.textContent?.trim() || ''

							return {
								mainEventName,
								data: {
									id: mainEventIndex + 1,
									name:
										sectionEl
											.querySelector('.market-sub-name')
											?.textContent?.trim() || '',
									options: Array.from(
										mainEventsRow.querySelectorAll('td.col-odds')
									)
										.map((col, colIndex) => {
											return {
												name: mainEventsColNames[colIndex],
												value: Number(
													col
														.querySelector('.odds-value')
														?.textContent?.trim() || 0
												),
											}
										})
										.filter((data) => {
											return data.value >= 1
										}),
								},
							}
						})

						sectionEl
							.querySelectorAll('.market-with-header')
							.forEach((matchMarketEl) => {
								const nameEl = matchMarketEl.querySelector('a.names')
								const name = nameEl?.textContent?.trim() || ''
								const url =
									'https://www.ifortuna.sk' +
									nameEl?.getAttribute('href')
								const startsAtTs =
									matchMarketEl
										.querySelector('span.datetime')
										?.textContent?.trim() || ''

								matchMarketEl
									.querySelectorAll('div.market')
									?.forEach((marketEl) => {
										marketEl
											.querySelector('.additional_info_icon')
											?.remove()
									})

								const bets = Array.from(
									matchMarketEl.querySelectorAll('div.market')
								)?.map((marketEl, betsIndex) => {
									const marketNameEl = marketEl.querySelector('h3 a')
									//@ts-ignore
									const name = marketNameEl?.innerText
										? //@ts-ignore
										  marketNameEl?.innerText?.trim() || ''
										: marketNameEl?.textContent?.trim() || ''
									const options = Array.from(
										marketEl.querySelectorAll('.odds-group a')
									)
										?.filter((el) => {
											const numValue = Number(
												el
													.querySelector('.odds-value')
													?.textContent?.trim()
											)
											const value = numValue > 1 ? numValue : null

											return !!value
										})
										.map((odd) => {
											odd.querySelector('.event-meta')?.remove()

											return {
												name:
													odd
														.querySelector('.odds-name')
														?.textContent?.trim() || '-',
												value: Number(
													odd
														.querySelector('.odds-value')
														?.textContent?.trim()
												),
											}
										})

									return {
										id: betsIndex + 1 + mainEvents.length,
										name,
										options,
									}
								})

								const mainEvent = mainEvents.find(
									(mainEvent) => mainEvent.mainEventName === name
								)

								if (mainEvent) {
									bets.unshift(mainEvent.data)
								}

								data.push({
									id: matchId,
									name,
									url,
									startsAtTs,
									checkedAtTs: Date.now(),
									bets,
								})

								matchId++
							})
					} else {
						const nameEl = sectionEl.querySelector(
							'span.title-part .competition-name'
						)
						const name = nameEl?.textContent?.trim() || ''
						const url =
							'https://www.ifortuna.sk' +
								nameEl?.parentElement?.getAttribute('href') || ''
						const startsAtTs =
							sectionEl
								.querySelector('span.event-datetime')
								?.textContent?.trim() || ''

						const bets = []

						const colNames = Array.from(
							sectionEl.querySelectorAll('th.col-odds')
						)?.map((el) => {
							return (
								el
									.querySelector('span.odds-name')
									?.textContent?.trim() || ''
							)
						})

						sectionEl
							.querySelectorAll('tbody tr')
							?.forEach((row, rowIndex) => {
								const eventNameWrapperEl = row.querySelector(
									'.title-container .event-name'
								)

								eventNameWrapperEl
									?.querySelector('span.event-meta')
									?.remove()

								const betName = eventNameWrapperEl?.querySelector(
									'span.market-name'
								)
									? eventNameWrapperEl
											?.querySelector('span.market-name')
											?.textContent?.trim()
									: eventNameWrapperEl?.textContent?.trim() || ''

								const options = Array.from(
									row.querySelectorAll('td.col-odds')
								)
									.filter((el) => {
										const numValue = Number(
											el
												.querySelector('.odds-value')
												?.textContent?.trim()
										)
										const value = numValue > 1 ? numValue : null

										return !!value
									})
									.map((el, colIndex) => {
										const numValue = Number(
											el
												.querySelector('.odds-value')
												?.textContent?.trim()
										)
										const value = numValue > 1 ? numValue : null

										return {
											name: colNames[colIndex],
											value,
										}
									})

								bets.push({
									id: rowIndex + 1,
									name: betName,
									options,
								})
							})

						data.push({
							id: matchId,
							name,
							url,
							startsAtTs,
							checkedAtTs: Date.now(),
							bets,
						})

						matchId++
					}
				})

			return data
		})

		matchesData = matchesData.map((match) => {
			return {
				...match,
				startsAtTs: getTsFromRawDate(match.startsAtTs),
			}
		})

		foundMatchesCounts[sportName] = matchesData.length

		await fs.writeFile(
			`${BASE_DATA_FILE_PATH}/${sportName}.json`,
			JSON.stringify(matchesData, null, 3),
			() => {}
		)
	}

	log(
		`...fortuna scraped in ${Math.round(
			(performance.now() - start) / 1000
		)} seconds` +
			Object.keys(foundMatchesCounts)
				.map(
					(key) =>
						`, found ${foundMatchesCounts[key]} matches for '${key}'`
				)
				.join('')
	)
}
