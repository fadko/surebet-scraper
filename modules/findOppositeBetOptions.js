import fs from 'fs'

const BASE_DATA_FOLDER_PATH = process.cwd() + '/data'

const loadSportsData = (sports) => {
	const result = {}
	const enabledScrapers = process.env.ENABLED_SCRAPERS?.split(',')

	sports.forEach((sportName) => {
		result[sportName] = {}

		enabledScrapers?.forEach((scraperName) => {
			const filePath = `${BASE_DATA_FOLDER_PATH}/${scraperName}/${sportName}.json`
			const rawData = fs.readFileSync(filePath, 'utf-8')
			const data = JSON.parse(rawData)

			result[sportName][scraperName] = data
		})
	})

	return result
}

const formatMatchResultOption = (optionName, matchName) => {
	if (['0', '1', '2', '10', '02'].includes(optionName)) {
		return optionName
	}

	if (optionName === 'Remíza') {
		return '0'
	}

	if (optionName === 'Nebude remíza') {
		return '12'
	}

	const optionNameSplitted = optionName
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.split(' ')
	const matchSplitted = matchName
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.split(' - ')
	const team1Name = matchSplitted[0]
	const team2Name = matchSplitted[1]

	const team1NamePartsFound = team1Name
		.split(' ')
		.filter((namePart) => namePart.length > 1)
		.map((namePart) => optionNameSplitted.includes(namePart))
		.filter((b) => b === true).length
	const team2NamePartsFound = team2Name
		.split(' ')
		.filter((namePart) => namePart.length > 1)
		.map((namePart) => optionNameSplitted.includes(namePart))
		.filter((b) => b === true).length

	const team1Found =
		!!team1NamePartsFound && team1NamePartsFound > team2NamePartsFound
	const team2Found =
		!!team2NamePartsFound && team2NamePartsFound > team1NamePartsFound

	if (optionNameSplitted.includes('neprehra')) {
		if (team1Found) {
			return '10'
		}

		if (team2Found) {
			return '02'
		}

		return null
	}

	if (team1Found) {
		return '1'
	}

	if (team2Found) {
		return '2'
	}

	return null
}

const isOppositeOption = (
	option1,
	option2,
	matchName1,
	matchName2,
	betName
) => {
	if (option1.name === option2.name) {
		return false
	}

	if (betName === 'Výsledok zápasu') {
		const formatted1 = formatMatchResultOption(option1.name, matchName1)
		const formatted2 = formatMatchResultOption(option2.name, matchName2)
		const isOpposite =
			(formatted1 === '1' && formatted2 === '02') ||
			(formatted1 === '10' && formatted2 === '2')

		return isOpposite
	}

	if (option1.name.replace('Menej ako', 'Viac ako') === option2.name) {
		return true
	}

	return false
}

export const findOppositeBetOptions = () => {
	const now = performance.now()
	console.log('looking for opposite bet options...')

	const rawData = fs.readFileSync(
		BASE_DATA_FOLDER_PATH + '/same-bets.json',
		'utf-8'
	)
	const sameBets = JSON.parse(rawData)
	const sportsArr = Array.from(new Set(sameBets.map((bet) => bet.sport)))
	const sportsData = loadSportsData(sportsArr)
	const result = {}
	let totalFoundBetOptionsCount = 0

	sameBets.forEach((activeSameBetGroup) => {
		const bets = activeSameBetGroup.bets
		const sportName = activeSameBetGroup.sport

		if (!result[sportName]) {
			result[sportName] = []
		}

		bets.forEach((bet) => {
			// find scraper with most options
			let largestScraperOptionsCount = 0
			let largestOptionsScraperName = ''

			Object.keys(bet).forEach((scraperName) => {
				const match = sportsData[sportName][scraperName].find(
					(m) => m.id === activeSameBetGroup[scraperName].id
				)
				const matchBet = match.bets.find((b) => b.id === bet[scraperName])
				const options = matchBet.options

				if (options.length > largestScraperOptionsCount) {
					largestOptionsScraperName = scraperName
				}
			})

			// get options for scraper with most options
			const match = sportsData[sportName][largestOptionsScraperName].find(
				(m) => m.id === activeSameBetGroup[largestOptionsScraperName].id
			)
			const matchBet = match.bets.find(
				(b) => b.id === bet[largestOptionsScraperName]
			)

			// compare with options from other scrapers
			matchBet.options.forEach((optionToFind) => {
				Object.keys(bet)
					.filter(
						(scraperName) => scraperName !== largestOptionsScraperName
					)
					.forEach((scraperName) => {
						const currentScraperMatch = sportsData[sportName][
							scraperName
						].find((m) => m.id === activeSameBetGroup[scraperName].id)
						const matchBet = currentScraperMatch.bets.find(
							(b) => b.id === bet[scraperName]
						)

						matchBet.options.forEach((o) => {
							// TODO find profitable same bet option
							// if (o.name === optionToFind.name) {
							// 	console.log(o.value, optionToFind.value)
							// }

							if (
								isOppositeOption(
									o,
									optionToFind,
									currentScraperMatch.name,
									match.name,
									matchBet.name
								)
							) {
								totalFoundBetOptionsCount++

								result[sportName].push({
									[largestOptionsScraperName]: {
										matchId:
											activeSameBetGroup[largestOptionsScraperName]
												.id,
										betId: bet[largestOptionsScraperName],
										...optionToFind,
									},
									[scraperName]: {
										matchId: activeSameBetGroup[scraperName].id,
										betId: bet[scraperName],
										...o,
									},
								})
							}
						})
					})
			})
		})
	})

	fs.writeFileSync(
		`${BASE_DATA_FOLDER_PATH}/opposite-bet-options.json`,
		JSON.stringify(result, null, 3)
	)

	console.log(
		`...found ${totalFoundBetOptionsCount} opposite bet options in ${Math.round(
			performance.now() - now
		)}ms`
	)
}
