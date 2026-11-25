// Updates the GitHub repo (remote "github", branch main) with one new commit made from HEAD's files,
// leaving out what stays private: the YM v2 client (vendor/yahoo-v2/, all rights reserved), copies of its
// styles (test references, and the Zalo skin's v2.css, which ships only in the release zip), and the community
// vote data. Local history (company e-mail, earlier files) never leaves this computer:
// commits go on the local branch "public", authored with the GitHub account's noreply address.
// Usage: npm run publish [-- --message "…"] [--fresh] [--dry-run]
//   --fresh    one new commit with no parent, force-pushed (replaces what is on GitHub)
//   --dry-run  build the commit and list what would go up, push nothing
// The working tree must be clean. With other work in progress, run it from a clean worktree of HEAD
// (git worktree add --detach <folder> HEAD).
import {execFileSync} from 'node:child_process';
import {readFileSync,rmSync} from 'node:fs';

// fixtures/zalo/reference/v2, v2-reference.html and the Zalo skin's vendor/v2.css keep YM v2's styles and
// markup unchanged (v2.css only scopes the selectors). docs/codex/ holds notes for the YM v2 site's own work;
// v2-vote/NOTES.md is the post's internal note (not for posting).
const EXCLUDE=['vendor/yahoo-v2/','fixtures/zalo/reference/v2/','fixtures/zalo/demo/v2-reference.html','extension/adapters/zalo/vendor/v2.css','docs/community-post/VOTE-RESULTS.md','docs/community-post/v2-vote/NOTES.md','docs/codex/'];
const AUTHOR={name:'yourmessengerymzalofb',email:'352232371+yourmessengerymzalofb@users.noreply.github.com'};
const REMOTE='github',BRANCH='public';
const args=process.argv.slice(2),flag=f=>args.includes(f);
const message=args.includes('--message')?args[args.indexOf('--message')+1]:'';
const git=(list,env={})=>execFileSync('git',list,{encoding:'utf8',env:{...process.env,...env}}).trim();
const fail=text=>{console.error(text);process.exit(1);};
// The temporary index lives in this checkout's git folder (in a linked worktree .git is a file, not a folder).
const INDEX=git(['rev-parse','--git-path','publish-index']);

if(git(['status','--porcelain']))fail('Còn thay đổi chưa commit: commit trước (script chỉ đưa lên những gì đã commit), hoặc chạy từ một worktree sạch của HEAD.');
if(!git(['remote']).split('\n').includes(REMOTE))fail('Chưa có remote "'+REMOTE+'".');

// HEAD's files without the private paths, in an index of its own (the working tree is not touched).
const env={GIT_INDEX_FILE:INDEX};
let tree;
try{
  git(['read-tree','HEAD'],env);
  for(const p of EXCLUDE)git(['rm','-r','--cached','-q','--ignore-unmatch','--',p],env);
  tree=git(['write-tree'],env);
}finally{rmSync(INDEX,{force:true});}
const files=git(['ls-tree','-r','--name-only',tree]).split('\n');
const leaked=files.filter(f=>EXCLUDE.some(p=>f===p||f.startsWith(p)));
if(leaked.length)fail('Dừng: còn file riêng tư trong cây: '+leaked.slice(0,5).join(', '));

let parent='';
if(!flag('--fresh'))try{parent=git(['rev-parse','--verify','-q','refs/heads/'+BRANCH]);}catch{}
if(parent&&git(['rev-parse',parent+'^{tree}'])===tree){console.log('GitHub đã có đúng nội dung này, không có gì mới.');process.exit(0);}
const version=JSON.parse(readFileSync('extension/manifest.json','utf8')).version_name;
const commit=git(['commit-tree',tree,...(parent?['-p',parent]:[]),'-m',message||'Your Messenger '+version],
  {GIT_AUTHOR_NAME:AUTHOR.name,GIT_AUTHOR_EMAIL:AUTHOR.email,GIT_COMMITTER_NAME:AUTHOR.name,GIT_COMMITTER_EMAIL:AUTHOR.email});
console.log(`Commit ${commit.slice(0,7)}: ${files.length} file, ${parent?'nối tiếp '+parent.slice(0,7):'không có commit trước'}.`);
if(flag('--dry-run')){console.log('Chạy thử: không đổi nhánh '+BRANCH+', không đẩy.');process.exit(0);}
git(['update-ref','refs/heads/'+BRANCH,commit]);
execFileSync('git',['push',...(flag('--fresh')?['--force']:[]),REMOTE,BRANCH+':main'],{stdio:'inherit'});
