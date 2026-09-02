
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';

import { Trans } from 'react-i18next';

export type AnnotationExplanationProps = {
	annotationContent: string,
	translationKey: string,
	shortAnnotation?: boolean
}

export default function AnnotationExplanationLine(props: AnnotationExplanationProps) {
	return (
		<Grid container>
			<Grid
				size={props.shortAnnotation ? 2 : 3}
				display='flex'
				alignItems='center'
				justifyContent='center'
			>
				<Typography
					fontFamily='"JetBrains Mono", monospace'
					fontSize='2rem'
					color='primary'
					textAlign='center'
				>#{props.annotationContent}#</Typography>
			</Grid>
			<Grid
				size={props.shortAnnotation ? 10 : 9}
				display='flex'
				alignItems='center'
			>
				<Typography
					fontSize='1.2rem'
					color='secondary'
				>
					<Trans
						i18nKey={props.translationKey}
						components={{
							name: (
								<Box
									component='b'
									sx={{ color: 'primary.main' }}
								/>
							),
							break: (
								<Box
									component='span'
									sx={{
										display: 'block',
										marginTop: '8px'
									}}
								/>
							),
							code: (
								<Box
									component='code'
									sx={{
										fontFamily: '"JetBrains Mono", monospace',
										color: 'primary.main'
									}}
								/>
							)
						}}
					/>
				</Typography>
			</Grid>
		</Grid>
	);
}
