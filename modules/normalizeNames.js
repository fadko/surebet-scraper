import fs from 'fs'
import { log } from '../helpers/logger.js'

const BASE_DATA_FOLDER_PATH = process.cwd() + '/data'

const teamNamesLabels = ['ž', 'u18', 'u20', 'jun']

const getTeamNames = (matchName) => {
	const lowerCased = matchName.toLowerCase()
	let charsReplaced = lowerCased
		.replaceAll(',', ' ')
		.replaceAll('.', ' ')
		.trim()

	while (charsReplaced.includes('  ')) {
		charsReplaced = charsReplaced.replace('  ', ' ')
	}

	const splitted = charsReplaced.replace(' vs ', ' - ').split(' - ')

	let teamLabels = []

	teamNamesLabels.forEach((label) => {
		if (
			splitted.every((team) =>
				team.normalize('NFD').split(' ').includes(label.normalize('NFD'))
			)
		) {
			teamLabels.push(label)
		}
	})

	const teamNames = splitted.map((team) => {
		team = team.normalize('NFD')

		teamNamesLabels.forEach((l) => {
			if (team.includes(l.normalize('NFD'))) {
				team = team.replace(l.normalize('NFD'), '')
			}
		})

		team = team
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/[^\p{L}\p{N}]/gu, ' ')
			.trim()

		while (team.includes('  ')) {
			team = team.replace('  ', ' ')
		}

		return team
	})

	const result = {
		teamNames,
		teamLabels,
	}

	return result
}

const normalizeBetName = (betName, teamNames, isOption = false) => {
	betName = betName
		.toLowerCase()
		.replaceAll(',', ' ')
		.replace(/(?<!\d)\.(?!\d)/g, ' ')
		.replaceAll('  ', ' ')
		.normalize('NFD')

	teamNamesLabels.forEach((l) => {
		if (betName.includes(l.normalize('NFD'))) {
			betName = betName.replaceAll(l.normalize('NFD'), '')
		}
	})

	betName = betName
		.replace(/[\u0300-\u036f]/g, '')
		.replace(
			isOption
				? /(?![+-]\d|(?<=\d)\.(?=\d))[^\p{L}\p{N}.+-]/gu
				: /[^\p{L}\p{N}]/gu,
			' '
		)
		.trim()

	while (betName.includes('  ')) {
		betName = betName.replaceAll('  ', ' ')
	}

	teamNames.forEach((teamName, index) => {
		betName = betName.replaceAll(teamName, `{team${index + 1}}`)
	})

	if (betName === 'zapas') {
		betName = '{matchResult}'
	}

	betName = betName
		.replaceAll('vysledok zapasu', '{matchResult}')
		.replaceAll('presny vysledok', '{exactResult}')
		.replaceAll('vysledok', '{result}')
		.replaceAll('pocet golov v zapase', '{matchGoalsCount}')
		.replaceAll('celkovy pocet golov', '{matchGoalsCount}')
		.replaceAll('pocet golov', '{goalsCount}')
		.replaceAll('stavka bez remizy', '{noDrawBet}')
		.replaceAll('bez remizy', '{noDrawBet}')
		.replaceAll('do rozhodnutia', '{untilDecision}')
		.replaceAll('da gol', '{scoresGoal}')
		.replaceAll('v kadej tretine', '{inEachThird}')
		.replaceAll('v kazdej tretine', '{inEachThird}')
		.replaceAll('v kadom polcase', '{inEachHalf}')
		.replaceAll('v kazdom polcase', '{inEachHalf}')
		.replaceAll('v zapase', '{inTheMatch}')
		.replaceAll('dvojtip', '{doubleBet}')
		.replaceAll('tim1', '{team1}')
		.replaceAll('tim 1', '{team1}')
		.replaceAll('1 tim', '{team1}')
		.replaceAll('tim2', '{team2}')
		.replaceAll('tim 2', '{team2}')
		.replaceAll('2 tim', '{team2}')
		.replaceAll('1 tretina', '{1stThird}')
		.replaceAll('2 tretina', '{2ndThird}')
		.replaceAll('3 tretina', '{3rdThird}')
		.replaceAll('1 tretiny', '{1stThird}')
		.replaceAll('2 tretiny', '{2ndThird}')
		.replaceAll('3 tretiny', '{3rdThird}')
		.replaceAll('1 polcas', '{1stHalf}')
		.replaceAll('2 polcas', '{2ndHalf}')
		.replaceAll('1 polcasu', '{1stHalf}')
		.replaceAll('2 polcasu', '{2ndHalf}')
		.replaceAll('alebo', '{or}')
		.replaceAll(' a ', ' {and} ')

	return betName
}

const normalizeBetOptions = (options, teamNames) => {
	const result = []

	options.forEach((option) => {
		result.push({
			...option,
			nameNormalized: normalizeBetName(option.name, teamNames, true),
		})
	})

	return result
}

const normalizeBets = (bets, teamNames) => {
	const result = []

	if (!bets) {
		return null
	}

	bets.forEach((bet) => {
		result.push({
			...bet,
			nameNormalized: normalizeBetName(bet.name, teamNames),
			options: normalizeBetOptions(bet.options, teamNames),
		})
	})

	return result
}

const normalizeSportData = (matches) => {
	const result = []

	matches.forEach((match) => {
		const teamNames = getTeamNames(match.name)
		const normalizedBets = normalizeBets(match.bets, teamNames.teamNames)

		if (normalizedBets) {
			result.push({
				...match,
				...teamNames,
				bets: normalizedBets,
			})
		}
	})

	return result
}

export const normalizeNames = () => {
	const now = performance.now()
	log('normalizing names...')

	let removedMatches = {}

	const enabledScrapers = process.env.ENABLED_SCRAPERS?.split(',')
	const trackedSports = process.env.TRACKED_SPORTS?.split(',')

	enabledScrapers?.forEach((scraper) => {
		removedMatches[scraper] = {}

		const scraperBaseDataPath = BASE_DATA_FOLDER_PATH + '/' + scraper

		trackedSports?.forEach((sport) => {
			const filePath = scraperBaseDataPath + '/' + sport + '.json'
			const rawData = fs.readFileSync(filePath, 'utf-8')
			const matchesData = JSON.parse(rawData)
			const result = normalizeSportData(matchesData).filter(
				(m) => !!m.bets.length
			)

			removedMatches[scraper][sport] = matchesData.length - result.length

			fs.writeFileSync(
				`${BASE_DATA_FOLDER_PATH}/${scraper}/${sport}-normalized.json`,
				JSON.stringify(result, null, 3)
			)
		})
	})

	Object.keys(removedMatches).forEach((scraper) => {
		Object.keys(removedMatches[scraper]).forEach((sport) => {
			if (removedMatches[scraper][sport] > 0) {
				log(
					`...removed ${removedMatches[scraper][sport]} match(es) with empty bets array from ${scraper} - ${sport}...`
				)
			}
		})
	})

	log(`...names normalized in ${Math.round(performance.now() - now)}ms`, true)
}
