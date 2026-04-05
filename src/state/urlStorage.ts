
import { strToU8, compressSync, decompressSync, strFromU8 } from 'fflate';
import { type StateStorage } from 'zustand/middleware';

export const URL_FRAGMENT_STATE_VARIABLE_NAME = 's';

export const urlStorage: StateStorage = {
	getItem: (name: string): string | null => {
		const params = new URLSearchParams(window.location.search);
		const value = params.get(name);

		if (value == null || value.trim() === '') {
			return null;
		}

		try {
			const base64 = value.replace(/-/g, '+').replace(/_/g, '/') +
				'=='.slice((value.length % 4) || 4);
			const compressed = Uint8Array.from(
				atob(base64),
				character => character.charCodeAt(0)
			);
			const decompressed = decompressSync(compressed);
			return strFromU8(decompressed);
		} catch (error) {
			console.error('Failed to extract state from URL.', error);
			return null;
		}
	},

	setItem: (name: string, value: string): void => {},

	removeItem: (name: string): void => {
		const params = new URLSearchParams(window.location.search);
		params.delete(name);
		const newRelativePathQuery = `${window.location.pathname}?${params.toString()}`;
		window.history.replaceState(null, '', newRelativePathQuery);
	}
};

export function compressDataIntoUrl(jsonString: string): string {
	const compressed = compressSync(strToU8(jsonString));
	const base64 = btoa(String.fromCharCode(...compressed))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/g, '');

	const params = new URLSearchParams(window.location.search);
	params.set(URL_FRAGMENT_STATE_VARIABLE_NAME, base64);

	const newUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
	window.history.replaceState(null, '', newUrl);

	return newUrl;
}
