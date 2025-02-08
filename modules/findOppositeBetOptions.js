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

const noDrawMap = [
	['1', '2'],
	['{team1}', '{team2}'],
	['1', '{team2}'],
	['2', '{team1}'],
	['{no}', '{yes}'],
]

const drawMap = [
	['1', 'x2'],
	['1', '02'],
	['1', 'neprehra {team2}'],
	['{team1}', 'x2'],
	['{team1}', '02'],
	['{team1}', 'neprehra {team2}'],
	['2', '1x'],
	['2', '10'],
	['2', 'neprehra {team1}'],
	['{team2}', '1x'],
	['{team2}', '10'],
	['{team2}', 'neprehra {team1}'],
]

const oppositeOptionsMap = (betOptionsCount1, betOptionsCount2) => {
	if (betOptionsCount1 !== betOptionsCount2) {
		return []
	}

	let foundArray = []
	let res = []

	if (betOptionsCount1 === 2) {
		foundArray = Array.from(noDrawMap)
	}

	if (betOptionsCount1 === 3 || betOptionsCount1 === 6) {
		foundArray = Array.from(drawMap)
	}

	res = Array.from(foundArray)

	foundArray.forEach((item) => {
		res.push(item.slice().reverse())
	})

	return res
}

const setOppositeTeamOption = (name) => {
	const oppositeTeamOptionsMap = {
		1: '2',
		2: '1',
		'{team1}': '{team2}',
		'{team2}': '{team1}',
		'1x': 'x2',
		x2: '1x',
		10: '02',
		'02': '10',
	}

	if (oppositeTeamOptionsMap[name]) {
		return oppositeTeamOptionsMap[name]
	} else {
		if (name.includes('{team1}') && name.includes('{team2}')) {
			return name
				.replaceAll('{team1}', '{tempTeam}')
				.replaceAll('{team2}', '{team1}')
				.replaceAll('{tempTeam}', '{team2}')
		}

		if (name.includes('{team1}')) {
			return name.replaceAll('{team1}', '{team2}')
		}

		if (name.includes('{team2}')) {
			return name.replaceAll('{team2}', '{team1}')
		}
	}

	return name
}

const foundInOptionsMap = (
	name1,
	name2,
	betOptionsCount1,
	betOptionsCount2,
	option1OppositeTeams,
	option2OppositeTeams
) => {
	if (option1OppositeTeams) {
		name1 = setOppositeTeamOption(name1)
	}

	if (option2OppositeTeams) {
		name2 = setOppositeTeamOption(name2)
	}

	if (!name1 || !name2) {
		return false
	}

	if (
		oppositeOptionsMap(betOptionsCount1, betOptionsCount2).some((options) => {
			return options[0] === name1 && options[1] === name2
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

	return false
}

const isOppositeOption = (
	option1,
	option2,
	betOptionsCount1,
	betOptionsCount2,
	option1OppositeTeams,
	option2OppositeTeams
) => {
	const hasOppositeTeams = option1OppositeTeams !== option2OppositeTeams
	const optionName1Normalized = option1.nameNormalized
	const optionName2Normalized = option2.nameNormalized

	if (!hasOppositeTeams && optionName1Normalized === optionName2Normalized) {
		return false
	}

	if (
		foundInOptionsMap(
			optionName1Normalized,
			optionName2Normalized,
			betOptionsCount1,
			betOptionsCount2,
			option1OppositeTeams,
			option2OppositeTeams
		)
	) {
		return true
	}

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
			let alreadyComparedScrapers = {}

			Object.keys(bet).forEach((currentScraperName) => {
				alreadyComparedScrapers[currentScraperName] = []

				// get options for scraper with most options
				const match = sportsData[sportName][currentScraperName].find(
					(m) => m.id === activeSameBetGroup[currentScraperName].id
				)
				const matchBet = match.bets.find(
					(b) => b.id === bet[currentScraperName].id
				)

				// compare with options from other scrapers
				matchBet.options.forEach((optionToFind) => {
					Object.keys(bet)
						.filter((scraperName) => scraperName !== currentScraperName)
						.forEach((scraperName) => {
							if (
								alreadyComparedScrapers[scraperName]?.includes(
									currentScraperName
								)
							) {
								return
							}

							alreadyComparedScrapers[currentScraperName].push(
								scraperName
							)

							const currentScraperMatch = sportsData[sportName][
								scraperName
							].find((m) => m.id === activeSameBetGroup[scraperName].id)
							const currentMatchBet = currentScraperMatch.bets.find(
								(b) => b.id === bet[scraperName].id
							)

							const option1OppositeTeams =
								activeSameBetGroup[scraperName].oppositeTeams
							const option2OppositeTeams =
								activeSameBetGroup[currentScraperName].oppositeTeams

							currentMatchBet.options.forEach((o) => {
								// TODO find profitable same bet option
								// if (o.name === optionToFind.name) {
								// 	console.log(o.value, optionToFind.value)
								// }

								if (
									isOppositeOption(
										o,
										optionToFind,
										currentMatchBet.options.length,
										matchBet.options.length,
										option1OppositeTeams,
										option2OppositeTeams
									)
								) {
									totalFoundBetOptionsCount++

									result[sportName].push({
										[currentScraperName]: {
											matchName:
												activeSameBetGroup[currentScraperName].name,
											matchId:
												activeSameBetGroup[currentScraperName].id,
											bet: bet[currentScraperName],
											...optionToFind,
										},
										[scraperName]: {
											matchName:
												activeSameBetGroup[scraperName].name,
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
