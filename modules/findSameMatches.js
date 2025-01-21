import fs from 'fs'

const BASE_DATA_FOLDER_PATH = process.cwd() + '/data'

const loadData = () => {
	const trackedSports = process.env.TRACKED_SPORTS?.split(',')
	const enabledScrapers = process.env.ENABLED_SCRAPERS?.split(',')

	let result = {}

	trackedSports?.forEach((sportName) => {
		result[sportName] = {}

		enabledScrapers?.map((scraperName) => {
			const filePath = `${BASE_DATA_FOLDER_PATH}/${scraperName}/${sportName}.json`
			const rawData = fs.readFileSync(filePath, 'utf-8')
			const formattedData = JSON.parse(rawData).map((event) => {
				delete event.bets
				return event
			})

			result[sportName][scraperName] = formattedData
		})
	})

	return result
}

export const findSameMatches = () => {
	const now = performance.now()
	console.log('looking for the same matches...')

	const data = loadData()

	console.log(
		`...same matches found in ${Math.round(performance.now() - now)}ms`
	)
}
