import fs from 'fs'
import { log } from '../helpers/logger.js'

const BASE_DATA_FOLDER_PATH = process.cwd() + '/data'

const loadBetsData = (match, sport) => {
	let result = {}

	Object.keys(match).forEach((scraperName) => {
		const filePath = `${BASE_DATA_FOLDER_PATH}/${scraperName}/${sport}-normalized.json`
		const rawData = fs.readFileSync(filePath, 'utf-8')
		const data = JSON.parse(rawData)
		const betsData = data.find((m) => m.id === match[scraperName].id).bets
		const normalizedBetsData = betsData.map((bet) => {
			return {
				id: bet.id,
				name: bet.nameNormalized,
				originalName: bet.name,
			}
		})

		result[scraperName] = normalizedBetsData
	})

	return result
}

const checkIsSame = (name1, name2) => {
	if (name1 === name2) {
		return true
	}

	const splittedName1 = name1.split(' ')
	const splittedName2 = name2.split(' ')
	const longestNameLength = Math.max(
		splittedName1.length,
		splittedName2.length
	)

	let foundNamePartsCount = 0

	splittedName1.forEach((name1Word) => {
		if (name1Word.length < 2) {
			return
		}

		splittedName2.forEach((name2Word) => {
			if (name2Word.length < 2) {
				return
			}

			if (name1Word === name2Word) {
				foundNamePartsCount++
			}
		})
	})

	const foundWordsRatio = foundNamePartsCount / longestNameLength

	return foundWordsRatio >= 0.8
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

	sameMatches.forEach((match) => {
		const sport = match.sport
		delete match.sport

		let betsData = loadBetsData(match, sport)

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

		largestScraperBets.forEach((betToFind) => {
			let tempResult = []

			Object.keys(betsData).forEach((scraperName) => {
				if (scraperName === largestArrayScraperName) {
					return
				}

				const currentScraperBets = betsData[scraperName]

				currentScraperBets.forEach((bet) => {
					const isSame = checkIsSame(betToFind.name, bet.name)

					if (isSame) {
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

	const durationMs = Math.round(performance.now() - now)
	const durationString =
		durationMs > 10000
			? `${Math.round(durationMs / 1000)} seconds`
			: `${durationMs}ms`

	log(
		`...found ${totalFoundBetsCount} same bets (${totalFoundScraperBetsCount} total unique entries) in ${totalFoundMatchesCount} matches in ${durationString}`,
		true
	)
}
