import fs from 'fs'
import { log } from '../helpers/logger.js'
import { isTeamSport } from '../helpers/isTeamSport.js'
import { removeTeamsCommonWords } from '../helpers/removeTeamsCommonWords.js'

const BASE_DATA_FOLDER_PATH = process.cwd() + '/data'

const loadData = () => {
	const trackedSports = process.env.TRACKED_SPORTS?.split(',')
	const enabledScrapers = process.env.ENABLED_SCRAPERS?.split(',')

	let result = {}

	trackedSports?.forEach((sportName) => {
		result[sportName] = {}

		enabledScrapers?.map((scraperName) => {
			const filePath = `${BASE_DATA_FOLDER_PATH}/${scraperName}/${sportName}-normalized.json`

			if (!fs.existsSync(filePath)) {
				return
			}

			try {
				const rawData = fs.readFileSync(filePath, 'utf-8')
				const data = JSON.parse(rawData)
				const filteredData = data.filter((match) => {
					delete match.bets
					return match.startsAtTs > Date.now()
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

const isSameTeam = (name1, name2, teamSport) => {
	if (name1 === name2) {
		return true
	}

	if (!name1 === !name2) {
		if (teamSport) {
			;[name1, name2] = removeTeamsCommonWords(name1, name2)
		}

		const name1Splitted = name1.split(' ')
		const name2Splitted = name2.split(' ')
		const longestWordsCount = Math.max(
			name1Splitted.length,
			name2Splitted.length
		)

		let foundWordMatchesCount = 0

		name1Splitted.forEach((team1Word) => {
			name2Splitted.forEach((team2Word) => {
				if (team1Word === team2Word) {
					foundWordMatchesCount++
				}
			})
		})

		return foundWordMatchesCount / longestWordsCount > 0.5
	}

	return false
}

const haveTeamsSimilarNames = (match1, match2, teamSport) => {
	const match1Teams = match1.teamNames
	const match2Teams = match2.teamNames

	if (match1Teams.length !== match2Teams.length) {
		return { result: false, oppositeTeams: false }
	}

	if (match1Teams.length > 2) {
		return { result: false, oppositeTeams: false }
	}

	if (
		match1Teams.length === 1 &&
		isSameTeam(match1Teams[0], match2Teams[0], teamSport)
	) {
		return { result: true, oppositeTeams: false }
	}

	if (
		isSameTeam(match1Teams[0], match2Teams[0], teamSport) &&
		isSameTeam(match1Teams[1], match2Teams[1], teamSport)
	) {
		return { result: true, oppositeTeams: false }
	}

	if (
		isSameTeam(match1Teams[0], match2Teams[1], teamSport) &&
		isSameTeam(match1Teams[1], match2Teams[0], teamSport)
	) {
		return { result: true, oppositeTeams: true }
	}

	return { result: false, oppositeTeams: false }
}

const findMatches = (data) => {
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

		if (!largestScraperMatches?.length) {
			return
		}

		largestScraperMatches.forEach((matchToFind) => {
			const foundMatchScrapers = []

			Object.keys(data[sport]).forEach((scraperName) => {
				if (scraperName === largestArrayScraperName) {
					return
				}

				const currentScraperMatches = data[sport][scraperName]
				const teamSport = isTeamSport(sport)

				currentScraperMatches.forEach((match) => {
					const haveSimilarNames = haveTeamsSimilarNames(
						match,
						matchToFind,
						teamSport
					)
					const timeDiff = Math.abs(
						matchToFind.startsAtTs - match.startsAtTs
					)
					// one hour
					const maxTimeDiff = 1 * 60 * 60 * 1000

					if (haveSimilarNames.result && timeDiff <= maxTimeDiff) {
						if (!foundMatchScrapers.length) {
							foundMatchScrapers.push({
								[largestArrayScraperName]: {
									id: matchToFind.id,
									name: matchToFind.name,
									oppositeTeams: false,
								},
							})
						}

						foundMatchScrapers.push({
							[scraperName]: {
								id: match.id,
								name: match.name,
								oppositeTeams: haveSimilarNames.oppositeTeams,
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
