import fs from 'fs'

const BASE_DATA_FOLDER_PATH = process.cwd() + '/data'

const getMatchData = (scraperName, sportName, matchId) => {
	const rawData = fs.readFileSync(
		`${BASE_DATA_FOLDER_PATH}/${scraperName}/${sportName}.json`,
		'utf-8'
	)
	const data = JSON.parse(rawData)

	return data.find((m) => m.id === matchId)
}

export const findSureBets = () => {
	const now = performance.now()
	console.log('looking for sure bets...')

	const rawData = fs.readFileSync(
		`${BASE_DATA_FOLDER_PATH}/opposite-bet-options.json`,
		'utf-8'
	)
	const data = JSON.parse(rawData)

	const result = []
	let totalSureBetsCount = 0

	Object.keys(data).forEach((sport) => {
		data[sport].forEach((oppositeBets) => {
			const scraperNames = Object.keys(oppositeBets)
			const value1 = oppositeBets[scraperNames[0]].value
			const value2 = oppositeBets[scraperNames[1]].value
			const arbRatio = 1 / value1 + 1 / value2

			if (arbRatio >= 1) {
				return
			}

			const totalBet = 100
			const distributedBets = {
				[scraperNames[0]]: +Number(totalBet / (value1 * arbRatio)).toFixed(
					2
				),
				[scraperNames[1]]: +Number(totalBet / (value2 * arbRatio)).toFixed(
					2
				),
			}
			const profit = {
				[scraperNames[0]]: +Number(
					+distributedBets[[scraperNames[0]]] * value1 - totalBet
				).toFixed(2),
				[scraperNames[1]]: +Number(
					+distributedBets[[scraperNames[1]]] * value2 - totalBet
				).toFixed(2),
			}
			const profitPercent =
				Math.min(
					(distributedBets[[scraperNames[0]]] * value1 - totalBet) /
						totalBet,
					(distributedBets[[scraperNames[1]]] * value2 - totalBet) /
						totalBet
				) * 100

			const matchData1 = getMatchData(
				scraperNames[0],
				sport,
				oppositeBets[scraperNames[0]].matchId
			)

			let betData1 = matchData1.bets.find(
				(b) => b.id === oppositeBets[scraperNames[0]].bet.id
			)

			delete betData1.options
			delete matchData1.bets

			const matchData2 = getMatchData(
				scraperNames[1],
				sport,
				oppositeBets[scraperNames[1]].matchId
			)

			let betData2 = matchData2.bets.find(
				(b) => b.id === oppositeBets[scraperNames[1]].bet.id
			)

			delete betData2.options
			delete matchData2.bets

			result.push({
				profitPercent,
				bets: [
					{
						company: scraperNames[0],
						value: value1,
						profit: profit[scraperNames[0]],
						bet: {
							name: betData1.name,
							optionName: oppositeBets[scraperNames[0]].name,
						},
						match: matchData1,
					},
					{
						company: scraperNames[1],
						value: value2,
						profit: profit[scraperNames[1]],
						bet: {
							name: betData2.name,
							optionName: oppositeBets[scraperNames[1]].name,
						},
						match: matchData2,
					},
				],
			})

			totalSureBetsCount++
		})
	})

	fs.writeFileSync(
		`${BASE_DATA_FOLDER_PATH}/sure-bets.json`,
		JSON.stringify(result, null, 3)
	)

	console.log(
		`...found ${totalSureBetsCount} sure bets in ${Math.round(
			performance.now() - now
		)}ms`
	)
}
