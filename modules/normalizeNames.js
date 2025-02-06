import fs from 'fs'
import { log } from '../helpers/logger.js'
import { removeTeamsCommonWords } from '../helpers/removeTeamsCommonWords.js'

const BASE_DATA_FOLDER_PATH = process.cwd() + '/data'

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

	const teamNames = splitted.map((team) => {
		team = team
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/[^\p{L}\p{N}]/gu, ' ')
			.trim()

		while (team.includes('  ')) {
			team = team.replace('  ', ' ')
		}

		return team
	})

	if (teamNames.length === 2) {
		const [filteredTeam1Name, filteredTeam2Name] = removeTeamsCommonWords(
			teamNames[0],
			teamNames[1]
		)
		teamNames[0] = filteredTeam1Name
		teamNames[1] = filteredTeam2Name
	}

	const result = {
		teamNames,
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

	if (['zapas', 'vitaz'].includes(betName.trim())) {
		betName = '{matchResult}'
	}

	if ([teamNames[0], '1'].includes(betName.trim())) {
		betName = '{team1}'
	}

	if (teamNames[1] && [teamNames[1], '2'].includes(betName.trim())) {
		betName = '{team2}'
	}

	if (['remiza', '0'].includes(betName.trim())) {
		betName = '{draw}'
	}

	if (betName === '10') {
		betName = '{team1DontLose}'
	}

	if (betName === '12') {
		betName = '{willNotBeDraw}'
	}

	if (betName === '02') {
		betName = '{team2DontLose}'
	}

	betName.replace(teamNames[0], '{team1}')

	if (teamNames.length === 2) {
		betName.replace(teamNames[1], '{team2}')
	}

	betName = betName
		.replaceAll('pocet golov v zapase', '{matchGoalsCount}')
		.replaceAll('presny vysledok zapasu', '{exactMatchResult}')
		.replaceAll('celkovy pocet bodov', '{pointsTotal}')
		.replaceAll('kazdy z timov', '{eachTeam}')
		.replaceAll('kazdy tim', '{eachTeam}')
		.replaceAll('presny pocet', '{exactCount}')
		.replaceAll('pocet bodov', '{pointsCount}')
		.replaceAll('body handicap', '{handicapPoints}')
		.replaceAll('celkovy pocet golov', '{matchGoalsCount}')
		.replaceAll('vysledok zapasu', '{matchResult}')
		.replaceAll('vitaz zapasu', '{matchResult}')
		.replaceAll('presny vysledok', '{exactResult}')
		.replaceAll('vysledok', '{result}')
		.replaceAll('pocet golov', '{goalsCount}')
		.replaceAll('stavka bez remizy', '{noDrawBet}')
		.replaceAll('bez remizy', '{noDrawBet}')
		.replaceAll('do rozhodnutia', '{untilDecision}')
		.replaceAll('vratane predlzenia', '{untilDecision}')
		.replaceAll('da gol', '{scoresGoal}')
		.replaceAll('sucet bodov', '{pointsTotal}')
		.replaceAll('v zapase', '{inTheMatch}')
		.replaceAll('viac ako', '{moreThan}')
		.replaceAll('menej ako', '{lessThan}')
		.replaceAll('v kadom polcase', '{inEachHalf}')
		.replaceAll('v kazdom polcase', '{inEachHalf}')
		.replaceAll('v prvom polcase', '{inFirstHalf}')
		.replaceAll('v druhom polcase', '{inSecondHalf}')
		.replaceAll('v prvej tretine', '{inFirstThird}')
		.replaceAll('v druhej tretine', '{inSecondThird}')
		.replaceAll('v tretej tretine', '{inThirdThird}')
		.replaceAll('v kazdej tretine', '{inEachThird}')
		.replaceAll('v kadej tretine', '{inEachThird}')
		.replaceAll('v kazdej tretine', '{inEachThird}')
		.replaceAll('v kadej stvrtine', '{inEachQuarter}')
		.replaceAll('v kazdej stvrtine', '{inEachQuarter}')
		.replaceAll('1 tretina', '{1stThird}')
		.replaceAll('1 tretine', '{1stThird}')
		.replaceAll('2 tretina', '{2ndThird}')
		.replaceAll('2 tretine', '{2ndThird}')
		.replaceAll('3 tretina', '{3rdThird}')
		.replaceAll('3 tretine', '{3rdThird}')
		.replaceAll('1 tretiny', '{1stThird}')
		.replaceAll('2 tretiny', '{2ndThird}')
		.replaceAll('3 tretiny', '{3rdThird}')
		.replaceAll('1 polcas', '{1stHalf}')
		.replaceAll('2 polcas', '{2ndHalf}')
		.replaceAll('1 polcasu', '{1stHalf}')
		.replaceAll('2 polcasu', '{2ndHalf}')
		.replaceAll('1 set', '{firstSet}')
		.replaceAll('1.set', '{firstSet}')
		.replaceAll('2 set', '{secondSet}')
		.replaceAll('2.set', '{secondSet}')
		.replaceAll('3 set', '{thirdSet}')
		.replaceAll('3.set', '{thirdSet}')
		.replaceAll('tim1', '{team1}')
		.replaceAll('tim 1', '{team1}')
		.replaceAll('1 tim', '{team1}')
		.replaceAll('tim2', '{team2}')
		.replaceAll('tim 2', '{team2}')
		.replaceAll('2 tim', '{team2}')
		.replaceAll('setov', '{sets}')
		.replaceAll('sety', '{sets}')
		.replaceAll('setu', '{set}')
		.replaceAll('set', '{set}')
		.replaceAll('gamov', '{gams}')
		.replaceAll('gamy', '{gams}')
		.replaceAll('gamu', '{gam}')
		.replaceAll('gam', '{gam}')
		.replaceAll('tretinach', '{thirds}')
		.replaceAll('tretine', '{third}')
		.replaceAll('tretinu', '{third}')
		.replaceAll('tretina', '{third}')
		.replaceAll('dvojtip', '{doubleBet}')
		.replaceAll('remiza', '{draw}')
		.replaceAll('nepar', '{odd}')
		.replaceAll('par', '{even}')
		.replaceAll('ano', '{yes}')
		.replaceAll('nie', '{no}')
		.replaceAll('nad', '{over}')
		.replaceAll('pod', '{under}')
		.replaceAll('alebo', '{or}')
		.replaceAll('vitaz', '{winner}')
		.replaceAll('rovnako', '{same}')
		.replaceAll('favorit', '{favourite}')
		.replaceAll('nikto', '{noOne}')
		.replaceAll('iny', '{other}')
		.replaceAll('presny', '{exact}')

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
