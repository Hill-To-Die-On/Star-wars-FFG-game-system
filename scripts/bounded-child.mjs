import {spawn,execFileSync} from 'node:child_process';
import {join} from 'node:path';

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
        else process.kill(-child.pid,'SIGKILL');
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
