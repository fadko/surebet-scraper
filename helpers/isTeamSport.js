export const isTeamSport = (sport) => {
	return !['tenis', 'stolny tenis', 'box', 'golf', 'squash', 'sipky'].includes(
		sport
	)
}
