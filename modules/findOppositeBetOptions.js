// TODO stavka bez remizy?

import fs from 'fs'
import { log } from '../helpers/logger.js'

const BASE_DATA_FOLDER_PATH = process.cwd() + '/data'

const loadSportsData = (sports) => {
	const result = {}
	const enabledScrapers = process.env.ENABLED_SCRAPERS?.split(',')

	sports.forEach((sportName) => {
		result[sportName] = {}

		enabledScrapers?.forEach((scraperName) => {
			const filePath = `${BASE_DATA_FOLDER_PATH}/${scraperName}/${sportName}-normalized.json`
			let data

			try {
				const rawData = fs.readFileSync(filePath, 'utf-8')
				data = JSON.parse(rawData)
			} catch {
				return
			}

			result[sportName][scraperName] = data
		})
	})

	return result
}

const oppositeOptionsMap = [['{no}', '{yes}']]

const drawSportsBasicMap = [
	['1', 'x2'],
	['1', '02'],
	['{team1}', 'x2'],
	['{team1}', '02'],
	['2', '1x'],
	['2', '10'],
	['{team2}', '1x'],
	['{team2}', '10'],
]

const noDrawSportsBasicMap = [
	['1', '2'],
	['{team1}', '{team2}'],
	['1', '{team2}'],
	['2', '{team1}'],
]

const sportSpecificOptionsMap = {
	// sports with draw
	hokej: [...drawSportsBasicMap],
	futbal: [...drawSportsBasicMap],
	basketbal: [...drawSportsBasicMap],
	hadzana: [...drawSportsBasicMap],
	florbal: [...drawSportsBasicMap],
	rugby: [...drawSportsBasicMap],
	lakros: [...drawSportsBasicMap],
	'americky futbal': [...drawSportsBasicMap],
	// sports with no draw
	tenis: [...noDrawSportsBasicMap, ['2', '3']],
	box: [...noDrawSportsBasicMap],
	squash: [...noDrawSportsBasicMap],
	sipky: [...noDrawSportsBasicMap],
	'stolny tenis': [...noDrawSportsBasicMap],
}

const foundInOptionsMap = (name1, name2, sport, betName) => {
	if (
		oppositeOptionsMap.some((options) => {
			return (
				(options[0] === name1 && options[1] === name2) ||
				(options[0] === name2 && options[1] === name1)
			)
		})
	) {
		return true
	}

	if (
		sport in sportSpecificOptionsMap &&
		sportSpecificOptionsMap[sport].some((options) => {
			return (
				(options[0] === name1 && options[1] === name2) ||
				(options[0] === name2 && options[1] === name1)
			)
		})
	) {
		return true
	}

	const name1Splitted = name1.split(' ')
	const name2Splitted = name2.split(' ')

	if (name1Splitted.length === 2 && name2Splitted.length === 2) {
		if (name1Splitted[0] === name2Splitted[0]) {
			return false
		}

		if (name1Splitted[1] === name2Splitted[1]) {
			if (
				(name1Splitted[0] === '{over}' && name2Splitted[0] === '{under}') ||
				(name1Splitted[0] === '{under}' && name2Splitted[0] === '{over}')
			) {
				return true
			}
		} else {
			return false
		}
	}

	// console.log(betName)
	// console.log(name1)
	// console.log(name2)
	// console.log('\n')

	return false
}

const isOppositeOption = (
	option1,
	option2,
	matchName1,
	matchName2,
	betName,
	betNameNormalized,
	sportName
) => {
	const optionName1Normalized = option1.nameNormalized
	const optionName2Normalized = option2.nameNormalized

	if (optionName1Normalized === optionName2Normalized) {
		return false
	}

	if (
		foundInOptionsMap(
			optionName1Normalized,
			optionName2Normalized,
			sportName,
			betName
		)
	) {
		return true
	}

	// console.log(betName)
	// console.log(option1.name + ' | ' + option2.name)
	// console.log('\n')
	return false
}

export const findOppositeBetOptions = () => {
	const now = performance.now()
	log('looking for opposite bet options...')

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
				const matchBet = match.bets.find(
					(b) => b.id === bet[scraperName].id
				)
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
				(b) => b.id === bet[largestOptionsScraperName].id
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
						const currentMatchBet = currentScraperMatch.bets.find(
							(b) => b.id === bet[scraperName].id
						)

						currentMatchBet.options.forEach((o) => {
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
									currentMatchBet.name,
									currentMatchBet.nameNormalized,
									sportName
								)
							) {
								totalFoundBetOptionsCount++

								result[sportName].push({
									[largestOptionsScraperName]: {
										matchId:
											activeSameBetGroup[largestOptionsScraperName]
												.id,
										bet: bet[largestOptionsScraperName],
										...optionToFind,
									},
									[scraperName]: {
										matchId: activeSameBetGroup[scraperName].id,
										bet: bet[scraperName],
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

	log(
		`...found ${totalFoundBetOptionsCount} opposite bet options in ${Math.round(
			performance.now() - now
		)}ms`,
		true
	)
}
