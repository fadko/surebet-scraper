import { DateTime } from 'luxon'

/**
 *
 * @param {string} message
 * @param {boolean} addNewLine
 * @param {'info' | 'warn' | 'error'} level
 */
export const log = (message, addNewLine = false, level = 'info') => {
	const dateStr = DateTime.now().toFormat('dd.MM.yy HH:mm:ss')
	console[level](`[${dateStr}] ${message}`)

	if (addNewLine) {
		console.log('\n')
	}
}
