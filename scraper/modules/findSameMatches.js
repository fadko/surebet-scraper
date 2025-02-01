import fs from 'fs'
import { log } from '../helpers/logger.js'

const BASE_DATA_FOLDER_PATH = process.cwd() + '/scraper/data'

const filterMatchData = (match) => {
	return match.startsAtTs > Date.now()
}

const formatMatchesData = (data) => {
	return data.map((match) => {
		delete match.bets

		match.nameSplitted = match.name
			.toLowerCase()
			.normalize('NFD')
			.replaceAll('. ', ' ')
			.replaceAll('.', ' ')
			.replaceAll(',', '')
			.replaceAll(' / ', ' ')
			.replaceAll('/', ' ')
			.replace(/[\u0300-\u036f]/g, '')
			.split(' ')
			.filter((namePart) => namePart.length > 2)

		return match
	})
}

const loadData = () => {
	const trackedSports = process.env.TRACKED_SPORTS?.split(',')
	const enabledScrapers = process.env.ENABLED_SCRAPERS?.split(',')

	let result = {}

	trackedSports?.forEach((sportName) => {
		result[sportName] = {}

		enabledScrapers?.map((scraperName) => {
			const filePath = `${BASE_DATA_FOLDER_PATH}/${scraperName}/${sportName}.json`

			try {
				const rawData = fs.readFileSync(filePath, 'utf-8')
				const data = JSON.parse(rawData)
				const formattedData = formatMatchesData(data)

				const filteredData = formattedData.filter((match) => {
					return filterMatchData(match)
				})

				result[sportName][scraperName] = filteredData
			} catch (err) {
				log(
					`failed to load ${scraperName} ${sportName} data - ${err}`,
					false,
					'error'
				)
			}
		})
	})

	return result
}

const findMatches = (data) => {
	const bannedTeamWords = process.env.BANNED_TEAM_WORDS?.split(',') || []

	let foundMatches = []
	let totalMatches = 0

	const sports = Object.keys(data)

	sports.forEach((sport) => {
		const scraperNames = Object.keys(data[sport])

		// find scraper file with the most entries
		let largestArrayLength = 0
		let largestArrayScraperName = scraperNames[0]

		Object.keys(data[sport]).forEach((scraperName) => {
			if (data[sport][scraperName].length > largestArrayLength) {
				largestArrayLength = data[sport][scraperName].length
				largestArrayScraperName = scraperName
			}
		})

		totalMatches += largestArrayLength

		const largestScraperMatches = data[sport][largestArrayScraperName]

		largestScraperMatches.forEach((matchToFind) => {
			const foundMatchScrapers = []

			Object.keys(data[sport]).forEach((scraperName) => {
				if (scraperName === largestArrayScraperName) {
					return
				}

				const currentScraperMatches = data[sport][scraperName]

				currentScraperMatches.forEach((match) => {
					const hasSimilarName =
						matchToFind.nameSplitted.filter(
							(namePart) =>
								match.nameSplitted.includes(namePart) &&
								!bannedTeamWords.includes(namePart)
						).length > 1
					const timeDiff = Math.abs(
						matchToFind.startsAtTs - match.startsAtTs
					)
					// one hour
					const maxTimeDiff = 1 * 60 * 60 * 1000

					if (hasSimilarName && timeDiff <= maxTimeDiff) {
						if (!foundMatchScrapers.length) {
							foundMatchScrapers.push({
								[largestArrayScraperName]: {
									id: matchToFind.id,
									name: matchToFind.name,
								},
							})
						}

						foundMatchScrapers.push({
							[scraperName]: {
								id: match.id,
								name: match.name,
							},
						})
					}
				})
			})

			if (foundMatchScrapers.length) {
				const res = {
					sport,
				}

				foundMatchScrapers.forEach((m) => {
					res[Object.keys(m)[0]] = m[Object.keys(m)[0]]
				})

				foundMatches.push(res)
			}
		})
	})

	return {
		foundMatches,
		totalMatches,
	}
}

export const findSameMatches = () => {
	const now = performance.now()
	log('looking for the same matches...')

	const data = loadData()
	const { foundMatches, totalMatches } = findMatches(data)

	fs.writeFileSync(
		`${BASE_DATA_FOLDER_PATH}/same-matches.json`,
		JSON.stringify(foundMatches, null, 3)
	)

	log(
		`...found ${
			foundMatches.length
		} from total ${totalMatches} matches in ${Math.round(
			performance.now() - now
		)}ms`,
		true
	)
}
