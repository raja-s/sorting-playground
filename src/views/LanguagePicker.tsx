
import Box from '@mui/material/Box';

import { useTranslation } from 'react-i18next';

import { QUERY_STRING_LANGUAGE_PARAMETER_KEY } from '../i18n.ts';

import enUsFlag from '../assets/flags/en-us.svg';
import frFlag from '../assets/flags/fr.svg';

type Language = {
	code: string,
	flagSvg: string
};

const languages: Language[] = [
	{ code : 'en', flagSvg : enUsFlag },
	{ code : 'fr', flagSvg : frFlag }
];

export default function LanguagePicker() {
	const { i18n } = useTranslation();

	const currentLanguageCode: string = i18n.language;

	return (
		<Box
			position='relative'
			width='60px'
			height='60px'
			sx={{
				transition : 'height 0.2s',
				'&:hover' : {
					height : `${languages.length * 60}px`
				},
				'&:hover .flag-wrapper' : {
					top : 'calc(var(--flag-index) * 60px)'
				}
			}}
		>
			{languages.map((language: Language, index: number) =>
				<Box
					key={index}
					component='div'
					className='flag-wrapper'
					style={{
						'--flag-index' : index
					}}
					sx={{
						position : 'absolute',
						top : 0,
						right : 0,
						width : '54px',
						height : '54px',
						boxSizing : 'content-box',
						borderRadius : '30px',
						borderStyle : 'solid',
						borderWidth : '3px',
						borderColor : language.code === currentLanguageCode ?
							'primary.main' : 'transparent',
						backgroundColor : '#f8faff',
						cursor : 'pointer',
						zIndex : language.code === currentLanguageCode ? 1 : 0,
						transition : 'top 0.2s'
					}}
					onClick={() => {
						if (language.code !== currentLanguageCode) {
							changeLanguage(language.code);
						}
					}}
				>
					<img
						src={language.flagSvg}
						alt={language.code}
						style={{
							position : 'relative',
							top : '2px',
							left : '2px',
							height : '50px',
							width : '50px'
						}}
					/>
				</Box>
			)}
		</Box>
	);
}

function changeLanguage(languageCode: string): void {
	const searchParameters = new URLSearchParams(window.location.search);
	searchParameters.set(QUERY_STRING_LANGUAGE_PARAMETER_KEY, languageCode);

	window.location.href = `${window.location.pathname}?${searchParameters.toString()}`
}
