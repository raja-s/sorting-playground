
import * as React from 'react';

import { type SxProps } from '@mui/system';
import { type PaletteColor, type Theme, alpha } from '@mui/material/styles';

import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

type ControlIconButtonProps = {
	contained?: boolean,
	color?: string,
	tooltipTitle: string,
	disabled?: boolean,
	onClick: (() => void),
	children: React.JSX.Element
};

export function ControlIconButton(props: ControlIconButtonProps) {
	const sxProps: SxProps<Theme> = (theme: Theme) => {
		const themeColor: PaletteColor | null =
			props.color != null ? theme.palette[props.color] : null;

		const buttonStyle: SxProps<Theme> = {
			paddingX: '10px',
			borderRadius: '8px',
			minHeight: '55px',
			minWidth: '55px'
		};

		if (themeColor == null) {
			return buttonStyle;
		}

		if (props.contained) {
			buttonStyle.backgroundColor = themeColor.main;
			buttonStyle.color = themeColor.contrastText;
			buttonStyle['&:hover'] = {
				backgroundColor: themeColor.dark
			};
		} else {
			buttonStyle.color = themeColor.main;
			buttonStyle['&:hover'] = {
				backgroundColor: alpha(
					themeColor.main,
					theme.palette.action.hoverOpacity
				)
			};
		}

		return buttonStyle;
	};

	return (
		<Tooltip title={props.tooltipTitle}>
			<span>
				<IconButton
					sx={sxProps}
					disabled={props.disabled}
					onClick={props.onClick}
				>
					{props.children}
				</IconButton>
			</span>
		</Tooltip>
	);
}
