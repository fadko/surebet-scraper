import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

puppeteer.use(StealthPlugin())

export const initBrowser = async () => {
	const browser = await puppeteer.launch({
		devtools: false,
		headless: process.env.HEADLESS_BROWSER === 'true',
		args: [
			'--window-size=1512,908',
			'--disable-blink-features=AutomationControlled',
		],
		defaultViewport: {
			width: 1512,
			height: 773,
		},
	})

	return browser
}
