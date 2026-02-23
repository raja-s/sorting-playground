
import { type ExecutionState, useControlStore } from '../state/useControlStore.ts';

import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import DownloadIcon from '@mui/icons-material/Download';
import FolderIcon from '@mui/icons-material/Folder';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RedoIcon from '@mui/icons-material/Redo';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import ShareIcon from '@mui/icons-material/Share';
import StopIcon from '@mui/icons-material/Stop';
import UndoIcon from '@mui/icons-material/Undo';

import { useTranslation } from 'react-i18next';

import { ControlIconButton } from './ControlIconButton.tsx';

export function ControlBar() {
	const translate = useTranslation().t;

	const readyToExecuteCode = useControlStore(state => state.readyToExecuteCode);

	const executionHistory = useControlStore(state => state.executionHistory);
	const executionHistoryPosition: number = useControlStore(state => state.executionHistoryPosition);

	const executionSpeed: number = useControlStore(state => state.executionSpeed);
	const setExecutionSpeed = useControlStore(state => state.setExecutionSpeed);

	const executionState: ExecutionState = useControlStore(state => state.executionState);
	const runExecution = useControlStore(state => state.runExecution);
	const pauseExecution = useControlStore(state => state.pauseExecution);
	const stopExecution = useControlStore(state => state.stopExecution);
	const resetExecution = useControlStore(state => state.resetExecution);

	const stepBackward = useControlStore(state => state.stepBackward);
	const stepForward = useControlStore(state => state.stepForward);

	const barsColored: boolean = useControlStore(state => state.barsColored);
	const toggleBarsColored = useControlStore(state => state.toggleBarsColored);
	const focusComparedBars: boolean = useControlStore(state => state.focusComparedBars);
	const toggleFocusComparedBars = useControlStore(state => state.toggleFocusComparedBars);

	return (
		<Grid
			size={12}
			sx={{ height: '80px' }}
		>
			<Stack
				height='100%'
				padding='10px'
				direction='row'
				justifyContent='center'
				alignItems='center'
				columnGap='40px'
			>
				<Stack
					direction='row'
					columnGap='10px'
				>
					<Tooltip title={translate('control_bar.code_controls.open_button')}>
						<IconButton>
							<FolderIcon fontSize='large' />
						</IconButton>
					</Tooltip>
					<Tooltip title={translate('control_bar.code_controls.download_button')}>
						<IconButton>
							<DownloadIcon fontSize='large' />
						</IconButton>
					</Tooltip>
					<Tooltip title={translate('control_bar.code_controls.share_button')}>
						<IconButton>
							<ShareIcon fontSize='large' />
						</IconButton>
					</Tooltip>
				</Stack>
				{VerticalDivider()}
				<Stack
					sx={{ width: 300 }}
				>
					<Typography>{translate('control_bar.main_execution_controls.execution_speed')}</Typography>
					<Slider
						min={1}
						max={10}
						value={executionSpeed}
						onChange={(_, newSpeed) => setExecutionSpeed(newSpeed)}
						marks
						valueLabelDisplay='auto'
						color='secondary'
					/>
				</Stack>
				<Stack
					direction='row'
					columnGap='10px'
				>
					<ControlIconButton
						contained
						color='run'
						tooltipTitle={translate('control_bar.main_execution_controls.run_button')}
						disabled={
							!readyToExecuteCode ||
							executionState === 'running' || (
								executionState === 'finished' &&
								executionHistoryPosition === executionHistory.length
							)
						}
						onClick={runExecution}
					>
						<PlayArrowIcon fontSize='large' />
					</ControlIconButton>
					<ControlIconButton
						color='pause'
						tooltipTitle={translate('control_bar.main_execution_controls.pause_button')}
						disabled={executionState !== 'running'}
						onClick={pauseExecution}
					>
						<PauseIcon fontSize='large' />
					</ControlIconButton>
					<ControlIconButton
						contained={executionState !== 'finished'}
						color='stop'
						tooltipTitle={executionState === 'finished' ?
							translate('control_bar.main_execution_controls.reset_button') :
							translate('control_bar.main_execution_controls.stop_button')}
						disabled={executionState === 'stopped'}
						onClick={() => {
							if (executionState === 'finished') {
								resetExecution();
							} else {
								stopExecution();
							}
						}}
					>
						{executionState === 'finished' ?
							<RestartAltIcon fontSize='large' /> :
							<StopIcon fontSize='large' />
						}
					</ControlIconButton>
				</Stack>
				{VerticalDivider()}
				<Stack
					direction='row'
					columnGap='10px'
				>
					<ControlIconButton
						color='secondary'
						tooltipTitle={translate('control_bar.manual_execution_controls.step_backward_button')}
						disabled={
							executionState === 'running' || executionState === 'stopped' ||
							executionHistoryPosition === 0
						}
						onClick={stepBackward}
					>
						<UndoIcon fontSize='large' />
					</ControlIconButton>
					<ControlIconButton
						color='run'
						tooltipTitle={translate('control_bar.manual_execution_controls.step_forward_button')}
						disabled={
							!readyToExecuteCode ||
							executionState === 'running' || (
								executionState === 'finished' &&
								executionHistoryPosition === executionHistory.length
							)
						}
						onClick={stepForward}
					>
						<RedoIcon fontSize='large' />
					</ControlIconButton>
				</Stack>
				{VerticalDivider()}
				<Stack
					direction='row'
					columnGap='10px'
				>
					<Select
						variant='filled'
						hiddenLabel
						value='bars'
					>
						<MenuItem value='bars'>{translate('control_bar.sorting_element_type_dropdown.bars')}</MenuItem>
						<MenuItem value='cards'>{translate('control_bar.sorting_element_type_dropdown.cards')}</MenuItem>
					</Select>
					<FormControlLabel
						label={translate('control_bar.sorting_element_type_specific_controls.bar_controls.colored')}
						control={
							<Checkbox
								checked={barsColored}
								onChange={toggleBarsColored}
							/>
						}
						sx={{ marginLeft: 0 }}
					/>
					<FormControlLabel
						label={translate('control_bar.sorting_element_type_specific_controls.bar_controls.focus_compared_bars')}
						control={
							<Checkbox
								checked={focusComparedBars}
								onChange={toggleFocusComparedBars}
							/>
						}
						sx={{ marginLeft: 0 }}
					/>
				</Stack>
			</Stack>
		</Grid>
	);
}

function VerticalDivider() {
	return (
		<Divider
			orientation='vertical'
			flexItem
			variant='middle'
			sx={{ borderWidth: '1px' }}
		/>
	);
}
