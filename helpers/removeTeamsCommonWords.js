/**
 *
 * @param {string} team1
 * @param {string} team2
 * @returns {[string, string]}
 */
export const removeTeamsCommonWords = (team1, team2) => {
	const team1Splitted = team1.split(' ')
	const team2Splitted = team2.split(' ')
	const commonWords = new Set(
		team1Splitted.filter((word) => team2Splitted.includes(word))
	)
	const filteredStr1 = team1Splitted
		.filter((word) => !commonWords.has(word))
		.join(' ')
	const filteredStr2 = team2Splitted
		.filter((word) => !commonWords.has(word))
		.join(' ')

	return [filteredStr1, filteredStr2]
}
