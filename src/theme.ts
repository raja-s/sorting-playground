
import { type PaletteOptions, type Palette, createTheme } from '@mui/material/styles';

declare module '@mui/material/styles' {
	interface Palette {
		run: Palette['primary'];
		pause: Palette['primary'];
		stop: Palette['primary'];
	}
	interface PaletteOptions {
		run?: PaletteOptions['primary'];
		pause?: PaletteOptions['primary'];
		stop?: PaletteOptions['primary'];
	}
}

declare module '@mui/material/Button' {
	interface ButtonPropsColorOverrides {
		run: true;
		pause: true;
		stop: true;
	}
}

const { palette } = createTheme();

export default createTheme({
	palette: {
		background: { default: '#fff' },
		primary: { main: '#18a85e' },
		secondary: { main: '#757575' },
		run: palette.augmentColor({
			color: { main: '#30d23a', contrastText: '#fff' },
			name: 'run'
		}),
		pause: palette.augmentColor({
			color: { main: '#d83240' },
			name: 'pause'
		}),
		stop: palette.augmentColor({
			color: { main: '#d83240', contrastText: '#fff' },
			name: 'stop'
		})
	},
	typography: {
		button: {
			fontSize: '1.5rem',
			textTransform: 'none'
		}
	},
	components: {
		MuiButton: {
			styleOverrides: {
				startIcon: {
					'& > *:first-of-type': {
						fontSize: '1.5rem'
					}
				},
				root: {
					paddingLeft: '16px',
					paddingRight: '16px'
				}
			}
		},
		MuiList: {
			styleOverrides: {
				root: {
					paddingTop: 0,
					paddingBottom: 0
				}
			}
		},
		MuiMenuItem: {
			styleOverrides: {
				root: {
					paddingTop: '12px',
					paddingBottom: '12px',
					fontSize: '1.2rem'
				}
			}
		},
		MuiSelect: {
			defaultProps: {
				disableUnderline: true
			},
			styleOverrides: {
				root: {
					borderRadius: '8px'
				},
				select: {
					display: 'flex',
					alignItems: 'center',
					paddingLeft: '16px',
					fontSize: '1.2rem'
				}
			}
		},
		MuiSlider: {
			styleOverrides: {
				valueLabel: {
					fontSize: '1.2rem',
					borderRadius: '8px'
				}
			}
		},
		MuiTooltip: {
			styleOverrides: {
				tooltip: {
					fontSize: '1.2rem'
				}
			}
		}
	},
	shape: {
		borderRadius: '8px'
	}
});

