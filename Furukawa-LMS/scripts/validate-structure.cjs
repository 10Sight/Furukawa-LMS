const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const parser=require(require.resolve('@babel/parser',{paths:[process.cwd(),path.resolve(__dirname,'../Furukawa-LMS-main/admin')]}));
const workspace=path.resolve(__dirname,'..');
const plans=require('../docs/architecture/restructure-manifest.json');
const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
function list(dir){return fs.readdirSync(dir,{withFileTypes:true}).filter(e=>!['node_modules','integrations'].includes(e.name)).flatMap(e=>e.isDirectory()?list(path.join(dir,e.name)):[path.join(dir,e.name)]);}
function walk(node,visit){if(!node||typeof node!=='object')return;if(node.type)visit(node);for(const [key,value]of Object.entries(node)){if(['loc','comments','tokens','extra'].includes(key))continue;if(Array.isArray(value))value.forEach(n=>walk(n,visit));else if(value&&typeof value==='object')walk(value,visit);}}
function logicHash(ast,isRoutes){const copy=JSON.parse(JSON.stringify(ast));walk(copy,n=>{for(const k of ['start','end','loc','extra','leadingComments','trailingComments','innerComments'])delete n[k];if(['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(n.type)&&n.source)n.source.value='__MODULE_PATH__';if(n.type==='CallExpression'&&((n.callee.type==='Import')||n.callee.name==='require')&&n.arguments[0]?.type==='StringLiteral')n.arguments[0].value='__MODULE_PATH__';if(isRoutes&&n.type==='Identifier'&&n.name==='AppRoutes')n.name='App';});delete copy.comments;return hash(JSON.stringify(copy));}
const results=[];
let failures=0;
for(const plan of plans){
  const root=path.resolve(workspace,plan.application),src=path.join(root,'src');
  const expected=new Map(plan.moduleRecords.map(r=>[path.resolve(root,r.file),r]));
  const missing=plan.moves.filter(m=>!fs.existsSync(path.resolve(root,m.to)));
  const broken=[],logicChanges=[],astByFile=new Map(),duplicates=[],brokenExports=[];
  const signatures=new Map();
  for(const file of list(src).filter(f=>/\.(js|jsx)$/.test(f))){
    const source=fs.readFileSync(file,'utf8');
    const ast=parser.parse(source,{sourceType:'module',plugins:['jsx']});astByFile.set(file,ast);
    if(expected.has(file)&&logicHash(ast,file.endsWith('AppRoutes.jsx'))!==expected.get(file).logicHash)logicChanges.push(path.relative(root,file));
    const signature=hash(source);if(signatures.has(signature))duplicates.push([path.relative(src,signatures.get(signature)),path.relative(src,file)]);else signatures.set(signature,file);
    walk(ast,n=>{
      let spec;
      if(['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(n.type)&&n.source)spec=n.source.value;
      if(n.type==='CallExpression'&&((n.callee.type==='Import')||n.callee.name==='require')&&n.arguments[0]?.type==='StringLiteral')spec=n.arguments[0].value;
      if(!spec||(!spec.startsWith('.')&&!spec.startsWith('@/')))return;
      const target=spec.startsWith('@/')?path.resolve(src,spec.slice(2)):path.resolve(path.dirname(file),spec);
      if(![target,target+'.js',target+'.jsx',path.join(target,'index.js'),path.join(target,'index.jsx')].some(f=>fs.existsSync(f)&&fs.statSync(f).isFile()))broken.push({file:path.relative(root,file),specifier:spec});
    });
  }
  function resolveModule(file,spec){
    if(!spec.startsWith('.')&&!spec.startsWith('@/'))return null;
    const target=spec.startsWith('@/')?path.resolve(src,spec.slice(2)):path.resolve(path.dirname(file),spec);
    return [target,target+'.js',target+'.jsx',path.join(target,'index.js'),path.join(target,'index.jsx')].find(f=>fs.existsSync(f)&&fs.statSync(f).isFile());
  }
  const exportCache=new Map();
  function bindings(pattern){
    if(!pattern)return [];
    if(pattern.type==='Identifier')return [pattern.name];
    if(pattern.type==='ObjectPattern')return pattern.properties.flatMap(p=>bindings(p.value||p.argument));
    if(pattern.type==='ArrayPattern')return pattern.elements.flatMap(bindings);
    if(pattern.type==='AssignmentPattern')return bindings(pattern.left);
    if(pattern.type==='RestElement')return bindings(pattern.argument);
    return [];
  }
  function getExports(file,seen=new Set()){
    if(!file)return null;
    if(exportCache.has(file))return exportCache.get(file);
    if(seen.has(file))return new Set();seen.add(file);
    if(!/\.(jsx|js)$/.test(file))return new Set(['default']);
    const ast=astByFile.get(file)||parser.parse(fs.readFileSync(file,'utf8'),{sourceType:'module',plugins:['jsx']});
    const result=new Set();
    for(const n of ast.program.body){
      if(n.type==='ExportDefaultDeclaration')result.add('default');
      if(n.type==='ExportNamedDeclaration'){
        if(n.declaration?.id)result.add(n.declaration.id.name);
        for(const d of n.declaration?.declarations||[])for(const name of bindings(d.id))result.add(name);
        for(const s of n.specifiers||[])result.add(s.exported.name||s.exported.value);
      }
      if(n.type==='ExportAllDeclaration')for(const name of getExports(resolveModule(file,n.source.value),new Set(seen))||['*'])if(name!=='default')result.add(name);
    }
    exportCache.set(file,result);return result;
  }
  for(const [file,ast]of astByFile)for(const n of ast.program.body){
    if(!n.source||!['ImportDeclaration','ExportNamedDeclaration'].includes(n.type))continue;
    const target=resolveModule(file,n.source.value);if(!target)continue;
    const exports=getExports(target);if(!exports||exports.has('*'))continue;
    for(const s of n.specifiers||[]){
      if(s.type==='ImportNamespaceSpecifier'||s.type==='ExportNamespaceSpecifier')continue;
      const name=s.type==='ImportDefaultSpecifier'?'default':s.type==='ImportSpecifier'?(s.imported.name||s.imported.value):(s.local.name||s.local.value);
      if(!exports.has(name))brokenExports.push({file:path.relative(root,file),specifier:n.source.value,export:name});
    }
  }
  const routeCount=[];walk(astByFile.get(path.join(src,'routes/AppRoutes.jsx')),n=>{if(n.type==='JSXOpeningElement'&&n.name.name==='Route')routeCount.push(n);});
  const result={application:plan.application,modules:astByFile.size,routes:routeCount.length,missingDestinations:missing,brokenImports:broken,brokenExports,logicChanges,exactDuplicates:duplicates};
  failures+=missing.length+broken.length+brokenExports.length+logicChanges.length+duplicates.length;results.push(result);
}
const integrationRoot=path.join(workspace,'Furukawa-LMS-main/admin/src/integrations');
for(const packageName of fs.readdirSync(integrationRoot)){
  const packageRoot=path.join(integrationRoot,packageName),sourceRoot=path.join(packageRoot,'src');
  if(!fs.existsSync(sourceRoot))continue;
  let modules=0;const brokenImports=[];
  for(const file of list(sourceRoot).filter(f=>/\.(js|jsx)$/.test(f))){
    const ast=parser.parse(fs.readFileSync(file,'utf8'),{sourceType:'module',plugins:['jsx']});modules++;
    walk(ast,n=>{
      const spec=n.source?.value||(n.type==='CallExpression'&&n.callee.type==='Import'?n.arguments[0]?.value:null);
      if(!spec?.startsWith('.'))return;
      const target=path.resolve(path.dirname(file),spec);
      if(![target,target+'.js',target+'.jsx',path.join(target,'index.js'),path.join(target,'index.jsx')].some(f=>fs.existsSync(f)&&fs.statSync(f).isFile()))brokenImports.push({file:path.relative(packageRoot,file),specifier:spec});
    });
  }
  results.push({application:'integration/'+packageName,modules,brokenImports});failures+=brokenImports.length;
}
fs.writeFileSync(path.join(workspace,'docs/architecture/validation-report.json'),JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results.map(r=>({...r,...(r.brokenExports?{brokenExports:r.brokenExports.slice(0,15),brokenExportCount:r.brokenExports.length}:{})})),null,2));
if(failures)process.exitCode=1;
