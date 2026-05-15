import * as assert from 'assert';
import { buildImageDataUrl, isNonEmptyBase64 } from '../../codemaker/utils/imageData';

suite('Image data helpers', () => {
	test('rejects empty image base64', () => {
		assert.strictEqual(isNonEmptyBase64(''), false);
		assert.strictEqual(isNonEmptyBase64('not base64,'), false);
		assert.strictEqual(buildImageDataUrl('image/png', ''), null);
	});

	test('rejects non-image MIME types', () => {
		assert.strictEqual(buildImageDataUrl('text/plain', 'abcd'), null);
	});

	test('builds non-empty image data URLs', () => {
		assert.strictEqual(
			buildImageDataUrl('image/png', 'iVBORw0KGgo='),
			'data:image/png;base64,iVBORw0KGgo='
		);
	});
});
