
import * as React from 'react';

import IconButton from '@mui/material/IconButton';
import Tooltip, { type TooltipProps } from '@mui/material/Tooltip';

import { useTranslation } from 'react-i18next';

export type TooltipIconButtonProps = {
	tooltipTranslationIdentifier: string,
	tooltipPlacement?: TooltipProps['placement'],
	disabled?: boolean,
	onClick: () => void,
	guidedTourTargetElementAttributeValue?: string,
	children: React.JSX.Element
};

export default function TooltipIconButton(props: TooltipIconButtonProps) {
	const translate = useTranslation().t;

	return (
		<Tooltip
			title={translate(props.tooltipTranslationIdentifier)}
			{...(props.tooltipPlacement != null ?
				{ placement : props.tooltipPlacement } : {})}
		>
			<span>
				<IconButton
					{...(props.guidedTourTargetElementAttributeValue != null ?
						{
							'data-guided-tour-target-element' :
								props.guidedTourTargetElementAttributeValue
						} : {})}
					disabled={props.disabled}
					onClick={() => { props.onClick(); }}
				>
					{props.children}
				</IconButton>
			</span>
		</Tooltip>
	);
}
