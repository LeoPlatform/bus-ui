

export const setIsAuthenticated = (state) => {
	return {
		type: 'SET_IS_AUTHENTICATED',
		state: state
	}
}


export const setDisplayState = (state) => {
	return {
		type: 'SET_DISPLAY_STATE',
		state: state
	}
}


export const saveSettings = (settings, replace) => {
	//console.log("saveSettings", settings);
	//console.log("savesettingsReplace", replace);
	return {
		type: 'SAVE_SETTINGS',
		settings,
		replace: replace
	}
}
