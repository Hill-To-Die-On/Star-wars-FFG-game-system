import Handlebars from 'handlebars';
// Development-only: callers must read reviewed repository template files.
// Reject AST inputs before Handlebars touches them; retain prototype deny lists.
const templateString=input=>{if(typeof input!=='string')throw new TypeError('Expected a trusted template string, never an AST object.');return input;};
export const compileTrustedTemplate=input=>Handlebars.compile(templateString(input));
export const precompileTrustedTemplate=input=>Handlebars.precompile(templateString(input));
