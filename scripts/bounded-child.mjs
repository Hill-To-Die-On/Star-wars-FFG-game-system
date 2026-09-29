import {spawn,execFileSync} from 'node:child_process';
import {join} from 'node:path';

function stopPosixTree(pid) {
  // Playwright starts Chromium in a separate process group. Capture ancestry before killing its parent.
  const rows=execFileSync('ps',['-A','-o','pid=,ppid=,pgid='],{encoding:'utf8',timeout:5_000,maxBuffer:4*1024*1024})
    .trim().split('\n').map(line=>line.trim().split(/\s+/).map(Number));
  const owned=new Set([pid]);let changed=true;
  while(changed){changed=false;for(const [id,parent]of rows)if(owned.has(parent)&&!owned.has(id)){owned.add(id);changed=true;}}
  const signal=target=>{try{process.kill(target,'SIGKILL');}catch(error){if(error.code!=='ESRCH')throw error;}};
  const groups=new Set(rows.filter(([id,,group])=>owned.has(id)&&owned.has(group)).map(([,,group])=>group));
  for(const group of groups)if(group!==pid)signal(-group);
  for(const id of [...owned].reverse())if(id!==pid)signal(id);
  signal(-pid);
}

/** Each fixture owns one process tree. Timeout cleanup must include browser descendants. */
export function runBoundedChild(command,args,{cwd,env,timeout=120_000,maxBuffer=8*1024*1024}={}) {
  return new Promise(resolve=>{
    const child=spawn(command,args,{cwd,env,windowsHide:true,detached:process.platform!=='win32',stdio:['ignore','pipe','pipe']});
    const result={stdout:'',stderr:'',status:null,signal:null,error:null,timedOut:false,cleanupFailure:null};
    let timer,fallback,bytes=0,stopping=false,finished=false;
    const finish=(code,signal)=>{
      if(finished)return;finished=true;clearTimeout(timer);clearTimeout(fallback);
      result.status=code;result.signal=signal;resolve(result);
    };
    const stop=reason=>{
      if(stopping||finished)return;stopping=true;result.error=reason;
      // Kill descendants while their owned parent still exists. Never kill by process name.
      try {
        if(process.platform==='win32')execFileSync(join(process.env.SystemRoot??'C:\\Windows','System32','taskkill.exe'),['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore',timeout:10_000});
        else stopPosixTree(child.pid);
      } catch(error) {
        result.cleanupFailure=`Could not stop the owned fixture process tree: ${error.message}`;
        child.kill('SIGKILL');
      }
      fallback=setTimeout(()=>{
        result.cleanupFailure??='Owned fixture did not confirm process exit.';
        finish(null,null);
      },5_000);
    };
    for(const stream of ['stdout','stderr'])child[stream].on('data',chunk=>{
      bytes+=chunk.length;
      if(bytes<=maxBuffer)result[stream]+=chunk.toString();
      else stop('Fixture output exceeded its bounded buffer.');
    });
    child.once('error',error=>{result.error=error.message;});
    child.once('close',finish);
    timer=setTimeout(()=>{result.timedOut=true;stop('Fixture timed out.');},timeout);
  });
}
