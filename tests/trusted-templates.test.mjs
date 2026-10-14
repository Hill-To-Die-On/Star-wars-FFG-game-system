import test from 'node:test';
import assert from 'node:assert/strict';
import { compileTrustedTemplate,precompileTrustedTemplate } from '../scripts/trusted-templates.mjs';

test('development compilers reject AST objects before accessing their fields',()=>{
  let accessed=false;const input={get type(){accessed=true;throw Error('Untrusted AST accessed');}};
  for(const compile of [compileTrustedTemplate,precompileTrustedTemplate])assert.throws(()=>compile(input),/template string/);
  assert.equal(accessed,false);
});
test('trusted template compilation retains normal escaping and default prototype restrictions',()=>{
  const template=compileTrustedTemplate('<p>{{name}}</p>{{lookup inherited "secret"}}');
  assert.equal(template({name:'<script>',inherited:Object.create({secret:'hidden'})}),'<p>&lt;script&gt;</p>');
  assert.equal(typeof precompileTrustedTemplate('<p>{{name}}</p>'),'string');
});
