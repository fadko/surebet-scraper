import fs from 'fs'

const BASE_DATA_FOLDER_PATH = process.cwd() + '/data'

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
			}
		})

		result[scraperName] = normalizedBetsData
	})

	return result
}

export const findSameBets = () => {
	const now = performance.now()
	console.log('looking for the same bets...')

	const rawData = fs.readFileSync(
		BASE_DATA_FOLDER_PATH + '/same-matches.json',
		'utf-8'
	)
	const sameMatches = JSON.parse(rawData)
	const sameBets = []
	let totalFoundBetsCount = 0

	sameMatches.forEach((match) => {
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

		largestScraperBets.forEach((betToFind) => {
			Object.keys(betsData).forEach((scraperName) => {
				if (scraperName === largestArrayScraperName) {
					return
				}

				const currentScraperBets = betsData[scraperName]

				currentScraperBets.forEach((bet) => {
					const hasSimilarName =
						betToFind.name.filter((namePart) =>
							bet.name.includes(namePart)
						).length > Math.min(betToFind.name.length - 1) &&
						betToFind.name.length === bet.name.length

					if (hasSimilarName) {
						bets.push({
							[scraperName]: bet.id,
							[largestArrayScraperName]: betToFind.id,
						})
					}
				})
			})
		})

		if (bets.length) {
			sameBets.push({
				...match,
				sport,
				bets,
			})

			totalFoundBetsCount++
		}
	})

	fs.writeFileSync(
		`${BASE_DATA_FOLDER_PATH}/same-bets.json`,
		JSON.stringify(sameBets, null, 3)
	)

	console.log(
		`...found ${totalFoundBetsCount} bets in ${Math.round(
			performance.now() - now
		)}ms`
	)
}
