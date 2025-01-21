// TODO hlavne stavky

import fs from 'fs'

const BASE_DATA_FILE_PATH = process.cwd() + '/data/fortuna'
const MENU_ELEMENTS_SELECTOR = '.sport-tree:nth-child(1) .btn-sport'

export const scrapeFortuna = async (browser) => {
	fs.mkdirSync(BASE_DATA_FILE_PATH, { recursive: true })

	const page = await browser.newPage()

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

		const matchesData = await page.evaluate(() => {
			const getTimestampFromString = (input) => {
				if (!input?.length) {
					return null
				}

				const day = input.split('.')[0]
				const month = input.split('.')[1].split(' ')[0]
				const time = input.split(' ')[1]
				const [hours, minutes] = time.split(':')
				const now = new Date()
				const year = now.getFullYear()

				const date = new Date(
					Date.UTC(year, month - 1, day, hours, minutes)
				)
				date.setMinutes(date.getMinutes() - date.getTimezoneOffset())

				return date.getTime()
			}

			const data = []
			let matchId = 1

			document
				.querySelectorAll('section.competition-box')
				.forEach((sectionEl) => {
					const expandButton = sectionEl.querySelector(
						'a.name[title="Všetko"]'
					)

					if (expandButton) {
						sectionEl
							.querySelectorAll('.market-with-header')
							.forEach((matchMarketEl) => {
								const nameEl = matchMarketEl.querySelector('a.names')
								const name = nameEl?.textContent?.trim() || ''
								const url =
									'https://www.ifortuna.sk' +
									nameEl?.getAttribute('href')
								const startsAtTs = getTimestampFromString(
									matchMarketEl
										.querySelector('span.datetime')
										?.textContent?.trim() || ''
								)

								sectionEl
									.querySelectorAll('div.market')
									?.forEach((marketEl) => {
										marketEl
											.querySelector('.additional_info_icon')
											?.remove()
									})

								const bets = Array.from(
									sectionEl.querySelectorAll('div.market')
								)?.map((marketEl) => {
									const nameEl = marketEl.querySelector('h3 a')
									//@ts-ignore
									const name = nameEl?.innerText
										? //@ts-ignore
										  nameEl?.innerText?.trim() || ''
										: nameEl?.textContent?.trim() || ''
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
										name,
										options,
									}
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
							})
					} else {
						const nameEl = sectionEl.querySelector(
							'span.title-part .competition-name'
						)
						const name = nameEl?.textContent?.trim() || ''
						const url =
							'https://www.ifortuna.sk' +
								nameEl?.parentElement?.getAttribute('href') || ''
						const startsAtTs = getTimestampFromString(
							sectionEl
								.querySelector('span.event-datetime')
								?.textContent?.trim() || ''
						)

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

						sectionEl.querySelectorAll('tbody tr')?.forEach((row) => {
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

		await fs.writeFile(
			`${BASE_DATA_FILE_PATH}/${sportName}.json`,
			JSON.stringify(matchesData, null, 3),
			() => {}
		)
	}
}
