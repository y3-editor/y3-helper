const fs = require('fs');

console.log('dts-post.js: start');

const path = './template/plugin/y3-helper.d.ts';
let content = fs.readFileSync(path, 'utf8');

// 从 `interface MapUnit {` 开始到 `type KV` 之前的内容全都删掉
content = content.replace(/interface MapUnit \{[\s\S]*?type KV/, 'type KV');

fs.writeFileSync(path, content, 'utf8');

console.log('dts-post.js: finish');
