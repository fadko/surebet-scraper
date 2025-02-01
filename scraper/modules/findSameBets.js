import fs from 'fs'
import { log } from '../helpers/logger.js'

const BASE_DATA_FOLDER_PATH = process.cwd() + '/scraper/data'

const normalizeAndSplitBetName = (name) => {
	return name.toLowerCase().normalize('NFD').split(' ')
}

const loadAndNormalizeBetsData = (match, sport) => {
	let result = {}

	Object.keys(match).forEach((scraperName) => {
		const filePath = `${BASE_DATA_FOLDER_PATH}/${scraperName}/${sport}.json`
		const rawData = fs.readFileSync(filePath, 'utf-8')
		const data = JSON.parse(rawData)
		const betsData = data.find((m) => m.id === match[scraperName].id).bets
		const normalizedBetsData = betsData.map((bet) => {
			return {
				id: bet.id,
				name: normalizeAndSplitBetName(bet.name),
				originalName: bet.name,
			}
		})

		result[scraperName] = normalizedBetsData
	})

	return result
}

const checkIsSame = (name1, name2) => {
	const name1Normalized = name1
		.join(' ')
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
	const name2Normalized = name2
		.join(' ')
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')

	const sameNamesGroups = [
		[
			'presny pocet setov',
			'pocet setov',
			'pocet setov v zápase (na dva vitazne)',
		],
		['pocet gemov', 'celkovy pocet gemov'],
	]

	return sameNamesGroups.some(
		(namesGroup) =>
			namesGroup.includes(name1Normalized) &&
			namesGroup.includes(name2Normalized)
	)
}

export const findSameBets = () => {
	const now = performance.now()
	log('looking for the same bets...')

	const rawData = fs.readFileSync(
		BASE_DATA_FOLDER_PATH + '/same-matches.json',
		'utf-8'
	)
	const sameMatches = JSON.parse(rawData)
	const sameBets = []
	let totalFoundMatchesCount = 0
	let totalFoundBetsCount = 0
	let totalFoundScraperBetsCount = 0

	sameMatches.forEach((match, matchIndex) => {
		const sport = match.sport
		delete match.sport

		let betsData = loadAndNormalizeBetsData(match, sport)

		let largestArrayLength = 0
		let largestArrayScraperName = ''

		Object.keys(betsData).forEach((scraperName) => {
			const currentBetsDataLength = betsData[scraperName].length

			if (currentBetsDataLength > largestArrayLength) {
				largestArrayLength = currentBetsDataLength
				largestArrayScraperName = scraperName
			}
		})

		const largestScraperBets = betsData[largestArrayScraperName]

		let bets = []

		largestScraperBets.forEach((betToFind, betIndex) => {
			let tempResult = []

			Object.keys(betsData).forEach((scraperName) => {
				if (scraperName === largestArrayScraperName) {
					return
				}

				const currentScraperBets = betsData[scraperName]

				currentScraperBets.forEach((bet) => {
					// TODO odstranit a presunut vsetko do checkIsSame
					const hasSimilarName =
						betToFind.name.filter((namePart) =>
							bet.name.includes(namePart)
						).length > Math.min(betToFind.name.length - 1) &&
						betToFind.name.length === bet.name.length

					const isSame = checkIsSame(betToFind.name, bet.name)

					if (hasSimilarName || isSame) {
						if (!tempResult.length) {
							tempResult.push({
								[largestArrayScraperName]: {
									id: betToFind.id,
									name: betToFind.originalName,
								},
							})

							totalFoundScraperBetsCount++
						}

						tempResult.push({
							[scraperName]: {
								id: bet.id,
								name: bet.originalName,
							},
						})

						totalFoundScraperBetsCount++
					}
				})
			})

			if (tempResult.length) {
				const result = {}

				tempResult.forEach((r) => {
					result[Object.keys(r)[0]] = r[Object.keys(r)[0]]
				})

				bets.push(result)
				totalFoundBetsCount++
			}
		})

		if (bets.length) {
			sameBets.push({
				...match,
				sport,
				bets,
			})

			totalFoundMatchesCount++
		}
	})

	fs.writeFileSync(
		`${BASE_DATA_FOLDER_PATH}/same-bets.json`,
		JSON.stringify(sameBets, null, 3)
	)

	log(
		`...found ${totalFoundBetsCount} same bets (${totalFoundScraperBetsCount} total unique entries) in ${totalFoundMatchesCount} matches in ${Math.round(
			performance.now() - now
		)}ms`,
		true
	)
}
