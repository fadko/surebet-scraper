// TODO zamknute stavky

import fs from 'fs'

const CUSTOM_UA =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36'
const TRACKED_SPORTS = ['tenis', 'basketbal']
const MENU_ELEMENTS_SELECTOR = '[class^="Menustyled__FirstLvlTitle"]'
const MATCH_ROW_SELECTOR = '[class^="Matchstyled__Row"]'
const BETS_SELECTOR =
	'[class^="Matchstyled__Wrapper"] div[data-my-selection-id]'

export const scrapeTipsport = async (browser) => {
	const page = await browser.newPage()

	await page.setUserAgent(CUSTOM_UA)

	await page.goto('https://www.tipsport.sk/', {
		waitUntil: 'networkidle2',
	})

	await page.waitForFunction(
		(selector) => {
			return Array.from(document.querySelectorAll(selector)).length > 0
		},
		undefined,
		MENU_ELEMENTS_SELECTOR
	)

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
		TRACKED_SPORTS
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

		// TODO scroll ?

		const matches = await page.$$(MATCH_ROW_SELECTOR)

		const matchNames = await page.$$eval(
			`${MATCH_ROW_SELECTOR} [class^="Matchstyled__Name"]`,
			(nameEls) => {
				return nameEls.map((el) => el.textContent)
			}
		)

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

			await page.waitForFunction(
				(selector) => {
					return Array.from(document.querySelectorAll(selector)).length > 0
				},
				undefined,
				BETS_SELECTOR
			)

			const betsGroups = await page.$$eval(BETS_SELECTOR, (elements) =>
				elements.map((groupEl) => {
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

					return { name, options }
				})
			)

			matchesData.push({
				name: matchName,
				url: matchUrl,
				bets: betsGroups,
			})
		}

		await fs.writeFile(
			process.cwd() + `/data/tipsport/${sportName}.json`,
			JSON.stringify(matchesData),
			() => {}
		)
	}
}
