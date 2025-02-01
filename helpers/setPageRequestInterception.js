const blockedResourceType = [
	'beacon',
	'csp_report',
	'font',
	'image',
	'imageset',
	'media',
	'object',
	'texttrack',
]

const blockResourceName = [
	'adition',
	'adzerk',
	'analytics',
	'cdn.api.twitter',
	'clicksor',
	'clicktale',
	'doubleclick',
	'exelator',
	'facebook',
	'fontawesome',
	'google',
	'google-analytics',
	'googletagmanager',
	'mixpanel',
	'optimizely',
	'quantserve',
	'sharethrough',
	'tiqcdn',
	'zedo',
]

export const setPageRequestInterception = async (page) => {
	await page.setRequestInterception(true)

	page.on('request', (request) => {
		const requestUrl = request.url().split('?')[0]

		if (
			request.resourceType() in blockedResourceType ||
			blockResourceName.some((resource) => requestUrl.includes(resource))
		) {
			request.abort()
		} else {
			request.continue()
		}
	})
}
