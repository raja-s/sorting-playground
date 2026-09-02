
import { useState } from 'react';

import Grid from '@mui/material/Grid';

import { CodeView } from './code-view/CodeView.tsx';
import { DemoView } from './demo-view/DemoView.tsx';
import { ControlBar } from './control-bar/ControlBar.tsx';

import GuidedTour from './guided-tour/GuidedTour.tsx';
import AnnotationReferenceDialog from './annotation-reference-dialog/AnnotationReferenceDialog.tsx';
import SplashDialogAndTopLogo from './SplashDialogAndTopLogo.tsx';

type State = {
	guidedTourIsOn: boolean,
	annotationReferenceIsOpen: boolean
};

const INITIAL_STATE: State = {
	guidedTourIsOn: false,
	annotationReferenceIsOpen: false
};

const GUIDED_TOUR_IS_ON_STATE: State = {
	guidedTourIsOn: true,
	annotationReferenceIsOpen: false
};

const ANNOTATION_REFERENCE_IS_OPEN_STATE: State = {
	guidedTourIsOn: false,
	annotationReferenceIsOpen: true
};

function App() {
	const [ state, setState ] = useState<State>(INITIAL_STATE);

	return (
		<Grid
			container
			height='100vh'
			overflow='hidden'
		>
			<CodeView
				onGuidedTourButtonClick={() => {
					setState(GUIDED_TOUR_IS_ON_STATE);
				}}
				onAnnotationReferenceButtonClick={() => {
					setState(ANNOTATION_REFERENCE_IS_OPEN_STATE);
				}}
			/>
			<DemoView />
			<ControlBar />
			<AnnotationReferenceDialog
				isOpen={state.annotationReferenceIsOpen}
				onClose={() => { setState(INITIAL_STATE); }}
			/>
			<GuidedTour
				isOn={state.guidedTourIsOn}
				onEnd={() => { setState(INITIAL_STATE); }}
			/>
			<SplashDialogAndTopLogo
				onGuidedTourButtonClick={() => {
					setState(GUIDED_TOUR_IS_ON_STATE);
				}}
			/>
		</Grid>
	);
}

export default App;
