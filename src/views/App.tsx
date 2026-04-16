
import Grid from '@mui/material/Grid';

import { CodeView } from './code-view/CodeView.tsx';
import { DemoView } from './demo-view/DemoView.tsx';
import { ControlBar } from './control-bar/ControlBar.tsx';

function App() {
	return (
		<Grid container height='100vh' overflow='hidden'>
			<CodeView />
			<DemoView />
			<ControlBar />
		</Grid>
	);
}

export default App;
