
import * as React from 'react';

import { type SxProps } from '@mui/system';
import { type Theme, alpha } from '@mui/material/styles';

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
		const buttonStyle: SxProps<Theme> = {
			paddingX: '10px',
			borderRadius: '8px'
		};

		if (props.color != null) {
			if (props.contained) {
				buttonStyle.backgroundColor = `${props.color}.main`;
				buttonStyle.color = `${props.color}.contrastText`;
				buttonStyle['&:hover'] = {
					backgroundColor: `${props.color}.dark`
				};
			} else {
				buttonStyle.color = `${props.color}.main`;
				buttonStyle['&:hover'] = {
					backgroundColor: alpha(
						theme.palette[props.color].main,
						theme.palette.action.hoverOpacity
					)
				};
			}
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
