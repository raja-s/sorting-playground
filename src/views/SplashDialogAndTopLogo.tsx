
import { useEffect, useState } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import Slide from '@mui/material/Slide';

import MenuBookIcon from '@mui/icons-material/MenuBook';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

import { useTranslation } from 'react-i18next';

import DynamicLogo from './logo/DynamicLogo.tsx';

import githubLogoUrl from '../assets/github-logo.svg';

export type SplashDialogAndTopLogoProps = {
	onGuidedTourButtonClick: () => void
};

type TopLogoState = {
	isOpen: boolean,
	counter: number
};

const SPLASH_DIALOG_STORAGE_KEY = 'splash_dialog_recently_shown';
const SPLASH_DIALOG_TIMEOUT = 2 * 60 * 60 * 1000;

const LOGO_SLIDE_DELAY = 200;
const LOGO_SLIDE_DURATION = 200;

export default function SplashDialogAndTopLogo(props: SplashDialogAndTopLogoProps) {
	const translate = useTranslation().t;

	const [ splashDialogIsOpen, setSplashDialogIsOpen ] =
		useState<boolean>(() => checkAndRefreshSplashDialogTimeout());
	const [ topLogoState, setTopLogoState ] = useState<TopLogoState>({
		isOpen: false,
		counter: 0
	});

	useEffect(() => {
		const identifier = setTimeout(() => {
			setTopLogoState(previousState => ({
				isOpen: !splashDialogIsOpen,
				counter: splashDialogIsOpen ?
					previousState.counter : previousState.counter + 1
			}));
		}, splashDialogIsOpen ? 0 : LOGO_SLIDE_DELAY);

		return () => { clearTimeout(identifier); };
	}, [ splashDialogIsOpen ]);

	return (
		<>
			<Slide
				in={topLogoState.isOpen}
				timeout={LOGO_SLIDE_DURATION}
				onEnter={node => {
					node.style.transitionDelay = '1000ms';
				}}
				onExit={node => {
					node.style.transitionDelay = '0ms';
				}}
			>
				<Box
					sx={{
						position: 'fixed',
						top: '10px',
						left: 0,
						right: 0,
						marginLeft: 'auto',
						marginRight: 'auto',
						width: 'max-content',
						padding: '8px 20px',
						borderRadius: '15px',
						background: 'linear-gradient(90deg, #f8faff 0%, #ffffff 100%)',
						cursor: 'pointer'
					}}
					onClick={() => { setSplashDialogIsOpen(true); }}
				>
					<DynamicLogo
						key={topLogoState.counter}
						fontSize='1.5rem'
					/>
				</Box>
			</Slide>
			<Dialog
				fullWidth
				maxWidth='md'
				open={splashDialogIsOpen}
				slotProps={{
					paper: {
						sx: {
							borderRadius: '30px',
							paddingTop: 5,
							paddingBottom: 1,
							backgroundColor: '#f8faff'
						}
					}
				}}
			>
				<DialogContent>
					<DialogContentText
						fontSize='1.5rem'
						sx={{ textAlign: 'center' }}
					>{translate('splash_dialog.welcome_message')}</DialogContentText>
					<Box
						padding={6}
						textAlign='center'
					>
						<DynamicLogo
							fontSize='3rem'
							reanimateOnClick
						/>
					</Box>
					<DialogContentText
						paddingX={8}
						paddingBottom={2}
						textAlign='center'
						fontSize='1.5rem'
					>{translate('splash_dialog.presentation_message')}</DialogContentText>
					<DialogContentText
						paddingX={8}
						textAlign='center'
						fontSize='1rem'
						sx={{ opacity: 0.5 }}
					>{translate('splash_dialog.disclaimer_message')}</DialogContentText>
				</DialogContent>
				<DialogActions
					sx={{
						paddingBottom: 3,
						justifyContent: 'center',
						gap: 4
					}}
				>
					<Button
						endIcon={<MenuBookIcon />}
						onClick={() => {
							setSplashDialogIsOpen(false);
							props.onGuidedTourButtonClick();
						}}
					>{translate('splash_dialog.guided_tour_button')}</Button>
					<Button
						variant='contained'
						endIcon={<PlayArrowIcon />}
						onClick={() => { setSplashDialogIsOpen(false); }}
					>{translate('splash_dialog.playground_button')}</Button>
				</DialogActions>
				<Box textAlign='center'>
					<a href='https://github.com/raja-s/sorting-playground'>
						<Box
							component='img'
							width='35px'
							src={githubLogoUrl}
							sx={{
								opacity: 0.1,
								'&:hover': { opacity: 0.25 },
								transition: 'opacity 0.2s'
							}}
						/>
					</a>
				</Box>
			</Dialog>
		</>
	);
}

function checkAndRefreshSplashDialogTimeout(): boolean {
	const now = Date.now();
	const expiryString = localStorage.getItem(SPLASH_DIALOG_STORAGE_KEY);

	const showSplashDialog =
		expiryString == null || now >= parseInt(expiryString, 10);

	const newExpiryTime = now + SPLASH_DIALOG_TIMEOUT;
	localStorage.setItem(SPLASH_DIALOG_STORAGE_KEY, newExpiryTime.toString());

	return showSplashDialog;
}
