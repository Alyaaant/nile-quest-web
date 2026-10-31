import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const js=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/styles.css',import.meta.url),'utf8');
test('auth overlay does not dismiss on an input or backdrop tap',()=>{
 assert.match(js,/class="modal-wrap" role="presentation"/);
 assert.doesNotMatch(js,/data-action="dismiss"/);
 assert.match(js,/function syncAuthModal\(/);
 assert.match(html,/id="auth-layer"/);
});
test('mobile arrows are SVGs instead of emoji glyphs',()=>{
 assert.match(js,/const arrowUpRightSvg=/);
 assert.match(js,/class="svg-arrow"/);
 assert.doesNotMatch(js,/<span>↗<\/span>/);
 assert.match(css,/@media \(max-width:420px\)/);
});
